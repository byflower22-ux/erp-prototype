(function(root){
  'use strict';
  const types={salaries:'固定人工',commissions:'项目提成',bonuses:'人员奖金',actualCosts:'实际费用',expenses:'预计费用'};
  const category={business:'业务费用',management:'管理费用',travel:'差旅费用',accountManager:'大客户经理提成',exception:'例外费用',yearBonus:'项目年终奖分摊',fixed:'固定费用'};
  const imports={salary:'固定人工',commission:'项目提成',bonus:'人员奖金',exception:'例外费用',fixed:'固定费用'};
  root.ProjectFinance={render(ctx){
    const U=root.ProjectUI,{esc:e,money:m,percent:p,button:b,badge,table,card,options}=U;
    const {state:s,month,role,filters:f={}}=ctx,M=root.ProjectModel;
    const canEdit=role==='finance',locked=!!s.closed[month],tab=f.financeTab||'data',type=types[f.dataType]?f.dataType:'salaries';
    const name=(list,id)=>list.find(x=>x.id===id)?.name||'—';
    const projects=s.projects.map(x=>({entity:x,...M.projectResult(s,x.id,month)}));
    const people=s.people.map(x=>({entity:x,...M.personResult(s,x.id,month)}));
    const missing=M.monthMissing(s,month);
    const sum=(rows,key)=>rows.reduce((n,r)=>n+Number(r[key]||0),0);
    const monthFilter=`<label>期间 <select data-filter="month">${options(s.months.map(v=>({id:v,name:v})),month)}</select></label>`;
    let body='';
    if(tab==='imports'){
      const rows=s.batches.filter(r=>r.month===month).slice().reverse().map(r=>[e(r.id),e(imports[r.type]||r.type||'导入'),e(r.month),e(r.count??r.rows?.filter(x=>x.kind!=='skip').length??r.rows?.length??'—'),badge('已应用','success'),e(r.createdAt||r.at||r.time||'本地演示'),b('批次详情','batch-detail',`data-id="${e(r.id)}"`,'link')]);
      body=`<div class="filters">${monthFilter}<span class="push muted">批次保留替换、空白跳过和零值覆盖记录</span></div><div class="notice info" style="margin:0 20px 16px">五类模板由龙虾对话演示生成；下载 Excel 填写金额后上传，预览确认才写入。ERP 在此保留批次、文件来源及核算结果。</div>${table(['批次号','类型','期间','生效条数','状态','导入时间','操作'],rows)}`;
    }else if(tab==='close'){
      const rows=projects.map(r=>[e(r.entity.name),m(r.income),m(r.totalCost),m(r.tax),`<span class="${r.net<0?'negative':'positive'}">${m(r.net)}</span>`,r.missing.length?badge(`${r.missing.length} 项缺失`,'danger'):badge('可核算','success'),b('查看来源','sources',`data-kind="project" data-id="${e(r.id)}"`,'link')]);
      const snap=s.closed[month];
      body=`<div class="filters">${monthFilter}${badge(locked?'已结账 · 快照锁定':'未结账',locked?'success':'blue')}<div class="push actions">${b('完整性检查／试算','trial')}${canEdit?locked?b('反结账','reopen-month','','danger'):b('月结锁定','close-month','','primary'):badge('只读查看','neutral')}</div></div><div class="panel-body"><div class="notice ${locked?'success':missing.length?'':'info'}">${locked?`本月已生成核算快照，日程、核算设置及费用数据均已锁定。${snap?.closedAt?' 结账时间：'+e(snap.closedAt):''}`:missing.length?`发现 ${missing.length} 项待补充输入，补齐后方可月结。`:'完整性检查通过，可试算并进行月结。'}</div>${missing.length?`<div class="notice danger"><strong>待补充清单</strong><ul>${missing.map(v=>`<li>${e(v)}</li>`).join('')}</ul></div>`:''}<div class="metrics">${card('项目交付金额',m(sum(projects,'income')),'本月确认交付')}${card('项目总成本',m(sum(projects,'totalCost')),'不含项目所得税')}${card('项目所得税',m(sum(projects,'tax')),'累计利润计税，允许回调')}${card('项目税后利润',m(sum(projects,'net')),'缺失数据补齐前为试算值',sum(projects,'net')<0?'negative':'positive')}</div></div>${table(['项目','交付金额','总成本','项目所得税','税后利润','完整性','操作'],rows)}<p class="panel-note">月结锁定当前期间输入依据与结果。反结账须填写原因；存在更晚已结月份时，应先反结账后续月份。</p>`;
    }else{
      const projectScoped=!['salaries','bonuses'].includes(type);
      const rows=(s[type]||[]).filter(r=>r.month===month).filter(r=>!projectScoped||!f.project||f.project==='all'||r.projectId===f.project).filter(r=>!f.query||`${name(s.people,r.personId)} ${name(s.projects,r.projectId)} ${category[r.category]||''}`.includes(f.query));
      const cells=rows.map(r=>[e(r.projectId?name(s.projects,r.projectId):name(s.people,r.personId)),e(r.personId&&r.projectId?name(s.people,r.personId):r.projectId?'项目费用':'个人成本'),e(category[r.category]||types[type]),e(r.month),m(r.amount),badge(locked?'已锁定':'有效',locked?'neutral':'success'),`${b('来源','sources',`data-kind="${r.projectId?'project':'person'}" data-id="${e(r.projectId||r.personId)}"`,'link')}${canEdit?b('授权纠错','correct',`data-collection="${e(type)}" data-id="${e(r.id)}" ${locked?'disabled':''}`,'link'):''}`]);
      body=`<div class="filters">${monthFilter}<label>数据类别 <select data-filter="dataType">${options(Object.keys(types).map(id=>({id,name:types[id]})),type)}</select></label>${projectScoped?`<label>项目 <select data-filter="project">${options([{id:'all',name:'全部项目'},...s.projects],f.project||'all')}</select></label>`:''}<input type="search" data-filter="query" placeholder="搜索人员、项目或费用科目" value="${e(f.query||'')}" aria-label="搜索核算数据"></div><div class="panel-head"><h2>${e(types[type])} <small>共 ${rows.length} 条</small></h2><strong>合计 ¥ ${m(sum(rows,'amount'))}</strong></div>${table(['归属','人员／范围','核算科目','期间','金额（元）','状态','操作'],cells)}<p class="panel-note">${type==='bonuses'?'人员奖金仅计入个人成本；项目年终奖分摊在项目核算设置中另行维护。':type==='expenses'?'预计费用按月手工维护；项目累计总额由各月金额汇总。':type==='salaries'?'月固定人工计入个人全月成本，项目人工按标准工时及已提交项目工时分摊。':'更正须由财务填写原因，并保留修订记录；空白与零金额分别处理。'}</p>`;
    }
    return `<div class="page-heading"><div><div class="eyebrow">FINANCE WORKSPACE</div><h1>核算工作台</h1><p>汇集核算输入，追溯来源并完成期间结账</p></div><div class="period-caption"><b>${e(month)} 核算期间</b>${locked?'结果来自已结快照':'实时试算 · 虚构示例数据'}</div></div><div class="metrics">${card('本月项目交付',m(sum(projects,'income')),'确认交付金额','accent')}${card('已提交项目工时',sum(people,'hours')+' h','草稿不计入核算')}${card('输入完整性',missing.length?missing.length+' 项待补充':'检查通过',missing.length?'请前往月结页签查看':'可进行月结',missing.length?'negative':'positive')}${card('期间状态',locked?'已结账':'未结账',locked?'输入与结果已锁定':'数据保存后自动重算')}</div><section class="panel"><div class="tabs">${[['data','核算数据'],['imports','导入记录'],['close','月结']].map(([v,t])=>`<button class="${tab===v?'active':''}" data-filter="financeTab" data-value="${v}">${t}</button>`).join('')}</div>${body}</section>`;
  }};
})(window);
