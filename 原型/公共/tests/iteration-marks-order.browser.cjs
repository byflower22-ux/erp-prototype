const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const {pathToFileURL}=require('node:url');
const {chromium}=require(process.env.ERP_PLAYWRIGHT_MODULE||'playwright');
const root=path.resolve(__dirname,'../../..');
(async()=>{
  const browser=await chromium.launch({channel:'chrome',headless:true});
  try{
    const context=await browser.newContext({viewport:{width:1024,height:768},acceptDownloads:true});
    const page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));
    await page.goto(pathToFileURL(path.join(root,'index.html')).href);
    const bar=page.locator('#erp-version-marks'),editor=bar.getByRole('dialog',{name:'配置版本标记',exact:true});
    await bar.getByRole('button',{name:'显示标记',exact:true}).click();
    await page.frameLocator('iframe[data-module="budget"]').locator('.pin[data-mark="overview-execution"]').waitFor();
    await bar.getByRole('button',{name:'配置标记',exact:true}).click();
    const up=editor.locator('[data-command="move-up"]'),down=editor.locator('[data-command="move-down"]');
    assert.equal(await up.isDisabled(),true);
    await editor.getByLabel('标记标题',{exact:true}).fill('尚未保存的标题');
    await down.click();
    assert.equal(await editor.getByLabel('标记标题',{exact:true}).inputValue(),'尚未保存的标题');
    assert.match(await editor.locator('[role=status]').innerText(),/尚未保存/);
    assert.equal(await editor.locator('.mark-row[aria-current=true] b').innerText(),'02 '+await bar.evaluate(h=>h.config.marks[1].title));
    await up.click();
    // Keep the original title while retaining the tested unsaved form state.
    await editor.getByLabel('标记标题',{exact:true}).fill(await bar.evaluate(h=>h.config.marks[0].title));
    await editor.getByRole('button',{name:'保存标记',exact:true}).click();
    await editor.locator('.mark-row').last().click();assert.equal(await down.isDisabled(),true);
    await editor.getByLabel('搜索标记',{exact:true}).fill('审批');assert.equal(await up.isDisabled(),true);assert.equal(await down.isDisabled(),true);
    await editor.getByLabel('搜索标记',{exact:true}).fill('');
    // Move a menu item across the page/menu boundary, preserving stable IDs and fields.
    const original=await bar.evaluate(h=>h.config);
    await editor.locator('.mark-row').nth(13).click();await up.click();
    assert.deepEqual(await bar.evaluate(h=>h.config.marks[12]),original.marks[13]);
    const download=page.waitForEvent('download');await editor.getByRole('button',{name:'导出 JSON',exact:true}).click();
    const exported=JSON.parse(fs.readFileSync(await (await download).path(),'utf8'));
    assert.deepEqual(exported.marks[12],original.marks[13]);
    await editor.getByRole('button',{name:'关闭配置',exact:true}).click();
    await bar.locator('.pin[data-mark="menu-office"]').waitFor();
    assert.match(await bar.locator('.pin[data-mark="menu-office"]').innerText(),/13/);
    await bar.getByRole('button',{name:'全部变更',exact:false}).click();
    assert.match(await bar.locator('article[data-id="menu-office"] h3').innerText(),/^13 /);
    await bar.getByRole('button',{name:'关闭变更说明',exact:true}).click();
    await page.reload();assert.equal(await bar.evaluate(h=>h.config.marks[12].id),'menu-office');
    await bar.getByRole('button',{name:'配置标记',exact:true}).click();
    await editor.locator('.mark-row').nth(12).click();
    await page.screenshot({path:path.join(root,'文档/迭代/预算优化/版本标记验收/标记排序_1024.png')});
    await editor.getByRole('button',{name:'新增标记',exact:true}).click();assert.equal(await up.isDisabled(),true);assert.equal(await down.isDisabled(),true);
    await editor.getByRole('button',{name:'关闭配置',exact:true}).click();
    await page.goto(pathToFileURL(path.join(root,'原型/预算管理/预算优化/prototype/index.html')).href);
    const standalone=page.locator('erp-iteration-marks');
    await standalone.getByRole('button',{name:'配置标记',exact:true}).click();
    await standalone.locator('.mark-row').first().click();
    await standalone.locator('[data-command="move-down"]').click();
    assert.equal(await standalone.evaluate(h=>h.config.marks[1].id),'overview-execution');
    assert.deepEqual(errors,[]);
    console.log('PASS 上下移、首尾及新增保护、搜索保护、未保存编辑保留、统一序号／导出／刷新和独立页排序');
  }finally{await browser.close();}
})().catch(error=>{console.error(error);process.exitCode=1;});
