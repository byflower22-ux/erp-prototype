/* Offline Excel transport; all business calculations use ProjectModel. */
(function(root,factory){
  if(typeof module==='object'&&module.exports)module.exports=factory(()=>Promise.resolve(require('./vendor/exceljs-4.4.0.min.js')),require('./model.js'));
  else {
    const url=new URL('vendor/exceljs-4.4.0.min.js',document.currentScript.src).href;
    let loading;
    function loadExcel(){
      if(root.ExcelJS)return Promise.resolve(root.ExcelJS);
      if(!loading)loading=new Promise((resolve,reject)=>{
        const script=document.createElement('script');let timer;
        const finish=error=>{clearTimeout(timer);script.onload=script.onerror=null;if(error){script.remove();loading=null;reject(error);}else resolve(root.ExcelJS);};
        script.src=url;script.async=true;
        script.onload=()=>finish(root.ExcelJS?null:Error('Excel组件未能启动，请重试'));
        script.onerror=()=>finish(Error('Excel组件下载失败，请检查网络后重试'));
        timer=setTimeout(()=>finish(Error('Excel组件下载超时，请检查网络后重试')),15000);
        document.head.append(script);
      });
      return loading;
    }
    root.ProjectExcel=factory(loadExcel,root.ProjectModel,person=>root.ProjectConsultants?.profile(person)||person,(state,project)=>root.ProjectDelivery?.info(state,project).team||project.team||'博商管理咨询');
  }
})(typeof globalThis!=='undefined'?globalThis:this,function(loadExcel,M,profile,teamOf){
  'use strict';
  profile=profile||(person=>person);
  teamOf=teamOf||((state,project)=>project.team||'博商管理咨询');
  const schema='ERP-I005-XLSX-v2',order=['salary','bonus','commission','exception','fixed','travel','accountManager','projectOther','personOther'];
  const names={commission:'项目人员提成',exception:'项目异常费用',fixed:'项目固定成本分摊',travel:'交通差旅',accountManager:'大客户经理提成',projectOther:'其他成本'};
  const headers=[['序号','人员编号','人员姓名','项目角色','部门','所属月份','原固定人工（元）','固定人工录入（元）','原奖金（元）','奖金录入（元）'],['序号','项目编号','项目名称','项目所属团队','费用类型','人员编号','人员姓名','项目角色','所属月份','原金额（元）','录入金额（元）']];
  const fail=message=>{throw Error(message);};
  const stateStamp=state=>{let h=2166136261;const text=JSON.stringify(state);for(let i=0;i<text.length;i++){h^=text.charCodeAt(i);h=Math.imul(h,16777619);}return (h>>>0).toString(16);};
  function available(state,month){
    if(!state.months.includes(month))fail('月份不在可操作期间内');
    if(state.closed[month])fail(month+' 已月结，请先反结账');
    if(Object.keys(state.closed).some(m=>m>month))fail('存在后续已结月份，请先反结账后续月份');
    if(M.accountingSnapshot(state,month)||Object.keys(state.accountingSnapshots||{}).some(m=>m>month))fail('该月份已固化，不能导入数据');
  }
  function amount(state,type,month,r){if(type==='salary')return M.fixedPay(state,r.personId,month).total;const collection={bonus:'bonuses',commission:'commissions',exception:'expenses',fixed:'expenses',travel:'actualCosts',accountManager:'expenses',projectOther:'expenses',personOther:'expenses'}[type];return state[collection].find(x=>x.month===month&&(!r.personId||r.personId===x.personId)&&(!r.projectId||r.projectId===x.projectId)&&(!['exception','fixed','travel','accountManager','projectOther','personOther'].includes(type)||x.category===(type==='projectOther'?'other':type)))?.amount??null;}
  function personnelInfo(state){return state.people.map(person=>{const p=profile(person),projectRoles=[...new Set(state.members.filter(member=>member.personId===p.id).map(member=>member.role).filter(Boolean))];return {...p,department:p.department||'未维护部门',projectRoles:projectRoles.length?projectRoles:[p.role||'未分配角色']};});}
  function personnelSelection(state,{roles=[],departments=[]}={}){return personnelInfo(state).filter(p=>(!roles.length||p.projectRoles.some(role=>roles.includes(role)))&&(!departments.length||departments.includes(p.department)));}
  function projectImportRows(state,{teams=[],expenseTypes=[],roles=[]}={}){
    const rows=[];
    for(const type of ['commission','exception','fixed','travel','accountManager','projectOther'])for(const member of type==='commission'?state.members:state.projects.map(p=>({projectId:p.id}))){
      const project=state.projects.find(p=>p.id===member.projectId);if(!project)continue;
      const team=teamOf(state,project);
      if(teams.length&&!teams.includes(team)||expenseTypes.length&&!expenseTypes.includes(names[type])||type==='commission'&&roles.length&&!roles.includes(member.role))continue;
      rows.push({...member,type,team});
    }
    const grouped=new Map();
    for(const row of rows){
      const key=JSON.stringify([row.type,row.projectId,row.personId||null]),existing=grouped.get(key);
      if(!existing){grouped.set(key,{...row});continue;}
      if(row.role)existing.role=[...new Set([existing.role,row.role].filter(Boolean).flatMap(role=>role.split(' / ')))].join(' / ');
    }
    return [...grouped.values()];
  }
  async function createTemplate(state,month,id,scope='all',selection={}){
    if(!['all','person','project'].includes(scope))fail('不支持的模板类型');
    available(state,month);if(!id)fail('缺少模板批次标识');
    const ExcelJS=await loadExcel();
    const book=new ExcelJS.Workbook();book.creator='ERP项目管理优化Demo';
    const personTypes=[['bonus','奖金'],['personOther','其他成本']].filter(([,label])=>selection.expenseTypes===undefined?label==='奖金':!selection.expenseTypes.length||selection.expenseTypes.includes(label));
    const personHeaders=['序号','工号','人员姓名','部门','所属月份',...personTypes.flatMap(([,label])=>['原'+label+'（元）',label+'录入（元）'])];
    const personnel=personnelSelection(state,scope==='person'?{departments:selection.departments}:{}).filter(p=>M.personInAccountingCycle(p,month)).map((p,i)=>scope==='person'?{personId:p.id,cells:[i+1,p.employeeNo||p.id,p.name,p.department,month,...personTypes.flatMap(([type])=>[amount(state,type,month,{personId:p.id}),null])],inputs:personTypes.map(([type],index)=>({column:7+index*2,type}))}:({personId:p.id,cells:[i+1,p.id,p.name,p.projectRoles.join(' / '),p.department,month,amount(state,'salary',month,{personId:p.id}),null,amount(state,'bonus',month,{personId:p.id}),null],inputs:[{column:8,type:'salary'},{column:10,type:'bonus'}]}));
    if(scope==='person'&&!personnel.length)fail('所选部门下没有人员，请调整筛选条件');
    const projects=[];
    for(const r of projectImportRows(state,scope==='project'?selection:{}).filter(r=>scope==='project'||r.type!=='projectOther')){
      const type=r.type;
      const person=state.people.find(p=>p.id===r.personId),project=state.projects.find(p=>p.id===r.projectId);
      projects.push({personId:r.personId,projectId:r.projectId,cells:[projects.length+1,r.projectId,project.name,r.team,names[type],r.personId||'—',person?.name||'—',r.role||'—',month,amount(state,type,month,r),null],inputs:[{column:11,type}]});
    }
    if(scope==='project'&&!projects.length)fail('所选团队、费用类型、角色下没有数据，请调整筛选条件');
    const sheets=[{name:scope==='person'?(personTypes.length===1&&personTypes[0][0]==='bonus'?'人员奖金':'人员核算数据'):'人员固定成本',headers:scope==='person'?personHeaders:headers[0],rows:personnel,widths:scope==='person'?[8,16,18,42,16,...personTypes.flatMap(()=>[20,22])]:[8,14,18,34,42,16,22,24,20,22]},{name:'项目核算数据',headers:headers[1],rows:projects,widths:[8,14,40,28,25,14,18,18,16,22,22]}].filter((s,i)=>scope==='all'||i===(scope==='person'?0:1));
    for(const spec of sheets){
      const sheet=book.addWorksheet(spec.name,{views:[{state:'frozen',ySplit:5,showGridLines:false}],properties:{defaultRowHeight:24}});
      spec.widths.forEach((w,i)=>sheet.getColumn(i+1).width=w);
      sheet.getCell('A1').value=spec.name+' · 核算录入模板';sheet.getCell('A1').font={name:'微软雅黑',size:16,bold:true,color:{argb:'FF263247'}};sheet.getRow(1).height=32;
      sheet.getCell('A2').value='期间：'+month+'　单位：元'+(scope==='person'?'　部门：'+(selection.departments?.join('、')||'全部'):spec.name==='人员固定成本'?'　角色：'+(scope==='person'&&selection.roles?.join('、')||'全部')+'　部门：'+(selection.departments?.join('、')||'全部')+'　人员：'+personnel.length+'人':'　团队：'+(selection.teams?.join('、')||'全部')+'　费用类型：'+(selection.expenseTypes?.join('、')||'全部'));
      sheet.getCell('A3').value='只填黄色列：空白跳过，0覆盖为0。保留预填信息；不要增删行列或工作表。';
      sheet.getCell('A3').font={name:'微软雅黑',size:10,color:{argb:'FF647086'}};
      sheet.getRow(4).hidden=true;
      if(spec===sheets[0])sheet.getRow(4).values=[schema,id,month,state.revision];
      sheet.getRow(5).values=spec.headers;sheet.getRow(5).height=32;
      spec.headers.forEach((h,i)=>{const c=sheet.getCell(5,i+1);c.font={name:'微软雅黑',size:11,bold:true,color:{argb:'FFFFFFFF'}};c.fill={type:'pattern',pattern:'solid',fgColor:{argb:'FF354258'}};c.alignment={vertical:'middle',horizontal:'center'};});
      spec.rows.forEach((r,i)=>{const row=sheet.getRow(i+6);row.values=r.cells;
        for(let col=1;col<=spec.headers.length;col++){const c=row.getCell(col),editable=r.inputs.some(x=>x.column===col);c.font={name:'微软雅黑',size:11,color:{argb:editable?'FF245A9A':'FF526079'}};c.alignment={vertical:'middle'};c.fill={type:'pattern',pattern:'solid',fgColor:{argb:editable?'FFFFF1CA':i%2?'FFF3F5F8':'FFFFFFFF'}};
          if(editable){c.protection={locked:false};c.numFmt='#,##0.00';c.dataValidation={type:'decimal',operator:'greaterThanOrEqual',allowBlank:true,formulae:[0],showErrorMessage:true,errorTitle:'金额格式不正确',error:'请输入非负数值，不可使用公式。'};}
          else if(typeof r.cells[col-1]==='number'&&col>1)c.numFmt='#,##0.00';
          if(spec.name==='人员固定成本'&&[4,5].includes(col)){c.alignment={vertical:'middle',wrapText:true};row.height=40;}
        }
      });
      sheet.autoFilter={from:'A5',to:{row:spec.rows.length+5,column:spec.headers.length}};
      await sheet.protect('ERP-I005-template',{spinCount:1000,selectLockedCells:false,selectUnlockedCells:true,autoFilter:true});
    }
    const manifest={schema,id,month,scope,selection,revision:state.revision,stamp:stateStamp(state),sheets};
    return {buffer:await book.xlsx.writeBuffer(),manifest,filename:(scope==='person'?(personTypes.length===1&&personTypes[0][0]==='bonus'?'人员奖金':'人员核算数据'):scope==='project'?'项目核算数据':'核算数据')+'_'+month+'_录入模板.xlsx'};
  }
  async function readTemplate(buffer,state,manifests){
    if(!buffer||buffer.byteLength>5*1024*1024)fail('Excel 文件须小于 5 MB');
    const ExcelJS=await loadExcel();
    const book=new ExcelJS.Workbook();try{await book.xlsx.load(buffer);}catch{fail('无法读取 Excel，请上传对话中收到的 .xlsx 模板');}
    const first=book.worksheets[0];
    if(!first||first.getCell('A4').value!==schema)fail('不是当前核算模板，请重新下载 Excel 模板');
    const id=first.getCell('B4').value,manifest=manifests.find(m=>m.id===id&&m.schema===schema);
    if(!manifest)fail('未找到此模板生成记录，请在当前浏览器重新下载 Excel 模板');
    if(manifest.scope==='person'&&manifest.sheets.some(sheet=>sheet.rows.some(row=>row.inputs.some(input=>!['bonus','personOther'].includes(input.type)))))fail('人员导入仅支持奖金和其他成本，请重新下载模板');
    if(book.worksheets.length!==manifest.sheets.length||manifest.sheets.some(s=>!book.getWorksheet(s.name))||first.name!==manifest.sheets[0].name)fail('工作表结构已变化，请保留模板工作表');
    const {month,revision}=manifest;available(state,month);
    if(first.getCell('C4').value!==month||first.getCell('D4').value!==revision)fail('模板月份或版本信息被修改，请重新索取');
    if(revision!==state.revision||manifest.stamp!==stateStamp(state))fail('模板输出后的数据版本已变化，请重新索取 Excel 模板');
    const templateTypes=new Set(manifest.sheets.flatMap(sheet=>sheet.rows.flatMap(row=>row.inputs.map(input=>input.type))));
    const groups=order.filter(type=>templateTypes.has(type)).map(type=>({type,rows:[]}));let filled=0;
    for(const spec of manifest.sheets){const sheet=book.getWorksheet(spec.name);
      if(sheet.rowCount>spec.rows.length+5||sheet.columnCount>spec.headers.length)fail('模板包含额外行或列，请保留原有结构');
      spec.headers.forEach((h,i)=>{if(sheet.getCell(5,i+1).value!==h)fail('模板表头被修改，请保留原有表头');});
      const seen=new Set();
      for(let n=6;n<spec.rows.length+6;n++){const serial=sheet.getCell(n,1).value,r=spec.rows.find(r=>r.cells[0]===serial);
        if(!r||seen.has(serial))fail('第'+n+'行身份重复或不完整，请保留全部预填行');seen.add(serial);
        for(let c=1;c<=spec.headers.length;c++)if(!r.inputs.some(x=>x.column===c)&&(sheet.getCell(n,c).value??null)!==r.cells[c-1])fail('第'+n+'行预填身份或原金额已修改，请只填写黄色金额列');
        for(const input of r.inputs){const raw=sheet.getCell(n,input.column).value;let value='';
          if(raw!==null&&raw!==undefined&&raw!==''){
            if(typeof raw==='object'&&('formula'in raw||'sharedFormula'in raw))fail('第'+n+'行金额不可使用公式，请粘贴数值');
            if(typeof raw!=='number'||!Number.isFinite(raw)||raw<0)fail('第'+n+'行金额须为非负数值，不能包含文本、日期或公式');
            value=raw;filled++;
          }
          groups.find(g=>g.type===input.type).rows.push({personId:r.personId,projectId:r.projectId,value});
        }
      }
    }
    if(!filled)fail('Excel 没有填写金额，请在黄色列填写后再发送');
    return {month,revision,templateId:id,scope:manifest.scope||'all',selection:manifest.selection||{},groups};
  }
  const signature=p=>stateStamp({month:p.month,revision:p.revision,stamp:p.stamp,templateId:p.templateId,sourceFile:p.sourceFile,groups:p.groups,errors:p.errors});
  function previewWorkbook(state,result,sourceFile){
    const groups=order.map(type=>M.previewImport(state,type,result.month,result.groups.find(g=>g.type===type)?.rows||[]));
    const p={month:result.month,revision:result.revision,stamp:stateStamp(state),templateId:result.templateId,sourceFile,groups,errors:groups.flatMap(g=>g.errors)};p.signature=signature(p);p.id='workbook-'+p.signature;return p;
  }
  function applyWorkbook(state,p){
    if(!p||p.signature!==signature(p)||p.id!=='workbook-'+p.signature)fail('导入预览内容已变化，请重新发送 Excel');
    const active=p.groups.filter(g=>g.rows.some(r=>r.kind!=='skip')),applied=state.batches.filter(b=>b.excelWorkbookId===p.id);
    if(applied.length){if(applied.length===active.length&&active.every(g=>applied.some(b=>b.type===g.type)))return state;fail('工作簿导入记录不完整，请核查批次');}
    if(state.revision!==p.revision||stateStamp(state)!==p.stamp)fail('数据版本已变化，请重新索取 Excel');
    available(state,p.month);if(p.errors.length)fail(p.errors.join('；'));if(!active.length)fail('Excel 没有填写金额');
    let next=state;
    for(const g of active){const item=M.previewImport(next,g.type,p.month,g.rows.map(r=>({personId:r.personId,projectId:r.projectId,value:r.newValue})));Object.assign(item,{sourceFile:p.sourceFile,templateId:p.templateId,excelWorkbookId:p.id});next=M.applyImport(next,item);}
    return next;
  }
  async function createPersonnelReport(state,{months,people,role='咨询师',periodLabel='',missingMonths=[]}){
    if(!months.length)fail('没有可导出的核算期间');
    const ExcelJS=await loadExcel(),book=new ExcelJS.Workbook();book.creator='ERP项目管理Demo';
    book.calcProperties.fullCalcOnLoad=true;
    const money='#,##0.00;-#,##0.00;"-"',decimal='0.##;-0.##;"-"',rate='0.00%;-0.00%;"-"';
    const subject=role==='all'?'人员':role,blue='FF4472C4',border={style:'thin',color:{argb:'FF646464'}};
    for(const month of months){
      const sheet=book.addWorksheet(month,{views:[{state:'frozen',xSplit:3,ySplit:3,showGridLines:false}],pageSetup:{paperSize:8,orientation:'landscape',fitToPage:true,fitToWidth:1,fitToHeight:0}});
      sheet.columns=[7,15,16,20,16,16,17,11,17,18,18,16,18,19,18,19,16,22].map(width=>({width}));
      const merge=(range,value)=>{sheet.mergeCells(range);sheet.getCell(range.split(':')[0]).value=value;};
      merge('A1:R1',month.slice(0,4)+'年'+Number(month.slice(5))+'月份'+subject+'利润总明细表');
      [['A2:A3','序号'],['B2:B3',role==='咨询师'?'咨询老师':'人员姓名'],['C2:C3','入职时间'],['D2:G2','基本情况'],['H2:M2','总成本'],['N2:N3','税前利润'],['O2:O3','所得税'],['P2:P3','净利润'],['Q2:Q3','净利润率'],['R2:R3','盈亏平衡点'],['H3:I3','税费']].forEach(([range,text])=>merge(range,text));
      ['当月交付金额','当月交付天数','当月上班天数','项目饱和度'].forEach((text,i)=>sheet.getCell(3,i+4).value=text);
      ['固定人工','提成','奖金','管理费'].forEach((text,i)=>sheet.getCell(3,i+10).value=text);
      for(let row=1;row<=3;row++)for(let col=1;col<=18;col++){
        const cell=sheet.getCell(row,col);cell.fill={type:'pattern',pattern:'solid',fgColor:{argb:blue}};cell.font={name:'微软雅黑',size:11,bold:true,color:{argb:'FFFFFFFF'}};cell.alignment={vertical:'middle',horizontal:'center',wrapText:true};cell.border={top:border,bottom:border,left:border,right:border};
      }
      sheet.getRow(1).height=40;sheet.getRow(2).height=36;sheet.getRow(3).height=36;
      const notes=[];
      people.filter(person=>M.personInAccountingCycle(person,month)).forEach((person,index)=>{
        const r=M.personResult(state,person.id,month),n=index+4,row=sheet.getRow(n),api=globalThis.ProjectManagementInsights,missing=api?api.resultIssues(state,'person',person.id,r):r.missing.filter(text=>!text.includes('无法测算')),complete=!missing.length,absent=api?.inputDetails(state,'person',person.id,month).absent||{};
        const incomeKnown=!missing.some(text=>text.includes('收入比例')),salaryKnown=!missing.some(text=>/工资|固定人工/.test(text)),calendarKnown=r.standardHours>0;
        row.values=[index+1,person.name,new Date(person.joined+'T00:00:00Z'),incomeKnown?r.income:'-',r.days,calendarKnown?r.standardHours/8:'-',calendarKnown?r.saturation:'—',.033,incomeKnown?r.costs.tax:'-',salaryKnown?r.costs.salary:'待补充',absent.commission?'待补充':r.costs.commission,absent.bonus?'待补充':r.costs.bonus,incomeKnown?r.costs.management:'-',complete?r.pretax:'-',complete?r.tax:'-',complete?r.net:'-',complete&&r.margin!==null?r.margin:'-',complete&&r.breakEven!==null?r.breakEven:'-'];
        const formula=(col,text,result)=>sheet.getCell(col+n).value={formula:text,result};
        if(calendarKnown)formula('G',`E${n}/F${n}`,r.saturation);
        if(incomeKnown){formula('I',`ROUND(D${n}*H${n},2)`,r.costs.tax);formula('M',`ROUND(D${n}*20%,2)`,r.costs.management);}
        if(complete){
          formula('N',`ROUND(D${n}-SUM(I${n}:M${n}),2)`,r.pretax);formula('O',`ROUND(MAX(N${n},0)*15%,2)`,r.tax);formula('P',`ROUND(N${n}-O${n},2)`,r.net);
          formula('Q',`IF(D${n}>0,P${n}/D${n},"—")`,r.margin??'—');
          formula('R',`IF(D${n}<=0,"—",IF(1-(I${n}+M${n})/D${n}<=0,"—",ROUND(SUM(J${n}:L${n})/(1-(I${n}+M${n})/D${n}),2)))`,r.breakEven??'—');
        }
        row.height=26;
        for(let col=1;col<=18;col++){
          const cell=row.getCell(col);cell.font={name:'微软雅黑',size:11,color:{argb:'FF333333'}};cell.alignment={vertical:'middle',horizontal:col<=3?'center':'right'};cell.border={top:border,bottom:border,left:border,right:border};
          cell.numFmt=col===3?'yyyy-mm-dd':[7,8,17].includes(col)?rate:[5,6].includes(col)?decimal:col>=4?money:'General';
          if(col>=10&&col<=12)cell.fill={type:'pattern',pattern:'solid',fgColor:{argb:'FFFFFF00'}};
          if(cell.value==='待补充')cell.font={name:'微软雅黑',size:11,color:{argb:'FFB45309'}};
        }
        if(missing.length)notes.push(person.name+'：'+missing.join('；'));
      });
      const end=sheet.rowCount;sheet.autoFilter={from:'A3',to:{row:Math.max(3,end),column:18}};
      const addNote=text=>{const n=sheet.rowCount+1;merge('A'+n+':R'+n,text);sheet.getRow(n).height=28;sheet.getCell(n,1).font={name:'微软雅黑',size:10,color:{argb:'FF647086'}};sheet.getCell(n,1).alignment={vertical:'middle',wrapText:true};};
      if(periodLabel)addNote('页面分析范围：'+periodLabel+'；本文件按月分工作表。'+(missingMonths.length?'无核算数据的月份未生成工作表：'+missingMonths.join('、')+'；年度合计不完整。':''));
      addNote('期间：'+month+'　筛选角色：'+(role==='all'?'全部角色':role)+'　单位：元；交付天数＝项目工时÷8，上班天数＝当月考勤标准工时÷8。');
      addNote('盈亏平衡点＝（固定人工＋提成＋奖金）÷［1－（税费＋管理费）÷当月交付金额］；黄色为固定人工、提成、奖金。报表为本地示例核算，修改导出文件不回写ERP。');
      notes.forEach(addNote);sheet.pageSetup.printArea='A1:R'+sheet.rowCount;sheet.pageSetup.printTitlesRow='1:3';
    }
    return {filename:subject+'利润总明细表_'+(months.length===1?months[0]:months[0]+'至'+months.at(-1))+'.xlsx',buffer:await book.xlsx.writeBuffer()};
  }
  async function createProjectReport(state,{month,year=null,periodLabel='',cumulative=false,rows,team='全部团队'}){
    const ExcelJS=await loadExcel(),book=new ExcelJS.Workbook();book.creator='ERP项目管理Demo';
    const sheet=book.addWorksheet('咨询项目利润明细表',{views:[{state:'frozen',xSplit:3,ySplit:3,showGridLines:false}],pageSetup:{paperSize:8,orientation:'landscape',fitToPage:true,fitToWidth:1,fitToHeight:0}});
    const blue='FF4472C4',border={style:'thin',color:{argb:'FF646464'}},money='#,##0.00;-#,##0.00;"-"';
    sheet.columns=[7,23,40,14,28,23,23,19,21,19,21,19,18,19,18,23,23,23,21,19,21,21,20,19,21,15,24,20,26,50].map(width=>({width}));
    const merge=(range,value)=>{sheet.mergeCells(range);sheet.getCell(range.split(':')[0]).value=value;};
    merge('A1:AD1','咨询项目利润明细表');
    [['A2:A3','序号'],['B2:B3','订单编号'],['C2:C3','项目名称'],['D2:G2','项目基本情况'],['H2:K2','项目回款情况'],['L2:V2','项目总成本'],['W2:W3','税前利润'],['X2:X3','所得税'],['Y2:Y3','净利润\n（元）'],['Z2:Z3','净利率'],['AA2:AA3','盈亏平衡交付金额\n（元）'],['AB2:AB3','项目经理'],['AC2:AC3','项目顾问'],['AD2:AD3','备注']].forEach(([range,text])=>merge(range,text));
    ['项目状态','项目服务周期','项目类型','成交方式','合同总额\n（元）',(cumulative?'本年度回款金额（元）':'当月回款金额（元）'),'应收账款\n（元）',(cumulative?'本年度确认交付金额\n（元）':'当月确认交付金额\n（元）'),'业务成本\n（元）','管理费','交通差旅\n（元）','税金\n（元）','大客户经理提成\n（元）','项目交付提成\n（元）','咨询师工资成本\n（元）','项目异常费用','年终奖分摊','固定成本分摊','总成本\n（元）'].forEach((text,i)=>sheet.getCell(3,i+4).value=text);
    for(let row=1;row<=3;row++)for(let col=1;col<=30;col++){
      const cell=sheet.getCell(row,col);cell.fill={type:'pattern',pattern:'solid',fgColor:{argb:blue}};cell.font={name:'微软雅黑',size:11,bold:true,color:{argb:'FFFFFFFF'}};cell.alignment={vertical:'middle',horizontal:'center',wrapText:true};cell.border={top:border,bottom:border,left:border,right:border};
    }
    sheet.getRow(1).height=40;sheet.getRow(2).height=34;sheet.getRow(3).height=46;
    rows.forEach((r,index)=>{
      const p=r.entity,n=index+4,c=r.costs,complete=r.complete,missing=r.missing||[];
      const members=state.members.filter(member=>member.projectId===p.id);
      const names=role=>[...new Set(members.filter(member=>member.role===role).map(member=>state.people.find(person=>person.id===member.personId)?.name).filter(Boolean))].join(' / ');
      const breakEven=r.periodBreakEven;
      const notes=[p.note||p.remark,missing.length?'待补齐：'+missing.join('；'):null].filter(Boolean).join('；');
      const input=(key)=>r.missingInputs?.[key]?'待补充':r.coverageMissing?.length?'-':c[key];
      const row=sheet.getRow(n);row.values=[index+1,r.orderNo||p.orderNo||'—',p.name,p.status==='筹备中'?'未开始':p.status,p.endDate?p.startDate+' 至 '+p.endDate:(p.startDate?p.startDate+' 起':'—'),p.type,p.dealMode||'—',r.now.contract,r.coverageMissing?.length?'-':r.received,r.now.receivable,r.revenueMissing?'-':r.delivered,c.business,c.management,input('travel'),c.tax,input('accountManager'),input('commission'),r.salaryMissing?'-':c.salary,input('exception'),r.coverageMissing?.length?'-':c.yearBonus,input('fixed'),complete?r.cost:'-',complete?M.round(r.selected.reduce((sum,item)=>sum+item.pretax,0)):'-',complete?r.tax:'-',complete?r.net:'-',complete?(r.margin??'-'):'-',complete?(breakEven??'-'):'-',names('项目经理')||state.people.find(person=>person.id===p.ownerId)?.name||'—',names('咨询师')||'—',notes];
      row.height=notes?56:36;
      for(let col=1;col<=30;col++){
        const cell=row.getCell(col);cell.font={name:'微软雅黑',size:11,color:{argb:cell.value==='待补充'?'FFB45309':'FF333333'}};cell.alignment={vertical:'middle',horizontal:col>=8&&col<=27?'right':col===1||col===4?'center':'left',wrapText:col<8||col>27};cell.border={top:border,bottom:border,left:border,right:border};cell.numFmt=col===26?'0.0%;-0.0%;"-"':col>=8&&col<=27?money:'General';
      }
    });
    const end=sheet.rowCount;sheet.autoFilter={from:'A3',to:{row:Math.max(3,end),column:30}};
    if(rows.length)sheet.addConditionalFormatting({ref:'Z4:Z'+end,rules:[{type:'cellIs',operator:'greaterThanOrEqual',formulae:[.2],style:{fill:{type:'pattern',pattern:'solid',fgColor:{argb:'FFC6EFCE'}},font:{color:{argb:'FF006100'}}}},{type:'expression',formulae:['AND(ISNUMBER(Z4),Z4<15%)'],style:{fill:{type:'pattern',pattern:'solid',fgColor:{argb:'FFFFC7CE'}},font:{color:{argb:'FF9C0006'}}}}]});
    const period=cumulative?(year?year+'年累计':'累计至'+month):month;
    const addNote=text=>{const n=sheet.rowCount+1;merge('A'+n+':AD'+n,text);sheet.getRow(n).height=28;sheet.getCell(n,1).font={name:'微软雅黑',size:10,color:{argb:'FF647086'}};sheet.getCell(n,1).alignment={vertical:'middle',wrapText:true};};
    addNote('核算期间：'+(periodLabel||period)+'　项目团队：'+(team==='all'?'全部团队':team)+'　项目数量：'+rows.length+'　单位：元。数据来源：当前 Demo 模拟数据及当前项目筛选。');
    addNote('回款、确认交付、成本、利润及盈亏平衡交付金额按页面期间汇总；年度范围为当年2月至次年1月，截止日见上方范围。合同总额与期末应收余额为项目整体登记金额。缺失月份未计入已知合计，缺数据不出具完整利润。所得税采用项目累计计税、当月差额回调。');
    addNote('项目服务周期未维护结束日期时显示起始日期，未维护成交方式显示“—”；人工导入项缺失显示“待补充”，无法计算的结果显示“-”。净利率≥20%为绿色，低于15%为红色。导出文件修改不回写ERP。');
    sheet.pageSetup.printArea='A1:AD'+sheet.rowCount;sheet.pageSetup.printTitlesRow='1:3';
    return {filename:'咨询项目利润明细表_'+period+'.xlsx',buffer:await book.xlsx.writeBuffer()};
  }
  async function createAccountingReport({title,period,periodLabel,groups,columns,rows}){
    if(!columns?.length)fail('核算明细没有可导出的字段');
    const ExcelJS=await loadExcel(),book=new ExcelJS.Workbook();book.creator='ERP项目管理Demo';
    const sheet=book.addWorksheet(title,{views:[{state:'frozen',xSplit:2,ySplit:4,showGridLines:false}],pageSetup:{orientation:'landscape',fitToPage:true,fitToWidth:1,fitToHeight:0}});
    const count=columns.length,border={style:'thin',color:{argb:'FFE1E6EE'}},headerFill={type:'pattern',pattern:'solid',fgColor:{argb:'FF4472C4'}};
    const width=label=>label==='序号'?8:label==='缺失内容'?70:label==='核算期间'?48:/项目名称|部门|项目角色/.test(label)?36:/编号|工号|日期|时间|团队/.test(label)?22:Math.max(18,Math.min(30,label.length*2+4));
    sheet.columns=columns.map(column=>({width:width(column.label)}));
    for(const [row,value] of [[1,title],[2,periodLabel]]){sheet.mergeCells(row,1,row,count);const cell=sheet.getCell(row,1);cell.value=value;cell.font={name:'微软雅黑',size:row===1?16:11,bold:row===1,color:{argb:row===1?'FF263247':'FF647086'}};cell.alignment={vertical:'middle'};sheet.getRow(row).height=row===1?34:28;}
    let start=1;
    for(const group of groups){if(group.span>1)sheet.mergeCells(3,start,3,start+group.span-1);sheet.getCell(3,start).value=group.label;start+=group.span;}
    sheet.getRow(4).values=columns.map(column=>column.label);
    for(let row=3;row<=4;row++){sheet.getRow(row).height=row===3?30:42;for(let col=1;col<=count;col++){const cell=sheet.getCell(row,col);cell.fill=headerFill;cell.font={name:'微软雅黑',size:11,bold:true,color:{argb:'FFFFFFFF'}};cell.alignment={vertical:'middle',horizontal:'center',wrapText:true};cell.border={top:border,bottom:border,left:border,right:border};}}
    rows.forEach((values,index)=>{
      if(values.length!==count)fail('核算明细字段与数据不一致');
      const row=sheet.getRow(index+5);row.height=values.some(value=>String(value).length>65)?54:34;
      values.forEach((value,i)=>{
        const column=columns[i],cell=row.getCell(i+1),text=String(value??'-'),numeric=(column.numeric||column.label==='序号')&&/^-?\d[\d,]*(?:\.\d+)?[%h]?$/.test(text);
        cell.value=numeric?Number(text.replace(/,/g,'').replace(/[%h]$/,''))/(text.endsWith('%')?100:1):text;
        if(numeric)cell.numFmt=text.endsWith('%')?'0.0%':text.endsWith('h')?'0.##"h"':/序号|月数|项目数/.test(column.label)?'0':'#,##0.00';
        cell.font={name:'微软雅黑',size:11,color:{argb:text==='待补充'?'FFB45309':'FF34455E'}};cell.alignment={vertical:'middle',horizontal:numeric?'right':'left',wrapText:!numeric};cell.border={top:border,bottom:border,left:border,right:border};
        if(index%2)cell.fill={type:'pattern',pattern:'solid',fgColor:{argb:'FFF7F9FC'}};
      });
    });
    sheet.autoFilter={from:{row:4,column:1},to:{row:Math.max(4,rows.length+4),column:count}};
    sheet.pageSetup.printTitlesRow='1:4';sheet.pageSetup.printArea='A1:'+sheet.getCell(Math.max(4,rows.length+4),count).address;
    return {filename:title+'_'+period+'.xlsx',buffer:await book.xlsx.writeBuffer()};
  }
  return {createTemplate,readTemplate,previewWorkbook,applyWorkbook,stateStamp,createPersonnelReport,createProjectReport,createAccountingReport,personnelInfo,personnelSelection,projectImportRows};
});
