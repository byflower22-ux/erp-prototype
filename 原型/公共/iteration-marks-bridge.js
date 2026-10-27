/* Cooperating renderers keep a single UI across file:// iframe boundaries. */
(function(){
  'use strict';
  const protocol='erp-iteration-marks-v1',copy=value=>JSON.parse(JSON.stringify(value));
  function migrate(element){
    try{
      if(localStorage.getItem(element.storageKey+':config'))return;
      const hasUnifiedPreference=localStorage.getItem(element.storageKey)!==null;
      const read=id=>{const value=JSON.parse(localStorage.getItem('erp-iteration-marks:'+id+':config')||'null');return value?.id===id&&!ERPIterationMarks.validateConfig(value).length?value:null;};
      const page=read('budget-optimization'),menu=read('erp-navigation'),config=copy(element.config);
      if(page){config.marks=config.marks.filter(m=>m.scope!=='page'||m.module!=='budget');config.marks.unshift(...page.marks.map(m=>({...m,scope:'page',module:'budget'})));config.versions.push(...page.versions);}
      if(menu){config.marks=config.marks.filter(m=>m.scope!=='menu');config.marks.push(...menu.marks.map(m=>({...m,scope:'menu'})));config.versions.push(...menu.versions);}
      config.versions=[...new Map(config.versions.map(v=>[v.id,v])).values()];
      const ids=new Set();for(const mark of config.marks){while(ids.has(mark.id))mark.id='legacy-'+mark.id;ids.add(mark.id);}
      if((page||menu)&&!ERPIterationMarks.validateConfig(config).length)element.commitConfig(config);
      const saved=JSON.parse(localStorage.getItem('erp-iteration-marks:budget-optimization')||localStorage.getItem('erp-iteration-marks:erp-navigation')||'null');
      if(saved&&!hasUnifiedPreference){element.enabled=saved.enabled===true;if(saved.version==='all'||element.config.versions.some(v=>v.id===saved.version)){element.version=saved.version;element.select.value=saved.version;}element.save();}
    }catch{/* Browsers without local storage still support this preview. */}
  }
  function host({element,frames,getActive,navigate}){
    const renderers=new Map(),pages=new Map();let picking=null;
    const send=(module,data)=>frames[module]?.contentWindow.postMessage({protocol,...data},'*');
    const activeModule=()=>getActive()?.module;
    function sync(force=false){
      for(const [module,renderer] of renderers){
        const data={type:'state',config:element.config,version:element.version,enabled:element.enabled&&module===activeModule()&&!element.editor?.picking};
        const key=JSON.stringify(data);if(force||key!==renderer.last){renderer.last=key;send(module,data);}
      }
    }
    function cancelPick(){if(!picking)return;send(picking.module,{type:'cancel-pick',request:picking.request});const editor=picking.editor;picking=null;editor.finishPick(false);editor.message('已取消选择，原标记内容保留。');}
    element.configure(window.ERPVersionMarks,{
      root:document.querySelector('nav'),scopes:true,modules:[{id:'budget',label:'预算管理'}],
      configGlobal:'ERPVersionMarks',documentBase:new URL('./',location.href).href,
      getPage:()=>pages.get(activeModule())||getActive()?.nav||'overview',getModule:()=> 'budget',
      getExternalCount:()=>renderers.get(activeModule())?.count||0,
      includeOnPage:(mark,page)=>mark.scope==='menu'||mark.module===activeModule()&&mark.page===page,
      renderMark:mark=>mark.scope==='menu',onRefresh:()=>sync(),
      locate(mark){
        if(mark.scope==='menu'){document.body.classList.remove('nav-collapsed');const toggle=document.getElementById('toggle-nav');toggle.setAttribute('aria-expanded','true');toggle.setAttribute('aria-label','折叠导航');let target;try{target=document.querySelector('nav').querySelector(mark.selector);}catch{}for(let p=target?.parentElement;p;p=p.parentElement)if(p.tagName==='DETAILS')p.open=true;return false;}
        if(!mark.module)return false;
        navigate(mark.module);const renderer=renderers.get(mark.module);if(renderer)send(mark.module,{type:'locate',id:mark.id});else pendingLocate.set(mark.module,mark.id);return true;
      },
      pickRegion(editor){
        if(editor.field('scope').value==='menu')return false;
        const module=editor.field('module').value;
        if(module!==activeModule()||!renderers.has(module)){editor.message('请先进入对应模块的目标页面，再选择页面区域。',true);return true;}
        editor.dialog.close();editor.picking=true;editor.externalPick=true;
        const request=Date.now().toString(36)+Math.random().toString(36).slice(2);picking={module,request,editor};element.refresh();send(module,{type:'pick',request});frames[module].focus();return true;
      }
    });
    const pendingLocate=new Map();migrate(element);element.refresh();
    window.addEventListener('message',event=>{
      const module=Object.keys(frames).find(key=>frames[key].contentWindow===event.source),data=event.data;
      if(!module||data?.protocol!==protocol)return;
      if(data.type==='ready'){
        renderers.set(module,{last:null});if(typeof data.page==='string')pages.set(module,data.page);sync(true);
        if(pendingLocate.has(module)){send(module,{type:'locate',id:pendingLocate.get(module)});pendingLocate.delete(module);}
      }
      if(data.type==='page'&&typeof data.page==='string'){pages.set(module,data.page);element.refresh();}
      if(data.type==='rendered'&&Number.isInteger(data.count)&&data.count>=0&&data.count<=element.config.marks.length){const renderer=renderers.get(module);if(renderer&&renderer.count!==data.count){renderer.count=data.count;element.refresh();}}
      if(data.type==='open'){const mark=element.config.marks.find(m=>m.id===data.id&&m.module===module&&m.scope==='page');if(mark)element.open(mark.id);}
      if(data.type==='picked'&&picking?.module===module&&picking.request===data.request){
        const editor=picking.editor;picking=null;editor.externalPick=false;editor.picking=false;
        if(data.selection&&typeof data.selection.selector==='string'&&typeof data.selection.page==='string'){editor.field('selector').value=data.selection.selector;editor.field('page').value=data.selection.page;editor.dirty=true;}
        element.refresh();editor.dialog.showModal();editor.message(data.selection?'区域已选择，保存标记后生效。':'已取消选择，原标记内容保留。');
      }
    });
    window.addEventListener('keydown',event=>{if(event.key==='Escape'&&picking){event.preventDefault();cancelPick();}},true);
    return {update(){if(picking&&picking.module!==activeModule())cancelPick();element.refresh();},sync};
  }
  function renderer(element,module){
    let request=null,lastPage=null,lastCount=null;
    const send=data=>parent.postMessage({protocol,...data},'*');
    Object.assign(element.options,{
      storage:false,onOpen:id=>send({type:'open',id}),
      onRefresh(){if(element.page!==lastPage){lastPage=element.page;send({type:'page',page:lastPage});}},
      onRendered(){const count=element.targets.length;if(count!==lastCount){lastCount=count;send({type:'rendered',count});}},
      renderMark:mark=>mark.scope==='page'&&mark.module===module,
      onPicked:selection=>{send({type:'picked',request,selection});request=null;}
    });
    window.addEventListener('message',event=>{
      const data=event.data;if(event.source!==parent||data?.protocol!==protocol)return;
      if(data.type==='state'&&!ERPIterationMarks.validateConfig(data.config).length){
        element.commitConfig(data.config);element.version=data.version;element.select.value=data.version;element.enabled=data.enabled===true;element.refresh();
      }
      if(data.type==='locate'){const mark=element.config.marks.find(m=>m.id===data.id&&m.module===module&&m.scope==='page');if(mark)element.locate(mark);}
      if(data.type==='pick'&&typeof data.request==='string'){const editor=element.getEditor();editor.loadMark(null);editor.remotePick=true;request=data.request;editor.startPick();}
      if(data.type==='cancel-pick'&&data.request===request)element.editor?.finishPick(false,false);
    });
    send({type:'ready',page:element.page});
  }
  window.ERPIterationBridge={host,renderer};
})();
