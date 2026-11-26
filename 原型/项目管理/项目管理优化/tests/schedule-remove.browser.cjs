const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),{pathToFileURL}=require('node:url');
const {chromium}=require(process.env.ERP_PLAYWRIGHT_MODULE||'playwright');
const entry=process.env.ERP_ENTRY_URL||pathToFileURL(path.resolve(__dirname,'../../../../index.html')).href,out=process.env.ERP_QA_OUTPUT;
(async()=>{const browser=await chromium.launch({channel:'chrome',headless:true}),checks=[];try{
for(const mode of ['week','month']){
 const page=await browser.newPage({viewport:{width:1600,height:1100}}),errors=[];page.on('pageerror',e=>errors.push(e.message));await page.goto(entry);const f=page.frameLocator('iframe[data-module="project"]');await f.locator('.weekly-table').waitFor();
 if(mode==='month')await f.locator('[data-action="fill-period"][data-mode="month"]').click();await f.locator('[data-action="schedule-edit"]').first().click();
 const key=await f.locator('[data-week-cell]:enabled').evaluateAll(els=>els.find(el=>el.value===''&&el.closest('td').querySelectorAll('.daily-cell-entry').length===1)?.dataset.weekCell);assert.ok(key);const [pid,role,date]=JSON.parse(key);
 const add=f.locator(`[data-action="cell-add"][data-project="${pid}"][data-role="${role}"][data-date="${date}"]`),container=add.locator('..');
 assert.equal(await container.locator('[data-action="cell-remove"]').count(),0);await add.click();await add.click();
 assert.equal(await container.locator('.daily-entry-card').count(),3);
 const originalKeys=await container.locator('[data-week-cell]').evaluateAll(xs=>xs.map(x=>x.dataset.weekCell));
 for(let i=0;i<3;i++){await container.locator('[data-week-cell]').nth(i).fill(String((i+1)*.5));await container.locator('[data-cell-activity]').nth(i).selectOption(['项目准备','入企服务','后期复盘'][i]);}
 const card=container.locator('.daily-entry-card').nth(1);await card.scrollIntoViewIfNeeded();const field=await card.locator('.daily-cell-hours').boundingBox(),button=await card.locator('[data-action="cell-remove"]').boundingBox();
 assert.ok(Math.abs(button.x+button.width-field.x-field.width)<10);assert.ok(Math.abs(button.y+button.height/2-field.y)<4);assert.equal(await card.locator('.daily-entry-header [data-action="cell-remove"]').count(),0);
 await card.locator('[data-action="cell-remove"]').hover();assert.equal(await card.evaluate(el=>getComputedStyle(el).backgroundColor),'rgb(255, 248, 246)');
 if(out){fs.mkdirSync(out,{recursive:true});await page.screenshot({path:path.join(out,mode+'-事项删除位置.png')});}
 await card.locator('[data-action="cell-remove"]').click();assert.deepEqual(await container.locator('[data-week-cell]').evaluateAll(xs=>xs.map(x=>x.dataset.weekCell)),[originalKeys[0],originalKeys[2]]);assert.deepEqual(await container.locator('[data-week-cell]').evaluateAll(xs=>xs.map(x=>x.value)),['0.5','1.5']);
 await container.locator('[data-action="cell-remove"]').last().click();assert.equal(await container.locator('.daily-cell-entry').count(),1);assert.equal(await container.locator('[data-action="cell-remove"]').count(),0);
 await add.click();for(let i=0;i<2;i++){await container.locator('[data-week-cell]').nth(i).fill('0.5');await container.locator('[data-cell-activity]').nth(i).selectOption(i?'入企服务':'项目准备');}
 await f.locator('[data-action="week-save"]').click();await f.locator('.schedule-is-viewing').waitFor();
 const read=()=>f.locator('body').evaluate((el,{pid,role,date})=>JSON.parse(localStorage.getItem('erp-project-demo-v1')).times.filter(r=>r.personId==='u1'&&r.projectId===pid&&r.role===role&&r.date===date),{pid,role,date});assert.equal((await read()).length,2);
 await f.locator('[data-action="schedule-edit"]').first().click();await container.locator('[data-action="cell-remove"]').last().click();assert.equal((await read()).length,2);
 await f.locator('[data-action="schedule-edit-cancel"]').click();if(await f.locator('#schedule-leave-discard').isVisible())await f.locator('#schedule-leave-discard').click();assert.equal((await read()).length,2);
 await f.locator('[data-action="schedule-edit"]').first().click();assert.equal(await container.locator('.daily-cell-entry').count(),2);await container.locator('[data-action="cell-remove"]').last().click();await f.locator('[data-action="week-save"]').click();assert.equal((await read()).length,1);
 await f.locator('[data-action="schedule-edit"]').first().click();assert.equal(await container.locator('.daily-cell-entry').count(),1);assert.equal(await container.locator('[data-action="cell-remove"]').count(),0);assert.deepEqual(errors,[]);
 checks.push(mode+'：删除中间事项保序、至少保留一笔、输入框右上角定位、悬停归属、保存生效与取消恢复');console.log('PASS '+checks.at(-1));await page.close();
}if(out)fs.writeFileSync(path.join(out,'schedule-remove-report.json'),JSON.stringify({entry,date:new Date().toISOString(),checks},null,2));
}finally{await browser.close();}})().catch(e=>{console.error(e);process.exitCode=1;});
