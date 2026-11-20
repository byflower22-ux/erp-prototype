/* Verify the current workbench locally or with ERP_ENTRY_URL; keep evidence in this iteration. */
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const {pathToFileURL}=require('node:url');
const {chromium}=require(process.env.ERP_PLAYWRIGHT_MODULE||'playwright');
const root=path.resolve(__dirname,'../../../..');
const entry=process.env.ERP_ENTRY_URL||pathToFileURL(path.join(root,'index.html')).href;
const out=process.env.ERP_QA_OUTPUT||path.join(root,'文档/迭代/项目管理优化/.cache/发布检查');fs.mkdirSync(out,{recursive:true});
(async()=>{
 const browser=await chromium.launch({channel:'chrome',headless:true});
 const checks=[],errors=[],failures=[];const pass=name=>{checks.push(name);console.log('PASS '+name);};
 try{
  const context=await browser.newContext({viewport:{width:1440,height:1000}}),page=await context.newPage();
  page.on('pageerror',e=>errors.push(e.message));page.on('requestfailed',r=>failures.push(r.url()));
  await page.goto(entry);await page.locator('#erp-tabs [aria-current="page"]').waitFor();
  const nav=key=>page.locator(`nav button[data-module="project"][data-page="${key}"]`);
  for(const key of ['schedule','projects','consultants','project-analysis','person-analysis']){
   await nav(key).click();await page.waitForFunction(k=>document.querySelector('#erp-tabs [aria-current="page"]')?.dataset.tabId==='project:'+k,key);
   const frame=page.frameLocator('iframe[data-module="project"]');await frame.locator('#content h1').waitFor();
   assert.ok((await frame.locator('#content').innerText()).length>100);
   assert.equal(await nav(key).getAttribute('aria-current'),'page');
   assert.equal(await nav(key).evaluate(el=>getComputedStyle(el).borderLeftWidth),'3px');
   await nav(key).click();assert.equal(await page.locator(`#erp-tabs [data-tab-id="project:${key}"][data-action="activate"]`).count(),1);
  }
  assert.equal(await page.locator('iframe[data-module="project"]').count(),1);pass('五个当前菜单页面加载、高亮及页签复用');
  const f=page.frameLocator('iframe[data-module="project"]');await nav('schedule').click();
  await f.locator('.weekly-table').waitFor();assert.equal(await f.locator('.weekly-table thead th').count(),9);
  await f.locator('[data-action="fill-period"][data-mode="month"]').click();assert.ok(await f.locator('.weekly-table thead th').count()>25);
  await f.locator('[data-action="fill-period"][data-mode="week"]').click();pass('工时周表与月表切换');
  assert.equal(await f.locator('input[data-week-cell]').count(),0);
  await f.locator('[data-action="schedule-edit"]').first().click();
  const cell=f.locator('input[data-week-cell]:enabled').first();
  await cell.fill('0.5');await cell.locator('xpath=ancestor::div[contains(@class,"daily-cell-entry")]').locator('select').selectOption('项目准备');
  const prior=await f.locator('body').evaluate(()=>JSON.parse(localStorage.getItem('erp-project-demo-v1'))?.revision??ProjectModel.seed().revision);
  await f.locator('[data-action="week-save"]').click();const businessFrame=await (await page.locator('iframe[data-module="project"]').elementHandle()).contentFrame();await businessFrame.waitForFunction(p=>JSON.parse(localStorage.getItem('erp-project-demo-v1'))?.revision>p,prior);
  await nav('project-analysis').click();await nav('schedule').click();
  assert.equal(await f.locator('input[data-week-cell]').count(),0);
  await f.locator('[data-action="schedule-edit"]').first().click();assert.equal(await f.locator('input[data-week-cell]:enabled').first().inputValue(),'0.5');
  await f.locator('[data-action="schedule-edit-cancel"]').click();pass('工时实际保存、跨页保留及默认查看状态');
  await f.locator('#demo-role').selectOption('manager');assert.equal(await f.locator('input[data-week-cell]').count(),0);assert.equal(await f.locator('[data-action="week-save"]').count(),0);
  await f.locator('[data-action="schedule-edit"]').first().click();assert.ok(await f.locator('input[data-week-cell]:enabled').count()>0);await f.locator('[data-action="schedule-edit-cancel"]').click();pass('授权管理员默认查看、主动进入编辑');
  await f.locator('#demo-role').selectOption('finance');
  await f.locator('[data-action="schedule-edit"]').first().click();
  await f.locator('input[data-week-cell]:enabled').first().fill('1');
  const budgetNav=page.locator('nav button[data-module="budget"][data-page="overview"]');
  await budgetNav.click();await f.locator('#schedule-leave-stay').click();assert.equal(await f.locator('input[data-week-cell]:enabled').first().inputValue(),'1');
  await budgetNav.click();await f.locator('#schedule-leave-discard').click();await page.waitForFunction(()=>document.querySelector('#erp-tabs [aria-current="page"]')?.dataset.tabId==='budget:overview');
  await nav('schedule').click();await f.locator('[data-action="schedule-edit"]').first().click();assert.equal(await f.locator('input[data-week-cell]:enabled').first().inputValue(),'0.5');await f.locator('[data-action="schedule-edit-cancel"]').click();pass('跨模块离开未保存工时，继续编辑与放弃修改均正确');
  await nav('person-analysis').click();await f.locator('.person-overview-grid').waitFor();await f.locator('[data-action="manager-view"][data-view="accounting"]').click();await f.locator('.person-ledger').waitFor();pass('新人员概览与核算明细均加载');
  await nav('consultants').click();await f.locator('[data-action="consultant-monthly-pay"][data-id="u1"]').click();
  const pay=f.locator('#consultant-monthly-pay');await pay.locator('[name="salary-2026-11"]').fill('12345');await pay.locator('[name="benefits-2026-11"]').fill('1000');await pay.locator('[data-action="dialog-save"]').click();await pay.waitFor({state:'hidden'});
  assert.equal(await f.locator('body').evaluate(()=>ProjectModel.fixedPay(JSON.parse(localStorage.getItem('erp-project-demo-v1')),'u1','2026-11').total),13345);pass('年度月度固定成本填写保存并同步核算');
  await nav('projects').click();await f.locator('[data-action="project-detail"][data-id="p1"]').first().click();await f.locator('[data-action="delivery-application"][data-kind="落地辅导"]').click();
  const application=f.locator('#delivery-application-form');await application.locator('[name="deliveryRatio"]').fill('1');
  const shares=application.locator('[data-da-share]');for(let i=0;i<await shares.count();i++)await shares.nth(i).fill(i===0?'100':'0');
  await application.locator('input[type="file"]').setInputFiles({name:'发布验收.txt',mimeType:'text/plain',buffer:Buffer.from('demo acceptance')});await application.locator('[data-action="dialog-save"]').click();await application.waitFor({state:'hidden'});
  const applicationRow=await f.locator('body').evaluate(()=>JSON.parse(localStorage.getItem('erp-project-demo-v1')).deliveryApplications.at(-1));assert.equal(applicationRow.status,'审批中');assert.equal(applicationRow.projectId,'p1');assert.equal(applicationRow.allocations.reduce((sum,r)=>sum+r.ratio,0),100);pass('交付申请含附件与成员收入分配，提交后保留审批中记录');
  const config=await page.locator('#erp-version-marks').evaluate(el=>el.config);
  const baseline=JSON.parse(fs.readFileSync(path.join(root,'文档/迭代/预算优化/版本标记验收/项目默认标记_20261027.json'),'utf8'));
  assert.deepEqual(config.marks.slice(0,13),baseline.marks);assert.ok(config.marks.some(m=>m.module==='project'));
  pass('原预算默认标记保留且追加项目版本标记');
  await page.screenshot({path:path.join(out,'工作台.png')});
  const phone=await context.newPage();phone.on('pageerror',e=>errors.push(e.message));await phone.setViewportSize({width:390,height:844});
  await phone.goto(new URL('原型/项目管理/项目管理优化/index.html',entry).href);await phone.locator('.mobile-schedule').waitFor();
  assert.equal(await phone.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);await phone.screenshot({path:path.join(out,'手机日程.png')});pass('390像素手机日程加载且无横向溢出');
  await phone.goto(new URL('原型/项目管理/项目管理优化/index.html?mobile=1&v=20261120-release1',entry).href);await phone.locator('.mobile-home').waitFor();assert.equal(await phone.locator('.mobile-home-banner img').evaluate(el=>el.complete&&el.naturalWidth>0),true);await phone.screenshot({path:path.join(out,'移动端首页.png')});await phone.locator('[data-action="mobile-home-schedule"]').click();await phone.locator('.mobile-schedule').waitFor();assert.equal(await phone.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);pass('移动端首页图片加载、项目日程入口及窄屏布局');
  assert.deepEqual(errors,[]);assert.deepEqual(failures,[]);
  fs.writeFileSync(path.join(out,'release-report.json'),JSON.stringify({date:new Date().toISOString(),entry,checks,errors,failedRequests:failures},null,2)+'\n');
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});




