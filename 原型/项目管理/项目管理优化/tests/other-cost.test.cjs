const test=require('node:test'),assert=require('node:assert/strict');
const M=require('../model.js'),IO=require('../excel-io.js'),ExcelJS=require('../vendor/exceljs-4.4.0.min.js');
const apply=(s,type,value)=>M.applyImport(s,M.previewImport(s,type,'2026-11',[{projectId:'p1',personId:'u1',value}]));
test('other costs change only their own accounting subject and use overwrite, zero and blank rules',()=>{
 const s=M.seed(),project=M.projectResult(s,'p1','2026-11'),person=M.personResult(s,'u1','2026-11');
 let n=apply(s,'projectOther',1000);assert.equal(M.projectResult(n,'p1','2026-11').totalCost,project.totalCost+1000);assert.equal(M.personResult(n,'u1','2026-11').totalCost,person.totalCost);
 n=apply(n,'personOther',500);assert.equal(M.personResult(n,'u1','2026-11').totalCost,person.totalCost+500);assert.equal(M.projectResult(n,'p1','2026-11').totalCost,project.totalCost+1000);
 n=apply(n,'projectOther',2000);assert.equal(M.projectResult(n,'p1','2026-11').costs.other,2000);
 n=apply(n,'personOther','');assert.equal(M.personResult(n,'u1','2026-11').costs.other,500);
 n=apply(n,'personOther',0);assert.equal(M.personResult(n,'u1','2026-11').costs.other,0);
 const locked=M.ensureAccountingSnapshots(n,'2026-12-08'),preview=M.previewImport(locked,'personOther','2026-11',[{personId:'u1',value:1}]);assert.ok(preview.errors.length);assert.throws(()=>M.applyImport(locked,preview),/固化|月结|锁定/);
});
test('scoped other-cost Excel templates round-trip and person bonus stays independently selectable',async()=>{
 for(const scope of ['person','project']){
  const s=M.seed(),attachment=await IO.createTemplate(s,'2026-11','other-'+scope,scope,{expenseTypes:['其他成本']}),book=new ExcelJS.Workbook();await book.xlsx.load(attachment.buffer);const sheet=book.worksheets[0];
  assert.equal(book.worksheets.length,1);assert.match(sheet.getRow(5).values.join('|'),/其他成本|费用类型/);
  if(scope==='person'){assert.doesNotMatch(sheet.getRow(5).values.join('|'),/奖金|固定人工/);sheet.getCell('G6').value=456;}
  else{assert.equal(sheet.getCell('E6').value,'其他成本');sheet.getCell('K6').value=123;}
  const result=await IO.readTemplate(await book.xlsx.writeBuffer(),s,[attachment.manifest]);const preview=IO.previewWorkbook(s,result,'其他成本.xlsx'),n=IO.applyWorkbook(s,preview),identity=attachment.manifest.sheets[0].rows[0];
  assert.equal(scope==='person'?M.personResult(n,identity.personId,'2026-11').costs.other:M.projectResult(n,identity.projectId,'2026-11').costs.other,scope==='person'?456:123);
 }
 const a=await IO.createTemplate(M.seed(),'2026-11','bonus-only','person',{expenseTypes:['奖金']});assert.equal(a.manifest.sheets[0].name,'人员奖金');assert.ok(a.manifest.sheets[0].rows.every(r=>r.inputs.every(i=>i.type==='bonus')));
});
