(function(root){
  'use strict';
  const U=root.ProjectUI,{esc:e,money:m,percent:p}=U,sessions=new Map();
  const names={income:'交付金额',net:'税后利润',margin:'净利率',cost:'总成本',cashGap:'累计回款缺口',cashRate:'回款覆盖率',util:'工时利用率',incomeHour:'小时产出',roi:'人工投入产出比',concentration:'单项目集中度'};
  const costNames={salary:'人工成本',commission:'提成',bonus:'人员奖金',tax:'税费',management:'管理费',business:'业务费用',travel:'差旅',accountManager:'客户经理提成',exception:'例外费用',yearBonus:'年终奖分摊',fixed:'固定分摊'};
  const add=(rows,key)=>rows.reduce((n,r)=>n+Number(r[key]||0),0),clean=name=>name.replace('（示例）',''),format=(key,n)=>n==null?'—':['margin','cashRate','util','concentration'].includes(key)?p(n):key==='roi'?n.toFixed(2)+' 倍':m(n);
  const table=(headers,rows)=>`<div class="aa-table-wrap"><table><thead><tr>${headers.map(x=>'<th>'+e(x)+'</th>').join('')}</tr></thead><tbody>${rows.map(r=>'<tr>'+r.map(x=>'<td>'+e(x)+'</td>').join('')+'</tr>').join('')}</tbody></table></div>`;
  function pageData(ctx){
    const d=root.ProjectManagementInsights.data(ctx),view=d.project?ctx.filters.projectManagerView:ctx.filters.personManagerView;
    if(ctx.filters.managerOnlyRisk==='risk'&&(!view||view==='overview'||view==='alerts')){const ids=new Set(root.ProjectManagementInsights.warnings(d).map(a=>a.entityId));d.rows=d.rows.filter(r=>ids.has(r.id));d.entities=d.entities.filter(r=>ids.has(r.id));}return d;
  }
  let host,current,pageKey='',painted=null;
  const session=()=>{if(!sessions.has(pageKey))sessions.set(pageKey,{open:false,messages:[],draft:'',spec:null,basis:'',revision:0,pending:null,busy:false,token:0});return sessions.get(pageKey);};
  function scope(ctx,d){const view=d.project?ctx.filters.projectManagerView:ctx.filters.personManagerView;return {title:d.project?'项目分析':'项目人效分析',period:(d.cumulative?'累计至 ':'')+d.month+(d.cumulative?'':' · 当月'),range:d.project?[d.selectedTeam==='all'?'全部团队':d.selectedTeam,d.selection==='all'?'全部项目':clean(d.entities[0]?.name||'无匹配项目')].join(' · '):[d.selectedRole==='all'?'全部角色':d.selectedRole,d.selection==='all'?'全部人员':d.entities[0]?.name||'无匹配人员'].join(' · '),view:view==='accounting'?'核算明细':view==='efficiency'?'人效明细':'管理驾驶舱'};}
  const fingerprint=(ctx,d)=>JSON.stringify([ctx.page,ctx.month,ctx.state.revision,d.cumulative,d.selectedRole,d.selectedTeam,d.selection,d.entities.map(x=>x.id)]);
  function interpret(text,previous,d){
    const follow=/^(再|继续|那|这些|它们|其中|只看|只保留|改为|换成|按|把|为什么|给.*建议|与上月)/.test(text),spec=follow&&previous?{...previous,conditions:[...previous.conditions]}:{topic:'overview',metric:d.project?'income':'incomeHour',asc:false,limit:5,conditions:[],ids:null};
    const metricFor=label=>/净利率|利润率/.test(label)?'margin':/净利润|税后利润|利润/.test(label)?'net':/回款缺口|资金缺口/.test(label)?'cashGap':/覆盖率/.test(label)?'cashRate':/利用率|饱和度/.test(label)?'util':/小时.*产出|小时.*交付/.test(label)?'incomeHour':/投入产出/.test(label)?'roi':/集中度/.test(label)?'concentration':/成本|费用/.test(label)?'cost':'income';
    const named=d.rows.filter(r=>text.includes(clean(r.entity.name))||text.includes(r.entity.name)||clean(r.entity.name).length>=4&&text.includes(clean(r.entity.name).slice(0,4)));if(named.length)spec.ids=named.map(r=>r.id);
    if(/预警|风险|关注|短板|接续|安排|负荷|过载/.test(text))spec.topic='risk';
    if(/回款|资金|应收/.test(text)){spec.topic='ranking';spec.metric=/覆盖率/.test(text)?'cashRate':'cashGap';}
    if(/人效|效率|产能|利用率|饱和度|小时产出|投入产出/.test(text)){spec.topic='ranking';spec.metric=metricFor(text);if(spec.metric==='income')spec.metric='util';}
    if(/成本|费用/.test(text)){spec.topic=/构成|结构|占比|分布|拆分/.test(text)?'cost':'ranking';spec.metric='cost';}
    if(/排名|排序|排行|最高|最低|前[一二三四五六七八九十\d]|从高到低|从低到高/.test(text)){spec.topic='ranking';spec.metric=metricFor(text);}
    const sort=text.match(/按(.+?)(?:排序|排名|排|从|升序|降序|$)/);if(sort){spec.metric=metricFor(sort[1]);spec.topic='ranking';}
    if(/对比上月|与上月|比上月|环比|月度趋势/.test(text))spec.topic='compare';
    spec.asc=/最低|从低到高|升序/.test(text)?true:/最高|从高到低|降序/.test(text)?false:spec.asc;
    const count=text.match(/(?:前|最多|列出|给我)\s*([一二三四五六七八九十]|\d+)\s*(?:个|位|名|项|条)?/);if(count)spec.limit=Math.max(1,Math.min(20,Number(count[1])||'一二三四五六七八九十'.indexOf(count[1])+1));
    if(/亏损/.test(text))spec.conditions.push({key:'net',op:'<',value:0});
    const re=/(净利率|利润率|税后利润|净利润|利润|交付金额|交付|总成本|成本|回款缺口|覆盖率|工时利用率|利用率|饱和度|小时产出|投入产出比|集中度)\s*(?:为|在)?\s*(低于|小于|不足|少于|不超过|高于|大于|超过|至少|不低于|>=|<=|>|<|≥|≤)\s*(-?\d+(?:\.\d+)?)\s*(%|％|万元|万|元|倍)?/g;
    for(const match of text.matchAll(re)){const key=metricFor(match[1]),ratio=['margin','cashRate','util','concentration'].includes(key),value=Number(match[3])*(ratio||/[%％]/.test(match[4]||'')?.01:/万/.test(match[4]||'')?10000:1),op=/不超过|<=|≤/.test(match[2])?'<=':/至少|不低于|>=|≥/.test(match[2])?'>=':/低于|小于|不足|少于|</.test(match[2])?'<':'>';spec.conditions.push({key,op,value});if(spec.topic==='overview')spec.topic='ranking';}
    return spec;
  }
  function answer(ctx,text,previous){
    const d=pageData(ctx),all=d.rows,info=scope(ctx,d),basis=fingerprint(ctx,d),spec=interpret(text,previous,d);
    if(!all.length)return {html:'<p>当前筛选范围没有可分析的数据，请先调整页面筛选。</p>',spec,basis,scope:info};
    if(/同比|去年|明年|下个月|下月预测/.test(text))return {html:'<p>当前 Demo 提供 2026-09 至 2026-11 的核算数据，尚无去年同期或未来排期，无法据此计算同比或预测。可以继续查看当前范围的月度变化与风险。</p>',spec,basis,scope:info};
    const outside=(d.project?ctx.state.projects:ctx.state.people).find(x=>(text.includes(clean(x.name))||text.includes(x.name))&&!all.some(r=>r.id===x.id));if(outside)return {html:`<p>“${e(clean(outside.name))}”不在当前页面筛选范围内。请先在页面中切换${d.project?'团队或项目':'角色或人员'}，再继续分析。</p>`,spec,basis,scope:info};
    if(!/分析|页面|经营|概览|总结|表现|风险|预警|关注|原因|为什么|建议|成本|费用|交付|收入|利润|回款|应收|资金|人效|效率|产能|工时|利用率|饱和度|产出|集中度|接续|排序|排名|对比|上月|低于|高于|亏损|这些|它们|继续/.test(text)&&!spec.ids)return {html:'<p>当前 Demo 支持经营概览、风险建议、成本构成、上月对比，以及按金额、利润率、利用率等条件筛选和排序。可以试着问：“净利率低于15%的项目，按交付金额排序”。</p>',spec,basis,scope:info};
    const compare=(actual,c)=>actual!=null&&(c.op==='<'?actual<c.value:c.op==='>'?actual>c.value:c.op==='<='?actual<=c.value:actual>=c.value);
    let rows=all.filter(r=>(!spec.ids||spec.ids.includes(r.id))&&spec.conditions.every(c=>compare(c.key==='net'&&!r.complete?null:r[c.key],c)));
    const filters=spec.conditions.map(c=>names[c.key]+' '+c.op+' '+format(c.key,c.value)).join('；'),preamble=`<p class="aa-result-range">当前 ${all.length} ${d.project?'个项目':'位人员'}${filters?'，条件：'+e(filters):''}，匹配 ${rows.length} ${d.project?'个':'位'}。</p>`;
    if(!rows.length)return {html:preamble+'<p>当前范围没有符合条件的记录。可调整阈值或直接询问整体表现。</p>',spec,basis,scope:info};
    const alerts=root.ProjectManagementInsights.warnings({...d,rows}),partial=rows.filter(r=>!r.complete),income=add(rows,'income'),net=add(rows,'net'),hours=add(rows,'hours');let html=preamble;
    if(spec.topic==='cost'){
      const costs=Object.entries(rows.reduce((sum,r)=>{Object.entries(r.costs).forEach(([k,v])=>sum[k]=(sum[k]||0)+v);return sum;},{})).sort((a,b)=>b[1]-a[1]),total=costs.reduce((n,[,v])=>n+v,0);
      html+=`<h4>成本构成</h4><p>已录入成本合计 <b>${m(total)}</b> 元，不含所得税。</p>`+table(['成本项目','金额（元）','占比'],costs.map(([k,v])=>[costNames[k]||k,m(v),total?p(v/total):'—']));
    }else if(spec.topic==='compare'){
      html+='<h4>所选月与上月对照</h4>'+table([d.project?'项目':'人员','本月交付','上月交付','交付差额','净利差额'],rows.slice(0,spec.limit).map(r=>[clean(r.entity.name),m(r.now.income),r.previous?m(r.previous.income):'无上月数据',r.previous?m(r.now.income-r.previous.income):'—',r.previous&&r.complete&&!r.previous.missing.some(x=>!x.includes('无法测算'))?m(r.now.net-r.previous.net):'待补齐']));
      if(d.cal.partial)html+='<p class="aa-caveat">本月尚未结束，以上仅解释与上月整月的差值，不据此判断增长或下降。</p>';
    }else if(spec.topic==='ranking'){
      const unavailable=d.project&&['util','roi','concentration'].includes(spec.metric);if(unavailable)html+='<p>该指标属于人员分析口径，请到“项目人效分析”中查看。当前可比较项目交付、利润、成本和回款。</p>';
      else {const valid=rows.filter(r=>(spec.metric!=='net'||r.complete)&&r[spec.metric]!=null).sort((a,b)=>(spec.asc?1:-1)*(a[spec.metric]-b[spec.metric]));html+=`<h4>按${names[spec.metric]}${spec.asc?'从低到高':'从高到低'}</h4>`+table([d.project?'项目':'人员',names[spec.metric],'交付金额','税后利润'],valid.slice(0,spec.limit).map(r=>[clean(r.entity.name),format(spec.metric,r[spec.metric]),m(r.income),r.complete?m(r.net):'待补齐']));if(valid.length<rows.length)html+=`<p class="aa-caveat">${rows.length-valid.length} 条因必要数据或分母不足，未参与此项排名。</p>`;if(!valid.length)html+='<p>当前没有具备完整计算依据的记录，建议先补齐必要输入。</p>';}
    }else{
      html+=`<h4>${spec.topic==='risk'?'需要优先关注':'当前范围概览'}</h4><div class="aa-metrics"><div><span>交付金额</span><b>${m(income)}</b></div><div><span>税后利润</span><b>${partial.length?'待补齐':m(net)}</b></div><div><span>项目工时</span><b>${hours}h</b></div></div>`;
      if(d.project)html+=`<p>累计交付回款缺口 <b>${m(add(rows,'cashGap'))}</b> 元，${rows.filter(r=>r.complete&&r.net<0).length} 个项目利润为负。</p>`;
      else html+=`<p>合计已过标准工时 ${add(rows,'standard')}h，项目工时利用率 ${add(rows,'standard')?p(hours/add(rows,'standard')):'—'}。人员成本与收入按个人全部项目核算。</p>`;
    }
    if(alerts.length){html+='<h4>依据与行动建议</h4><ol class="aa-actions">'+alerts.slice(0,Math.min(3,spec.limit)).map(a=>`<li><b>${e(clean(a.name))} · ${e(a.title)}</b><p>${e(a.evidence)}</p><span>${e(a.action)}</span></li>`).join('')+'</ol>';}else html+='<p>当前范围未触发既有预警规则，可继续关注交付节奏与投入变化。</p>';
    if(partial.length)html+=`<p class="aa-caveat">${partial.length} ${d.project?'个项目':'位人员'}缺少必要输入，相关利润不作确定结论；当前月份 ${d.cal.partial?'尚未结束，利润含整月固定成本':'已完成'}。</p>`;
    if(d.project&&/回款|应收|逾期/.test(text))html+='<p class="aa-caveat">回款缺口不等同逾期；当前没有合同账期数据。</p>';
    html+='<div class="aa-diagnose-links">'+rows.slice(0,3).map(r=>`<button type="button" data-action="manager-diagnose" data-id="${e(r.id)}">查看${e(clean(r.entity.name))}诊断 ↗</button>`).join('')+'</div>';
    return {html,spec,basis,scope:info};
  }
  function ensure(){
    if(host)return;host=document.createElement('div');host.id='analysis-ai-root';host.hidden=true;
    host.innerHTML=`<button type="button" class="aa-launcher" data-aa="open" aria-label="打开AI龙虾分析" aria-expanded="false" title="AI龙虾 · 分析当前页面"><span aria-hidden="true">🦞</span><small>AI</small></button><aside class="aa-drawer" id="analysis-ai-drawer" role="region" aria-label="AI龙虾分析对话" hidden><header class="aa-header"><span class="aa-avatar" aria-hidden="true">🦞</span><div><h2>AI 龙虾</h2><small>当前页面分析助手</small></div><button type="button" data-aa="clear" aria-label="清空当前页面对话" title="清空对话">↺</button><button type="button" data-aa="close" aria-label="收起AI龙虾">×</button></header><div class="aa-context"></div><div class="aa-history" role="log" aria-live="polite" aria-relevant="additions"></div><footer class="aa-footer"><div class="aa-followups"></div><form class="aa-composer"><textarea rows="2" maxlength="1500" aria-label="向AI龙虾提问" placeholder="例如：净利率低于15%的项目，按交付金额排序"></textarea><div><label class="aa-file-picker">＋ 选择Excel<input type="file" accept=".xlsx" aria-label="选择导入核算Excel"></label><small>模拟分析</small><button type="submit" aria-label="发送分析问题" disabled>发送 ↑</button></div></form></footer></aside>`;document.body.append(host);
    host.addEventListener('input',event=>{if(event.target.matches('textarea')){session().draft=event.target.value;host.querySelector('[type="submit"]').disabled=session().busy||!session().draft.trim();}});
    host.querySelector('[type="file"]').onchange=event=>{const file=event.target.files[0];event.target.value='';if(file)importFile(file);};
    host.addEventListener('keydown',event=>{if(event.key==='Escape'&&session().open){event.preventDefault();session().open=false;draw();host.querySelector('.aa-launcher').focus();}if(event.target.matches('textarea')&&event.key==='Enter'&&!event.shiftKey&&!event.isComposing){event.preventDefault();send();}});
    host.querySelector('form').onsubmit=event=>{event.preventDefault();send();};
    host.addEventListener('click',event=>{const button=event.target.closest('[data-aa]');if(!button)return;const action=button.dataset.aa,s=session();if(action==='open'){s.open=true;draw();host.querySelector('textarea').focus();}if(action==='close'){s.open=false;draw();host.querySelector('.aa-launcher').focus();}if(action==='clear'){s.messages=[];s.spec=null;s.basis='';s.pending=null;s.token++;s.busy=false;s.revision++;draw();}if(action==='prompt')send(button.dataset.prompt);if(action==='download'){const file=s.messages[Number(button.dataset.message)]?.file;if(file)current.aiImport.download(file);}});
  }
  function draw(){
    if(!current||host.hidden)return;const s=session(),d=pageData(current),info=scope(current,d),changed=!!s.basis&&s.basis!==fingerprint(current,d);host.querySelector('.aa-launcher').hidden=s.open;host.querySelector('.aa-launcher').setAttribute('aria-expanded',String(s.open));host.querySelector('.aa-drawer').hidden=!s.open;
    host.querySelector('.aa-context').innerHTML=`<div><i></i><b>${e(info.title)}</b><span>${e(info.period)}</span></div><p>${e(info.range)} · ${e(info.view)} · ${d.rows.length}${d.project?'个项目':'位人员'}</p>${changed?'<small>筛选已更新，下次提问使用当前范围</small>':''}`;
    const prompts=d.project?['分析当前页面','找出风险并给出行动建议','按净利率从低到高排序']:['分析当前页面的人效短板','按小时产出从高到低排序','哪些人员需要关注项目接续'];
    if(current.role==='finance')prompts.push('导入核算数据');
    if(painted!==pageKey+':'+s.revision){const history=host.querySelector('.aa-history');history.innerHTML=s.messages.length?s.messages.map(msg=>`<article class="aa-message ${msg.user?'user':'assistant'}">${msg.user?'':'<span class="aa-message-label">🦞 AI 龙虾</span>'}<div class="aa-bubble">${msg.user?'<p>'+e(msg.text)+'</p>':msg.html+(msg.file?`<div class="aa-excel-attachment"><span>X</span><div><b>${e(msg.file.filename)}</b><small>人员固定成本 · 项目核算数据</small></div><button type="button" data-aa="download" data-message="${s.messages.indexOf(msg)}">下载</button></div>`:'')}</div>${msg.scope?`<small class="aa-message-scope">${e(msg.scope.title+' · '+msg.scope.period+' · '+msg.scope.range)}</small>`:''}</article>`).join(''):`<div class="aa-welcome"><span>🦞</span><h3>一起看看经营表现</h3><p>已带入当前页面数据。可以指定对象、阈值和排序，也可以继续追问原因与建议。</p><div>${prompts.map(text=>`<button type="button" data-aa="prompt" data-prompt="${e(text)}">${e(text)} <span>↗</span></button>`).join('')}</div></div>`;history.scrollTop=history.scrollHeight;painted=pageKey+':'+s.revision;}
    host.querySelector('.aa-followups').innerHTML=s.messages.length?(s.pending?['确认导入','取消导入']:['再按交付金额从高到低排序','与上月对比',...(current.role==='finance'?['导入核算数据']:[])]).map(text=>`<button type="button" data-aa="prompt" data-prompt="${e(text)}">${e(text)}</button>`).join(''):'';
    const input=host.querySelector('textarea');if(input.value!==s.draft)input.value=s.draft;input.placeholder=d.project?'例如：净利率低于15%的项目，按交付金额排序':'例如：利用率低于60%的人员，分析原因并给建议';host.querySelector('[type="submit"]').disabled=s.busy||!s.draft.trim();host.querySelector('[type="submit"]').textContent=s.busy?'处理中…':'发送 ↑';host.querySelector('.aa-file-picker').hidden=current.role!=='finance';host.querySelector('[type="file"]').disabled=s.busy;
  }
  function send(prompt){
    const s=session(),text=String(prompt??s.draft).trim();if(!text||s.busy)return;if(/导入|上传|模板|确认写入|^确认$|^取消[。！!\s]*$/.test(text)){importChat(text);return;}const snapshot={...current,filters:{...current.filters}},d=pageData(snapshot),basis=fingerprint(snapshot,d);s.messages.push({user:true,text});s.draft='';
    try{const result=answer(snapshot,text,s.basis===basis?s.spec:null);s.messages.push(result);s.spec=result.spec;s.basis=result.basis;}catch{s.messages.push({html:'<p>本次分析未能完成，请调整页面筛选后重试。</p>',scope:scope(snapshot,d)});}s.revision++;draw();host.querySelector('textarea').focus();
  }
  const importNames={salary:'固定人工',bonus:'人员奖金',commission:'项目提成',exception:'异常费用',fixed:'固定分摊'};
  function append(s,msg){s.messages.push(msg);s.revision++;if(current&&session()===s)draw();}
  async function importFile(file){
    const s=session();if(s.busy)return;const api=current.aiImport,role=current.role;if(role!=='finance')return;const token=++s.token;s.busy=true;s.pending=null;append(s,{user:true,text:'上传文件：'+file.name});
    try{const preview=await api.preview(file);if(token!==s.token)return;s.pending=preview;const rows=preview.groups.flatMap(g=>g.rows.filter(r=>r.kind!=='skip').map(r=>[importNames[g.type],r.personId?current?.state.people.find(x=>x.id===r.personId)?.name||r.personId:current?.state.projects.find(x=>x.id===r.projectId)?.name||r.projectId,r.oldValue==null?'无记录':m(r.oldValue),m(r.newValue),r.error||'待确认']));
      append(s,{html:'<h4>导入校验 · '+e(preview.month)+'</h4><p>'+e(preview.sourceFile)+'，共 '+rows.length+' 条变更。'+(preview.errors.length?'存在异常，暂不可导入：'+e(preview.errors.join('；')):'尚未写入，请核对差异后回复“确认导入”或“取消导入”。')+'</p>'+table(['类型','人员 / 项目','原金额','新金额','校验'],rows)+'<p class="aa-caveat">空白金额保持原值，0覆盖为0；已结月份和过期模板禁止导入。导入按Excel中的全部已填行处理。</p>'});
    }catch(error){if(token===s.token)append(s,{html:'<p class="aa-caveat">'+e(error.message)+'</p>'});}finally{if(token===s.token){s.busy=false;if(current&&session()===s)draw();}}
  }
  async function importChat(text){
    const s=session(),snapshot=current,api=current.aiImport;if(s.busy)return;append(s,{user:true,text});s.draft='';if(current.role!=='finance'){append(s,{html:'<p>当前身份可查看分析，导入核算数据需要财务管理员权限。</p>'});return;}
    if(/^取消/.test(text)){s.pending=null;append(s,{html:'<p>已取消导入，核算数据未改变。</p>'});return;}
    if(/^确认/.test(text)){try{if(!s.pending)throw Error('请先选择填写后的Excel，核对导入差异');api.confirm(s.pending);s.pending=null;s.spec=null;s.basis='';append(s,{html:'<p>核算数据导入成功，已刷新当前分析页面。文件来源和导入批次已记录，可以继续询问导入后的经营表现。</p>'});}catch(error){append(s,{html:'<p class="aa-caveat">'+e(error.message)+'</p>'});}return;}
    const token=++s.token;s.pending=null;s.busy=true;draw();try{const file=await api.template(snapshot.month);if(token!==s.token)return;append(s,{html:'<p>这是 '+e(snapshot.month)+' 的核算Excel，含两个Sheet：人员固定成本、项目核算数据，覆盖固定人工、奖金、提成、异常费用和固定成本分摊。</p><p>填写黄色金额列，保存后点下方“选择Excel”上传。校验后在本对话确认导入。</p>',file});}catch(error){if(token===s.token)append(s,{html:'<p class="aa-caveat">'+e(error.message)+'</p>'});}finally{if(token===s.token){s.busy=false;if(current&&session()===s)draw();}}
  }
  function sync(ctx){
    ensure();if(!['project-analysis','person-analysis'].includes(ctx.page)||ctx.role==='employee'){host.hidden=true;current=null;return;}
    const changed=pageKey!==ctx.page;pageKey=ctx.page;current={...ctx,filters:{...ctx.filters}};host.hidden=false;if(changed)painted=null;draw();
  }
  root.ProjectAnalysisAI={sync,answer};
})(window);
