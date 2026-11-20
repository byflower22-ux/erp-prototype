/* Management insights derived from the same demo ledger. No business inputs are changed. */
(function(root){
  'use strict';
  const legacy=root.ProjectAnalysis,M=root.ProjectModel,U=root.ProjectUI,{esc:e,money:m,percent:p,button:b,badge,card,table,options}=U;
  const AS_OF='2026-11-09';
  const add=(rows,key)=>rows.reduce((n,r)=>n+Number(r[key]||0),0),round=M.round;
  const reasons=r=>(r.missing||[]).filter(x=>!x.includes('无法测算'));
  const config={margin:0.15,cash:0.7,utilLow:0.6,utilHigh:0.9,roi:1.5,concentration:0.7,drop:0.1};
  const multiple=x=>x==null?'—':x.toFixed(2)+'倍';
  function calendar(s,month){const all=s.calendar[month]?.days||[],partial=month===AS_OF.slice(0,7),days=all.filter(d=>d<=AS_OF);return {partial,days,elapsed:days.length*8,full:s.calendar[month]?.standardHours||0};}
  function businessHours(s,personId,projectId,month){return s.times.filter(t=>t.status==='submitted'&&t.date.startsWith(month)&&t.date<=AS_OF&&(!personId||t.personId===personId)&&(!projectId||t.projectId===projectId)).reduce((n,t)=>n+t.hours,0)+s.historicalTimes.filter(t=>t.month===month&&month<AS_OF.slice(0,7)&&(!personId||t.personId===personId)&&(!projectId||t.projectId===projectId)).reduce((n,t)=>n+t.hours,0);}
  const periods=(s,entity,kind,month)=>s.months.filter(v=>v<=month&&(kind==='project'?v>=entity.startDate.slice(0,7):v>=entity.joined.slice(0,7))).sort();
  function data(ctx){
    const {state:s,month,filters:f}=ctx,kind=ctx.page==='project-analysis'?'project':'person',project=kind==='project',cumulative=f.periodMode==='cumulative',id=project?f.analysisProject:f.analysisPerson;
    const scope=root.ProjectAnalysisScope.select(ctx),{collection,entities}=scope,cal=calendar(s,month),model=project?M.projectResult:M.personResult;
    const rows=entities.map(entity=>{
      const history=periods(s,entity,kind,month).map(v=>model(s,entity.id,v)),now=model(s,entity.id,month),previous=history.length>1?history[history.length-2]:null,selected=cumulative?history:[now],missing=[...new Set(selected.flatMap(reasons))];
      const income=add(selected,'income'),net=project&&cumulative?now.cumulative.net:add(selected,'net'),cost=add(selected,'totalCost'),tax=project&&cumulative?now.cumulative.tax:add(selected,'tax'),hours=selected.reduce((n,r)=>n+businessHours(s,project?null:entity.id,project?entity.id:null,r.month),0),standard=selected.reduce((n,r)=>n+calendar(s,r.month).elapsed,0),fullStandard=project?0:add(selected,'standardHours');
      const costs=selected.reduce((a,r)=>{Object.keys(r.costs).forEach(k=>a[k]=(a[k]||0)+r.costs[k]);return a;},{}),salaryMissing=missing.some(x=>x.includes('工资')),revenueMissing=missing.some(x=>x.includes('收入比例')),labor=project?costs.salary:(costs.salary||0)+(costs.commission||0)+(costs.bonus||0),complete=missing.length===0;
      const received=project?now.cumulative.received:null,delivered=project?now.cumulative.income:null,cashGap=project?Math.max(delivered-received,0):0,cashRate=project&&delivered>0?received/delivered:null;
      const contributions=project?[]:Object.values(selected.flatMap(r=>r.projects).reduce((a,x)=>{if(!a[x.projectId])a[x.projectId]={id:x.projectId,income:0,hours:0,salary:0};a[x.projectId].income+=x.income;a[x.projectId].salary+=x.salary;return a;},{})).map(x=>({...x,hours:selected.reduce((n,r)=>n+businessHours(s,entity.id,x.id,r.month),0)}));
      const top=contributions.filter(x=>x.income>0).sort((a,b)=>b.income-a.income)[0],util=standard>0?hours/standard:null;
      return {entity,history,now,previous,selected,missing,income,net,cost,tax,hours,standard,fullStandard,costs,labor,complete,salaryMissing,revenueMissing,margin:income>0&&complete?net/income:null,incomeHour:hours>0&&!revenueMissing?income/hours:null,roi:labor>0&&!salaryMissing&&!revenueMissing?income/labor:null,received,delivered,cashGap,cashRate,util,contributions,concentration:income>0&&top?top.income/income:null,top,id:entity.id};
    });
    return {s,month,f,kind,project,cumulative,collection,entities,rows,cal,...scope};
  }
  function warnings(d){const alerts=[];
    const push=(r,code,level,title,evidence,action)=>alerts.push({id:d.kind+'-'+r.id+'-'+d.month+'-'+code,entityId:r.id,name:r.entity.name,owner:d.project?d.s.people.find(x=>x.id===r.entity.ownerId)?.name||'项目负责人':r.entity.name,code,level,title,evidence,action,kind:d.kind});
    for(const r of d.rows){
      if(r.missing.length)push(r,'input','data','核算依据待补齐',r.missing.join('；'),'先补齐工资、比例或标准工时，再复核利润和投入产出；可继续查看已有交付与工时。');
      if(r.complete&&r.net<0)push(r,'loss','high',d.cal.partial?'利润承压，待月末复核':'经营亏损',`${d.cumulative?'累计':'当月'}税后利润 ${m(r.net)} 元；交付 ${m(r.income)} 元，成本 ${m(r.cost)} 元。`,'拆分交付节奏和成本原因，复核尚未确认的交付；优先控制新增非必要费用。');
      else if(r.complete&&r.margin!==null&&r.margin<config.margin)push(r,'margin','medium','净利率低于观察线',`当前 ${p(r.margin)}，低于演示观察线 ${p(config.margin)}。`,'核查项目定价、成员分配和费用结构，避免仅靠增加投入追交付。');
      if(d.project){
        if(r.delivered>0&&r.cashRate<config.cash)push(r,'cash',r.cashRate<.4?'high':'medium','交付与回款存在缺口',`累计交付 ${m(r.delivered)}，回款 ${m(r.received)}，缺口 ${m(r.cashGap)} 元，覆盖率 ${p(r.cashRate)}。`,'由项目负责人与客户经理核对验收、开票和合同回款节点；目前缺账期数据，不能据此认定逾期。');
        if(r.now.income===0&&businessHours(d.s,null,r.id,d.month)>0)push(r,'delivery','medium','有投入，尚无确认交付',`本月投入 ${businessHours(d.s,null,r.id,d.month)}h，确认交付 0 元。`,'核实投入是否属于计划里程碑；查看待验收事项，避免把交付节奏误判为人员低效。');
        if(r.previous&&!d.cal.partial&&r.complete&&!reasons(r.previous).length&&r.previous.margin!=null&&r.now.margin!=null&&r.previous.margin-r.now.margin>=config.drop)push(r,'decline','medium','净利率环比下降',`上月 ${p(r.previous.margin)} → 本月 ${p(r.now.margin)}，下降 ${((r.previous.margin-r.now.margin)*100).toFixed(1)} 个百分点。`,'对照月度交付、人工投入和新增费用，核查净利率下降原因。');
      }else{
        if(r.util!==null&&r.util<config.utilLow)push(r,'capacity','medium','项目投入利用率偏低',`核算工时口径 ${r.hours}h / ${r.standard}h = ${p(r.util)}；观察线 ${p(config.utilLow)}。`,'核对非项目工作、请假和漏报，再安排可承接项目；未投入工时不等同可排班产能。');
        if(r.util!==null&&r.util>config.utilHigh)push(r,'load','medium','交付负荷偏高',`实际项目工时占标准工时 ${p(r.util)}，高于 ${p(config.utilHigh)}。`,'核对未来排期与交付节点，评估是否需要协作支援；该指标不是加班判定。');
        if(r.roi!==null&&r.roi<config.roi)push(r,'roi','medium','人工投入产出偏低',`交付 ${m(r.income)} ÷ 人工投入 ${m(r.labor)} = ${multiple(r.roi)}；观察线 ${config.roi} 倍。`,'先核对收入分配比例和未确认交付，再判断定价、任务结构与人工成本。');
        if(r.concentration!==null&&r.concentration>config.concentration)push(r,'single','medium','交付贡献集中于单项目',`最大项目贡献 ${p(r.concentration)}，项目：${d.s.projects.find(x=>x.id===r.top.id)?.name||r.top.id}。`,'提前准备后续项目衔接与知识交接，降低单项目结束带来的交付波动。');
        const mismatch=r.contributions.filter(x=>(x.income>0&&x.hours===0)||(x.income===0&&x.hours>0));
        if(mismatch.length)push(r,'mapping','data','收入与投入需要对照核查',mismatch.map(x=>`${d.s.projects.find(v=>v.id===x.id)?.name||x.id}：交付 ${m(x.income)} 元 / ${x.hours}h`).join('；'),'逐项目核对工时填报与当月收入比例；二者分配口径不同，不自动认定错账或低效。');
      }
    }
    const priority={high:0,data:1,medium:2};return alerts.sort((a,b)=>priority[a.level]-priority[b.level]);
  }
  const levelName={high:'优先处理',medium:'关注',data:'数据核查'};
  function filters(d){return `<section class="panel manager-filters"><div class="filters"><label>核算期间 <select data-filter="month">${options(d.s.months.map(x=>({id:x,name:x})),d.month)}</select></label>${d.project?`<label>项目团队 <select data-filter="analysisTeam">${options([{id:'all',name:'全部团队'},...d.teams.map(name=>({id:name,name}))],d.selectedTeam)}</select></label>`:''}<label>${d.project?'项目':'人员'} <select data-filter="${d.project?'analysisProject':'analysisPerson'}">${options([{id:'all',name:d.project?'全部项目':'全部人员'},...d.collection],d.project?d.f.analysisProject||'all':d.f.analysisPerson||'all')}</select></label><div class="segment">${[['month','当月'],['cumulative','累计']].map(([v,t])=>`<button class="${(d.cumulative?'cumulative':'month')===v?'active':''}" data-filter="periodMode" data-value="${v}">${t}</button>`).join('')}</div><span class="push manager-asof">演示数据截至 ${AS_OF}${d.cal.partial?' · 本月未结束':''}</span></div>${d.project?'':`<div class="analysis-role-row"><span>项目角色</span><div class="analysis-role-shortcuts" role="group" aria-label="项目角色筛选">${[{id:'all',name:'全部角色'},...d.roles.map(name=>({id:name,name}))].map(x=>`<button type="button" data-filter="analysisRole" data-value="${e(x.id)}" class="${d.selectedRole===x.id?'active':''}" aria-pressed="${d.selectedRole===x.id}">${e(x.name)}</button>`).join('')}</div><small>按项目成员角色筛选人员，个人核算包含其全部项目</small></div>`}</section>`;}
  function alertCard(a){return `<article class="manager-alert ${a.level}"><div class="manager-alert-title">${badge(levelName[a.level],a.level==='high'?'danger':a.level==='data'?'blue':'warn')}<b>${e(a.title)}</b></div><strong>${e(a.name)}</strong><p>${e(a.evidence)}</p><footer>${b('查看诊断','manager-diagnose',`data-kind="${a.kind}" data-id="${e(a.entityId)}"`,'link')}</footer></article>`;}
  function alertsView(d,alerts,limit){const chosen=limit?alerts:alerts.filter(a=>!d.f.alertLevel||d.f.alertLevel==='all'||d.f.alertLevel===a.level),show=limit?chosen.slice(0,limit):chosen;return `<section class="manager-warning-section"><div class="manager-section-title"><div><h2>${limit?'优先关注事项':'全部预警'}</h2><p>由当前数据与演示阈值触发</p></div>${limit?b('更多 · '+alerts.length+' 项','manager-alerts','','link'):`<label class="manager-sort">级别 <select data-manager-alert-level>${options([{id:'all',name:'全部'},{id:'high',name:'优先处理'},{id:'medium',name:'关注'},{id:'data',name:'数据核查'}],d.f.alertLevel||'all')}</select></label>`}</div>${show.length?`<div class="manager-alert-grid">${show.map(a=>alertCard(a)).join('')}</div>`:U.empty('当前筛选范围内没有触发预警')}</section>`;}
  function overview(d,alerts){
    const rows=d.rows,income=add(rows,'income'),cost=add(rows,'cost'),net=add(rows,'net'),hours=add(rows,'hours'),standard=add(rows,'standard'),complete=rows.every(r=>r.complete),loss=rows.filter(r=>r.complete&&r.net<0),lossAmount=-add(loss,'net'),partial=rows.filter(r=>!r.complete).length;
    const gap=add(rows,'cashGap'),received=add(rows,'received'),delivered=add(rows,'delivered'),healthy=rows.filter(r=>r.complete&&r.net>=0&&r.margin!==null&&r.margin>=config.margin),util=standard>0?hours/standard:null;
    const headline=d.project?`${loss.length} 个项目利润承压，${rows.filter(r=>r.cashRate!==null&&r.cashRate<config.cash).length} 个项目需核对回款衔接`:`${rows.filter(r=>r.util!==null&&r.util<config.utilLow).length} 位人员项目投入偏低，${rows.filter(r=>r.concentration>config.concentration).length} 位需关注项目接续`;
    const cards=card(d.project?'确认交付金额':'团队交付金额',m(income),d.cumulative?'截至所选月累计':'所选月已确认交付','accent')+card('税后利润',complete?m(net):'待补齐',complete?(d.cal.partial?'含整月固定成本，非月末预测':'收入、费用及所得税后的经营结果'):`${partial} 个主体缺输入，已计算试算 ${m(net)}`)+card('经营净利率',complete&&income>0?p(net/income):'—','合计利润 ÷ 合计交付，不平均百分比')+(d.project?card('交付回款缺口',m(gap),'逐项目 MAX（累计交付－回款，0）')+card('亏损项目金额',m(lossAmount),`${loss.length} 个，缺输入项目不计入`,'negative')+card('待关注主体',new Set(alerts.map(a=>a.entityId)).size+' / '+rows.length,`${alerts.length} 项提示 · ${healthy.length} 个达到利润观察线`):card('项目工时利用率',p(util),`已过工作日口径 ${hours}h / ${standard}h`)+card('人均月交付',m(income/(rows.reduce((n,r)=>n+r.selected.length,0)||1)),'按有效人月数，累计不直接除人数')+card('待核查人员',new Set(alerts.filter(a=>a.level==='data').map(a=>a.entityId)).size+' 人',`${partial} 人利润或成本依据不完整`));
    return `<section class="manager-pulse"><div><span class="eyebrow">MANAGEMENT BRIEF</span><h2>${headline}</h2><p>${d.cal.partial?'本月尚未结束：工时利用率按已过工作日计算；利润包含整月人工和已录费用，不能视为月末预测。':'已完成月份可比较整月表现；历史估算工时仅用于汇总分析。'}${partial?' 缺输入主体先核查，不据此排名利润。':''}</p></div><div class="manager-pulse-count"><b>${alerts.length}</b><span>项决策提示</span></div></section><div class="metrics six manager-kpis">${cards}</div>`;
  }
  function matrix(d){const valid=d.rows.filter(r=>r.complete&&(d.project?r.cashRate!==null&&(r.margin!==null||r.net<0):r.util!==null&&r.roi!==null)),excluded=d.rows.length-valid.length;
    const cells=d.project?[{label:'盈利 · 回款衔接好',note:'保持交付节奏，评估可复制做法',x:true,y:true},{label:'盈利 · 回款需跟进',note:'先核对验收和合同回款节点',x:false,y:true},{label:'利润偏低 · 回款衔接好',note:'优先复核定价和成本结构',x:true,y:false},{label:'利润偏低 · 回款需跟进',note:'经营与资金双线复核',x:false,y:false}]:[{label:'高产出 · 高利用',note:'关注负荷，沉淀交付方法',x:true,y:true},{label:'高产出 · 低利用',note:'核对收入分配，再评估扩充任务',x:false,y:true},{label:'低产出 · 高利用',note:'排查定价、返工与任务结构',x:true,y:false},{label:'低产出 · 低利用',note:'核实漏报，再评估项目接续',x:false,y:false}];
    return `<section class="panel manager-matrix"><div class="panel-head"><div><h2>${d.project?'项目经营分层':'人员产能与产出分层'}</h2><small>${d.project?'纵向：净利率15%｜横向：累计回款覆盖率70%':'纵向：人工投入产出1.5倍｜横向：利用率60%'} · 均为演示观察线</small></div></div><div class="manager-matrix-grid">${cells.map((cell,i)=>{const members=valid.filter(r=>{const x=d.project?r.cashRate>=config.cash:r.util>=config.utilLow,y=d.project?r.margin!==null&&r.margin>=config.margin:r.roi!==null&&r.roi>=config.roi;return x===cell.x&&y===cell.y&&(d.project||r.roi!==null);});return `<div class="manager-quadrant q${i}"><div><b>${cell.label}</b><span>${members.length}</span></div><p>${cell.note}</p><div class="manager-entity-chips">${members.map(r=>b(r.entity.name,'manager-diagnose',`data-kind="${d.kind}" data-id="${e(r.id)}"`,'')).join('')||'<small>暂无主体</small>'}</div></div>`;}).join('')}</div><p class="panel-note">${excluded} 个主体因缺必要输入或无可用分母未进入分层。${d.project?'回款覆盖率＝累计回款÷累计交付；零交付且亏损按利润偏低归类。没有合同账期，不定义逾期。':'按有效核算数据分层，不能直接作为绩效结论；利用率采用已过标准工时。'}</p></section>`;
  }
  function trend(d){const months=d.s.months.filter(x=>x<=d.month).sort(),rows=months.map(month=>{const sub=data({...d.ctx,month,filters:{...d.f,periodMode:'month'}});const income=add(sub.rows,'income'),net=add(sub.rows,'net');return {month,income,net,complete:sub.rows.every(x=>x.complete),partial:calendar(d.s,month).partial};}),max=Math.max(1,...rows.map(x=>x.income));return `<section class="panel manager-trend"><div class="panel-head"><div><h2>交付与利润变化</h2><small>本月未结束时不与上月整月同比增速</small></div></div><div class="panel-body">${rows.map(r=>`<div class="manager-trend-row"><span>${r.month}${r.partial?'<small>月中数据</small>':''}</span><div class="manager-trend-track"><i style="width:${r.income/max*100}%"></i></div><div><strong>${m(r.income)}</strong><small class="${r.net<0?'negative':'positive'}">净利 ${r.complete?m(r.net):'待补齐'}</small></div></div>`).join('')}<div class="manager-chart-legend"><i></i>确认交付金额 · 元 <span>所有金额均来自核算模型</span></div></div></section>`;}
  function ranking(d,alerts){const list=d.rows.slice(),mode=d.f.managerSort||'risk',n=r=>alerts.filter(a=>a.entityId===r.id).reduce((x,a)=>x+(a.level==='high'?3:a.level==='data'?2:1),0);list.sort((a,b)=>mode==='risk'?n(b)-n(a):mode==='income'?b.income-a.income:mode==='margin'?(b.margin??-Infinity)-(a.margin??-Infinity):(b.incomeHour??-Infinity)-(a.incomeHour??-Infinity));
    const rows=list.filter(r=>!d.f.managerOnlyRisk||d.f.managerOnlyRisk==='all'||alerts.some(a=>a.entityId===r.id)).map(r=>{const count=alerts.filter(a=>a.entityId===r.id).length,ops=b('经营诊断','manager-diagnose',`data-kind="${d.kind}" data-id="${e(r.id)}"`,'link');return d.project?[`<b>${e(r.entity.name)}</b><small>负责人 ${e(d.s.people.find(x=>x.id===r.entity.ownerId)?.name||'—')}</small>`,m(r.income),r.complete?m(r.net):badge('待补齐','warn'),p(r.margin),m(r.cashGap),p(r.cashRate),r.hours+'h',count?badge(count+'项关注','warn'):badge('未触发','success'),ops]:[`<b>${e(r.entity.name)}</b><small>${e([...new Set(d.members.filter(x=>x.personId===r.id).map(x=>x.role))].join(' / ')||'未分配角色')}</small>`,m(r.income),r.complete?m(r.net):badge('待补齐','warn'),p(r.util),m(r.incomeHour),multiple(r.roi),p(r.concentration),count?badge(count+'项关注','warn'):badge('未触发','success'),ops];});
    return `<section class="panel manager-ranking"><div class="panel-head"><div><h2>${d.project?'项目决策清单':'人员经营与产能清单'}</h2><small>风险优先，查看数值、依据与行动建议</small></div><div class="manager-table-controls"><select data-filter="managerOnlyRisk">${options([{id:'all',name:'全部主体'},{id:'risk',name:'仅有预警'}],d.f.managerOnlyRisk||'all')}</select><select data-filter="managerSort">${options([{id:'risk',name:'按关注优先级'},{id:'income',name:'按交付金额'},{id:'margin',name:'按净利率'},{id:'hour',name:'按小时产出'}],mode)}</select></div></div>${table(d.project?['项目 / 负责人','交付金额','税后利润','净利率','累计回款缺口','回款覆盖率','项目投入','关注','操作']:['人员','交付金额','税后利润','利用率','小时产出','人工投入产出','单项目集中度','关注','操作'],rows)}</section>`;
  }
  function capacity(d){const low=d.rows.filter(r=>r.util!==null&&r.util<config.utilLow),high=d.rows.filter(r=>r.util!==null&&r.util>config.utilHigh),underHours=low.reduce((n,r)=>n+Math.max(r.standard-r.hours,0),0);return `<section class="panel manager-capacity"><div class="panel-head"><div><h2>资源配置建议</h2><small>先核对实际状态，再安排项目接续</small></div></div><div class="panel-body"><div class="manager-capacity-numbers"><div><b>${low.length}</b><span>低利用人员</span></div><div><b>${underHours}h</b><span>未计入项目的标准工时</span></div><div><b>${high.length}</b><span>高负荷人员</span></div></div><h3>建议先核查</h3>${low.map(r=>`<div class="manager-resource"><b>${e(r.entity.name)}</b><span>利用率 ${p(r.util)}</span>${b('查看项目构成','manager-diagnose',`data-kind="person" data-id="${e(r.id)}"`,'link')}</div>`).join('')||'<p>当前没有触发低利用观察线。</p>'}<p>工时差值包含内部工作、请假和未填报，不等同可用排期。缺岗位技能、未来日程与请假数据，当前不自动推荐人员调入或调出。</p></div></section>`;}
  function rules(d){return `<details class="manager-rules panel"><summary>预警规则与数据口径 · 演示阈值，可继续调整</summary><div class="panel-body"><div class="manager-rule-grid"><div><b>利润与回款</b><p>税后利润＜0提示利润承压；净利率＜15%进入关注；累计回款／累计交付＜70%提示衔接缺口，＜40%优先处理。项目本月有投入但无交付提示核查里程碑。</p></div><div><b>产能与人效</b><p>项目工时／已过标准工时＜60%或＞90%提示核查；交付／（固定人工＋提成＋奖金）＜1.5倍提示关注；单项目交付占比＞70%提示项目接续。</p></div><div><b>数据与比较</b><p>缺工资或收入比例时不下盈利结论，不纳入利润排名和分层。历史估算工时保留原标识；本月按${AS_OF}截点核对利用率。月中不触发整月环比下降。</p></div><div><b>尚缺的决策依据</b><p>目前没有合同应收账龄、开票／验收到期日、项目预算基线、里程碑计划及未来技能排期，暂不推断逾期、预算超支或交付延期。建议不自动落任务。</p></div></div></div></details>`;}
  function projectOverviewCode(d,project){return `<small class="project-overview-code">项目编号：${e(root.ProjectDelivery.info(d.s,project).code)}</small>`;}
  function projectMissing(d,showCode=false){
    const rows=d.rows.filter(r=>r.missing.length);
    return rows.length?`<div class="notice project-missing"><strong>数据缺失 · ${rows.length} 个项目待补齐，成本与利润为试算</strong><details><summary>查看缺失明细</summary><ul>${rows.map(r=>`<li><b>${e(r.entity.name)}</b>${showCode?projectOverviewCode(d,r.entity):''}<ul>${r.selected.filter(x=>reasons(x).length).map(x=>`<li>${e(x.month)}：${reasons(x).map(e).join('；')}</li>`).join('')}</ul></li>`).join('')}</ul></details></div>`:'';
  }
  function projectStatusCount(d){
    const statuses=['进行中','未开始','已结项','售后中','已关闭','未提交','已失效'],counts={};
    d.rows.forEach(r=>{const status=M.projectStatus(r.entity)||'未维护';counts[status]=(counts[status]||0)+1;if(!statuses.includes(status))statuses.push(status);});
    return `<div class="metric accent project-count"><span>项目数量</span><strong>${d.rows.length} 个</strong><div class="project-status-counts" aria-label="按项目状态统计">${statuses.map(status=>`<div><span>${e(status)}</span><b>${counts[status]||0}</b></div>`).join('')}</div></div>`;
  }
  function projectProfitRanking(d){
    const valid=d.rows.filter(r=>r.complete&&r.margin!==null).sort((a,b)=>b.margin-a.margin),pending=d.rows.filter(r=>!r.complete||r.margin===null),max=Math.max(.01,...valid.map(r=>Math.abs(r.margin)));
    return `<section class="panel project-profit-ranking"><div class="panel-head"><div><h2>项目利润率排行</h2><small>${d.cumulative?'累计':'当月'}净利润 ÷ 确认交付金额 · 由高到低</small></div><span class="project-panel-count">${valid.length} 个可排行</span></div><div class="project-profit-list">${valid.length?valid.map((r,i)=>`<div class="project-profit-row"><span class="project-rank-number ${i<3?'top':''}">${i+1}</span><div class="project-rank-info">${b(r.entity.name,'project-detail',`data-id="${e(r.id)}"`,'link')}${projectOverviewCode(d,r.entity)}<small>交付 ${m(r.income)} · 净利润 ${m(r.net)} 元</small><div class="project-profit-track"><i class="${r.margin<0?'loss':''}" style="width:${Math.abs(r.margin)/max*100}%"></i></div></div><b class="${r.margin<0?'negative':'positive'}">${p(r.margin)}</b></div>`).join(''):'<div class="project-overview-empty">当前没有可排行的项目</div>'}</div>${pending.length?`<details class="project-ranking-pending"><summary>待核算 ${pending.length} 个项目</summary>${pending.map(r=>`<div><span>${e(r.entity.name)}${projectOverviewCode(d,r.entity)}</span><small>${r.complete?'确认交付金额为零':e(r.missing.join('；'))}</small></div>`).join('')}</details>`:''}</section>`;
  }
  function projectLifecycle(d){
    const end=new Date(Number(d.month.slice(0,4)),Number(d.month.slice(5,7)),0).getDate(),asof=[d.month+'-'+end,AS_OF].sort()[0],dayDiff=(from,to)=>Math.max(0,Math.round((Date.parse(to+'T00:00:00Z')-Date.parse(from+'T00:00:00Z'))/86400000));
    // Independent, explicitly labelled examples for the overview; accounting stays on the ledger.
    const demoProject=id=>d.rows.some(r=>r.id===id&&r.entity.name.includes('（示例）'));
    const exampleEvents=[
      {kind:'stop',projectId:'p2',date:'2026-11-03',resumedAt:'2026-11-08',reason:'客户组织调整，阶段性交付中止',demo:true},
      {kind:'refund',projectId:'p2',date:'2026-11-06',amount:6000,status:'已退费',reason:'取消部分服务内容',demo:true},
      {kind:'refund',projectId:'p1',date:'2026-11-08',amount:12000,status:'审批中',reason:'服务范围调整，申请部分退费',demo:true}
    ].filter(x=>demoProject(x.projectId));
    const events=(d.s.projectAnalysisEvents||exampleEvents).filter(x=>d.rows.some(r=>r.id===x.projectId)&&x.date<=asof&&(d.cumulative||x.date.startsWith(d.month)));
    const projectLink=x=>{const project=d.rows.find(r=>r.id===x.projectId)?.entity;return project?b(project.name,'project-detail',`data-id="${e(x.projectId)}"`,'link')+projectOverviewCode(d,project):'—';};
    let missingPlan=0;
    const delayed=d.rows.flatMap(r=>{
      const project=r.entity,demo=!project.endDate&&r.id==='p1'&&demoProject(r.id),planned=project.endDate||(demo?'2026-10-31':null),completed=project.actualEndDate||project.completedDate;
      if(!planned){missingPlan++;return [];}
      const terminal=['已结项','已关闭','已失效'].includes(M.projectStatus(project));
      if(terminal&&!completed){missingPlan++;return [];}
      const until=completed&&completed<=asof?completed:asof,days=dayDiff(planned,until);
      if(!days)return [];
      return [{projectId:r.id,planned,completed:completed&&completed<=asof?completed:null,days,reason:project.delayReason||(demo?'客户验收时间调整':'—'),demo}];
    }).sort((a,b)=>b.days-a.days);
    const stops=events.filter(x=>x.kind==='stop'),activeStops=stops.filter(x=>!x.resumedAt||x.resumedAt>asof),refunds=events.filter(x=>x.kind==='refund'),paid=refunds.filter(x=>x.status==='已退费'),waiting=refunds.filter(x=>x.status==='审批中');
    const panel=(kind,title,subtitle,stats,headers,rows,note)=>`<section class="panel project-lifecycle project-${kind}"><div class="panel-head"><div><h2>${title}</h2><small>${e(subtitle)}</small></div></div><div class="project-case-stats">${stats.map(([label,value])=>`<div><span>${e(label)}</span><b>${e(value)}</b></div>`).join('')}</div>${rows.length?table(headers,rows):'<div class="project-overview-empty">当前范围暂无相关记录</div>'}<p class="panel-note">${e(note)}</p></section>`;
    return {
      delay:panel('delay','项目延期情况','截至 '+asof,[['延期项目',delayed.length+' 个'],['最长延期',delayed.length?Math.max(...delayed.map(x=>x.days))+' 天':'—'],['待补日期',missingPlan+' 个']],['项目','计划结束','延期天数','情况'],delayed.map(x=>[projectLink(x)+(x.demo?'<small>模拟数据</small>':''),e(x.planned),`<b class="negative">${x.days} 天</b>`,badge(x.completed?'已完成':'延期中',x.completed?'success':'warn')+`<small>${e(x.reason)}</small>`]),'计划结束日期早于完成日期或统计截止日时计为延期；未维护计划或实际完成日期的项目待补齐。'),
      stop:panel('stop','项目中止情况',(d.cumulative?'累计至 ':'当月 · ')+d.month,[['中止记录',stops.length+' 次'],['仍在中止',activeStops.length+' 次'],['已恢复',stops.length-activeStops.length+' 次']],['项目','中止日期','恢复日期','中止原因'],stops.map(x=>[projectLink(x)+(x.demo?'<small>模拟数据</small>':''),e(x.date),x.resumedAt&&x.resumedAt<=asof?e(x.resumedAt):badge('中止中','warn'),e(x.reason||'—')]),'按中止发生日期筛选，已恢复记录保留；中止记录与项目当前状态分别展示。'),
      refund:panel('refund','项目退费情况',(d.cumulative?'累计至 ':'当月 · ')+d.month,[['退费记录',refunds.length+' 笔'],['已退费',m(add(paid,'amount'))+' 元'],['待审批',m(add(waiting,'amount'))+' 元']],['项目','日期','退费金额（元）','状态 / 原因'],refunds.map(x=>[projectLink(x)+(x.demo?'<small>模拟数据</small>':''),e(x.date),m(x.amount),badge(x.status,x.status==='已退费'?'success':'warn')+`<small>${e(x.reason||'—')}</small>`]),'按退费发生／申请日期筛选，已退费与审批中金额分别汇总。示例记录用于演示，不参与当前核算。')
    };
  }
  function projectOverview(d){
    const pending=d.rows.filter(r=>!r.complete).length,period=d.cumulative?'截至所选月累计':'所选月',cost=add(d.rows,'cost'),net=add(d.rows,'net');
    const cards=projectStatusCount(d)
      +card('合同金额',m(d.rows.reduce((n,r)=>n+r.now.contract,0)),'按项目去重 · 元')
      +card('回款',m(add(d.rows,'received')),'截至所选月累计回款 · 元')
      +card('应收',m(d.rows.reduce((n,r)=>n+r.now.receivable,0)),'项目登记应收余额 · 元')
      +card('确认交付金额',m(add(d.rows,'income')),period+'已确认交付 · 元','accent')
      +card('总成本',m(cost),pending?`试算 · ${pending} 个项目数据待补齐`:'税费及实际／分摊／预计成本 · 元',pending?'pending':'')
      +card('净利润',m(net),pending?`试算 · ${pending} 个项目数据待补齐`:'扣除所得税后 · 元',pending?'pending':net<0?'negative':'positive');
    const lifecycle=projectLifecycle(d);
    return `<section class="project-summary"><div class="project-summary-heading"><h2>项目统计</h2><span>${e(period+' · '+d.month)}${pending?' · 部分数据待补齐':''}</span></div><div class="metrics project-summary-metrics">${cards}</div></section>${projectMissing(d,true)}<div class="project-overview-grid">${projectProfitRanking(d)}${lifecycle.delay}${lifecycle.stop}${lifecycle.refund}</div>`;
  }
  function projectAccounting(d){
    const period=d.cumulative?'累计至 '+d.month:d.month+' 当月',pending=badge('试算','warn');
    const amount=(r,value)=>m(value)+(r.complete?'':`<small>${pending}</small>`);
    const names=(r,role)=>[...new Set(d.s.members.filter(x=>x.projectId===r.id&&x.role===role).map(x=>d.s.people.find(p=>p.id===x.personId)?.name).filter(Boolean))].join(' / ')||'—';
    const owner=r=>d.s.people.find(x=>x.id===r.entity.ownerId)?.name||'—';
    const info=r=>root.ProjectDelivery.info(d.s,r.entity);
    const groups=[
      {label:'项目基本信息',columns:[
        ['序号',(r,i)=>i+1],['项目名称',r=>b(r.entity.name,'project-detail',`data-id="${e(r.id)}"`,'link')],
        ['项目编号',r=>e(info(r).code)],['订单编号',r=>e(info(r).order)],['项目状态',r=>e(M.projectStatus(r.entity))],
        ['项目所属团队',r=>e(d.teamOf(r.entity))],['项目预计开始时间',r=>e(r.entity.startDate||'—')],['项目预计结束时间',r=>e(r.entity.endDate||'—')],
        ['项目类型',r=>e(r.entity.type||'—')],['成交方式',r=>e(r.entity.dealMode||'—')],['负责人',r=>e(owner(r))],
        ['项目经理',r=>e(names(r,'项目经理')==='—'?owner(r):names(r,'项目经理'))],['项目顾问',r=>e(names(r,'咨询师'))]
      ]},
      {label:'合同与回款 · 元',columns:[
        ['合同金额',r=>m(r.now.contract),true],['累计回款',r=>m(r.received),true],['应收账款',r=>m(r.now.receivable),true],
        ['累计确认交付金额',r=>m(r.delivered),true],['累计交付回款缺口',r=>m(r.cashGap),true]
      ]},
      {label:(d.cumulative?'累计':'当月')+'核算 · 元 / %',columns:[
        ['确认交付金额',r=>m(r.income),true],
        ...Object.entries({business:'业务成本',management:'管理费',travel:'交通差旅',tax:'税金（3.3%）',accountManager:'大客户经理提成',commission:'项目交付提成',salary:'咨询师工资成本',exception:'项目异常费用',yearBonus:'年终奖分摊',fixed:'固定成本分摊'}).map(([key,label])=>[label,r=>key==='salary'&&r.salaryMissing?amount(r,r.costs[key]):m(r.costs[key]),true]),
        ['总成本',r=>amount(r,r.cost),true],['税前利润',r=>amount(r,add(r.selected,'pretax')),true],['所得税',r=>amount(r,r.tax),true],
        ['净利润',r=>`<span class="${r.complete?(r.net<0?'negative':'positive'):''}">${amount(r,r.net)}</span>`,true],
        ['净利率',r=>p(r.margin),true],['盈亏平衡回款',r=>m(d.cumulative?r.now.cumulative.breakEven:r.now.breakEven),true]
      ]},
      {label:'核算期间与投入',columns:[['核算期间',()=>e(period)],['期间投入工时',r=>r.hours+'h',true],['当月投入工时',r=>r.now.hours+'h',true]]},
      {label:'数据完整性',columns:[
        ['数据状态',r=>r.complete?badge(d.s.closed[d.month]?'已结快照':'实时试算',d.s.closed[d.month]?'success':'blue'):badge('数据缺失','warn')],
        ['缺失内容',r=>r.missing.length?r.missing.map(e).join('；'):'—']
      ]}
    ];
    const mode=d.f.projectLedgerSort||'project';
    const rows=d.rows.slice().sort((a,b)=>mode==='income'?b.income-a.income:mode==='margin'?(b.margin??-Infinity)-(a.margin??-Infinity):mode==='hour'?(b.incomeHour??-Infinity)-(a.incomeHour??-Infinity):0);
    const columns=groups.flatMap(g=>g.columns);
    const list=`<div class="project-ledger-scroll" tabindex="0" role="region" aria-label="项目核算总明细表，可横向滚动"><table class="project-ledger"><thead><tr>${groups.map(g=>`<th colspan="${g.columns.length}" scope="colgroup">${e(g.label)}</th>`).join('')}</tr><tr>${columns.map(([label,,num])=>`<th scope="col"${num?' class="num"':''}>${e(label)}</th>`).join('')}</tr></thead><tbody>${rows.length?rows.map((r,i)=>`<tr>${columns.map(([,value,num])=>`<td${num?' class="num"':''}>${value(r,i)}</td>`).join('')}</tr>`).join(''):`<tr><td colspan="${columns.length}">${U.empty('暂无符合条件的项目')}</td></tr>`}</tbody></table></div>`;
    return `${projectMissing(d)}<section class="panel project-ledger-panel"><div class="panel-head"><div><h2>项目核算总明细表</h2><small>${e(period)} · ${rows.length} 个项目 · 金额单位：元 · 向右滚动查看全部字段</small></div><div class="manager-table-controls"><select data-filter="projectLedgerSort" aria-label="项目排序">${options([{id:'project',name:'按项目顺序'},{id:'income',name:'按交付金额'},{id:'margin',name:'按净利率'},{id:'hour',name:'按小时产出'}],mode)}</select></div></div>${list}<p class="panel-note">合同与应收按项目登记金额；累计回款、累计交付截至所选月。成本、利润及期间投入按当月／累计切换，含历史估算工时；当月投入保留全月已填报口径。缺失数据不按零处理，相关金额标记为试算，净利率及盈亏平衡待补齐后计算。所得税按项目累计利润计税、当月差额回调。</p></section>`;
  }
  function render(ctx){
    const d=data(ctx);d.ctx=ctx;const view=(d.project?ctx.filters.projectManagerView:ctx.filters.personManagerView)==='accounting'?'accounting':'overview',label=d.project?'项目分析':'项目人效分析';
    const tabs=[['overview',d.project?'项目概览':'人效分析概览'],['accounting','核算明细']];
    const header=`<div class="page-heading manager-page-heading"><div><div class="eyebrow">${d.project?'PROJECT PERFORMANCE':'TALENT PERFORMANCE'}</div><h1>${label}</h1><p>${d.project?'查看项目规模、经营利润与交付异常情况':'查看人员利润、交付贡献与项目投入表现'}</p></div><div class="heading-actions">${b('导入数据','analysis-import',ctx.role==='finance'?'':'disabled')}${b('导出核算数据','export-analysis')}</div></div>`;
    const nav=`<div class="analysis-view-tabs manager-view-tabs">${tabs.map(([v,t])=>b(t,'manager-view',`data-view="${v}"`,v===view?'active':'')).join('')}</div>`;
    const contents=d.project?(view==='accounting'?projectAccounting(d):projectOverview(d)):(view==='accounting'?root.PersonEfficiencyViews.accounting(ctx,d):root.PersonEfficiencyViews.overview(ctx,d));
    return `<div class="manager-dashboard">${header}${filters(d)}${nav}<div class="manager-tab-content" role="tabpanel">${contents}</div></div>`;
  }
  function bridge(d){const comparable=d.rows.filter(r=>r.previous&&!reasons(r.now).length&&!reasons(r.previous).length),excluded=d.rows.length-comparable.length,now=comparable.map(r=>r.now),previous=comparable.map(r=>r.previous),valid=comparable.length>0,costKeys=d.project?['business','management','travel','tax','accountManager','commission','salary','exception','yearBonus','fixed']:['salary','commission','bonus','tax','management'],labels={business:'业务费用',management:'管理费',travel:'差旅',tax:'税费',accountManager:'客户经理提成',commission:'提成',salary:'固定/分摊人工',exception:'异常费用',yearBonus:'年终奖分摊',fixed:'固定成本',bonus:'奖金'};
    if(!valid)return `<section class="panel manager-bridge"><div class="panel-head"><h2>利润变动归因</h2><small>所选月相对上月</small></div><div class="panel-body"><div class="manager-data-pending">先补齐核算依据</div><p>当前或上月存在缺工资、比例等必要输入，暂不做利润差异排名，避免把缺数据当作经营改善。</p></div></section>`;
    const changes=[{label:'交付金额变化',value:add(now,'income')-add(previous,'income')},...costKeys.map(k=>({label:labels[k]+'变动',value:previous.reduce((n,r)=>n+(r.costs[k]||0),0)-now.reduce((n,r)=>n+(r.costs[k]||0),0)})),{label:'所得税变动',value:add(previous,'tax')-add(now,'tax')}].filter(x=>Math.abs(x.value)>=.01).sort((a,b)=>Math.abs(b.value)-Math.abs(a.value)),delta=add(now,'net')-add(previous,'net'),max=Math.max(1,...changes.map(x=>Math.abs(x.value)));
    return `<section class="panel manager-bridge"><div class="panel-head"><div><h2>利润变动归因</h2><small>所选月相对上月 · 单位元</small></div><strong class="${delta<0?'negative':'positive'}">${delta>0?'+':''}${m(delta)}</strong></div><div class="panel-body">${excluded?`<div class="manager-inline-note">可比范围 ${comparable.length} / ${d.rows.length} 个主体；${excluded} 个因缺输入或缺上月数据排除。结果仅代表可比主体。</div>`:''}${d.cal.partial?'<div class="manager-inline-note">月中对上月整月，仅用于解释差值；不据此判断增长或下降趋势。</div>':''}${changes.slice(0,5).map(x=>`<div class="manager-bridge-row"><span>${e(x.label)}</span><div><i style="width:${Math.abs(x.value)/max*100}%;background:${x.value<0?'#df8d80':'#78a990'}"></i></div><b class="${x.value<0?'negative':'positive'}">${x.value>0?'+':''}${m(x.value)}</b></div>`).join('')}<p>正值表示提高利润，负值表示压低利润；展示影响最大的5项。所选“累计”仅影响上方经营汇总，此处始终比较两个单月。</p></div></section>`;
  }
  function diagnose(ctx,id){const d=data(ctx),r=d.rows.find(x=>x.id===id);if(!r)return {title:'暂无诊断数据',html:U.empty('请重新选择分析范围')};const alerts=warnings(d).filter(a=>a.entityId===id),costNames={salary:'人工成本',commission:'项目提成',bonus:'人员奖金',tax:'税费',management:'管理费',business:'业务费用',travel:'差旅',accountManager:'大客户经理提成',exception:'异常费用',yearBonus:'年终奖分摊',fixed:'固定分摊'},costs=Object.entries(r.costs).sort((a,b)=>b[1]-a[1]);
    const basic=`<div class="metrics">${card('确认交付',m(r.income),'按当前筛选范围')}${card('税后利润',r.complete?m(r.net):'待补齐',r.complete?'来自统一核算模型':'缺输入，暂不作盈利结论')}${card(d.project?'累计回款缺口':'已过工作日利用率',d.project?m(r.cashGap):p(r.util),d.project?'不等同逾期应收':`${r.hours}h / ${r.standard}h`)}${card(d.project?'项目净利率':'人工投入产出',d.project?p(r.margin):multiple(r.roi),'演示观察线用于提示')}</div>`;
    const tableHTML=d.project?table(['月份','交付金额','项目投入','税后利润','数据状态'],r.history.map(x=>[e(x.month),m(x.income),x.hours+'h',reasons(x).length?'待补齐':m(x.net),reasons(x).length?e(reasons(x).join('；')):'已录输入完整'])):table(['参与项目','交付贡献','实际项目工时','交付占比','核查提示'],r.contributions.map(x=>[e(d.s.projects.find(v=>v.id===x.id)?.name||x.id),m(x.income),x.hours+'h',r.income>0?p(x.income/r.income):'—',(x.income>0&&x.hours===0)||(x.income===0&&x.hours>0)?'收入与工时口径需对照':'—']));
    return {title:r.entity.name+' · 经营诊断',html:`<div class="manager-diagnosis"><p class="manager-inline-note">${d.cumulative?'累计至':'所选月'} ${d.month} · 数据截至 ${AS_OF} · ${d.cal.partial?'本月未结束，非月末预测':'已完成月度范围'}</p>${basic}${r.missing.length?`<div class="notice"><b>先核查数据：</b>${r.missing.map(e).join('；')}</div>`:''}<h3>预警触发依据</h3><div class="manager-diagnosis-alerts">${alerts.length?alerts.map(a=>alertCard(a)).join(''):badge('当前未触发预警','success')}</div><h3>${d.project?'月度交付与利润轨迹':'项目贡献与投入对应'}</h3>${tableHTML}<h3>当前范围成本构成</h3>${table(['成本项目','金额（元）'],costs.map(([k,v])=>[e(costNames[k]||k),k==='salary'&&r.salaryMissing?'待补齐':m(v)]))}<div class="form-actions">${d.project?b('进入项目成员','project-detail',`data-id="${e(id)}"`):b('查看核算明细','manager-detail-person',`data-id="${e(id)}"`)}${b('核算来源','sources',`data-kind="${d.kind}" data-id="${e(id)}"`,'primary')}</div></div>`};
  }
  function alertDialog(ctx,level='all'){const d=data({...ctx,filters:{...ctx.filters,alertLevel:level}}),alerts=warnings(d);return {title:(d.project?'项目':'人员')+' · 全部预警',html:'<div class="manager-alert-modal"><p class="manager-inline-note">'+(d.cumulative?'累计至':'所选月')+' '+e(d.month)+' · 当前筛选范围 '+d.entities.length+' 个主体 · 共 '+alerts.length+' 项提示</p>'+alertsView(d,alerts)+'</div>'};}
  root.ProjectManagementInsights={data,warnings,diagnose,alertDialog,render};root.ProjectAnalysis={render};
})(window);
