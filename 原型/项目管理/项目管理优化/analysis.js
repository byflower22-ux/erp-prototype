(function(root){
  'use strict';
  const scope=ctx=>{
    const {state:s,month,filters:f={}}=ctx,project=ctx.page==='project-analysis';
    const projects=s.projects.filter(x=>x.startDate>='2026-02-01'&&x.startDate.slice(0,7)<=month),members=s.members.filter(x=>projects.some(p=>p.id===x.projectId));
    const teamOf=p=>root.ProjectDelivery?.info(s,p).team||p.team||'博商管理咨询';
    const roles=[...new Set(['咨询师',...members.map(x=>x.role).filter(Boolean)])],teams=[...new Set(projects.map(teamOf))];
    const selectedRole=f.analysisRole||'咨询师',selectedTeam=f.analysisTeam||'all';
    const collection=project?projects.filter(x=>selectedTeam==='all'||teamOf(x)===selectedTeam):s.people.filter(x=>x.joined.slice(0,7)<=month&&(selectedRole==='all'||members.some(v=>v.personId===x.id&&v.role===selectedRole)));
    const selection=(project?f.analysisProject:f.analysisPerson)||'all',entities=selection==='all'?collection:collection.filter(x=>x.id===selection);
    return {project,collection,entities,selection,roles,teams,selectedRole,selectedTeam,teamOf,members};
  };
  root.ProjectAnalysisScope={select:scope};
  const projectCosts={business:'业务费用 · 实际',management:'管理费用 · 实际',travel:'差旅费用 · 实际',tax:'税费 3.3%',accountManager:'大客户经理提成 · 预计',commission:'项目提成',salary:'项目人工 · 分摊',exception:'例外费用 · 预计',yearBonus:'年终奖分摊 · 预计',fixed:'固定费用 · 预计'};
  const personCosts={salary:'固定人工',commission:'提成',bonus:'奖金',tax:'税费 3.3%',management:'管理费 20%'};
  const sum=(rows,key)=>rows.reduce((n,r)=>n+Number(r[key]||0),0);
  const aggregate=rows=>({income:sum(rows,'income'),totalCost:sum(rows,'totalCost'),pretax:sum(rows,'pretax'),tax:sum(rows,'tax'),net:sum(rows,'net'),hours:sum(rows,'hours'),standardHours:sum(rows,'standardHours'),allocatedSalary:sum(rows,'allocatedSalary'),idleSalary:sum(rows,'idleSalary')});
  const hasInputMissing=result=>result.missing.some(reason=>!reason.includes('无法测算'));
  root.ProjectAnalysis={render(ctx){
    const U=root.ProjectUI,{esc:e,money:m,percent:p,button:b,badge,card,table,options}=U;
    const {state:s,month,filters:f={}}=ctx,M=root.ProjectModel;
    const isProject=ctx.page==='project-analysis',kind=isProject?'project':'person';
    const {collection,selection,entities}=scope(ctx);
    const months=s.months.filter(v=>v<=month).sort();
    const cumulative=f.periodMode==='cumulative';
    const model=(id,period)=>isProject?M.projectResult(s,id,period):M.personResult(s,id,period);
    const current=entities.map(entity=>({entity,...model(entity.id,month)}));
    const historical=months.flatMap(period=>entities.map(entity=>({entity,...model(entity.id,period)})));
    const selected=cumulative?historical:current;
    const totals=aggregate(selected);
    const margin=totals.income>0&&!selected.some(hasInputMissing)?totals.net/totals.income:null;
    const saturation=totals.standardHours>0?totals.hours/totals.standardHours:null;
    const missing=[...new Set(selected.flatMap(r=>r.missing.filter(v=>!v.includes('无法测算')).map(v=>`${r.entity.name} ${r.month}：${v}`)))];
    const projectAggregate=isProject?current.reduce((a,r)=>{const x=cumulative?r.cumulative:r;for(const k of ['income','totalCost','pretax','tax','net','received'])a[k]+=Number(x[k]||0);return a;},{income:0,totalCost:0,pretax:0,tax:0,net:0,received:0}):totals;
    const values=isProject?projectAggregate:totals;
    const displayMargin=values.income>0&&!selected.some(hasInputMissing)?values.net/values.income:null;
    const breakEven=entities.length===1?(isProject&&cumulative?current[0]?.cumulative.breakEven:current[0]?.breakEven):null;
    const metricNote=missing.length?'输入待补齐 · 当前为试算':cumulative?'截至本月累计':'当月核算';
    const breakEvenNote=entities.length!==1?'选择单个'+(isProject?'项目':'人员')+'查看':breakEven===null?'零收入、缺必要输入或分母非正':isProject?'按项目核算模型计算':'按所选当月费用占比计算';
    let metrics;
    if(isProject){
      metrics=card('合同金额',m(sum(entities,'contract')),'项目去重，不按月份累加')+card('确认交付金额',m(values.income),metricNote,'accent')+card('项目总成本',m(values.totalCost),'税费及实际／分摊／预计成本')+card('税后利润',m(values.net),metricNote,values.net<0?'negative':'positive')+card('净利率',p(displayMargin),values.income?'税后利润 ÷ 交付金额':'零收入，无法测算')+card('盈亏平衡回款',m(breakEven),breakEvenNote);
    }else{
      metrics=card('个人交付金额',m(values.income),'按项目收入比例分配','accent')+card('个人总成本',m(values.totalCost),'固定人工＋提成＋奖金＋税费＋管理费')+card('税后利润',m(values.net),metricNote,values.net<0?'negative':'positive')+card('净利率',p(margin),values.income?'税后利润 ÷ 交付金额':'零收入，无法测算')+card('工时饱和度',p(saturation),`${totals.hours}h / ${totals.standardHours}h`)+card('当月盈亏平衡点',m(breakEven),breakEvenNote);
    }
    const trend=months.map(period=>({month:period,...aggregate(entities.map(entity=>model(entity.id,period)))}));
    const chartMax=Math.max(1,...trend.flatMap(r=>[r.income,r.totalCost,Math.abs(r.net)]));
    const bar=(value,key,label)=>`<div class="bar ${key}" style="height:${Math.max(value===0?0:2,Math.abs(value)/chartMax*100)}%;${value<0?'background:#c65e5b':''}" title="${e(label)}：${m(value)} 元" aria-label="${e(label)} ${m(value)} 元"></div>`;
    const chart=`<section class="panel"><div class="panel-head"><h2>交付与盈亏趋势</h2><small>金额 · 元</small></div><div class="panel-body"><div class="bar-chart" role="img" aria-label="${e(trend.map(r=>r.month+'交付'+m(r.income)+'，成本'+m(r.totalCost)+'，税后利润'+m(r.net)).join('；'))}">${trend.map(r=>`<div class="bar-group">${bar(r.income,'income',r.month+'交付')}${bar(r.totalCost,'cost',r.month+'成本')}${bar(r.net,'profit',r.month+'税后利润')}<label>${e(r.month)}</label></div>`).join('')}</div><div class="chart-legend"><span><i class="legend-dot" style="background:#eb8d80"></i>交付金额</span><span><i class="legend-dot" style="background:#b4c4d8"></i>总成本</span><span><i class="legend-dot" style="background:#6aa28f"></i>税后利润</span></div><p class="rule-text" style="margin-bottom:0">亏损柱以红色显示，柱高表示绝对金额；悬停查看数值。</p></div></section>`;
    const costLabels=isProject?projectCosts:personCosts;
    const costs=Object.keys(costLabels).map(key=>({key,label:costLabels[key],amount:selected.reduce((n,r)=>n+Number(r.costs[key]||0),0)}));
    const costsMax=Math.max(1,...costs.map(r=>r.amount));
    const costChart=`<section class="panel"><div class="panel-head"><h2>成本构成</h2><small>${cumulative?'累计':'当月'} · 不含所得税</small></div><div class="panel-body">${costs.map(r=>`<div class="cost-row"><span>${e(r.label)}</span><span class="cost-track"><i class="${['business','management','travel','salary'].includes(r.key)?'actual':''}" style="width:${r.amount/costsMax*100}%"></i></span><span>${m(r.amount)}</span></div>`).join('')}</div></section>`;
    const entityRows=entities.map(entity=>{
      const monthResult=model(entity.id,month),allResults=months.map(v=>model(entity.id,v));
      const result=cumulative?(isProject?monthResult.cumulative:aggregate(allResults)):monthResult;
      const rowMissing=cumulative?allResults.some(hasInputMissing):hasInputMissing(monthResult);
      const ratio=result.income>0&&!rowMissing?result.net/result.income:null;
      return [e(entity.name),m(result.income),m(result.totalCost),m(result.pretax),m(result.tax),`<span class="${result.net<0?'negative':'positive'}">${m(result.net)}</span>`,p(ratio),rowMissing?badge('输入待补齐','warn'):badge(s.closed[month]?'已结快照':'实时试算',s.closed[month]?'success':'blue'),b('来源明细','sources',`data-kind="${kind}" data-id="${e(entity.id)}"`,'link')];
    });
    const comparison=`<section class="panel"><div class="panel-head"><h2>${isProject?'项目':'人员'}核算对比</h2><small>${cumulative?'累计至':'核算期间'} ${e(month)} · 元</small></div>${table([isProject?'项目':'人员','交付金额','总成本','税前利润','所得税','税后利润','净利率','状态','操作'],entityRows)}</section>`;
    let details;
    if(isProject){
      const rows=current.map(r=>[e(r.entity.name),m(r.contract),m(r.cumulative.income),m(r.cumulative.received),m(r.receivable),e(r.hours)+'h',m(r.tax),b('查看来源','sources',`data-kind="project" data-id="${e(r.id)}"`,'link')]);
      details=`<section class="panel"><div class="panel-head"><h2>合同、回款与投入</h2><small>合同与回款不等于本月交付收入</small></div>${table(['项目','合同金额','累计交付','累计回款','应收余额','当月投入','当月所得税','操作'],rows)}<p class="panel-note">项目所得税按累计税前利润的 15% 计算，当月取累计税额差额；亏损月份允许负数回调。人员奖金只计个人成本，项目年终奖分摊另行维护。</p></section>`;
    }else{
      const contributions=selected.flatMap(r=>r.projects.map(x=>({...x,personId:r.id,personName:r.entity.name,month:r.month})));
      const rows=contributions.map(r=>[e(r.personName),e(r.month),e(s.projects.find(v=>v.id===r.projectId)?.name||r.projectId),p(r.ratio),m(r.income),e(r.hours)+'h',m(r.salary),m(r.commission),b('项目来源','sources',`data-kind="project" data-id="${e(r.projectId)}" data-month="${e(r.month)}"`,'link')]);
      details=`<div class="metrics">${card('固定人工',m(costs.find(r=>r.key==='salary')?.amount),metricNote)}${card('已分摊项目人工',m(totals.allocatedSalary),'按已提交工时分摊')}${card('未分摊人工',m(totals.idleSalary),'留在个人成本，不强行分配')}${card('项目投入工时',totals.hours+'h','0.5 小时步进，草稿不计')}</div><section class="panel"><div class="panel-head"><h2>项目收入与人工构成</h2><small>按月份生效的收入比例</small></div>${table(['人员','期间','项目','收入比例','交付金额','投入工时','分摊人工','项目提成','操作'],rows)}<p class="panel-note">当月盈亏平衡点＝（固定人工＋提成＋奖金）÷［1－（税费＋管理费）÷当月交付金额］。累计净利率与饱和度均以合计分子除以合计分母，盈亏平衡点保持所选当月口径。</p></section>`;
    }
    let efficiency='';
    const efficiencyView=!isProject&&f.personAnalysisView==='efficiency';
    if(!isProject){
      const incomeMissing=rows=>rows.some(r=>r.missing.some(v=>v.includes('收入比例')));
      const calendarMissing=rows=>rows.some(r=>!(r.standardHours>0));
      const laborMissing=rows=>rows.some(r=>r.missing.some(v=>v.includes('工资')));
      const efficiencyFor=rows=>{
        const x=aggregate(rows),labor=rows.reduce((n,r)=>n+r.costs.salary+r.costs.commission+r.costs.bonus,0),complete=!rows.some(hasInputMissing),revenueComplete=!incomeMissing(rows),months=rows.length;
        return {...x,labor:!laborMissing(rows)?labor:null,personMonths:months,monthlyIncome:months&&revenueComplete?x.income/months:null,monthlyNet:months&&complete?x.net/months:null,incomePerHour:x.hours>0&&revenueComplete?x.income/x.hours:null,netPerHour:x.hours>0&&complete?x.net/x.hours:null,laborReturn:labor>0&&!laborMissing(rows)&&revenueComplete?x.income/labor:null,utilization:x.standardHours>0&&!calendarMissing(rows)?x.hours/x.standardHours:null,idleHours:!calendarMissing(rows)?rows.reduce((n,r)=>n+Math.max(r.standardHours-r.hours,0),0):null,complete,revenueComplete};
      };
      const all=efficiencyFor(selected),multiple=x=>x===null?'无法测算':x.toFixed(2)+' 倍',hour=x=>x===null?'—':Number(x.toFixed(1))+'h';
      const stats=card('人均月交付',m(all.monthlyIncome),`${entities.length} 人 · ${all.personMonths} 人月`,'accent')+card('人均月净利润',m(all.monthlyNet),'税后利润 ÷ 人月数',all.monthlyNet!==null&&all.monthlyNet<0?'negative':'')+card('小时交付产出',m(all.incomePerHour),'交付金额 ÷ 实际项目工时 · 元/h')+card('小时净利润',m(all.netPerHour),'税后利润 ÷ 实际项目工时 · 元/h')+card('人工投入产出比',multiple(all.laborReturn),'交付 ÷（固定人工＋提成＋奖金）')+card('工时利用率',p(all.utilization),`${hour(all.hours)} / ${hour(all.standardHours)}`);
      const people=entities.map(entity=>({entity,...efficiencyFor(selected.filter(r=>r.entity.id===entity.id))}));
      const sortKey=f.efficiencySort||'incomePerHour';people.sort((a,b)=>(b[sortKey]??-Infinity)-(a[sortKey]??-Infinity));
      const comparisonRows=people.map((r,i)=>[e(r.entity.name),hour(r.hours),hour(r.standardHours),p(r.utilization),hour(r.idleHours),m(r.monthlyIncome),m(r.incomePerHour),m(r.netPerHour),m(r.labor),multiple(r.laborReturn),r.complete?badge('数据完整','success'):badge('待补齐 · 试算','warn'),b('查看来源','sources',`data-kind="person" data-id="${e(r.entity.id)}"`,'link')]);
      const efficiencyMonths=cumulative?months:[month];
      const trendRows=efficiencyMonths.map(period=>({month:period,...efficiencyFor(entities.map(entity=>model(entity.id,period)))}));
      const trends=table(['月份','人均月交付（元）','人均月净利（元）','小时产出（元/h）','投入产出比'],trendRows.map(r=>[e(r.month),m(r.monthlyIncome),m(r.monthlyNet),m(r.incomePerHour),multiple(r.laborReturn)]));
      const capacity=people.map(r=>`<div class="efficiency-capacity-row"><div><strong>${e(r.entity.name)}</strong><span>${hour(r.hours)} / ${hour(r.standardHours)}</span></div><div class="efficiency-capacity-track"><i style="width:${Math.min(100,Math.max(0,(r.utilization||0)*100))}%"></i></div><div><small>未投入 ${hour(r.idleHours)}</small><b>${p(r.utilization)}</b></div></div>`).join('');
      efficiency=`<section class="efficiency-overview"><div class="efficiency-heading"><div><h2>人效分析</h2><p>${cumulative?'累计至 '+e(month):e(month)+' 当月'} · ${entities.length} 位人员 · 按实际项目投入与确认交付核算</p></div><span>${badge(all.complete?'数据完整':'部分指标待补齐',all.complete?'success':'warn')}</span></div><div class="metrics six">${stats}</div></section><section class="panel efficiency-comparison"><div class="panel-head"><div><h2>人员人效对比</h2><small>同一期间、同一核算口径</small></div><label class="efficiency-sort">排序 <select data-filter="efficiencySort">${options([{id:'incomePerHour',name:'小时交付产出'},{id:'monthlyIncome',name:'人均月交付'},{id:'laborReturn',name:'人工投入产出比'},{id:'utilization',name:'工时利用率'}],sortKey)}</select></label></div>${table(['人员','实际工时','标准工时','工时利用率','未投入工时','人均月交付（元）','小时交付（元/h）','小时净利（元/h）','人工投入（元）','投入产出比','数据状态','操作'],comparisonRows)}<p class="panel-note">未投入工时按每人每月 MAX（标准工时－实际项目工时，0）汇总，不直接视为可排班工时。草稿不计投入；人工投入含整月固定人工、提成和奖金。</p></section><div class="two-col efficiency-bottom"><section class="panel"><div class="panel-head"><h2>人效月度趋势</h2><small>${cumulative?'各月分别计算，便于对比':'切换“累计”可查看各月变化'}</small></div>${trends}</section><section class="panel"><div class="panel-head"><h2>工时投入与利用</h2><small>实际项目工时 ÷ 标准工时</small></div><div class="panel-body">${capacity}<p class="rule-text">合计未投入工时：${hour(all.idleHours)}。累计利用率按合计工时计算，不平均各月百分比。</p></div></section></div><details class="efficiency-method panel"><summary>查看人效指标口径</summary><div class="panel-body"><p>人均月交付／净利＝所选期间交付金额／税后利润 ÷ 人月数（人数 × 选中月份数）。小时产出按项目实际工时计算，交付金额按项目成员当月收入比例分配；两者归属口径不同，指标用于经营观察。</p><p>人工投入产出比＝交付金额 ÷（固定人工＋提成＋奖金），不含税费和管理费。分母为0或收入比例、工资等必要输入缺失时，相应指标显示“—”或“无法测算”。缺少工资不影响已有交付金额和工时指标。</p></div></details>`;
    }
    const viewTabs=isProject?'':`<div class="analysis-view-tabs" aria-label="项目人效分析视角">${[['accounting','经营核算'],['efficiency','人效分析']].map(([value,label])=>`<button type="button" class="${(efficiencyView?'efficiency':'accounting')===value?'active':''}" data-filter="personAnalysisView" data-value="${value}">${label}</button>`).join('')}</div>`;
    const detailContent=`${missing.length?`<div class="notice"><strong>存在 ${missing.length} 项输入缺失，以下为试算结果</strong><details><summary>查看待补充明细</summary><ul>${missing.map(v=>`<li>${e(v)}</li>`).join('')}</ul></details></div>`:''}${efficiencyView?efficiency:`<div class="metrics six">${metrics}</div><div class="two-col">${chart}${costChart}</div>${comparison}${details}`}`;
    if(ctx.contentOnly)return detailContent;
    return `<div class="page-heading"><div><div class="eyebrow">ACCOUNTING ANALYSIS</div><h1>${isProject?'项目分析':'项目人效分析'}</h1><p>${isProject?'从交付、回款到累计盈亏，查看项目经营表现（2026-02 起立项项目）':'查看项目贡献、个人成本和投入饱和度（含 2026-02 起参与的全部项目）'}</p></div><div class="heading-actions">${b(efficiencyView?'导出核算数据':'导出当前分析','export-analysis')}</div></div><section class="panel"><div class="filters"><label>期间 <select data-filter="month">${options(s.months.map(v=>({id:v,name:v})),month)}</select></label><label>${isProject?'项目':'人员'} <select data-filter="${isProject?'analysisProject':'analysisPerson'}">${options([{id:'all',name:'全部'+(isProject?'项目':'人员')},...collection],selection)}</select></label><div class="segment">${[['month','当月'],['cumulative','累计']].map(([v,t])=>`<button class="${(cumulative?'cumulative':'month')===v?'active':''}" data-filter="periodMode" data-value="${v}">${t}</button>`).join('')}</div><span class="push">${badge(s.closed[month]?'已结快照':'未结账 · 实时试算',s.closed[month]?'success':'blue')}</span></div></section>${viewTabs}${detailContent}`;
  }};
})(window);
