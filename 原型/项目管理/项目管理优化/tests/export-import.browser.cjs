/* Current analysis exports and sidebar import, locally or via ERP_ENTRY_URL. */
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const {pathToFileURL}=require('node:url'),ExcelJS=require('../vendor/exceljs-4.4.0.min.js'),M=require('../model.js');
const {chromium}=require(process.env.ERP_PLAYWRIGHT_MODULE||'C:/Users/BS/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const root=path.resolve(__dirname,'../../../..'),entry=process.env.ERP_ENTRY_URL||pathToFileURL(path.join(root,'index.html')).href;
const out=process.env.ERP_QA_OUTPUT||path.join(root,'文档/迭代/在线预览部署/.cache/20261110');
(async()=>{
 const b=await chromium.launch({channel:'chrome',headless:true}),checks=[],errors=[];fs.mkdirSync(out,{recursive:true});
 try{
  const c=await b.newContext({acceptDownloads:true,viewport:{width:1440,height:1000}}),p=await c.newPage();p.on('pageerror',e=>errors.push(e.message));
  await p.goto(entry);const f=p.frameLocator('iframe[data-module="project"]');await f.locator('.weekly-table').waitFor();
  const nav=async key=>{await p.locator(`nav button[data-module="project"][data-page="${key}"]`).click();await p.waitForFunction(key=>document.querySelector('#erp-tabs [aria-current="page"]')?.dataset.tabId==='project:'+key,key);};
  const pass=name=>{checks.push(name);console.log('PASS '+name);};
  const download=async button=>{const pending=p.waitForEvent('download');await button.click();const d=await pending;assert.match(d.suggestedFilename(),/\.xlsx$/);const book=new ExcelJS.Workbook();await book.xlsx.load(fs.readFileSync(await d.path()));return book;};
  await nav('project-analysis');const project=await download(f.locator('[data-action="export-analysis"]'));
  const sheet=project.getWorksheet('咨询项目利润明细表');assert.ok(sheet);assert.equal(sheet.columnCount,30);assert.equal(sheet.getCell('A1').value,'咨询项目利润明细表');
  const seed=M.seed(),row=seed.projects.find(x=>x.name===sheet.getCell('C4').value);assert.ok(row);const result=M.projectResult(seed,row.id,'2026-11');assert.equal(sheet.getCell('H4').value,result.contract);assert.equal(sheet.getCell('K4').value,result.cumulative.income);
  pass('项目分析实际下载30列Excel，项目及合同和累计交付数据正确');
  await nav('person-analysis');const personnel=await download(f.locator('[data-action="export-analysis"]'));assert.equal(personnel.worksheets.length,1);const personal=personnel.worksheets[0];assert.equal(personal.columnCount,18);assert.ok(personal.getCell('G4').formula);assert.ok(personal.getCell('B4').value);pass('人员分析实际下载18列Excel，公式和人员数据可读取');
  await f.locator('[data-filter="periodMode"][data-value="cumulative"]').click();const cumulative=await download(f.locator('[data-action="export-analysis"]'));assert.equal(cumulative.worksheets.length,3);pass('累计人员导出按3个月分Sheet');
  await f.getByRole('button',{name:'打开AI龙虾分析'}).click();assert.equal(await f.locator('[data-aa="clear"]').count(),0);
  await f.locator('[data-aa="import"]').click();await f.locator('[data-aa="download"]').waitFor();const template=await download(f.locator('[data-aa="download"]').last());
  template.getWorksheet('人员固定成本').getCell('H8').value=11000;
  await f.locator('input[aria-label="选择导入核算Excel"]').setInputFiles({name:'填写.xlsx',mimeType:'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',buffer:Buffer.from(await template.xlsx.writeBuffer())});
  await f.locator('.aa-history').filter({hasText:'尚未写入'}).waitFor();
  const prior=await f.locator('body').evaluate(()=>JSON.parse(localStorage.getItem('erp-project-demo-v1'))?.revision??ProjectModel.seed().revision);
  await f.locator('textarea[aria-label="向AI龙虾提问"]').fill('确认导入');await f.getByRole('button',{name:'发送分析问题'}).click();await f.locator('.aa-history').filter({hasText:'核算数据导入成功'}).waitFor();
  const saved=await f.locator('body').evaluate(()=>JSON.parse(localStorage.getItem('erp-project-demo-v1')));assert.ok(saved.revision>prior);assert.equal(saved.salaries.find(x=>x.personId==='u3'&&x.month==='2026-11').amount,11000);pass('AI固定导入入口生成模板，上传预览确认后写入正确工资');
  await f.locator('#demo-role').selectOption('manager');await f.locator('#analysis-ai-drawer').waitFor();assert.equal(await f.locator('[data-aa="import"]').isVisible(),false);pass('管理人员不能使用财务导入入口');
  await p.screenshot({path:path.join(out,'分析侧栏.png')});assert.deepEqual(errors,[]);
  fs.writeFileSync(path.join(out,'export-import-report.json'),JSON.stringify({entry,date:new Date().toISOString(),checks,errors},null,2));await c.close();
 }finally{await b.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
