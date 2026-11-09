const test=require('node:test'),assert=require('node:assert/strict'),vm=require('node:vm'),fs=require('node:fs'),path=require('node:path');
const M=require('../model.js'),sandbox={window:{ProjectModel:M}};vm.createContext(sandbox);
for(const f of ['ui.js','schedule.js','finance.js','analysis.js'])vm.runInContext(fs.readFileSync(path.join(__dirname,'..',f),'utf8'),sandbox);
const view=sandbox.window;
const ctx=()=>({state:M.seed(),month:'2026-11',personId:'u1',role:'finance',filters:{periodMode:'month',date:'2026-11-09',scheduleView:'week'},page:'project-analysis'});
test('project history starts in February while personal income retains older projects',()=>{
  const c=ctx();c.state.projects.find(p=>p.id==='p1').startDate='2026-01-15';
  assert.doesNotMatch(view.ProjectAnalysis.render(c),/星澜制造/);
  c.page='person-analysis';c.month='2026-09';c.filters.analysisPerson='u1';
  assert.match(view.ProjectAnalysis.render(c),/星澜制造/);
  assert.equal(M.personResult(c.state,'u1','2026-09').projects.find(p=>p.projectId==='p1').income,60500);
});
test('manager calendar exposes no write action',()=>{
  const c=ctx();c.role='manager';const html=view.ProjectSchedule.render(c);
  assert.doesNotMatch(html,/data-action="(?:time-new|time-delete|time-ai|time-batch|time-submit-drafts|time-copy-day|time-copy-week)"/);
  assert.match(html,/只读/);
  assert.doesNotMatch(html,/data-action="(?:week-save|week-copy|week-to-day|cell-add)"/);
  const inputs=html.match(/<input[^>]*data-week-cell[^>]*>/g)||[];
  assert.ok(inputs.length>0);
  assert.ok(inputs.every(input=>/\bdisabled\b/.test(input)));
});
test('personal cumulative contributions link the source month',()=>{
  const c=ctx();c.page='person-analysis';c.filters.periodMode='cumulative';c.filters.analysisPerson='u2';
  const html=view.ProjectAnalysis.render(c);assert.match(html,/data-month="2026-09"/);assert.match(html,/data-month="2026-10"/);assert.match(html,/data-month="2026-11"/);
});
test('finance personal salary is not filtered away by project selection',()=>{
  const c=ctx();c.filters.project='p1';c.filters.dataType='salaries';
  const html=view.ProjectFinance.render(c);assert.match(html,/林予安/);assert.match(html,/周知行/);assert.match(html,/32,000.00/);
});
