/* Personnel overview and accounting table use the shared accounting ledger. */
(function(root){
  'use strict';
  const M=root.ProjectModel,U=root.ProjectUI,{esc:e,money:m,percent:p,card,table,badge,button:b,options}=U;
  const sum=(rows,key)=>rows.reduce((n,r)=>n+Number(r[key]||0),0),hour=n=>n==null?'—':Number(n.toFixed(1))+'h';
  const inputMissing=r=>(r.missing||[]).filter(x=>!x.includes('无法测算'));
  function rows(d){return d.rows.map(r=>{
    const months=r.selected.length,calendarKnown=r.selected.every(x=>x.standardHours>0),actualHours=sum(r.selected,'hours'),standardHours=sum(r.selected,'standardHours');
    const fixed=r.selected.map(x=>M.fixedPay(d.s,r.id,x.month));
    const projects=r.contributions.filter(x=>d.s.projects.some(p=>p.id===x.id&&p.startDate.slice(0,7)<=d.month)).map(x=>({...x,hours:r.selected.reduce((n,result)=>n+result.projects.filter(project=>project.projectId===x.id).reduce((total,project)=>total+project.hours,0),0)}));
    return {...r,months,projects,actualHours,standardHours,calendarKnown,hours:actualHours,elapsedStandard:r.standard,standard:standardHours,util:calendarKnown&&standardHours>0?actualHours/standardHours:null,incomeHour:actualHours>0&&!r.revenueMissing?r.income/actualHours:null,
      salary:fixed.every(x=>x.known)?sum(fixed,'salary'):null,benefits:fixed.every(x=>x.known)?sum(fixed,'benefits'):null,
      monthlyNet:months&&r.complete?r.net/months:null,monthlyIncome:months&&!r.revenueMissing?r.income/months:null,
      netHour:actualHours>0&&r.complete?r.net/actualHours:null,allocated:sum(r.selected,'allocatedSalary'),idleSalary:sum(r.selected,'idleSalary'),
      idleHours:calendarKnown?r.selected.reduce((n,x)=>n+Math.max(x.standardHours-x.hours,0),0):null,
      saturation:calendarKnown&&standardHours>0?actualHours/standardHours:null,
      serviceProjects:projects.filter(x=>x.income>0||x.hours>0).length
    };
  });}
  function profile(d,r){return root.ProjectExcel.personnelInfo(d.s).find(x=>x.id===r.id)||r.entity;}
  function roles(d,r){return [...new Set(d.members.filter(x=>x.personId===r.id).map(x=>x.role))].join(' / ')||'—';}
  function missingNotice(d,list){const missing=list.filter(r=>!r.complete);return missing.length?`<div class="notice person-input-missing"><strong>数据缺失 · ${missing.length} 位人员，详情请在核算明细中查看。</strong></div>`:'';}
  function pendingPeople(list){return list.length?`<div class="person-pending">待核算 ${list.length} 人，详情请在核算明细中查看。</div>`:'';}
  function profitRanking(list){
    const valid=list.filter(r=>r.complete).sort((a,b)=>b.net-a.net),pending=list.filter(r=>!r.complete),hasLoss=valid.some(r=>r.net<0),max=Math.max(1,...valid.map(r=>Math.abs(r.net))),zero=hasLoss?50:0;
    const average=valid.length?sum(valid,'net')/valid.length:null;
    return `<section class="panel person-comparison person-profit-ranking"><div class="panel-head"><div><h2>利润排行</h2><small>所选期间净利润 · 由高到低</small></div><span class="person-panel-unit">元</span></div><div class="person-profit-summary"><span>${pending.length?'已核算人员平均净利润':'人均净利润'}</span><strong class="${average<0?'negative':'positive'}">${average==null?'—':m(average)}</strong></div><div class="person-profit-list">${valid.length?valid.map((r,i)=>{const width=Math.abs(r.net)/max*(hasLoss?50:100);return `<div class="person-profit-row"><div class="person-profit-name"><span class="person-profit-rank">${i+1}</span><span>${e(r.entity.name)}</span></div><div class="person-profit-bar"><span class="person-profit-zero" style="left:${zero}%"></span><i class="${r.net<0?'loss':''}" style="left:${r.net<0?zero-width:zero}%;width:${width}%" title="${e(r.entity.name)}：${m(r.net)} 元"></i></div><b class="${r.net<0?'negative':'positive'}">${m(r.net)}</b></div>`;}).join(''):'<div class="person-empty">当前没有可比较的数据</div>'}</div>${pendingPeople(pending)}</section>`;
  }
  function marginDistribution(list){
    const valid=list.filter(r=>r.margin!=null).sort((a,b)=>b.margin-a.margin),pending=list.filter(r=>r.margin==null),min=Math.min(0,...valid.map(r=>r.margin)),max=Math.max(.1,...valid.map(r=>r.margin)),padding=(max-min)*.12,lo=min-padding,hi=max+padding,position=value=>(value-lo)/(hi-lo)*100,zero=position(0);
    return `<section class="panel person-margin-distribution"><div class="panel-head"><div><h2>利润率分布</h2><small>净利润 ÷ 交付收入 · 同一刻度对比</small></div><span class="person-panel-unit">%</span></div><div class="person-margin-summary"><div><span>盈利／亏损人数</span><b>${valid.filter(r=>r.net>0).length}<small> ／ </small>${valid.filter(r=>r.net<0).length}<small> 人</small></b></div></div><div class="person-margin-chart">${valid.length?`<div class="person-margin-axis"><span style="left:${position(min)}%">${p(min)}</span>${min<0?`<span style="left:${zero}%">0%</span>`:''}<span style="left:${position(max)}%">${p(max)}</span></div>${valid.map(r=>`<div class="person-margin-row"><span>${e(r.entity.name)}</span><div class="person-margin-rail"><i class="person-margin-reference" style="left:${zero}%"></i><i class="person-margin-connector ${r.margin<0?'loss':''}" style="left:${Math.min(zero,position(r.margin))}%;width:${Math.abs(position(r.margin)-zero)}%"></i><i class="person-margin-dot ${r.margin<0?'loss':''}" style="left:${position(r.margin)}%" title="${e(r.entity.name)}：${p(r.margin)}"></i></div><b class="${r.margin<0?'negative':'positive'}">${p(r.margin)}</b></div>`).join('')}<div class="person-margin-key"><i></i><span>零利润线</span></div>`:'<div class="person-empty">当前没有可比较的数据</div>'}</div>${pendingPeople(pending)}</section>`;
  }
  function incomeContribution(d,list){
    const colors=['#6d93c5','#6caf9a','#e4ab70','#9b8ac1','#78b7c1','#d58f91'],valid=list.filter(r=>!r.revenueMissing).sort((a,b)=>b.income-a.income),pending=list.filter(r=>r.revenueMissing),total=valid.reduce((n,r)=>n+Math.max(0,r.income),0),radius=64,circumference=2*Math.PI*radius;let offset=0;
    const color=r=>colors[Math.max(0,d.s.people.findIndex(person=>person.id===r.id))%colors.length];
    const segments=valid.filter(r=>r.income>0).map(r=>{const length=r.income/total*circumference,segment=`<circle cx="90" cy="90" r="${radius}" fill="none" stroke="${color(r)}" stroke-width="24" stroke-dasharray="${length} ${circumference-length}" stroke-dashoffset="${-offset}" transform="rotate(-90 90 90)"><title>${e(r.entity.name)}：${m(r.income)} 元，占比 ${p(r.income/total)}</title></circle>`;offset+=length;return segment;}).join('');
    const totalLabel=total>=10000?(total/10000).toFixed(1)+'万':m(total);
    return `<section class="panel person-income-contribution"><div class="panel-head"><div><h2>交付收入构成</h2><small>${d.cumulative?'所选期间':'所选月'}人员交付收入占比</small></div><span class="person-panel-unit">元</span></div><div class="person-income-body"><div class="person-income-donut"><svg viewBox="0 0 180 180" role="img" aria-label="${pending.length?'已知':'合计'}交付收入 ${m(total)} 元"><circle cx="90" cy="90" r="64" fill="none" stroke="#edf1f6" stroke-width="24"/>${segments}<text x="90" y="86" text-anchor="middle" class="person-donut-total">${e(totalLabel)}</text><text x="90" y="108" text-anchor="middle" class="person-donut-label">${pending.length?'已知收入合计':'交付收入合计'}</text></svg></div><div class="person-income-legend">${valid.length?valid.map(r=>`<div class="person-income-item"><i style="background:${color(r)}"></i><div><strong>${e(r.entity.name)}</strong><small>${r.serviceProjects} 个服务项目 · ${hour(r.hours)}</small></div><div><b>${m(r.income)}</b><span>${total>0&&r.income>=0?p(r.income/total):'—'}</span></div></div>`).join(''):'<div class="person-empty">当前没有可比较的数据</div>'}</div></div>${valid.some(r=>r.income<0)?'<p class="person-income-note">负交付收入不计入占比。</p>':''}${pendingPeople(pending)}</section>`;
  }
  function projectData(d,list){
    const projects=new Map();
    list.forEach(r=>r.projects.forEach(x=>{if(!projects.has(x.id))projects.set(x.id,{id:x.id,income:0,hours:0,people:new Set(),missing:false});const project=projects.get(x.id);project.income+=x.income;project.hours+=x.hours;project.people.add(r.id);project.missing||=r.revenueMissing;}));
    const all=[...projects.values()].sort((a,b)=>b.income-a.income),service=all.filter(x=>x.income>0||x.hours>0);
    const data=all.map(x=>{const project=d.s.projects.find(p=>p.id===x.id),code=root.ProjectDelivery.info(d.s,project).code;return [`${b(project.name,'project-detail',`data-id="${e(x.id)}"`,'link')}<small>项目编号：${e(code)}</small>`,x.people.size+' 人',m(x.income)+(x.missing?'<small>试算 · 收入比例待补齐</small>':''),hour(x.hours)];});
    return `<section class="panel person-project-data"><div class="panel-head"><div><h2>项目数据</h2><small>当前人员参与的全部项目 · 项目去重统计</small></div></div><div class="person-project-stats"><div><span>参与项目</span><b>${all.length}<small> 个</small></b></div><div><span>本期服务项目</span><b>${service.length}<small> 个</small></b></div><div><span>人均参与项目</span><b>${list.length?(list.reduce((n,r)=>n+r.projects.length,0)/list.length).toFixed(1):'—'}<small> 个</small></b></div></div><div class="person-project-table">${table(['项目','参与人员','人员交付收入（元）','投入工时'],data)}</div><p class="panel-note">本期有交付收入或项目工时计为服务项目；交付收入为所选人员贡献合计。</p></section>`;
  }
  function monthlyTrend(ctx,d){
    const months=d.s.months.filter(x=>x<=d.month).sort(),trend=months.map(month=>{
      const sub=root.ProjectManagementInsights.data({...ctx,month,filters:{...ctx.filters,periodMode:'month'}}),list=rows(sub),personMonths=sum(list,'months'),income=sum(list,'income'),net=sum(list,'net'),hours=sum(list,'hours'),labor=sum(list,'labor'),complete=list.every(r=>r.complete),incomeKnown=list.every(r=>!r.revenueMissing),salaryKnown=list.every(r=>!r.salaryMissing);
      return [e(month),list.length+' 人',incomeKnown&&personMonths?m(income/personMonths):'—',personMonths?(complete?m(net/personMonths):'待补齐'):'—',incomeKnown&&hours>0?m(income/hours):'—',salaryKnown&&incomeKnown&&labor>0?(income/labor).toFixed(2)+' 倍':'—'];
    });
    return `<section class="panel person-monthly-trend"><div class="panel-head"><div><h2>人效月度趋势</h2><small>截至所选月 · 各月分别计算</small></div></div>${table(['月份','人数','人均月交付（元）','人均月净利（元）','小时产出（元/h）','投入产出比'],trend)}</section>`;
  }
  function capacity(d,list){
    const hours=sum(list,'hours'),standard=sum(list,'standard'),known=list.every(r=>r.calendarKnown),idle=known?sum(list,'idleHours'):null;
    return `<section class="panel person-capacity"><div class="panel-head"><div><h2>工时投入与利用</h2><small>实际项目工时 ÷ 考勤标准工时</small></div><span class="person-panel-unit">合计 ${known&&standard>0?p(hours/standard):'—'}</span></div><div class="panel-body">${list.length?list.map(r=>`<div class="efficiency-capacity-row"><div><strong>${e(r.entity.name)}</strong><span>${hour(r.hours)} / ${r.calendarKnown?hour(r.standard):'待补齐'}</span></div><div class="efficiency-capacity-track"><i style="width:${Math.min(100,Math.max(0,(r.util||0)*100))}%"></i></div><div><small>未投入 ${hour(r.idleHours)}</small><b>${p(r.util)}</b></div></div>`).join(''):'<div class="person-empty">暂无人员数据</div>'}<p class="rule-text">合计未投入 ${hour(idle)}，包含内部工作、请假与未填报，不等同可排班工时。历史估算工时保留汇总口径。</p></div></section>`;
  }
  function overview(ctx,d){const list=rows(d);return `${missingNotice(d,list)}<div class="person-period-note">${d.cumulative?'累计至 '+e(d.month):e(d.month)+' 当月'} · ${list.length} 位人员${d.cal.partial?' · 本月未结束，利润含整月固定人工、利用率按整月标准工时':''}</div><div class="person-overview-grid">${profitRanking(list)}${marginDistribution(list)}${incomeContribution(d,list)}${projectData(d,list)}</div><div class="person-bottom-grid">${monthlyTrend(ctx,d)}${capacity(d,list)}</div>`;}
  function accounting(ctx,d){
    const pending=badge('待补充','warn'),money=value=>value==null||!Number.isFinite(Number(value))?'-':m(value),text=value=>value==null||value===''||value==='—'?'-':e(value);
    const imported=(r,result,key)=>{const basis=d.s.closed[result.month]?.inputs||d.s,valid=row=>row.personId===r.id&&row.month===result.month&&Number.isFinite(row.amount)&&row.amount>=0;
      if(key==='salary')return M.fixedPay(d.s,r.id,result.month).known;
      if(key==='bonus')return (basis.bonuses||[]).some(valid);
      const projects=(basis.members||[]).filter(member=>member.personId===r.id&&(basis.projects||[]).some(project=>project.id===member.projectId&&project.startDate.slice(0,7)<=result.month)).map(member=>member.projectId);
      return [...new Set(projects)].every(projectId=>(basis.commissions||[]).some(row=>valid(row)&&row.projectId===projectId));
    };
    const labels={salary:'固定人工',commission:'提成',bonus:'奖金'},list=rows(d).map(r=>{
      const gaps=r.selected.flatMap(result=>Object.entries(labels).filter(([key])=>!imported(r,result,key)).map(([,label])=>result.month+'：'+label+'待补充'));
      return {...r,missing:[...new Set([...r.missing,...gaps])],complete:r.complete&&!gaps.length,missingInputs:Object.fromEntries(Object.keys(labels).map(key=>[key,r.selected.some(result=>!imported(r,result,key))]))};
    }),derived=(r,value)=>r.complete?money(value):'-';
    const columns=[['序号',(r,i)=>i+1],['姓名',r=>e(r.entity.name),false,false],['工号',r=>text(profile(d,r).employeeNo||profile(d,r).code),false,false],['部门',r=>text(profile(d,r).department),false,false],['项目角色',r=>text(roles(d,r)),false,false],['入职日期',r=>text(r.entity.joined)],['核算月数',r=>r.months,true],['参与项目数',r=>r.projects.length,true],['本期服务项目数',r=>r.serviceProjects,true],
      ['交付收入',r=>r.revenueMissing?'-':money(r.income),true],['项目投入工时',r=>hour(r.hours),true],['交付天数',r=>money(r.actualHours/8),true],['上班天数',r=>r.calendarKnown?money(r.standardHours/8):'-',true],['考勤标准工时',r=>r.calendarKnown?hour(r.standardHours):'-',true],['工时利用率',r=>r.calendarKnown?text(p(r.util)):'-',true],['未投入工时',r=>r.calendarKnown?hour(r.idleHours):'-',true],
      ['固定工资',r=>r.missingInputs.salary?pending:money(r.salary),true],['社保公积金',r=>r.missingInputs.salary?pending:money(r.benefits),true],['固定人工',r=>r.missingInputs.salary?pending:money(r.costs.salary),true],['提成',r=>r.missingInputs.commission?pending:money(r.costs.commission),true],['奖金',r=>r.missingInputs.bonus?pending:money(r.costs.bonus),true],['税费（3.3%）',r=>r.revenueMissing?'-':money(r.costs.tax),true],['管理费',r=>r.revenueMissing?'-':money(r.costs.management),true],['总成本',r=>derived(r,r.cost),true],['税前利润',r=>derived(r,sum(r.selected,'pretax')),true],['所得税',r=>derived(r,r.tax),true],['净利润',r=>derived(r,r.net),true],['净利润率',r=>r.complete?text(p(r.margin)):'-',true],['未分摊人工',r=>r.missingInputs.salary||!r.calendarKnown?'-':money(r.idleSalary),true],['当月盈亏平衡点',r=>derived(r,r.now.breakEven),true],['数据状态',r=>r.complete?badge(d.s.closed[d.month]?'已结快照':'实时核算',d.s.closed[d.month]?'success':'blue'):badge('数据缺失','warn')],['缺失内容',r=>r.missing.map(e).join('；')||'-']];
    const order=d.f.personLedgerOrder,sorted=root.LedgerSort.sort(list,columns,order);
    const notice=missingNotice(d,list);
    return `${notice}<section class="panel project-ledger-panel person-ledger-panel"><div class="project-ledger-scroll" tabindex="0" role="region" aria-label="人员核算总明细表，可横向滚动"><table class="project-ledger person-ledger"><thead><tr><th colspan="9">人员与项目</th><th colspan="7">交付与投入</th><th colspan="12">成本与利润 · 元 / %</th><th colspan="2">其他核算指标</th><th colspan="2">数据完整性</th></tr><tr>${root.LedgerSort.headers(columns,order,'person')}</tr></thead><tbody>${sorted.length?sorted.map((r,i)=>`<tr>${columns.map(([,value,num])=>`<td${num?' class="num"':''}>${value(r,i)}</td>`).join('')}</tr>`).join(''):`<tr><td colspan="${columns.length}">${U.empty('暂无符合条件的人员')}</td></tr>`}</tbody></table></div><p class="panel-note">工时利用率＝项目实际工时÷考勤标准工时；交付天数、上班天数均按8小时折算。盈亏平衡点取所选当月。仅缺失的人工导入项显示“待补充”；其他字段缺值或暂时无法计算时显示“-”，已确认的零值保留为0。</p></section>`;
  }
  root.PersonEfficiencyViews={overview,accounting,rows};
})(window);
