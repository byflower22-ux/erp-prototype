/* Run with ERP_PLAYWRIGHT_MODULE pointing to an installed Playwright package, or install it normally.
   ERP_ENTRY_URL may point to an HTTP deployment; defaults to the local root index.html. */
const assert = require('node:assert/strict');
const path = require('node:path');
const {pathToFileURL} = require('node:url');
const {chromium} = require(process.env.ERP_PLAYWRIGHT_MODULE || 'playwright');
const entry = process.env.ERP_ENTRY_URL || pathToFileURL(path.resolve(__dirname,'../../../index.html')).href;
const output = path.resolve(__dirname,'../../../文档/迭代/公共框架验收');
const fs = require('node:fs');
const os = require('node:os');
const {execFileSync} = require('node:child_process');
fs.mkdirSync(output,{recursive:true});
(async () => {
  const browser=await chromium.launch({channel:process.env.ERP_BROWSER_CHANNEL || 'chrome',headless:true});
  const context=await browser.newContext({viewport:{width:1440,height:1000}});
  const page=await context.newPage();
  const errors=[], failures=[];
  page.on('pageerror',error=>errors.push(error.message));
  page.on('requestfailed',request=>failures.push(request.url()));
  const checks=[];
  const passed=name=>{checks.push(name);console.log('PASS '+name);};
  const nav=(module,key)=>page.locator(`nav button[data-module="${module}"][data-page="${key}"]`);
  const tab=(module,key,action='activate')=>page.locator(`#erp-tabs button[data-tab-id="${module}:${key}"][data-action="${action}"]`);
  async function active(module,key) {await page.waitForFunction(id=>document.querySelector('#erp-tabs button[aria-current="page"]')?.dataset.tabId===id,module+':'+key);}
  try {
    await page.goto(entry);
    await active('budget','overview');
    const budget=page.frames().find(f=>f.url().includes('/prototype/index.html'));
    assert.ok(budget);
    assert.equal(await budget.locator('.sidebar').isVisible(),false);
    assert.equal(await budget.locator('.topbar').isVisible(),false);
    assert.equal(await budget.locator('.workspace-tabs').isVisible(),false);
    passed('统一入口显示公共外壳，预算原外壳隐藏');

    assert.equal(await nav('budget','rules').count(),0);
    assert.equal(await page.locator('.erp-sidebar-foot').count(),0);
    await nav('budget','application').click();await active('budget','application');
    await nav('budget','application').click();await active('budget','application');
    assert.equal(await tab('budget','application').count(),1);
    assert.equal(await nav('budget','application').getAttribute('aria-current'),'page');
    await nav('budget','approval').click();await active('budget','approval');
    assert.equal(await nav('budget','approval').getAttribute('aria-current'),'page');
    passed('菜单打开并复用工作页签，预算与办公菜单高亮同步');

    await nav('budget','overview').click();await active('budget','overview');
    await budget.locator('[data-action="team-nav"][data-page="budget"]').first().click();
    await active('budget','budget-t1');
    const input=budget.locator('input[data-budget]').first();
    await input.fill('23456');
    await page.waitForFunction(()=>document.querySelector('[data-tab-id="budget:budget-t1"] .erp-dirty'));
    await page.locator('[data-group="budget"] summary').click();
    assert.equal(await page.locator('[data-group="budget"]').getAttribute('open'),null);
    await input.fill('23457');
    await page.waitForTimeout(100);
    assert.equal(await page.locator('[data-group="budget"]').getAttribute('open'),null);
    passed('预算编辑脏标记同步，编辑消息不重置菜单折叠状态');

    await nav('receipt','list').click();await active('receipt','list');
    const receipt=page.frames().find(f=>f.url().includes('/回单对接/')||decodeURI(f.url()).includes('/回单对接/'));
    assert.ok(receipt);
    assert.equal(await receipt.locator('.sidebar').isVisible(),false);
    assert.equal(await receipt.locator('.topbar').isVisible(),false);
    assert.equal(await receipt.locator('.tab-strip').isVisible(),false);
    const receiptId=await receipt.locator('#receipt-table-body .title-link').first().getAttribute('data-id');
    await receipt.locator('#keyword-input').fill(receiptId);
    await receipt.locator('#search-button').click();
    const filteredText=await receipt.locator('#receipt-table-body').innerText();
    const receiptUrl=receipt.url(), budgetUrl=budget.url();
    await tab('budget','budget-t1').click();await active('budget','budget-t1');
    assert.equal(await input.inputValue(),'23457');
    await tab('receipt','list').click();await active('receipt','list');
    assert.equal(await receipt.locator('#keyword-input').inputValue(),receiptId);
    assert.equal(await receipt.locator('#receipt-table-body').innerText(),filteredText);
    assert.equal(receipt.url(),receiptUrl);assert.equal(budget.url(),budgetUrl);
    assert.equal(page.frames().length,3);
    passed('跨模块切换保留预算编辑、回单查询结果，复用常驻业务页面');

    await receipt.locator('#receipt-table-body .title-link').first().click();await active('receipt','detail');
    assert.equal(await receipt.locator('#approval-detail-page').isVisible(),true);
    assert.equal(await receipt.locator('.approval-detail-page__tabs').isVisible(),false);
    await receipt.locator('[data-action="approval-detail-tab"][data-tab="history"]').click();
    await receipt.locator('[data-action="file-preview"]').click();await active('receipt','preview');
    assert.equal(context.pages().length,1);
    assert.equal(await receipt.locator('#file-preview-page').isVisible(),true);
    assert.equal(await receipt.locator('.file-preview-page__tabs').isVisible(),false);
    await tab('receipt','detail').click();await active('receipt','detail');
    assert.equal(await receipt.locator('[data-action="approval-detail-tab"][data-tab="history"]').getAttribute('aria-selected'),'true');
    await tab('receipt','preview').click();await active('receipt','preview');
    await tab('receipt','preview','close').click();await active('receipt','detail');
    assert.equal(await tab('receipt','preview').count(),0);
    passed('回单详情及文件预览进入公共页签，保留详情子页并在关闭后返回');

    await receipt.locator('[data-action="approval-detail-tab"][data-tab="form"]').click();
    await page.screenshot({path:path.join(output,'回单统一页签.png')});
    await tab('budget','budget-t1','close').click();await active('budget','budget-t1');
    await budget.locator('#overlay').waitFor({state:'visible'});
    assert.ok((await budget.locator('#overlay').innerText()).includes('放弃未保存的修改'));
    await budget.getByRole('button',{name:'继续编辑',exact:true}).click();
    assert.equal(await input.inputValue(),'23457');
    assert.equal(await tab('budget','budget-t1').count(),1);
    await tab('budget','budget-t1','close').click();
    await budget.locator('#overlay [data-action="discard-workspace"]').click();
    await page.waitForFunction(()=>!document.querySelector('[data-tab-id="budget:budget-t1"]'));
    passed('关闭后台脏页签先展示原确认，取消保留编辑，确认后移除');

    await nav('budget','overview').click();await active('budget','overview');
    await budget.locator('[data-action="team-nav"][data-page="execute"]').first().click();await active('budget','execute');
    await budget.locator('#month-select').selectOption('2026-09');
    await tab('receipt','list').click();await active('receipt','list');
    await tab('budget','execute').click();await active('budget','execute');
    assert.equal(await budget.locator('#month-select').inputValue(),'2026-09');
    assert.equal(await nav('budget','overview').getAttribute('aria-current'),'page');
    await page.locator('#toggle-nav').click();
    assert.equal(await page.locator('.erp-sidebar').isVisible(),false);
    await page.locator('#toggle-nav').click();
    await page.screenshot({path:path.join(output,'预算统一页签.png')});
    passed('预算执行月份保留，页签切换同步菜单，导航整体折叠可恢复');

    const tabsBefore=await page.locator('.erp-tab').count();
    await page.evaluate(()=>window.postMessage({protocol:'erp-workspace-v1',type:'snapshot',active:'fake',tabs:[{key:'fake',label:'fake',nav:'overview'}]},'*'));
    await page.waitForTimeout(100);
    assert.equal(await page.locator('.erp-tab').count(),tabsBefore);
    passed('忽略非业务窗口伪造的页签快照');

    while(await page.locator('#erp-tabs .erp-close').count()) {
      const id=await page.locator('#erp-tabs .erp-close').last().getAttribute('data-tab-id');
      await page.locator('#erp-tabs .erp-close').last().click();
      await page.waitForFunction(value=>!Array.from(document.querySelectorAll('#erp-tabs .erp-close')).some(b=>b.dataset.tabId===value),id);
    }
    assert.equal(await page.locator('#erp-empty').isVisible(),true);
    assert.equal(await page.locator('nav [aria-current="page"]').count(),0);
    await nav('receipt','list').click();await active('receipt','list');
    assert.equal(await receipt.locator('#keyword-input').inputValue(),receiptId);
    assert.equal(page.frames().length,3);
    passed('关闭全部页签显示空态，菜单重新打开保留业务查询');

    // Direct entry still uses the existing standalone layout.
    const standalone=await context.newPage();
    await standalone.goto(new URL('原型/付款报销/回单对接/index.html',entry).href);
    assert.equal(await standalone.locator('.sidebar').isVisible(),true);
    assert.equal(await standalone.locator('.tab-strip').isVisible(),true);
    await standalone.goto(new URL('原型/预算管理/预算优化/prototype/index.html#overview',entry).href);
    assert.equal(await standalone.locator('.sidebar').isVisible(),true);
    assert.equal(await standalone.locator('.workspace-tabs').isVisible(),true);
    await standalone.close();
    passed('两个模块独立入口仍可运行并显示原有外壳');

    const buildTemp=fs.mkdtempSync(path.join(os.tmpdir(),'erp-budget-build-'));
    try {
      const prototype=path.join(buildTemp,'原型/预算管理/预算优化/prototype');
      fs.cpSync(path.resolve(__dirname,'../../预算管理/预算优化/prototype'),prototype,{recursive:true});
      const shared=path.join(buildTemp,'原型/公共');fs.mkdirSync(shared,{recursive:true});
      fs.copyFileSync(path.resolve(__dirname,'../iteration-marks.js'),path.join(shared,'iteration-marks.js'));
      const baseline=path.join(prototype,'../预算管理交互原型.html');
      fs.writeFileSync(baseline,'baseline sentinel');
      const detailBefore=fs.readFileSync(path.join(prototype,'reimbursement-detail.html'),'utf8');
      execFileSync(process.execPath,[path.join(prototype,'build.cjs')],{stdio:'pipe'});
      assert.equal(fs.readFileSync(baseline,'utf8'),'baseline sentinel');
      assert.equal(fs.readFileSync(path.join(prototype,'reimbursement-detail.html'),'utf8'),detailBefore);
      assert.throws(()=>execFileSync(process.execPath,[path.join(prototype,'build.cjs'),'--output',baseline],{stdio:'pipe'}));
      const builtPage=await context.newPage();
      builtPage.on('pageerror',error=>errors.push(error.message));
      await builtPage.goto(pathToFileURL(path.join(prototype,'../预算管理交互原型_当前.html')).href);
      assert.equal(await builtPage.locator('.sidebar').isVisible(),true);
      assert.equal(await builtPage.locator('.workspace-tabs .workspace-item').count(),2);
      await builtPage.locator('erp-iteration-marks').getByRole('button',{name:'显示标记',exact:true}).click();
      await builtPage.locator('erp-iteration-marks .pin').first().waitFor();
      await builtPage.locator('erp-iteration-marks').getByRole('button',{name:'配置标记',exact:true}).click();
      await builtPage.locator('erp-iteration-marks').getByRole('dialog',{name:'配置版本标记',exact:true}).waitFor();
      await builtPage.locator('erp-iteration-marks').getByRole('button',{name:'关闭配置',exact:true}).click();
      await builtPage.close();
    } finally {fs.rmSync(buildTemp,{recursive:true,force:true});}
    console.log('PASS 预算在临时目录重新构建后可独立打开（不覆盖现有基线 HTML）');

    assert.deepEqual(errors,[]);assert.deepEqual(failures,[]);
    fs.writeFileSync(path.join(output,'browser-results.json'),JSON.stringify({date:new Date().toISOString(),entry,checks,standaloneBuild:'passed',errors,failedRequests:failures},null,2));
    console.log(`Browser smoke: ${checks.length} scenarios passed`);
  } catch(error) {
    await page.screenshot({path:path.join(output,'failure.png')});
    console.error(error);console.error({errors,failures});process.exitCode=1;
  } finally {await browser.close();}
})();
