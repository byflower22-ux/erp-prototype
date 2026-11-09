(function(){
  'use strict';
  const M=window.ProjectModel,U=window.ProjectUI,{esc,money,percent,button,badge,table,card,options}=U;
  const KEY='erp-project-demo-v1',PIN_KEY='erp-project-schedule-pins-v1',labels={schedule:'我的项目日程',projects:'项目交付单',consultants:'咨询师列表','project-analysis':'项目分析','person-analysis':'项目人效分析'};
  const content=document.getElementById('content'),dialog=document.getElementById('dialog'),body=document.getElementById('dialog-body');
  let state,lastRaw=null,storageProblem='',tabs=[],active=null,role='finance',personId='u1',month='2026-11',mobile=new URLSearchParams(location.search).get('mobile')==='1'||!ERPClient.hosted&&innerWidth<500,formDirty=false,dialogSave=null,preview=null,timer,dialogSequence=0;
  const filters={date:'2026-11-09',scheduleView:'week',project:'all',query:'',financeTab:'data',dataType:'salaries',analysisProject:'all',analysisPerson:'all',analysisRole:'咨询师',analysisTeam:'all',periodMode:'month',status:'all'};
  const weekInputs=new Map();
  try{
    lastRaw=localStorage.getItem(KEY);
    state=lastRaw?JSON.parse(lastRaw):M.seed();
    if(!state.projects||!state.people||!Number.isInteger(state.revision))throw Error('本地演示数据格式不正确，请重置示例');
  }catch(error){state=M.seed();storageProblem=error.message;}
  if(!storageProblem){
    const updated=M.ensureScheduleExample(state);
    if(updated!==state)try{persist(updated);}catch(error){storageProblem=error.message;}
  }
  // 旧版 Demo 的未确认工时不作为实际投入，取消草稿后移除，正式记录保留。
  if(state.times.some(r=>r.status==='draft')){
    const next=structuredClone(state);next.times=next.times.filter(r=>r.status!=='draft');next.revision++;
    next.audit.push({id:'audit-'+next.revision,action:'取消日程草稿',detail:{removed:state.times.length-next.times.length},revision:next.revision,at:new Date().toISOString()});
    try{persist(next);}catch(error){state=next;storageProblem=error.message;}
  }
  document.documentElement.classList.toggle('hosted',ERPClient.hosted);
  document.getElementById('demo-person').innerHTML=options(state.people,personId);
  document.getElementById('standalone-nav').innerHTML=Object.entries(labels).map(([key,label])=>button(label,'navigate',`data-page="${key}"`)).join('');
  const toast=(message,error=false)=>{const el=document.getElementById('toast');clearTimeout(timer);el.textContent=message;el.classList.toggle('error',error);el.hidden=false;timer=setTimeout(()=>el.hidden=true,4500);};
  const employee=()=>role==='employee';
  const requireFinance=()=>{if(role!=='finance')throw Error('当前演示身份没有财务维护权限');};
  const pName=id=>state.projects.find(p=>p.id===id)?.name||id;
  const uName=id=>state.people.find(p=>p.id===id)?.name||id;
  const currentTab=()=>tabs.find(t=>t.key===active);
  const snapshot=()=>({active,tabs:tabs.map(t=>({...t,dirty:t.key===active&&formDirty}))});
  function publish(){ERPClient.publish();document.getElementById('local-tabs').innerHTML=tabs.map(t=>`<button type="button" data-action="activate" data-key="${esc(t.key)}" class="${t.key===active?'current':''}">${esc(t.label)}${t.key===active&&formDirty?' · 未保存':''}</button>`).join('');}
  function persist(next){
    try{
      const stored=localStorage.getItem(KEY);
      if(stored!==lastRaw)throw Error('演示数据已在其他窗口更新，请刷新后重试，未覆盖对方修改');
      const raw=JSON.stringify(next);localStorage.setItem(KEY,raw);lastRaw=raw;storageProblem='';
    }catch(error){storageProblem=error.message;renderStorage();throw Error('保存失败：'+error.message);}
    state=next;renderStorage();
  }
  function mutate(action,message='已保存，相关核算已同步更新'){
    const next=action(state);if(next!==state)persist(next);render();toast(message);return next;
  }
  function renderStorage(){const el=document.getElementById('storage-banner');el.hidden=!storageProblem;el.textContent=storageProblem?'本地保存异常：'+storageProblem+'。未保存的业务操作不会标为成功；可检查浏览器存储设置或重置示例。':'';}
  function closeDialog(force=false){
    if(!force&&formDirty&&!confirm('当前修改尚未保存，确定放弃吗？'))return false;
    if(body.querySelector('#lobster-history')){chatSession.pending=null;chatSession.busy=false;}dialogSequence++;formDirty=false;dialogSave=null;dialog.close();publish();return true;
  }
  function openDialog(title,html,onSave=null,wide=false,eyebrow='项目管理 · ERP-I005'){
    if(dialog.open&&!closeDialog())return;
    dialog.classList.toggle('mobile-sheet',currentTab()?.nav==='schedule'&&ctx().mobile);dialog.classList.toggle('wide',wide);document.getElementById('dialog-title').textContent=title;document.getElementById('dialog-eyebrow').textContent=eyebrow;
    dialogSequence++;body.innerHTML=html;dialogSave=onSave;formDirty=false;dialog.showModal();publish();
  }
  const formActions=(save='保存',extra='')=>`<div id="form-error" class="form-error" role="alert" hidden></div><div class="form-actions">${extra}${button('取消','dialog-close')}${button(save,'dialog-save','','primary')}</div>`;
  const inputField=(label,name,value='',type='text',attrs='')=>`<label class="field">${esc(label)}<input name="${name}" type="${type}" value="${esc(value)}" ${attrs}></label>`;
  const fieldSelect=(label,name,rows,value)=>`<label class="field">${esc(label)}<select name="${name}">${options(rows,value)}</select></label>`;
  const values=()=>Object.fromEntries(new FormData(body.querySelector('form')));
  const todayInMonth=()=>filters.date?.startsWith(month)?filters.date:(state.calendar[month]?.days[0]||month+'-01');
  function navigate(page){
    if(!labels[page])page='schedule';
    if(employee()&&page!=='schedule'){toast('咨询师本人仅可使用自己的项目日程',true);return;}
    if(dialog.open&&!closeDialog())return;
    if(!tabs.some(t=>t.key===page))tabs.push({key:page,label:labels[page],nav:page});
    active=page;mobile=mobile&&page==='schedule';render();publish();
  }
  function activate(key){const tab=tabs.find(t=>t.key===key);if(!tab)return;if(dialog.open&&!closeDialog())return;active=key;render();publish();}
  function close(key){
    if(key===active&&dialog.open&&!closeDialog())return;
    const index=tabs.findIndex(t=>t.key===key);tabs=tabs.filter(t=>t.key!==key);
    if(active===key)active=tabs[Math.max(0,index-1)]?.key||null;render();publish();
  }
  const ctx=()=>({state,month,personId,role,page:currentTab()?.nav||'schedule',filters,esc,money,percent,schedulePins:readSchedulePins()[personId]||[],mobile:mobile||matchMedia('(max-width:760px)').matches,weekEditor:currentTab()?.nav==='schedule'?weekInput():null});
  function heading(eyebrow,title,description,actions=''){return `<header class="page-heading"><div><span class="eyebrow">${esc(eyebrow)}</span><h1>${esc(title)}</h1><p>${esc(description)}</p></div><div class="heading-actions">${actions}</div></header>`;}
  function render(){
    document.body.classList.toggle('mobile-mode',(mobile||matchMedia('(max-width:760px)').matches)&&currentTab()?.nav==='schedule');document.body.classList.toggle('delivery-page',currentTab()?.nav==='projects');
    document.getElementById('lobster-tool').hidden=role!=='finance';
    document.getElementById('demo-person').innerHTML=options(state.people,personId);
    const page=currentTab()?.nav;content.dataset.erpPage=page||'empty';
    if(!active)content.innerHTML=U.empty('从左侧菜单打开业务页面');
    else if(employee()&&page!=='schedule')content.innerHTML=U.empty('当前身份没有该页面权限');
    else if(page==='schedule')content.innerHTML=ProjectSchedule.render(ctx());
    else if(page==='projects')content.innerHTML=renderProjects();
    else if(page==='consultants')content.innerHTML=ProjectConsultants.render(ctx());
    else if(page==='finance')content.innerHTML=ProjectFinance.render(ctx());
    else content.innerHTML=ProjectAnalysis.render(ctx());
    if(page==='schedule'&&content.querySelector('.schedule-weekly,.mobile-schedule'))refreshWeek();
    const region={schedule:'schedule',finance:'finance','project-analysis':'analysis','person-analysis':'analysis'}[page];if(region)content.querySelector(page==='schedule'?'.schedule-layout':page==='finance'?'section.panel':'.manager-dashboard, .metrics.six')?.setAttribute('data-change',region);
    document.querySelectorAll('#standalone-nav button').forEach(b=>b.classList.toggle('active',b.dataset.page===page));
    ProjectAnalysisAI.sync({...ctx(),aiImport:{template:analysisTemplate,preview:analysisImportPreview,confirm:analysisImportConfirm,download:downloadExcel}});publish();if(marksConfigured)marks.refresh();
  }
  const deliveryFilters={status:'all',searchBy:'项目编号',query:'',start:'2026-05-10',end:'2026-11-09',range:'近半年',type:'',mark:'',team:'',owner:'',company:'',expanded:false};
  function renderProjects(){return currentTab()?.projectId?ProjectDelivery.detail(ctx(),currentTab()):ProjectDelivery.list(ctx(),deliveryFilters);}
  function showProject(id,selectedMonth=month,section){
    if(employee())throw Error('当前身份不能查看项目详情');
    if(!state.projects.some(p=>p.id===id))throw Error('项目不存在');
    if(dialog.open&&!closeDialog())return;
    const key='project-detail:'+id;let tab=tabs.find(t=>t.key===key);
    if(!tab){tab={key,label:'项目详情',nav:'projects',projectId:id,period:selectedMonth,section:section||'项目成员'};tabs.push(tab);}
    else{tab.period=selectedMonth;if(section)tab.section=section;}
    active=key;render();publish();
  }
  function projectExpenses(id,period){const exp=category=>state.expenses.find(x=>x.projectId===id&&x.month===period&&x.category===category)?.amount??0;return {accountManager:exp('accountManager'),yearBonus:exp('yearBonus')};}
  function editMember(id,pid){
    requireFinance();const period=currentTab().period||month,person=state.people.find(x=>x.id===pid),member=state.members.find(x=>x.personId===pid&&x.projectId===id),revision=state.revision;
    const ratio=state.ratios.find(x=>x.projectId===id&&x.personId===pid&&x.month===period);
    openDialog('编辑项目成员 · 收入比例',`<form><div class="form-grid">${inputField('姓名','personName',person.name,'text','readonly')}${inputField('项目角色','memberRole',member.role,'text','readonly')}${inputField('核算月份','period',period,'text','readonly')}${inputField('收入比例（%）','ratio',ratio?Number((ratio.ratio*100).toFixed(4)):'','number','min="0" max="100" step="0.01" required')}</div><p class="rule-text">收入比例按月维护，同一项目当月所有成员合计不能超过100%。保存后同步核算。</p>${formActions('保存')}</form>`,()=>{requireFinance();const v=values(),ratios=state.members.filter(x=>x.projectId===id).map(x=>({personId:x.personId,ratio:x.personId===pid?Number(v.ratio)/100:(state.ratios.find(r=>r.projectId===id&&r.personId===x.personId&&r.month===period)?.ratio??0)}));persist(M.updateSettings(state,id,period,{ratios,expenses:projectExpenses(id,period)},revision));closeDialog(true);render();toast('成员收入比例已保存');});
  }
  function editProjectCosts(id){
    requireFinance();const period=currentTab().period||month,expenses=projectExpenses(id,period),revision=state.revision;
    openDialog('项目成本 · 预计费用',`<form><p class="rule-text">${esc(pName(id))} · ${period}</p><div class="form-grid">${inputField('大客户经理提成（元）','accountManager',expenses.accountManager,'number','min="0" step="0.01" required')}${inputField('项目年终奖分摊（元）','yearBonus',expenses.yearBonus,'number','min="0" step="0.01" required')}</div>${formActions('保存')}</form>`,()=>{requireFinance();const v=values(),ratios=state.members.filter(x=>x.projectId===id).map(x=>({personId:x.personId,ratio:state.ratios.find(r=>r.projectId===id&&r.personId===x.personId&&r.month===period)?.ratio??0}));persist(M.updateSettings(state,id,period,{ratios,expenses:{accountManager:Number(v.accountManager),yearBonus:Number(v.yearBonus)}},revision));closeDialog(true);render();toast('预计费用已保存');});
  }
  function collectDeliverySearch(){const form=content.querySelector('#delivery-search');if(form)Object.assign(deliveryFilters,Object.fromEntries(new FormData(form)));}
  function pickDelivery(section){openDialog(section,`<form>${fieldSelect('选择项目','projectId',state.projects,state.projects[0]?.id)}${formActions('打开'+section)}</form>`,()=>{const id=values().projectId;closeDialog(true);showProject(id,month,section);});}
  function addDeliveryProject(){
    requireFinance();const revision=state.revision;
    openDialog('新增项目',`<form><div class="form-grid">${inputField('项目名称','name','','text','required')}${inputField('公司名称','company','','text','required')}${fieldSelect('项目类型','type',['管理咨询','组织咨询','专项咨询'].map(x=>({id:x,name:x})),'管理咨询')}${fieldSelect('项目负责人','ownerId',state.people,personId)}${inputField('项目金额（元）','amount','','number','min="0" step="0.01" required')}${inputField('立项日期','startDate','2026-11-09','date','required')}</div>${formActions('保存项目')}</form>`,()=>{requireFinance();if(revision!==state.revision)throw Error('数据版本已变化');const v=values(),next=structuredClone(state),id='p-'+crypto.randomUUID(),code='XM20261109'+String(state.projects.length+1).padStart(4,'0');next.projects.push({id,code,name:v.name,company:v.company,type:v.type,ownerId:v.ownerId,contract:Number(v.amount),receivable:Number(v.amount),startDate:v.startDate,createdAt:'2026-11-09',status:'未开始'});next.members.push({projectId:id,personId:v.ownerId,role:'项目经理'});state.months.forEach(m=>next.ratios.push({id:'ratio-'+id+'-'+m,projectId:id,personId:v.ownerId,month:m,ratio:1}));next.revision++;next.audit.push({action:'新增项目',at:new Date().toISOString(),revision:next.revision,detail:{projectId:id}});persist(next);closeDialog(true);render();toast('项目已新增');});
  }
  function addDeliveryMember(){
    requireFinance();const tab=currentTab(),id=tab.projectId,period=tab.period||month,revision=state.revision,choices=state.people.filter(p=>!state.members.some(m=>m.projectId===id&&m.personId===p.id));
    if(!choices.length){toast('所有示例人员均已加入本项目');return;}
    openDialog('新增项目成员',`<form><div class="form-grid">${fieldSelect('姓名','personId',choices,choices[0].id)}${fieldSelect('角色','role',['项目总监','项目经理','咨询师','辅助交付人'].map(x=>({id:x,name:x})),'咨询师')}${inputField('核算月份','period',period,'text','readonly')}${inputField('收入比例（%）','ratio','0','number','min="0" max="100" step="0.01" required')}</div>${formActions('保存成员')}</form>`,()=>{requireFinance();if(revision!==state.revision)throw Error('数据版本已变化');const v=values(),base=structuredClone(state);base.members.push({projectId:id,personId:v.personId,role:v.role});const ratios=base.members.filter(x=>x.projectId===id).map(x=>({personId:x.personId,ratio:x.personId===v.personId?Number(v.ratio)/100:state.ratios.find(r=>r.projectId===id&&r.personId===x.personId&&r.month===period)?.ratio??0}));persist(M.updateSettings(base,id,period,{ratios,expenses:projectExpenses(id,period)},revision));closeDialog(true);render();toast('项目成员已新增');});
  }
  function exportDelivery(){
    const rows=[['项目编号','订单编号','项目名称','公司名称','负责人','状态','项目金额（元）'],...state.projects.map(p=>{const m=ProjectDelivery.info(state,p);return [m.code,m.order,p.name,m.company,m.owner,p.status,p.contract];})];
    const csv='\ufeff'+rows.map(row=>row.map(v=>'"'+String(v).replace(/"/g,'""')+'"').join(',')).join('\r\n'),url=URL.createObjectURL(new Blob([csv],{type:'text/csv;charset=utf-8'})),a=document.createElement('a');a.href=url;a.download='项目交付单明细.csv';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
  }
  function editConsultant(id=null){
    requireFinance();const person=id?state.people.find(x=>x.id===id):null;if(id&&!person)throw Error('咨询师不存在');
    const C=ProjectConsultants,revision=state.revision,current=person?C.accountFor(person):null,linked=!!person&&(state.members.some(x=>x.personId===id)||state.salaries.some(x=>x.personId===id)||state.times.some(x=>x.personId===id)),fixed=!!current&&linked;
    const usedBy=account=>state.people.find(x=>x.id!==id&&C.accountFor(x)?.id===account.id);
    const accountChoices=`<option value="">请选择 ERP 已有账号</option>`+C.accounts.map(account=>`<option value="${esc(account.id)}" ${current?.id===account.id?'selected':''} ${usedBy(account)?'disabled':''}>${esc(account.name+' / '+account.employeeNo+' / '+account.username)}${usedBy(account)?'（已关联咨询师）':''}</option>`).join('');
    const autoField=(label,name)=>inputField(label,name,current?.[name]||'','text','readonly data-account-field="'+name+'"');
    openDialog(person?'编辑咨询师':'新增咨询师',`<form id="consultant-account-form"><div class="form-grid"><label class="field wide">关联 ERP 账号 <span class="required-mark">*</span><select id="consultant-account" name="accountId" required ${fixed?'disabled':''}>${accountChoices}</select>${fixed?`<input type="hidden" name="accountId" value="${esc(current.id)}">`:''}<small>预设 ERP 账号 · Demo。一个账号仅能关联一位咨询师。${fixed?'已有项目或核算记录，保留现有账号关联。':''}</small></label></div><section class="consultant-account-info"><div class="consultant-account-caption">ERP 账号信息 <span>选择账号后自动带出，不可手工修改</span></div><div class="form-grid">${autoField('姓名','name')}${autoField('工号','employeeNo')}${autoField('状态','status')}${autoField('所属部门','department')}${autoField('入职日期','joined')}${autoField('手机号','phone')}${autoField('邮箱','email')}${autoField('ERP登录账号','username')}</div></section><div class="form-grid"><label class="field wide">专业方向<input name="expertise" value="${esc(person?.expertise||'')}" placeholder="例如：战略咨询、组织管理、数字化转型" maxlength="150"></label><label class="field wide">备注<textarea name="note" maxlength="500">${esc(person?.note||'')}</textarea></label></div><p class="rule-text">咨询师须关联 ERP 已有账号，基础信息以账号资料为准；本页只维护专业方向和备注。成员收入比例在项目成员中维护。</p>${formActions('保存档案')}</form>`,()=>{
      requireFinance();if(state.revision!==revision)throw Error('数据版本已变化，请重新打开档案');const v=values(),account=C.accounts.find(x=>x.id===v.accountId);if(!account)throw Error('请先关联 ERP 已有账号');if(usedBy(account))throw Error('该 ERP 账号已关联其他咨询师，不能重复新增');if(fixed&&account.id!==current.id)throw Error('已有业务记录，请保持原 ERP 账号关联');
      const next=structuredClone(state),personIdToSave=id||'person-'+crypto.randomUUID(),profile={...person,...C.accountFields(account),id:personIdToSave,role:person?.role||'咨询师',expertise:v.expertise.trim(),note:v.note.trim()};delete profile.code;
      if(person)next.people[next.people.findIndex(x=>x.id===id)]=profile;else next.people.push(profile);
      next.revision++;next.audit.push({id:'audit-'+next.revision,action:person?'编辑咨询师档案':'关联ERP账号新增咨询师',detail:{personId:personIdToSave,accountId:account.id},revision:next.revision,at:new Date().toISOString()});persist(next);closeDialog(true);render();toast(person?'咨询师档案已按 ERP 账号资料更新':'已关联 ERP 账号并新增咨询师');
    },true,'师资与教练管理 · 关联 ERP 账号');
    const select=body.querySelector('#consultant-account');if(select)select.addEventListener('change',()=>{const account=C.accounts.find(x=>x.id===select.value);body.querySelectorAll('[data-account-field]').forEach(input=>{input.value=account?.[input.dataset.accountField]||'';});});
  }
  function readSchedulePins(){
    try{const value=JSON.parse(localStorage.getItem(PIN_KEY)||'{}');if(!value||typeof value!=='object'||Array.isArray(value))return {};return Object.fromEntries(Object.entries(value).filter(([,ids])=>Array.isArray(ids)).map(([id,ids])=>[id,[...new Set(ids.filter(x=>typeof x==='string'))]]));}catch{return {};}
  }
  function toggleSchedulePin(projectId){
    const d=ProjectSchedule.weekData(ctx());if(ctx().mobile||new Set(d.rows.map(r=>r.projectId)).size<=3||!d.rows.some(r=>r.projectId===projectId))return;
    const pins=readSchedulePins(),previous=pins[personId]||[],pinned=previous.includes(projectId);pins[personId]=pinned?previous.filter(id=>id!==projectId):[projectId,...previous];
    try{localStorage.setItem(PIN_KEY,JSON.stringify(pins));}catch{throw Error('置顶顺序保存失败，请检查浏览器存储后重试');}
    render();const target=[...content.querySelectorAll('[data-action="schedule-project-pin"]')].find(el=>el.dataset.project===projectId);target?.focus({preventScroll:true});target?.closest('tr')?.scrollIntoView({block:'nearest',behavior:'smooth'});
  }
  function weekKey(){return personId;}
  function weekInput(){const key=weekKey();if(!weekInputs.has(key))weekInputs.set(key,{values:{},original:{},extra:[],meta:{},slots:{},dirty:false,error:''});return weekInputs.get(key);}
  function setWeekCell(key,value){
    const w=weekInput(),[projectId,memberRole,date,workItemId]=JSON.parse(key),old=state.times.filter(r=>r.personId===personId&&r.projectId===projectId&&r.role===memberRole&&r.date===date&&(r.workItemId||'legacy')===workItemId);
    if(!Object.hasOwn(w.original,key))w.original[key]=JSON.stringify(old);
    if(!w.meta[key])w.meta[key]={activity:old[0]?.activity||'',description:old[0]?.description||''};
    w.values[key]=value;w.error='';w.dirty=true;
  }
  function setEntryMeta(key,field,value){
    const w=weekInput(),[projectId,role,date,workItemId]=JSON.parse(key),old=state.times.filter(r=>r.personId===personId&&ProjectSchedule.matches(r,{projectId,role,workItemId})&&r.date===date);
    if(!Object.hasOwn(w.values,key))setWeekCell(key,old.reduce((n,r)=>n+Number(r.hours),0)||'');
    w.meta[key][field]=value;refreshWeek();
  }
  function addCellEntry(projectId,memberRole,date){
    if(role==='manager')throw Error('当前身份仅可查看');
    const d=ProjectSchedule.weekData(ctx());if(!d.working(date)||d.locked(date))throw Error('该日期不可填报');
    const w=weekInput(),k=ProjectSchedule.dayKey(projectId,memberRole,date),ids=d.entries({projectId,role:memberRole},date).map(r=>r.workItemId);ids.push('work-'+crypto.randomUUID());w.slots[k]=ids;render();
    const last=[...content.querySelectorAll('[data-week-cell]')].filter(el=>{const [p,r,day]=JSON.parse(el.dataset.weekCell);return p===projectId&&r===memberRole&&day===date;}).at(-1);last?.focus();
  }
  function refreshWeek(){const d=ProjectSchedule.weekData(ctx());weekInput().dirty=d.pending.length>0;ProjectSchedule.refreshWeek(ctx());}
  function saveWeek(){
    const w=weekInput();try{
      if(role==='manager')throw Error('当前管理身份仅可查看日程');
      if([...content.querySelectorAll('[data-week-cell]')].some(el=>el.validity.badInput))throw Error('请填写有效数字，工时按 0.5 小时填写');
      const d=ProjectSchedule.weekData(ctx());if(!d.changes.length){toast('没有需要保存的修改');return;}
      for(const c of d.changes){const key=ProjectSchedule.cellKey(c.projectId,c.role,c.date,c.workItemId),current=JSON.stringify(state.times.filter(r=>r.personId===personId&&ProjectSchedule.matches(r,c)&&r.date===c.date));if(w.original[key]!==current)throw Error(c.date+' 的记录已变化，请撤销未保存修改后重新填写');}
      persist(M.saveWeekTimes(state,personId,d.changes));for(const c of d.changes){const key=ProjectSchedule.cellKey(c.projectId,c.role,c.date,c.workItemId);delete w.values[key];delete w.original[key];delete w.meta[key];}for(const key of Object.keys(w.slots))if(d.dates.includes(JSON.parse(key)[2]))delete w.slots[key];w.error='';render();toast(d.periodName+'工时已保存');
    }catch(error){w.error=error.message;const el=content.querySelector('#week-error');if(el){el.hidden=false;el.textContent=error.message;if(ctx().mobile)toast(error.message,true);}else throw error;}
  }
  function copyPreviousWeek(){
    if(role==='manager')throw Error('当前管理身份仅可查看日程');
    const d=ProjectSchedule.weekData(ctx()),w=weekInput();let count=0;
    for(const m of state.members.filter(m=>m.personId===personId))for(const date of d.dates){
      if(!d.working(date)||d.locked(date)||d.entries(m,date).some(r=>Number(r.hours)>0))continue;
      const sourceDate=d.mode==='month'?previousMonthDate(date):addDays(date,-7),source=state.times.filter(r=>r.status==='submitted'&&r.personId===personId&&r.projectId===m.projectId&&r.role===m.role&&r.date===sourceDate),groups=new Map();
      for(const r of source){const id=r.workItemId||'legacy';if(!groups.has(id))groups.set(id,{workItemId:id,activity:r.activity||'',description:r.description||'',hours:0});groups.get(id).hours+=Number(r.hours);}
      for(const r of groups.values()){const k=ProjectSchedule.cellKey(m.projectId,m.role,date,r.workItemId);setWeekCell(k,String(r.hours));w.meta[k]={activity:r.activity,description:r.description};count++;}
      if(groups.size){const id=JSON.stringify([m.projectId,m.role]);if(!w.extra.includes(id))w.extra.push(id);}
    }
    render();toast(count?'已沿用 '+count+' 条当天工时，请核对事项后保存':'没有可沿用的工时');
  }
  function previousMonthDate(date){const y=Number(date.slice(0,4)),m=Number(date.slice(5,7)),day=Number(date.slice(8)),last=new Date(y,m-1,0).getDate();if(day>last)return '';return iso(new Date(y,m-2,day,12));}
  function mobileFormContext(){
    if(role==='manager')throw Error('当前身份仅可查看');const d=ProjectSchedule.weekData(ctx()),date=ProjectScheduleMobile.selectedDate(ctx(),d);if(!d.working(date)||d.locked(date))throw Error('该日期不可填报');return {d,date,rows:ProjectScheduleMobile.formRows(ctx(),d,date)};
  }
  function selectMobileProject(rowId,value){
    const {d,date,rows}=mobileFormContext(),row=rows.find(r=>r.id===rowId),m=d.rows.find(m=>JSON.stringify([m.projectId,m.role])===value);if(!row||!m)throw Error('请选择有效项目');
    const old=d.rows.flatMap(m=>d.entries(m,date)).find(r=>r.key===row.key);if(old&&old.projectId===m.projectId&&old.role===m.role)return;
    const meta={activity:old?.activity||'',description:old?.description||''},hours=old?.hours||'',key=ProjectSchedule.cellKey(m.projectId,m.role,date,'mobile-'+row.id);
    if(row.key)setWeekCell(row.key,'');setWeekCell(key,hours);weekInput().meta[key]=meta;row.key=key;render();
  }
  function addMobileRow(){
    const {rows}=mobileFormContext(),row={id:crypto.randomUUID(),key:null};rows.push(row);render();const card=content.querySelector('[data-mobile-row="'+row.id+'"]');card?.scrollIntoView({block:'center',behavior:'smooth'});card?.querySelector('select')?.focus({preventScroll:true});
  }
  function removeMobileRow(rowId){
    const {date,rows}=mobileFormContext(),row=rows.find(r=>r.id===rowId);if(!row)return;if(row.key)setWeekCell(row.key,'');weekInput().mobileRows[date]=rows.filter(r=>r.id!==rowId);render();
  }
  function openMobileBatch(){
    if(role==='manager')throw Error('当前身份仅可查看');
    const d=ProjectSchedule.weekData(ctx());if(!d.rows.length)throw Error('暂无可填报项目');
    const memberId=m=>JSON.stringify([m.projectId,m.role]);
    openDialog('多天填写',`<form id="mobile-batch-form"><label class="field">项目<select name="member">${options(d.rows.map(m=>({id:memberId(m),name:pName(m.projectId).replace('（示例）','')+' · '+m.role})),memberId(d.rows[0]))}</select></label><div class="ms-batch-caption"><b>选择日期</b><small>仅填空白工作日</small></div><div id="ms-batch-days" class="ms-batch-days"></div><label class="field">每天工时<div class="ms-batch-hours"><input name="hours" type="number" min="0.5" max="8" step="0.5" inputmode="decimal" value="4" required aria-label="每天工时"><span>小时</span></div></label><div class="ms-batch-presets">${[1,2,4,6,8].map(h=>'<button type="button" data-batch-hours="'+h+'">'+h+'h</button>').join('')}</div><label class="field">事项分类<select name="activity" required><option value="">请选择事项</option>${options(ProjectSchedule.activities.map(name=>({id:name,name})))}</select></label><label class="field" id="ms-batch-description" hidden>具体内容（必填）<input name="description" type="text" maxlength="150"></label>${formActions('填入'+d.periodName)}</form>`,()=>{
      const v=values(),hours=Number(v.hours),days=[...body.querySelectorAll('[name="dates"]:checked')].map(el=>el.value);if(!days.length)throw Error('请选择至少一个空白工作日');if(!Number.isFinite(hours)||hours<=0||hours%0.5||hours>8)throw Error('每天工时须为0.5至8小时，按0.5小时填写');
      const [projectId,memberRole]=JSON.parse(v.member),member={projectId,role:memberRole},current=ProjectSchedule.weekData(ctx()),cells=days.map(date=>{if(current.entries(member,date).some(r=>Number(r.hours)>0))throw Error(date+' 已有工时，请重新选择');const r=current.entries(member,date)[0];return {projectId,role:memberRole,date,workItemId:r.workItemId,hours,activity:v.activity,description:v.activity==='其他'?v.description.trim():''};});
      const combined=new Map(current.pending.map(c=>[ProjectSchedule.cellKey(c.projectId,c.role,c.date,c.workItemId),c]));cells.forEach(c=>combined.set(ProjectSchedule.cellKey(c.projectId,c.role,c.date,c.workItemId),c));M.saveWeekTimes(state,personId,[...combined.values()]);
      for(const c of cells){const key=ProjectSchedule.cellKey(c.projectId,c.role,c.date,c.workItemId);setWeekCell(key,String(c.hours));weekInput().meta[key]={activity:c.activity,description:c.description};}closeDialog(true);render();toast('已填入 '+cells.length+' 天，核对后保存'+d.periodName);
    });
    const drawDays=()=>{const [projectId,memberRole]=JSON.parse(body.querySelector('[name="member"]').value),m={projectId,role:memberRole};body.querySelector('#ms-batch-days').innerHTML=d.dates.map(date=>{const filled=d.entries(m,date).some(r=>Number(r.hours)>0),blocked=!d.working(date)||d.locked(date)||filled;return '<label class="'+(blocked?'blocked':'')+'"><input type="checkbox" name="dates" value="'+date+'" '+(blocked?'disabled':'checked')+'><span>'+Number(date.slice(5,7))+'/'+Number(date.slice(8))+'</span><small>'+(filled?'已填':d.locked(date)?'锁定':!d.working(date)?'休':'周'+['日','一','二','三','四','五','六'][new Date(date+'T12:00:00').getDay()])+'</small></label>';}).join('');};
    drawDays();body.querySelector('[name="member"]').onchange=drawDays;body.querySelector('[name="activity"]').onchange=event=>{const other=event.target.value==='其他';body.querySelector('#ms-batch-description').hidden=!other;body.querySelector('[name="description"]').required=other;};body.querySelectorAll('[data-batch-hours]').forEach(el=>el.onclick=()=>{body.querySelector('[name="hours"]').value=el.dataset.batchHours;formDirty=true;});
  }
  function openDay(date=filters.date,initial=null){
    if(role==='manager')throw Error('当前身份仅可查看');
    const pid=personId,revision=state.revision,cache=new Map(),members=state.members.filter(m=>m.personId===pid);if(!members.length)throw Error('当前人员尚未加入项目');
    const original=d=>state.times.filter(r=>r.personId===pid&&r.date===d&&r.status==='submitted');
    function initialRows(d){return members.flatMap(m=>{const found=new Map();original(d).filter(r=>r.projectId===m.projectId&&r.role===m.role).forEach(r=>{const id=r.workItemId||'legacy';if(!found.has(id))found.set(id,{...m,workItemId:id,activity:r.activity||'',description:r.description||'',hours:0});found.get(id).hours+=Number(r.hours);});return found.size?[...found.values()]:[{...m,workItemId:'daily',activity:'',description:'',hours:''}];});}
    function stash(d){const rows=cache.get(d);if(!rows)return;body.querySelectorAll('[data-day-row]').forEach(el=>rows[Number(el.dataset.dayRow)].hours=el.value);body.querySelectorAll('[data-day-activity]').forEach(el=>rows[Number(el.dataset.dayActivity)].activity=el.value);body.querySelectorAll('[data-day-description]').forEach(el=>rows[Number(el.dataset.dayDescription)].description=el.value);}
    function draw(d){
      const rows=cache.get(d)||initialRows(d);if(!cache.has(d)){if(initial&&d===date){rows.push({...members.find(m=>m.projectId===initial.projectId&&m.role===initial.role),workItemId:'work-'+crypto.randomUUID(),activity:initial.activity||'',description:initial.description||'',hours:initial.hours});}cache.set(d,rows);}
      const blocked=!state.months.includes(d.slice(0,7))?'请选择演示范围内的日期':Object.keys(state.closed).some(m=>m>=d.slice(0,7))?'该日期已锁定':!state.calendar[d.slice(0,7)]?.days.includes(d)?'非工作日不可填报':'';
      body.innerHTML=`<form id="day-time-form"><label class="field">日期<input id="day-time-date" type="date" value="${esc(d)}" required></label>${initial?.hint?'<p class="notice info">'+esc(initial.hint)+'</p>':''}<div class="day-modal-rows">${rows.map((m,i)=>`<div class="day-work-row"><div class="day-work-head"><b>${esc(pName(m.projectId).replace('（示例）',''))}</b>${button('＋ 事项','day-add-work',`data-project="${esc(m.projectId)}" data-role="${esc(m.role)}"`,'link small')}</div><div class="day-work-inputs"><select data-day-activity="${i}" aria-label="工作事项" ${blocked?'disabled':''}>${m.activity?'':'<option value="">待分类</option>'}${options(ProjectSchedule.activities.map(name=>({id:name,name})),m.activity)}</select><input type="text" data-day-description="${i}" maxlength="150" value="${esc(m.description)}" placeholder="具体内容（必填）" ${m.activity==='其他'?Number(m.hours)>0&&!blocked?'required':'':'hidden'} aria-label="具体工作内容" ${blocked?'disabled':''}><input type="number" min="0" max="8" step="0.5" inputmode="decimal" data-day-row="${i}" value="${esc(m.hours||'')}" placeholder="—" aria-label="工时" ${blocked?'disabled':''}><small>h</small></div></div>`).join('')}</div><div class="day-modal-total">合计 <b id="day-total">${rows.reduce((n,r)=>n+Number(r.hours||0),0)}h</b></div>${blocked?'<p class="form-error">'+esc(blocked)+'</p>':''}<div class="day-modal-note">0.5h 起填 · 每天最多 8h</div>${formActions('保存')}</form>`;
      body.querySelector('#day-time-date').onchange=e=>{stash(d);const next=e.target.value;if(!next){e.target.value=d;return;}draw(next);};
      body.querySelectorAll('.day-work-inputs input,.day-work-inputs select').forEach(el=>el.oninput=()=>{stash(d);body.querySelectorAll('[data-day-description]').forEach(note=>{const row=cache.get(d)[Number(note.dataset.dayDescription)];note.hidden=row.activity!=='其他';note.required=row.activity==='其他'&&Number(row.hours)>0&&!note.disabled;});body.querySelector('#day-total').textContent=cache.get(d).reduce((n,r)=>n+Number(r.hours||0),0)+'h';});
      body.querySelectorAll('[data-action="day-add-work"]').forEach(el=>el.onclick=()=>{if(blocked)return;stash(d);const m=members.find(m=>m.projectId===el.dataset.project&&m.role===el.dataset.role);rows.push({...m,workItemId:'work-'+crypto.randomUUID(),activity:'',description:'',hours:''});formDirty=true;draw(d);});
      dialogSave=()=>{
        if(blocked)throw Error(blocked);stash(d);const changes=cache.get(d).filter(r=>{const old=original(d).filter(x=>ProjectSchedule.matches(x,r));return Number(r.hours)!==old.reduce((n,x)=>n+Number(x.hours),0)||Number(r.hours)>0&&old.some(x=>(x.activity||'')!==r.activity||(x.description||'')!==r.description);}).map(r=>({projectId:r.projectId,role:r.role,workItemId:r.workItemId,activity:r.activity,description:r.description,date:d,hours:Number(r.hours)}));
        if(!changes.length){closeDialog(true);return;}const pending=ProjectSchedule.weekData(ctx()).pending;if(changes.some(c=>pending.some(x=>ProjectSchedule.matches(x,c)&&x.date===d)))throw Error('该事项有未保存的表格修改，请先保存或撤销后补记');
        persist(M.saveWeekTimes(state,pid,changes,revision));closeDialog(true);render();toast('工时已保存');
      };
    }
    openDialog('单日补记','',null);draw(date);
  }
  function editTime(id=null,date=null){const row=state.times.find(r=>r.id===id);openDay(row?.date||date||filters.date);}
  function timeBatch(mode='batch'){
    if(role==='manager')throw Error('当前管理身份仅可查看日程');
    const members=state.members.filter(m=>m.personId===personId),start=todayInMonth(),revision=state.revision;
    openDialog(mode==='copy-week'?'复制某周实际工时':mode==='copy-day'?'复制某天实际工时':'跨日批量填报',`<form><div class="form-grid">${mode==='batch'?fieldSelect('项目','projectId',members.map(m=>({id:m.projectId,name:pName(m.projectId)})),members[0]?.projectId):inputField(mode==='copy-week'?'来源周内任一天':'来源日期','source',start,'date')}${inputField(mode==='batch'?'开始日期':'目标开始日期','startDate',start,'date')}${mode==='copy-day'?'':inputField(mode==='copy-week'?'目标周结束（复制最多7天）':'结束日期','endDate',start,'date')}${mode==='batch'?inputField('每日工时','hours','4','number','step="0.5" min="0.5" max="8"'):''}</div><div class="notice info" style="margin-top:16px">仅填报已实际发生的投入。系统自动跳过非工作日；保存前展示明细供核对，确认后直接计入核算。</div>${formActions('预览并核对')}</form>`,()=>{
      const v=values(),rows=[];let begin=v.startDate,end=v.endDate||v.startDate;if(begin>end)throw Error('结束日期不能早于开始日期');
      const dates=dateRange(begin,end);if(dates.length>31)throw Error('一次最多安排31天');
      if(mode==='batch')for(const date of dates){const member=members.find(m=>m.projectId===v.projectId);rows.push({personId,projectId:v.projectId,role:member.role,date,hours:Number(v.hours),description:'批量填报',status:'submitted'});}
      else{
        const sourceDates=mode==='copy-week'?weekDates(v.source):[v.source],source=state.times.filter(t=>t.personId===personId&&sourceDates.includes(t.date));
        if(!source.length)throw Error('来源日期没有可复制工时');
        const delta=Math.round((new Date(begin+'T12:00:00')-new Date(sourceDates[0]+'T12:00:00'))/86400000);
        for(const t of source){const date=addDays(t.date,delta);if(mode==='copy-day'||date<=end)rows.push({...t,id:undefined,date,status:'submitted'});}
        if(!rows.length)throw Error('所选目标范围没有对应的来源记录');
      }
      const actual=rows.filter(r=>state.calendar[r.date.slice(0,7)]?.days.includes(r.date));if(!actual.length)throw Error('目标日期没有可填报的工作日');
      const validation=M.validateTimes(state,actual);if(validation.errors.length)throw Error(validation.errors.join('；'));
      formDirty=false;openDialog('核对实际工时',`<p class="rule-text">共 ${actual.length} 条，${actual.reduce((n,r)=>n+r.hours,0)} 小时。请确认下列投入均实际发生，保存后直接计入核算。</p>${table(['日期','项目','工时'],actual.map(r=>[esc(r.date),esc(pName(r.projectId)),r.hours+'h']))}<div class="form-actions">${button('取消','dialog-close')}${button('确认实际工时并保存','dialog-save','','primary')}</div>`,()=>{persist(M.submitTimes(state,actual,revision));closeDialog(true);render();toast('已保存 '+actual.length+' 条实际工时');},true);
    });
  }
  const iso=d=>`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
  function addDays(date,n){const d=new Date(date+'T12:00:00');d.setDate(d.getDate()+n);return iso(d);}
  function dateRange(start,end){const rows=[];for(let d=start;d<=end&&rows.length<33;d=addDays(d,1))rows.push(d);return rows;}
  function weekDates(date){const d=new Date(date+'T12:00:00'),offset=(d.getDay()+6)%7;return dateRange(addDays(date,-offset),addDays(date,6-offset));}
  function showSources(kind,id,sourceMonth=null){
    if(employee())throw Error('当前身份不能查看核算明细');
    const cumulative=!sourceMonth&&filters.periodMode==='cumulative'&&['person-analysis','project-analysis'].includes(currentTab()?.nav);
    const periods=cumulative?state.months.filter(m=>m<=month):[sourceMonth||month];
    const results=periods.map(period=>kind==='person'?M.personResult(state,id,period):M.projectResult(state,id,period));
    const result=results.reduce((a,r)=>{for(const k of ['income','totalCost','tax','net'])a[k]+=r[k];return a;},{income:0,totalCost:0,tax:0,net:0});
    const missing=[...new Set(results.flatMap(r=>(r.missing||[]).filter(v=>!v.includes('无法测算'))))];
    openDialog((kind==='person'?uName(id):pName(id))+' · 核算来源',`<div class="notice info">${esc(periods.join('、'))} · ${cumulative?'累计来源':'当月来源'} · 金额来自同一份底账，已结月份按快照展示。</div><div class="metrics">${card('交付收入',money(result.income),'元')}${card('总成本',money(result.totalCost),'元')}${card('所得税',money(result.tax),'元')}${card('净利润',money(result.net),'元',result.net<0?'negative':'positive')}</div>${missing.length?'<div class="notice">数据不完整：'+missing.map(esc).join('；')+'</div>':''}<div>${results.flatMap(r=>[...(r.sources||[]),...(kind==='person'?[{id:'derived-business-tax-'+r.month,month:r.month,label:'税费＝个人交付金额 × 3.3%',amount:r.costs.tax},{id:'derived-management-'+r.month,month:r.month,label:'管理费＝个人交付金额 × 20%',amount:r.costs.management}]:[]),{id:'derived-income-tax-'+r.month,month:r.month,label:kind==='person'?'个人所得税：当月税前利润 × 15%（亏损为0）':'项目所得税：累计税额减前月累计税额',amount:r.tax}]).map(s=>`<div class="source-line"><div><b>${esc(s.label||s.kind)}</b><small>${esc(s.month)} · ${esc(s.id)}${s.personId?' · '+esc(uName(s.personId)):''}${s.projectId?' · '+esc(pName(s.projectId)):''}</small><small>${esc(s.detail||'')}</small></div><strong>${['times','historicalTimes'].includes(s.kind)?'—':money(s.amount)}</strong></div>`).join('')||U.empty('暂无来源明细')}</div><p class="rule-text">个人盈亏平衡点＝（固定人工＋提成＋奖金）÷［1－（税费＋管理费）÷当月交付金额］。项目工资分摊为派生结果，不再次新增原始成本。</p>`,null,true,'核算分析 · 来源追溯');
  }
  function correctAmount(collection,id){
    requireFinance();const row=state[collection]?.find(r=>r.id===id);if(!row)throw Error('记录不存在');const revision=state.revision;
    openDialog('核算金额纠错',`<form><div class="notice info">${esc(row.month)} · ${esc(row.id)} · ${esc(row.personId?uName(row.personId):pName(row.projectId))}。保留原值、新值、原因及版本记录。</div><div class="form-grid">${inputField('原金额（元）','oldAmount',row.amount,'number','readonly')}${inputField('新金额（元）','amount',row.amount,'number','min="0" step="0.01" required')}<label class="field wide">修改原因<textarea name="reason" required placeholder="请填写纠错依据"></textarea></label></div>${formActions('保存纠错')}</form>`,()=>{const v=values();requireFinance();persist(M.correctAmount(state,collection,id,Number(v.amount),v.reason,revision));closeDialog(true);render();toast('纠错已保存并记录修订版本');});
  }
  const typeNames={salary:'月固定人工成本',commission:'项目人员提成',bonus:'人员月度奖金',exception:'项目异常费用',fixed:'项目固定成本分摊'};
  const TEMPLATE_KEY=KEY+'-excel-templates';
  function templateRecords(){
    const records=JSON.parse(localStorage.getItem(TEMPLATE_KEY)||'[]');
    if(!Array.isArray(records))throw Error('模板生成记录格式不正确，请重新生成模板');
    return records;
  }
  function downloadExcel(file){
    const url=URL.createObjectURL(new Blob([file.buffer],{type:'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'}));
    const a=document.createElement('a');a.href=url;a.download=file.filename;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
  }
  const chatSession={messages:[],pending:null,busy:false};
  function chatMessage(text,extra={}){chatSession.messages.push({text,...extra});drawChat();}
  function chatDirty(){formDirty=!!(body.querySelector('#lobster-input')?.value||body.querySelector('#excel-file')?.files.length||chatSession.pending);publish();}
  function drawChat(){
    const history=body.querySelector('#lobster-history');if(!history)return;
    history.innerHTML=chatSession.messages.map((m,i)=>`<div class="chat-message ${m.user?'user':''}"><span class="chat-icon">${m.user?'我':'虾'}</span><div class="chat-bubble"><div class="chat-text">${esc(m.text)}</div>${m.file?`<div class="excel-attachment"><span class="excel-file-icon">X</span><div><strong>${esc(m.file.filename)}</strong><small>人员固定成本＋项目核算数据 · 两个 Sheet</small></div>${button('下载附件','chat-download',`data-message="${i}"`,'link')}</div>`:''}${m.detail||''}</div></div>`).join('');
    history.scrollTop=history.scrollHeight;
    body.querySelector('[data-action="chat-send"]').disabled=chatSession.busy;
    body.querySelector('#lobster-input').disabled=chatSession.busy;body.querySelector('#excel-file').disabled=chatSession.busy;
    chatDirty();
  }
  async function analysisTemplate(period=month){
    requireFinance();const basis=state,attachment=await ProjectExcel.createTemplate(basis,period,crypto.randomUUID());requireFinance();if(state!==basis)throw Error('数据版本已变化，请重新索取模板');
    const records=templateRecords().filter(m=>m.revision===basis.revision&&m.stamp===attachment.manifest.stamp);records.push(attachment.manifest);localStorage.setItem(TEMPLATE_KEY,JSON.stringify(records.slice(-30)));return attachment;
  }
  async function analysisImportPreview(file){
    requireFinance();const basis=state;if(!/\.xlsx$/i.test(file.name))throw Error('请选择 .xlsx 格式的核算模板');if(file.size>5*1024*1024)throw Error('Excel文件须小于5MB');const result=await ProjectExcel.readTemplate(await file.arrayBuffer(),basis,templateRecords());requireFinance();if(state!==basis)throw Error('数据版本已变化，请重新发送文件');return ProjectExcel.previewWorkbook(state,result,file.name);
  }
  function analysisImportConfirm(preview){requireFinance();const next=ProjectExcel.applyWorkbook(state,preview);persist(next);render();return next.revision;}
  function lobster(){
    requireFinance();
    openDialog('小龙虾 · 核算助手',`<div class="lobster-chat"><p class="chat-caption">对话演示 · 文件在当前浏览器处理 · 支持 2026-09 至 2026-11</p><div id="lobster-history" class="chat" role="log" aria-live="polite"></div><div class="chat-composer"><textarea id="lobster-input" aria-label="发送给龙虾的消息" placeholder="例如：录入2026年11月核算数据；上传后回复“确认导入”"></textarea><div class="chat-composer-actions"><label class="chat-file-picker">选择文件<input id="excel-file" type="file" aria-label="选择发送文件" accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"></label>${button('发送','chat-send','','primary')}</div></div></div>`,null,true,'AI ASSISTANT · 纯对话');
    if(!body.querySelector('#lobster-history'))return;
    if(!chatSession.messages.length)chatSession.messages.push({text:'你好，请告诉我需要录入哪个月份的核算数据。我会直接回复包含全部五类数据的 Excel 附件，共两个 Sheet：人员固定成本（固定人工、奖金）和项目核算数据（提成、异常费用、固定成本分摊）。填好后在这里选择文件并发送。'});
    drawChat();
    body.querySelector('[data-action="chat-send"]').onclick=()=>guard(sendChat);
    body.querySelector('#lobster-input').onkeydown=e=>{if(e.key==='Enter'&&(e.ctrlKey||e.metaKey)){e.preventDefault();guard(sendChat);}};
    body.querySelector('#lobster-history').onclick=e=>{const b=e.target.closest('[data-action="chat-download"]');if(b)guard(()=>{requireFinance();downloadExcel(chatSession.messages[Number(b.dataset.message)].file);});};
  }
  async function sendChat(){
    requireFinance();if(chatSession.busy)return;
    const composer=body.querySelector('#lobster-input'),input=body.querySelector('#excel-file'),text=composer.value.trim(),file=input.files[0];
    if(!text&&!file)return;
    const sequence=dialogSequence,basis=state,alive=()=>dialog.open&&sequence===dialogSequence&&!!body.querySelector('#lobster-history');
    composer.value='';input.value='';chatSession.busy=true;
    chatMessage([text,file?'附件：'+file.name:''].filter(Boolean).join('\n'),{user:true});
    try{
      if(file){
        chatSession.pending=null;
        if(!/\.xlsx$/i.test(file.name))throw Error('请上传 .xlsx 格式的 Excel 文件');
        if(file.size>5*1024*1024)throw Error('Excel 文件须小于 5 MB');
        const result=await ProjectExcel.readTemplate(await file.arrayBuffer(),basis,templateRecords());
        if(!alive())return;requireFinance();if(state!==basis)throw Error('数据版本已变化，请重新发送 Excel');
        const p=ProjectExcel.previewWorkbook(state,result,file.name);chatSession.pending=p;
        const rows=p.groups.flatMap(g=>g.rows.filter(r=>r.kind!=='skip').map(r=>[esc(typeNames[g.type]),esc([r.personId?uName(r.personId):'',r.projectId?pName(r.projectId):''].filter(Boolean).join(' / ')),r.oldValue==null?'无记录':money(r.oldValue),money(r.newValue),esc(r.error||'待确认')]));
        chatMessage(`${file.name} 已校验，期间 ${p.month}，共 ${rows.length} 条填写金额，涉及 ${p.groups.filter(g=>g.rows.some(r=>r.kind!=='skip')).length} 类数据。${p.errors.length?'存在异常：'+p.errors.join('；'):'尚未写入，请回复“确认导入”或“取消”。空白金额保持不变，0覆盖为0。'}`,{detail:`<details class="chat-diff"><summary>查看导入差异</summary>${table(['类型','人员 / 项目','原金额','新金额','处理'],rows)}</details>`});
      }else if(/^(确认导入|确认|确认写入)[。！!\s]*$/.test(text)){
        if(!chatSession.pending)throw Error('当前没有待确认的 Excel，请先选择填写后的文件并发送');
        const p=chatSession.pending,next=ProjectExcel.applyWorkbook(state,p);persist(next);chatSession.pending=null;render();
        chatMessage('导入成功，'+p.sourceFile+' 已一次性写入。'+p.groups.filter(g=>g.rows.some(r=>r.kind!=='skip')).map(g=>typeNames[g.type]+' '+g.rows.filter(r=>r.kind!=='skip').length+' 条').join('；')+'。文件来源和批次已记录，项目分析及项目人效分析已同步更新。');
      }else if(/^(取消|取消导入)[。！!\s]*$/.test(text)){
        chatSession.pending=null;chatMessage('已取消待确认导入，核算数据未改变。');
      }else if(/模板|录入|导入|核算|成本|奖金|提成|excel/i.test(text)){
        chatSession.pending=null;
        const dated=text.match(/(20\d{2})\s*(?:年|[-/])\s*(\d{1,2})/),short=text.match(/(\d{1,2})\s*月/);
        const period=dated?dated[1]+'-'+dated[2].padStart(2,'0'):short?month.slice(0,4)+'-'+short[1].padStart(2,'0'):month;
        const attachment=await ProjectExcel.createTemplate(basis,period,crypto.randomUUID());
        if(!alive())return;requireFinance();if(state!==basis)throw Error('数据版本已变化，请重新索取模板');
        try{const records=templateRecords().filter(m=>m.revision===basis.revision&&m.stamp===attachment.manifest.stamp);records.push(attachment.manifest);localStorage.setItem(TEMPLATE_KEY,JSON.stringify(records.slice(-30)));}catch(error){throw Error('无法保存模板生成记录：'+error.message);}
        chatMessage(`这是 ${period} 的核算 Excel，包含全部五类数据。只填写两个 Sheet 的黄色金额列，保存后选择文件发送；人员奖金仅计个人成本。`,{file:attachment});
      }else chatMessage('可以输入“录入2026年11月核算数据”索取 Excel，或选择填写后的 .xlsx 文件发送。上传校验后回复“确认导入”或“取消”。本 Demo 使用预设对话规则。');
    }catch(error){if(alive())chatMessage(error.message+'。请调整后重试。');}
    finally{if(alive()){chatSession.busy=false;drawChat();composer.focus();}}
  }
  function showBatch(id){
    const b=state.batches.find(b=>b.id===id);if(!b)throw Error('批次不存在');
    openDialog('导入批次详情',`<div class="notice success">批次已写入 · ${esc(b.id)}</div><div class="detail-info"><div><label>数据类型</label>${esc(typeNames[b.type]||b.type)}</div><div><label>所属月份</label>${esc(b.month)}</div><div><label>版本</label>${esc(b.revision||'—')}</div><div><label>来源</label>${esc(b.sourceFile||'小龙虾模拟文件')}</div></div>${table(['人员 / 项目','处理','原值','新值'],(b.rows||[]).map(r=>[esc([r.personId?uName(r.personId):'',r.projectId?pName(r.projectId):''].filter(Boolean).join(' / ')),esc(r.kind||'已写入'),money(r.oldValue),money(r.newValue)]))}<p class="rule-text">相同预览重试幂等，已结月份不可直接覆盖。导入记录可用于追溯，生产文件接收服务仍待联调。</p>`,null,true,'财务工作台 · 导入记录');
  }
  function trial(){
    if(employee())throw Error('没有核算权限');const results=state.projects.map(p=>M.projectResult(state,p.id,month)),people=state.people.map(p=>M.personResult(state,p.id,month));
    const missing=M.monthMissing(state,month);
    openDialog(month+' · 核算试算',`<div class="notice ${missing.length?'':'success'}">${missing.length?'发现未完整数据，补齐后才能月结。':'完整性检查通过，可以月结。数据由同一核算程序生成。'}</div>${missing.length?`<ul class="rule-text">${missing.map(m=>'<li>'+esc(m)+'</li>').join('')}</ul>`:''}${table(['项目','交付收入','总成本','所得税','净利润'],results.map(r=>[esc(pName(r.projectId||r.id)),money(r.income),money(r.totalCost),money(r.tax),money(r.net)]))}<div class="form-actions">${button('关闭','dialog-close')}${role==='finance'?button('确认月结','close-month',missing.length||state.closed[month]?'disabled':'','primary'):''}</div>`,null,true,'财务工作台 · 完整性检查');
  }
  function monthClose(){requireFinance();if(!confirm(`确认月结 ${month}？将保存输入和结果快照，并锁定本月数据。`))return;mutate(s=>M.closeMonth(s,month),month+' 已月结，数据已锁定');if(dialog.open)closeDialog(true);}
  function monthReopen(){requireFinance();const revision=state.revision;openDialog(month+' · 反结账',`<form><div class="notice">反结账后可修改本月数据并重新核算。存在更晚已结月份时，须先从后往前反结账，避免覆盖后续快照。</div><label class="field">反结账原因<textarea name="reason" required placeholder="说明调整依据及影响"></textarea></label>${formActions('确认反结账')}</form>`,()=>{requireFinance();persist(M.reopenMonth(state,month,values().reason,revision));closeDialog(true);render();toast('已反结账，请调整后重新试算并月结');});}
  function exportAnalysis(){
    if(employee())throw Error('当前身份不能导出核算数据');
    const d=ProjectManagementInsights.data(ctx()),kind=d.project?'project':'person';
    const rows=[['类型','名称',d.project?'项目团队':'筛选角色','月份','交付收入','总成本','税前利润','所得税','净利润','净利率','盈亏平衡（个人按所选当月）','完整性']];
    for(const r of d.rows){const pretax=M.round(r.selected.reduce((n,x)=>n+x.pretax,0)),breakEven=d.project&&d.cumulative?r.now.cumulative.breakEven:r.now.breakEven;
      rows.push([d.project?'项目':'人员',r.entity.name,d.project?d.teamOf(r.entity):d.selectedRole==='all'?'全部角色':d.selectedRole,d.cumulative?'累计至'+month:month,r.income,r.cost,pretax,r.tax,r.net,r.margin??'无法测算',breakEven??'无法测算',r.missing.join('；')||'完整']);
    }
    const csv='\ufeff'+rows.map(row=>row.map(v=>'"'+String(v??'').replace(/"/g,'""')+'"').join(',')).join('\r\n');const url=URL.createObjectURL(new Blob([csv],{type:'text/csv;charset=utf-8'})),a=document.createElement('a');a.href=url;a.download=(d.project?'项目分析':'项目人效分析')+'_'+month+'.csv';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);toast('已导出当前筛选范围的核算数据');
  }
  function showManagerAlerts(level='all'){const result=ProjectManagementInsights.alertDialog(ctx(),level);openDialog(result.title,result.html,null,true,'管理驾驶舱 · 预警与行动');}
  function showError(error){const el=document.getElementById('form-error'),weekError=content.querySelector('#week-error');if(dialog.open&&el){el.textContent=error.message;el.hidden=false;}else if(!dialog.open&&weekError){weekError.textContent=error.message;weekError.hidden=false;}else toast(error.message,true);}
  function guard(fn){try{const value=fn();if(value?.catch)value.catch(showError);}catch(error){showError(error);}}
  document.addEventListener('click',event=>{
    const target=event.target.closest('[data-action]');if(!target||target.disabled)return;
    event.preventDefault();const a=target.dataset.action;
    guard(()=>{
      if(a==='navigate')navigate(target.dataset.page);
      if(a==='activate')activate(target.dataset.key);
      if(a==='dialog-close')closeDialog();
      if(a==='dialog-save'){if(!dialogSave)return;const form=body.querySelector('form');if(form?.elements.mode){form.elements.hours.required=form.elements.mode.value!=='time';}if(form&&!form.reportValidity())return;return dialogSave();}
      if(a==='project-detail')showProject(target.dataset.id);
      if(a==='project-section'){currentTab().section=target.dataset.section;render();}
      if(a==='delivery-edit-member')editMember(target.dataset.id,target.dataset.person);
      if(a==='delivery-edit-cost')editProjectCosts(target.dataset.id);
      if(a==='delivery-search'){collectDeliverySearch();render();}
      if(a==='delivery-reset'){Object.assign(deliveryFilters,{status:'all',searchBy:'项目编号',query:'',start:'2026-05-10',end:'2026-11-09',range:'近半年',type:'',mark:'',team:'',owner:'',company:'',companyText:'',minAmount:'',maxAmount:''});render();}
      if(a==='delivery-expand'){collectDeliverySearch();deliveryFilters.expanded=!deliveryFilters.expanded;render();}
      if(a==='delivery-status'){collectDeliverySearch();deliveryFilters.status=target.dataset.status;render();}
      if(a==='delivery-range'){collectDeliverySearch();const days={'今天':0,'昨天':1,'近7天':6,'近30天':29,'近半年':183,'近1年':365},end='2026-11-09';deliveryFilters.start=addDays(end,-days[target.dataset.range]);deliveryFilters.end=target.dataset.range==='昨天'?addDays(end,-1):end;deliveryFilters.range=target.dataset.range;render();}
      if(a==='delivery-refresh')render();
      if(a==='delivery-new')addDeliveryProject();
      if(a==='delivery-export')exportDelivery();
      if(a==='delivery-pick')pickDelivery(target.dataset.section);
      if(a==='delivery-add-member')addDeliveryMember();
      if(a==='delivery-more'){openDialog('项目操作',`<div class="actions">${button('项目成员','delivery-open-section',`data-id="${target.dataset.id}" data-section="项目成员"`)}${button('项目计划','delivery-open-section',`data-id="${target.dataset.id}" data-section="项目计划"`)}${button('项目交付','delivery-open-section',`data-id="${target.dataset.id}" data-section="项目交付"`)}</div>`);}
      if(a==='delivery-open-section')showProject(target.dataset.id,month,target.dataset.section);
      if(a==='delivery-columns')openDialog('列表显示设置','<p class="rule-text">当前展示项目编号、订单编号、项目名称、所属团队及负责人、公司名称、标记、风险、项目类型、业务类型和金额。可横向滚动查看完整信息，操作列固定在右侧。</p>');
      if(a==='delivery-team')toast('当前费用承担团队：开发团队');
      if(a==='consultant-search'){Object.assign(filters,Object.fromEntries(new FormData(content.querySelector('#consultant-search'))));render();}
      if(a==='consultant-reset'){Object.assign(filters,{consultantQuery:'',consultantRole:'all',consultantStatus:'all'});render();}
      if(a==='consultant-new')editConsultant();
      if(a==='consultant-edit')editConsultant(target.dataset.id);
      if(a==='consultant-detail'){const result=ProjectConsultants.detail(state,target.dataset.id);openDialog(result.title,result.html,null,true,'师资与教练管理 · 咨询师档案');}
      if(a==='consultant-analysis'){if(dialog.open&&!closeDialog())return;filters.analysisPerson=target.dataset.id;filters.analysisRole=state.members.some(x=>x.personId===target.dataset.id&&x.role==='咨询师')?'咨询师':'all';filters.personManagerView='overview';navigate('person-analysis');}
      if(a==='week-save')saveWeek();
      if(a==='schedule-project-pin')toggleSchedulePin(target.dataset.project);
      if(a==='mobile-date'){filters.mobileDate=target.dataset.date;if(filters.scheduleView==='month')filters.mobileCalendarOpen=false;render();}
      if(a==='mobile-add-row')addMobileRow();
      if(a==='mobile-remove-row')removeMobileRow(target.dataset.row);
      if(a==='mobile-calendar-toggle'){filters.mobileCalendarOpen=true;render();}
      if(a==='mobile-activity'){if(role==='manager')throw Error('当前身份仅可查看');setEntryMeta(target.dataset.key,'activity',target.dataset.value);}
      if(a==='mobile-hour-step'||a==='mobile-hour-set'){
        if(role==='manager')throw Error('当前身份仅可查看');const input=[...content.querySelectorAll('[data-week-cell]')].find(el=>el.dataset.weekCell===target.dataset.key);if(input&&!input.disabled){const value=a==='mobile-hour-set'?Number(target.dataset.hours):Math.min(8,Math.max(0,Number(input.value||0)+Number(target.dataset.delta)));input.value=value||'';setWeekCell(target.dataset.key,input.value);content.querySelector('#week-error').hidden=true;refreshWeek();}
      }
      if(a==='mobile-clear'){if(role==='manager')throw Error('当前身份仅可查看');setWeekCell(target.dataset.key,'');weekInput().meta[target.dataset.key]={activity:'',description:''};render();}
      if(a==='mobile-batch')openMobileBatch();
      if(a==='cell-add')addCellEntry(target.dataset.project,target.dataset.role,target.dataset.date);
      if(a==='week-step')applyFilter('date',addDays(filters.date,Number(target.dataset.step)));
      if(a==='week-current')applyFilter('date','2026-11-09');
      if(a==='week-copy')copyPreviousWeek();
      if(a==='week-revert'){const w=weekInput(),dates=ProjectSchedule.weekData(ctx()).dates;for(const key of Object.keys(w.values))if(dates.includes(JSON.parse(key)[2])){delete w.values[key];delete w.original[key];delete w.meta[key];}for(const key of Object.keys(w.slots))if(dates.includes(JSON.parse(key)[2]))delete w.slots[key];for(const date of dates)if(w.mobileRows)delete w.mobileRows[date];w.error='';render();}
      if(a==='week-to-day')openDay(ctx().mobile?ProjectScheduleMobile.selectedDate(ctx(),ProjectSchedule.weekData(ctx())):filters.date);
      if(a==='week-to-week'){filters.scheduleView='week';render();}
      if(a==='fill-period'){filters.scheduleView=target.dataset.mode;filters.scheduleStats=target.dataset.mode;filters.mobileCalendarOpen=true;render();}
      if(a==='period-step'){const direction=Number(target.dataset.direction);if(filters.scheduleView==='month'){const index=state.months.indexOf(month)+direction;if(index<0||index>=state.months.length){toast('已到演示数据边界');return;}applyFilter('month',state.months[index]);}else applyFilter('date',addDays(filters.date,7*direction));}
      if(a==='week-add'){const el=content.querySelector('#week-add-project');if(el){const w=weekInput();if(!w.extra.includes(el.value))w.extra.push(el.value);render();}}
      if(a==='time-new')editTime(null,target.dataset.date);
      if(a==='time-edit')editTime(target.dataset.id);
      if(a==='time-delete'){if(role==='manager')throw Error('当前管理身份仅可查看日程');if(!confirm('确认删除该工时记录？'))return;const row=state.times.find(t=>t.id===target.dataset.id);if(employee()&&row.personId!==personId)throw Error('只能维护本人记录');const next=M.deleteTime(state,target.dataset.id);persist(next);render();toast('工时已删除');if(dialog.open)closeDialog(true);}
      if(a==='time-copy-day')timeBatch('copy-day');
      if(a==='time-copy-week')timeBatch('copy-week');
      if(a==='time-batch')timeBatch();
      if(a==='schedule-day'){filters.date=target.dataset.date;filters.scheduleView='day';render();}
      if(a==='mobile-toggle'){mobile=!mobile;navigate('schedule');render();}
      if(a==='correct')correctAmount(target.dataset.collection,target.dataset.id);
      if(a==='lobster')lobster();
      if(a==='batch-detail')showBatch(target.dataset.id);
      if(a==='sources')showSources(target.dataset.kind,target.dataset.id,target.dataset.month);
      if(a==='trial')trial();
      if(a==='close-month')monthClose();
      if(a==='reopen-month')monthReopen();
      if(a==='manager-view'){const key=currentTab()?.nav==='project-analysis'?'projectManagerView':'personManagerView';filters[key]=target.dataset.view;render();}
      if(a==='manager-alerts')showManagerAlerts();
      if(a==='manager-diagnose'){const result=ProjectManagementInsights.diagnose(ctx(),target.dataset.id);openDialog(result.title,result.html,null,true,'管理驾驶舱 · 决策诊断');}
      if(a==='manager-rules'){const rules=content.querySelector('.manager-rules');if(rules){rules.open=true;rules.scrollIntoView({behavior:'smooth',block:'start'});}}
      if(a==='manager-detail-person'){if(dialog.open&&!closeDialog())return;filters.analysisPerson=target.dataset.id;filters.personManagerView='efficiency';render();}
      if(a==='export-analysis')exportAnalysis();
      if(a==='reset'){if(!confirm('重置仅影响本次项目管理优化 Demo 的本地数据，确定恢复示例吗？'))return;try{localStorage.removeItem(KEY);localStorage.removeItem(PIN_KEY);localStorage.removeItem(TEMPLATE_KEY);chatSession.messages=[];chatSession.pending=null;weekInputs.clear();lastRaw=null;persist(M.seed());if(dialog.open)closeDialog(true);render();toast('已恢复虚构示例数据');}catch(e){throw Error('重置失败：'+e.message);}}
    });
  });
  function applyFilter(key,value){
    if(key==='date'&&!value){render();return;}
    if(key==='month'&&!state.months.includes(value)){toast('示例支持 2026-09 至 2026-11',true);render();return;}
    if(key==='month'){month=value;if(!filters.date.startsWith(month))filters.date=state.calendar[month]?.days[0]||month+'-01';}
    else{filters[key]=value;if(key==='analysisRole')filters.analysisPerson='all';if(key==='analysisTeam')filters.analysisProject='all';if(key==='date'&&value){month=value.slice(0,7);if(!state.months.includes(month)){toast('示例支持 2026-09 至 2026-11，请选择该范围日期',true);month='2026-11';filters.date='2026-11-09';}}}
    render();
  }
  document.addEventListener('change',event=>{
    const el=event.target;if(el.matches('[data-mobile-project]'))guard(()=>selectMobileProject(el.dataset.mobileProject,el.value));if(el.matches('[data-cell-activity]'))setEntryMeta(el.dataset.cellActivity,'activity',el.value);if(el.matches('[data-manager-alert-level]'))guard(()=>showManagerAlerts(el.value));if(el.dataset.filter)guard(()=>applyFilter(el.dataset.filter,el.value));
    if(el.id==='delivery-member-month'){currentTab().period=el.value;render();}
    if(el.dataset.projectMeta)guard(()=>{requireFinance();const next=structuredClone(state),p=next.projects.find(p=>p.id===el.dataset.id);p[el.dataset.projectMeta]=el.value;next.revision++;persist(next);toast('项目标记已保存');});
    if(el.id==='demo-role'){if(dialog.open&&!closeDialog()){el.value=role;return;}role=el.value;if(employee()){tabs=tabs.filter(t=>t.nav==='schedule');active=tabs[0]?.key||null;navigate('schedule');}else render();}
    if(el.id==='demo-person'){if(dialog.open&&!closeDialog()){el.value=personId;return;}personId=el.value;render();}
  });
  document.addEventListener('click',event=>{const el=event.target.closest('button[data-filter]');if(el){event.preventDefault();guard(()=>applyFilter(el.dataset.filter,el.dataset.value));}});
  content.addEventListener('input',event=>{
    if(event.target.matches('[data-cell-description]')){setEntryMeta(event.target.dataset.cellDescription,'description',event.target.value);return;}
    if(event.target.matches('[data-week-cell]')){setWeekCell(event.target.dataset.weekCell,event.target.value);content.querySelector('#week-error').hidden=true;refreshWeek();return;}

  });
  content.addEventListener('keydown',event=>{
    if(!content.querySelector('.schedule-weekly'))return;
    if(event.key==='Enter'&&(event.ctrlKey||event.metaKey)){event.preventDefault();saveWeek();return;}
    if(event.key==='Enter'&&event.target.matches('[data-week-cell]')){event.preventDefault();const inputs=[...content.querySelectorAll('[data-week-cell]:not(:disabled)')],index=inputs.indexOf(event.target),next=inputs[index+(event.shiftKey?-1:1)];if(next){next.focus();next.select();}}
  });
  const markDirty=event=>{if(event.target.id==='settings-month'||event.target.matches('[data-manager-alert-level]'))return;if(body.querySelector('#lobster-history')){chatDirty();return;}formDirty=true;publish();};body.addEventListener('input',markDirty);body.addEventListener('change',markDirty);
  dialog.addEventListener('cancel',event=>{event.preventDefault();closeDialog();});
  window.addEventListener('beforeunload',event=>{if(formDirty||[...weekInputs.values()].some(c=>c.dirty)){event.preventDefault();event.returnValue='';}});
  window.addEventListener('storage',event=>{if(event.key===KEY&&event.newValue!==lastRaw){storageProblem='演示数据已在其他窗口变更，请刷新后继续，避免覆盖。';renderStorage();}});
  let marksConfigured=false;
  const marks=document.getElementById('project-marks');
  const markConfig={id:'project-optimization',versions:ERPProjectAnalysisMarks.versions,marks:ERPProjectAnalysisMarks.marks};
  window.ProjectIterationMarks=markConfig;
  marks.configure(markConfig,{root:content,toolbar:!ERPClient.hosted,storage:!ERPClient.hosted,configGlobal:'ProjectIterationMarks',documentBase:new URL('../../../',location.href).href,getPage:()=>content.dataset.erpPage,navigate:page=>navigate(page)});
  marksConfigured=true;
  if(ERPClient.hosted)ERPIterationBridge.renderer(marks,'project');
  ERPClient.connect({snapshot,navigate,activate,close});
  matchMedia('(max-width:760px)').addEventListener('change',()=>{if(currentTab()?.nav==='schedule'&&!dialog.open)render();});
  renderStorage();navigate('schedule');
})();



