/* Application entry and editable adjustment drafts. Local prototype data only. */
(function(global){
  'use strict';
  global.createApplicationPage=function({esc,money,model:M,getData,getTeam,render,dirty,openRequest,openAdjustment,submitRecord,close,drawer,confirmDialog,closeDrawer,notify}){
    const drafts=new Map(),storageKey='budget-prototype-adjustment-drafts-v1',currentMonth='2026-10';
    let pendingPeriod=null;
    const readSaved=()=>{try{return JSON.parse(localStorage.getItem(storageKey)||'{}');}catch{return {};}};
    function stateFor(id=getTeam()){
      if(!drafts.has(id)){
        const saved=readSaved()[id];
        const snapshot=M.groups.flatMap(g=>g.children.flatMap(c=>M.months.map(month=>({subject:c.id,month,original:Math.round(c.budget*M.teams.find(t=>t.id===id).scale),before:M.budget(getData(),id,c.id,month,month)}))));
        drafts.set(id,saved?{...saved,month:M.months.includes(saved.month)?saved.month:currentMonth,expanded:false,submitted:null}:{snapshot,values:{},reasons:{},month:currentMonth,expanded:false,savedAt:'',submitted:null});
      }
      return drafts.get(id);
    }
    const key=c=>`${c.subject}|${c.month}`;
    const after=(s,c)=>Object.hasOwn(s.values,key(c))?Number(s.values[key(c)]):c.before;
    const amount=n=>(n>0?'+':n<0?'−':'')+money(Math.abs(n));
    const rate=(before,value)=>before===0?(value===0?'0.00%':'新增预算'):((value-before)>0?'+':'')+((value-before)/Math.abs(before)*100).toFixed(2)+'%';
    const changes=s=>s.snapshot.filter(c=>Number.isFinite(after(s,c))&&after(s,c)!==c.before).map(c=>({...c,after:after(s,c),reason:s.reasons[c.subject]?.trim()||''}));
    function summary(s){const rows=changes(s);return `本次调整 <strong>${rows.length}</strong> 笔<span>增加 <strong>${amount(rows.reduce((a,c)=>a+Math.max(0,c.after-c.before),0))}</strong></span><span>减少 <strong>${amount(rows.reduce((a,c)=>a+Math.min(0,c.after-c.before),0))}</strong></span><span>净调整 <strong>${amount(rows.reduce((a,c)=>a+c.after-c.before,0))}</strong></span>`;}
    function entry(){return `<section class="application-entry-page" aria-label="申请入口"><button class="application-entry" data-action="application-select"><svg width="29" height="29" viewBox="0 0 32 32" aria-hidden="true"><rect x="5" y="5" width="22" height="22" rx="1" fill="none" stroke="currentColor" stroke-width="2"/><path d="m10 10 4 5 4-5m-4 5v9m-5-8h10m-10 4h10m3-10v7m-3-3.5h6" fill="none" stroke="currentColor" stroke-width="1.7"/></svg><strong>团队预算调整申请单</strong></button></section>`;}
    function select(){
      drawer('预算调整选择','',`<div class="application-selection"><label class="application-year"><strong>财　年 <span>*</span></strong><select id="application-year" aria-label="财年"><option>2026</option></select></label><div class="application-team-label"><strong>团　队 <span>*</span></strong></div><div class="application-team-options">${M.teams.map((t,i)=>`<label><input type="radio" name="application-team" value="${t.id}" ${i===0?'checked':''}>${esc(t.name)}</label>`).join('')}</div></div>`,`<button class="primary" data-action="application-confirm-team">确认</button>`);
      document.querySelector('#overlay .drawer').classList.add('application-selection-modal');
    }
    function valuesFor(s,id,month,group){const rows=s.snapshot.filter(c=>c.month===month&&(group?M.ids(id).includes(c.subject):c.subject===id));return {original:rows.reduce((a,c)=>a+c.original,0),before:rows.reduce((a,c)=>a+c.before,0),after:rows.reduce((a,c)=>a+after(s,c),0)};}
    function monthCells(s,item,month,group){
      const c=valuesFor(s,item.id,month,group),changed=c.before!==c.after,raw=s.values[`${item.id}|${month}`]??c.before;
      return `<td class="money application-original">${money(c.original)}</td><td class="money ${c.before!==c.original?'adjustment-history':'application-before'}">${money(c.before)}</td><td class="application-after ${changed?'adjustment-current':''}" data-application-after="${item.id}|${month}">${group||s.submitted?`<span class="money">${money(c.after)}</span>`:`<input type="number" min="0" step="0.01" inputmode="decimal" data-application-value="${item.id}|${month}" aria-label="${esc(item.name)} ${month} 调整后" value="${esc(raw)}">`}</td><td class="money" data-application-delta="${item.id}|${month}">${amount(c.after-c.before)}</td><td class="money" data-application-rate="${item.id}|${month}">${rate(c.before,c.after)}</td>`;
    }
    function renderRequest(){
      const s=stateFor(),t=M.teams.find(t=>t.id===getTeam()),months=s.expanded?M.months:[s.month];
      return `<article class="application-request-page"><div class="adjustment-actionbar"><div><button data-action="application-cancel">取消</button>${s.submitted?`<button class="primary" data-action="application-view-submitted">查看已提交申请</button>`:'<button class="primary" data-action="application-save">保存草稿</button><button class="primary" data-action="application-submit">提交送审</button>'}</div><span class="application-save-status">${s.submitted?'已提交送审':s.savedAt?'草稿已保存 · '+esc(s.savedAt):'未提交'}</span></div><section class="panel adjustment-metadata"><dl><dt>标题</dt><dd>超级管理员发起的团队预算调整申请单</dd><dt>申请时间</dt><dd>${s.submitted?esc(s.submitted.time):'—'}</dd><dt>申请人</dt><dd>超级管理员（B00000）</dd><dt>申请部门</dt><dd>博商集团／博商集团</dd><dt>团队名称</dt><dd>${esc(t.name)}</dd><dt>财年</dt><dd>2026（2026-02 至 2027-01）</dd></dl></section><section class="panel"><div class="section-heading"><div class="execution-heading"><h2>预算调整申请</h2><span class="execution-subtitle">${s.expanded?'财年全部月份':'预算归属月：'+s.month} · 单位：元</span></div><div class="filters"><label class="field">预算归属月<select id="application-period" aria-label="调整预算归属月">${M.months.map(m=>`<option value="${m}" ${!s.expanded&&s.month===m?'selected':''}>${m}</option>`).join('')}<option value="annual" ${s.expanded?'selected':''}>全年</option></select></label><button data-action="application-expand" aria-expanded="${s.expanded}">${s.expanded?'收起，仅看所选月':'展开全年，调整其他月份'}</button></div></div><div class="application-summary">${summary(s)}</div><div class="application-legend"><span><i class="editable"></i>可编辑</span><span><i class="readonly"></i>不可编辑</span><span><i class="history"></i>历史调整</span><span><i class="current"></i>本次调整</span></div><div class="table-wrap application-matrix-wrap"><table class="application-matrix ${s.expanded?'expanded':''}"><thead><tr><th rowspan="2">科目名称</th>${months.map(m=>`<th colspan="5">${m}${m===currentMonth?'（当前月）':''}</th>`).join('')}<th rowspan="2" class="application-reason-col">调整原因</th></tr><tr>${months.map(()=>'<th>原始预算</th><th>调整前</th><th>调整后</th><th>变动金额</th><th>变动率</th>').join('')}</tr></thead><tbody>${M.groups.map(g=>[g,...g.children].map(item=>{const group=item.id===g.id;return `<tr class="${group?'group':''}" data-application-row="${item.id}"><td>${group?'':'<span class="subject-mark"></span>'}${esc(item.name)}</td>${months.map(m=>monthCells(s,item,m,group)).join('')}<td class="application-reason-col">${group?'—':s.submitted?esc(s.reasons[item.id]||'—'):`<textarea rows="2" data-application-reason="${item.id}" aria-label="${esc(item.name)}调整原因" placeholder="填写该科目调整原因">${esc(s.reasons[item.id]||'')}</textarea>`}</td></tr>`;}).join('')).join('')}</tbody></table></div></section></article>`;
    }
    function refreshAmounts(s,subject,month){
      for(const id of [subject,M.groupFor(subject).id]){
        const c=valuesFor(s,id,month,id!==subject),afterCell=document.querySelector(`[data-application-after="${id}|${month}"]`);
        if(!afterCell)continue;
        afterCell.classList.toggle('adjustment-current',c.before!==c.after);
        if(id!==subject)afterCell.querySelector('span').textContent=money(c.after);
        document.querySelector(`[data-application-delta="${id}|${month}"]`).textContent=Number.isFinite(c.after)?amount(c.after-c.before):'—';
        document.querySelector(`[data-application-rate="${id}|${month}"]`).textContent=Number.isFinite(c.after)?rate(c.before,c.after):'—';
      }
      document.querySelector('.application-summary').innerHTML=summary(s);
    }
    function input(el){const s=stateFor();if(s.submitted)return;if(el.dataset.applicationValue){s.values[el.dataset.applicationValue]=el.value;const [subject,month]=el.dataset.applicationValue.split('|');refreshAmounts(s,subject,month);}else if(el.dataset.applicationReason)s.reasons[el.dataset.applicationReason]=el.value;else return;dirty(true);}
    function hasAdjustment(s){return Object.values(s.reasons).some(value=>String(value).trim())||Object.entries(s.values).some(([id,value])=>{const cell=s.snapshot.find(c=>key(c)===id);return String(value).trim()===''||!Number.isFinite(Number(value))||!cell||Number(value)!==cell.before;});}
    function applyPeriod(s,target){
      if(!s.submitted){
        const stored=readSaved(),id=getTeam();
        if(Object.hasOwn(stored,id)){delete stored[id];try{localStorage.setItem(storageKey,JSON.stringify(stored));}catch{notify('清空已保存草稿失败，未切换，请重试');return;}}
        s.values={};s.reasons={};s.savedAt='';dirty(false);
      }
      s.expanded=target==='annual';if(!s.expanded)s.month=target;
      pendingPeriod=null;closeDrawer();render();
    }
    function switchPeriod(target){
      const s=stateFor(),current=s.expanded?'annual':s.month;
      if(target===current||target!=='annual'&&!M.months.includes(target))return;
      const select=document.querySelector('#application-period');if(select)select.value=current;
      if(!s.submitted&&hasAdjustment(s)){
        pendingPeriod={team:getTeam(),state:s,target};
        confirmDialog('切换预算期间',`<p>切换月份或全年将清空已填写数据，包括调整金额和调整原因（含已保存草稿）。确认清空并切换到${target==='annual'?'全年':esc(target)}？</p>`,`<button data-action="application-cancel-period">取消</button><button class="primary" data-action="application-confirm-period">确认清空并切换</button>`);
      }else applyPeriod(s,target);
    }
    function change(el){if(el.id==='application-period')switchPeriod(el.value);}
    function valid(s){return !Object.values(s.values).some(v=>String(v).trim()===''||!Number.isFinite(Number(v))||Number(v)<0||Math.abs(Number(v)*100-Math.round(Number(v)*100))>0.00001);}
    function focusError(subject){const el=document.querySelector(`[data-application-reason="${subject}"]`);el?.scrollIntoView({block:'center',inline:'nearest'});el?.focus({preventScroll:true});}
    function save(s){if(!valid(s)){notify('请输入有效的非负金额，最多保留两位小数');return;}const savedAt=new Date().toLocaleString('sv-SE'),stored=readSaved();stored[getTeam()]={...s,savedAt,expanded:false,submitted:null};try{localStorage.setItem(storageKey,JSON.stringify(stored));}catch{notify('草稿保存失败，请重试');return;}s.savedAt=savedAt;dirty(false);render();notify('草稿已保存');}
    function submit(s){
      if(!valid(s)){notify('请输入有效的非负金额，最多保留两位小数');return;}
      const changed=changes(s);if(!changed.length){notify('请至少调整一笔预算后再提交');return;}
      const missing=changed.find(c=>!c.reason);if(missing){focusError(missing.subject);notify('请填写'+M.subject(missing.subject).name+'的调整原因');return;}
      drawer('提交预算调整申请','',`<p>确认提交${esc(M.teams.find(t=>t.id===getTeam()).name)}的预算调整申请？</p><p>共 ${changed.length} 笔调整，净调整 ${amount(changed.reduce((a,c)=>a+c.after-c.before,0))} 元。</p>`,`<button class="primary" data-action="application-confirm-submit">确认提交</button>`);
    }
    function commit(s){
      if(s.submitted)return;
      const now=new Date(),time=now.toLocaleString('sv-SE'),id='request'+now.getTime(),t=M.teams.find(t=>t.id===getTeam()),changed=changes(s);
      const record={id,number:'YS'+now.getTime(),title:'超级管理员发起的团队预算调整申请单',person:'超级管理员',employeeNo:'B00000',department:'博商集团／博商集团',teamName:t.name,teamId:t.id,created:time,date:time,status:'待审批',statusTime:time,approver:'超级管理员(B00000)',mine:true,cc:false,tags:[],reason:[...new Set(changed.map(c=>c.reason))].join('；'),history:[],budgetSnapshot:{changes:changed,snapshot:s.snapshot.map(c=>({...c,after:after(s,c),reason:s.reasons[c.subject]||'',changed:after(s,c)!==c.before}))}};
      submitRecord(record);s.submitted={id,time};const saved=readSaved();delete saved[getTeam()];try{localStorage.setItem(storageKey,JSON.stringify(saved));}catch{}dirty(false);closeDrawer();render();openAdjustment(id);notify('申请已提交，可在审批页查看；未修改实际预算');
    }
    function click(button){const action=button.dataset.action;if(action==='application-select'){select();return;}if(action==='application-confirm-team'){const selected=document.querySelector('input[name="application-team"]:checked');if(!selected){notify('请选择团队');return;}const id=selected.value;closeDrawer();openRequest(id);return;}const s=stateFor();switch(action){case 'application-expand':switchPeriod(s.expanded?s.month:'annual');break;case 'application-confirm-period':if(pendingPeriod?.team===getTeam()&&pendingPeriod.state===s)applyPeriod(s,pendingPeriod.target);break;case 'application-cancel-period':pendingPeriod=null;closeDrawer();break;case 'application-save':save(s);break;case 'application-submit':submit(s);break;case 'application-confirm-submit':commit(s);break;case 'application-cancel':close();break;case 'application-view-submitted':openAdjustment(s.submitted.id);break;}}
    return {entry,render:renderRequest,click,input,change,discard:id=>drafts.delete(id),reset:()=>{pendingPeriod=null;drafts.clear();try{localStorage.removeItem(storageKey);}catch{}}};
  };
})(window);
