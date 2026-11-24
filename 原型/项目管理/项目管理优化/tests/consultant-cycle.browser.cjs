const assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path'),{pathToFileURL}=require('node:url');
const {chromium}=require(process.env.ERP_PLAYWRIGHT_MODULE||'playwright');
const entry=process.env.ERP_ENTRY_URL||pathToFileURL(path.resolve(__dirname,'../../../../index.html')).href;
const out=process.env.ERP_QA_OUTPUT;
(async()=>{
 const browser=await chromium.launch({channel:'chrome',headless:true});
 try{
  const page=await browser.newPage({viewport:{width:1500,height:1100}}),errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.goto(entry);
  const nav=key=>page.locator(`nav button[data-module="project"][data-page="${key}"]`);
  await nav('consultants').click();const f=page.frameLocator('iframe[data-module="project"]');
  await f.locator('[data-action="consultant-new"]').click();
  const draft=f.locator('#consultant-account-form');await draft.locator('[name="fixedSalary"]').fill('12345');await draft.locator('[name="note"]').fill('保留账号选择前的录入');
  await draft.locator('#consultant-account-trigger').click();
  const chooser=f.getByRole('dialog',{name:'选择 ERP 账号',exact:true});await chooser.locator('[aria-label="搜索人员"]').fill('B28943');assert.equal(await chooser.locator('[data-person-id="erp-u1"]').isDisabled(),true);
  await chooser.locator('[aria-label="搜索人员"]').fill('B32608');await chooser.locator('[data-person-id="erp-u4"]').click();await chooser.waitFor({state:'detached'});
  assert.equal(await draft.locator('[name="name"]').inputValue(),'陈书宁');assert.equal(await draft.locator('[name="employeeNo"]').inputValue(),'B32608');assert.equal(await draft.locator('[name="name"]').getAttribute('readonly'),'');assert.equal(await draft.locator('[name="fixedSalary"]').inputValue(),'12345');assert.equal(await draft.locator('[name="note"]').inputValue(),'保留账号选择前的录入');
  await draft.locator('#consultant-account-trigger').click();await chooser.getByRole('button',{name:'关闭账号选择'}).click();assert.equal(await draft.locator('[name="accountId"]').inputValue(),'erp-u4');
  page.once('dialog',d=>d.accept());await f.locator('#dialog [data-action="dialog-close"]').first().click();await draft.waitFor({state:'hidden'});
  await f.locator('[data-action="consultant-edit"][data-id="u3"]').click();
  let form=f.locator('#consultant-account-form');
  await form.locator('[name="fixedSalary"]').fill('20000');await form.locator('[name="fixedBenefits"]').fill('3000');await form.locator('[name="fixedPayEffective"]').fill('2026-11');
  await form.locator('[data-action="dialog-save"]').click();await form.waitFor({state:'hidden'});
  const results=await f.locator('body').evaluate(()=>{const s=JSON.parse(localStorage.getItem('erp-project-demo-v1'));return ['2026-10','2026-11','2026-12'].map(m=>ProjectModel.fixedPay(s,'u3',m).total);});
  assert.deepEqual(results,[11000,23000,23000]);
  await f.locator('[data-action="consultant-edit"][data-id="u3"]').click();form=f.locator('#consultant-account-form');
  await form.locator('[name="fixedSalary"]').fill('22222');await form.locator('[name="fixedPayEffective"]').fill('2026-10');await form.locator('[data-action="dialog-save"]').click();
  assert.match(await form.locator('#form-error').innerText(),/固化|锁定/);
  await form.locator('[name="fixedSalary"]').fill('20000');await form.locator('[name="fixedPayEffective"]').fill('2026-11');
  await form.locator('[name="accountingStart"]').fill('2026-10');await form.locator('[name="accountingEnd"]').fill('2026-09');await form.locator('[data-action="dialog-save"]').click();assert.match(await form.locator('#form-error').innerText(),/结束月份/);
  await form.locator('[name="accountingEnd"]').fill('2026-10');await form.locator('[data-action="dialog-save"]').click();await form.waitFor({state:'hidden'});
  await f.locator('[data-action="consultant-monthly-pay"][data-id="u3"]').click();assert.equal(await f.locator('[name="salary-2026-11"]').count(),0);assert.equal(await f.locator('[name="salary-2026-10"]').count(),1);await f.locator('#dialog [data-action="dialog-close"]').first().click();
  await nav('person-analysis').click();await f.locator('[data-filter="periodMode"][data-value="month"]').click();await f.locator('[data-action="manager-view"][data-view="accounting"]').click();
  assert.doesNotMatch(await f.locator('.person-ledger tbody').innerText(),/许映舟/);
  await f.locator('[data-filter="periodMode"][data-value="cumulative"]').click();assert.match(await f.locator('.person-ledger tbody').innerText(),/许映舟/);
  await nav('project-analysis').click();await f.locator('[data-filter="periodMode"][data-value="project"]').click();
  assert.equal(await f.locator('[data-filter="month"],[data-filter="analysisYear"]').count(),0);assert.equal(await f.locator('.project-delivery-trend').count(),0);
  assert.match(await f.locator('#content').innerText(),/项目累计经营情况/);
  await f.locator('[data-action="manager-view"][data-view="accounting"]').click();assert.match(await f.locator('.project-ledger thead').innerText(),/项目累计核算/);assert.doesNotMatch(await f.locator('.project-ledger thead').innerText(),/本年度|当月|核算期间/);
  const downloaded=page.waitForEvent('download');await f.locator('[data-action="export-analysis"]').click();const file=await downloaded;assert.match(file.suggestedFilename(),/项目累计/);
  assert.deepEqual(errors,[]);
  if(out){fs.mkdirSync(out,{recursive:true});await page.screenshot({path:path.join(out,'核算周期与项目累计.png')});fs.writeFileSync(path.join(out,'consultant-cycle-report.json'),JSON.stringify({entry,date:new Date().toISOString(),results,errors,checks:['ERP账号搜索、重复禁选、基础信息带出及父表单保留','固定人工生效与历史保护','核算周期起止与月度人工可见性','人员当月及年度范围','项目全周期概览、明细及导出']},null,2));}
  console.log('PASS browser: effective pay, frozen protection, cycle validation, monthly/annual visibility, project lifetime overview/details/export, no JS errors');
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
