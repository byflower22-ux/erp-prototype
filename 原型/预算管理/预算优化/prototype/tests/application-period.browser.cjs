/* Run with ERP_PLAYWRIGHT_MODULE pointing to the installed Playwright package. */
const {chromium}=require(process.env.ERP_PLAYWRIGHT_MODULE||'playwright');
const assert=require('node:assert/strict');
const path=require('node:path');
const {pathToFileURL}=require('node:url');
const root=path.resolve(__dirname,'../../../../..');
const storageKey='budget-prototype-adjustment-drafts-v1';
async function check(page){
  const amount=()=>page.locator('input[data-application-value="travel|2026-10"]');
  const reason=()=>page.locator('textarea[data-application-reason="travel"]');
  const button=()=>page.locator('[data-action="application-expand"]');
  const toggle=()=>button().click();
  const overlay=()=>page.locator('#overlay');
  const confirm=()=>page.locator('[data-action="application-confirm-period"]').click();
  const cancel=()=>page.locator('[data-action="application-cancel-period"]').click();
  async function mode(annual){
    assert.equal(await page.locator('#application-period').count(),0);
    assert.equal(await button().getAttribute('aria-expanded'),String(annual));
    assert.equal(await button().innerText(),annual?'收起，仅看当前月':'展开全年，调整其他月份');
    assert.equal(await page.locator('.application-matrix thead tr').first().locator('th[colspan="5"]').count(),annual?12:1);
    if(!annual)assert.match(await page.locator('.application-matrix thead tr').first().innerText(),/2026-10（当前月）/);
  }
  const clean=async()=>{
    assert.equal(await reason().inputValue(),'');
    assert.match(await page.locator('.application-summary').innerText(),/本次调整\s+0\s+笔/);
  };
  await mode(false);await toggle();await mode(true);assert.equal(await overlay().isVisible(),false);
  await toggle();await mode(false);
  const before=await amount().inputValue();
  await amount().fill(String(Number(before)+123));await reason().fill('月度调整原因');
  await toggle();await mode(false);assert.match(await overlay().innerText(),/将清空已填写数据/);
  await cancel();assert.equal(await amount().inputValue(),String(Number(before)+123));
  assert.equal(await reason().inputValue(),'月度调整原因');
  assert.equal(await page.locator('.workspace-item.current .draft-dot').count(),1);
  await toggle();await page.locator('#overlay .close').click();await mode(false);
  await toggle();await page.locator('#overlay .drawer').press('Escape');await mode(false);
  await toggle();await confirm();await mode(true);await clean();
  assert.equal(await amount().inputValue(),before);
  assert.equal(await page.locator('.workspace-item.current .draft-dot').count(),0);
  await toggle();await reason().fill('只有原因');await toggle();await confirm();await mode(true);await clean();
  await amount().fill('');await toggle();assert.equal(await overlay().isVisible(),true);
  await confirm();await mode(false);await clean();
  // Clearing from the annual view must clear other months as well.
  await toggle();await amount().fill(String(Number(before)+300));
  const other=page.locator('input[data-application-value="travel|2026-09"]');
  const otherBefore=await other.inputValue();await other.fill(String(Number(otherBefore)+400));await reason().fill('全年调整');
  await toggle();await cancel();await mode(true);assert.equal(await other.inputValue(),String(Number(otherBefore)+400));
  await toggle();await confirm();await mode(false);await clean();
  await toggle();assert.equal(await other.inputValue(),otherBefore);await toggle();
  // Clearing a saved draft must be persistent and isolated by team.
  await amount().fill(String(Number(before)+500));await reason().fill('已保存草稿');
  await page.locator('[data-action="application-save"]').click();
  await page.evaluate(key=>{const saved=JSON.parse(localStorage.getItem(key));saved.t2={sentinel:'preserve'};localStorage.setItem(key,JSON.stringify(saved));},storageKey);
  const saved=await page.evaluate(key=>localStorage.getItem(key),storageKey);
  await toggle();await cancel();assert.equal(await page.evaluate(key=>localStorage.getItem(key),storageKey),saved);
  await page.evaluate(()=>{window.periodOriginalSetItem=Storage.prototype.setItem;Storage.prototype.setItem=function(){throw new Error('test storage failure');};});
  await toggle();await confirm();await mode(false);assert.equal(await reason().inputValue(),'已保存草稿');
  assert.equal(await overlay().isVisible(),true);
  await page.evaluate(()=>{Storage.prototype.setItem=window.periodOriginalSetItem;delete window.periodOriginalSetItem;});
  await confirm();await mode(true);await clean();
  const remaining=await page.evaluate(key=>JSON.parse(localStorage.getItem(key)),storageKey);
  assert.equal(remaining.t1,undefined);assert.deepEqual(remaining.t2,{sentinel:'preserve'});
  await toggle();await mode(false);assert.equal(await amount().inputValue(),before);
}
(async()=>{
  const browser=await chromium.launch({channel:'chrome',headless:true});
  try{
    for(const target of ['source','standalone','workspace']){
      const context=await browser.newContext({viewport:{width:1440,height:1000}});
      const host=await context.newPage();const errors=[];host.on('pageerror',e=>errors.push(e.message));
      let page=host;
      async function openRequest(){
        if(target!=='workspace'){page=host;return;}
        await host.locator('nav button[data-module="budget"][data-page="application"]').click();
        page=host.frameLocator('iframe[data-module="budget"]');
        await page.locator('[data-action="application-select"]').click();
        await page.locator('input[name="application-team"][value="t1"]').check();
        await page.locator('[data-action="application-confirm-team"]').click();
        const frame=await host.locator('iframe[data-module="budget"]').elementHandle();page=await frame.contentFrame();
      }
      if(target==='workspace'){
        await host.goto(pathToFileURL(path.join(root,'index.html')).href);await openRequest();
      }else{
        const file=target==='source'?'prototype/index.html':'预算管理交互原型_当前.html';
        await host.goto(pathToFileURL(path.join(root,'原型/预算管理/预算优化',file)).href+'#request');
      }
      await check(page);
      await host.reload();await openRequest();
      assert.equal(await page.locator('textarea[data-application-reason="travel"]').inputValue(),'');
      assert.match(await page.locator('.application-summary').innerText(),/本次调整\s+0\s+笔/);
      // Legacy drafts may contain a selected month; reopen on the current month without losing values.
      await page.locator('input[data-application-value="travel|2026-10"]').fill('17001');
      await page.locator('textarea[data-application-reason="travel"]').fill('旧草稿');
      await page.locator('[data-action="application-save"]').click();
      await page.evaluate(key=>{const saved=JSON.parse(localStorage.getItem(key));saved.t1.month='2026-08';saved.t1.values['travel|2026-08']='18001';localStorage.setItem(key,JSON.stringify(saved));},storageKey);
      await host.reload();await openRequest();
      assert.equal(await page.locator('input[data-application-value="travel|2026-10"]').inputValue(),'17001');
      assert.equal(await page.locator('input[data-application-value="travel|2026-08"]').count(),0);
      await page.locator('[data-action="application-expand"]').click();
      await page.locator('[data-action="application-confirm-period"]').click();
      assert.equal(await page.locator('[data-action="application-expand"]').innerText(),'收起，仅看当前月');
      for(const width of [1024,1440]){
        await host.setViewportSize({width,height:1000});
        const b=await page.locator('[data-action="application-expand"]').boundingBox();
        assert.ok(b&&b.x>=0&&b.x+b.width<=width,'toggle must fit viewport');
      }
      // Submitted snapshots survive annual/current-month viewing.
      await page.locator('input[data-application-value="travel|2026-10"]').fill('17002');
      await page.locator('textarea[data-application-reason="travel"]').fill('只读快照');
      await page.locator('[data-action="application-submit"]').click();
      await page.locator('[data-action="application-confirm-submit"]').click();
      if(target==='workspace')await host.locator('#erp-tabs button[data-tab-id="budget:request-t1"][data-action="activate"]').click();
      else await page.locator('[data-action="activate-workspace"][data-key="request-t1"]').click();
      await page.locator('[data-action="application-expand"]').click();
      assert.equal(await page.locator('#overlay').isVisible(),false);
      assert.equal(await page.locator('[data-application-after="travel|2026-10"] span').innerText(),'17,002.00');
      assert.match(await page.locator('[data-application-row="travel"] .application-reason-col').innerText(),/只读快照/);
      assert.deepEqual(errors,[]);console.log('PASS '+target+': no month selector, current-month/annual labels, confirmation, drafts/reload/legacy, read-only snapshot, responsive controls');
      await context.close();
    }
  }finally{await browser.close();}
})().catch(error=>{console.error(error);process.exitCode=1;});
