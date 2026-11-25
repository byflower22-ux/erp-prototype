const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),{pathToFileURL}=require('node:url');
const {chromium}=require(process.env.ERP_PLAYWRIGHT_MODULE||'playwright'),ExcelJS=require('../vendor/exceljs-4.4.0.min.js');
const entry=process.env.ERP_ENTRY_URL||pathToFileURL(path.resolve(__dirname,'../../../../index.html')).href,out=process.env.ERP_QA_OUTPUT;
(async()=>{const browser=await chromium.launch({channel:'chrome',headless:true});try{
 const page=await browser.newPage({viewport:{width:1500,height:1100}}),errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.goto(entry);
 const f=page.frameLocator('iframe[data-module="project"]');
 async function download(button){const waiting=page.waitForEvent('download');await button.click();const d=await waiting,chunks=[];for await(const chunk of await d.createReadStream())chunks.push(chunk);const book=new ExcelJS.Workbook();await book.xlsx.load(Buffer.concat(chunks));return book;}
 for(const [scope,key,value,column,expected] of [['person','person-analysis',456,'G6',31],['project','project-analysis',123,'K6',40]]){
  await page.locator(`nav button[data-module="project"][data-page="${key}"]`).click();await f.locator('[data-filter="periodMode"][data-value="month"]').click();
  await f.locator('[data-action="analysis-import"]').click();const form=f.locator('#analysis-import-form');
  await form.locator('[data-import-multi="expenseTypes"] summary').click();await form.locator('[data-import-choice="expenseTypes"][value="其他成本"]').check();await form.locator('[data-import-multi="expenseTypes"] summary').click();
  const book=await download(form.locator('[data-action="analysis-import-template"]')),sheet=book.worksheets[0];
  assert.equal(book.worksheets.length,1);if(scope==='person'){assert.equal(sheet.name,'人员核算数据');assert.match(sheet.getRow(5).values.join('|'),/其他成本/);assert.doesNotMatch(sheet.getRow(5).values.join('|'),/奖金/);}else assert.equal(sheet.getCell('E6').value,'其他成本');
  sheet.getCell(column).value=value;await form.locator('input[type="file"]').setInputFiles({name:'其他成本.xlsx',mimeType:'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',buffer:Buffer.from(await book.xlsx.writeBuffer())});
  await form.locator('[data-action="dialog-save"]:enabled').waitFor();assert.match(await form.locator('#analysis-import-preview').innerText(),/其他成本/);await form.locator('[data-action="dialog-save"]').click();await form.waitFor({state:'hidden'});
  const stored=await f.locator('body').evaluate((el,{scope,value})=>{const w=el.ownerDocument.defaultView,s=JSON.parse(w.localStorage.getItem('erp-project-demo-v1'));return s.expenses.filter(r=>r.category===(scope==='person'?'personOther':'other')&&r.amount===value).length;},{scope,value});assert.equal(stored,1);
  await f.locator('[data-action="manager-view"][data-view="accounting"]').click();assert.match(await f.locator('.project-ledger thead').innerText(),/其他成本/);
  const exported=await download(f.locator('[data-action="export-analysis"]'));assert.equal(exported.worksheets[0].getRow(4).cellCount,expected);assert.match(exported.worksheets[0].getRow(4).values.join('|'),/其他成本/);
  const spans=await f.locator('.project-ledger thead tr').first().locator('th').evaluateAll(nodes=>nodes.reduce((sum,n)=>sum+n.colSpan,0));assert.equal(spans,expected);
  await f.locator('[data-filter="periodMode"][data-value="cumulative"]').click();const annual=await download(f.locator('[data-action="export-analysis"]'));assert.equal(annual.worksheets[0].getRow(4).cellCount,scope==='person'?29:38);
 }
 assert.deepEqual(errors,[]);if(out){fs.mkdirSync(out,{recursive:true});await page.screenshot({path:path.join(out,'其他成本与核算明细.png')});fs.writeFileSync(path.join(out,'other-cost-report.json'),JSON.stringify({entry,date:new Date().toISOString(),errors,checks:['项目及人员其他成本模板独立生成','真实上传、差异预览及确认写入','成本列与表头分组一致','月度和年度导出包含其他成本']},null,2));}console.log('PASS both other-cost selectors, scoped template downloads, real Excel upload/preview/confirm, ledger field and group alignment, monthly/annual export, no JS errors');
}finally{await browser.close();}})().catch(e=>{console.error(e);process.exitCode=1;});
