const test=require('node:test'),assert=require('node:assert/strict'),vm=require('node:vm'),fs=require('node:fs'),path=require('node:path'),M=require('../model.js');
function view(){const box={window:{ProjectModel:M}};vm.createContext(box);for(const f of ['ui.js','analysis.js','ledger-sort.js','management.js','person-insights.js','consultants.js','delivery.js'])vm.runInContext(fs.readFileSync(path.join(__dirname,'..',f),'utf8'),box);box.window.ProjectExcel={personnelInfo:s=>s.people};return box.window;}
const context=(state,page,mode)=>({state,page,month:'2026-11',role:'finance',filters:{periodMode:mode,analysisYear:'2026'}});
test('project year and lifetime totals use available values without missing notices or pending cells',()=>{
 const V=view(),s=M.ensureAccountingSnapshots(M.seed(),'2026-11-24');s.expenses=s.expenses.filter(r=>r.projectId!=='p1'||r.month!=='2026-11');s.commissions=s.commissions.filter(r=>r.projectId!=='p1'||r.month!=='2026-11');
 for(const mode of ['cumulative','project']){const ctx=context(s,'project-analysis',mode),d=V.ProjectManagementInsights.data(ctx),r=d.rows.find(r=>r.id==='p1');assert.equal(r.complete,true);assert.equal(r.net,r.selected.reduce((n,x)=>n+x.net,0));assert.deepEqual(Array.from(r.missing),[]);
  const html=V.ProjectManagementInsights.render(ctx);assert.doesNotMatch(html,/数据缺失|待补充|已知本年度|已核算本年度|缺失月份/);ctx.filters.projectManagerView='accounting';assert.doesNotMatch(V.ProjectManagementInsights.render(ctx),/数据缺失|待补充|缺失内容/);
 }
});
test('person annual totals, ranks and monthly income sum available data without missing labels',()=>{
 const V=view(),s=M.ensureAccountingSnapshots(M.seed(),'2026-11-24');s.bonuses=s.bonuses.filter(r=>r.personId!=='u2'||r.month!=='2026-11');s.ratios=s.ratios.filter(r=>r.personId!=='u2'||r.month!=='2026-11');
 const c=context(s,'person-analysis','cumulative'),d=V.ProjectManagementInsights.data(c),r=d.rows.find(r=>r.id==='u2');assert.equal(r.complete,true);assert.ok(Number.isFinite(r.net));assert.equal(r.revenueMissing,false);
 assert.doesNotMatch(V.ProjectManagementInsights.render(c),/数据缺失|待补充|已知年度|缺失月份/);c.filters.personManagerView='accounting';assert.doesNotMatch(V.ProjectManagementInsights.render(c),/数据缺失|待补充|缺失内容/);
});
test('historical inputs cannot change snapshot contributions and stale current snapshots cannot replace live values',()=>{
 const V=view(),s=M.ensureAccountingSnapshots(M.seed(),'2026-11-24'),oldProject=s.accountingSnapshots['2026-10'].projects.p1.income,oldPerson=s.accountingSnapshots['2026-10'].people.u1.income;
 s.delivery.find(r=>r.projectId==='p1'&&r.month==='2026-10').amount=99999999;
 const liveP=M.projectResult(s,'p1','2026-11').income,liveU=M.personResult(s,'u1','2026-11').income;
 s.accountingSnapshots['2026-11']={projects:{p1:{...M.projectResult(s,'p1','2026-11'),income:888888}},people:{u1:{...M.personResult(s,'u1','2026-11'),income:777777}}};
 for(const [page,id,historical,current] of [['project-analysis','p1',oldProject,liveP],['person-analysis','u1',oldPerson,liveU]]){const d=V.ProjectManagementInsights.data(context(s,page,'cumulative')),r=d.rows.find(r=>r.id===id);assert.equal(r.selected.find(r=>r.month==='2026-10').income,historical);assert.equal(r.selected.find(r=>r.month==='2026-11').income,current);assert.equal(V.ProjectManagementInsights.rowStatus(d,r),'混合核算');assert.match(V.ProjectManagementInsights.render(context(s,page,'month')),/本期实时核算/);}
});
test('a historical month without a snapshot does not fall back to the live ledger in cumulative totals',()=>{
 const V=view(),s=M.ensureAccountingSnapshots(M.seed(),'2026-11-24');delete s.accountingSnapshots['2026-10'];s.delivery.find(r=>r.projectId==='p1'&&r.month==='2026-10').amount=99999999;
 const r=V.ProjectManagementInsights.data(context(s,'project-analysis','project')).rows.find(r=>r.id==='p1');assert.equal(r.selected.some(r=>r.month==='2026-10'),false);assert.ok(r.income<99999999);assert.equal(r.complete,true);
});
