const assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path'),{pathToFileURL}=require('node:url');
const {chromium}=require(process.env.ERP_PLAYWRIGHT_MODULE||'playwright');
const entry=process.env.ERP_ENTRY_URL||pathToFileURL(path.resolve(__dirname,'../../../../index.html')).href;
const out=process.env.ERP_QA_OUTPUT;
const ExcelJS=require('../vendor/exceljs-4.4.0.min.js');
(async()=>{
 const browser=await chromium.launch({channel:'chrome',headless:true});
 try{
  const page=await browser.newPage({viewport:{width:1500,height:1100}}),errors=[];
  page.on('pageerror',e=>errors.push(e.message));
  await page.goto(entry);
  const f=page.frameLocator('iframe[data-module="project"]');
  for(const [key,modes,ledger] of [['project-analysis',['cumulative','project'],'.project-ledger'],['person-analysis',['cumulative'],'.person-ledger']]){
   await page.locator(`nav button[data-module="project"][data-page="${key}"]`).click();
   for(const mode of modes){
    await f.locator(`[data-filter="periodMode"][data-value="${mode}"]`).click();
    assert.doesNotMatch(await f.locator('#content').innerText(),/数据缺失|待补充|缺失内容|缺失月份|已知年度/);
    await f.locator('[data-action="manager-view"][data-view="accounting"]').click();
    assert.doesNotMatch(await f.locator(ledger).innerText(),/数据缺失|待补充|缺失内容|数据状态/);
    assert.ok(await f.locator(ledger+' tbody tr').count()>0);
    const pending=page.waitForEvent('download');await f.locator('[data-action="export-analysis"]').click();
    const download=await pending;assert.match(download.suggestedFilename(),/\.xlsx$/);
    const chunks=[];for await(const chunk of await download.createReadStream())chunks.push(chunk);
    const book=new ExcelJS.Workbook();await book.xlsx.load(Buffer.concat(chunks));
    const sheet=book.worksheets[0],expected=key==='person-analysis'?28:mode==='project'?35:38;
    assert.equal(sheet.getRow(4).cellCount,expected);
    assert.equal(await f.locator(ledger+' thead tr').last().locator('th').count(),expected);
    const exported=[];sheet.eachRow(row=>row.eachCell(cell=>exported.push(String(cell.value??''))));
    assert.doesNotMatch(exported.join('\n'),/数据缺失|待补充|缺失内容|数据状态/);
    await f.locator('[data-action="manager-view"][data-view="overview"]').click();
   }
   await f.locator('[data-filter="periodMode"][data-value="month"]').click();
   await f.locator('[data-action="manager-view"][data-view="accounting"]').click();
   assert.match(await f.locator(ledger+' thead').innerText(),/数据状态/);
   await f.locator('[data-action="manager-view"][data-view="overview"]').click();
  }
  await f.locator('[data-filter="periodMode"][data-value="month"]').click();
  assert.match(await f.locator('#content').innerText(),/数据缺失/);
  assert.deepEqual(errors,[]);
  if(out){fs.mkdirSync(out,{recursive:true});await page.screenshot({path:path.join(out,'累计与当月数据状态.png')});fs.writeFileSync(path.join(out,'cumulative-available-report.json'),JSON.stringify({entry,date:new Date().toISOString(),errors,checks:['项目年累计及项目累计隐藏缺失状态','人效年累计隐藏缺失状态','累计明细与Excel列数一致','当月保留数据状态与缺失提示']},null,2));}
  console.log('PASS browser: project annual/lifetime and person annual details and Excel omit data status and missing labels; monthly retains data status and missing notices; no JS errors');
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
