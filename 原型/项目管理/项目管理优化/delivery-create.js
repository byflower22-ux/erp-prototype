/* Full-page project creation, using the same delivery ledger and member ratios. */
(function(root){
  'use strict';
  const U=root.ProjectUI,{esc:e,button:b,options}=U;
  const roles=['项目总监','项目经理','辅助交付人','咨询师'];
  const teams=s=>[...new Set(['博商管理咨询','开发团队',...s.projects.map(p=>root.ProjectDelivery.info(s,p).team)])];
  function orders(s){return s.projects.map(p=>{const info=root.ProjectDelivery.info(s,p);return {id:info.order,name:info.order+' · '+p.name,project:p,info};});}
  const newMember=role=>({key:crypto.randomUUID(),personId:'',role,ratio:'0'});
  function create(s,month){return {revision:s.revision,dirty:false,error:'',fields:{orderNo:'',contractNo:'',name:'',amount:'',customer:'',company:'',salesId:'',accountManager:'',managerDepartment:'',team:'',business:'',projectType:'',type:'',budget:'',startDate:month+'-09',endDate:'',note:''},members:roles.slice(0,3).map(newMember),expenseTeams:[],files:[]};}
  function capture(form,d){
    if(!form)return;
    for(const key of Object.keys(d.fields)){const el=form.elements.namedItem(key);if(el)d.fields[key]=el.value;}
    d.members.forEach(row=>{for(const key of ['personId','role','ratio']){const el=form.elements.namedItem(key+'-'+row.key);if(el)row[key]=el.value;}});
    d.expenseTeams=[...form.querySelectorAll('[name="expenseTeam"]:checked')].map(el=>el.value);
  }
  function chooseOrder(s,d){const found=orders(s).find(x=>x.id===d.fields.orderNo);if(!found)return;
    const {project:p,info}=found;Object.assign(d.fields,{contractNo:'HT202611'+p.id.replace(/\D/g,'').padStart(4,'0'),name:p.name,amount:String(p.contract),customer:p.customer||info.company,company:info.company,team:info.team,business:info.business,projectType:'咨询',type:p.type,salesId:p.ownerId,accountManager:info.owner,managerDepartment:root.ProjectConsultants.profile(s.people.find(x=>x.id===p.ownerId)||{}).department||'博商管理咨询'});
  }
  function chooseSales(s,d){const p=s.people.find(x=>x.id===d.fields.salesId),profile=p?root.ProjectConsultants.profile(p):null;d.fields.accountManager=profile?.name||'';d.fields.managerDepartment=profile?.department||'';}
  const total=d=>root.ProjectModel.round(d.members.reduce((sum,r)=>sum+(Number(r.ratio)||0),0));
  function render(ctx,d){
    const s=ctx.state,f=d.fields;
    const input=(name,placeholder='',attrs='')=>`<input name="${name}" value="${e(f[name])}" placeholder="${e(placeholder)}" ${attrs}>`;
    const select=(name,rows,placeholder='请选择',attrs='')=>`<select name="${name}" ${attrs}><option value="">${placeholder}</option>${options(rows,f[name])}</select>`;
    const values=items=>items.map(x=>({id:x,name:x}));
    const field=(label,html,required=false)=>`<div class="dc-field"><label${required?' class="required"':''}>${label}</label><div>${html}</div></div>`;
    const auto=(name,placeholder)=>input(name,placeholder,'readonly');
    const personChoices=s.people.map(root.ProjectConsultants.profile).map(p=>({id:p.id,name:p.name+' / '+(p.employeeNo||p.id)}));
    return `<div class="delivery-view delivery-create"><section class="dc-card"><header><h1>新增项目</h1>${b('返回列表','delivery-create-cancel','','link')}</header><form id="delivery-create-form"><div class="dc-grid">
      ${field('关联订单',select('orderNo',orders(s),'请选择','required'),true)}
      ${field('产品所属团队',select('team',values(teams(s)),'请选择','required'),true)}
      ${field('关联合同',auto('contractNo','选择订单后自动带出'))}
      ${field('业务类型',select('business',values(['销售','组织','运营']),'请选择','required'),true)}
      ${field('项目名称',input('name','请输入','required maxlength="100"'),true)}
      ${field('项目类型',select('projectType',values(['咨询','培训','辅导']),'请选择','required'),true)}
      ${field('项目金额(元)',auto('amount','选择订单后自动带出'),true)}
      ${field('项目子类型',select('type',values([...new Set(['管理咨询','组织咨询','专项咨询',...s.projects.map(p=>p.type)])]),'请选择','required'),true)}
      ${field('客户',auto('customer','选择订单后自动带出'),true)}
      ${field('公司名称',auto('company','选择订单后自动带出'))}
      ${field('TOB销售',select('salesId',personChoices,'请选择','required'),true)}
      ${field('项目预算(元)',input('budget','请选择或者输入项目预算','type="number" min="0" step="0.01"'))}
      ${field('客户经理',auto('accountManager','请输入客户经理'),true)}
      ${field('客户经理部门',auto('managerDepartment','请输入客户经理部门'),true)}
      ${field('预计开始时间',input('startDate','','type="date" required'),false)}
      ${field('预计结束时间',input('endDate','','type="date"'),false)}
    </div><div class="dc-field dc-members"><label class="required">团队成员</label><div><p class="dc-tip">提示:若本项目不需要辅助交付，请将辅助交付人员填写为本团队!</p><div class="table-wrap"><table><colgroup>${[160,120,90,135,200,145,120,95,75].map(w=>`<col style="width:${w}px">`).join('')}</colgroup><thead><tr>${['姓名','人员编号','性别','手机号','所属部门','项目角色','收入比例','在职状态','操作'].map(x=>`<th>${x}</th>`).join('')}</tr></thead><tbody>${d.members.map((row,i)=>{
      const raw=s.people.find(p=>p.id===row.personId),p=raw?root.ProjectConsultants.profile(raw):{};
      const readonly=(value,placeholder)=>`<input value="${e(value||'')}" placeholder="${placeholder}" readonly tabindex="-1">`;
      return `<tr data-create-member="${row.key}"><td><select name="personId-${row.key}" aria-label="第${i+1}行成员" required><option value="">请选择</option>${options(personChoices,row.personId)}</select></td><td>${readonly(p.employeeNo,'请输入编号')}</td><td>${readonly(p.gender,'请选择')}</td><td>${readonly(p.phone,'请输入手机号')}</td><td>${readonly(p.department,'请输入部门')}</td><td><select name="role-${row.key}" aria-label="第${i+1}行项目角色" required>${options(values(roles),row.role)}</select></td><td><div class="dc-ratio"><input type="number" name="ratio-${row.key}" aria-label="第${i+1}行收入比例" value="${e(row.ratio)}" min="0" max="100" step="0.01" required><span>%</span></div></td><td>${readonly(p.status,'请输入状态')}</td><td><button type="button" class="dc-row-add" data-action="delivery-create-add" aria-label="添加成员">⊕</button>${d.members.length>3?`<button type="button" class="dc-row-remove" data-action="delivery-create-remove" data-key="${row.key}" aria-label="删除第${i+1}行成员">−</button>`:''}</td></tr>`;
    }).join('')}</tbody></table></div><div class="dc-member-summary"><span>比例生效月份 <b data-create-period>${e(f.startDate?.slice(0,7)||ctx.month)}</b></span><span>收入比例合计 <strong data-create-ratio-total>${total(d)}%</strong></span></div></div></div>
    <div class="dc-field dc-expense"><label class="required">费用承担团队</label><div><details class="dc-team-picker"><summary>＋ 团队</summary><div>${teams(s).map(team=>`<label><input type="checkbox" name="expenseTeam" value="${e(team)}" ${d.expenseTeams.includes(team)?'checked':''}>${e(team)}</label>`).join('')}</div></details><span data-create-teams>${d.expenseTeams.map(team=>`<span class="dc-team-tag">${e(team)}</span>`).join('')}</span></div></div>
    <div class="dc-field dc-note"><label>项目简介说明</label><div><textarea name="note" maxlength="500" placeholder="请输入内容">${e(f.note)}</textarea><small data-create-note-count>${f.note.length} / 500</small></div></div>
    <div class="dc-field dc-attachments"><label>附件上传</label><div><p>最多9个文件，支持 jpg、jpeg、png、bmp、pdf、doc、docx、xls、xlsx，单个文件不超过20MB</p><label class="dc-upload">＋<input type="file" name="attachments" multiple accept=".jpg,.jpeg,.png,.bmp,.pdf,.doc,.docx,.xls,.xlsx" aria-label="选择项目附件"></label><ul>${d.files.map((file,i)=>`<li>${e(file.name)} <button type="button" data-action="delivery-create-file-remove" data-index="${i}" aria-label="移除${e(file.name)}">×</button></li>`).join('')}</ul></div></div>
    <div id="delivery-create-error" class="form-error" role="alert" ${d.error?'':'hidden'}>${e(d.error)}</div><footer class="dc-actions">${b('取消','delivery-create-cancel')}${b('保存项目','delivery-create-save','','primary')}</footer></form></section></div>`;
  }
  function build(s,d){
    const f=d.fields,fail=text=>{throw Error(text);},period=f.startDate.slice(0,7);
    if(!s.months.includes(period))fail('当前 Demo 支持的开始月份为 '+s.months[0]+' 至 '+s.months.at(-1));
    if(s.closed[period]||Object.keys(s.closed).some(m=>m>period))fail(period+' 已月结或存在后续已结月份，不能写入成员收入比例');
    if(!f.name.trim()||!f.orderNo||!f.team||!f.business||!f.projectType||!f.type||!f.salesId)fail('请填写必填项目资料');
    if(!Number.isFinite(Number(f.amount))||Number(f.amount)<0)fail('项目金额须为非负数字');
    if(f.budget!==''&&(!Number.isFinite(Number(f.budget))||Number(f.budget)<0))fail('项目预算须为非负数字');
    if(f.endDate&&f.endDate<f.startDate)fail('预计结束时间不能早于开始时间');
    if(!d.expenseTeams.length)fail('请选择费用承担团队');
    if(d.members.some(r=>!r.personId||!s.people.some(p=>p.id===r.personId)))fail('请选择团队成员');
    if(new Set(d.members.map(r=>r.personId)).size!==d.members.length)fail('团队成员不能重复，请选择不同人员');
    if(!d.members.some(r=>r.role==='项目经理'))fail('团队成员中需要一位项目经理');
    if(d.members.some(r=>r.ratio===''||!Number.isFinite(Number(r.ratio))||Number(r.ratio)<0||Number(r.ratio)>100))fail('收入比例须为0至100%');
    if(d.members.reduce((n,r)=>n+Number(r.ratio),0)>100.000001)fail('成员收入比例合计不能超过100%');
    const next=structuredClone(s),id='p-'+crypto.randomUUID(),code='XM20261109'+String(s.projects.length+1).padStart(4,'0'),manager=d.members.find(r=>r.role==='项目经理');
    next.projects.push({id,code,orderNo:f.orderNo,contractNo:f.contractNo,name:f.name.trim(),company:f.company,customer:f.customer,team:f.team,business:f.business,projectType:f.projectType,type:f.type,ownerId:manager.personId,salesId:f.salesId,accountManager:f.accountManager,managerDepartment:f.managerDepartment,contract:Number(f.amount),receivable:Number(f.amount),budget:f.budget===''?null:Number(f.budget),startDate:f.startDate,endDate:f.endDate,createdAt:'2026-11-09',status:'未开始',note:f.note,expenseTeams:[...d.expenseTeams],attachments:d.files.map(file=>({name:file.name,size:file.size,type:file.type}))});
    d.members.forEach((r,i)=>{next.members.push({projectId:id,personId:r.personId,role:r.role});next.ratios.push({id:'ratio-'+id+'-'+i,projectId:id,personId:r.personId,month:period,ratio:Number(r.ratio)/100});});
    next.revision++;next.audit.push({action:'新增项目',at:new Date().toISOString(),revision:next.revision,detail:{projectId:id,ratioMonth:period}});
    return {state:next,id,period};
  }
  function addFiles(d,files){const all=d.files.concat([...files]);if(all.length>9)throw Error('最多上传9个附件');if(all.some(f=>f.size>20*1024*1024))throw Error('单个附件不能超过20MB');if(all.some(f=>!(/\.(jpe?g|png|bmp|pdf|docx?|xlsx?)$/i).test(f.name)))throw Error('附件格式不支持');d.files=all;}
  root.ProjectDeliveryCreate={create,render,capture,chooseOrder,chooseSales,build,total,addFiles,newMember};
})(window);
