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
  return {createTemplate,readTemplate,previewWorkbook,applyWorkbook,stateStamp};
});
