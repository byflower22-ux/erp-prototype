const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),path=require('node:path');
const M=require('../model.js');
function views(){const box={window:{ProjectModel:M}};vm.createContext(box);for(const file of ['ui.js','analysis.js','ledger-sort.js','management.js','person-insights.js','consultants.js','delivery.js'])vm.runInContext(fs.readFileSync(path.join(__dirname,'..',file),'utf8'),box);return box.window;}
test('fixed pay changes take effect by month and retain previous defaults and manual overrides',()=>{
 let s=M.seed();s.closed={};s.accountingSnapshots={};s.salaries=s.salaries.filter(r=>r.personId!=='u3');
 s=M.saveMonthlyFixedPay(s,'u3',[{month:'2026-11',salary:12000,benefits:2500}]);
 const n=M.saveFixedPayDefaults(s,'u3',{salary:20000,benefits:3000,effectiveMonth:'2026-11'});
 assert.equal(M.fixedPay(n,'u3','2026-10').total,11000);
 assert.equal(M.fixedPay(n,'u3','2026-11').total,14500);
 assert.equal(M.fixedPay(n,'u3','2026-12').total,23000);
 assert.equal(M.fixedPay(s,'u3','2026-12').total,11000);
 assert.throws(()=>M.saveFixedPayDefaults(s,'u3',{salary:1,benefits:2,effectiveMonth:''}),/生效/);
});
test('default change cannot write a frozen month',()=>{
 const s=M.ensureAccountingSnapshots(M.seed(),'2026-11-24');
 assert.throws(()=>M.saveFixedPayDefaults(s,'u3',{salary:1,benefits:2,effectiveMonth:'2026-10'}),/固化|锁定|已结/);
});
test('accounting cycle excludes people outside selected month and restricts annual contributions',()=>{
 const V=views(),s=M.ensureAccountingSnapshots(M.seed(),'2026-11-24');s.people.find(p=>p.id==='u1').accountingStart='2026-10';s.people.find(p=>p.id==='u1').accountingEnd='2026-10';
 const ctx={state:s,month:'2026-11',page:'person-analysis',filters:{periodMode:'month',analysisPerson:'u1'}};
 assert.equal(V.ProjectManagementInsights.data(ctx).rows.length,0);
 ctx.month='2026-10';assert.equal(V.ProjectManagementInsights.data(ctx).rows.length,1);
 ctx.filters.periodMode='cumulative';ctx.filters.analysisYear='2026';
 const row=V.ProjectManagementInsights.data(ctx).rows.find(p=>p.id==='u1');assert.deepEqual(Array.from(row.selected,x=>x.month),['2026-10']);assert.equal(row.coverageMissing.length,0);
});
test('project cumulative ignores selected month and fiscal year and has no month controls or time trend',()=>{
 const V=views(),s=M.seed(),old='2025-12';s.projects.find(p=>p.id==='p1').startDate='2025-01-01';s.months.unshift(old);s.calendar[old]={days:[],standardHours:176};s.delivery.push({id:'old-income',month:old,projectId:'p1',amount:12345});Object.assign(s,M.ensureAccountingSnapshots(s,'2026-11-24'));
 const c={state:s,month:'2026-09',page:'project-analysis',role:'finance',filters:{periodMode:'project',analysisYear:'2026',analysisProject:'all',analysisProjectQuery:'星澜'}};
 const d=V.ProjectManagementInsights.data(c),r=d.rows.find(r=>r.id==='p1');assert.equal(d.projectCumulative,true);assert.ok(r.selected.some(r=>r.month===old));assert.equal(r.income,r.selected.reduce((n,r)=>n+r.income,0));
 const html=V.ProjectManagementInsights.render(c);assert.doesNotMatch(html,/data-filter="(?:month|analysisYear)"|累计交付金额趋势|年度经营情况/);assert.match(html,/项目累计/);
 c.filters.projectManagerView='accounting';const detail=V.ProjectManagementInsights.render(c);assert.match(detail,/项目累计核算/);assert.doesNotMatch(detail,/>本年度回款金额<|>当月回款金额<|>核算期间</);
});
