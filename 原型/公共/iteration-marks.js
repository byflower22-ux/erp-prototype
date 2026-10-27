/* ERP iteration annotations. No framework, network request or business-state dependency. */
(function (global) {
  'use strict';
  const TYPES={new:'新增',improved:'优化',rule:'规则'};
  function validateConfig(config) {
    const errors=[];
    if(!config || typeof config.id!=='string' || !config.id || !Array.isArray(config.versions) || !config.versions.length || !Array.isArray(config.marks)) return ['需要 id、versions 与 marks'];
    const versions=new Set(), ids=new Set();
    for(const version of config.versions) {
      if(!version || typeof version.id!=='string' || !version.id || !version.label || versions.has(version.id)) errors.push('迭代编号缺失或重复');
      else versions.add(version.id);
    }
    for(const mark of config.marks) {
      if(!mark || typeof mark.id!=='string' || !mark.id || ids.has(mark.id)) {errors.push('标记编号缺失或重复');continue;}
      ids.add(mark.id);
      if(!versions.has(mark.version)) errors.push(mark.id+' 的迭代不存在');
      if(!Object.hasOwn(TYPES,mark.type)) errors.push(mark.id+' 的类型无效');
      if(typeof mark.title!=='string' || !mark.title || typeof mark.page!=='string' || !mark.page) errors.push(mark.id+' 缺少标题或页面');
      if(mark.selector!==undefined && typeof mark.selector!=='string') errors.push(mark.id+' 的 selector 无效');
      if(mark.scope!==undefined&&!['page','menu'].includes(mark.scope))errors.push(mark.id+' 的标记范围无效');
      if(mark.module!==undefined&&typeof mark.module!=='string')errors.push(mark.id+' 的模块无效');
      if(mark.documents!==undefined && (!Array.isArray(mark.documents) || mark.documents.some(d=>!d || typeof d.title!=='string' || typeof d.url!=='string'))) errors.push(mark.id+' 的资料无效');
    }
    return errors;
  }
  function selectMarks(config,version='all',page) {
    return config.marks.filter(mark=>(version==='all'||mark.version===version)&&(page===undefined||mark.page===page));
  }
  function safeDocumentURL(value,base) {
    if(typeof value!=='string' || !value.trim() || /^[\s]*(?:[a-z][a-z\d+.-]*:|[/\\])/i.test(value)&&!/^https?:/i.test(value)) return null;
    try {const url=new URL(value,base);return ['http:','https:','file:'].includes(url.protocol)?url.href:null;} catch {return null;}
  }
  const api={validateConfig,selectMarks,safeDocumentURL};
  if(typeof module==='object' && module.exports) module.exports=api;
  if(!global?.document) return;
  global.ERPIterationMarks=api;
  const css=`
    :host{display:block;position:sticky;top:0;z-index:90;color:#303746;font:13px/1.5 "Microsoft YaHei",sans-serif;text-align:left}
    *{box-sizing:border-box}[hidden]{display:none!important}button,select,a{font:inherit}button,select{border:1px solid #d9dde5;border-radius:5px;background:#fff;color:#394353;min-height:30px;padding:4px 11px}button{cursor:pointer}button:hover{background:#f5f7fa}button:focus-visible,select:focus-visible,a:focus-visible,summary:focus-visible{outline:2px solid #c82936;outline-offset:2px}
    .bar{display:flex;align-items:center;gap:12px;flex-wrap:wrap;padding:9px 24px;background:#fff;border-bottom:1px solid #e1e5ec;box-shadow:0 2px 4px #172b4d05}
    .brand{font-weight:700;display:flex;align-items:center;gap:7px}.brand i{width:9px;height:9px;border:2px solid #c82936;transform:rotate(45deg)}
    .toggle[aria-pressed=true]{color:#b92332;border-color:#e8b2b9;background:#fff4f4}.muted{color:#7c8595;font-size:12px}.count{margin-right:auto}.legend{display:flex;gap:12px;color:#687284;font-size:12px}.legend span:before{content:'';display:inline-block;width:6px;height:6px;border-radius:50%;margin-right:5px;background:var(--tone)}
    .new{--tone:#197750}.improved{--tone:#b66a0b}.rule{--tone:#516bc2}
    .layer{position:fixed;inset:0;pointer-events:none;z-index:1;overflow:hidden}
    .outline{position:absolute;border:1px dashed var(--tone);border-radius:4px;pointer-events:none;background:transparent}
    .pin{position:absolute;pointer-events:auto;min-height:22px;height:22px;min-width:23px;padding:0 6px;border:1px solid var(--tone);color:var(--tone);background:#fff;box-shadow:0 1px 4px #1f29371a;font-size:11px;font-weight:700;border-radius:4px;line-height:20px;white-space:nowrap}.pin:hover{background:#fff8ec}.pin:focus-visible{outline:2px solid var(--tone)}
    .outline.highlighted{border:2px solid var(--tone);background:transparent}
    :host([compact]){position:static}:host([compact]) .bar{padding:0;border:0;box-shadow:none;gap:6px;flex-wrap:nowrap;background:transparent}:host([compact]) .brand,:host([compact]) .count,:host([compact]) .legend,:host([compact]) .list-button{display:none}:host([compact]) .bar>button{font-size:12px;white-space:nowrap}:host([compact]) .bar>select{font-size:12px;max-width:158px}
    dialog{position:fixed;inset:0 0 0 auto;width:min(480px,100vw);height:100dvh;max-width:100vw;max-height:100dvh;margin:0;border:0;padding:0;background:#f5f6f8;color:#303746;box-shadow:-8px 0 36px #10182820;font:13px/1.6 "Microsoft YaHei",sans-serif}
    dialog::backdrop{background:#10182838}.drawer{height:100%;display:flex;flex-direction:column}.head{padding:22px 24px 16px;border-bottom:1px solid #e0e4ec;background:#fff;display:flex;align-items:flex-start;justify-content:space-between;gap:12px}.eyebrow{font-size:11px;letter-spacing:1px;color:#8a93a2}.head h2{font-size:20px;margin:3px 0 4px}.close{font-size:22px;line-height:24px;padding:0 8px}.scopes{display:flex;gap:8px;padding:14px 24px;background:#fff;border-bottom:1px solid #e0e4ec}.scopes [aria-pressed=true]{background:#fff1f2;color:#b92332;border-color:#e8b2b9}.cards{overflow:auto;flex:1;padding:18px 24px}.card{border:1px solid #e0e4ec;border-radius:8px;background:#fff;margin-bottom:12px;padding:16px}.card.selected{border-color:var(--tone);box-shadow:0 0 0 1px var(--tone)}.meta{display:flex;align-items:center;gap:8px;font-size:11px;color:#7c8595}.type{color:var(--tone);border:1px solid currentColor;border-radius:3px;padding:0 5px}.card h3{font-size:14px;line-height:1.6;margin:8px 0}.description{white-space:pre-wrap;color:#566171;margin:8px 0 12px}.links{display:flex;flex-wrap:wrap;gap:8px 12px;margin:10px 0}a{color:#b92332;text-decoration:none}a:hover{text-decoration:underline}.locate{margin-top:5px}.foot{padding:12px 24px;border-top:1px solid #e0e4ec;background:#fff;font-size:11px;color:#7c8595}.empty{padding:50px 12px;text-align:center;color:#7c8595}.error{padding:9px 24px;background:#fff1f2;color:#b92332}
    @media(max-width:800px){.bar{padding:8px 12px;gap:8px}.legend,.count{display:none}.bar select{max-width:210px}}
    @media print{:host{display:none}}
    .config-button{color:#b92332;border-color:#e8b2b9}
    dialog.editor{inset:4vh auto auto 50%;transform:translateX(-50%);width:min(1120px,96vw);height:92dvh;border-radius:10px;overflow:hidden}
    .editor .head{padding:18px 24px 14px}.editor .head h2{font-size:19px}
    .editor-tools{display:flex;gap:8px;flex-wrap:wrap;align-items:center;padding:10px 24px;background:#fff;border-bottom:1px solid #e0e4ec}
    .editor-tools .local-note{margin-right:auto;color:#7c8595;font-size:12px}
    .editor-body{display:grid;grid-template-columns:260px minmax(0,1fr);min-height:0;flex:1}
    .editor-list{background:#f8f9fb;border-right:1px solid #e0e4ec;display:flex;flex-direction:column;min-height:0;padding:16px 12px;gap:10px}
    input,textarea{font:inherit;color:#303746;border:1px solid #d9dde5;border-radius:5px;padding:7px 9px;background:#fff;min-width:0}input:focus,textarea:focus{outline:2px solid #f0b5bc;outline-offset:1px}textarea{resize:vertical}
    .editor-list input{width:100%}.mark-list{overflow:auto;flex:1}.mark-row{display:block;width:100%;text-align:left;margin-bottom:7px;padding:10px 11px}.mark-row b{display:block;font-size:12px;font-weight:500}.mark-row small{display:block;color:#7c8595;margin-top:4px;font-size:11px}.mark-row[aria-current=true]{border-color:#d94754;background:#fff1f2;color:#b92332}
    .editor-main{overflow:auto;padding:18px 24px;background:#fff}.editor-form{display:grid;grid-template-columns:1fr 1fr;gap:14px 16px}.field{display:flex;flex-direction:column;gap:6px;min-width:0}.field>span{font-weight:600;font-size:12px}.field.wide{grid-column:1/-1}.field small{font-size:11px;color:#7c8595;font-weight:400}.field textarea{min-height:82px}.field select{padding:7px 9px}.region-actions,.doc-actions{display:flex;gap:8px;flex-wrap:wrap;align-items:center}.region-actions small{color:#7c8595}.doc-row{display:grid;grid-template-columns:140px 1fr auto;gap:8px;margin-bottom:8px}.doc-row input{width:100%}
    .version-manager{padding:12px 14px;border:1px solid #e0e4ec;border-radius:6px;background:#f8f9fb;margin-bottom:18px}.version-manager summary{cursor:pointer;font-weight:600}.version-fields{display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-top:12px}.version-fields .wide{grid-column:1/-1}.version-actions{display:flex;gap:8px;flex-wrap:wrap;margin-top:12px}
    .editor-foot{padding:12px 24px;background:#fff;border-top:1px solid #e0e4ec;display:flex;align-items:center;gap:8px}.editor-status{margin-right:auto;color:#647083;font-size:12px;line-height:1.6}.editor-status[data-error=true]{color:#b92332}.primary{background:#c82936;color:#fff;border-color:#c82936}.primary:hover{background:#b92332}.danger{color:#b92332}
    .pick-box{position:fixed;pointer-events:none;border:2px solid #c82936;background:#c829360b;z-index:2}.pick-banner{position:fixed;left:50%;transform:translateX(-50%);width:max-content;max-width:95vw;background:#fff;border:1px solid #e8b2b9;box-shadow:0 4px 24px #172b4d25;border-radius:8px;padding:12px 16px;display:flex;align-items:center;gap:10px;z-index:3;flex-wrap:wrap}.pick-banner span{font-size:12px;max-width:420px}.pick-banner button{white-space:nowrap}
    @media(max-width:800px){dialog.editor{width:98vw;height:98dvh;top:1vh}.editor-body{grid-template-columns:190px minmax(0,1fr)}.editor-main{padding:12px}.editor-form{grid-template-columns:1fr}.field{grid-column:1/-1}.doc-row{grid-template-columns:1fr auto}.doc-row input:nth-child(2){grid-column:1;grid-row:2}.doc-row button{grid-column:2;grid-row:1/3}.editor-tools,.editor-foot{padding:10px 12px}.editor-foot{flex-wrap:wrap}.editor-status{width:100%}}
  `;
  const element=(tag,attrs={},text)=>{const node=document.createElement(tag);for(const [key,value] of Object.entries(attrs))node.setAttribute(key,String(value));if(text!==undefined)node.textContent=text;return node;};
  const clone=value=>JSON.parse(JSON.stringify(value));
  const intersects=(a,b,gap=0)=>a.left<b.right+gap&&a.right>b.left-gap&&a.top<b.bottom+gap&&a.bottom>b.top-gap;
  // Keep the original anchor and only move a badge when it covers visible text or another badge.
  const nearbyOffsets=[];
  for(let y=-120;y<=120;y+=4)for(let x=-120;x<=120;x+=4)if(x*x+y*y<=120*120)nearbyOffsets.push({x,y});
  nearbyOffsets.sort((a,b)=>a.x*a.x+a.y*a.y-b.x*b.x-b.y*b.y||a.y-b.y);
  function visibleObstacles(root){
    const boxes=[],clips=new Map(),visibility=new Map();
    const clipFor=node=>{
      if(!node)return {left:0,right:innerWidth,top:0,bottom:innerHeight};
      if(clips.has(node))return clips.get(node);
      const clip={...clipFor(node.parentElement)},style=getComputedStyle(node),r=node.getBoundingClientRect();
      if(/auto|scroll|hidden|clip/.test(style.overflowX)){clip.left=Math.max(clip.left,r.left);clip.right=Math.min(clip.right,r.right);}
      if(/auto|scroll|hidden|clip/.test(style.overflowY)){clip.top=Math.max(clip.top,r.top);clip.bottom=Math.min(clip.bottom,r.bottom);}
      clips.set(node,clip);return clip;
    };
    const add=(rect,node)=>{const c=clipFor(node),r={left:Math.max(c.left,rect.left),right:Math.min(c.right,rect.right),top:Math.max(c.top,rect.top),bottom:Math.min(c.bottom,rect.bottom)};if(r.right>r.left&&r.bottom>r.top)boxes.push(r);};
    const walker=document.createTreeWalker(root,NodeFilter.SHOW_TEXT);
    while(walker.nextNode()){
      const node=walker.currentNode,parent=node.parentElement;
      if(!node.textContent.trim()||['SCRIPT','STYLE'].includes(parent.tagName))continue;
      if(!visibility.has(parent))visibility.set(parent,parent.checkVisibility({visibilityProperty:true,contentVisibilityAuto:true}));
      if(!visibility.get(parent))continue;
      const range=document.createRange();range.selectNodeContents(node);for(const r of range.getClientRects())add(r,parent);
    }
    for(const control of root.querySelectorAll('input,select,textarea,[contenteditable=true]'))if(control.checkVisibility())add(control.getBoundingClientRect(),control);
    return boxes;
  }
  function nearbyPosition(origin,width,height,bounds,obstacles,occupied){
    const x=Math.min(bounds.right-width,Math.max(bounds.left,origin.x)),y=Math.min(bounds.bottom-height,Math.max(bounds.top,origin.y));
    const local=obstacles.filter(r=>intersects(r,{left:x-124,right:x+width+124,top:y-124,bottom:y+height+124}));
    for(const offset of nearbyOffsets){
      const r={left:x+offset.x,right:x+offset.x+width,top:y+offset.y,bottom:y+offset.y+height};
      if(r.left<bounds.left||r.right>bounds.right||r.top<bounds.top||r.bottom>bounds.bottom)continue;
      if(!local.some(box=>intersects(r,box,2))&&!occupied.some(box=>intersects(r,box,3)))return r;
    }
    return null;
  }
  // Prefer stable IDs / data attributes. Structural paths are a fallback for legacy prototypes.
  function selectorFor(target,root){
    const unique=selector=>{try{return root.querySelectorAll(selector).length===1&&root.querySelector(selector)===target;}catch{return false;}};
    const path=[];
    for(let node=target;node&&node!==root;node=node.parentElement){
      let part=node.localName;
      if(node.id){const id='#'+CSS.escape(node.id);if(unique(id))return id;part=id;}
      else {
        for(const name of ['data-action','data-page','data-field','data-testid','name'])if(node.hasAttribute(name)){part+='['+name+'="'+CSS.escape(node.getAttribute(name))+'"]';}
        if(part===node.localName){const classes=Array.from(node.classList).filter(c=>!/(?:^|-)(?:active|selected|current|open|hidden|dirty|hover)(?:$|-)/.test(c));part+=classes.slice(0,2).map(c=>'.'+CSS.escape(c)).join('');}
      }
      if(!path.length&&unique(part))return part;
      if(node.parentElement){const siblings=Array.from(node.parentElement.children).filter(n=>n.localName===node.localName);if(siblings.length>1)part+=':nth-of-type('+(siblings.indexOf(node)+1)+')';}
      path.unshift(part);const selector=path.join(' > ');if(unique(selector))return selector;
    }
    return ':scope > '+path.join(' > ');
  }
  class MarksEditor {
    constructor(host){
      this.host=host;this.dirty=false;
      this.dialog=element('dialog',{class:'editor','aria-label':'配置版本标记'});
      // Static template only. All configuration text is assigned through values/textContent.
      this.dialog.innerHTML=`<div class="drawer">
        <div class="head"><div><div class="eyebrow">ERP · CONFIGURATION</div><h2>配置版本标记</h2><div class="muted">选择页面区域，填写本次迭代的变化说明</div></div><button type="button" class="close" aria-label="关闭配置">×</button></div>
        <div class="editor-tools"><span class="local-note">保存到当前浏览器 · 导出后可转交配置</span><button type="button" data-command="import">导入配置</button><button type="button" data-command="json">导出 JSON</button><button type="button" data-command="script">导出配置脚本</button><button type="button" data-command="restore">恢复项目配置</button><input type="file" accept=".json,application/json" aria-label="导入标记配置文件" hidden></div>
        <div class="editor-body"><aside class="editor-list"><button type="button" class="primary" data-command="new" aria-label="新增标记">＋ 新增标记</button><input type="search" aria-label="搜索标记" placeholder="搜索标题、迭代或页面"><div class="region-actions"><button type="button" data-command="move-up">↑ 上移</button><button type="button" data-command="move-down">↓ 下移</button></div><small class="muted">选中标记后调整，排序立即保存；搜索时请先清空搜索。</small><div class="mark-list"></div></aside>
        <section class="editor-main"><details class="version-manager"><summary>管理迭代</summary><div class="version-fields"><label class="field wide"><span>已有迭代</span><select aria-label="已有迭代"></select></label><label class="field"><span>迭代编号</span><input aria-label="迭代编号" placeholder="如 ERP-I005"></label><label class="field"><span>迭代名称</span><input aria-label="迭代名称" placeholder="如 预算优化"></label></div><div class="version-actions"><button type="button" data-command="new-version">新增迭代</button><button type="button" data-command="save-version">保存迭代</button><button type="button" data-command="delete-version" class="danger">删除迭代</button></div></details>
        <form class="editor-form">
          <label class="field scope-field"><span>标记范围 *</span><select name="scope" aria-label="标记范围"><option value="page">页面区域</option><option value="menu">菜单区域</option></select></label>
          <label class="field scope-field"><span>所属模块</span><select name="module" aria-label="所属模块"></select></label>
          <label class="field"><span>所属迭代 *</span><select name="version" aria-label="所属迭代" required></select></label>
          <label class="field"><span>标记类型 *</span><select name="type" aria-label="标记类型"><option value="new">新增</option><option value="improved">优化</option><option value="rule">规则</option></select></label>
          <label class="field wide"><span>标记标题 *</span><input name="title" aria-label="标记标题" required placeholder="简要描述这个区域的变化"></label>
          <label class="field"><span>所属页面 *</span><input name="page" aria-label="所属页面" required list="erp-mark-pages"></label>
          <label class="field"><span>页面名称</span><input name="pageLabel" aria-label="页面名称" placeholder="如 月度预算执行"></label>
          <datalist id="erp-mark-pages"></datalist>
          <div class="field wide"><span>页面区域</span><div class="region-actions"><button type="button" data-command="pick">选择页面区域</button><button type="button" data-command="clear-region">清除区域</button><small>不选区域可保存为纯规则说明</small></div><input name="selector" aria-label="区域选择器" placeholder="点选后自动生成，也可手工调整"><small>请先关闭面板并进入目标页面，再打开配置点选；区域只匹配业务内容。</small></div>
          <label class="field wide"><span>变更说明</span><textarea name="description" aria-label="变更说明" rows="4" placeholder="填写变化内容、交互或业务规则"></textarea></label>
          <label class="field wide"><span>交付说明</span><input name="delivery" aria-label="交付说明" placeholder="如 原型可演示，正式接口待联调"></label>
          <div class="field wide"><span>关联资料</span><div class="document-fields"></div><div><button type="button" data-command="add-doc">添加资料</button></div></div>
        </form></section></div>
        <div class="editor-foot"><div class="editor-status" role="status" aria-live="polite"></div><button type="button" class="danger" data-command="delete">删除标记</button><button type="button" class="primary" data-command="save">保存标记</button></div></div>`;
      this.form=this.dialog.querySelector('form');this.status=this.dialog.querySelector('[role=status]');this.list=this.dialog.querySelector('.mark-list');this.docs=this.dialog.querySelector('.document-fields');
      for(const label of this.dialog.querySelectorAll('.scope-field'))label.hidden=!host.options.scopes;
      for(const module of host.options.modules||[{id:'budget',label:'预算管理'}])this.field('module').append(element('option',{value:module.id},module.label));
      this.field('scope').addEventListener('change',()=>{this.field('selector').value='';this.applyScope(true);this.dirty=true;});
      this.dialog.querySelector('.close').addEventListener('click',()=>this.close());
      this.dialog.addEventListener('cancel',e=>{e.preventDefault();e.stopPropagation();this.close();});
      this.dialog.addEventListener('keydown',e=>e.stopPropagation());
      this.dialog.addEventListener('input',e=>{if(this.form.contains(e.target))this.dirty=true;});
      this.form.addEventListener('submit',e=>{e.preventDefault();this.saveMark();});
      this.dialog.querySelector('[aria-label="搜索标记"]').addEventListener('input',()=>this.renderList());
      this.dialog.querySelector('[aria-label="已有迭代"]').addEventListener('change',e=>this.loadVersion(e.target.value));
      this.dialog.querySelector('input[type=file]').addEventListener('change',e=>this.importFile(e.target));
      this.dialog.addEventListener('click',e=>{
        const command=e.target.closest('[data-command]')?.dataset.command;if(!command)return;
        const commands={new:()=>this.newMark(),save:()=>this.saveMark(),delete:()=>this.deleteMark(),pick:()=>this.startPick(),'move-up':()=>this.moveMark(-1),'move-down':()=>this.moveMark(1),'clear-region':()=>{this.field('selector').value='';this.dirty=true;},'add-doc':()=>{this.addDoc();this.dirty=true;},'new-version':()=>this.loadVersion(''),'save-version':()=>this.saveVersion(),'delete-version':()=>this.deleteVersion(),json:()=>this.download('json'),script:()=>this.download('script'),import:()=>this.dialog.querySelector('input[type=file]').click(),restore:()=>this.restore()};
        commands[command]?.();
      });
      host.shadowRoot.append(this.dialog);
    }
    field(name){return this.form.elements.namedItem(name);}
    applyScope(reset=false){
      if(!this.host.options.scopes)return;
      const menu=this.field('scope').value==='menu';this.field('page').readOnly=menu;this.field('module').disabled=menu;
      if(reset){this.field('page').value=menu?'navigation':this.host.page;this.field('pageLabel').value=menu?'公共菜单':this.host.page;}
    }
    message(text,error=false){this.status.textContent=text;this.status.dataset.error=String(error);}
    discard(){return !this.dirty||global.confirm('当前标记有未保存修改，放弃这些修改？');}
    open(){this.renderVersions();this.renderList();this.loadMark(this.host.config.marks.find(m=>m.page===this.host.page)||this.host.config.marks[0]);this.message('修改后点击“保存标记”。本地配置优先于项目默认配置。');this.dialog.showModal();}
    close(){if(this.discard()){this.dirty=false;this.dialog.close();}}
    renderVersions(){
      const selected=this.field('version').value;
      for(const select of [this.field('version'),this.dialog.querySelector('[aria-label="已有迭代"]')]){select.replaceChildren();for(const version of this.host.config.versions)select.append(element('option',{value:version.id},version.id+' · '+version.label));}
      if(this.host.config.versions.some(v=>v.id===selected))this.field('version').value=selected;
      this.loadVersion(this.host.config.versions.at(-1).id);
      const pages=this.dialog.querySelector('datalist');pages.replaceChildren();for(const page of new Set([this.host.page,...this.host.config.marks.map(m=>m.page)]))pages.append(element('option',{value:page}));
    }
    renderList(){
      const search=this.dialog.querySelector('[type=search]').value.trim().toLowerCase();this.list.replaceChildren();
      const index=this.host.config.marks.findIndex(mark=>mark.id===this.editingId);
      this.dialog.querySelector('[data-command=move-up]').disabled=Boolean(search)||index<=0;
      this.dialog.querySelector('[data-command=move-down]').disabled=Boolean(search)||index<0||index>=this.host.config.marks.length-1;
      for(const mark of this.host.config.marks){if(search&&!JSON.stringify([mark.title,mark.version,mark.pageLabel,mark.page]).toLowerCase().includes(search))continue;
        const button=element('button',{type:'button',class:'mark-row','aria-label':'编辑标记：'+mark.title,'aria-current':String(mark.id===this.editingId)});button.append(element('b',{},String(this.host.config.marks.indexOf(mark)+1).padStart(2,'0')+' '+mark.title),element('small',{},mark.version+' · '+TYPES[mark.type]+' · '+(mark.pageLabel||mark.page)));
        button.addEventListener('click',()=>{if(this.discard()){this.loadMark(mark);this.message('编辑后点击“保存标记”。');}});this.list.append(button);
      }
      if(!this.list.children.length)this.list.append(element('div',{class:'empty'},'暂无匹配的标记'));
    }
    moveMark(direction){
      if(this.dialog.querySelector('[type=search]').value.trim())return;
      const config=clone(this.host.config),index=config.marks.findIndex(mark=>mark.id===this.editingId),next=index+direction;
      if(index<0||next<0||next>=config.marks.length)return;
      [config.marks[index],config.marks[next]]=[config.marks[next],config.marks[index]];
      const saved=this.host.commitConfig(config);this.renderList();
      this.list.querySelector('[aria-current=true]')?.scrollIntoView({block:'nearest'});
      this.message((saved?'排序已保存到当前浏览器，序号已更新。':'排序仅本次预览有效，请导出配置。')+(this.dirty?'当前标记内容尚未保存。':''),!saved);
    }
    loadMark(mark){
      this.editingId=mark?.id||null;this.original=mark?clone(mark):{};this.form.reset();
      const value=mark||{version:this.host.version==='all'?this.host.config.versions.at(-1).id:this.host.version,type:'improved',page:this.host.page,pageLabel:this.host.config.marks.find(m=>m.page===this.host.page)?.pageLabel||this.host.page};
      for(const key of ['version','type','title','page','pageLabel','selector','description','delivery'])this.field(key).value=value[key]||'';
      this.field('scope').value=value.scope||'page';this.field('module').value=value.module||this.host.options.getModule?.()||'budget';this.applyScope();
      this.docs.replaceChildren();for(const doc of value.documents||[])this.addDoc(doc);
      this.dirty=false;this.dialog.querySelector('[data-command=delete]').disabled=!mark;this.renderList();
    }
    newMark(){if(!this.discard())return;this.loadMark(null);this.message('填写标题，点选页面区域；纯规则可不选区域。');this.field('title').focus();}
    addDoc(doc={}){
      const row=element('div',{class:'doc-row'}),title=element('input',{'aria-label':'资料名称',placeholder:'资料名称'}),url=element('input',{'aria-label':'资料地址',placeholder:'相对 ERP 根目录的路径或 https:// 地址'}),remove=element('button',{type:'button','aria-label':'移除此资料'},'移除');
      title.value=doc.title||'';url.value=doc.url||'';remove.addEventListener('click',()=>{row.remove();this.dirty=true;});row.append(title,url,remove);this.docs.append(row);
    }
    saveMark(){
      if(!this.form.reportValidity())return;
      const mark={...this.original,id:this.editingId||'mark-'+Date.now().toString(36)+'-'+Math.random().toString(36).slice(2,7)};
      for(const key of ['version','type','title','page','pageLabel','description','delivery'])mark[key]=this.field(key).value.trim();
      if(this.host.options.scopes){mark.scope=this.field('scope').value;if(mark.scope==='menu'){mark.page='navigation';delete mark.module;}else mark.module=this.field('module').value;}
      const selector=this.field('selector').value.trim();delete mark.selector;
      if(selector){try{this.host.root.querySelector(selector);}catch{this.message('区域选择器格式无效，请重新点选。',true);return;}mark.selector=selector;}
      mark.documents=[];
      for(const row of this.docs.children){const [title,url]=row.querySelectorAll('input');if(!title.value.trim()&&!url.value.trim())continue;if(!title.value.trim()||!safeDocumentURL(url.value.trim(),this.host.options.documentBase||document.baseURI)){this.message('请填写资料名称和有效的相对路径或 HTTP(S) 地址。',true);return;}mark.documents.push({title:title.value.trim(),url:url.value.trim()});}
      const config=clone(this.host.config),index=config.marks.findIndex(m=>m.id===mark.id);if(index>=0)config.marks[index]=mark;else config.marks.push(mark);
      const errors=validateConfig(config);if(errors.length){this.message(errors.join('；'),true);return;}
      const saved=this.host.commitConfig(config);this.host.version=mark.version;this.host.select.value=mark.version;this.host.enabled=true;this.host.save();this.host.refresh();
      this.loadMark(mark);this.message(saved?'已保存到当前浏览器，标记已即时生效。':'已生效，但仅应用于本次预览；浏览器不允许本地保存，请导出配置。',!saved);
    }
    deleteMark(){
      if(!this.editingId||!global.confirm('删除当前标记？保存过的内容可通过导入配置恢复。'))return;
      const config=clone(this.host.config);config.marks=config.marks.filter(m=>m.id!==this.editingId);const saved=this.host.commitConfig(config);this.loadMark(config.marks[0]);this.message(saved?'已删除标记并保存到当前浏览器。':'已删除，仅应用于本次预览；请导出配置。',!saved);
    }
    loadVersion(id){
      this.versionId=id;const version=this.host.config.versions.find(v=>v.id===id);
      this.dialog.querySelector('[aria-label="已有迭代"]').value=id;
      const field=this.dialog.querySelector('[aria-label="迭代编号"]');field.value=version?.id||'';field.readOnly=Boolean(version);this.dialog.querySelector('[aria-label="迭代名称"]').value=version?.label||'';
    }
    saveVersion(){
      const id=this.dialog.querySelector('[aria-label="迭代编号"]').value.trim(),label=this.dialog.querySelector('[aria-label="迭代名称"]').value.trim();
      if(!id||!label){this.message('请填写迭代编号和名称。',true);return;}
      if(!this.versionId&&this.host.config.versions.some(v=>v.id===id)){this.message('该迭代编号已存在。',true);return;}
      const config=clone(this.host.config),index=config.versions.findIndex(v=>v.id===this.versionId);if(index>=0)config.versions[index]={id,label};else config.versions.push({id,label});
      const saved=this.host.commitConfig(config);this.renderVersions();this.loadVersion(id);this.renderList();this.message(saved?'已保存迭代。':'迭代仅应用于本次预览；请导出配置。',!saved);
    }
    deleteVersion(){
      if(!this.versionId)return;
      if(this.host.config.marks.some(m=>m.version===this.versionId)){this.message('该迭代仍有关联标记，请先删除或调整标记所属迭代。',true);return;}
      if(this.host.config.versions.length===1){this.message('至少保留一个迭代。',true);return;}
      if(!global.confirm('删除这个没有关联标记的迭代？'))return;
      const config=clone(this.host.config);config.versions=config.versions.filter(v=>v.id!==this.versionId);const saved=this.host.commitConfig(config);this.renderVersions();this.message(saved?'已删除迭代。':'迭代删除仅应用于本次预览；请导出配置。',!saved);
    }
    download(format){
      if(this.dirty){this.message('当前标记有未保存修改，请先保存再导出。',true);return;}
      const json=JSON.stringify(this.host.config,null,2),script=format==='script';
      const globalName=this.host.options.configGlobal||'ERPIterationConfig';
      const text=script?'window['+JSON.stringify(globalName)+'] = '+json.replace(/</g,'\\u003c')+';\n':json;
      const url=URL.createObjectURL(new Blob([text],{type:script?'text/javascript;charset=utf-8':'application/json;charset=utf-8'})),a=element('a',{href:url,download:this.host.config.id+(script?'-iteration-marks.js':'-iteration-marks.json')});this.dialog.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),1000);this.message('已导出已保存的配置。');
    }
    async importFile(input){
      const file=input.files?.[0];if(!file)return;
      try{if(file.size>2*1024*1024)throw Error('文件超过 2 MB');const config=JSON.parse(await file.text()),errors=validateConfig(config);if(errors.length)throw Error(errors.join('；'));if(config.id!==this.host.config.id)throw Error('不属于当前模块，请选择当前模块导出的 JSON');
        if(!this.discard()||!global.confirm('导入将替换当前模块的全部标记配置，是否继续？'))return;
        const saved=this.host.commitConfig(config);this.renderVersions();this.loadMark(config.marks[0]);this.message(saved?'已导入并保存到当前浏览器。':'已导入，仅应用于本次预览；请导出配置。',!saved);
      }catch(error){this.message('导入失败：'+error.message,true);}finally{input.value='';}
    }
    restore(){
      if(!global.confirm('恢复项目内的默认标记配置？当前浏览器中的自定义配置将被替换。'))return;
      const saved=this.host.commitConfig(this.host.defaultConfig);this.renderVersions();this.loadMark(this.host.config.marks[0]);this.message(saved?'已恢复项目配置并保存到当前浏览器。':'已恢复项目配置，但仅应用于本次预览。',!saved);
    }
    startPick(){
      if(this.host.options.pickRegion?.(this))return;
      this.dialog.close();this.picking=true;this.locked=false;this.candidate=null;this.pickHistory=[];this.host.refresh();
      this.box=element('div',{class:'pick-box','aria-hidden':'true'});this.box.hidden=true;
      this.banner=element('div',{class:'pick-banner',role:'region','aria-label':'选择标记区域'});this.banner.style.top=this.host.getBoundingClientRect().bottom+10+'px';
      this.pickText=element('span',{},'移动鼠标查看区域，点击选中；Esc 取消。');
      const button=(label,callback)=>{const b=element('button',{type:'button'},label);b.addEventListener('click',callback);return b;};
      this.parentButton=button('上一级区域',()=>{const parent=this.candidate?.parentElement;if(parent&&parent!==this.host.root&&this.host.root.contains(parent)){this.pickHistory.push(this.candidate);this.candidate=parent;this.locked=true;this.drawPick();}});
      this.childButton=button('返回下一级',()=>{if(this.pickHistory.length){this.candidate=this.pickHistory.pop();this.drawPick();}});
      this.confirmButton=button('使用此区域',()=>this.finishPick(true));this.confirmButton.className='primary';
      this.banner.append(this.pickText,this.parentButton,this.childButton,this.confirmButton,button('取消选择',()=>this.finishPick(false)));this.host.shadowRoot.append(this.box,this.banner);this.drawPick();
      this.move=e=>{if(!this.locked&&e.target!==this.host.root){this.candidate=e.target;this.drawPick();}};
      this.click=e=>{e.preventDefault();e.stopImmediatePropagation();if(e.target!==this.host.root){this.candidate=e.target;this.locked=true;this.pickHistory=[];this.drawPick();}};
      this.key=e=>{if(e.key==='Escape'){e.preventDefault();e.stopImmediatePropagation();this.finishPick(false);}};
      this.reposition=()=>this.drawPick();
      this.host.root.addEventListener('pointermove',this.move,true);this.host.root.addEventListener('click',this.click,true);window.addEventListener('keydown',this.key,true);document.addEventListener('scroll',this.reposition,true);window.addEventListener('resize',this.reposition);
    }
    drawPick(){
      if(!this.picking)return;const target=this.candidate;
      this.parentButton.disabled=!target||target.parentElement===this.host.root;this.childButton.disabled=!this.pickHistory.length;this.confirmButton.disabled=!target||!this.locked;
      if(!target)return;
      const r=target.getBoundingClientRect();this.box.hidden=false;Object.assign(this.box.style,{left:r.left+'px',top:r.top+'px',width:r.width+'px',height:r.height+'px'});
      this.pickText.textContent=(this.locked?'已选中：':'预览：')+target.localName+(target.textContent.trim().replace(/\s+/g,' ').slice(0,28)?' · '+target.textContent.trim().replace(/\s+/g,' ').slice(0,28):'')+(this.locked?'，可扩大到上一级。':'，点击选中。');
    }
    finishPick(apply,reopen=true){
      if(!this.picking)return;
      if(this.externalPick){this.externalPick=false;this.picking=false;this.host.refresh();if(reopen)this.dialog.showModal();return;}
      if(apply&&this.candidate){this.field('selector').value=selectorFor(this.candidate,this.host.root);this.field('page').value=this.host.options.scopes&&this.field('scope').value==='menu'?'navigation':this.host.page;this.dirty=true;}
      this.picking=false;this.host.root.removeEventListener('pointermove',this.move,true);this.host.root.removeEventListener('click',this.click,true);window.removeEventListener('keydown',this.key,true);document.removeEventListener('scroll',this.reposition,true);window.removeEventListener('resize',this.reposition);this.box.remove();this.banner.remove();this.candidate=null;this.host.refresh();
      if(this.remotePick){this.remotePick=false;this.host.options.onPicked?.(apply?{selector:this.field('selector').value,page:this.field('page').value}:null);return;}
      if(reopen){this.dialog.showModal();this.message(apply?'区域已选择，保存标记后生效。':'已取消选择，原标记内容保留。');}
    }
    destroy(){this.finishPick(false,false);this.dialog.close();this.dialog.remove();}
  }
  class IterationMarks extends HTMLElement {
    constructor(){super();this.attachShadow({mode:'open'});this.enabled=false;this.version='all';this.scope='all';this.targets=[];this.frame=0;this.schedule=()=>{if(!this.frame)this.frame=requestAnimationFrame(()=>{this.frame=0;this.refresh();});};}
    configure(config,options={}) {
      this.stop();
      this.editor?.destroy();this.editor=null;this.config=null;this.toggle=null;
      const errors=validateConfig(config);
      this.shadowRoot.replaceChildren(element('style',{},css));
      if(errors.length){this.shadowRoot.append(element('div',{class:'error',role:'status'},'版本标记配置有误：'+errors.join('；')));return;}
      this.defaultConfig=clone(config);this.config=clone(config);this.options=options;this.root=options.root||document.querySelector('main')||document.body;
      this.storageKey='erp-iteration-marks:'+config.id;
      this.toggleAttribute('compact',Boolean(options.compact));
      try{const stored=options.storage===false?null:JSON.parse(localStorage.getItem(this.storageKey+':config')||'null');if(stored?.id===config.id&&!validateConfig(stored).length)this.config=stored;}catch{/* no local overrides */}
      this.version=config.versions.at(-1).id;this.enabled=false;
      this.version=this.config.versions.at(-1).id;
      try{const saved=options.storage===false?null:JSON.parse(localStorage.getItem(this.storageKey)||'null');if(saved){this.enabled=saved.enabled===true;if(saved.version==='all'||this.config.versions.some(v=>v.id===saved.version))this.version=saved.version;}}catch{/* file preview may deny storage */}
      this.build();if(this.isConnected)this.start();this.refresh();
    }
    connectedCallback(){if(this.config)this.start();}
    disconnectedCallback(){this.editor?.finishPick(false,false);this.editor?.dialog.close();this.stop();}
    start(){
      if(this.observer)return;
      this.observer=new MutationObserver(this.schedule);this.observer.observe(this.root,{childList:true,subtree:true,attributes:true,attributeFilter:['data-erp-page','hidden','class','style','open']});
      this.resizeObserver=new ResizeObserver(this.schedule);this.resizeObserver.observe(this.root);
      window.addEventListener('resize',this.schedule);document.addEventListener('scroll',this.schedule,true);
      this.schedule();
    }
    stop(){this.observer?.disconnect();this.observer=null;this.resizeObserver?.disconnect();window.removeEventListener('resize',this.schedule);document.removeEventListener('scroll',this.schedule,true);this.root?.removeAttribute('data-erp-marks-visible');cancelAnimationFrame(this.frame);this.frame=0;}
    save(){if(this.options.storage!==false)try{localStorage.setItem(this.storageKey,JSON.stringify({enabled:this.enabled,version:this.version}));}catch{}}
    commitConfig(config){
      this.config=clone(config);if(this.version!=='all'&&!this.config.versions.some(v=>v.id===this.version))this.version=this.config.versions.at(-1).id;
      this.select.replaceChildren(element('option',{value:'all'},'全部迭代'));for(const version of this.config.versions)this.select.append(element('option',{value:version.id},version.id+' · '+version.label));this.select.value=this.version;this.save();this.refresh();if(this.dialog.open)this.renderCards();
      this.dispatchEvent(new CustomEvent('erp-marks-change',{detail:{config:clone(this.config)},bubbles:true}));
      if(this.options.storage===false)return true;
      try{localStorage.setItem(this.storageKey+':config',JSON.stringify(this.config));return true;}catch{return false;}
    }
    get page(){return this.options.getPage?.()||this.root.dataset.erpPage||location.hash.slice(1)||'overview';}
    build(){
      const bar=element('div',{class:'bar','aria-label':'迭代版本标记'});
      const brand=element('span',{class:'brand'});brand.append(element('i',{'aria-hidden':'true'}),document.createTextNode('版本标记'));
      this.toggle=element('button',{type:'button',class:'toggle'});
      this.toggle.addEventListener('click',()=>{this.enabled=!this.enabled;this.save();this.refresh();});
      this.select=element('select',{'aria-label':'筛选迭代版本'});
      this.select.append(element('option',{value:'all'},'全部迭代'));
      for(const version of this.config.versions)this.select.append(element('option',{value:version.id},version.id+' · '+version.label));
      this.select.value=this.version;this.select.addEventListener('change',()=>{this.version=this.select.value;this.selected=null;this.save();this.refresh();if(this.dialog.open)this.renderCards();});
      this.counter=element('span',{class:'muted count',role:'status'});
      const legend=element('span',{class:'legend'});for(const [type,label] of Object.entries(TYPES))legend.append(element('span',{class:type},label));
      this.listButton=element('button',{type:'button',class:'list-button'});this.listButton.addEventListener('click',()=>this.open());
      const configure=element('button',{type:'button',class:'config-button'},'配置'+(this.options.scopeName||'')+'标记');configure.addEventListener('click',()=>{if(!this.editor)this.editor=new MarksEditor(this);this.editor.open();});
      bar.append(brand,this.toggle,this.select,this.counter,legend,this.listButton,configure);
      bar.hidden=this.options.toolbar===false;
      this.layer=element('div',{class:'layer','aria-label':'页面变更标记'});
      this.dialog=element('dialog',{'aria-label':'版本变更说明'});const drawer=element('div',{class:'drawer'});
      const head=element('div',{class:'head'}),title=element('div');title.append(element('div',{class:'eyebrow'},'ERP · ITERATION'),element('h2',{},'版本变更说明'),element('div',{class:'muted'},'按迭代追溯本次优化范围与关联资料'));
      const close=element('button',{class:'close',type:'button','aria-label':'关闭变更说明'},'×');close.addEventListener('click',()=>this.dialog.close());head.append(title,close);
      const scopes=element('div',{class:'scopes'});this.scopeButtons=['all','page'].map(scope=>{const b=element('button',{type:'button'},scope==='all'?'整个迭代':'当前页面');b.addEventListener('click',()=>{this.scope=scope;this.selected=null;this.renderCards();});scopes.append(b);return b;});
      this.cards=element('div',{class:'cards'});drawer.append(head,scopes,this.cards,element('div',{class:'foot'},'标记仅辅助原型评审；实际交付范围与验收以需求及测试资料为准。'));this.dialog.append(drawer);
      this.dialog.addEventListener('cancel',e=>e.stopPropagation());
      this.dialog.addEventListener('keydown',e=>e.stopPropagation());
      this.dialog.addEventListener('close',()=>{this.selected=null;this.schedule();});
      this.shadowRoot.append(bar,this.layer,this.dialog);
    }
    marks(page){return selectMarks(this.config,this.version).filter(mark=>page===undefined|| (this.options.includeOnPage?this.options.includeOnPage(mark,page):mark.page===page));}
    getEditor(){if(!this.editor)this.editor=new MarksEditor(this);return this.editor;}
    refresh(){
      if(!this.config||!this.toggle)return;
      this.options.onRefresh?.(this);
      this.toggle.textContent=(this.enabled?'隐藏':'显示')+(this.options.scopeName||'')+'标记';this.toggle.setAttribute('aria-pressed',String(this.enabled));
      const current=this.marks(this.page);this.counter.textContent='本页 '+current.length+' 项'+(this.enabled?' · 可见 '+this.targets.length+' 处':'');this.listButton.textContent='全部变更（'+this.marks().length+'）';
      this.layer.replaceChildren();this.targets=[];
      this.root.toggleAttribute('data-erp-marks-visible',this.enabled&&!this.editor?.picking);
      if(!this.enabled||this.editor?.picking){this.options.onRendered?.(this);return;}
      const rootRect=this.root.getBoundingClientRect();
      if(!rootRect.width||!rootRect.height){this.options.onRendered?.(this);return;}
      const top=this.options.compact?Math.max(0,rootRect.top):Math.max(0,this.getBoundingClientRect().bottom);
      const obstacles=visibleObstacles(this.root),occupied=[];
      const bounds={left:Math.max(2,rootRect.left),right:Math.min(innerWidth-2,rootRect.right),top:top+2,bottom:innerHeight-2};
      current.forEach(mark=>{
        if(this.options.renderMark&&!this.options.renderMark(mark))return;
        if(!mark.selector)return;
        let target;try{target=this.root.querySelector(mark.selector);}catch{return;}
        if(!target || !target.getClientRects().length||!target.checkVisibility({visibilityProperty:true,contentVisibilityAuto:true}))return;
        let r=target.getBoundingClientRect();let left=Math.max(2,r.left),right=Math.min(innerWidth-2,r.right),y=Math.max(top+2,r.top),bottom=Math.min(innerHeight-2,r.bottom);
        for(let parent=target.parentElement;parent&&parent!==document.body;parent=parent.parentElement){const style=getComputedStyle(parent),p=parent.getBoundingClientRect();if(/auto|scroll|hidden|clip/.test(style.overflowX)){left=Math.max(left,p.left);right=Math.min(right,p.right);}if(/auto|scroll|hidden|clip/.test(style.overflowY)){y=Math.max(y,p.top);bottom=Math.min(bottom,p.bottom);}}
        if(right-left<8||bottom-y<8)return;
        const outline=element('div',{class:'outline '+mark.type,'aria-hidden':'true'});Object.assign(outline.style,{left:left+'px',top:y+'px',width:right-left+'px',height:bottom-y+'px'});
        const number=String(this.config.marks.indexOf(mark)+1).padStart(2,'0');
        const pin=element('button',{type:'button',class:'pin '+mark.type,'data-mark':mark.id,'aria-label':mark.version+' '+TYPES[mark.type]+'：'+mark.title,title:mark.title},right-left>180&&!this.options.compact?TYPES[mark.type]+' · '+number:number);
        const highlight=active=>outline.classList.toggle('highlighted',active);
        pin.addEventListener('pointerenter',()=>highlight(true));pin.addEventListener('pointerleave',()=>highlight(false));pin.addEventListener('focus',()=>highlight(true));pin.addEventListener('blur',()=>highlight(false));
        pin.addEventListener('click',()=>this.open(mark.id));this.layer.append(outline,pin);
        let size=pin.getBoundingClientRect();
        const origin={x:right-left>600?left+12:right-size.width,y:y-10};
        let position=nearbyPosition(origin,size.width,size.height,bounds,obstacles,occupied);
        if(!position&&pin.textContent!==number){pin.textContent=number;size=pin.getBoundingClientRect();position=nearbyPosition(origin,size.width,size.height,bounds,obstacles,occupied);}
        if(position){Object.assign(pin.style,{left:position.left+'px',top:position.top+'px'});occupied.push(position);}else pin.remove();
        this.targets.push({mark,target});
      });
      this.counter.textContent='本页 '+current.length+' 项 · 可见 '+(this.targets.length+(this.options.getExternalCount?.()||0))+' 处';this.options.onRendered?.(this);
    }
    open(id){if(this.options.onOpen){this.options.onOpen(id);return;}this.selected=id||null;this.scope='all';this.renderCards();if(!this.dialog.open)this.dialog.showModal();if(id)requestAnimationFrame(()=>Array.from(this.cards.children).find(c=>c.dataset.id===id)?.scrollIntoView({block:'nearest'}));}
    renderCards(){
      this.cards.replaceChildren();this.scopeButtons.forEach((b,i)=>b.setAttribute('aria-pressed',String(this.scope===(i?'page':'all'))));
      const marks=this.marks(this.scope==='page'?this.page:undefined);
      if(!marks.length){this.cards.append(element('div',{class:'empty'},'当前范围暂无变更标记'));return;}
      for(const mark of marks){
        const card=element('article',{class:'card '+mark.type+(this.selected===mark.id?' selected':''),'data-id':mark.id});
        const meta=element('div',{class:'meta'});meta.append(element('span',{class:'type'},TYPES[mark.type]),element('span',{},mark.version),element('span',{},mark.pageLabel||mark.page));
        if(this.options.scopes)meta.append(element('span',{},mark.scope==='menu'?'菜单区域':'页面区域'));
        card.append(meta,element('h3',{},String(this.config.marks.indexOf(mark)+1).padStart(2,'0')+' '+mark.title),element('p',{class:'description'},mark.description||''));
        if(mark.delivery)card.append(element('div',{class:'muted'},mark.delivery));
        const links=element('div',{class:'links'});
        for(const doc of mark.documents||[]){const url=safeDocumentURL(doc.url,this.options.documentBase||document.baseURI);if(url)links.append(element('a',{href:url,target:'_blank',rel:'noopener noreferrer'},doc.title));}
        card.append(links);
        if(mark.selector){const locate=element('button',{class:'locate',type:'button'},mark.page===this.page?'定位此处':'前往页面');locate.addEventListener('click',()=>this.locate(mark));card.append(locate);}
        this.cards.append(card);
      }
    }
    locate(mark){
      this.dialog.close();
      if(this.options.locate?.(mark))return;
      if(this.options.navigate)this.options.navigate(mark.page,mark);
      else if(mark.page!==this.page)this.dispatchEvent(new CustomEvent('erp-mark-navigate',{detail:{page:mark.page,mark},bubbles:true}));
      requestAnimationFrame(()=>{let target;try{target=this.root.querySelector(mark.selector);}catch{/* invalid selector stays isolated */}if(target){target.scrollIntoView({block:'center',inline:'nearest',behavior:'instant'});this.enabled=true;this.save();this.refresh();const pin=Array.from(this.layer.querySelectorAll('.pin')).find(p=>p.dataset.mark===mark.id);pin?.focus({preventScroll:true});}else{this.counter.textContent='当前视图未展示该区域，请切换后查看';this.dispatchEvent(new CustomEvent('erp-mark-unavailable',{detail:{mark},bubbles:true}));}});
    }
  }
  if(!customElements.get('erp-iteration-marks'))customElements.define('erp-iteration-marks',IterationMarks);
})(typeof window==='object'?window:null);
