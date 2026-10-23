/* Read-only budget adjustment comparison, using submission snapshots. */
(function(global){
  'use strict';
  global.createAdjustmentPage=function({esc,money,model:M,record,getId,render,close,drawer,closeDrawer,notify}){
    const states=new Map();
    const demoChanges=[
      {subject:'brand',month:'2026-09',before:35000,after:39000,reason:'增加秋季招生宣传投放，补充渠道推广费用。'},
      {subject:'travel',month:'2026-10',before:45000,after:55000,reason:'新增两场异地课程，增加讲师及运营人员差旅预算。'},
      {subject:'office',month:'2026-10',before:60000,after:50000,reason:'办公设备采购延后，本月释放10,000元预算用于差旅。'},
      {subject:'event',month:'2026-11',before:45000,after:49000,reason:'补充11月招生活动场地及物料费用。'},
      {subject:'teacher',month:'2026-11',before:75000,after:87000,reason:'11月新增两期课程，增加对应讲师课酬预算。'}
    ];
    const demoSnapshot=M.groups.flatMap(g=>g.children.flatMap(c=>M.months.map(month=>{
      const change=demoChanges.find(x=>x.subject===c.id&&x.month===month),original=c.budget,before=change?.before??(c.id==='office'&&month==='2026-06'?62000:original);
      return {subject:c.id,month,original,before,after:change?.after??before,reason:change?.reason||'',changed:!!change};
    })));
    const changesFor=()=>record(getId())?.budgetSnapshot?.changes||demoChanges;
    const snapshotFor=()=>record(getId())?.budgetSnapshot?.snapshot||demoSnapshot;
    const stateFor=id=>{if(!states.has(id))states.set(id,{section:'form',view:'changes',target:null});return states.get(id);};
    const amount=v=>(v>0?'+':v<0?'−':'')+money(Math.abs(v));
    const rate=(before,after)=>before===0?(after===0?'0.00%':'新增预算'):((after-before)/Math.abs(before)*100>0?'+':'')+((after-before)/Math.abs(before)*100).toFixed(2)+'%';
    const cell=(id,month)=>snapshotFor().find(c=>c.subject===id&&c.month===month);
    function periodSummary(id,month){
      const children=M.ids(id).map(child=>cell(child,month));
      return {original:children.reduce((a,c)=>a+c.original,0),before:children.reduce((a,c)=>a+c.before,0),after:children.reduce((a,c)=>a+c.after,0),changed:children.some(c=>c.changed)};
    }
    function changeRows(){return snapshotFor().filter(c=>c.changed).map(c=>`<tr><td><span class="adjustment-parent">${esc(M.groupFor(c.subject).name)}</span><strong>${esc(M.subject(c.subject).name)}</strong></td><td>${c.month}</td><td class="right money">${money(c.original)}</td><td class="right money">${money(c.before)}</td><td class="right money adjustment-after">${money(c.after)}</td><td class="right money ${c.after>c.before?'adjustment-increase':'adjustment-decrease'}">${amount(c.after-c.before)}</td><td class="right money">${rate(c.before,c.after)}</td><td class="adjustment-row-reason">${esc(c.reason)}</td><td><button class="link" data-action="adjustment-locate" data-subject="${c.subject}" data-month="${c.month}">定位完整预算</button></td></tr>`).join('');}
    function changesView(){
      return `<div class="table-wrap"><table class="adjustment-changes-table"><thead><tr><th>预算科目</th><th>调整月份</th><th class="right">原始预算</th><th class="right">调整前</th><th class="right">调整后</th><th class="right">变动金额</th><th class="right">变动率</th><th>本项调整原因</th><th>操作</th></tr></thead><tbody>${changeRows()}</tbody></table></div>`;
    }
    function fullView(s){
      const months=M.months;
      const rows=M.groups.flatMap(g=>[g,...g.children].map(item=>({item,group:item.id===g.id})));
      const reasonsFor=id=>changesFor().filter(c=>c.subject===id).map(c=>`<div>${c.month}：${esc(c.reason)}</div>`).join('')||'—';
      return `<div class="adjustment-legendbar"><div class="adjustment-legend"><span><i class="history"></i>历史调整</span><span><i class="current"></i>本次调整</span></div></div><div class="table-wrap adjustment-matrix-wrap"><table class="adjustment-matrix"><thead><tr><th rowspan="2">预算科目</th>${months.map(m=>`<th colspan="5">${m}</th>`).join('')}<th rowspan="2" class="adjustment-matrix-reason">调整原因</th></tr><tr>${months.map(()=>'<th>原始预算</th><th>调整前</th><th>调整后</th><th>变动金额</th><th>变动率</th>').join('')}</tr></thead><tbody>${rows.map(({item,group})=>`<tr data-matrix-row="${item.id}" class="${group?'group':''}"><td>${group?'':`<span class="subject-mark"></span>`}${esc(item.name)}</td>${months.map(month=>{
        const c=group?periodSummary(item.id,month):cell(item.id,month),isTarget=s.target?.subject===item.id&&s.target?.month===month;
        return `<td class="money right">${money(c.original)}</td><td class="money right ${c.before!==c.original?'adjustment-history':''}">${money(c.before)}</td><td data-matrix-month="${month}" class="money right ${c.changed?'adjustment-current':''} ${isTarget?'adjustment-target':''}">${money(c.after)}</td><td class="money right ${c.changed?(c.after>=c.before?'adjustment-increase':'adjustment-decrease'):''}">${c.after===c.before?'—':amount(c.after-c.before)}</td><td class="money right">${rate(c.before,c.after)}</td>`;
      }).join('')}<td class="adjustment-matrix-reason">${group?'—':reasonsFor(item.id)}</td></tr>`).join('')}</tbody></table></div>`;
    }
    function form(r,s){
      const changes=changesFor(),increased=changes.reduce((a,c)=>a+Math.max(0,c.after-c.before),0),decreased=changes.reduce((a,c)=>a+Math.max(0,c.before-c.after),0);
      return `<section class="panel adjustment-metadata"><dl><dt>标题</dt><dd>${esc(r.title)}</dd><dt>申请时间</dt><dd>${r.created}</dd><dt>申请人</dt><dd>${esc(r.person)}（${r.employeeNo}）</dd><dt>申请部门</dt><dd>${esc(r.department)}</dd><dt>团队名称</dt><dd>${esc(r.teamName||'全域线下')}</dd><dt>财年</dt><dd>2026（2026-02 至 2027-01）</dd></dl></section><section class="panel adjustment-comparison"><div class="section-heading"><div class="execution-heading"><h2>预算调整对比</h2><span class="execution-subtitle">调整前为提交申请时的预算；变动金额＝调整后－调整前</span></div><div class="mode-switch"><button data-action="adjustment-view" data-view="changes" class="${s.view==='changes'?'active':''}">本次调整</button><button data-action="adjustment-view" data-view="full" class="${s.view==='full'?'active':''}">完整预算</button></div></div><div class="adjustment-summary"><span>本次调整 <strong>${changes.length}</strong> 笔</span><span><strong>${new Set(changes.map(c=>c.subject)).size}</strong> 个科目</span><span><strong>${new Set(changes.map(c=>c.month)).size}</strong> 个月份</span><span>增加 <strong class="money">${amount(increased)}</strong></span><span>减少 <strong class="money">${amount(-decreased)}</strong></span><span>净调整 <strong class="money">${amount(increased-decreased)}</strong></span><span class="adjustment-unit">单位：元</span></div>${s.view==='changes'?changesView():fullView(s)}</section>`;
    }
    function renderPage(){
      const id=getId(),r=record(id),s=stateFor(id);
      if(!r)return '<div class="empty">未找到该预算调整申请单</div>';
      const canAct=r.status==='待审批'&&r.mine;
      return `<article class="adjustment-page" aria-label="团队预算调整申请单详情"><div class="adjustment-actionbar"><div>${canAct?`<button class="primary" data-action="approval-agree" data-id="${id}">同意</button><button class="primary" data-action="approval-reject" data-id="${id}">驳回</button><button class="primary" data-action="approval-transfer" data-id="${id}">转审</button>`:''}<button data-action="adjustment-close">取消</button><button data-action="adjustment-comment" data-id="${id}">评论</button><button data-action="approval-tag" data-id="${id}">标签</button></div><span class="adjustment-status">${esc(r.status)} · 审批人：${esc(r.approver)}</span></div><div class="adjustment-sections" role="tablist" aria-label="申请单详情分类"><button role="tab" aria-selected="${s.section==='form'}" class="${s.section==='form'?'active':''}" data-action="adjustment-section" data-section="form">表单详情</button><button role="tab" aria-selected="${s.section==='history'}" class="${s.section==='history'?'active':''}" data-action="adjustment-section" data-section="history">审批记录</button></div>${s.section==='form'?form(r,s):`<section class="panel adjustment-history-panel"><h2>审批记录</h2><div class="timeline"><div>申请人提交<p>${r.created} · ${esc(r.person)}</p></div>${r.history.map(h=>`<div>${esc(h.text)}<p>${h.time}</p></div>`).join('')}${r.status==='待审批'?`<div>待审批<p>${esc(r.approver)}</p></div>`:''}</div></section>`}</article>`;
    }
    function locateTarget(s){
      const target=document.querySelector(`[data-matrix-row="${s.target.subject}"] [data-matrix-month="${s.target.month}"]`);
      target?.scrollIntoView({block:'center',inline:'center',behavior:'instant'});
    }
    function handleClick(button){
      const r=record(getId()),s=stateFor(getId());
      switch(button.dataset.action){
        case 'adjustment-section':s.section=button.dataset.section;render();break;
        case 'adjustment-view':s.view=button.dataset.view;render();break;
        case 'adjustment-locate':s.view='full';s.target={subject:button.dataset.subject,month:button.dataset.month};render();locateTarget(s);break;
        case 'adjustment-close':close();break;
        case 'adjustment-comment':drawer('评论',r.number,'<label class="approval-dialog-field">评论内容<textarea id="adjustment-comment" rows="4" placeholder="请输入评论"></textarea></label>',`<button class="primary" data-action="adjustment-save-comment">提交评论</button>`);break;
        case 'adjustment-save-comment':{const text=document.getElementById('adjustment-comment').value.trim();if(!text){notify('请输入评论内容');return;}r.history.push({time:new Date().toLocaleString('sv-SE'),text:'超级管理员评论：'+text});closeDrawer();render();notify('评论已保存');break;}
      }
    }
    return {render:renderPage,click:handleClick,reset:()=>states.clear()};
  };
})(window);
