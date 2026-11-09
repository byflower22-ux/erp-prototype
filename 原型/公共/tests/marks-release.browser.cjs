/* Published marks, saved overrides and navigation verification. */
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const {pathToFileURL}=require('node:url');
const {chromium}=require(process.env.ERP_PLAYWRIGHT_MODULE||'C:/Users/BS/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const root=path.resolve(__dirname,'../../..'),entry=process.env.ERP_ENTRY_URL||pathToFileURL(path.join(root,'index.html')).href;
const out=process.env.ERP_QA_OUTPUT||path.join(root,'文档/迭代/在线预览部署/.cache/标记发布');
(async()=>{
 const browser=await chromium.launch({channel:'chrome',headless:true}),checks=[],errors=[];
 const pass=name=>{checks.push(name);console.log('PASS '+name);};
 try{
  const context=await browser.newContext({viewport:{width:1440,height:1000},acceptDownloads:true}),page=await context.newPage();
  page.on('pageerror',e=>errors.push(e.message));
  await page.goto(entry);
  await page.waitForFunction(()=>document.querySelector('#erp-tabs [aria-current="page"]')?.dataset.tabId==='project:schedule');
  const bar=page.locator('#erp-version-marks'),frame=page.frameLocator('iframe[data-module="project"]');
  const config=await bar.evaluate(el=>el.config);
  assert.equal(config.marks.length,19);
  assert.deepEqual(config.marks.slice(0,13),JSON.parse(fs.readFileSync(path.join(root,'文档/迭代/预算优化/版本标记验收/项目默认标记_20261027.json'),'utf8')).marks);
  assert.equal(config.marks.filter(m=>m.version==='ERP-I006').length,6);
  assert.deepEqual(config.marks.slice(13).map(m=>m.id),['mark-mw94nbgi-u7z35','mark-mw95jua1-r9wle','mark-mw94o8uq-y7ahw','mark-mw94opk0-5xcix','mark-mw94p5bz-wds46','mark-mw94poov-dyygp']);
  pass('默认首页为日程，完整发布最新19项标记并保留原预算13项');
  await bar.getByRole('combobox',{name:'筛选迭代版本'}).selectOption('ERP-I006');
  await bar.getByRole('button',{name:'显示标记',exact:true}).click();
  for(const mark of config.marks.filter(m=>m.version==='ERP-I006')){
   await bar.getByRole('button',{name:/全部变更/}).click();
   assert.equal(await bar.locator('article').count(),6);
   await bar.locator(`article[data-id="${mark.id}"]`).getByRole('button',{name:/前往页面|定位此处/}).click();
   if(mark.scope==='menu')await bar.locator(`.pin[data-mark="${mark.id}"]`).waitFor();
   else{await page.waitForFunction(key=>document.querySelector('#erp-tabs [aria-current="page"]')?.dataset.tabId==='project:'+key,mark.page);await frame.locator(`#project-marks .pin[data-mark="${mark.id}"]`).waitFor();}
   const nav=mark.scope==='menu'?page.locator('nav').locator(mark.selector):page.locator(`nav button[data-module="project"][data-page="${mark.page}"]`);
   await nav.click();await page.waitForFunction(key=>document.querySelector('#erp-tabs [aria-current="page"]')?.dataset.tabId==='project:'+key,await nav.getAttribute('data-page'));
   assert.equal(await nav.evaluate(el=>getComputedStyle(el).backgroundColor),'rgb(41, 50, 71)');
   await nav.hover();assert.equal(await nav.evaluate(el=>getComputedStyle(el).backgroundColor),'rgb(41, 50, 71)');
  }
  pass('项目最新6项标记显示及定位正确，菜单选中及悬停保持深色背景');
  fs.mkdirSync(out,{recursive:true});await page.screenshot({path:path.join(out,'最新版本标记.png')});
  // A deliberate deletion and custom title must survive reload; no automatic reinsertion.
  await bar.evaluate(el=>{const custom=structuredClone(el.config);custom.marks=custom.marks.filter(m=>m.id!=='mark-mw94o8uq-y7ahw');custom.marks[0].title='个人配置验收';el.commitConfig(custom);});
  await page.reload();
  assert.equal(await bar.evaluate(el=>el.config.marks.length),18);
  assert.equal(await bar.evaluate(el=>el.config.marks[0].title),'个人配置验收');
  pass('个人标记编辑与删除刷新后保留');
  await bar.getByRole('button',{name:'配置标记',exact:true}).click();
  const editor=bar.getByRole('dialog',{name:'配置版本标记',exact:true});
  page.once('dialog',d=>d.accept());await editor.getByRole('button',{name:'恢复项目配置',exact:true}).click();
  assert.deepEqual(await bar.evaluate(el=>el.config),config);
  const download=page.waitForEvent('download');await editor.getByRole('button',{name:'导出 JSON',exact:true}).click();
  assert.deepEqual(JSON.parse(fs.readFileSync(await (await download).path(),'utf8')),config);
  fs.writeFileSync(path.join(out,'已发布默认标记.json'),JSON.stringify(config,null,2));
  pass('恢复项目默认与导出的19项标记完全一致');
  await context.close();
  const standalone=await browser.newContext(),single=await standalone.newPage();single.on('pageerror',e=>errors.push(e.message));
  await single.goto(new URL('原型/项目管理/项目管理优化/index.html',entry).href);
  assert.equal(await single.locator('#project-marks').evaluate(el=>el.config.marks.length),1);
  await standalone.close();assert.deepEqual(errors,[]);
  pass('项目独立入口复用最新项目页面标记，无脚本错误');
  fs.writeFileSync(path.join(out,'marks-report.json'),JSON.stringify({date:new Date().toISOString(),entry,checks,errors},null,2));
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
