const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const {pathToFileURL}=require('node:url'),ExcelJS=require('../vendor/exceljs-4.4.0.min.js');
const {chromium}=require(process.env.ERP_PLAYWRIGHT_MODULE||'C:/Users/BS/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const out=process.env.ERP_QA_OUTPUT||path.resolve(__dirname,'../../../../文档/迭代/项目管理优化/.cache/龙虾对话/异常验收');fs.mkdirSync(out,{recursive:true});
(async()=>{
 const browser=await chromium.launch({channel:'chrome',headless:true}),context=await browser.newContext(),page=await context.newPage(),checks=[],errors=[];
 page.on('pageerror',e=>errors.push(e.message));page.on('dialog',d=>d.accept());
 const entry=pathToFileURL(path.resolve(__dirname,'../index.html')).href,pass=name=>{checks.push(name);console.log('PASS '+name);};
 const action=name=>page.locator('#dialog [data-action="'+name+'"]').first();
 async function send(text){await page.locator('#lobster-input').fill(text);await action('chat-send').click();await page.waitForFunction(()=>!document.querySelector('[data-action="chat-send"]').disabled);}
 async function upload(file){await page.locator('#excel-file').setInputFiles(file);await action('chat-send').click();await page.waitForFunction(()=>!document.querySelector('[data-action="chat-send"]').disabled);}
 const last=()=>page.locator('#lobster-history .chat-message:not(.user)').last().innerText();
 async function template(){await send('录入2026年11月核算数据');const pending=page.waitForEvent('download');await page.locator('[data-action="chat-download"]').last().click();const d=await pending,p=path.join(out,'核算模板.xlsx');await d.saveAs(p);return p;}
 async function fill(source){const b=new ExcelJS.Workbook();await b.xlsx.load(fs.readFileSync(source));b.getWorksheet('人员固定成本').getCell('F8').value=11000;const target=path.join(out,'填写后.xlsx');fs.writeFileSync(target,Buffer.from(await b.xlsx.writeBuffer()));return target;}
 try{
  await page.goto(entry);await page.evaluate(()=>localStorage.clear());await page.reload();await page.locator('#lobster-tool').click();
  await send('你好');assert.match(await last(),/预设对话规则/);assert.equal(await page.locator('#dialog select').count(),0);assert.equal(await page.locator('[data-action="import-template"]').count(),0);
  await send('录入2027年1月核算数据');assert.match(await last(),/月份不在可操作期间/);assert.equal(await page.locator('[data-action="chat-download"]').count(),0);pass('纯对话提供帮助并拒绝范围外月份，无生成或类型选择控件');
  const source=await template(),filled=await fill(source);
  await upload({name:'文件.csv',mimeType:'text/csv',buffer:Buffer.from('amount\n100')});assert.match(await last(),/.xlsx 格式/);
  await upload({name:'损坏.xlsx',mimeType:'application/octet-stream',buffer:Buffer.from('invalid')});assert.match(await last(),/无法读取 Excel/);pass('非Excel及损坏xlsx通过对话报错，可继续选择文件');
  const old=new ExcelJS.Workbook();old.addWorksheet('录入模板');await upload({name:'旧版.xlsx',mimeType:'application/octet-stream',buffer:Buffer.from(await old.xlsx.writeBuffer())});assert.match(await last(),/当前两 Sheet/);pass('旧单类型模板拒绝导入，要求索取两Sheet新版');
  await action('dialog-close').click();await page.reload();await page.locator('#lobster-tool').click();await upload(filled);assert.match(await last(),/尚未写入/);assert.equal(await page.evaluate(()=>JSON.parse(localStorage.getItem('erp-project-demo-v1'))?.batches.length||0),0);await send('取消');assert.match(await last(),/已取消/);await send('确认导入');assert.match(await last(),/没有待确认/);pass('刷新后直接上传仍识别模板，文字取消不写入');
  await upload(filled);await page.evaluate(()=>{const k='erp-project-demo-v1',s=ProjectModel.seed();s.revision++;localStorage.setItem(k,JSON.stringify(s));});await send('确认导入');assert.match(await last(),/其他窗口更新/);assert.equal(await page.evaluate(()=>JSON.parse(localStorage.getItem('erp-project-demo-v1')).batches.length),0);await send('取消');pass('确认导入遇到其他窗口更新拒绝整本写入');
  await action('dialog-close').click();await page.reload();await page.locator('#lobster-tool').click();await upload(filled);assert.match(await last(),/数据版本已变化/);pass('旧版本Excel不能覆盖更新后的数据');
  await upload({name:'过大.xlsx',mimeType:'application/octet-stream',buffer:Buffer.alloc(5*1024*1024+1)});assert.match(await last(),/小于 5 MB/);pass('过大附件在对话中拒绝读取');
  await page.locator('#lobster-input').fill('尚未发送');page.removeAllListeners('dialog');page.once('dialog',d=>d.dismiss());await action('dialog-close').click();assert.equal(await page.locator('#lobster-input').inputValue(),'尚未发送');page.once('dialog',d=>d.accept());await action('dialog-close').click();await page.locator('#lobster-tool').click();assert.equal(await page.locator('#lobster-input').inputValue(),'');assert.ok(await page.locator('#lobster-history .chat-message').count()>1);pass('取消关闭保留草稿，确认放弃清空草稿并保留会话记录');
  const denied=await browser.newContext();await denied.addInitScript(()=>{const original=Storage.prototype.setItem;Storage.prototype.setItem=function(k,v){if(k.endsWith('-excel-templates'))throw Error('模拟模板存储失败');return original.call(this,k,v);};});const p=await denied.newPage();await p.goto(entry);await p.locator('#lobster-tool').click();await p.locator('#lobster-input').fill('录入11月核算数据');await p.locator('[data-action="chat-send"]').click();await p.locator('#lobster-history').filter({hasText:'无法保存模板生成记录'}).waitFor();assert.equal(await p.locator('[data-action="chat-download"]').count(),0);await denied.close();pass('模板登记存储失败时以对话报错，不回复无效附件');
  assert.deepEqual(errors,[]);fs.writeFileSync(path.join(out,'excel-errors-report.json'),JSON.stringify({date:new Date().toISOString(),checks,errors},null,2));
 }catch(e){await page.screenshot({path:path.join(out,'excel-failure.png')});console.error(e);process.exitCode=1;}finally{await browser.close();}
})();
