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
    const sheet=book.worksheets[0],expected=key==='person-analysis'?29:mode==='project'?35:38;
    assert.equal(sheet.getRow(4).cellCount,expected);
    assert.equal(await f.locator(ledger+' thead tr').last().locator('th').count(),expected);
    if(key==='person-analysis'){
     const labels=sheet.getRow(4).values.slice(1),col=label=>labels.indexOf(label)+1;
     assert.equal(col('税费（3.3%）'),col('税率')+1);assert.equal(col('总成本'),col('其他成本')+1);assert.equal(col('未分摊人工'),0);assert.ok(col('年度盈亏平衡交付收入')>0);
     assert.equal(await f.locator('[data-ledger="person"][data-field="税率"]').count(),0);
     let checked=0;for(let row=5;row<=sheet.rowCount;row++){
      assert.equal(sheet.getCell(row,col('税率')).value,.033);assert.match(sheet.getCell(row,col('税率')).numFmt,/%/);
      const value=label=>sheet.getCell(row,col(label)).value,income=value('年度交付收入');
      if(typeof income==='number'&&income>0){const expected=(value('年度固定人工合计')+value('提成')+value('奖金'))/(1-(value('税费（3.3%）')+value('管理费'))/income);assert.ok(Math.abs(value('年度盈亏平衡交付收入')-expected)<.011);checked++;}
     }assert.ok(checked>0);
    }
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
  await f.locator('[data-action="manager-view"][data-view="accounting"]').click();
  const open=f.locator('[data-action="project-status-open"][data-kind="data"]'),popover=f.locator('#data-status-popover');
  await open.click();assert.deepEqual(await popover.locator('input').evaluateAll(xs=>xs.map(x=>x.value)),['实时核算','已结快照','数据缺失']);
  await popover.locator('input[value="实时核算"]').check();await popover.locator('input[value="数据缺失"]').check();await popover.locator('[data-action="project-status-apply"]').click();assert.equal(await f.locator('.person-ledger tbody tr').count(),15);
  await open.click();await popover.locator('input[value="数据缺失"]').uncheck();await popover.locator('[data-action="project-status-apply"]').click();assert.match(await f.locator('.person-ledger tbody').innerText(),/暂无/);
  await page.locator('nav button[data-module="project"][data-page="project-analysis"]').click();await f.locator('[data-action="manager-view"][data-view="accounting"]').click();assert.equal(await f.locator('.project-ledger tbody tr').count(),13);
  await page.locator('nav button[data-module="project"][data-page="person-analysis"]').click();await open.click();await popover.locator('[data-action="project-status-reset"]').click();assert.equal(await f.locator('.person-ledger tbody tr').count(),15);
  await open.click();await f.locator('#content h1').click();await popover.waitFor({state:'hidden'});
  assert.deepEqual(errors,[]);
  if(out){fs.mkdirSync(out,{recursive:true});await page.screenshot({path:path.join(out,'累计与当月数据状态.png')});fs.writeFileSync(path.join(out,'cumulative-available-report.json'),JSON.stringify({entry,date:new Date().toISOString(),errors,checks:['项目年累计及项目累计隐藏缺失状态','人效年累计隐藏缺失状态','累计明细与Excel列数一致','当月保留数据状态与缺失提示']},null,2));}
  console.log('PASS browser: project annual/lifetime and person annual details and Excel omit data status and missing labels; monthly retains data status and missing notices; no JS errors');
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
