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
  const period=()=>page.locator('#application-period');
  const overlay=()=>page.locator('#overlay');
  const confirm=()=>page.locator('[data-action="application-confirm-period"]').click();
  const cancel=()=>page.locator('[data-action="application-cancel-period"]').click();
  const hidden=async()=>assert.equal(await overlay().isVisible(),false);
  const month=async(value)=>assert.equal(await period().inputValue(),value);
  const clean=async()=>{
    assert.equal(await reason().inputValue(),'');
    assert.match(await page.locator('.application-summary').innerText(),/本次调整\s+0\s+笔/);
  };
  await period().selectOption('2026-09');await month('2026-09');await hidden();
  await page.locator('[data-action="application-expand"]').click();await month('annual');await hidden();
  await page.locator('[data-action="application-expand"]').click();await month('2026-09');
  await period().selectOption('2026-10');
  const before=await amount().inputValue();
  await amount().fill(String(Number(before)+123));await reason().fill('月度调整原因');
  assert.equal(await page.locator('.workspace-item.current .draft-dot').count(),1);
  await period().selectOption('2026-11');await month('2026-10');
  assert.match(await overlay().innerText(),/将清空已填写数据/);
  await cancel();await hidden();assert.equal(await amount().inputValue(),String(Number(before)+123));
  assert.equal(await reason().inputValue(),'月度调整原因');
  assert.equal(await page.locator('.workspace-item.current .draft-dot').count(),1);
  await period().selectOption('annual');await page.locator('#overlay .close').click();await month('2026-10');
  await period().selectOption('annual');await page.locator('#application-period').press('Escape');await hidden();await month('2026-10');
  await period().selectOption('2026-11');await confirm();await month('2026-11');await clean();
  assert.equal(await page.locator('.workspace-item.current .draft-dot').count(),0);
  await period().selectOption('2026-10');assert.equal(await amount().inputValue(),before);
  // A reason alone and an incomplete amount both need confirmation.
  await reason().fill('只有原因');await period().selectOption('annual');await confirm();await month('annual');await clean();
  await amount().fill('');await page.locator('[data-action="application-expand"]').click();
  assert.equal(await overlay().isVisible(),true);await confirm();await month('2026-10');await clean();
  // Clear every month, including data hidden after collapsing the annual view.
  await period().selectOption('annual');await amount().fill(String(Number(before)+300));
  const other=page.locator('input[data-application-value="travel|2026-09"]');
  const otherBefore=await other.inputValue();await other.fill(String(Number(otherBefore)+400));await reason().fill('全年调整');
  await page.locator('[data-action="application-expand"]').click();await cancel();await month('annual');
  assert.equal(await other.inputValue(),String(Number(otherBefore)+400));
  await page.locator('[data-action="application-expand"]').click();await confirm();await month('2026-10');await clean();
  await period().selectOption('annual');assert.equal(await other.inputValue(),otherBefore);await period().selectOption('2026-10');
  // A saved draft must be cleared persistently, without deleting other teams.
  await amount().fill(String(Number(before)+500));await reason().fill('已保存草稿');
  await page.locator('[data-action="application-save"]').click();
  await page.evaluate(key=>{const saved=JSON.parse(localStorage.getItem(key));saved.t2={sentinel:'preserve'};localStorage.setItem(key,JSON.stringify(saved));},storageKey);
  const saved=await page.evaluate(key=>localStorage.getItem(key),storageKey);
  await period().selectOption('2026-09');await cancel();
  assert.equal(await page.evaluate(key=>localStorage.getItem(key),storageKey),saved);
  // Storage failure must leave both the view and entered data intact for retry.
  await page.evaluate(()=>{window.periodOriginalSetItem=Storage.prototype.setItem;Storage.prototype.setItem=function(){throw new Error('test storage failure');};});
  await period().selectOption('2026-09');await confirm();await month('2026-10');
  assert.equal(await reason().inputValue(),'已保存草稿');assert.equal(await overlay().isVisible(),true);
  await page.evaluate(()=>{Storage.prototype.setItem=window.periodOriginalSetItem;delete window.periodOriginalSetItem;});
  await confirm();await month('2026-09');await clean();
  const remaining=await page.evaluate(key=>JSON.parse(localStorage.getItem(key)),storageKey);
  assert.equal(remaining.t1,undefined);assert.deepEqual(remaining.t2,{sentinel:'preserve'});
  await period().selectOption('2026-10');assert.equal(await amount().inputValue(),before);
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
        await host.goto(pathToFileURL(path.join(root,'index.html')).href);
        await openRequest();
      }else{
        const file=target==='source'?'prototype/index.html':'预算管理交互原型_当前.html';
        await host.goto(pathToFileURL(path.join(root,'原型/预算管理/预算优化',file)).href+'#request');
      }
      await check(page);
      await host.reload();await openRequest();
      assert.equal(await page.locator('textarea[data-application-reason="travel"]').inputValue(),'');
      assert.match(await page.locator('.application-summary').innerText(),/本次调整\s+0\s+笔/);
      // Saved drafts retain their selected month and are guarded after reopening.
      await page.locator('#application-period').selectOption('2026-08');
      await page.locator('input[data-application-value="travel|2026-08"]').fill('17001');
      await page.locator('textarea[data-application-reason="travel"]').fill('八月草稿');
      await page.locator('[data-action="application-save"]').click();
      await host.reload();await openRequest();
      assert.equal(await page.locator('#application-period').inputValue(),'2026-08');
      assert.equal(await page.locator('input[data-application-value="travel|2026-08"]').inputValue(),'17001');
      await page.locator('#application-period').selectOption('annual');
      await page.locator('[data-action="application-confirm-period"]').click();
      for(const width of [1024,1440]){
        await host.setViewportSize({width,height:1000});
        const boxes=await page.locator('.section-heading .filters').evaluate(el=>[...el.children].map(c=>{const r=c.getBoundingClientRect();return {left:r.left,right:r.right,top:r.top,bottom:r.bottom};}));
        assert.equal(boxes.length,2);assert.ok(boxes[0].right<=boxes[1].left||boxes[0].bottom<=boxes[1].top,'period controls overlap');
      }
      // Submitted requests keep the original amounts/reasons while viewing periods.
      await page.locator('input[data-application-value="travel|2026-08"]').fill('17002');
      await page.locator('textarea[data-application-reason="travel"]').fill('只读快照');
      await page.locator('[data-action="application-submit"]').click();
      await page.locator('[data-action="application-confirm-submit"]').click();
      if(target==='workspace')await host.locator('#erp-tabs button[data-tab-id="budget:request-t1"][data-action="activate"]').click();
      else await page.locator('[data-action="activate-workspace"][data-key="request-t1"]').click();
      await page.locator('#application-period').selectOption('2026-08');
      assert.equal(await page.locator('#overlay').isVisible(),false);
      assert.equal(await page.locator('[data-application-after="travel|2026-08"] span').innerText(),'17,002.00');
      assert.match(await page.locator('[data-application-row="travel"] .application-reason-col').innerText(),/只读快照/);
      assert.deepEqual(errors,[]);console.log('PASS '+target+': period switching, cancel, clearing, drafts/reload/isolation, storage failure, dirty flags, read-only snapshot, responsive controls');
      await context.close();
    }
  }finally{await browser.close();}
})().catch(error=>{console.error(error);process.exitCode=1;});
