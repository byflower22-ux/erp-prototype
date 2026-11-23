const {test}=require('node:test'),assert=require('node:assert/strict'),M=require('../model.js');
test('automatic accounting snapshots become due on the eighth of the next month',()=>{
 const before=M.ensureAccountingSnapshots(M.seed(),'2026-11-07');
 assert.ok(M.accountingSnapshot(before,'2026-09'));assert.equal(M.accountingSnapshot(before,'2026-10'),null);
 const after=M.ensureAccountingSnapshots(before,'2026-11-08');
 assert.equal(M.accountingSnapshot(after,'2026-10').closedAt,'2026-11-08T00:00:00+08:00');
 assert.equal(M.accountingSnapshot(after,'2026-11'),null);assert.equal(M.ensureAccountingSnapshots(after,'2026-11-23'),after);
});
test('frozen results and input basis survive later live ledger changes',()=>{
 const s=M.ensureAccountingSnapshots(M.seed(),'2026-11-23'),project=M.projectResult(s,'p2','2026-10'),person=M.personResult(s,'u1','2026-10');
 const contract=M.accountingState(s,'2026-10').projects.find(p=>p.id==='p2').contract;
 s.delivery.find(r=>r.projectId==='p2'&&r.month==='2026-10').amount=999999;
 s.projects.find(p=>p.id==='p2').contract=999999;s.people.find(p=>p.id==='u1').fixedSalary=999999;
 assert.deepEqual(M.projectResult(s,'p2','2026-10'),project);assert.deepEqual(M.personResult(s,'u1','2026-10'),person);
 assert.equal(M.accountingState(s,'2026-10').projects.find(p=>p.id==='p2').contract,contract);
 assert.equal(M.accountingState(s,'2026-11'),s);
});
test('annual examples contain ten months and preserve existing records on repeated migration',()=>{
 const s=M.seed();assert.equal(s.people.length,15);assert.deepEqual(s.months,Array.from({length:10},(_,i)=>'2026-'+String(i+2).padStart(2,'0')));
 assert.equal(s.projects.filter(p=>p.id.startsWith('p-people-demo-')).length,6);
 for(const month of s.months)assert.ok(M.personResult(s,'people-demo-1',month).income>0);
 s.people[0].note='保留资料';assert.equal(M.ensureAnnualPersonnelExamples(s),s);assert.equal(M.ensurePersonnelExamples(s),s);assert.equal(s.people[0].note,'保留资料');
});
