(function(){
  'use strict';
  const M=window.ProjectModel,U=window.ProjectUI,{esc,money,percent,button,badge,table,card,options}=U;
  const KEY='erp-project-demo-v1',PIN_KEY='erp-project-schedule-pins-v1',labels={schedule:'我的项目日程',projects:'项目交付单',consultants:'咨询师列表','project-analysis':'项目分析','person-analysis':'项目人效分析'};
  const content=document.getElementById('content'),dialog=document.getElementById('dialog'),body=document.getElementById('dialog-body');
  const currentUserId='u1';
  let state,lastRaw=null,storageProblem='',tabs=[],active=null,role='finance',personId='u1',month='2026-11',mobile=new URLSearchParams(location.search).get('mobile')==='1'||!ERPClient.hosted&&innerWidth<500,mobileHome=new URLSearchParams(location.search).get('mobile')==='1',formDirty=false,dialogSave=null,preview=null,timer,dialogSequence=0;
  const filters={date:'2026-11-09',scheduleView:'week',project:'all',query:'',financeTab:'data',dataType:'salaries',analysisProject:'all',analysisPerson:'all',analysisRole:'咨询师',analysisTeam:'all',periodMode:'month',status:'all'};
  const weekInputs=new Map();
  try{
    lastRaw=localStorage.getItem(KEY);
    state=lastRaw?JSON.parse(lastRaw):M.seed();
    if(!state.projects||!state.people||!Number.isInteger(state.revision))throw Error('本地演示数据格式不正确，请重置示例');
  }catch(error){state=M.seed();storageProblem=error.message;}
  if(!storageProblem){
    const updated=ProjectDeliveryApplications.ensureExample(M.ensureScheduleExample(state));
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
  document.getElementById('standalone-nav').innerHTML=Object.entries(labels).map(([key,label])=>button(label,'navigate',`data-page="${key}"`)).join('')+button('移动端','mobile-entry');
  const toast=(message,error=false)=>{const el=document.getElementById('toast');clearTimeout(timer);el.textContent=message;el.classList.toggle('error',error);el.hidden=false;timer=setTimeout(()=>el.hidden=true,4500);};
  const employee=()=>role==='employee';
  const mobileSchedule=()=>currentTab()?.nav==='schedule'&&(mobile||matchMedia('(max-width:760px)').matches);
  const scheduleAdmin=()=>!employee()&&!mobileSchedule();
  const requireScheduleEdit=()=>{if(!scheduleAdmin()&&personId!==currentUserId)throw Error('项目成员只能维护本人的日程');if(currentTab()?.nav==='schedule'&&!weekInput().editing)throw Error('请先进入工时编辑状态');};
  const requireFinance=()=>{if(role!=='finance')throw Error('当前演示身份没有财务维护权限');};
  const pName=id=>state.projects.find(p=>p.id===id)?.name||id;
  const uName=id=>state.people.find(p=>p.id===id)?.name||id;
  const currentTab=()=>tabs.find(t=>t.key===active);
  let deliveryCreateDraft=null;
  const tabDirty=t=>(t.key===active&&formDirty)||(t.newProject&&deliveryCreateDraft?.dirty)||(t.nav==='schedule'&&[...weekInputs.values()].some(w=>w.dirty));
  const snapshot=()=>({active,tabs:tabs.map(t=>({...t,dirty:!!tabDirty(t)}))});
  function publish(){ERPClient.publish();document.getElementById('local-tabs').innerHTML=tabs.map(t=>`<button type="button" data-action="activate" data-key="${esc(t.key)}" class="${t.key===active?'current':''}">${esc(t.label)}${tabDirty(t)?' · 未保存':''}</button>`).join('');}
  function persist(next,recordSchedule=true){
      if(recordSchedule&&state&&next!==state&&active==='schedule'){
        const changes=ProjectScheduleAccess.changes(state,next,{id:scheduleAdmin()?'demo-admin':currentUserId,name:scheduleAdmin()?'管理员（演示）':state.people.find(p=>p.id===currentUserId)?.name||'本人',role:scheduleAdmin()?'admin':'self'});
        if(changes.length){ProjectScheduleAccess.assertDeadline(changes,scheduleAdmin());if(!scheduleAdmin()&&changes.some(row=>row.personId!==currentUserId))throw Error('项目成员只能维护本人的日程');next={...next,scheduleLogs:[...(state.scheduleLogs||[]),...changes]};}
      }
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
    dialog.classList.remove('delivery-application-dialog','schedule-mobile-confirm');dialog.classList.toggle('mobile-sheet',currentTab()?.nav==='schedule'&&ctx().mobile);dialog.classList.toggle('wide',wide);document.getElementById('dialog-title').textContent=title;document.getElementById('dialog-eyebrow').textContent=eyebrow;
    dialogSequence++;body.innerHTML=html;dialogSave=onSave;formDirty=false;dialog.showModal();publish();
  }
  const formActions=(save='保存',extra='')=>`<div id="form-error" class="form-error" role="alert" hidden></div><div class="form-actions">${extra}${button('取消','dialog-close')}${button(save,'dialog-save','','primary')}</div>`;
  const inputField=(label,name,value='',type='text',attrs='')=>`<label class="field">${esc(label)}<input name="${name}" type="${type}" value="${esc(value)}" ${attrs}></label>`;
  const fieldSelect=(label,name,rows,value)=>`<label class="field">${esc(label)}<select name="${name}">${options(rows,value)}</select></label>`;
  const values=()=>Object.fromEntries(new FormData(body.querySelector('form')));
  const todayInMonth=()=>filters.date?.startsWith(month)?filters.date:(state.calendar[month]?.days[0]||month+'-01');
  function navigate(page){
    if(page!=='schedule'&&!prepareScheduleLeave(()=>navigate(page)))return;
    if(!labels[page])page='schedule';
    if(employee()&&page!=='schedule'){toast('咨询师本人仅可使用自己的项目日程',true);return;}
    if(dialog.open&&!closeDialog())return;
    if(!tabs.some(t=>t.key===page))tabs.push({key:page,label:labels[page],nav:page});
    active=page;mobile=mobile&&page==='schedule';mobileHome=false;render();publish();
  }
  function activate(key){const tab=tabs.find(t=>t.key===key);if(!tab)return;if(key!==active&&!prepareScheduleLeave(()=>activate(key)))return;if(dialog.open&&!closeDialog())return;active=key;render();publish();}
  function close(key){
    if(key===active&&!prepareScheduleLeave(()=>close(key)))return false;
    if(key===active&&dialog.open&&!closeDialog())return;
    if(tabs.find(t=>t.key===key)?.newProject){if(deliveryCreateDraft?.dirty&&!confirm('新增项目尚未保存，确定放弃吗？'))return false;deliveryCreateDraft=null;}
    const index=tabs.findIndex(t=>t.key===key);tabs=tabs.filter(t=>t.key!==key);
    if(active===key)active=tabs[Math.max(0,index-1)]?.key||null;render();publish();return true;
  }
  const ctx=()=>({state,month,personId,role,scheduleAdmin:scheduleAdmin(),scheduleDateLock:date=>ProjectScheduleAccess.deadlineReason(date,scheduleAdmin()),currentUserId,scheduleCanEdit:scheduleAdmin()||personId===currentUserId,scheduleEditing:currentTab()?.nav==='schedule'&&!!weekInput().editing,page:currentTab()?.nav||'schedule',filters,esc,money,percent,schedulePins:readSchedulePins()[personId]||[],mobile:mobile||matchMedia('(max-width:760px)').matches,weekEditor:currentTab()?.nav==='schedule'?weekInput():null});
  function heading(eyebrow,title,description,actions=''){return `<header class="page-heading"><div><span class="eyebrow">${esc(eyebrow)}</span><h1>${esc(title)}</h1><p>${esc(description)}</p></div><div class="heading-actions">${actions}</div></header>`;}
  function render(){
    const page=currentTab()?.nav;if(page==='schedule'&&!scheduleAdmin()){personId=currentUserId;}
    document.body.classList.toggle('mobile-mode',(mobile||matchMedia('(max-width:760px)').matches)&&currentTab()?.nav==='schedule');document.body.classList.toggle('delivery-page',currentTab()?.nav==='projects');
    document.getElementById('demo-person').innerHTML=options(state.people,personId);
    document.getElementById('identity-wrap').hidden=employee()||page==='schedule';
    content.dataset.erpPage=page||'empty';
    if(!active)content.innerHTML=U.empty('从左侧菜单打开业务页面');
    else if(employee()&&page!=='schedule'&&!(page==='projects'&&currentTab()?.projectId&&state.members.some(m=>m.projectId===currentTab().projectId&&m.personId===currentUserId)))content.innerHTML=U.empty('当前身份没有该页面权限');
    else if(page==='schedule')content.innerHTML=mobileHome?ProjectMobileHome.render(ctx()):(ctx().mobile?'':ProjectScheduleAccess.controls(ctx()))+ProjectSchedule.render(ctx());
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
  function renderProjects(){return currentTab()?.newProject?(role==='finance'?ProjectDeliveryCreate.render(ctx(),deliveryCreateDraft):U.empty('当前身份没有新增项目权限')):currentTab()?.projectId?ProjectDelivery.detail(ctx(),currentTab()):ProjectDelivery.list(ctx(),deliveryFilters);}
  function showProject(id,selectedMonth=month,section='项目交付'){
    if(!prepareScheduleLeave(()=>showProject(id,selectedMonth,section)))return;
    if(employee()&&!state.members.some(m=>m.projectId===id&&m.personId===currentUserId))throw Error('只能查看本人参与的项目详情');
    if(!state.projects.some(p=>p.id===id))throw Error('项目不存在');
    if(dialog.open&&!closeDialog())return;
    const key='project-detail:'+id;let tab=tabs.find(t=>t.key===key);
    if(!tab){tab={key,label:'项目详情',nav:'projects',projectId:id,period:selectedMonth,section:section||'项目交付'};tabs.push(tab);}
    else{tab.period=selectedMonth;if(section)tab.section=section;}
    active=key;render();publish();
  }
  function projectExpenses(id,period){const exp=category=>state.expenses.find(x=>x.projectId===id&&x.month===period&&x.category===category)?.amount??0;return {accountManager:exp('accountManager'),yearBonus:exp('yearBonus')};}
  function applyDelivery(kind){
    requireFinance();const id=currentTab()?.projectId;if(!id)throw Error('请先选择项目');
    const revision=state.revision,A=ProjectDeliveryApplications;
    let readDraft;
    openDialog(kind+'申请',A.form(state,id,kind),()=>{
      requireFinance();persist(A.submit(state,id,kind,readDraft(),revision));closeDialog(true);currentTab().deliveryPage=1;render();toast('申请已提交送审，当前状态：审批中');
    },true,'');
    if(!body.querySelector('#delivery-application-form'))return;
    dialog.classList.add('delivery-application-dialog');dialog.scrollTop=0;
    readDraft=A.bind(body.querySelector('form'),state,id,()=>{formDirty=true;publish();});
  }
  function deliveryApplicationDetail(id){
    const row=ProjectDeliveryApplications.records(state,currentTab().projectId).find(r=>r.id===id);if(!row)throw Error('交付记录不存在');
    openDialog(row.kind+' · 审批详情',`<dl class="delivery-base">${[['交付审批单号',row.applicationNo],['交付状态',row.status],['申请时间',row.appliedAt],['完成时间',row.completedAt||'—'],['本次交付比例',row.ratio+'%'],['本次交付金额',money(row.amount)+'元'],['项目模块',(row.modules||[]).map(m=>m.name||m).join('、')||'—'],['备注说明',row.note||'—'],['交付团队',row.deliveryTeam||'—']].map(([k,v])=>`<div><dt>${esc(k)}</dt><dd>${esc(v)}</dd></div>`).join('')}</dl>${row.allocations?.length?`<section class="da-allocation"><h3>本次交付收入分配</h3>${ProjectDeliveryApplications.allocationTable(row.allocations)}</section>`:''}<h3>附件</h3><ul>${(row.attachments||[]).map(f=>`<li>${esc(f.name)}</li>`).join('')||'<li class="muted">暂无附件</li>'}</ul><div class="form-actions">${button('关闭','dialog-close')}</div>`,null,true,'项目交付');
  }
  function deliveryAllocationDetail(id){
    const row=ProjectDeliveryApplications.records(state,currentTab().projectId).find(r=>r.id===id);if(!row)throw Error('交付记录不存在');
    if(!row.allocations?.length)return;
    openDialog('项目人员收入分配',`<div class="delivery-allocation-summary"><span>交付审批单号：${esc(row.applicationNo)}</span><span>本次交付收入：<b>${money(row.amount)} 元</b></span></div>${row.allocations?.length?ProjectDeliveryApplications.allocationTable(row.allocations):'<div class="empty"><b>该交付记录尚未配置收入分配</b></div>'}<div class="form-actions">${button('关闭','dialog-close')}</div>`,null,true,'项目交付');
  }
  function deliveryApplicationNote(id){
    requireFinance();const projectId=currentTab().projectId,row=ProjectDeliveryApplications.records(state,projectId).find(r=>r.id===id),revision=state.revision;if(!row)throw Error('交付记录不存在');
    openDialog('备注说明',`<form><label class="field">备注说明<textarea name="note" required maxlength="500" placeholder="请输入备注说明">${esc(row.note||'')}</textarea></label>${formActions('保存')}</form>`,()=>{
      requireFinance();if(revision!==state.revision)throw Error('数据版本已变化');const note=values().note.trim();if(!note)throw Error('请填写备注说明');const next=structuredClone(state);next[row.collection].find(r=>r.id===id&&r.projectId===projectId).note=note;
      next.revision++;next.audit.push({action:'维护交付备注',at:new Date().toISOString(),revision:next.revision,detail:{projectId,deliveryId:id}});persist(next);closeDialog(true);render();toast('备注已保存');
    },false,'项目交付');
  }
  function editMember(id,pid){
    requireFinance();const period=currentTab().period||month,person=state.people.find(x=>x.id===pid),member=state.members.find(x=>x.personId===pid&&x.projectId===id),revision=state.revision;
    const roles=['项目总监','项目经理','咨询师','辅助交付人'];
    openDialog('变更项目成员',`<form><div class="form-grid">${inputField('姓名','personName',person.name,'text','readonly')}${fieldSelect('项目角色','memberRole',roles.map(x=>({id:x,name:x})),member.role)}</div>${formActions('保存')}</form>`,()=>{
      requireFinance();if(revision!==state.revision)throw Error('数据版本已变化');if(state.closed[period]||Object.keys(state.closed).some(m=>m>period))throw Error('已月结，不能变更成员');
      const v=values();if(!roles.includes(v.memberRole))throw Error('请选择有效项目角色');const next=structuredClone(state);next.members.find(x=>x.personId===pid&&x.projectId===id).role=v.memberRole;
      next.revision++;next.audit.push({action:'变更项目成员',at:new Date().toISOString(),revision:next.revision,detail:{projectId:id,personId:pid,role:v.memberRole}});persist(next);closeDialog(true);render();toast('项目成员已更新');
    });
  }
  function editProjectCosts(id){
    requireFinance();const period=currentTab().period||month,expenses=projectExpenses(id,period),revision=state.revision;
    openDialog('项目成本 · 预计费用',`<form><p class="rule-text">${esc(pName(id))} · ${period}</p><div class="form-grid">${inputField('大客户经理提成（元）','accountManager',expenses.accountManager,'number','min="0" step="0.01" required')}${inputField('项目年终奖分摊（元）','yearBonus',expenses.yearBonus,'number','min="0" step="0.01" required')}</div>${formActions('保存')}</form>`,()=>{requireFinance();const v=values(),ratios=state.members.filter(x=>x.projectId===id).map(x=>({personId:x.personId,ratio:state.ratios.find(r=>r.projectId===id&&r.personId===x.personId&&r.month===period)?.ratio??0}));persist(M.updateSettings(state,id,period,{ratios,expenses:{accountManager:Number(v.accountManager),yearBonus:Number(v.yearBonus)}},revision));closeDialog(true);render();toast('预计费用已保存');});
  }
  function collectDeliverySearch(){const form=content.querySelector('#delivery-search');if(form)Object.assign(deliveryFilters,Object.fromEntries(new FormData(form)));}
  function pickDelivery(section){openDialog(section,`<form>${fieldSelect('选择项目','projectId',state.projects,state.projects[0]?.id)}${formActions('打开'+section)}</form>`,()=>{const id=values().projectId;closeDialog(true);showProject(id,month,section);});}
  function addDeliveryProject(){
    requireFinance();if(dialog.open&&!closeDialog())return;
    const key='project-create';if(!tabs.some(t=>t.key===key))tabs.push({key,label:'新增项目',nav:'projects',newProject:true});
    if(!deliveryCreateDraft)deliveryCreateDraft=ProjectDeliveryCreate.create(state,month);
    active=key;render();content.scrollIntoView({block:'start'});
  }
  function saveDeliveryProject(){
    requireFinance();const form=content.querySelector('#delivery-create-form');if(!form||!form.reportValidity())return;
    ProjectDeliveryCreate.capture(form,deliveryCreateDraft);
    const result=ProjectDeliveryCreate.build(state,deliveryCreateDraft);persist(result.state);
    deliveryCreateDraft.dirty=false;close('project-create');showProject(result.id,result.period,'项目交付');toast('项目已新增');
  }
  function refreshDeliveryCreate(){
    const form=content.querySelector('#delivery-create-form');if(!form||!deliveryCreateDraft)return;
    form.querySelector('[data-create-note-count]').textContent=deliveryCreateDraft.fields.note.length+' / 500';
    form.querySelector('[data-create-teams]').innerHTML=deliveryCreateDraft.expenseTeams.map(team=>`<span class="dc-team-tag">${esc(team)}</span>`).join('');
  }
  function addDeliveryMember(){
    requireFinance();const tab=currentTab(),id=tab.projectId,period=tab.period||month,revision=state.revision,choices=state.people.filter(p=>!state.members.some(m=>m.projectId===id&&m.personId===p.id));
    if(!choices.length){toast('所有示例人员均已加入本项目');return;}
    const roles=['项目总监','项目经理','咨询师','辅助交付人'];
    openDialog('新增项目成员',`<form><div class="form-grid">${fieldSelect('姓名','personId',choices,choices[0].id)}${fieldSelect('角色','role',roles.map(x=>({id:x,name:x})),'咨询师')}</div>${formActions('保存成员')}</form>`,()=>{
      requireFinance();if(revision!==state.revision)throw Error('数据版本已变化');if(state.closed[period]||Object.keys(state.closed).some(m=>m>period))throw Error('已月结，不能新增成员');
      const v=values();if(!choices.some(p=>p.id===v.personId)||!roles.includes(v.role))throw Error('请选择有效成员和角色');const next=structuredClone(state);next.members.push({projectId:id,personId:v.personId,role:v.role});
      next.revision++;next.audit.push({action:'新增项目成员',at:new Date().toISOString(),revision:next.revision,detail:{projectId:id,personId:v.personId,role:v.role}});persist(next);closeDialog(true);render();toast('项目成员已新增');
    });
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
    openDialog(person?'编辑咨询师':'新增咨询师',`<form id="consultant-account-form"><div class="form-grid"><label class="field wide">关联 ERP 账号 <span class="required-mark">*</span><select id="consultant-account" name="accountId" required ${fixed?'disabled':''}>${accountChoices}</select>${fixed?`<input type="hidden" name="accountId" value="${esc(current.id)}">`:''}<small>预设 ERP 账号 · Demo。一个账号仅能关联一位咨询师。${fixed?'已有项目或核算记录，保留现有账号关联。':''}</small></label></div><section class="consultant-account-info"><div class="consultant-account-caption">ERP 账号信息 <span>选择账号后自动带出，不可手工修改</span></div><div class="form-grid">${autoField('姓名','name')}${autoField('工号','employeeNo')}${autoField('状态','status')}${autoField('所属部门','department')}${autoField('入职日期','joined')}${autoField('手机号','phone')}${autoField('邮箱','email')}${autoField('ERP登录账号','username')}</div></section><section class="consultant-pay-config"><h3>固定成本默认配置</h3><div class="form-grid"><label class="field">月固定工资（元） <span class="required-mark">*</span><input name="fixedSalary" type="number" min="0" step="0.01" required value="${esc(person?.fixedSalary??'')}" placeholder="必填，可填 0"></label><label class="field">月固定社保公积金（元） <span class="required-mark">*</span><input name="fixedBenefits" type="number" min="0" step="0.01" required value="${esc(person?.fixedBenefits??'')}" placeholder="必填，可填 0"></label></div><p class="rule-text">每月默认取此配置，单月调整在“月度固定成本”中维护。</p></section><div class="form-grid"><label class="field wide">专业方向<input name="expertise" value="${esc(person?.expertise||'')}" placeholder="例如：战略咨询、组织管理、数字化转型" maxlength="150"></label><label class="field wide">备注<textarea name="note" maxlength="500">${esc(person?.note||'')}</textarea></label></div><p class="rule-text">基础信息以 ERP 账号为准。</p>${formActions('保存档案')}</form>`,()=>{
      requireFinance();if(state.revision!==revision)throw Error('数据版本已变化，请重新打开档案');const v=values(),account=C.accounts.find(x=>x.id===v.accountId);if(!account)throw Error('请先关联 ERP 已有账号');if(usedBy(account))throw Error('该 ERP 账号已关联其他咨询师，不能重复新增');if(fixed&&account.id!==current.id)throw Error('已有业务记录，请保持原 ERP 账号关联');
      if([v.fixedSalary,v.fixedBenefits].some(value=>value===''||!Number.isFinite(Number(value))||Number(value)<0))throw Error('固定工资和社保公积金须为非负金额');
      const next=structuredClone(state),personIdToSave=id||'person-'+crypto.randomUUID(),profile={...person,...C.accountFields(account),id:personIdToSave,role:person?.role||'咨询师',fixedSalary:M.round(v.fixedSalary),fixedBenefits:M.round(v.fixedBenefits),expertise:v.expertise.trim(),note:v.note.trim()};delete profile.code;
      if(person)next.people[next.people.findIndex(x=>x.id===id)]=profile;else next.people.push(profile);
      next.revision++;next.audit.push({id:'audit-'+next.revision,action:person?'编辑咨询师档案':'关联ERP账号新增咨询师',detail:{personId:personIdToSave,accountId:account.id},revision:next.revision,at:new Date().toISOString()});persist(next);closeDialog(true);render();toast(person?'咨询师档案已按 ERP 账号资料更新':'已关联 ERP 账号并新增咨询师');
    },true,'师资与教练管理 · 关联 ERP 账号');
    const select=body.querySelector('#consultant-account');if(select)select.addEventListener('change',()=>{const account=C.accounts.find(x=>x.id===select.value);body.querySelectorAll('[data-account-field]').forEach(input=>{input.value=account?.[input.dataset.accountField]||'';});});
  }
  function editConsultantMonthlyPay(id){
    if(employee())throw Error('当前身份没有固定成本查看权限');
    const person=state.people.find(p=>p.id===id);if(!person)throw Error('咨询师不存在');
    const revision=state.revision,drafts=new Map(),canEdit=role==='finance';
    openDialog(person.name+' · 月度固定成本',ProjectConsultants.monthlyPay(state,id,canEdit,month.slice(0,4)),()=>{
      requireFinance();const changes=[];
      for(const [period,entry] of drafts){
        const pay=M.fixedPay(state,id,period);
        if(entry.salary===''&&entry.benefits===''&&!pay.known)continue;
        if(entry.salary===''||entry.benefits==='')throw Error('请填写 '+period+' 的固定工资和社保公积金');
        const salary=Number(entry.salary),benefits=Number(entry.benefits);
        if(salary!==pay.salary||benefits!==pay.benefits)changes.push({month:period,salary,benefits});
      }
      persist(M.saveMonthlyFixedPay(state,id,changes,revision));closeDialog(true);render();toast(changes.length?'月度固定成本已保存，核算已同步更新':'月度金额未变更');
    },true,'师资与教练管理 · 固定成本');
    const form=body.querySelector('#consultant-monthly-pay');if(!form)return;
    const refresh=period=>{const salary=form.elements.namedItem('salary-'+period),benefits=form.elements.namedItem('benefits-'+period);form.querySelector(`[data-pay-total="${period}"]`).textContent=salary.value===''||benefits.value===''?'待配置':money(M.round(Number(salary.value)+Number(benefits.value)));};
    form.addEventListener('input',event=>{const period=event.target.dataset.payMonth;if(period){drafts.set(period,{salary:form.elements.namedItem('salary-'+period).value,benefits:form.elements.namedItem('benefits-'+period).value});refresh(period);}});
    form.querySelector('#consultant-pay-year').addEventListener('change',event=>{
      form.querySelector('[data-pay-year-table]').innerHTML=ProjectConsultants.monthlyPayTable(state,id,canEdit,event.target.value);
      for(const [period,entry] of drafts){const salary=form.elements.namedItem('salary-'+period),benefits=form.elements.namedItem('benefits-'+period);if(salary&&benefits){salary.value=entry.salary;benefits.value=entry.benefits;refresh(period);}}
    });
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
  function showScheduleLogs(){
    const context=ctx(),target=scheduleAdmin()?personId:currentUserId,name=state.people.find(p=>p.id===target)?.name||'本人';
    let filter=ProjectScheduleAccess.defaultRange();
    openDialog(name+' · 日程操作日志',ProjectScheduleAccess.logs(context,filter),null,true,'项目管理 · 日程');
    function draw(){
      body.innerHTML=ProjectScheduleAccess.logs(context,filter);
      const root=body.querySelector('#schedule-logs');
      root.querySelector('[data-action="schedule-log-search"]').onclick=()=>{
        const start=root.querySelector('#schedule-log-start').value,end=root.querySelector('#schedule-log-end').value;
        if(start&&end&&start>end){const error=root.querySelector('#schedule-log-error');error.textContent='开始时间不能晚于结束时间';error.hidden=false;return;}
        filter={...filter,start,end,page:1};draw();
      };
      root.querySelector('[data-action="schedule-log-reset"]').onclick=()=>{filter=ProjectScheduleAccess.defaultRange();draw();};
      root.querySelector('#schedule-log-size').onchange=event=>{filter={...filter,size:Number(event.target.value),page:1};draw();};
      root.querySelectorAll('[data-action="schedule-log-page"]').forEach(button=>button.onclick=()=>{filter={...filter,page:Number(button.dataset.page)};draw();});
      const jump=()=>{const input=root.querySelector('#schedule-log-jump');if(!input.reportValidity())return;filter={...filter,page:Number(input.value)};draw();};
      root.querySelector('[data-action="schedule-log-jump"]').onclick=jump;
      root.querySelector('#schedule-log-jump').onkeydown=event=>{if(event.key==='Enter'){event.preventDefault();jump();}};
    }
    draw();
  }
  function switchSchedulePerson(value){
    if(value!==personId&&!prepareScheduleLeave(()=>switchSchedulePerson(value))){const select=content.querySelector('#schedule-access-person');if(select)select.value=personId;return;}
    if(!scheduleAdmin())throw Error('项目成员只能查看自己的日程');
    if(dialog.open&&!closeDialog())return;
    if(!state.people.some(p=>p.id===value))throw Error('人员不存在');
    personId=value;render();
  }
  function switchDemoRole(value){
    if(!prepareScheduleLeave(()=>switchDemoRole(value))){document.getElementById('demo-role').value=role;return;}
    if(dialog.open&&!closeDialog()){document.getElementById('demo-role').value=role;return;}
    role=value;document.getElementById('demo-role').value=role;
    if(employee()){personId=currentUserId;tabs=tabs.filter(t=>t.nav==='schedule');active=tabs[0]?.key||null;navigate('schedule');}else render();
  }
  function weekKey(){return (scheduleAdmin()?'admin:':'self:')+personId;}
  function weekInput(){const key=weekKey();if(!weekInputs.has(key))weekInputs.set(key,{values:{},original:{},extra:[],meta:{},slots:{},dirty:false,editing:false,error:''});const w=weekInputs.get(key);if(w.editing===undefined)w.editing=!!w.dirty;return w;}
  function beginScheduleEdit(){
    const w=weekInput();w.editing=true;requireScheduleEdit();filters.mobileScheduleTab='entry';render();
    content.querySelector('[data-week-cell]:not(:disabled)')?.focus({preventScroll:true});
  }
  function discardScheduleEdit(){
    const w=weekInput(),dates=ProjectSchedule.weekData(ctx()).dates;
    for(const map of [w.values,w.original,w.meta,w.slots])for(const key of Object.keys(map))if(dates.includes(JSON.parse(key)[2]))delete map[key];
    for(const date of dates)if(w.mobileRows)delete w.mobileRows[date];
    w.editing=false;w.error='';filters.mobileProjectPicker=null;render();
  }
  function prepareScheduleLeave(proceed){
    if(currentTab()?.nav!=='schedule'||mobileHome||!weekInput().editing)return true;
    const d=ProjectSchedule.weekData(ctx());
    if(!d.changes.length){discardScheduleEdit();return true;}
    openDialog('工时尚未保存',`<p class="schedule-leave-message">有 ${d.changes.length} 处修改尚未保存，离开前请先处理。</p><div class="schedule-leave-actions"><button type="button" class="btn" id="schedule-leave-stay">继续编辑</button><button type="button" class="btn" id="schedule-leave-discard">放弃修改</button></div>`,null,false,'项目日程');
    if(ctx().mobile){dialog.classList.remove('mobile-sheet');dialog.classList.add('schedule-mobile-confirm');}
    body.querySelector('#schedule-leave-stay').onclick=()=>closeDialog(true);
    body.querySelector('#schedule-leave-discard').onclick=()=>{closeDialog(true);discardScheduleEdit();proceed();};
    return false;
  }
  function setWeekCell(key,value){
    requireScheduleEdit();
    const reason=ProjectScheduleAccess.deadlineReason(JSON.parse(key)[2],scheduleAdmin());if(reason)throw Error(reason);
    const w=weekInput(),[projectId,memberRole,date,workItemId]=JSON.parse(key),old=state.times.filter(r=>r.personId===personId&&r.projectId===projectId&&r.role===memberRole&&r.date===date&&(r.workItemId||'legacy')===workItemId);
    if(!Object.hasOwn(w.original,key))w.original[key]=JSON.stringify(old);
    if(!w.meta[key])w.meta[key]={activity:old[0]?.activity||'',description:old[0]?.description||''};
    w.values[key]=value;w.error='';w.dirty=true;
  }
  function setEntryMeta(key,field,value){
    requireScheduleEdit();
    const reason=ProjectScheduleAccess.deadlineReason(JSON.parse(key)[2],scheduleAdmin());if(reason)throw Error(reason);
    const w=weekInput(),[projectId,role,date,workItemId]=JSON.parse(key),old=state.times.filter(r=>r.personId===personId&&ProjectSchedule.matches(r,{projectId,role,workItemId})&&r.date===date);
    if(!Object.hasOwn(w.values,key))setWeekCell(key,old.reduce((n,r)=>n+Number(r.hours),0)||'');
    w.meta[key][field]=value;w.error='';const error=content.querySelector('#week-error');if(error)error.hidden=true;refreshWeek();
  }
  function addCellEntry(projectId,memberRole,date){
    requireScheduleEdit();
    const d=ProjectSchedule.weekData(ctx());if(!d.working(date)||d.locked(date))throw Error('该日期不可填报');
    const w=weekInput(),k=ProjectSchedule.dayKey(projectId,memberRole,date),ids=d.entries({projectId,role:memberRole},date).map(r=>r.workItemId);ids.push('work-'+crypto.randomUUID());w.slots[k]=ids;render();
    const last=[...content.querySelectorAll('[data-week-cell]')].filter(el=>{const [p,r,day]=JSON.parse(el.dataset.weekCell);return p===projectId&&r===memberRole&&day===date;}).at(-1);last?.focus();
  }
  function refreshWeek(){const d=ProjectSchedule.weekData(ctx());weekInput().dirty=d.pending.length>0;ProjectSchedule.refreshWeek(ctx());publish();}
  function saveWeek(){
    const w=weekInput();try{
      requireScheduleEdit();
      if([...content.querySelectorAll('[data-week-cell]')].some(el=>el.validity.badInput))throw Error('请填写有效数字，工时按 0.5 小时填写');
      const d=ProjectSchedule.weekData(ctx());if(!d.changes.length){discardScheduleEdit();return true;}
      for(const c of d.changes){const key=ProjectSchedule.cellKey(c.projectId,c.role,c.date,c.workItemId),current=JSON.stringify(state.times.filter(r=>r.personId===personId&&ProjectSchedule.matches(r,c)&&r.date===c.date));if(w.original[key]!==current)throw Error(c.date+' 的记录已变化，请撤销未保存修改后重新填写');}
      persist(M.saveWeekTimes(state,personId,d.changes));for(const c of d.changes){const key=ProjectSchedule.cellKey(c.projectId,c.role,c.date,c.workItemId);delete w.values[key];delete w.original[key];delete w.meta[key];}for(const key of Object.keys(w.slots))if(d.dates.includes(JSON.parse(key)[2]))delete w.slots[key];w.editing=false;w.error='';render();toast(d.periodName+'工时已保存');return true;
    }catch(error){w.error=error.message;const el=content.querySelector('#week-error');if(el){el.hidden=false;el.textContent=error.message;if(ctx().mobile)toast(error.message,true);}else throw error;return false;}
  }
  function mobileFormContext(){
    requireScheduleEdit();const d=ProjectSchedule.weekData(ctx()),date=ProjectScheduleMobile.selectedDate(ctx(),d);if(!d.working(date)||d.locked(date))throw Error('该日期不可填报');return {d,date,rows:ProjectScheduleMobile.formRows(ctx(),d,date)};
  }
  function selectMobileProject(rowId,value){
    const {d,date,rows}=mobileFormContext(),row=rows.find(r=>r.id===rowId),m=d.rows.find(m=>JSON.stringify([m.projectId,m.role])===value);if(!row||!m)throw Error('请选择有效项目');
    const old=d.rows.flatMap(m=>d.entries(m,date)).find(r=>r.key===row.key);if(old&&old.projectId===m.projectId&&old.role===m.role){render();return;}
    const meta={activity:old?.activity||'',description:old?.description||''},hours=old?.hours||'',key=ProjectSchedule.cellKey(m.projectId,m.role,date,'mobile-'+row.id);
    if(row.key)setWeekCell(row.key,'');setWeekCell(key,hours);weekInput().meta[key]=meta;row.key=key;render();
  }
  function addMobileRow(){
    const {rows}=mobileFormContext(),row={id:crypto.randomUUID(),key:null};rows.push(row);render();const card=content.querySelector('[data-mobile-row="'+row.id+'"]');card?.scrollIntoView({block:'center',behavior:'smooth'});card?.querySelector('[data-action="mobile-project-open"]')?.focus({preventScroll:true});
  }
  function removeMobileRow(rowId){
    const {date,rows}=mobileFormContext(),row=rows.find(r=>r.id===rowId);if(!row)return;if(row.key)setWeekCell(row.key,'');weekInput().mobileRows[date]=rows.filter(r=>r.id!==rowId);render();
  }
  function timeBatch(mode='batch'){
    requireScheduleEdit();
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
  async function analysisTemplate(period=month,scope='all',selection={}){
    requireFinance();const basis=state,attachment=await ProjectExcel.createTemplate(basis,period,crypto.randomUUID(),scope,selection);requireFinance();if(state!==basis)throw Error('数据版本已变化，请重新索取模板');
    const records=templateRecords().filter(m=>m.revision===basis.revision&&m.stamp===attachment.manifest.stamp);records.push(attachment.manifest);localStorage.setItem(TEMPLATE_KEY,JSON.stringify(records.slice(-30)));return attachment;
  }
  async function analysisImportPreview(file){
    requireFinance();const basis=state;if(!/\.xlsx$/i.test(file.name))throw Error('请选择 .xlsx 格式的核算模板');if(file.size>5*1024*1024)throw Error('Excel文件须小于5MB');const result=await ProjectExcel.readTemplate(await file.arrayBuffer(),basis,templateRecords());requireFinance();if(state!==basis)throw Error('数据版本已变化，请重新发送文件');return ProjectExcel.previewWorkbook(state,result,file.name);
  }
  function analysisImportConfirm(preview){requireFinance();const next=ProjectExcel.applyWorkbook(state,preview);persist(next);render();return next.revision;}
  function openAnalysisImport(){
    requireFinance();const scope=currentTab()?.nav==='project-analysis'?'project':'person',label=scope==='project'?'项目':'人员';
    let pending=null,busy=false;
    const people=scope==='person'?ProjectExcel.personnelInfo(state):[];
    const projectRows=scope==='project'?ProjectExcel.projectImportRows(state):[];
    const filterTitles=scope==='person'?{roles:'角色',departments:'部门'}:{teams:'所属团队',expenseTypes:'费用类型',roles:'角色'},selectionKeys=Object.keys(filterTitles);
    const multi=(key,title,items)=>`<div class="analysis-import-filter"><span>${title}</span><details data-import-multi="${key}"><summary>全部${title}</summary><div class="analysis-import-options"><label><input type="checkbox" data-import-choice="${key}" value="all" checked>全部${title}</label>${items.map(item=>`<label><input type="checkbox" data-import-choice="${key}" value="${esc(item)}">${esc(item)}</label>`).join('')}</div></details></div>`;
    const importFilters=`<div class="analysis-import-filters">${scope==='person'?multi('roles','角色',[...new Set(people.flatMap(p=>p.projectRoles))])+multi('departments','部门',[...new Set(people.map(p=>p.department))]):multi('teams','所属团队',[...new Set(projectRows.map(r=>r.team))])+multi('expenseTypes','费用类型',['项目人员提成','项目异常费用','项目固定成本分摊'])+multi('roles','角色',[...new Set(state.members.map(r=>r.role).filter(Boolean))])}</div>`;
    openDialog(label+'核算数据导入',`<form id="analysis-import-form"><section class="analysis-import-section" aria-labelledby="import-download-title"><h3 id="import-download-title"><span>1</span>下载模板</h3><div class="analysis-import-controls"><label class="field">所属月份<select name="importMonth">${options(state.months.map(m=>({id:m,name:m})),month)}</select></label></div>${importFilters}<div class="analysis-import-download-row">${button('下载导入模板','analysis-import-template','','primary')}<span>按所选范围生成 Excel</span></div><p class="rule-text">${scope==='project'?'角色仅筛选人员提成；异常费用、固定成本分摊不关联角色。':'同一人员仅一行。'}只填写黄色金额列，空白保持原值，0覆盖为0。</p></section><section class="analysis-import-section analysis-import-upload" aria-labelledby="import-upload-title"><h3 id="import-upload-title"><span>2</span>上传数据</h3><label class="analysis-import-file">上传填写后的模板<input type="file" accept=".xlsx" aria-label="选择填写后的导入模板"></label><div id="analysis-import-preview"><div class="empty">选择 Excel 后预览导入差异</div></div><div id="form-error" class="form-error" role="alert" hidden></div></section><div class="form-actions">${button('取消','dialog-close')}${button('确认导入','dialog-save','disabled','primary')}</div></form>`,()=>{
      requireFinance();if(busy||!pending)throw Error('请先选择文件并完成校验');
      analysisImportConfirm(pending);closeDialog(true);toast(label+'核算数据已导入，分析已更新');
    },true,'核算数据 · Excel导入');
    const sequence=dialogSequence,form=body.querySelector('#analysis-import-form'),period=form.elements.importMonth,download=form.querySelector('[data-action="analysis-import-template"]'),file=form.querySelector('input[type="file"]'),save=form.querySelector('[data-action="dialog-save"]'),previewBox=form.querySelector('#analysis-import-preview');
    const alive=()=>dialog.open&&sequence===dialogSequence;
    const selection=()=>Object.fromEntries(selectionKeys.map(key=>[key,[...form.querySelectorAll(`[data-import-choice="${key}"]:checked`)].map(el=>el.value).filter(value=>value!=='all')]));
    const selectionStamp=s=>JSON.stringify(selectionKeys.map(key=>[...(s[key]||[])].sort()));
    const resetPreview=()=>{pending=null;save.disabled=true;file.value='';form.querySelector('#form-error').hidden=true;previewBox.innerHTML='<div class="empty">请下载当前筛选范围的模板</div>';};
    const setBusy=value=>{busy=value;download.disabled=value;file.disabled=value;period.disabled=value;form.querySelectorAll('[data-import-choice]').forEach(el=>el.disabled=value);save.disabled=value||!pending||!!pending.errors.length;};
    form.querySelectorAll('[data-import-choice]').forEach(input=>input.onchange=()=>{
      const key=input.dataset.importChoice,choices=[...form.querySelectorAll(`[data-import-choice="${key}"]`)],all=choices.find(el=>el.value==='all');
      if(input.value==='all'){all.checked=true;choices.filter(el=>el!==all).forEach(el=>el.checked=false);}else{all.checked=!choices.some(el=>el!==all&&el.checked);}
      const picked=choices.filter(el=>el!==all&&el.checked).map(el=>el.value);
      form.querySelector(`[data-import-multi="${key}"] summary`).textContent=picked.length?picked.join('、'):'全部'+filterTitles[key];
      resetPreview();
    });
    period.onchange=resetPreview;
    download.onclick=()=>guard(async()=>{if(busy)return;setBusy(true);try{const attachment=await analysisTemplate(period.value,scope,selection());if(alive())downloadExcel(attachment);}finally{if(alive())setBusy(false);}});
    file.onchange=()=>guard(async()=>{
      pending=null;save.disabled=true;const selected=file.files[0];if(!selected)return;
      const basis=state,selectedMonth=period.value;setBusy(true);previewBox.innerHTML='<div class="empty">正在校验Excel…</div>';
      try{
        requireFinance();if(!/\.xlsx$/i.test(selected.name))throw Error('请选择 .xlsx 格式的导入模板');if(selected.size>5*1024*1024)throw Error('Excel文件须小于5MB');
        const result=await ProjectExcel.readTemplate(await selected.arrayBuffer(),basis,templateRecords());if(!alive())return;requireFinance();if(state!==basis)throw Error('数据版本已变化，请重新下载模板');
        if(result.scope!==scope)throw Error('请使用'+label+'分析页面下载的专用模板');
        if(result.month!==selectedMonth)throw Error('文件月份与所选月份不一致，请切换月份或重新下载模板');
        if(selectionStamp(result.selection)!==selectionStamp(selection()))throw Error('文件的'+(scope==='person'?'角色、部门':'所属团队、费用类型、角色')+'范围与当前筛选不一致，请重新下载模板或恢复对应筛选');
        pending=ProjectExcel.previewWorkbook(state,result,selected.name);
        const rows=pending.groups.flatMap(g=>g.rows.filter(r=>r.kind!=='skip').map(r=>[esc(typeNames[g.type]),esc([r.projectId?pName(r.projectId):'',r.personId?uName(r.personId):''].filter(Boolean).join(' / ')),r.oldValue==null?'无记录':money(r.oldValue),money(r.newValue),esc(r.error||'可导入')]));
        previewBox.innerHTML=`<div class="notice ${pending.errors.length?'':'success'}">${esc(selected.name)} · ${result.month} · ${rows.length} 条金额${pending.errors.length?'，存在错误：'+esc(pending.errors.join('；')):'，核对后确认导入'}</div>${table(['数据类型','人员 / 项目','原金额','导入金额','校验'],rows)}`;
        form.querySelector('#form-error').hidden=true;formDirty=true;publish();
      }catch(error){if(alive()){pending=null;previewBox.innerHTML='<div class="notice">文件未通过校验，请调整后重新选择。</div>';throw error;}}
      finally{if(alive())setBusy(false);}
    });
  }
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
  async function exportAnalysis(){
    if(employee())throw Error('当前身份不能导出核算数据');
    const d=ProjectManagementInsights.data(ctx());
    if(!d.project){
      const basis=state,periods=d.cumulative?state.months.filter(period=>period<=month).sort():[month];
      const people=d.entities.map(person=>ProjectConsultants.profile(person));
      const file=await ProjectExcel.createPersonnelReport(basis,{months:periods,people,role:d.selectedRole});
      if(employee())throw Error('当前身份不能导出核算数据');
      downloadExcel(file);toast('已按模板导出核算Excel');return;
    }
    const file=await ProjectExcel.createProjectReport(state,{month,cumulative:d.cumulative,team:d.selectedTeam,rows:d.rows.map(r=>({...r,orderNo:ProjectDelivery.info(state,r.entity).order}))});
    if(employee())throw Error('当前身份不能导出核算数据');
    downloadExcel(file);toast('已按模板导出核算Excel');
  }
  function showManagerAlerts(level='all'){const result=ProjectManagementInsights.alertDialog(ctx(),level);openDialog(result.title,result.html,null,true,'管理驾驶舱 · 预警与行动');}
  function showError(error){const el=document.getElementById('form-error'),weekError=content.querySelector('#week-error'),createError=content.querySelector('#delivery-create-error');if(dialog.open&&el){el.textContent=error.message;el.hidden=false;}else if(!dialog.open&&createError){deliveryCreateDraft.error=error.message;createError.textContent=error.message;createError.hidden=false;createError.scrollIntoView({block:'nearest'});}else if(!dialog.open&&weekError){weekError.textContent=error.message;weekError.hidden=false;}else toast(error.message,true);}
  function guard(fn){try{const value=fn();if(value?.catch)value.catch(showError);}catch(error){showError(error);}}
  document.addEventListener('pointerdown',event=>{
    body.querySelectorAll('#analysis-import-form [data-import-multi][open]').forEach(menu=>{if(!menu.contains(event.target))menu.open=false;});
  });
  document.addEventListener('click',event=>{
    const target=event.target.closest('[data-action]');if(!target||target.disabled)return;
    event.preventDefault();executeAction(target);
  });
  function executeAction(target){
    const a=target.dataset.action;
    if(['mobile-date','fill-period','period-step','week-current','week-to-week','mobile-entry','reset'].includes(a)&&!prepareScheduleLeave(()=>executeAction(target)))return;
    guard(()=>{
      if(a==='navigate')navigate(target.dataset.page);
      if(a==='activate')activate(target.dataset.key);
      if(a==='dialog-close')closeDialog();
      if(a==='dialog-save'){if(!dialogSave)return;const form=body.querySelector('form');if(form?.elements.mode){form.elements.hours.required=form.elements.mode.value!=='time';}if(form&&!form.reportValidity())return;return dialogSave();}
      if(a==='project-detail'&&!mobileSchedule())showProject(target.dataset.id);
      if(a==='project-section'){currentTab().section=target.dataset.section;render();}
      if(a==='delivery-edit-member')editMember(target.dataset.id,target.dataset.person);
      if(a==='delivery-edit-cost')editProjectCosts(target.dataset.id);
      if(a==='delivery-search'){collectDeliverySearch();render();}
      if(a==='delivery-reset'){Object.assign(deliveryFilters,{status:'all',searchBy:'项目编号',query:'',start:'2026-05-10',end:'2026-11-09',range:'近半年',type:'',mark:'',team:'',owner:'',company:'',companyText:'',minAmount:'',maxAmount:''});render();}
      if(a==='delivery-expand'){collectDeliverySearch();deliveryFilters.expanded=!deliveryFilters.expanded;render();}
      if(a==='delivery-status'){collectDeliverySearch();deliveryFilters.status=target.dataset.status;render();}
      if(a==='delivery-range'){collectDeliverySearch();const days={'今天':0,'昨天':1,'近7天':6,'近30天':29,'近半年':183,'近1年':365},end='2026-11-09';deliveryFilters.start=addDays(end,-days[target.dataset.range]);deliveryFilters.end=target.dataset.range==='昨天'?addDays(end,-1):end;deliveryFilters.range=target.dataset.range;render();}
      if(a==='delivery-refresh'){render();toast('已刷新交付数据');}
      if(a==='delivery-application')applyDelivery(target.dataset.kind);
      if(a==='delivery-application-detail')deliveryApplicationDetail(target.dataset.id);
      if(a==='delivery-allocation-detail')deliveryAllocationDetail(target.dataset.id);
      if(a==='delivery-application-note')deliveryApplicationNote(target.dataset.id);
      if(a==='delivery-confirmation-download')ProjectDeliveryApplications.download(state,currentTab().projectId);
      if(a==='delivery-confirmation-page'){currentTab().deliveryPage=Number(target.dataset.page);render();}
      if(a==='delivery-new')addDeliveryProject();
      if(a==='delivery-create-save')saveDeliveryProject();
      if(a==='delivery-create-cancel'){if(close('project-create'))navigate('projects');}
      if(a==='delivery-create-add'){requireFinance();deliveryCreateDraft.members.push(ProjectDeliveryCreate.newMember('咨询师'));deliveryCreateDraft.dirty=true;render();}
      if(a==='delivery-create-remove'){requireFinance();deliveryCreateDraft.members=deliveryCreateDraft.members.filter(r=>r.key!==target.dataset.key);deliveryCreateDraft.dirty=true;render();}
      if(a==='delivery-create-file-remove'){deliveryCreateDraft.files.splice(Number(target.dataset.index),1);deliveryCreateDraft.dirty=true;render();}
      if(a==='delivery-export')exportDelivery();
      if(a==='delivery-pick')pickDelivery(target.dataset.section);
      if(a==='delivery-add-member')addDeliveryMember();
      if(a==='delivery-more'){openDialog('项目操作',`<div class="actions">${button('项目成员','delivery-open-section',`data-id="${target.dataset.id}" data-section="项目成员"`)}${button('项目计划','delivery-open-section',`data-id="${target.dataset.id}" data-section="项目计划"`)}${button('项目交付','delivery-open-section',`data-id="${target.dataset.id}" data-section="项目交付"`)}</div>`);}
      if(a==='delivery-open-section')showProject(target.dataset.id,month,target.dataset.section);
      if(a==='delivery-columns')openDialog('列表显示设置','<p class="rule-text">当前展示项目编号、订单编号、项目名称、所属团队及负责人、公司名称、标记、风险、项目类型、业务类型和金额。可横向滚动查看完整信息，操作列固定在右侧。</p>');
      if(a==='delivery-team')toast('当前费用承担团队：开发团队');
      if(a==='consultant-search'){Object.assign(filters,Object.fromEntries(new FormData(content.querySelector('#consultant-search'))));render();}
      if(a==='consultant-reset'){Object.assign(filters,{consultantQuery:''});render();}
      if(a==='consultant-new')editConsultant();
      if(a==='consultant-edit')editConsultant(target.dataset.id);
      if(a==='consultant-monthly-pay')editConsultantMonthlyPay(target.dataset.id);
      if(a==='consultant-detail'){const result=ProjectConsultants.detail(state,target.dataset.id);openDialog(result.title,result.html,null,true,'师资与教练管理 · 咨询师档案');}
      if(a==='consultant-analysis'){if(dialog.open&&!closeDialog())return;filters.analysisPerson=target.dataset.id;filters.analysisRole=state.members.some(x=>x.personId===target.dataset.id&&x.role==='咨询师')?'咨询师':'all';filters.personManagerView='overview';navigate('person-analysis');}
      if(a==='schedule-logs'&&!mobileSchedule())showScheduleLogs();
      if(a==='schedule-person-open'){if(!scheduleAdmin())throw Error('只有管理员可查看其他人员');switchSchedulePerson(target.dataset.person);}
      if(a==='week-save')saveWeek();
      if(a==='schedule-edit')beginScheduleEdit();
      if(a==='schedule-edit-cancel'){if(prepareScheduleLeave(()=>render()))render();}
      if(a==='schedule-project-pin')toggleSchedulePin(target.dataset.project);
      if(a==='mobile-date'){filters.mobileDate=target.dataset.date;if(filters.scheduleView==='month')filters.mobileCalendarOpen=false;render();}
      if(a==='mobile-add-row')addMobileRow();
      if(a==='mobile-project-open'){
        const {rows}=mobileFormContext();if(!rows.some(row=>row.id===target.dataset.row))throw Error('填报记录不存在');
        filters.mobileProjectPicker={rowId:target.dataset.row,query:'',scrollY:window.scrollY};render();window.scrollTo(0,0);
      }
      if(a==='mobile-project-back'){const scrollY=filters.mobileProjectPicker?.scrollY||0;filters.mobileProjectPicker=null;render();window.scrollTo(0,scrollY);}
      if(a==='mobile-project-select'){
        const picker=filters.mobileProjectPicker;if(!picker)return;
        filters.mobileProjectPicker=null;selectMobileProject(picker.rowId,target.dataset.value);
        const card=[...content.querySelectorAll('[data-mobile-row]')].find(el=>el.dataset.mobileRow===picker.rowId);card?.scrollIntoView({block:'center'});
      }
      if(a==='mobile-remove-row')removeMobileRow(target.dataset.row);
      if(a==='mobile-calendar-toggle'){filters.mobileCalendarOpen=true;render();}
      if(a==='mobile-activity'){requireScheduleEdit();setEntryMeta(target.dataset.key,'activity',target.dataset.value);}
      if(a==='mobile-hour-step'||a==='mobile-hour-set'){
        requireScheduleEdit();const input=[...content.querySelectorAll('[data-week-cell]')].find(el=>el.dataset.weekCell===target.dataset.key);if(input&&!input.disabled){const value=a==='mobile-hour-set'?Number(target.dataset.hours):Math.min(8,Math.max(0,Number(input.value||0)+Number(target.dataset.delta)));input.value=value||'';setWeekCell(target.dataset.key,input.value);content.querySelector('#week-error').hidden=true;refreshWeek();}
      }
      if(a==='mobile-clear'){requireScheduleEdit();setWeekCell(target.dataset.key,'');weekInput().meta[target.dataset.key]={activity:'',description:''};render();}
      if(a==='cell-add')addCellEntry(target.dataset.project,target.dataset.role,target.dataset.date);
      if(a==='week-step')applyFilter('date',addDays(filters.date,Number(target.dataset.step)));
      if(a==='week-current')applyFilter('date','2026-11-09');
      if(a==='week-revert'){const w=weekInput(),dates=ProjectSchedule.weekData(ctx()).dates;for(const key of Object.keys(w.values))if(dates.includes(JSON.parse(key)[2])){delete w.values[key];delete w.original[key];delete w.meta[key];}for(const key of Object.keys(w.slots))if(dates.includes(JSON.parse(key)[2]))delete w.slots[key];for(const date of dates)if(w.mobileRows)delete w.mobileRows[date];w.error='';render();}
      if(a==='week-to-week'){filters.scheduleView='week';render();}
      if(a==='fill-period'){filters.scheduleView=target.dataset.mode;filters.scheduleStats=target.dataset.mode;filters.mobileCalendarOpen=true;render();}
      if(a==='period-step'){const direction=Number(target.dataset.direction);if(filters.scheduleView==='month'){const index=state.months.indexOf(month)+direction;if(index<0||index>=state.months.length){toast('已到演示数据边界');return;}applyFilter('month',state.months[index]);}else applyFilter('date',addDays(filters.date,7*direction));}
      if(a==='week-add'){const el=content.querySelector('#week-add-project');if(el){const w=weekInput();if(!w.extra.includes(el.value))w.extra.push(el.value);render();}}
      if(a==='time-delete'){requireScheduleEdit();if(!confirm('确认删除该工时记录？'))return;const row=state.times.find(t=>t.id===target.dataset.id);if(!scheduleAdmin()&&row.personId!==currentUserId)throw Error('只能维护本人记录');const next=M.deleteTime(state,target.dataset.id);persist(next);render();toast('工时已删除');if(dialog.open)closeDialog(true);}
      if(a==='time-copy-day')timeBatch('copy-day');
      if(a==='time-copy-week')timeBatch('copy-week');
      if(a==='time-batch')timeBatch();
      if(a==='schedule-day'){filters.date=target.dataset.date;filters.scheduleView='day';render();}
      if(a==='mobile-entry'){mobile=true;mobileHome=true;if(!tabs.some(t=>t.key==='schedule'))tabs.push({key:'schedule',label:labels.schedule,nav:'schedule'});active='schedule';render();publish();}
      if(a==='mobile-home-schedule'){mobile=true;mobileHome=false;navigate('schedule');}
      if(a==='correct')correctAmount(target.dataset.collection,target.dataset.id);
      if(a==='batch-detail')showBatch(target.dataset.id);
      if(a==='sources')showSources(target.dataset.kind,target.dataset.id,target.dataset.month);
      if(a==='trial')trial();
      if(a==='close-month')monthClose();
      if(a==='reopen-month')monthReopen();
      if(a==='manager-view'){const key=currentTab()?.nav==='project-analysis'?'projectManagerView':'personManagerView';filters[key]=target.dataset.view;render();}
      if(a==='manager-alerts')showManagerAlerts();
      if(a==='manager-diagnose'){const result=ProjectManagementInsights.diagnose(ctx(),target.dataset.id);openDialog(result.title,result.html,null,true,'管理驾驶舱 · 决策诊断');}
      if(a==='manager-rules'){const rules=content.querySelector('.manager-rules');if(rules){rules.open=true;rules.scrollIntoView({behavior:'smooth',block:'start'});}}
      if(a==='manager-detail-person'){if(dialog.open&&!closeDialog())return;filters.analysisPerson=target.dataset.id;filters.personManagerView='accounting';render();}
      if(a==='export-analysis')return exportAnalysis();
      if(a==='analysis-import')openAnalysisImport();
      if(a==='reset'){if(!confirm('重置仅影响本次项目管理优化 Demo 的本地数据，确定恢复示例吗？'))return;try{localStorage.removeItem(KEY);localStorage.removeItem(PIN_KEY);localStorage.removeItem(TEMPLATE_KEY);chatSession.messages=[];chatSession.pending=null;weekInputs.clear();lastRaw=null;persist(M.seed(),false);if(dialog.open)closeDialog(true);render();toast('已恢复虚构示例数据');}catch(e){throw Error('重置失败：'+e.message);}}
    });
  }
  function applyFilter(key,value){
    if(['date','month','mobileScheduleTab'].includes(key)&&!prepareScheduleLeave(()=>applyFilter(key,value))){render();return;}
    if(key==='date'&&!value){render();return;}
    if(key==='month'&&!state.months.includes(value)){toast('示例支持 2026-09 至 2026-11',true);render();return;}
    if(key==='month'){month=value;if(!filters.date.startsWith(month))filters.date=state.calendar[month]?.days[0]||month+'-01';}
    else{filters[key]=value;if(key==='analysisRole')filters.analysisPerson='all';if(key==='analysisTeam')filters.analysisProject='all';if(key==='date'&&value){month=value.slice(0,7);if(!state.months.includes(month)){toast('示例支持 2026-09 至 2026-11，请选择该范围日期',true);month='2026-11';filters.date='2026-11-09';}}}
    render();
  }
  document.addEventListener('change',event=>{
    const el=event.target;if(el.matches('[data-cell-activity]'))setEntryMeta(el.dataset.cellActivity,'activity',el.value);if(el.matches('[data-manager-alert-level]'))guard(()=>showManagerAlerts(el.value));if(el.dataset.filter)guard(()=>applyFilter(el.dataset.filter,el.value));
    if(el.closest('#delivery-create-form'))guard(()=>{
      requireFinance();ProjectDeliveryCreate.capture(el.form,deliveryCreateDraft);deliveryCreateDraft.dirty=true;deliveryCreateDraft.error='';
      if(el.name==='orderNo'){ProjectDeliveryCreate.chooseOrder(state,deliveryCreateDraft);render();}
      else if(el.name==='salesId'){ProjectDeliveryCreate.chooseSales(state,deliveryCreateDraft);render();}
      else if(el.name.startsWith('personId-'))render();
      else if(el.name==='attachments'){ProjectDeliveryCreate.addFiles(deliveryCreateDraft,el.files);render();}
      else refreshDeliveryCreate();publish();
    });
    if(el.dataset.projectMeta)guard(()=>{requireFinance();const next=structuredClone(state),p=next.projects.find(p=>p.id===el.dataset.id);p[el.dataset.projectMeta]=el.value;next.revision++;persist(next);toast('项目标记已保存');});
    if(el.id==='delivery-confirmation-size'){currentTab().deliveryPageSize=Number(el.value);currentTab().deliveryPage=1;render();}
    if(el.id==='schedule-access-person')guard(()=>switchSchedulePerson(el.value));
    if(el.id==='demo-role')switchDemoRole(el.value);
    if(el.id==='demo-person'){if(!scheduleAdmin()&&currentTab()?.nav==='schedule'){el.value=personId;toast('项目成员只能查看自己的日程',true);return;}if(dialog.open&&!closeDialog()){el.value=personId;return;}personId=el.value;render();}
  });
  document.addEventListener('click',event=>{const el=event.target.closest('button[data-filter]');if(el){event.preventDefault();guard(()=>applyFilter(el.dataset.filter,el.dataset.value));}});
  content.addEventListener('input',event=>{
    if(event.target.id==='mobile-project-search'){filters.mobileProjectPicker.query=event.target.value;content.querySelector('#mobile-project-results').innerHTML=ProjectScheduleMobile.projectOptions(ctx(),event.target.value);return;}
    if(event.target.closest('#delivery-create-form')){ProjectDeliveryCreate.capture(event.target.form,deliveryCreateDraft);deliveryCreateDraft.dirty=true;deliveryCreateDraft.error='';const error=content.querySelector('#delivery-create-error');if(error)error.hidden=true;refreshDeliveryCreate();publish();return;}
    if(event.target.matches('[data-cell-description]')){setEntryMeta(event.target.dataset.cellDescription,'description',event.target.value);return;}
    if(event.target.matches('[data-week-cell]')){setWeekCell(event.target.dataset.weekCell,event.target.value);content.querySelector('#week-error').hidden=true;refreshWeek();return;}

  });
  content.addEventListener('submit',event=>{if(event.target.id==='delivery-create-form'){event.preventDefault();guard(saveDeliveryProject);}});
  content.addEventListener('keydown',event=>{
    if(!content.querySelector('.schedule-weekly'))return;
    if(event.key==='Enter'&&(event.ctrlKey||event.metaKey)){event.preventDefault();saveWeek();return;}
    if(event.key==='Enter'&&event.target.matches('[data-week-cell]')){event.preventDefault();const inputs=[...content.querySelectorAll('[data-week-cell]:not(:disabled)')],index=inputs.indexOf(event.target),next=inputs[index+(event.shiftKey?-1:1)];if(next){next.focus();next.select();}}
  });
  const markDirty=event=>{if(event.target.closest('#schedule-logs')||['settings-month','consultant-pay-year'].includes(event.target.id)||event.target.matches('[data-manager-alert-level]'))return;if(body.querySelector('#lobster-history')){chatDirty();return;}formDirty=true;publish();};body.addEventListener('input',markDirty);body.addEventListener('change',markDirty);
  dialog.addEventListener('cancel',event=>{event.preventDefault();closeDialog();});
  // Embedded preview browsers may suppress native leave-page dialogs. Keep refresh
  // nonblocking and retain schedule inputs in this tab until the next reload.
  const reloadKey='erp-project-demo-reload-v1';
  function retainScheduleInputs(){
    try{sessionStorage.setItem(reloadKey,JSON.stringify({revision:state.revision,role,personId,month,mobile,mobileHome,filters:{...filters,mobileProjectPicker:null},weekInputs:[...weekInputs]}));}catch{}
  }
  try{
    const retained=JSON.parse(sessionStorage.getItem(reloadKey)||'null');sessionStorage.removeItem(reloadKey);
    const reloading=performance.getEntriesByType('navigation')[0]?.type==='reload'||ERPClient.hosted&&new URLSearchParams(location.search).get('reload')==='1';
    if(reloading&&retained?.revision===state.revision){
      if(['finance','manager','employee'].includes(retained.role))role=retained.role;
      if(state.people.some(p=>p.id===retained.personId))personId=retained.personId;
      month=retained.month;mobile=retained.mobile;mobileHome=!!retained.mobileHome;Object.assign(filters,retained.filters);
      for(const [key,value] of retained.weekInputs||[])weekInputs.set(key,value);
      document.getElementById('demo-role').value=role;
    }
  }catch{}
  window.addEventListener('beforeunload',retainScheduleInputs);
  window.addEventListener('pagehide',retainScheduleInputs);
  window.addEventListener('storage',event=>{if(event.key===KEY&&event.newValue!==lastRaw){storageProblem='演示数据已在其他窗口变更，请刷新后继续，避免覆盖。';renderStorage();}});
  let marksConfigured=false;
  const marks=document.getElementById('project-marks');
  const markConfig={id:'project-optimization',versions:ERPProjectAnalysisMarks.versions,marks:ERPProjectAnalysisMarks.marks};
  window.ProjectIterationMarks=markConfig;
  marks.configure(markConfig,{root:content,toolbar:!ERPClient.hosted,storage:!ERPClient.hosted,configGlobal:'ProjectIterationMarks',documentBase:new URL('../../../',location.href).href,getPage:()=>content.dataset.erpPage,navigate:page=>navigate(page)});
  marksConfigured=true;
  if(ERPClient.hosted)ERPIterationBridge.renderer(marks,'project');
  ERPClient.connect({snapshot,navigate,activate,close,prepareLeave:prepareScheduleLeave});
  matchMedia('(max-width:760px)').addEventListener('change',()=>{if(currentTab()?.nav==='schedule'&&!dialog.open)render();});
  const initialMobileHome=mobileHome;
  renderStorage();navigate('schedule');
  if(initialMobileHome){mobile=true;mobileHome=true;render();publish();}
})();



