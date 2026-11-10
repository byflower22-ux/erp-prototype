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
    root.ProjectExcel=factory(loadExcel,root.ProjectModel);
  }
})(typeof globalThis!=='undefined'?globalThis:this,function(loadExcel,M){
  'use strict';
  const schema='ERP-I005-XLSX-v2',order=['salary','bonus','commission','exception','fixed'];
  const names={commission:'项目人员提成',exception:'项目异常费用',fixed:'项目固定成本分摊'};
  const headers=[['序号','人员编号','人员姓名','所属月份','原固定人工（元）','固定人工录入（元）','原奖金（元）','奖金录入（元）'],['序号','项目编号','项目名称','费用类型','人员编号','人员姓名','项目角色','所属月份','原金额（元）','录入金额（元）']];
  const fail=message=>{throw Error(message);};
  const stateStamp=state=>{let h=2166136261;const text=JSON.stringify(state);for(let i=0;i<text.length;i++){h^=text.charCodeAt(i);h=Math.imul(h,16777619);}return (h>>>0).toString(16);};
  function available(state,month){
    if(!state.months.includes(month))fail('月份不在可操作期间内');
    if(state.closed[month])fail(month+' 已月结，请先反结账');
    if(Object.keys(state.closed).some(m=>m>month))fail('存在后续已结月份，请先反结账后续月份');
  }
  function amount(state,type,month,r){const collection={salary:'salaries',bonus:'bonuses',commission:'commissions',exception:'expenses',fixed:'expenses'}[type];return state[collection].find(x=>x.month===month&&(!r.personId||r.personId===x.personId)&&(!r.projectId||r.projectId===x.projectId)&&(!['exception','fixed'].includes(type)||x.category===type))?.amount??null;}
  async function createTemplate(state,month,id){
    available(state,month);if(!id)fail('缺少模板批次标识');
    const ExcelJS=await loadExcel();
    const book=new ExcelJS.Workbook();book.creator='ERP项目管理优化Demo';
    const personnel=state.people.map((p,i)=>({personId:p.id,cells:[i+1,p.id,p.name,month,amount(state,'salary',month,{personId:p.id}),null,amount(state,'bonus',month,{personId:p.id}),null],inputs:[{column:6,type:'salary'},{column:8,type:'bonus'}]}));
    const projects=[];
    for(const type of ['commission','exception','fixed'])for(const r of type==='commission'?state.members:state.projects.map(p=>({projectId:p.id}))){
      const person=state.people.find(p=>p.id===r.personId),project=state.projects.find(p=>p.id===r.projectId);
      projects.push({personId:r.personId,projectId:r.projectId,cells:[projects.length+1,r.projectId,project.name,names[type],r.personId||'—',person?.name||'—',r.role||'—',month,amount(state,type,month,r),null],inputs:[{column:10,type}]});
    }
    const sheets=[{name:'人员固定成本',headers:headers[0],rows:personnel,widths:[8,14,18,16,22,24,20,22]},{name:'项目核算数据',headers:headers[1],rows:projects,widths:[8,14,40,25,14,18,18,16,22,22]}];
    for(const spec of sheets){
      const sheet=book.addWorksheet(spec.name,{views:[{state:'frozen',ySplit:5,showGridLines:false}],properties:{defaultRowHeight:24}});
      spec.widths.forEach((w,i)=>sheet.getColumn(i+1).width=w);
      sheet.getCell('A1').value=spec.name+' · 核算录入模板';sheet.getCell('A1').font={name:'微软雅黑',size:16,bold:true,color:{argb:'FF263247'}};sheet.getRow(1).height=32;
      sheet.getCell('A2').value='期间：'+month+'　单位：元';
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
        }
      });
      sheet.autoFilter={from:'A5',to:{row:spec.rows.length+5,column:spec.headers.length}};
      await sheet.protect('ERP-I005-template',{spinCount:1000,selectLockedCells:false,selectUnlockedCells:true,autoFilter:true});
    }
    const manifest={schema,id,month,revision:state.revision,stamp:stateStamp(state),sheets};
    return {buffer:await book.xlsx.writeBuffer(),manifest,filename:'核算数据_'+month+'_录入模板.xlsx'};
  }
  async function readTemplate(buffer,state,manifests){
    if(!buffer||buffer.byteLength>5*1024*1024)fail('Excel 文件须小于 5 MB');
    const ExcelJS=await loadExcel();
    const book=new ExcelJS.Workbook();try{await book.xlsx.load(buffer);}catch{fail('无法读取 Excel，请上传对话中收到的 .xlsx 模板');}
    const first=book.getWorksheet('人员固定成本');
    if(!first||first.getCell('A4').value!==schema)fail('不是当前两 Sheet 核算模板，请在对话中重新索取 Excel');
    const id=first.getCell('B4').value,manifest=manifests.find(m=>m.id===id&&m.schema===schema);
    if(!manifest)fail('未找到此模板生成记录，请在当前浏览器重新索取 Excel 模板');
    if(book.worksheets.length!==2||manifest.sheets.some(s=>!book.getWorksheet(s.name)))fail('工作表结构已变化，请保留两个工作表');
    const {month,revision}=manifest;available(state,month);
    if(first.getCell('C4').value!==month||first.getCell('D4').value!==revision)fail('模板月份或版本信息被修改，请重新索取');
    if(revision!==state.revision||manifest.stamp!==stateStamp(state))fail('模板输出后的数据版本已变化，请重新索取 Excel 模板');
    const groups=order.map(type=>({type,rows:[]}));let filled=0;
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
    return {month,revision,templateId:id,groups};
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
  async function createPersonnelReport(state,{months,people,role='咨询师'}){
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
      people.filter(person=>person.joined.slice(0,7)<=month).forEach((person,index)=>{
        const r=M.personResult(state,person.id,month),n=index+4,row=sheet.getRow(n),missing=r.missing.filter(text=>!text.includes('无法测算')),complete=!missing.length;
        const incomeKnown=!missing.some(text=>text.includes('收入比例')),salaryKnown=!missing.some(text=>text.includes('工资')),calendarKnown=r.standardHours>0;
        row.values=[index+1,person.name,new Date(person.joined+'T00:00:00Z'),incomeKnown?r.income:'待补齐',r.days,calendarKnown?r.standardHours/8:'待补齐',calendarKnown?r.saturation:'—',.033,incomeKnown?r.costs.tax:'待补齐',salaryKnown?r.costs.salary:'待补齐',r.costs.commission,r.costs.bonus,incomeKnown?r.costs.management:'待补齐',complete?r.pretax:'待补齐',complete?r.tax:'待补齐',complete?r.net:'待补齐',complete&&r.margin!==null?r.margin:complete?'—':'待补齐',complete&&r.breakEven!==null?r.breakEven:complete?'—':'待补齐'];
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
          if(cell.value==='待补齐')cell.font={name:'微软雅黑',size:11,color:{argb:'FFB45309'}};
        }
        if(missing.length)notes.push(person.name+'：'+missing.join('；'));
      });
      const end=sheet.rowCount;sheet.autoFilter={from:'A3',to:{row:Math.max(3,end),column:18}};
      const addNote=text=>{const n=sheet.rowCount+1;merge('A'+n+':R'+n,text);sheet.getRow(n).height=28;sheet.getCell(n,1).font={name:'微软雅黑',size:10,color:{argb:'FF647086'}};sheet.getCell(n,1).alignment={vertical:'middle',wrapText:true};};
      addNote('期间：'+month+'　筛选角色：'+(role==='all'?'全部角色':role)+'　单位：元；交付天数＝项目工时÷8，上班天数＝当月考勤标准工时÷8。');
      addNote('盈亏平衡点＝（固定人工＋提成＋奖金）÷［1－（税费＋管理费）÷当月交付金额］；黄色为固定人工、提成、奖金。报表为本地示例核算，修改导出文件不回写ERP。');
      notes.forEach(addNote);sheet.pageSetup.printArea='A1:R'+sheet.rowCount;sheet.pageSetup.printTitlesRow='1:3';
    }
    return {filename:subject+'利润总明细表_'+(months.length===1?months[0]:months[0]+'至'+months.at(-1))+'.xlsx',buffer:await book.xlsx.writeBuffer()};
  }
  async function createProjectReport(state,{month,cumulative=false,rows,team='全部团队'}){
    const ExcelJS=await loadExcel(),book=new ExcelJS.Workbook();book.creator='ERP项目管理Demo';
    const sheet=book.addWorksheet('咨询项目利润明细表',{views:[{state:'frozen',xSplit:3,ySplit:3,showGridLines:false}],pageSetup:{paperSize:8,orientation:'landscape',fitToPage:true,fitToWidth:1,fitToHeight:0}});
    const blue='FF4472C4',border={style:'thin',color:{argb:'FF646464'}},money='#,##0.00;-#,##0.00;"-"';
    sheet.columns=[7,23,40,14,28,23,23,19,21,19,21,19,18,19,18,23,23,23,21,19,21,21,20,19,21,15,24,20,26,50].map(width=>({width}));
    const merge=(range,value)=>{sheet.mergeCells(range);sheet.getCell(range.split(':')[0]).value=value;};
    merge('A1:AD1','咨询项目利润明细表');
    [['A2:A3','序号'],['B2:B3','订单编号'],['C2:C3','项目名称'],['D2:G2','项目基本情况'],['H2:K2','项目回款情况'],['L2:V2','项目总成本'],['W2:W3','税前利润'],['X2:X3','所得税'],['Y2:Y3','净利润\n（元）'],['Z2:Z3','净利率'],['AA2:AA3','盈亏平衡回款\n（元）'],['AB2:AB3','项目经理'],['AC2:AC3','项目顾问'],['AD2:AD3','备注']].forEach(([range,text])=>merge(range,text));
    ['项目状态','项目服务周期','项目类型','成交方式','合同总额\n（元）','累计回款金额（元）','应收账款\n（元）','累计交付收入\n（元）','业务成本\n（元）','管理费','交通差旅\n（元）','税金\n（元）','大客户经理提成\n（元）','项目交付提成\n（元）','咨询师工资成本\n（元）','项目异常费用','年终奖分摊','固定成本分摊','总成本\n（元）'].forEach((text,i)=>sheet.getCell(3,i+4).value=text);
    for(let row=1;row<=3;row++)for(let col=1;col<=30;col++){
      const cell=sheet.getCell(row,col);cell.fill={type:'pattern',pattern:'solid',fgColor:{argb:blue}};cell.font={name:'微软雅黑',size:11,bold:true,color:{argb:'FFFFFFFF'}};cell.alignment={vertical:'middle',horizontal:'center',wrapText:true};cell.border={top:border,bottom:border,left:border,right:border};
    }
    sheet.getRow(1).height=40;sheet.getRow(2).height=34;sheet.getRow(3).height=46;
    rows.forEach((r,index)=>{
      const p=r.entity,n=index+4,c=r.costs,complete=r.complete,missing=r.missing||[];
      const members=state.members.filter(member=>member.projectId===p.id);
      const names=role=>[...new Set(members.filter(member=>member.role===role).map(member=>state.people.find(person=>person.id===member.personId)?.name).filter(Boolean))].join(' / ');
      const breakEven=cumulative?r.now.cumulative.breakEven:r.now.breakEven;
      const notes=[p.note||p.remark,missing.length?'待补齐：'+missing.join('；'):null].filter(Boolean).join('；');
      const row=sheet.getRow(n);row.values=[index+1,r.orderNo||p.orderNo||'—',p.name,p.status==='筹备中'?'未开始':p.status,p.endDate?p.startDate+' 至 '+p.endDate:(p.startDate?p.startDate+' 起':'—'),p.type,p.dealMode||'—',r.now.contract,r.received,r.now.receivable,r.delivered,c.business,c.management,c.travel,c.tax,c.accountManager,c.commission,r.salaryMissing?'待补齐':c.salary,c.exception,c.yearBonus,c.fixed,complete?r.cost:'待补齐',complete?M.round(r.selected.reduce((sum,item)=>sum+item.pretax,0)):'待补齐',complete?r.tax:'待补齐',complete?r.net:'待补齐',complete?(r.margin??'—'):'待补齐',complete?(breakEven??'—'):'待补齐',names('项目经理')||state.people.find(person=>person.id===p.ownerId)?.name||'—',names('咨询师')||'—',notes];
      row.height=notes?56:36;
      for(let col=1;col<=30;col++){
        const cell=row.getCell(col);cell.font={name:'微软雅黑',size:11,color:{argb:cell.value==='待补齐'?'FFB45309':'FF333333'}};cell.alignment={vertical:'middle',horizontal:col>=8&&col<=27?'right':col===1||col===4?'center':'left',wrapText:col<8||col>27};cell.border={top:border,bottom:border,left:border,right:border};cell.numFmt=col===26?'0.0%;-0.0%;"-"':col>=8&&col<=27?money:'General';
      }
    });
    const end=sheet.rowCount;sheet.autoFilter={from:'A3',to:{row:Math.max(3,end),column:30}};
    if(rows.length)sheet.addConditionalFormatting({ref:'Z4:Z'+end,rules:[{type:'cellIs',operator:'greaterThanOrEqual',formulae:[.2],style:{fill:{type:'pattern',pattern:'solid',fgColor:{argb:'FFC6EFCE'}},font:{color:{argb:'FF006100'}}}},{type:'expression',formulae:['AND(ISNUMBER(Z4),Z4<15%)'],style:{fill:{type:'pattern',pattern:'solid',fgColor:{argb:'FFFFC7CE'}},font:{color:{argb:'FF9C0006'}}}}]});
    const period=cumulative?'累计至'+month:month;
    const addNote=text=>{const n=sheet.rowCount+1;merge('A'+n+':AD'+n,text);sheet.getRow(n).height=28;sheet.getCell(n,1).font={name:'微软雅黑',size:10,color:{argb:'FF647086'}};sheet.getCell(n,1).alignment={vertical:'middle',wrapText:true};};
    addNote('核算期间：'+period+'　项目团队：'+(team==='all'?'全部团队':team)+'　项目数量：'+rows.length+'　单位：元。数据来源：当前 Demo 模拟数据及当前项目筛选。');
    addNote('累计回款、累计交付为截至所选月累计数；各项成本、利润和盈亏平衡按所选当月／累计口径。应收账款沿用项目登记金额。所得税采用项目累计计税、当月差额回调。');
    addNote('项目服务周期未维护结束日期时显示起始日期，未维护成交方式显示“—”；必要核算依据缺失显示“待补齐”。净利率≥20%为绿色，低于15%为红色。导出文件修改不回写ERP。');
    sheet.pageSetup.printArea='A1:AD'+sheet.rowCount;sheet.pageSetup.printTitlesRow='1:3';
    return {filename:'咨询项目利润明细表_'+period+'.xlsx',buffer:await book.xlsx.writeBuffer()};
  }
  return {createTemplate,readTemplate,previewWorkbook,applyWorkbook,stateStamp,createPersonnelReport,createProjectReport};
});
