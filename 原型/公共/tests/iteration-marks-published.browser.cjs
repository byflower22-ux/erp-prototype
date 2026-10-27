/* Verify deployed defaults against the user's archived export, including old browser overrides. */
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const {pathToFileURL}=require('node:url');
const {chromium}=require(process.env.ERP_PLAYWRIGHT_MODULE||'playwright');
const root=path.resolve(__dirname,'../../..');
const expected=JSON.parse(fs.readFileSync(path.join(root,'文档/迭代/预算优化/版本标记验收/项目默认标记_20261027.json'),'utf8'));
const entry=process.env.ERP_ENTRY_URL||pathToFileURL(path.join(root,'index.html')).href;
(async()=>{
  const browser=await chromium.launch({channel:'chrome',headless:true});
  try{
    const context=await browser.newContext({viewport:{width:1440,height:1000},acceptDownloads:true});
    const page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));
    await page.goto(entry);
    const bar=page.locator('#erp-version-marks');
    await bar.getByRole('button',{name:'配置标记',exact:true}).waitFor();
    assert.deepEqual(await bar.evaluate(h=>h.config),expected);
    assert.deepEqual(await bar.evaluate(h=>h.defaultConfig),expected);
    await bar.evaluate(h=>{for(const mark of h.config.marks)if(mark.selector)document.createDocumentFragment().querySelector(mark.selector);});
    await bar.getByRole('button',{name:'显示标记',exact:true}).click();
    const firstMenu=expected.marks.find(m=>m.scope==='menu');
    await bar.locator('.pin[data-mark="'+firstMenu.id+'"]').waitFor();
    assert.ok((await bar.locator('.pin[data-mark="'+firstMenu.id+'"]').innerText()).includes('01'));
    const budget=page.frameLocator('iframe[data-module="budget"]');
    await budget.locator('.pin[data-mark="overview-execution"]').waitFor();
    assert.ok((await budget.locator('.pin[data-mark="overview-execution"]').innerText()).includes('04'));
    await bar.getByRole('button',{name:'全部变更',exact:false}).click();
    assert.deepEqual(await bar.locator('article h3').allTextContents(),expected.marks.map((m,i)=>String(i+1).padStart(2,'0')+' '+m.title));
    await bar.getByRole('button',{name:'关闭变更说明',exact:true}).click();
    // A saved personal override must remain until the user explicitly restores project defaults.
    await bar.evaluate(h=>{const old=structuredClone(h.config);old.marks[0].title='旧浏览器个人标记';localStorage.setItem(h.storageKey+':config',JSON.stringify(old));});
    await page.reload();
    assert.equal(await bar.evaluate(h=>h.config.marks[0].title),'旧浏览器个人标记');
    await bar.getByRole('button',{name:'配置标记',exact:true}).click();
    const editor=bar.getByRole('dialog',{name:'配置版本标记',exact:true});
    page.once('dialog',d=>d.accept());await editor.getByRole('button',{name:'恢复项目配置',exact:true}).click();
    assert.deepEqual(await bar.evaluate(h=>h.config),expected);
    const download=page.waitForEvent('download');await editor.getByRole('button',{name:'导出 JSON',exact:true}).click();
    assert.deepEqual(JSON.parse(fs.readFileSync(await (await download).path(),'utf8')),expected);
    await editor.getByRole('button',{name:'关闭配置',exact:true}).click();
    await page.reload();assert.deepEqual(await bar.evaluate(h=>h.config),expected);
    assert.deepEqual(errors,[]);
    console.log('PASS '+entry+'：13 项项目默认与用户导出完全一致、01/04 区域编号、清单顺序、旧配置保留与恢复、导出及刷新');
    await context.close();
  }finally{await browser.close();}
})().catch(error=>{console.error(error);process.exitCode=1;});
