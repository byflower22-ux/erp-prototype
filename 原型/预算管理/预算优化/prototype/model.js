(function(global) {
  'use strict';
  const months = Array.from({length:12},(_,i)=>i===11?'2027-01':`2026-${String(i+2).padStart(2,'0')}`);
  const documentTypes=['报销申请','付款申请','内部调账单','费用记账单','出差报销单','付款单','项目付款单','多项目付款单','固定资产付款单','报销单','项目报销单','多项目报销单','固定资产报销单','入企报销单'];
  const documentStatuses=['待审批','审批中','待财务审核','待支付','已支付','支付失败'];
  const statusNodes={'待审批':'等待审批人处理','审批中':'部门负责人审批','待财务审核':'财务审核','待支付':'等待支付处理','已支付':'支付完成','支付失败':'支付失败待处理'};
  const employeeNumbers={'张敏':'B04231','李倩':'B03618','王晨':'B05126','陈杰':'B02847','赵宁':'B04702'};
  const personLabel=(name,employeeNo)=>name?(employeeNo?`${name}（${employeeNo}）`:name):'—';
  const importerLabel=r=>personLabel(r.importerName,r.importerEmployeeNo);
  const applicantLabel=r=>r.source==='人工导入'?importerLabel(r):personLabel(r.person,r.employeeNo);
  const groups = [
    {id:'admin',name:'行政办公',rule:'1c',children:[{id:'travel',name:'差旅费',budget:40000},{id:'office',name:'办公费',budget:60000}]},
    {id:'market',name:'市场推广',rule:'1m',children:[{id:'brand',name:'品牌宣传',budget:35000},{id:'event',name:'市场活动',budget:45000}]},
    {id:'course',name:'开课成本',rule:'2c',children:[{id:'teacher',name:'老师课酬',budget:70000},{id:'material',name:'开课物资',budget:20000}]},
    {id:'staff',name:'固定人工',rule:'2m',children:[{id:'salary',name:'工资',budget:120000},{id:'social',name:'社保公积金',budget:30000}]},
    {id:'income',name:'主营业务收入',income:true,children:[{id:'training',name:'培训收入',budget:600000}]}
  ];
  const teams=[{id:'t1',name:'全域线下',code:'TS20181224000018',scale:1,owner:'超级管理员'},{id:'t2',name:'卓悦部2',code:'TS20260203000968',scale:.65,owner:'吴极客'},{id:'t3',name:'日本拓展部',code:'TS20230108000748',scale:.8,owner:'超级管理员'},{id:'t4',name:'效率工程部',code:'TS20181201000001',scale:1.3,owner:'超级管理员'}];
  const ruleNames={'1c':'一级预算月累计','1m':'一级预算月不累计','2c':'二级预算月累计','2m':'二级预算月不累计'};
  const groupFor=id=>groups.find(g=>g.id===id||g.children.some(c=>c.id===id));
  const subject=id=>{const g=groupFor(id);return g?.id===id?g:g?.children.find(c=>c.id===id);};
  const ids=id=>!id?groups.flatMap(g=>g.children.map(c=>c.id)):groupFor(id)?.id===id?groupFor(id).children.map(c=>c.id):[id];
  const sum=rows=>rows.reduce((a,r)=>a+r.amount,0);
  function createData(){
    const actual=[], frozen=[];let n=1;
    for(const team of teams) for(const [mi,month] of months.entries()) {
      if(mi>8) continue;
      for(const g of groups) for(const c of g.children) {
        const total=Math.round(c.budget*team.scale*(g.income?.8:.48+(mi%3)*.035));
        const sources=g.income?['人工导入']:['人工导入',...documentTypes];
        let allocated=0;
        sources.forEach((source,si)=>{
          const amount=si===sources.length-1?total-allocated:si===0?Math.round(total*.2):Math.floor(total*.8/documentTypes.length);allocated+=amount;
          const number=source==='人工导入'?`IMP${month.replace('-','')}${team.id.toUpperCase()}`:`DJ${String(documentTypes.indexOf(source)+1).padStart(2,'0')}${month.replace('-','')}${String(n).padStart(5,'0')}`;
          const line=source==='人工导入'?String(groups.flatMap(g=>g.children).findIndex(s=>s.id===c.id)+2):'01';
          const person=source==='人工导入'?'':['张敏','李倩','王晨'][si%3];
          const importerName=source==='人工导入'?'李倩':'';
          actual.push({id:`a${n++}`,team:team.id,subject:c.id,month,amount,source,number,line,summary:g.income?'培训业务收入':`${c.name}－${source==='人工导入'?'系统外费用导入':source+'费用'}`,date:`${month}-${si===0?'12':'18'}`,person,employeeNo:employeeNumbers[person]||'',importerName,importerEmployeeNo:employeeNumbers[importerName]||'',documentTitle:source==='人工导入'?'':`${month} ${c.name}${source}`,status:source==='人工导入'?'':'已支付',imported:`${month}-13 09:30:00`});
        });
        if(!g.income&&(mi===7||mi===8)) {
          const amount=Math.round(c.budget*team.scale*(mi===8?.16:.04));
          let assigned=0;
          documentTypes.forEach((source,di)=>{
            const part=di===documentTypes.length-1?amount-assigned:Math.floor(amount/documentTypes.length);assigned+=part;
            const person=mi===8?'张敏':'陈杰';
            const status=['待审批','审批中','待财务审核','待支付','支付失败'][di%5];
            frozen.push({id:`f${n++}`,team:team.id,subject:c.id,month,amount:part,source,number:`DJ${String(di+1).padStart(2,'0')}${month.replace('-','')}${String(n).padStart(5,'0')}`,line:'01',summary:`${c.name}－${source}在途占用`,date:`${month}-${mi===8?'19':'25'}`,person,employeeNo:employeeNumbers[person],documentTitle:`${month} ${c.name}${source}`,status,node:statusNodes[status],days:mi===8?1:25});
          });
        }
      }
    }
    return {actual,frozen,ruleOverrides:{},version:1,asof:'2026-10-20 14:30:25',budgets:{}};
  }
  function budget(data,team,id,start,end){
    const t=teams.find(t=>t.id===team);return sum(months.filter(m=>m>=start&&m<=end).flatMap(m=>ids(id).map(cid=>({amount:data.budgets[`${team}|${cid}|${m}`]??Math.round(subject(cid).budget*t.scale)}))));
  }
  function rows(data,type,team,id,start,end){return data[type].filter(r=>r.team===team&&ids(id).includes(r.subject)&&r.month>=start&&r.month<=end);}
  function metrics(data,team,id,start,end){return {budget:budget(data,team,id,start,end),actual:sum(rows(data,'actual',team,id,start,end)),frozen:sum(rows(data,'frozen',team,id,start,end))};}
  function control(data,team,id,month){
    const g=groupFor(id);if(!g||g.income)return null;
    const rule=data.ruleOverrides[g.id]||g.rule;
    if(rule[0]==='2'&&id===g.id)return {group:true,rule};
    const pool=rule[0]==='1'?g.id:id,start=rule[1]==='c'?months[0]:month;
    const result=metrics(data,team,pool,start,month);
    return {...result,pool,start,end:month,rule,available:result.budget-result.actual-result.frozen,shared:rule[0]==='1'&&id!==g.id};
  }
  global.BudgetModel={months,documentTypes,documentStatuses,statusNodes,employeeNumbers,importerLabel,applicantLabel,groups,teams,ruleNames,groupFor,subject,ids,sum,createData,budget,rows,metrics,control};
})(typeof window==='undefined'?globalThis:window);
