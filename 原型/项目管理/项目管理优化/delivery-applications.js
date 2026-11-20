(function(root){
  'use strict';
  const U=root.ProjectUI,M=root.ProjectModel,{esc:e,money,button:b,options}=U;
  const allocationTeam='博商咨询管理';
  const requiresAllocation=(s,id)=>{const p=s.projects.find(p=>p.id===id);return !!p&&root.ProjectDelivery.info(s,p).team===allocationTeam;};
  function ensureExample(s){
    const p=s.projects.find(p=>p.id==='p1'&&p.name.includes('（示例）')&&!p.team);if(!p)return s;
    const next=structuredClone(s);next.projects.find(row=>row.id===p.id).team=allocationTeam;next.revision++;next.audit.push({action:'更新项目交付分配示例团队',at:new Date().toISOString(),revision:next.revision,detail:{projectId:p.id,team:allocationTeam}});return next;
  }
  const hasAllocation=(s,row)=>row.allocations?.length>0||(row.deliveryTeam?row.deliveryTeam===allocationTeam:requiresAllocation(s,row.projectId));
  const headers=['序号','交付类型','交付审批单号','交付确认申请时间','项目模块','本次完成比例(%)','本次交付金额(元)','本次交付讲师','交付确认完成时间','交付状态','项目人员收入分配','备注说明'];
  const stamp=value=>String(value||'').replace('T',' ').slice(0,19);
  const ratio=(amount,contract)=>contract?M.round(amount/contract*100):0;
  function records(s,id){
    const p=s.projects.find(p=>p.id===id);
    const confirmed=s.delivery.filter(r=>r.projectId===id).map((r,i)=>({...r,kind:r.kind||'落地辅导',applicationNo:r.applicationNo||r.month.replace('-','')+'02'+String(i+1).padStart(11,'0'),appliedAt:r.appliedAt||r.month+'-02 18:59:37',completedAt:r.completedAt||r.month+'-02 18:59:39',ratio:r.ratio??ratio(r.amount,p.contract),status:'已交付',collection:'delivery'}));
    const pending=(s.deliveryApplications||[]).filter(r=>r.projectId===id).map(r=>({...r,collection:'deliveryApplications'}));
    return [...pending.reverse(),...confirmed.reverse()];
  }
  function totals(s,id){const p=s.projects.find(p=>p.id===id),amount=M.round(s.delivery.filter(r=>r.projectId===id).reduce((n,r)=>n+r.amount,0));return {amount,ratio:ratio(amount,p.contract)};}
  function render(ctx,p,tab){
    const rows=records(ctx.state,p.id),t=totals(ctx.state,p.id),size=Number(tab.deliveryPageSize)||10,pages=Math.max(1,Math.ceil(rows.length/size)),page=Math.min(Math.max(1,tab.deliveryPage||1),pages),canApply=ctx.role==='finance'&&p.contract>0;
    return `<div class="delivery-confirmation"><div class="delivery-section-toolbar"><div>${b('刷新','delivery-refresh','','primary')}${b('阶段确认申请','delivery-application','data-kind="阶段确认" '+(canApply?'':'disabled'),'primary')}${b('落地辅导申请','delivery-application','data-kind="落地辅导" '+(canApply?'':'disabled'),'primary')}${b('下载','delivery-confirmation-download','','primary')}</div></div><div class="delivery-confirmation-totals"><div>累计交付金额：<b>${money(t.amount)}元</b></div><div>累计交付比例：<b>${t.ratio}%</b></div></div><div class="table-wrap"><table><colgroup>${[60,120,160,160,150,160,160,160,170,110,160].map(w=>`<col style="width:${w}px">`).join('')}<col></colgroup><thead><tr>${headers.map(h=>`<th>${h}</th>`).join('')}</tr></thead><tbody>${rows.slice((page-1)*size,page*size).map((r,i)=>`<tr><td>${(page-1)*size+i+1}</td><td>${e(r.kind)}</td><td>${b(r.applicationNo,'delivery-application-detail',`data-id="${e(r.id)}"`,'link')}</td><td>${e(stamp(r.appliedAt))}</td><td>${e((r.modules||[]).map(m=>m.name||m).join('、'))}</td><td>${r.ratio}</td><td>${money(r.amount)}</td><td>${e((r.teachers||[]).join('、'))}</td><td>${e(stamp(r.completedAt))}</td><td><span class="${r.status==='审批中'?'delivery-pending':''}">${e(r.status)}</span></td><td>${r.allocations?.length?b('查看详情','delivery-allocation-detail',`data-id="${e(r.id)}"`,'link'):'-'}</td><td>${r.note?e(r.note):b('新增','delivery-application-note',`data-id="${e(r.id)}" ${ctx.role==='finance'?'':'disabled'}`,'link')}</td></tr>`).join('')||'<tr><td colspan="12" class="delivery-no-data">暂无数据</td></tr>'}</tbody></table></div><div class="delivery-pagination delivery-confirmation-pagination"><span>共 ${rows.length} 条</span><select id="delivery-confirmation-size" aria-label="每页条数">${options([10,20,50].map(n=>({id:n,name:n+'条/页'})),size)}</select>${b('‹','delivery-confirmation-page',`data-page="${page-1}" ${page===1?'disabled':''}`)}<button type="button" class="current">${page}</button>${b('›','delivery-confirmation-page',`data-page="${page+1}" ${page===pages?'disabled':''}`)}</div></div>`;
  }
  function projectMembers(s,id){
    const rows=new Map();
    for(const member of s.members.filter(m=>m.projectId===id)){
      const person=s.people.find(p=>p.id===member.personId);if(!person)continue;
      if(rows.has(person.id)){const row=rows.get(person.id);if(!row.roles.includes(member.role))row.roles.push(member.role);continue;}
      const profile=root.ProjectConsultants.profile(person);
      rows.set(person.id,{personId:person.id,name:profile.name,employeeNo:profile.employeeNo||'—',department:profile.department||'—',roles:[member.role]});
    }
    return [...rows.values()];
  }
  function allocationTable(rows,{editable=false}={}){
    return `<div class="table-wrap"><table class="da-allocation-table"><thead><tr>${['姓名','工号','项目角色','所属部门','本次收入分配比例(%)','项目成员收入（元）'].map(h=>`<th>${h}</th>`).join('')}</tr></thead><tbody>${rows.map(row=>`<tr><td>${e(row.name)}</td><td>${e(row.employeeNo)}</td><td>${e(row.roles.join('、'))}</td><td>${e(row.department)}</td><td>${editable?`<div class="da-share-input"><input type="number" min="0" max="100" step="0.01" required placeholder="请输入" data-da-share="${e(row.personId)}" aria-label="${e(row.name)}本次收入分配比例"><span>%</span></div>`:e(row.ratio)+'%'}</td><td><strong ${editable?`data-da-member-income="${e(row.personId)}"`:''}>${editable?'—':money(row.amount)}</strong></td></tr>`).join('')||'<tr><td colspan="6" class="delivery-no-data">暂无项目成员</td></tr>'}</tbody><tfoot><tr><td colspan="4">合计</td><td><strong data-da-share-total>${editable?'0':M.round(rows.reduce((n,r)=>n+r.ratio,0))}%</strong></td><td><strong data-da-income-total>${editable?'—':money(M.round(rows.reduce((n,r)=>n+r.amount,0)))}</strong></td></tr></tfoot></table></div>`;
  }
  function allocationSection(s,id,team){
    return `<section class="da-allocation"><div class="da-allocation-heading"><h3 class="da-required">本次交付收入分配</h3><span>交付团队：${e(team)}</span></div>${allocationTable(projectMembers(s,id),{editable:true})}<p>项目成员收入＝本次交付收入 × 分配比例；比例合计不超过100%，未参与分配填0。</p></section>`;
  }
  function bindAllocation(form,s,id){
    if(!form.querySelector('.da-allocation'))return null;
    const members=projectMembers(s,id),amount=form.elements.deliveryAmount;
    const read=()=>members.map(member=>{const input=form.querySelector(`[data-da-share="${member.personId}"]`),share=input.value===''?null:Number(input.value);return {...member,ratio:share,amount:share==null||!Number.isFinite(share)||amount.value===''?null:M.round(Number(amount.value)*share/100)};});
    const refresh=()=>{
      const rows=read();for(const row of rows)form.querySelector(`[data-da-member-income="${row.personId}"]`).textContent=row.amount==null?'—':money(row.amount);
      const total=M.round(rows.reduce((n,r)=>n+(Number.isFinite(r.ratio)?r.ratio:0),0)),sum=form.querySelector('[data-da-share-total]');sum.textContent=total+'%';sum.classList.toggle('over',total>100);
      form.querySelector('[data-da-income-total]').textContent=amount.value===''?'—':money(M.round(rows.reduce((n,r)=>n+(r.amount||0),0)));
    };
    form.addEventListener('input',refresh);refresh();return read;
  }
  function validateAllocations(s,id,amount,rows,policy){
    const members=projectMembers(s,id);if(!members.length)throw Error('请先在项目中维护项目成员');
    if(!Array.isArray(rows)||rows.length!==members.length||new Set(rows.map(r=>r.personId)).size!==members.length)throw Error('请填写全部项目成员的本次收入分配比例');
    const allocation=members.map(member=>{const row=rows.find(r=>r.personId===member.personId);if(!row||typeof row.ratio!=='number'||!Number.isFinite(row.ratio)||row.ratio<0||row.ratio>100||Math.abs(row.ratio*100-Math.round(row.ratio*100))>1e-7)throw Error('请填写每位成员的分配比例，范围0至100%，最多两位小数');return {...member,ratio:row.ratio,amount:M.round(amount*row.ratio/100)};});
    const total=M.round(allocation.reduce((n,r)=>n+r.ratio,0));
    if(total>100)throw Error('成员收入分配比例合计不能超过100%');
    if(policy==='exact'&&total!==100)throw Error('成员收入分配比例合计必须等于100%');
    return allocation;
  }
  function form(s,id,kind){
    const p=s.projects.find(p=>p.id===id),info=root.ProjectDelivery.info(s,p),t=totals(s,id),received=M.round(s.receipts.filter(r=>r.projectId===id).reduce((n,r)=>n+r.amount,0)),modules=p.deliveryModules||[];
    const field=(label,value)=>`<label class="da-field"><span>${label}</span><input value="${e(value)}" disabled></label>`;
    return `<form id="delivery-application-form"><div class="da-scroll"><div class="da-info-grid">${[['项目编号',info.code],['项目名称',p.name],['项目类型',p.projectType||'咨询'],['项目子类型',p.type],['业务类型',info.business],['项目金额（元）',p.contract],['项目已收款金额（元）',received]].map(([k,v])=>field(k,v)).join('')}</div>${kind==='阶段确认'?`<section class="da-content"><h3 class="da-required">交付内容</h3><div class="table-wrap"><table><thead><tr><th><input type="checkbox" data-da-select-all aria-label="选择全部交付内容" ${modules.length?'':'disabled'}></th>${['序号','项目一级模块','项目二级模块','项目三级模块','具体内容','核心输出','阶段作业说明'].map(h=>`<th>${h}</th>`).join('')}</tr></thead><tbody>${modules.map((m,i)=>`<tr><td><input type="checkbox" name="deliveryModule" value="${e(m.id)}" aria-label="选择${e(m.name)}"></td><td>${i+1}</td>${[m.level1||m.name,m.level2,m.level3,m.content,m.output,m.description].map(v=>`<td>${e(v)}</td>`).join('')}</tr>`).join('')||'<tr><td colspan="8" class="delivery-no-data">暂无数据</td></tr>'}</tbody></table></div></section>`:''}<div class="da-cost-grid"><label class="da-field"><span>本次交付比例(%)</span><input name="deliveryRatio" type="number" min="0.0001" max="100" step="0.0001" placeholder="请输入" required></label><label class="da-field"><span>本次交付金额(元)</span><input name="deliveryAmount" type="number" min="0.01" step="0.01" placeholder="请输入" required></label>${field('累计交付金额(元)(不含本次)',t.amount)}${field('累计交付比例(%)(不含本次)',t.ratio)}</div>${requiresAllocation(s,id)?allocationSection(s,id,info.team):''}<section class="da-attachments"><h3 class="da-required">附件上传</h3><p>请拖拽图片到下方或点击下方按钮，限制最多10个文件，格式要求Word,Excel,ppt,txt,png,jpg文件，且不超过20MB</p><label class="da-upload" tabindex="0" aria-label="选择交付附件">＋<input type="file" multiple accept=".doc,.docx,.xls,.xlsx,.ppt,.pptx,.txt,.png,.jpg,.jpeg" aria-label="选择交付附件"></label><ul data-da-files></ul></section><div id="form-error" class="form-error" role="alert" hidden></div></div><footer class="da-footer">${b('取 消','dialog-close')}${b('确认并提交送审','dialog-save','','primary')}</footer></form>`;
  }
  function bind(form,s,id,dirty){
    const p=s.projects.find(p=>p.id===id),files=[],ratioInput=form.elements.deliveryRatio,amountInput=form.elements.deliveryAmount,input=form.querySelector('input[type=file]'),list=form.querySelector('[data-da-files]');
    const refresh=()=>{list.innerHTML=files.map((file,i)=>`<li><span>${e(file.name)}</span><button type="button" data-da-remove="${i}" aria-label="移除${e(file.name)}">×</button></li>`).join('');};
    const error=message=>{const el=form.querySelector('#form-error');el.textContent=message;el.hidden=!message;};
    const add=items=>{try{const combined=files.concat([...items]);validateFiles(combined);files.splice(0,files.length,...combined);refresh();error('');dirty();}catch(err){error(err.message);}input.value='';};
    input.addEventListener('change',()=>add(input.files));
    list.addEventListener('click',event=>{const b=event.target.closest('[data-da-remove]');if(b){files.splice(Number(b.dataset.daRemove),1);refresh();dirty();}});
    const upload=form.querySelector('.da-upload');upload.addEventListener('keydown',event=>{if(event.target===upload&&(event.key==='Enter'||event.key===' ')){event.preventDefault();input.click();}});
    upload.addEventListener('dragover',event=>{event.preventDefault();upload.classList.add('dragging');});upload.addEventListener('dragleave',()=>upload.classList.remove('dragging'));
    upload.addEventListener('drop',event=>{event.preventDefault();upload.classList.remove('dragging');add(event.dataTransfer.files);});
    ratioInput.addEventListener('input',()=>{amountInput.value=ratioInput.value===''?'':M.round(p.contract*Number(ratioInput.value)/100);});
    amountInput.addEventListener('input',()=>{ratioInput.value=amountInput.value===''?'':Number((Number(amountInput.value)/p.contract*100).toFixed(4));});
    form.querySelector('[data-da-select-all]')?.addEventListener('change',event=>form.querySelectorAll('[name=deliveryModule]').forEach(el=>el.checked=event.target.checked));
    const readAllocation=bindAllocation(form,s,id);
    return ()=>({allocations:readAllocation?readAllocation():[],ratio:Number(ratioInput.value),amount:Number(amountInput.value),modules:[...form.querySelectorAll('[name=deliveryModule]:checked')].map(el=>(p.deliveryModules||[]).find(m=>m.id===el.value)),files:files.map(f=>({name:f.name,size:f.size,type:f.type}))});
  }
  function validateFiles(files){
    if(files.length>10)throw Error('最多上传10个文件');
    if(files.some(f=>f.size>20*1024*1024))throw Error('单个附件不能超过20MB');
    if(files.some(f=>!(/\.(docx?|xlsx?|pptx?|txt|png|jpe?g)$/i).test(f.name)))throw Error('附件格式不支持，请选择Word、Excel、PPT、TXT、PNG或JPG文件');
  }
  function submit(s,id,kind,draft,revision){
    if(revision!==s.revision)throw Error('数据版本已变化，请刷新后重试');
    const p=s.projects.find(p=>p.id===id);if(!p)throw Error('项目不存在');
    if(!['阶段确认','落地辅导'].includes(kind))throw Error('申请类型不正确');
    if(!Number.isFinite(draft.amount)||draft.amount<=0||!Number.isFinite(draft.ratio)||draft.ratio<=0||draft.ratio>100||p.contract<=0)throw Error('请填写有效的交付比例和金额');
    if(Math.abs(draft.amount-p.contract*draft.ratio/100)>Math.max(.011,p.contract*.00000051))throw Error('交付比例和金额不一致');
    const pending=(s.deliveryApplications||[]).filter(r=>r.projectId===id&&r.status==='审批中').reduce((n,r)=>n+r.amount,0);
    if(M.round(totals(s,id).amount+pending+draft.amount)>p.contract)throw Error('本次金额加上已交付及审批中金额不能超过项目总额');
    if(kind==='阶段确认'&&(p.deliveryModules||[]).length&&!draft.modules.length)throw Error('请选择本次交付内容');
    if(draft.modules.some(m=>!m||!(p.deliveryModules||[]).some(row=>row.id===m.id)))throw Error('交付内容已变化，请重新选择');
    const allocations=requiresAllocation(s,id)?validateAllocations(s,id,draft.amount,draft.allocations,'atMost'):[];
    validateFiles(draft.files);if(!draft.files.length)throw Error('请上传交付附件');
    const next=structuredClone(s),at=new Date(),appliedAt=new Intl.DateTimeFormat('sv-SE',{timeZone:'Asia/Shanghai',year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',second:'2-digit',hour12:false}).format(at);
    const entry={deliveryTeam:root.ProjectDelivery.info(s,p).team,allocations,id:'delivery-application-'+crypto.randomUUID(),projectId:id,kind,applicationNo:appliedAt.replace(/\D/g,'')+String(s.revision+1).padStart(4,'0'),appliedAt,amount:M.round(draft.amount),ratio:draft.ratio,modules:structuredClone(draft.modules),attachments:structuredClone(draft.files),status:'审批中',note:''};
    (next.deliveryApplications??=[]).push(entry);next.revision++;next.audit.push({action:kind+'申请送审',at:at.toISOString(),revision:next.revision,detail:{projectId:id,applicationId:entry.id}});return next;
  }
  function download(s,id){
    const rows=[headers,...records(s,id).map((r,i)=>[i+1,r.kind,r.applicationNo,stamp(r.appliedAt),(r.modules||[]).map(m=>m.name||m).join('、'),r.ratio,r.amount,(r.teachers||[]).join('、'),stamp(r.completedAt),r.status,r.allocations?.length?r.allocations.map(a=>a.name+' '+a.ratio+'% '+money(a.amount)+'元').join('；'):'-',r.note||''])];
    const csv='\ufeff'+rows.map(row=>row.map(value=>{let v=String(value??'');if(/^[=+@-]/.test(v))v="'"+v;return '"'+v.replace(/"/g,'""')+'"';}).join(',')).join('\r\n'),url=URL.createObjectURL(new Blob([csv],{type:'text/csv;charset=utf-8'})),a=document.createElement('a');a.href=url;a.download=s.projects.find(p=>p.id===id).name+'_项目交付明细.csv';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
  }
  root.ProjectDeliveryApplications={render,form,bind,submit,records,totals,download,projectMembers,allocationTable,allocationSection,bindAllocation,validateAllocations,requiresAllocation,ensureExample,hasAllocation};
})(window);
