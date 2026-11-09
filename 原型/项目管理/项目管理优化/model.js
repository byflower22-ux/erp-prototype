(function (root, factory) {
  'use strict';
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.ProjectModel = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';
  const RULES = Object.freeze({ruleVersion:'ERP-I005-demo-v1',projectIncomeTax:0.15,businessTax:0.033,personalManagement:0.2,hoursStep:0.5,dailyHours:8,personalBreakEvenFormula:'(固定人工+提成+奖金)÷[1−(税费+管理费)÷当月交付金额]'});
  const copy = value => JSON.parse(JSON.stringify(value));
  const round = value => Math.round((Number(value) + Number.EPSILON) * 100) / 100;
  const sum = (rows, field = 'amount') => round(rows.reduce((n, r) => n + Number(r[field] || 0), 0));
  const unique = rows => [...new Set(rows)];
  const fail = message => { throw new Error(message); };
  const amountOK = value => typeof value === 'number' && Number.isFinite(value) && value >= 0;
  const at = (rows, month, key, value) => rows.filter(r => r.month === month && (!key || r[key] === value));
  function version(state, expected) { if (state.revision !== expected) fail('数据版本已变化，请刷新后重试'); }
  function monthOK(state, month, unlocked = false) {
    if (!state.months.includes(month)) fail('月份不在可操作期间内');
    if (unlocked && state.closed[month]) fail(month + ' 已月结，请先反结账');
    if (unlocked) {
      const later = Object.keys(state.closed).filter(m => m > month).sort();
      if (later.length) fail(month + ' 的输入已被后续已结月份引用，请先反结账后续月份：' + later.join('、'));
    }
  }
  function entity(state, type, id) {
    const result = state[type].find(x => x.id === id);
    if (!result) fail(type === 'projects' ? '项目不存在' : '人员不存在');
    return result;
  }
  function next(state, action, detail) {
    const n = copy(state);
    n.revision++;
    n.audit.push({id:'audit-' + n.revision, action, detail:copy(detail), revision:n.revision, at:new Date().toISOString()});
    return n;
  }
  function source(row, label, kind, amount = row.amount) {
    return {id:row.id, label, kind, month:row.month || String(row.date || '').slice(0, 7), amount:round(amount || 0), projectId:row.projectId, personId:row.personId, detail:kind==='times'?[row.date,row.activity||'待分类',row.description].filter(Boolean).join(' · '):row.source || label};
  }
  function hoursFor(state, personId, projectId, month) {
    return round(state.times.filter(r => r.status === 'submitted' && r.date.slice(0,7) === month && (!personId || r.personId === personId) && (!projectId || r.projectId === projectId)).reduce((n,r)=>n+Number(r.hours),0) + state.historicalTimes.filter(r=>r.month === month && (!personId || r.personId===personId) && (!projectId || r.projectId===projectId)).reduce((n,r)=>n+Number(r.hours),0));
  }
  function breakEven(income, fixed, variable, missing) {
    if (income <= 0) { missing.push('当月交付金额为零，无法测算盈亏平衡点'); return null; }
    const denominator = 1 - variable / income;
    if (denominator <= 0) { missing.push('费用占比达到或超过交付金额，无法测算盈亏平衡点'); return null; }
    return round(fixed / denominator);
  }
  function rawProject(state, projectId, month) {
    const project = entity(state,'projects',projectId), missing = [], sources = [];
    const delivery = at(state.delivery,month,'projectId',projectId), income = sum(delivery);
    const costs = {business:0, management:0, travel:0, tax:round(income * RULES.businessTax), accountManager:0, commission:0, salary:0, exception:0, yearBonus:0, fixed:0};
    delivery.forEach(r=>sources.push(source(r,'确认交付收入','delivery')));
    at(state.actualCosts,month,'projectId',projectId).forEach(r=> { if (Object.hasOwn(costs,r.category)) costs[r.category] = round(costs[r.category]+r.amount); sources.push(source(r,'实际费用：'+r.category,'actualCosts')); });
    at(state.expenses,month,'projectId',projectId).forEach(r=> { if (Object.hasOwn(costs,r.category)) costs[r.category] = round(costs[r.category]+r.amount); sources.push(source(r,'预计费用：'+r.category,'expenses')); });
    const commissions = at(state.commissions,month,'projectId',projectId);
    costs.commission = sum(commissions);
    commissions.forEach(r=>sources.push(source(r,'人员提成','commissions')));
    const calendar = state.calendar[month];
    if (!calendar || !Number.isFinite(calendar.standardHours) || calendar.standardHours <= 0) missing.push('缺少'+month+'考勤标准工时');
    const members = state.members.filter(r=>r.projectId === projectId);
    for (const personId of unique(members.map(r=>r.personId))) {
      const h = hoursFor(state,personId,projectId,month);
      const salary = at(state.salaries,month,'personId',personId);
      if (h && !salary.length) missing.push(entity(state,'people',personId).name+'缺少当月工资');
      if (h && salary.length && calendar && calendar.standardHours > 0) {
        const allocation = round(sum(salary) / calendar.standardHours * h);
        costs.salary = round(costs.salary + allocation);
        salary.forEach(r=>sources.push(source({...r,projectId},'项目人工分摊 '+h+'小时','salaries',allocation)));
      }
      if (income > 0 && !state.ratios.some(r=>r.projectId===projectId && r.personId===personId && r.month===month)) missing.push(entity(state,'people',personId).name+'缺少有效收入比例');
    }
    const ratioTotal = at(state.ratios,month,'projectId',projectId).reduce((n,r)=>n+r.ratio,0);
    if (ratioTotal > 1+1e-9) missing.push('项目有效收入比例合计超过100%');
    state.times.filter(r=>r.projectId===projectId && r.status==='submitted' && r.date.slice(0,7)===month).forEach(r=>sources.push(source(r,r.role+'工时 '+r.hours+'小时','times',0)));
    state.historicalTimes.filter(r=>r.projectId===projectId && r.month===month).forEach(r=>sources.push(source(r,'历史估算工时 '+r.hours+'小时','historicalTimes',0)));
    const totalCost=round(Object.values(costs).reduce((a,b)=>a+b,0)), pretax=round(income-totalCost);
    const be=breakEven(income,round(costs.travel+costs.accountManager+costs.commission+costs.salary+costs.exception+costs.yearBonus+costs.fixed),round(costs.business+costs.management+costs.tax),[]);
    const received=sum(at(state.receipts,month,'projectId',projectId));
    at(state.receipts,month,'projectId',projectId).forEach(r=>sources.push(source(r,'项目回款','receipts')));
    sources.push({id:'business-tax-'+projectId+'-'+month,label:'交付金额 × 3.3%',kind:'calculation',month,amount:costs.tax,projectId,detail:'业务税费，区别于所得税'});
    return {id:projectId,month,income,costs,totalCost,pretax,tax:0,net:pretax,margin:null,breakEven:missing.length?null:be,hours:hoursFor(state,null,projectId,month),contract:project.contract,received,receivable:project.receivable || 0,missing:unique(missing),sources};
  }
  function projectResult(state, projectId, month) {
    monthOK(state,month);
    if (state.closed[month]?.projects?.[projectId]) return copy(state.closed[month].projects[projectId]);
    const current=rawProject(state,projectId,month), cumulativeCosts = Object.fromEntries(Object.keys(current.costs).map(k=>[k,0]));
    let income=0,received=0,totalCost=0,priorPretax=0,cumulativeComplete=true;
    for(const m of state.months.filter(m=>m<=month).sort()) {
      const r=state.closed[m]?.projects?.[projectId] || rawProject(state,projectId,m);
      if(r.missing.length)cumulativeComplete=false;
      income=round(income+r.income); received=round(received+r.received);totalCost=round(totalCost+r.totalCost);
      if(m<month) priorPretax=round(priorPretax+r.pretax);
      for(const k of Object.keys(cumulativeCosts)) cumulativeCosts[k]=round(cumulativeCosts[k]+r.costs[k]);
    }
    const pretax=round(income-totalCost),tax=round(Math.max(pretax,0)*RULES.projectIncomeTax),previousTax=round(Math.max(priorPretax,0)*RULES.projectIncomeTax);
    current.tax=round(tax-previousTax);current.net=round(current.pretax-current.tax);current.margin=current.income&&!current.missing.length ? current.net/current.income : null;
    const c=cumulativeCosts, be=breakEven(income,round(c.travel+c.accountManager+c.commission+c.salary+c.exception+c.yearBonus+c.fixed),round(c.business+c.management+c.tax),[]);
    current.cumulative={income,received,totalCost,pretax,tax,net:round(pretax-tax),margin:income&&cumulativeComplete ? (pretax-tax)/income : null,breakEven:cumulativeComplete?be:null};
    return current;
  }
  function personResult(state, personId, month) {
    monthOK(state,month);entity(state,'people',personId);
    if(state.closed[month]?.people?.[personId]) return copy(state.closed[month].people[personId]);
    const missing=[],sources=[],calendar=state.calendar[month],standardHours=calendar?.standardHours || 0;
    if(!standardHours) missing.push('缺少'+month+'考勤标准工时');
    const salaries=at(state.salaries,month,'personId',personId),salary=sum(salaries);
    if(!salaries.length) missing.push('缺少当月工资');
    const projects=unique(state.members.filter(r=>r.personId===personId).map(r=>r.projectId)).map(projectId=>{
      const income=sum(at(state.delivery,month,'projectId',projectId)),ratios=state.ratios.filter(r=>r.month===month&&r.projectId===projectId&&r.personId===personId);
      if(income>0 && !ratios.length) missing.push(entity(state,'projects',projectId).name+'缺少有效收入比例');
      const ratio=ratios.reduce((n,r)=>n+r.ratio,0),hours=hoursFor(state,personId,projectId,month),allocated=standardHours ? round(salary/standardHours*hours):0;
      ratios.forEach(r=>sources.push(source(r,'收入比例 '+round(r.ratio*100)+'%','ratios',round(income*r.ratio))));
      return {projectId,income:round(income*ratio),hours,salary:allocated,commission:sum(at(state.commissions,month,'personId',personId).filter(r=>r.projectId===projectId)),ratio};
    });
    const income=sum(projects,'income'),commission=sum(at(state.commissions,month,'personId',personId)),bonus=sum(at(state.bonuses,month,'personId',personId));
    const costs={tax:round(income*RULES.businessTax),salary,commission,bonus,management:round(income*RULES.personalManagement)};
    const totalCost=round(Object.values(costs).reduce((a,b)=>a+b,0)),pretax=round(income-totalCost),tax=round(Math.max(pretax,0)*RULES.projectIncomeTax);
    const reasons=[],be=breakEven(income,round(costs.salary+costs.commission+costs.bonus),round(costs.tax+costs.management),reasons);
    ['salaries','commissions','bonuses'].forEach(k=>at(state[k],month,'personId',personId).forEach(r=>sources.push(source(r,{salaries:'固定人工',commissions:'人员提成',bonuses:'人员奖金'}[k],k))));
    const allocatedSalary=sum(projects,'salary'),hours=hoursFor(state,personId,null,month);
    return {id:personId,month,income,costs,totalCost,pretax,tax,net:round(pretax-tax),margin:income&&!missing.length?(pretax-tax)/income:null,breakEven:missing.length?null:be,hours,days:hours/8,standardHours,saturation:standardHours?hours/standardHours:null,allocatedSalary,idleSalary:round(salary-allocatedSalary),missing:unique(missing.concat(reasons)),sources,projects};
  }
  function dateValid(date) {
    if(typeof date!=='string'||!/^\d{4}-\d{2}-\d{2}$/.test(date))return false;
    const d=new Date(date+'T00:00:00Z');return Number.isFinite(d.getTime())&&d.toISOString().slice(0,10)===date;
  }
  function interval(row) {
    if(!row.start&&!row.end)return null;
    if(!/^([01]\d|2[0-3]):[0-5]\d$/.test(row.start||'')||!/^([01]\d|2[0-3]):[0-5]\d$/.test(row.end||''))return false;
    const minutes=x=>Number(x.slice(0,2))*60+Number(x.slice(3));
    const start=minutes(row.start),end=minutes(row.end);
    return end>start&&Math.abs((end-start)/60-Number(row.hours))<.001 ? [start,end]:false;
  }
  function validateTimes(state, rows, {replaceIds=[]}={}) {
    const errors=[],warnings=[],newIds=new Set();
    rows.forEach((r,i)=>{
      const label='第'+(i+1)+'条：';
      if(r.id&&newIds.has(r.id))errors.push(label+'记录标识重复');if(r.id)newIds.add(r.id);
      if(!dateValid(r.date))errors.push(label+'日期无效');
      const month=String(r.date||'').slice(0,7),calendar=state.calendar[month];
      try { monthOK(state,month,true); } catch (e) { errors.push(label+e.message); }
      if(!calendar||!calendar.days.includes(r.date))errors.push(label+'非公司工作日，禁止填报');
      if(!state.people.some(x=>x.id===r.personId)||!state.members.some(x=>x.projectId===r.projectId&&x.personId===r.personId&&x.role===r.role)) errors.push(label+'人员、项目或角色不匹配');
      if(typeof r.hours!=='number'||!Number.isFinite(r.hours)||r.hours<=0||!Number.isInteger(r.hours/RULES.hoursStep))errors.push(label+'工时须为正数且按0.5小时填写');
      if(interval(r)===false)errors.push(label+'时段无效或与填写工时不一致');
    });
    const existing=state.times.filter(r=>r.status==='submitted'&&!replaceIds.includes(r.id)),all=existing.concat(rows);
    const dayTotals={},monthTotals={};
    all.forEach(r=>{const d=r.personId+'|'+r.date,m=r.personId+'|'+String(r.date).slice(0,7);dayTotals[d]=(dayTotals[d]||0)+Number(r.hours||0);monthTotals[m]=(monthTotals[m]||0)+Number(r.hours||0);});
    state.historicalTimes.forEach(r=>{const k=r.personId+'|'+r.month;monthTotals[k]=(monthTotals[k]||0)+r.hours;});
    for(const r of rows){if(dayTotals[r.personId+'|'+r.date]>RULES.dailyHours)errors.push(r.date+'跨项目合计超过每日8小时');const m=String(r.date).slice(0,7);if(monthTotals[r.personId+'|'+m]>(state.calendar[m]?.standardHours||0))errors.push(m+'超过考勤标准工时');}
    for(let i=0;i<all.length;i++)for(let j=i+1;j<all.length;j++){
      const a=all[i],b=all[j];if(a.personId!==b.personId||a.date!==b.date||i<existing.length&&j<existing.length)continue;
      const x=interval(a),y=interval(b);
      if(x&&y&&x[0]<y[1]&&y[0]<x[1])errors.push(a.date+'存在明确时间重叠');
      if(a.projectId===b.projectId&&a.role===b.role&&(a.workItemId||'legacy')===(b.workItemId||'legacy')&&a.hours===b.hours&&(a.start||'')===(b.start||'')&&(a.end||'')===(b.end||''))errors.push(a.date+'存在重复记录');
    }
    return {errors:unique(errors),warnings};
  }
  function upsertTimes(state, rows, status, expectedRevision) {
    version(state,expectedRevision);
    rows.forEach(r=>{const old=state.times.find(x=>x.id===r.id);if(old&&old.personId!==r.personId)fail('不能更换已有记录的所属人员');if(old)monthOK(state,String(old.date).slice(0,7),true);monthOK(state,String(r.date||'').slice(0,7),true);});
    if(status==='submitted'){const result=validateTimes(state,rows,{replaceIds:rows.map(r=>r.id).filter(Boolean)});if(result.errors.length)fail(result.errors.join('；'));}
    const n=next(state,status==='draft'?'保存工时草稿':'提交项目工时',rows);
    rows.forEach((r,i)=>{const value={...copy(r),id:r.id||'time-'+n.revision+'-'+i,status};const index=n.times.findIndex(x=>x.id===value.id);if(index<0)n.times.push(value);else n.times[index]=value;});
    return n;
  }
  const submitTimes=(s,r,v=s.revision)=>upsertTimes(s,r,'submitted',v);
  const saveDrafts=(s,r,v=s.revision)=>upsertTimes(s,r,'draft',v);
  function saveWeekTimes(state,personId,cells,expectedRevision=state.revision){
    version(state,expectedRevision);entity(state,'people',personId);
    const keys=new Set(),changes=[],previous=[];
    for(const c of cells){
      const k=JSON.stringify([c.projectId,c.role,c.date,c.workItemId||'legacy']);if(keys.has(k))fail('填报单元格重复');keys.add(k);
      if(!dateValid(c.date)||!Number.isFinite(c.hours)||c.hours<0||c.hours%0.5)fail('工时须按0.5小时填写，清空表示移除该日工时');
      monthOK(state,c.date.slice(0,7),true);
      if(!state.calendar[c.date.slice(0,7)].days.includes(c.date))fail(c.date+' 非公司工作日，禁止填报');
      if(!state.members.some(m=>m.personId===personId&&m.projectId===c.projectId&&m.role===c.role))fail('人员、项目或角色不匹配');
      if(c.workItemId&&c.hours>0&&!['项目准备','入企服务','后期复盘','其他'].includes(c.activity))fail('请选择工作事项：项目准备、入企服务、后期复盘或其他');
      if(c.workItemId&&c.activity==='其他'&&c.hours>0&&!String(c.description||'').trim())fail('“其他”事项请填写具体工作内容');
      const old=state.times.filter(r=>r.personId===personId&&r.projectId===c.projectId&&r.role===c.role&&r.date===c.date&&(r.workItemId||'legacy')===(c.workItemId||'legacy'));
      if(sum(old,'hours')===c.hours&&(!c.workItemId||old.every(r=>(r.activity||'')===(c.activity||'')&&(r.description||'')===(c.description||''))))continue;
      previous.push(...old);changes.push({...c,old});
    }
    if(!changes.length)return state;
    const replaced=new Set(previous.map(r=>r.id)),base=copy(state);base.times=base.times.filter(r=>!replaced.has(r.id));
    const rows=changes.filter(c=>c.hours>0).map(c=>({id:c.old[0]?.id,personId,projectId:c.projectId,role:c.role,date:c.date,workItemId:c.workItemId,activity:c.activity,hours:c.hours,start:'',end:'',description:c.description===undefined?unique(c.old.map(r=>r.description).filter(Boolean)).join('；'):String(c.description).trim(),status:'submitted',source:'项目日程填报'}));
    const result=validateTimes(base,rows);if(result.errors.length)fail(result.errors.join('；'));
    const n=next(state,'按周保存项目工时',{personId,cells:changes.map(({old,...c})=>c),previous});
    n.times=base.times.concat(rows.map((r,i)=>({...r,id:r.id||'time-'+n.revision+'-'+i})));return n;
  }
  function deleteTime(state,id,expectedRevision=state.revision){version(state,expectedRevision);const r=state.times.find(x=>x.id===id);if(!r)fail('工时记录不存在');monthOK(state,r.date.slice(0,7),true);const n=next(state,'删除工时',r);n.times=n.times.filter(x=>x.id!==id);return n;}
  function updateSettings(state,projectId,month,settings,expectedRevision=state.revision){
    version(state,expectedRevision);monthOK(state,month,true);entity(state,'projects',projectId);
    const ratios=settings.ratios||[],ids=new Set();let total=0;
    for(const r of ratios){if(ids.has(r.personId)||!state.members.some(x=>x.projectId===projectId&&x.personId===r.personId))fail('比例人员重复或不是项目成员');ids.add(r.personId);if(!amountOK(r.ratio)||r.ratio>1)fail('收入比例须为0至100%');total+=r.ratio;}
    if(total>1+1e-9)fail('收入比例合计不得超过100%');
    for(const k of ['accountManager','yearBonus'])if(!amountOK(settings.expenses?.[k]))fail('预计费用须为非负金额');
    const n=next(state,'保存核算设置',{projectId,month,settings});
    n.ratios=n.ratios.filter(r=>r.projectId!==projectId||r.month!==month);
    ratios.forEach((r,i)=>n.ratios.push({id:'ratio-'+n.revision+'-'+i,projectId,month,personId:r.personId,ratio:r.ratio}));
    n.expenses=n.expenses.filter(r=>r.projectId!==projectId||r.month!==month||!['accountManager','yearBonus'].includes(r.category));
    ['accountManager','yearBonus'].forEach(k=>n.expenses.push({id:'expense-'+n.revision+'-'+k,projectId,month,category:k,amount:round(settings.expenses[k])}));return n;
  }
  const importTypes={salary:{collection:'salaries',person:true},commission:{collection:'commissions',person:true,project:true},bonus:{collection:'bonuses',person:true},exception:{collection:'expenses',project:true,category:'exception'},fixed:{collection:'expenses',project:true,category:'fixed'}};
  function hash(text){let h=2166136261;for(let i=0;i<text.length;i++){h^=text.charCodeAt(i);h=Math.imul(h,16777619);}return (h>>>0).toString(16);}
  function fingerprint(preview){return hash(JSON.stringify({type:preview.type,month:preview.month,revision:preview.revision,rows:preview.rows,errors:preview.errors}));}
  function previewImport(state,type,month,rows){
    const config=importTypes[type],errors=[],seen=new Set();
    if(!config)fail('不支持的导入类型');
    try{monthOK(state,month,true);}catch(e){errors.push(e.message);}
    const result=rows.map((r,i)=>{
      const personId=config.person?r.personId:undefined,projectId=config.project?r.projectId:undefined,key=[type,month,projectId||'',personId||''].join('|');
      const old=state[config.collection].find(x=>x.month===month&&(!config.person||x.personId===personId)&&(!config.project||x.projectId===projectId)&&(!config.category||x.category===config.category));
      const blank=r.value===''||r.value===null||r.value===undefined;
      const item={key,projectId,personId,oldValue:old?old.amount:null,newValue:blank?null:r.value,kind:blank?'skip':old?'update':'new',error:null};
      const reasons=[];
      if(config.person&&!state.people.some(x=>x.id===personId))reasons.push('人员不存在');
      if(config.project&&!state.projects.some(x=>x.id===projectId))reasons.push('项目不存在');
      if(config.person&&config.project&&!state.members.some(x=>x.projectId===projectId&&x.personId===personId))reasons.push('人员不是项目成员');
      if(seen.has(key))reasons.push('业务身份重复');seen.add(key);
      if(!blank&&!amountOK(r.value))reasons.push('金额必须为非负数字，不接受公式或文本');
      if(reasons.length){item.kind='error';item.error=reasons.join('；');errors.push('第'+(i+1)+'行：'+item.error);}else if(!blank)item.newValue=round(r.value);
      return item;
    });
    const preview={type,month,revision:state.revision,rows:result,errors};preview.signature=fingerprint(preview);preview.id='import-'+preview.signature;return preview;
  }
  function applyImport(state,preview,expectedRevision=preview.revision){
    if(!preview||!importTypes[preview.type])fail('导入预览无效');
    const fp=fingerprint(preview);
    if(preview.signature!==fp||preview.id!=='import-'+fp)fail('导入预览内容已变化，请重新预览');
    const applied=state.batches.find(b=>b.id===preview.id);
    if(applied){if(applied.signature!==fp)fail('导入预览与已应用批次不一致');return state;}
    version(state,expectedRevision);if(preview.revision!==state.revision)fail('预览版本已过期，请重新预览');
    if(preview.errors.length)fail(preview.errors.join('；'));
    const checked=previewImport(state,preview.type,preview.month,preview.rows.map(r=>({personId:r.personId,projectId:r.projectId,value:r.newValue})));
    if(checked.signature!==preview.signature||checked.errors.length)fail('导入预览校验失败，请重新预览');
    const config=importTypes[preview.type],n=next(state,'确认导入',{type:preview.type,month:preview.month,batchId:preview.id});
    for(const [i,r] of preview.rows.entries()){
      if(r.kind==='skip')continue;
      const old=n[config.collection].find(x=>x.month===preview.month&&(!config.person||x.personId===r.personId)&&(!config.project||x.projectId===r.projectId)&&(!config.category||x.category===config.category));
      if(old)old.amount=r.newValue;
      else{const value={id:preview.id+'-'+i,month:preview.month,amount:r.newValue};if(config.person)value.personId=r.personId;if(config.project)value.projectId=r.projectId;if(config.category)value.category=config.category;n[config.collection].push(value);}
    }
    n.batches.push({...copy(preview),createdAt:new Date().toISOString(),appliedRevision:n.revision,status:'已导入'});return n;
  }
  function correctAmount(state,collection,id,amount,reason,expectedRevision=state.revision){
    version(state,expectedRevision);if(!['salaries','commissions','bonuses','actualCosts','expenses'].includes(collection))fail('该数据不支持金额纠错');
    if(typeof reason!=='string'||!reason.trim())fail('纠错原因必填');if(!amountOK(amount))fail('金额须为非负数字');
    const row=state[collection].find(r=>r.id===id);if(!row)fail('纠错记录不存在');monthOK(state,row.month,true);
    const n=next(state,'金额纠错',{collection,id,from:row.amount,to:round(amount),reason:reason.trim()});n[collection].find(r=>r.id===id).amount=round(amount);return n;
  }
  function monthMissing(state,month){
    monthOK(state,month);
    const missing=[];
    const collect=(result,m,label)=>result.missing.filter(reason=>!reason.includes('无法测算')).forEach(reason=>missing.push(m+' '+label+'：'+reason));
    for(const m of [...state.months].filter(m=>m<=month).sort()){
      state.projects.filter(p=>!p.startDate||p.startDate.slice(0,7)<=m).forEach(p=>collect(projectResult(state,p.id,m),m,'项目 '+p.name));
      state.people.filter(p=>!p.joined||p.joined.slice(0,7)<=m).forEach(p=>collect(personResult(state,p.id,m),m,'人员 '+p.name));
    }
    return unique(missing);
  }
  function closeMonth(state,month,expectedRevision=state.revision){
    version(state,expectedRevision);monthOK(state,month,true);
    const missing=monthMissing(state,month);
    if(missing.length)fail('月结前请补齐：'+missing.join('；'));
    const projects={},people={};
    state.projects.forEach(p=>{projects[p.id]=projectResult(state,p.id,month);});
    state.people.forEach(p=>{people[p.id]=personResult(state,p.id,month);});
    const inputKeys=['projects','people','members','calendar','delivery','receipts','actualCosts','salaries','commissions','bonuses','expenses','ratios','times','historicalTimes'];
    const inputs=Object.fromEntries(inputKeys.map(k=>[k,copy(state[k])]));
    const n=next(state,'月结',{month});n.closed[month]={month,revision:state.revision,closedAt:new Date().toISOString(),rules:copy(RULES),inputs,projects,people};return n;
  }
  function reopenMonth(state,month,reason,expectedRevision=state.revision){version(state,expectedRevision);monthOK(state,month);if(!state.closed[month])fail('月份尚未月结');if(typeof reason!=='string'||!reason.trim())fail('反结账原因必填');if(Object.keys(state.closed).some(m=>m>month))fail('请先反结账后续更晚月份');const n=next(state,'反结账',{month,reason:reason.trim()});delete n.closed[month];return n;}
  function addScheduleExample(s){
    const names=['远川精益运营提升','启明人才梯队建设','恒越销售体系优化','澄海流程标准化'];
    names.forEach((name,i)=>{
      const id='p-schedule-demo-'+(i+1);
      if(!s.projects.some(p=>p.id===id))s.projects.push({id,name:name+'（示例）',type:'管理咨询',status:'进行中',ownerId:'u2',contract:120000+i*30000,startDate:'2026-11-01',receivable:0,code:'XM20261109000'+(i+1),orderNo:'BS261109000'+(i+1),company:name.slice(0,2)+'有限公司',team:'博商管理咨询',createdAt:'2026-11-01'});
      if(!s.members.some(m=>m.projectId===id&&m.personId==='u2'))s.members.push({projectId:id,personId:'u2',role:'咨询师'});
    });
    s.demoFixtures={...s.demoFixtures,multiProjectSchedule:1};return s;
  }
  function ensureScheduleExample(state){
    if(state.demoFixtures?.multiProjectSchedule===1||!state.people.some(p=>p.id==='u2'))return state;
    return addScheduleExample(next(state,'补充多项目日程示例',{personId:'u2',addedProjects:4}));
  }
  function seed(){
    const s={revision:1,months:['2026-09','2026-10','2026-11'],projects:[{id:'p1',name:'星澜制造数字化咨询（示例）',type:'管理咨询',status:'进行中',ownerId:'u1',contract:480000,startDate:'2026-09-01',receivable:330000},{id:'p2',name:'青禾零售组织升级（示例）',type:'组织咨询',status:'进行中',ownerId:'u2',contract:300000,startDate:'2026-09-01',receivable:230000},{id:'p3',name:'云岑新项目筹备（示例）',type:'专项咨询',status:'筹备中',ownerId:'u3',contract:180000,startDate:'2026-11-01',receivable:180000}],people:[{id:'u1',name:'林予安',joined:'2024-03-01',role:'项目经理'},{id:'u2',name:'周知行',joined:'2025-01-06',role:'咨询师'},{id:'u3',name:'许映舟',joined:'2026-09-01',role:'咨询师'}],members:[{projectId:'p1',personId:'u1',role:'项目经理'},{projectId:'p1',personId:'u2',role:'咨询师'},{projectId:'p2',personId:'u1',role:'咨询师'},{projectId:'p2',personId:'u2',role:'项目经理'},{projectId:'p2',personId:'u3',role:'咨询师'},{projectId:'p3',personId:'u3',role:'项目经理'}],calendar:{},delivery:[],receipts:[],actualCosts:[],salaries:[],commissions:[],bonuses:[],expenses:[],ratios:[],times:[],historicalTimes:[],batches:[],closed:{},audit:[]};
    let id=0;const add=(key,row)=>s[key].push({id:key+'-'+(++id),...row});
    for(const month of s.months){
      const [year,m]=month.split('-').map(Number),days=[];
      for(let day=1;day<=new Date(year,m,0).getDate();day++){const d=new Date(year,m-1,day);if(d.getDay()!==0&&d.getDay()!==6)days.push(month+'-'+String(day).padStart(2,'0'));}
      // 演示日历包含公司安排：11月7日调班，11月6日休息。
      if(month==='2026-11'){days.splice(days.indexOf('2026-11-06'),1);days.push('2026-11-07');days.sort();}
      s.calendar[month]={days,standardHours:days.length*8};
      for(const p of s.people)if(!(p.id==='u3'&&month==='2026-11'))add('salaries',{personId:p.id,month,amount:{u1:18000,u2:14000,u3:11000}[p.id]});
      for(const p of s.projects){
        const income=p.id==='p1'?{'2026-09':110000,'2026-10':18000,'2026-11':0}[month]:p.id==='p2'?{'2026-09':50000,'2026-10':70000,'2026-11':90000}[month]:0;
        add('delivery',{projectId:p.id,month,amount:income});add('receipts',{projectId:p.id,month,amount:p.id==='p3'?0:month==='2026-09'?40000:month==='2026-10'?30000:p.id==='p2'?20000:0});
        if(p.id!=='p3'){
          for(const category of ['business','management','travel'])add('actualCosts',{projectId:p.id,month,category,amount:{business:income*.04,management:income*.08,travel:p.id==='p1'?6500:3000}[category]});
          for(const category of ['accountManager','exception','yearBonus','fixed'])add('expenses',{projectId:p.id,month,category,amount:{accountManager:2500,exception:600,yearBonus:1500,fixed:1200}[category]});
        }
        const members=s.members.filter(x=>x.projectId===p.id);
        members.forEach((member,i)=>{
          add('ratios',{projectId:p.id,personId:member.personId,month,ratio:p.id==='p1'?(i===0?.55:.35):p.id==='p2'?[.2,.4,.3][i]:1});
          if(p.id!=='p3'){
            add('commissions',{projectId:p.id,personId:member.personId,month,amount:p.id==='p1'?1200:900});
            if(month!=='2026-11')add('historicalTimes',{projectId:p.id,personId:member.personId,month,hours:p.id==='p1'?64:48,source:'历史估算'});
          }
        });
      }
      add('bonuses',{personId:'u2',month,amount:1200});
    }
    for(let day=2;day<=5;day++)for(const person of s.people){const projectId=person.id==='u3'?'p2':'p1',member=s.members.find(x=>x.projectId===projectId&&x.personId===person.id);add('times',{personId:person.id,projectId,role:member.role,date:'2026-11-0'+day,hours:6,workItemId:day===2?'preparation':day===5?'review':'onsite',activity:day===2?'项目准备':day===5?'后期复盘':'入企服务',description:day===2?'准备访谈提纲':day===5?'整理交付反馈':'现场调研与访谈',start:'09:00',end:'15:00',status:'submitted'});}
    return addScheduleExample(s);
  }
  return {round,seed,ensureScheduleExample,projectResult,personResult,monthMissing,validateTimes,submitTimes,saveDrafts,saveWeekTimes,deleteTime,updateSettings,previewImport,applyImport,correctAmount,closeMonth,reopenMonth};
});
