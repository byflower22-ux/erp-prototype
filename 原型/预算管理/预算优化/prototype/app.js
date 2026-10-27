/* Offline interaction prototype. All records are fictional and remain in memory. */
(function(){
'use strict';
const M=window.BudgetModel, $=s=>document.querySelector(s), money=v=>Number(v).toLocaleString('zh-CN',{minimumFractionDigits:2,maximumFractionDigits:2});
const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
let latest=M.createData(), view=structuredClone(latest), toastTimer;
const S={page:['overview','execute','budget','actual','frozen','import','rules','approval','adjustment','application','request','reimbursement','empty'].includes(location.hash.slice(1))?location.hash.slice(1):'execute',team:'t1',approvalId:'adj1',month:'2026-10',mode:'monthly',annualMetric:'actual',collapsed:new Set(),search:'',overviewSearch:'',overviewTeam:'',onlyFrozen:false,pending:'',refreshFail:false,empty:false,denied:false,ctx:null,history:[],filter:{origin:'',source:'',subject:'',month:'',keyword:'',status:'',person:''},pageNo:1,sortDesc:true,editing:{},dirty:false};
const titles={overview:'财务预算概览',execute:'团队预算执行',budget:'团队预算编制',actual:'实际使用明细',frozen:'在途冻结明细',import:'实际值导入',rules:'预算管控规则',approval:'审批',adjustment:'团队预算调整申请单详情',application:'申请',request:'申请团队预算调整申请单',reimbursement:'报销申请审批详情'};
const team=()=>M.teams.find(t=>t.id===S.team), groupRule=g=>view.ruleOverrides[g.id]||g.rule;
const link=(text,action,attrs='',cls='')=>`<button type="button" class="link ${cls}" data-action="${action}" ${attrs}>${text}</button>`;
const options=(items,value)=>items.map(([v,t])=>`<option value="${esc(v)}" ${v===value?'selected':''}>${esc(t)}</option>`).join('');
const moneyLink=(v,type,id,start,end)=>link(money(v),'detail',`data-type="${type}" data-subject="${id||''}" data-start="${start}" data-end="${end}"`,'money number-link');
function notify(text){$('#toast').textContent=text;$('#toast').hidden=false;clearTimeout(toastTimer);toastTimer=setTimeout(()=>$('#toast').hidden=true,2800);}
const workspaceKeys=['page','approvalId','team','month','mode','annualMetric','collapsed','search','ctx','history','filter','pageNo','sortDesc','editing','dirty'];
function captureWorkspace(){return structuredClone(Object.fromEntries(workspaceKeys.map(k=>[k,S[k]])));}
function freshWorkspace(page,teamId=S.team){return {page,team:teamId,approvalId:'adj1',month:'2026-10',mode:'monthly',annualMetric:'actual',collapsed:new Set(),search:'',ctx:null,history:[],filter:{origin:'',source:'',subject:'',month:'',keyword:'',status:'',person:''},pageNo:1,sortDesc:true,editing:{},dirty:false};}
function workspaceKey(page,teamId){return page==='adjustment'?`adjustment-${S.approvalId}`:['budget','request'].includes(page)?`${page}-${teamId}`:page;}
function openAdjustment(id){
  const key=`adjustment-${id}`;
  if(!workspace.tabs.some(t=>t.key===key))workspace.tabs.push({key,page:'adjustment',team:S.team,state:{...freshWorkspace('adjustment'),approvalId:id},scroll:0});
  activateWorkspace(key);
}
function openReimbursement(){
  const returnKey=workspace.active,key='reimbursement';
  let tab=workspace.tabs.find(t=>t.key===key);
  if(!tab){tab={key,page:key,team:S.team,state:freshWorkspace(key),scroll:0};workspace.tabs.push(tab);}
  if(returnKey!==key)tab.returnKey=returnKey;
  activateWorkspace(key);
}
const workspace={active:S.page==='empty'?null:'overview',tabs:S.page==='empty'?[]:[{key:'overview',page:'overview',team:'t1',state:freshWorkspace('overview','t1'),scroll:0}]};
if(!['overview','empty'].includes(S.page)){
  const root=['actual','frozen'].includes(S.page)?'execute':S.page;
  workspace.active=workspaceKey(root,S.team);
  workspace.tabs.push({key:workspace.active,page:root,team:S.team,state:captureWorkspace(),scroll:0});
}
function saveWorkspace(){const tab=workspace.tabs.find(t=>t.key===workspace.active);if(tab){tab.state=captureWorkspace();tab.scroll=window.scrollY;}}
function activateWorkspace(key){const tab=workspace.tabs.find(t=>t.key===key);if(!tab)return;saveWorkspace();workspace.active=key;Object.assign(S,structuredClone(tab.state));closeDrawer();history.replaceState(null,'',`#${S.page}`);render();window.scrollTo(0,tab.scroll||0);}
function openWorkspace(page,teamId=S.team){
  const key=workspaceKey(page,teamId);
  if(!workspace.tabs.some(t=>t.key===key))workspace.tabs.push({key,page,team:teamId,state:freshWorkspace(page,teamId),scroll:0});
  activateWorkspace(key);
  if(page==='execute'){
    Object.assign(S,{page:'execute',team:teamId,ctx:null,history:[]});
    workspace.tabs.find(t=>t.key===key).team=teamId;
    history.replaceState(null,'','#execute');saveWorkspace();render();
  }
}
function closeWorkspace(key,discard=false){
  saveWorkspace();
  const index=workspace.tabs.findIndex(t=>t.key===key);if(index<0)return;
  const tab=workspace.tabs[index];
  if(tab.state.dirty&&!discard){confirmDialog('放弃未保存的修改？','<p>关闭后将丢弃当前页签中未保存的修改，已保存的数据不受影响。</p>',`<button data-action="close">继续编辑</button><button class="primary" data-action="discard-workspace" data-key="${esc(key)}">放弃修改并关闭</button>`);return;}
  if(tab.page==='request')applicationUI.discard(tab.team);
  const wasActive=workspace.active===key;workspace.tabs.splice(index,1);closeDrawer();
  if(wasActive){const next=workspace.tabs.find(t=>t.key===tab.returnKey)||workspace.tabs[Math.max(0,index-1)];workspace.active=next?.key||null;Object.assign(S,next?structuredClone(next.state):freshWorkspace('empty',S.team));history.replaceState(null,'',`#${S.page}`);render();window.scrollTo(0,next?.scroll||0);}else render();
}
function workspaceLabel(t){return t.page==='overview'?'财务预算':t.page==='execute'?'预算执行':t.page==='budget'?`年度预算 · ${M.teams.find(team=>team.id===t.team).name}`:t.page==='request'?`调整申请 · ${M.teams.find(team=>team.id===t.team).name}`:t.page==='adjustment'?`预算调整 · ${approvalUI.record(t.state.approvalId)?.person||''}`:titles[t.page];}
function renderWorkspace(){
  $('.workspace-tabs').innerHTML=workspace.tabs.map(t=>{
    const label=workspaceLabel(t);
    return `<div class="workspace-item ${t.key===workspace.active?'current':''}"><button class="workspace-open" data-action="activate-workspace" data-key="${esc(t.key)}" aria-current="${t.key===workspace.active?'page':'false'}">${esc(label)}${(t.key===workspace.active?S.dirty:t.state.dirty)?' <span class="draft-dot" title="未保存">●</span>':''}</button><button class="workspace-close" data-action="close-workspace" data-key="${esc(t.key)}" aria-label="关闭${esc(label)}">×</button></div>`;
  }).join('');
  window.ERPClient?.publish();
}

function erpSnapshot(){
  return {active:workspace.active,tabs:workspace.tabs.map(t=>{
    const page=t.key===workspace.active?S.page:t.state.page;
    const nav=['request','application'].includes(page)?'application':['approval','adjustment'].includes(page)?'approval':page==='rules'?'rules':'overview';
    const label=workspaceLabel(t);
    return {key:t.key,label,nav,dirty:t.key===workspace.active?S.dirty:t.state.dirty};
  })};
}

function navigate(page,attrs={}){
  S.history.push({page:S.page,team:S.team,month:S.month,mode:S.mode,annualMetric:S.annualMetric,ctx:S.ctx?{...S.ctx}:null,filter:{...S.filter},pageNo:S.pageNo,search:S.search,scroll:window.scrollY});
  S.page=page;Object.assign(S,attrs);history.replaceState(null,'',`#${page}`);closeDrawer();render();window.scrollTo(0,0);
}
function goBack(){const previous=S.history.pop();if(previous){Object.assign(S,previous);history.replaceState(null,'',`#${S.page}`);closeDrawer();render();window.scrollTo(0,previous.scroll||0);}else navigate('execute');}
function openDetail(type,id,start,end,teamId=S.team,expenseOnly=false){
  navigate(type,{team:teamId,ctx:{id:id||'',start,end,expenseOnly},filter:{origin:'',source:'',subject:'',month:'',keyword:'',status:'',person:''},pageNo:1});
}
function snapshot(){return `<span class="snapshot"><span class="snapshot-dot"></span>数据截至 ${view.asof}</span><button data-action="refresh" class="small">↻ 刷新</button>`;}
function notice(){return S.pending?`<div class="alert ${S.refreshFail?'error':''}"><span>${S.refreshFail?'!':'↻'}</span><span><strong>${S.pending}</strong>　当前展示数据保持不变，请更新后查看。</span><button class="small" data-action="refresh">${S.refreshFail?'重试刷新':'更新数据'}</button></div>`:'';}
function header(title,sub='',back=false){return `<div class="breadcrumb"><span>预算管理</span><span>/</span><span>${esc(title)}</span></div><div class="title-row"><div><div class="title-group">${back&&!['budget','execute'].includes(S.page)?'<button class="back-button" data-action="back">‹ 返回</button>':''}<h1>${esc(title)}</h1>${S.page==='budget'?'<span class="tag green">编制已解锁</span>':''}</div><div class="subtitle">${sub}</div></div><div class="title-actions">${snapshot()}</div></div>${notice()}`;}
function overview(){
  const teams=M.teams.filter(t=>(!S.overviewTeam||S.overviewTeam===t.id)&&(!S.overviewSearch||`${t.name}${t.code}2026年预算FT2026151`.includes(S.overviewSearch)));
  return `<div class="legacy-overview"><div class="legacy-top"><div class="filters"><button class="primary small" data-action="legacy-existing" data-label="模板管理">模板管理</button><details class="legacy-batch"><summary>批量操作<span aria-hidden="true">▾</span></summary><div class="legacy-batch-menu" role="group" aria-label="批量操作"><button type="button" data-action="legacy-existing" data-label="锁定预算">锁定预算</button><button type="button" data-action="legacy-existing" data-label="锁定预测">锁定预测</button><button type="button" data-action="legacy-existing" data-label="解锁预算">解锁预算</button><button type="button" data-action="legacy-existing" data-label="解锁预测">解锁预测</button><button type="button" data-action="legacy-existing" data-label="导出预算">导出预算</button><button type="button" data-action="legacy-existing" data-label="导出预测">导出预测</button><button type="button" data-action="legacy-existing" data-label="导出实际">导出实际</button><button type="button" data-action="legacy-existing" data-label="导入预算">导入预算</button><button type="button" data-action="legacy-existing" data-label="导入预测">导入预测</button><button type="button" data-action="bulk-import-actual" data-label="导入实际">导入实际</button></div></details></div><div class="filters"><input id="overview-search" value="${esc(S.overviewSearch)}" placeholder="搜索模板名称、编号、团队名称、团队编号…" aria-label="搜索模板或团队"><button class="primary small" data-action="overview-query" aria-label="查询">⌕</button><button class="primary small" data-action="legacy-existing" data-label="更多查询">更多≡</button></div></div><div class="legacy-filter"><button class="small" data-action="overview-select-team">${S.overviewTeam?esc(M.teams.find(t=>t.id===S.overviewTeam).name):'选择团队'}</button><label class="field">财年：<select id="overview-year" aria-label="财年"><option value="2026">2026</option></select></label></div><div class="table-wrap"><table class="legacy-table"><thead><tr><th class="center"><input type="checkbox" id="overview-check-all" aria-label="全选团队"></th><th class="center">操作</th><th>财年</th><th>责任团队</th><th>创建人</th><th class="right">预算</th><th class="right">预测</th><th class="right">实际</th><th>模板名称</th><th class="center">预算状态</th><th class="center">预测状态</th></tr></thead><tbody>${S.empty?'':teams.map(t=>{const m=M.metrics(view,t.id,'',M.months[0],M.months[11]);return `<tr><td class="center"><input type="checkbox" data-overview-check="${t.id}" aria-label="选择${t.name}"></td><td><div class="legacy-ops"><button data-action="team-nav" data-team="${t.id}" data-page="budget">预算</button><button data-action="forecast" data-team="${t.id}">预测</button><button data-action="team-nav" data-team="${t.id}" data-page="execute">执行</button></div></td><td>2026</td><td>${t.name}(${t.code})</td><td>${t.owner}(${t.owner==='超级管理员'?'B00000':'B04141'})</td><td class="right money">${money(m.budget)}</td><td class="right money">${money(Math.round(m.budget*.93))}</td><td class="right money">${money(m.actual)}</td><td>2026年预算(FT2026151)</td><td class="center">已解锁</td><td class="center">已解锁</td></tr>`;}).join('')}</tbody></table></div>${S.empty||!teams.length?emptyState():''}<div class="panel-foot"><span>共 ${S.empty?0:teams.length} 条</span><div class="foot-right"><button class="small page-current">1</button><span>20 条／页</span></div></div></div>`;
}
function emptyState(){return `<div class="empty"><div class="empty-symbol">▤</div><b>暂无符合条件的数据</b><span>请调整查询条件后重试</span></div>`;}
function subjectChildren(g){return g.children.map(c=>`<label class="cascader-option ${S.search===c.id?'selected':''}"><input type="radio" name="execution-subject" value="${c.id}" ${S.search===c.id?'checked':''}><span>${esc(c.name)}</span></label>`).join('');}
function subjectCascader(){
  const g=M.groupFor(S.search)||M.groups[0],selected=S.search?M.subject(S.search):null;
  const label=selected?(selected.id===g.id?g.name:`${g.name} / ${selected.name}`):'全部科目';
  return `<div class="field"><span>预算科目</span><details class="subject-cascader"><summary id="execution-subject" aria-label="筛选预算科目"><span>${esc(label)}</span><span class="cascader-caret" aria-hidden="true">⌄</span></summary><div class="cascader-menu" aria-label="预算科目级联筛选"><div class="cascader-parents"><label class="cascader-option ${!S.search?'selected':''}"><input type="radio" name="execution-subject" value="" ${!S.search?'checked':''}><span>全部科目</span></label>${M.groups.map(parent=>`<div class="cascader-parent ${g.id===parent.id?'active':''}" data-cascader-group="${parent.id}"><label class="cascader-option ${S.search===parent.id?'selected':''}"><input type="radio" name="execution-subject" value="${parent.id}" ${S.search===parent.id?'checked':''}><span>${esc(parent.name)}</span></label><button type="button" class="cascader-next" data-action="subject-branch" data-group="${parent.id}" aria-label="查看${esc(parent.name)}的二级科目">›</button></div>`).join('')}</div><div class="cascader-children" aria-label="${esc(g.name)}的二级科目">${subjectChildren(g)}</div></div></details></div>`;
}
function showSubjectBranch(id){
  const g=M.groups.find(g=>g.id===id),children=$('.cascader-children');if(!g||!children)return;
  document.querySelectorAll('.cascader-parent').forEach(row=>row.classList.toggle('active',row.dataset.cascaderGroup===id));
  children.innerHTML=subjectChildren(g);children.setAttribute('aria-label',`${g.name}的二级科目`);
}
function executionNoteButton(annual=false){return `<button type="button" class="execution-note-trigger" data-action="execution-note" aria-label="${annual?'全年执行说明':'管控可用额度说明'}" aria-describedby="execution-note" aria-expanded="false">ⓘ</button>`;}
function showExecutionNote(){
  const note=$('#execution-note'),trigger=$('.execution-note-trigger');if(!note||!trigger)return;
  if(!note.matches(':popover-open'))note.showPopover();
  trigger.setAttribute('aria-expanded','true');
  const r=trigger.getBoundingClientRect(),width=note.offsetWidth,height=note.offsetHeight;
  note.style.left=`${Math.max(10,Math.min(r.right-width,window.innerWidth-width-10))}px`;
  note.style.top=`${Math.max(10,r.bottom+8+height<=window.innerHeight-10?r.bottom+8:r.top-height-8)}px`;
}
function hideExecutionNote(){
  const note=$('#execution-note');if(note?.matches(':popover-open'))note.hidePopover();
  if(note)note.dataset.pinned='';$('.execution-note-trigger')?.setAttribute('aria-expanded','false');
}
function execute(){
  const annual=S.mode==='annual',metric=S.annualMetric||'actual';
  const period=annual?'<span class="field">财年期间 <span class="pill">2026-02 至 2027-01</span></span>':`<label class="field">预算归属月<select id="month-select">${options(M.months.map(m=>[m,m]),S.month)}</select></label>`;
  const metricSwitch=annual?`<div class="panel-toolbar annual-metric-toolbar"><span class="muted">各月分布</span><div class="mode-switch" aria-label="各月分布指标">${[['budget','预算'],['actual','实际'],['frozen','冻结']].map(([id,label])=>`<button data-action="annual-metric" data-metric="${id}" aria-pressed="${metric===id}" class="${metric===id?'active':''}">${label}</button>`).join('')}</div><span class="muted">${metric==='frozen'?'按预算归属月分布的当前有效冻结，非历史快照累计':metric==='actual'?'按预算归属月查看实际使用分布':'各月份当前生效的预算分配'}</span></div>`:'';
  return header('团队预算执行',`${team().name}（${team().code}）<span style="margin:0 10px">·</span>2026财年<span style="margin:0 10px">·</span>单位：元`,true)+`<div class="panel"><div class="panel-toolbar"><div class="filters"><label class="field">责任团队<select id="team-select" class="long">${options(M.teams.map(t=>[t.id,t.name]),S.team)}</select></label>${period}</div><div class="mode-switch"><button data-action="mode" data-mode="monthly" class="${!annual?'active':''}">月度执行</button><button data-action="mode" data-mode="annual" class="${annual?'active':''}">全年执行</button></div></div></div><div class="panel execution-panel"><div class="section-heading"><div class="execution-heading"><h2>${annual?'全年科目执行':'科目预算执行'}${annual?executionNoteButton(true):''}</h2>${annual?'':'<span class="execution-subtitle">本月列按所选月份统计；管控可用按生效规则计算。点击可用额度查看范围与计算说明。</span>'}</div><div class="filters">${subjectCascader()}<button class="small" data-action="export">↓ 导出</button></div></div>${metricSwitch}${annual?annualExecutionTable():monthlyTable()}</div><div id="execution-note" class="execution-note-popover" popover="manual" role="note">${annual?'<p>财年汇总列始终展示预算、实际和当前冻结；各月列按所选指标展示，实际与冻结可下钻。</p>':''}<p>${annual?'年度执行金额不代表可申请额度；请切换月度执行，按预算归属月及生效规则查看管控可用。':'可用额度反映当前查询时点；报销、付款提交时按最新规则重新校验。'}</p></div>`;
}
function annualExecutionTable(){
  const out=[],metric=S.annualMetric||'actual',metricLabel={budget:'预算',actual:'实际',frozen:'冻结'}[metric];
  for(const g of visibleGroups())for(const c of [null,...(S.page==='execute'?g.children:S.collapsed.has(g.id)?[]:g.children)]){
    const id=c?.id||g.id,m=M.metrics(view,S.team,id,M.months[0],M.months[11]);
    out.push(`<tr class="${c?'':'group'}"><td>${treeName(g,c)}</td><td class="right money">${money(m.budget)}</td><td class="right">${moneyLink(m.actual,'actual',id,M.months[0],M.months[11])}</td><td class="right">${g.income?'—':moneyLink(m.frozen,'frozen',id,M.months[0],M.months[11])}</td>${M.months.map(month=>{
      const v=M.metrics(view,S.team,id,month,month)[metric];
      return `<td class="right money">${metric==='frozen'&&g.income?'—':metric==='budget'?money(v):moneyLink(v,metric,id,month,month)}</td>`;
    }).join('')}</tr>`);
  }
  return `<div class="table-wrap"><table class="annual-table annual-execution"><thead><tr><th>预算科目</th><th class="right">财年预算</th><th class="right">财年实际</th><th class="right">当前有效冻结</th>${M.months.map(m=>`<th class="right">${m}<span class="cell-note">${metricLabel}</span></th>`).join('')}</tr></thead><tbody>${S.empty?'':out.join('')}</tbody></table></div>${S.empty||!out.length?emptyState():''}`;
}
function visibleGroups(){
  if(S.page!=='execute'||!S.search)return M.groups;
  return M.groups.filter(g=>g.id===S.search||g.children.some(c=>c.id===S.search)).map(g=>g.id===S.search?g:{...g,children:g.children.filter(c=>c.id===S.search)});
}
function treeName(g,c){return c?`<div class="subject-name indent"><span class="subject-mark"></span>${c.name}</div>`:`<div class="subject-name">${S.page==='execute'?'':`<button class="tree-toggle" data-action="collapse" data-group="${g.id}" aria-label="${S.collapsed.has(g.id)?'展开':'收起'}${g.name}">${S.collapsed.has(g.id)?'▸':'▾'}</button>`}${g.name}${g.income?'<span class="tag">收入</span>':''}</div>`;}
function monthlyTable(){
  const out=[];
  for(const g of visibleGroups())for(const c of [null,...(S.page==='execute'?g.children:S.collapsed.has(g.id)?[]:g.children)]){
    const id=c?.id||g.id,m=M.metrics(view,S.team,id,S.month,S.month),ctl=M.control(view,S.team,id,S.month);
    let available='—',rule='—';
    if(ctl){rule=ctl.shared?'随一级管控':M.ruleNames[ctl.rule];available=ctl.group?'<span class="muted">按二级科目分别管控</span>':ctl.shared?link(`共享${g.name}额度`,'control',`data-subject="${id}"`,'shared'):link(`${money(ctl.available)}${ctl.available<0?' <span class="tag red">超额</span>':''}`,'control',`data-subject="${id}"`,`money ${ctl.available<0?'negative':'available'}`);}
    out.push(`<tr class="${c?'':'group'}"><td>${treeName(g,c)}</td><td class="right money">${money(m.budget)}</td><td class="right">${moneyLink(m.actual,'actual',id,S.month,S.month)}</td><td class="right">${g.income?'<span class="muted">—</span>':moneyLink(m.frozen,'frozen',id,S.month,S.month)}</td><td><span class="rule-text">${rule}</span></td><td class="right">${available}${ctl&&!ctl.group&&!ctl.shared?`<span class="cell-note">${ctl.start===ctl.end?ctl.end:`${ctl.start} 至 ${ctl.end}`}</span>`:''}</td></tr>`);
  }
  return `<div class="table-wrap"><table><thead><tr><th style="width:22%">预算科目</th><th class="right">本月预算</th><th class="right">本月实际</th><th class="right">本月冻结</th><th>管控方式</th><th class="right" style="width:23%">管控可用额度 ${executionNoteButton()}</th></tr></thead><tbody>${S.empty?'':out.join('')}</tbody></table></div>${S.empty||!out.length?emptyState():''}`;
}
function annualTable(edit){
  const out=[];
  for(const g of visibleGroups())for(const c of [null,...(S.page==='execute'?g.children:S.collapsed.has(g.id)?[]:g.children)]){
    const id=c?.id||g.id,annual=edit?M.budget(view,S.team,id,M.months[0],M.months[11]):M.sum(M.rows(view,'actual',S.team,id,M.months[0],M.months[11]));
    out.push(`<tr class="${c?'':'group'}"><td>${treeName(g,c)}</td><td class="right money">${edit?money(annual):moneyLink(annual,'actual',id,M.months[0],M.months[11])}</td>${M.months.map(month=>{const v=edit?M.budget(view,S.team,id,month,month):M.sum(M.rows(view,'actual',S.team,id,month,month));return `<td class="right">${edit?(c?`<input type="number" step="0.01" min="0" data-budget="${id}" data-month="${month}" aria-label="${c.name} ${month}预算" value="${S.editing[`${S.team}|${id}|${month}`]??v}">`:`<span class="money">${money(v)}</span>`):moneyLink(v,'actual',id,month,month)}</td>`;}).join('')}</tr>`);
  }
  return `<div class="table-wrap"><table class="annual-table"><thead><tr><th>预算科目</th><th class="right">财年${edit?'预算':'实际'}合计</th>${M.months.map(m=>`<th class="right">${m}</th>`).join('')}</tr></thead><tbody>${S.empty?'':out.join('')}</tbody></table></div>${S.empty||!out.length?emptyState():''}`;
}
function budgetPage(){return header('团队预算编制',`${team().name} · 2026财年（2026-02 至 2027-01） · 单位：元`,true)+`<div class="panel"><div class="panel-toolbar"><div class="filters"><label class="field">责任团队<select id="team-select">${options(M.teams.map(t=>[t.id,t.name]),S.team)}</select></label><span class="tag">复用现有编制流程</span></div><div class="filters"><span class="muted" id="dirty-label">${S.dirty?'有未保存的预算修改':''}</span><button data-action="cancel-budget">取消修改</button><button class="primary" data-action="save-budget">保存预算</button></div></div><div class="read-only-banner">仅编辑预算金额。实际值通过已有导入入口及报销、付款业务产生。</div>${annualTable(true)}</div>`;}
function detailContext(){return S.ctx||{id:'',start:M.months[0],end:M.months[11],expenseOnly:true};}
function detailRows(){
  const ctx=detailContext();let rows=M.rows(view,S.page==='actual'?'actual':'frozen',S.team,ctx.id,ctx.start,ctx.end);
  if(ctx.expenseOnly)rows=rows.filter(r=>!M.groupFor(r.subject).income);
  if(S.filter.origin)rows=rows.filter(r=>(r.source==='人工导入'?'人工导入':'单据使用')===S.filter.origin);
  if(S.filter.source)rows=rows.filter(r=>r.source===S.filter.source);
  if(S.filter.subject)rows=rows.filter(r=>r.subject===S.filter.subject);
  if(S.filter.month)rows=rows.filter(r=>r.month===S.filter.month);
  if(S.filter.keyword)rows=rows.filter(r=>`${r.source==='人工导入'?'':r.number}${r.documentTitle||''}`.includes(S.filter.keyword));
  if(S.filter.person)rows=rows.filter(r=>M.applicantLabel(r).includes(S.filter.person));
  if(S.filter.status)rows=rows.filter(r=>r.status===S.filter.status);
  return S.empty?[]:rows.sort((a,b)=>S.sortDesc?b.amount-a.amount:a.amount-b.amount);
}
function details(){
  const actual=S.page==='actual',ctx=detailContext(),rows=detailRows(),pages=Math.max(1,Math.ceil(rows.length/10));S.pageNo=Math.min(S.pageNo,pages);
  const shown=rows.slice((S.pageNo-1)*10,S.pageNo*10),sub=ctx.id?M.subject(ctx.id).name:ctx.expenseOnly?'全部支出科目':'全部科目',period=ctx.start===ctx.end?ctx.start:`${ctx.start} 至 ${ctx.end}`;
  const scope=`${team().name} · ${sub} · 预算归属期间：${period}`;
  let summary=actual?`<div class="source-summaries"><span>实际使用净额<strong class="money">${money(M.sum(rows))}</strong></span>${['人工导入','单据使用'].map(src=>`<span>${src}<strong class="money">${money(M.sum(rows.filter(r=>(r.source==='人工导入'?'人工导入':'单据使用')===src)))}</strong></span>`).join('')}</div>`:`<div class="source-summaries"><span>当前有效冻结<strong class="money">${money(M.sum(rows))}</strong></span><span>在途单据<strong>${new Set(rows.map(r=>r.number)).size}</strong><span class="source-count">笔（去重）</span></span><span class="muted">按费用行／预算分摊行展示</span></div>`;
  return header(titles[S.page],scope,true)+`<div class="panel"><div class="panel-toolbar">${summary}<button data-action="export" class="small">↓ 导出明细</button></div><div class="detail-filters">${actual?`<label class="field">来源类型<select id="filter-origin">${options([['','全部来源'],['人工导入','人工导入'],['单据使用','单据使用']],S.filter.origin)}</select></label>`:''}<label class="field">单据类型<select id="filter-source" ${S.filter.origin==='人工导入'?'disabled':''}>${options([['',S.filter.origin==='人工导入'?'不适用':'全部单据类型'],...M.documentTypes.map(s=>[s,s])],S.filter.source)}</select></label><label class="field">科目<select id="filter-subject">${options([['','全部科目'],...M.ids(ctx.id).filter(id=>!ctx.expenseOnly||!M.groupFor(id).income).map(id=>[id,M.subject(id).name])],S.filter.subject)}</select></label><label class="field">归属月<select id="filter-month">${options([['','全部月份'],...M.months.filter(m=>m>=ctx.start&&m<=ctx.end).map(m=>[m,m])],S.filter.month)}</select></label>${actual?'':`<label class="field">状态<select id="filter-status">${options([['','全部状态'],...M.documentStatuses.map(s=>[s,s])],S.filter.status)}</select></label>` }<label class="field">申请人<input id="filter-person" value="${esc(S.filter.person)}" placeholder="姓名／工号" style="width:130px"></label><label class="field"><input id="filter-keyword" value="${esc(S.filter.keyword)}" placeholder="单号／单据标题" aria-label="搜索单号或单据标题"></label><button class="primary small" data-action="detail-query">查询</button><button class="small" data-action="clear-filters">重置</button></div><div class="table-wrap"><table><thead><tr><th>单号</th>${actual?'<th>来源类型</th>':''}<th>单据类型</th><th>预算科目</th><th>预算归属月</th><th>申请人</th><th>单据标题</th><th class="right"><button class="link" data-action="sort">${actual?'实际金额':'当前冻结'} ${S.sortDesc?'↓':'↑'}</button></th>${actual?'<th>实际确认日期</th>':'<th>状态</th><th>提交日期／在途天数</th><th>管控科目</th>'}</tr></thead><tbody>${shown.map(r=>{const ctl=M.control(view,S.team,r.subject,r.month);return `<tr><td>${r.source==='人工导入'?'—':link(esc(r.number),'record',`data-id="${r.id}"`)}</td>${actual?`<td>${r.source==='人工导入'?`<button class="plain-text-action" data-action="record" data-id="${r.id}">人工导入</button>`:'<span>单据使用</span>'}</td>`:''}<td>${r.source==='人工导入'?'—':esc(r.source)}</td><td>${M.subject(r.subject).name}</td><td>${r.month}</td><td>${esc(M.applicantLabel(r))}</td><td>${esc(r.documentTitle||'—')}</td><td class="right money ${r.amount<0?'negative':''}">${money(r.amount)}</td>${actual?`<td>${r.date}</td>`:`<td>${esc(r.status)}</td><td>${r.date}<div class="batch-note">${r.days} 天</div></td><td>${ctl&&!ctl.group?M.subject(ctl.pool).name:'—'}</td>`}</tr>`;}).join('')}</tbody></table></div>${rows.length?'':emptyState()}<div class="panel-foot"><span>共 ${rows.length} 条费用／分摊明细 · 合计按完整筛选范围计算</span><div class="foot-right"><button class="small" data-action="prev" ${S.pageNo===1?'disabled':''}>‹</button><button class="small page-current">${S.pageNo}</button><span>/ ${pages}</span><button class="small" data-action="next" ${S.pageNo>=pages?'disabled':''}>›</button><span>10 条／页</span></div></div></div><div class="footer-help">${actual?'仅查询，不提供人工录入。人工数据通过已有实际值导入入口维护。':'冻结金额为当前有效余额；已释放或已转实际的部分不再计入。'}</div>`;
}
function renderImport(){
  const batches=Object.values(view.actual.filter(r=>r.source==='人工导入'&&r.team===S.team).reduce((a,r)=>{const key=r.month;(a[key]??={...r,count:0,total:0}).count++;a[key].total+=r.amount;return a;},{})).reverse();
  return header('实际值导入','财务预算 / 批量操作 / 导入实际 · 复用已有导入功能',true)+`<div class="panel"><div class="import-hero"><div><h2>实际数据批量导入</h2><p class="notice-text">通过已有入口导入系统外实际金额，按团队、预算科目及归属月归集。</p></div><span class="tag">既有功能示意</span></div><div class="upload-box">已有实际值导入流程<br><span class="batch-note">本原型不提交文件，不修改真实数据</span></div></div><div class="panel"><div class="section-heading"><h2>导入记录 · ${team().name}</h2></div><div class="table-wrap"><table><thead><tr><th>导入批次</th><th>归属月份</th><th>导入人</th><th>导入时间</th><th>导入明细数</th><th class="right">导入金额</th><th>操作</th></tr></thead><tbody>${batches.map(b=>`<tr><td>${b.number}</td><td>${b.month}</td><td>${esc(M.importerLabel(b))}</td><td>${b.imported}</td><td>${b.count}</td><td class="right money">${money(b.total)}</td><td>${link('查看导入实际','import-actual',`data-month="${b.month}"`)}</td></tr>`).join('')}</tbody></table></div></div>`;
}
function renderRules(){return header('预算管控规则','复用现有配置 · 当前展示生效规则，不在执行页面编辑')+`<div class="rule-grid">${M.groups.filter(g=>!g.income).map(g=>`<div class="rule-card"><span class="tag">${groupRule(g)[0]==='1'?'一级科目管控':'二级科目管控'}</span><h2>${g.name}</h2><div>${M.ruleNames[groupRule(g)]}</div><p>管控科目：${groupRule(g)[0]==='1'?g.name:g.children.map(c=>c.name).join('、')}<br>期间范围：${groupRule(g)[1]==='c'?'财年起始月至预算归属月':'仅预算归属月'}<br>${groupRule(g)[0]==='1'?'下属科目共享一级额度，不重复累计。':'各二级科目独立计算可用额度。'}</p>${link('查看执行','nav',`data-page="execute"`)}</div>`).join('')}</div><div class="mapping">原型演示：使用顶部“行政办公管控方式变更”场景切换四种规则。触发后先提示变化，刷新才应用新规则及重算结果。</div>`;}
const approvalUI=window.createApprovalPage({esc,drawer,closeDrawer,notify,render,openAdjustment});
const applicationUI=window.createApplicationPage({esc,money,model:M,getData:()=>latest,getTeam:()=>S.team,render,dirty:value=>{S.dirty=value;renderWorkspace();},openRequest:id=>openWorkspace('request',id),openAdjustment,submitRecord:record=>approvalUI.add(record),close:()=>closeWorkspace(workspace.active),drawer,closeDrawer,notify});
const adjustmentUI=window.createAdjustmentPage({esc,money,model:M,record:id=>approvalUI.record(id),getId:()=>S.approvalId,render,close:()=>closeWorkspace(workspace.active),drawer,closeDrawer,notify});
function renderSidebar(page=S.page){
  const office=['approval','application','request','adjustment'].includes(page),active=page==='request'?'application':page==='adjustment'?'approval':['execute','budget','actual','frozen','import','reimbursement'].includes(page)?'overview':page;
  document.querySelectorAll('.sidebar .subnav button').forEach(b=>{const selected=(b.dataset.page||b.dataset.navKey)===active;b.classList.toggle('active',selected);if(selected)b.setAttribute('aria-current','page');else b.removeAttribute('aria-current');});
  $('.budget-menu>summary').classList.toggle('selected',!office&&page!=='empty');
  $('.office-menu>summary').classList.toggle('selected',office);
}
function render(){
  renderWorkspace();
  $('#content').classList.toggle('approval-content-page',['approval','adjustment','application','request','reimbursement'].includes(S.page));
  renderSidebar();
  $('#content').dataset.erpPage=S.page;
  $('#content').innerHTML=({overview,execute,budget:budgetPage,actual:details,frozen:details,import:renderImport,rules:renderRules,approval:approvalUI.render,adjustment:adjustmentUI.render,application:applicationUI.entry,request:applicationUI.render,reimbursement:window.renderReimbursementExample,empty:()=>'<div class="empty workspace-empty"><div class="empty-symbol">▤</div><b>暂无打开的页面</b><span>请从左侧菜单打开页面</span></div>'}[S.page])();
}
function drawer(title,subtitle,body,foot='',wide=false){$('#overlay').hidden=false;$('#overlay').innerHTML=`<section class="drawer ${wide?'wide':''}" role="dialog" aria-modal="true" aria-label="${esc(title)}" tabindex="-1"><div class="drawer-head"><div><h2>${title}</h2><p>${subtitle}</p></div><button class="close" data-action="close" aria-label="关闭">×</button></div><div class="drawer-body">${body}</div><div class="drawer-foot">${foot}<button data-action="close">关闭</button></div></section>`;document.body.style.overflow='hidden';$('#overlay .drawer').focus();}
function confirmDialog(title,body,foot){drawer(title,'',body);$('#overlay .drawer').classList.add('confirmation-modal');$('#overlay .drawer-foot').innerHTML=foot;}
let previousFocus;
function closeDrawer(){const wasOpen=!$('#overlay').hidden;$('#overlay').hidden=true;$('#overlay').innerHTML='';document.body.style.overflow='';if(wasOpen&&previousFocus?.isConnected)previousFocus.focus();if(wasOpen)renderSidebar();}
function showControl(id){const ctl=M.control(view,S.team,id,S.month);if(!ctl||ctl.group)return;
  const range=ctl.start===ctl.end?ctl.end:`${ctl.start} 至 ${ctl.end}`;
  drawer('管控额度计算说明',`${team().name} · ${S.month} · 单位：元`,`<dl class="definition"><dt>费用科目</dt><dd>${M.subject(id).name}</dd><dt>命中管控科目</dt><dd>${M.subject(ctl.pool).name}${ctl.shared?'<span class="tag dialog-badge">共享额度池</span>':''}</dd><dt>管控方式</dt><dd><span class="tag red">${M.ruleNames[ctl.rule]}</span></dd><dt>管控期间</dt><dd>${range}</dd><dt>数据截至</dt><dd>${view.asof}（示例）</dd></dl><div class="calculation"><div class="calc-row"><span>范围内预算</span><span class="money">${money(ctl.budget)}</span></div><div class="calc-row"><span><span class="calc-sign">−</span>范围内实际</span>${moneyLink(ctl.actual,'actual',ctl.pool,ctl.start,ctl.end)}</div><div class="calc-row"><span><span class="calc-sign">−</span>范围内有效冻结</span>${moneyLink(ctl.frozen,'frozen',ctl.pool,ctl.start,ctl.end)}</div><div class="calc-row result"><span><span class="calc-sign">＝</span>管控可用额度</span><strong class="money ${ctl.available<0?'negative':''}">${money(ctl.available)}</strong></div></div>`);
}
function showRecord(id){const r=[...view.actual,...view.frozen].find(r=>r.id===id);if(!r)return;
  if(S.denied){drawer('无单据详情权限','汇总与明细权限分别控制',`<div class="empty"><div class="empty-symbol">▣</div><b>当前账号无权查看此单据详情</b><span>请联系管理员申请相应团队或单据权限。</span></div>`);return;}
  if(r.source!=='人工导入'){
    openReimbursement();return;
  }
  const imported=r.source==='人工导入',frozen=r.id.startsWith('f');
  const ctl=M.control(view,S.team,r.subject,r.month);
  drawer(imported?'导入来源追溯':`${r.source}详情`,`${imported?'已有导入记录':'已有单据详情'} · 示例预览`,`<div class="status-line"><div><div class="doc-caption">${frozen?'当前有效冻结':'本行实际使用'} · 元</div><div class="doc-amount money">${money(r.amount)}</div></div><span>${esc(frozen?r.status:'已计入实际')}</span></div><dl class="definition"><dt>${imported?'导入批次编号':'单号'}</dt><dd>${r.number}</dd><dt>来源类型</dt><dd>${imported?'人工导入':'单据使用'}</dd>${imported?'':`<dt>单据类型</dt><dd>${r.source}</dd><dt>单据状态</dt><dd><span>${esc(r.status||'—')}</span></dd>`}<dt>预算承担团队</dt><dd>${team().name}</dd><dt>预算科目</dt><dd>${M.subject(r.subject).name}</dd><dt>预算归属月</dt><dd>${r.month}</dd>${imported?`<dt>导入内容</dt><dd>${esc(r.summary)}</dd>`:`<dt>单据标题</dt><dd>${esc(r.documentTitle||'—')}</dd>`}<dt>${imported?'原始行号':'费用／分摊行号'}</dt><dd>${r.line}</dd>${imported?`<dt>导入人</dt><dd>${esc(M.importerLabel(r))}</dd><dt>导入时间</dt><dd>${r.imported}</dd><dt>原始文件</dt><dd>${r.month}_系统外实际.xlsx</dd>`:`<dt>申请人</dt><dd>${esc(M.applicantLabel(r))}</dd><dt>命中管控科目</dt><dd>${ctl&&!ctl.group?M.subject(ctl.pool).name:'—'}</dd>`}<dt>${frozen?'提交日期':'实际确认日期'}</dt><dd>${r.date}</dd></dl>${frozen?`<h2>当前处理情况</h2><div class="timeline"><div>已提交预算占用<p>${r.date} · ${esc(M.applicantLabel(r))}提交</p></div><div>${r.node}<p>已停留 ${r.days} 天 · 未转实际部分继续冻结</p></div></div>`:''}<div class="drawer-callout">${imported?'此处只读查看导入来源；数据纠错仍通过已有导入管理入口处理。':'本面板为原单跳转示意，实际接入后进入已有单据详情。'}</div>`,imported?'<button class="primary" data-action="nav" data-page="import">查看已有导入记录</button>':'',true);
}
async function refresh(){
  if(S.refreshFail){S.refreshFail=false;S.pending='刷新失败，仍保留原数据与截至时间；可点击重试';render();notify('刷新失败，尚未更新任何展示数据');return;}
  const buttons=[...document.querySelectorAll('[data-action="refresh"]')];buttons.forEach(b=>{b.disabled=true;b.textContent='更新中…';});
  await new Promise(r=>setTimeout(r,350));view=structuredClone(latest);S.pending='';render();notify('规则、金额和明细已同步至同一数据版本');
}
function bump(){latest.version++;latest.asof=`2026-10-20 14:${String(30+Math.floor(latest.version/2)).padStart(2,'0')}:${String(25+latest.version%2*15).padStart(2,'0')}`;}
function simulate(){
  const value=$('#scenario').value;
  if(value==='empty'){S.empty=true;render();notify('已切换为空数据场景，重置演示可恢复');return;}
  if(value==='denied'){S.denied=true;notify('已开启无详情权限场景，请点击明细中的单号');return;}
  if(value==='fail'){S.refreshFail=true;S.pending='检测到数据更新';render();notify('点击刷新可查看失败状态，再次重试可恢复');return;}
}
function exportRows(){
  let headers,rows;
  if(['actual','frozen'].includes(S.page)){
    const actual=S.page==='actual';headers=['单号',...(actual?['来源类型']:[]),'单据类型','申请人','单据标题','费用行','团队','预算科目','预算归属月',actual?'实际金额':'当前冻结金额',actual?'实际确认日期':'提交日期',...(!actual?['状态','当前节点']:[])];
    rows=detailRows().map(r=>[r.source==='人工导入'?'—':r.number,...(actual?[r.source==='人工导入'?'人工导入':'单据使用']:[]),r.source==='人工导入'?'—':r.source,M.applicantLabel(r),r.documentTitle||'—',r.line,team().name,M.subject(r.subject).name,r.month,r.amount,r.date,...(!actual?[r.status,r.node]:[])]);
  }else{
    headers=S.mode==='annual'?['预算科目','财年预算','财年实际','当前有效冻结',...M.months.map(m=>m+' '+{budget:'预算',actual:'实际',frozen:'冻结'}[S.annualMetric])]:['预算科目','本月预算','本月实际','本月冻结','管控方式','管控科目','管控期间','管控可用'];rows=[];
    for(const g of visibleGroups())for(const c of [null,...g.children]){const id=c?.id||g.id;if(S.mode==='annual'){const m=M.metrics(view,S.team,id,M.months[0],M.months[11]);rows.push([M.subject(id).name,m.budget,m.actual,g.income?'—':m.frozen,...M.months.map(month=>g.income&&S.annualMetric==='frozen'?'—':M.metrics(view,S.team,id,month,month)[S.annualMetric])]);}else{const v=M.metrics(view,S.team,id,S.month,S.month),ctl=M.control(view,S.team,id,S.month);rows.push([M.subject(id).name,v.budget,v.actual,g.income?'—':v.frozen,ctl?M.ruleNames[ctl.rule]:'—',ctl&&!ctl.group?M.subject(ctl.pool).name:'—',ctl&&!ctl.group?`${ctl.start}至${ctl.end}`:'—',ctl&&!ctl.group?(ctl.shared?`共享${M.subject(ctl.pool).name}额度`:ctl.available):'—']);}}
  }
  const context=detailContext(),meta=[['预算管理优化原型－示例数据'],['页面',titles[S.page]],['团队',team().name],['数据截至',view.asof],['版本',view.version],['期间',['actual','frozen'].includes(S.page)?`${context.start}至${context.end}`:S.mode==='annual'?`${M.months[0]}至${M.months[11]}`:S.month],['各月分布指标',S.page==='execute'&&S.mode==='annual'?{budget:'预算',actual:'实际',frozen:'冻结'}[S.annualMetric]:'不适用'],['来源筛选',S.filter.origin||'全部'],['单据类型筛选',S.filter.source||'全部'],['状态筛选',S.filter.status||'全部'],['科目筛选',S.filter.subject?M.subject(S.filter.subject).name:context.id?M.subject(context.id).name:S.search?M.subject(S.search).name:'全部'],[]];
  const csv='\uFEFF'+[...meta,headers,...rows].map(row=>row.map(v=>'"'+String(v??'').replace(/"/g,'""')+'"').join(',')).join('\r\n');
  const url=URL.createObjectURL(new Blob([csv],{type:'text/csv;charset=utf-8'})),a=document.createElement('a');a.href=url;a.download=`${titles[S.page]}_示例_${view.version}.csv`;a.click();setTimeout(()=>URL.revokeObjectURL(url),500);notify('已导出当前数据版本下的全部筛选结果');
}
function readDetailFilters(){for(const key of ['origin','source','subject','month','keyword','status','person']){const el=$(`#filter-${key}`);if(el)S.filter[key]=el.value.trim();}if(S.filter.origin==='人工导入')S.filter.source='';else if(S.filter.source)S.filter.origin='单据使用';S.pageNo=1;render();}
document.addEventListener('click',e=>{
  if(!e.target.closest('.execution-note-trigger,#execution-note'))hideExecutionNote();
  const cascade=document.querySelector('.subject-cascader[open]');if(cascade&&!cascade.contains(e.target))cascade.open=false;
  const batch=document.querySelector('.legacy-batch[open]');if(batch&&(!batch.contains(e.target)||e.target.closest('.legacy-batch-menu button')))batch.open=false;
  const b=e.target.closest('button');if(!b||b.disabled)return;
  if(b.id==='simulate'){simulate();return;}
  if(b.id==='reset-demo'){adjustmentUI.reset();applicationUI.reset();approvalUI.reset();latest=M.createData();view=structuredClone(latest);Object.assign(S,{pending:'',refreshFail:false,empty:false,denied:false,editing:{},dirty:false});render();closeDrawer();notify('演示已恢复初始数据');return;}
  const action=b.dataset.action||(b.dataset.page?'nav':'');previousFocus=b;
  if(action.startsWith('application-')){applicationUI.click(b);return;}
  if(action.startsWith('adjustment-')){adjustmentUI.click(b);return;}
  if(action.startsWith('approval-')){approvalUI.click(b);return;}
  switch(action){
    case 'nav':openWorkspace(b.dataset.page);break;
    case 'activate-workspace':activateWorkspace(b.dataset.key);break;
    case 'close-workspace':closeWorkspace(b.dataset.key);break;
    case 'discard-workspace':closeWorkspace(b.dataset.key,true);break;
    case 'back':goBack();break;
    case 'team-nav':openWorkspace(b.dataset.page,b.dataset.team);break;
    case 'team-detail':openDetail(b.dataset.type,'',M.months[0],M.months[11],b.dataset.team,true);break;
    case 'detail':openDetail(b.dataset.type,b.dataset.subject,b.dataset.start,b.dataset.end,S.team,!b.dataset.subject);break;
    case 'control':showControl(b.dataset.subject);break;
    case 'record':showRecord(b.dataset.id);break;
    case 'close':closeDrawer();break;
    case 'refresh':refresh();break;
    case 'mode':S.mode=b.dataset.mode;render();break;
    case 'annual-metric':S.annualMetric=b.dataset.metric;render();break;
    case 'execution-note':{const note=$('#execution-note');if(note?.dataset.pinned==='true')hideExecutionNote();else{showExecutionNote();if(note)note.dataset.pinned='true';}break;}
    case 'subject-branch':showSubjectBranch(b.dataset.group);break;
    case 'collapse':S.collapsed.has(b.dataset.group)?S.collapsed.delete(b.dataset.group):S.collapsed.add(b.dataset.group);render();break;


    case 'overview-select-team':drawer('选择团队','按原有团队筛选入口查询',`<label class="field">责任团队<select id="overview-team">${options([['','全部团队'],...M.teams.map(t=>[t.id,t.name])],S.overviewTeam)}</select></label>`);break;
    case 'bulk-import-actual':{const checked=[...document.querySelectorAll('[data-overview-check]:checked')];openWorkspace('import',S.overviewTeam||(checked.length===1?checked[0].dataset.overviewCheck:S.team));break;}
    case 'office-entry':openWorkspace('application');break;
    case 'legacy-existing':drawer(esc(b.dataset.label),'沿用现有功能',`<div class="drawer-callout">此入口保留原位置及用途，继续使用现有${esc(b.dataset.label)}功能。本原型不操作真实业务数据。</div>`);break;
    case 'overview-query':S.overviewSearch=$('#overview-search').value.trim();render();break;
    case 'detail-query':readDetailFilters();break;
    case 'clear-filters':S.filter={origin:'',source:'',subject:'',month:'',keyword:'',status:'',person:''};S.search='';S.overviewSearch='';S.overviewTeam='';S.onlyFrozen=false;S.empty=false;S.pageNo=1;render();break;
    case 'next':S.pageNo++;render();break;
    case 'prev':S.pageNo--;render();break;
    case 'sort':S.sortDesc=!S.sortDesc;render();break;
    case 'export':exportRows();break;
    case 'save-budget':
      if(!S.dirty){notify('没有需要保存的预算修改');break;}
      if(Object.values(S.editing).some(v=>v===''||!Number.isFinite(Number(v))||Number(v)<0)){notify('请输入有效的非负预算金额');break;}
      for(const [k,v] of Object.entries(S.editing))latest.budgets[k]=Math.round(Number(v)*100)/100;
      S.editing={};S.dirty=false;bump();S.pending='预算额度已更新';view=structuredClone(latest);S.pending='';render();notify('示例预算已保存，执行额度已同步重算；未写入真实系统');break;
    case 'cancel-budget':S.editing={};S.dirty=false;render();notify('已取消未保存的修改');break;
    case 'import-actual':openDetail('actual','',b.dataset.month,b.dataset.month,S.team);S.filter.origin='人工导入';render();break;
    case 'forecast':drawer('年度预测','已有预测功能 · 复用入口',`<div class="drawer-callout">团队：${M.teams.find(t=>t.id===b.dataset.team).name}<br>2026财年预测编制沿用现有功能。本次原型重点为预算执行、冻结和实际来源查询。</div>`);break;
  }
});
document.addEventListener('pointerover',e=>{if(e.target.closest('.execution-note-trigger'))showExecutionNote();const row=e.target.closest('.cascader-parent');if(row&&!row.contains(e.relatedTarget))showSubjectBranch(row.dataset.cascaderGroup);});
document.addEventListener('pointerout',e=>{if(e.target.closest('.execution-note-trigger,#execution-note')&&!e.relatedTarget?.closest?.('.execution-note-trigger,#execution-note')&&$('#execution-note')?.dataset.pinned!=='true')hideExecutionNote();});
document.addEventListener('focusout',e=>{if(e.target.closest('.execution-note-trigger')&&!e.relatedTarget?.closest?.('#execution-note')&&$('#execution-note')?.dataset.pinned!=='true')hideExecutionNote();});
window.addEventListener('scroll',hideExecutionNote,true);
window.addEventListener('resize',hideExecutionNote);
document.addEventListener('focusin',e=>{if(e.target.closest('.execution-note-trigger'))showExecutionNote();const row=e.target.closest('.cascader-parent');if(row)showSubjectBranch(row.dataset.cascaderGroup);});
document.addEventListener('change',e=>{
  const el=e.target;
  if(el.id?.startsWith('approval-')||el.dataset.approvalCheck){approvalUI.change(el);return;}
  if(el.id==='team-select'){openWorkspace(S.page,el.value);return;}
  if(el.id==='month-select'){S.month=el.value;render();return;}
  if(el.name==='execution-subject'){S.search=el.value;render();$('#execution-subject').focus();return;}
  if(el.id==='overview-team'){S.overviewTeam=el.value;closeDrawer();render();return;}
  if(el.id==='overview-check-all'){document.querySelectorAll('[data-overview-check]').forEach(box=>box.checked=el.checked);return;}
  if(el.id==='only-frozen'){S.onlyFrozen=el.checked;render();return;}
  if(el.id?.startsWith('filter-')&&el.tagName==='SELECT')readDetailFilters();
});
document.addEventListener('input',e=>{const el=e.target;if(el.dataset.applicationValue||el.dataset.applicationReason){applicationUI.input(el);return;}if(el.dataset.budget){S.editing[`${S.team}|${el.dataset.budget}|${el.dataset.month}`]=el.value;S.dirty=true;$('#dirty-label').textContent='有未保存的预算修改';renderWorkspace();}});
document.addEventListener('keydown',e=>{
  if(e.key==='Escape'){if($('#execution-note')?.matches(':popover-open')){hideExecutionNote();return;}const cascade=document.querySelector('.subject-cascader[open]');if(cascade){cascade.open=false;$('#execution-subject').focus();return;}closeDrawer();const batch=document.querySelector('.legacy-batch[open]');if(batch){batch.open=false;batch.querySelector('summary').focus();}}
  if(e.key==='Enter'){if(e.target.id==='approval-search'||e.target.id==='approval-applicant'||e.target.id==='approval-department'){approvalUI.query();return;}if(e.target.id==='overview-search'){S.overviewSearch=e.target.value.trim();render();}else if(e.target.id?.startsWith('filter-'))readDetailFilters();}
  if(e.key==='Tab'&&!$('#overlay').hidden){const focusable=[...$('#overlay').querySelectorAll('button,input,select,textarea,[tabindex="0"]')].filter(e=>!e.disabled);if(focusable.length){const first=focusable[0],last=focusable.at(-1);if(e.shiftKey&&(document.activeElement===first||document.activeElement===$('#overlay .drawer'))){e.preventDefault();last.focus();}else if(!e.shiftKey&&document.activeElement===last){e.preventDefault();first.focus();}}}
});
$('#overlay').addEventListener('click',e=>{if(e.target===$('#overlay'))closeDrawer();});
window.addEventListener('message',event=>{const frame=$('.reimbursement-frame');if(frame&&event.source===frame.contentWindow&&event.data?.type==='budget-close-reimbursement')closeWorkspace('reimbursement');});
window.addEventListener('hashchange',()=>{const p=location.hash.slice(1);if(titles[p]){if(['actual','frozen'].includes(p)){S.page=p;closeDrawer();render();}else openWorkspace(p);}});
render();
document.querySelector('erp-iteration-marks')?.configure(window.BudgetIterationMarks,{
  root:$('#content'),
  toolbar:!window.ERPClient?.hosted,storage:!window.ERPClient?.hosted,
  configGlobal:'BudgetIterationMarks',
  documentBase:window.BudgetMarkDocumentBase||new URL('../../../../',location.href).href,
  navigate:(page,mark)=>{if(!titles[page])return;if(page!==S.page){if(['actual','frozen'].includes(page))openDetail(page,'',M.months[0],M.months[11]);else openWorkspace(page);}if(page==='execute'){if(mark.id==='execution-annual')S.mode='annual';if(['execution-monthly','execution-balance'].includes(mark.id))S.mode='monthly';render();}}
});
if(window.ERPClient?.hosted)window.ERPIterationBridge.renderer(document.querySelector('erp-iteration-marks'),'budget');
window.ERPClient?.connect({snapshot:erpSnapshot,navigate:page=>{if(['overview','rules','application','approval'].includes(page))openWorkspace(page);},activate:activateWorkspace,close:closeWorkspace});
})();
