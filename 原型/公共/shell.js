(function () {
  'use strict';
  const phoneViewport=matchMedia('(max-width:600px)');
  function closePhoneNav(){if(!phoneViewport.matches)return;document.body.classList.add('nav-collapsed');const toggle=document.getElementById('toggle-nav');toggle.setAttribute('aria-expanded','false');toggle.setAttribute('aria-label','展开导航');}
  closePhoneNav();phoneViewport.addEventListener('change',closePhoneNav);
  const workspace = ERPWorkspace.createWorkspace();
  const frames = {}, ready = new Set(), pending = {};
  const sources = {
    budget:'原型/预算管理/预算优化/prototype/index.html?erp=1#overview',
    receipt:'原型/付款报销/回单对接/index.html?erp=1',
    project:'原型/项目管理/项目管理优化/index.html?erp=1&v=20261109-loading1'
  };
  let requestedModule = null, previousNav = null;
  let loadingTimer, retryRequest;
  const loading=document.getElementById('erp-loading'),loadingText=document.getElementById('erp-loading-text'),retry=document.getElementById('erp-load-retry');
  function loadFailed(module){
    if(requestedModule!==module)return;
    clearTimeout(loadingTimer);loading.hidden=false;
    loadingText.textContent='页面未能打开，可能是网络超时或页面资源加载失败。请重试。';retry.hidden=false;
  }
  function startLoading(module,value){
    clearTimeout(loadingTimer);retryRequest={module,value};loading.hidden=false;retry.hidden=true;loadingText.textContent='正在打开页面…';
    loadingTimer=setTimeout(()=>loadFailed(module),20000);
  }
  const stage = document.getElementById('erp-stage');
  const iterationMarks=ERPIterationBridge.host({
    element:document.getElementById('erp-version-marks'),frames,
    getActive:()=>workspace.tabs.find(tab=>tab.id===workspace.active),
    navigate:module=>command(module,{action:'navigate',page:module==='project'?'schedule':'overview'})
  });
  function post(module, command) {
    frames[module].contentWindow.postMessage({protocol:'erp-workspace-v1',type:'command',...command}, '*');
  }
  function command(module, value) {
    requestedModule = module;
    startLoading(module,value);
    if (!frames[module]) {
      const frame = document.createElement('iframe');
      frame.title = {budget:'预算管理业务页面',receipt:'付款报销业务页面',project:'项目管理与核算业务页面'}[module];
      frame.dataset.module = module;
      frame.hidden = true;
      frames[module] = frame;
      pending[module] = value;
      frame.src = sources[module];
      stage.append(frame);
      frame.addEventListener('error',()=>loadFailed(module));
    } else if (ready.has(module)) post(module, value);
    else pending[module] = value;
  }
  function render() {
    const active = workspace.tabs.find(t => t.id === workspace.active);
    for (const [key, frame] of Object.entries(frames)) frame.hidden = key !== active?.module;
    document.getElementById('erp-empty').hidden = !!active;
    const bar = document.getElementById('erp-tabs');
    const focused = document.activeElement;
    const focusId = focused?.dataset.tabId, focusAction = focused?.dataset.action;
    bar.replaceChildren(...workspace.tabs.map(tab => {
      const item = document.createElement('div');
      item.className = 'erp-tab' + (tab.id === workspace.active ? ' current' : '');
      const open = document.createElement('button');
      open.type = 'button'; open.textContent = tab.label;
      open.dataset.tabId = tab.id; open.dataset.action = 'activate';
      if (tab.id === workspace.active) open.setAttribute('aria-current','page');
      if (tab.dirty) { const dot = document.createElement('span'); dot.className='erp-dirty'; dot.textContent='●'; dot.title='未保存'; open.append(dot); }
      const close = document.createElement('button');
      close.type='button';close.className='erp-close';close.textContent='×';
      close.dataset.tabId=tab.id;close.dataset.action='close';close.setAttribute('aria-label','关闭'+tab.label);
      item.append(open,close);return item;
    }));
    if (focusId) bar.querySelectorAll('button').forEach(button => {if (button.dataset.tabId === focusId && button.dataset.action === focusAction) button.focus({preventScroll:true});});
    bar.querySelector('.current')?.scrollIntoView({block:'nearest',inline:'nearest'});
    const currentNav = active ? active.module + ':' + active.nav : null;
    document.querySelectorAll('.erp-subnav button').forEach(button => {
      const selected = button.dataset.module === active?.module && button.dataset.page === active?.nav;
      button.classList.toggle('active', selected);
      if (selected) {button.setAttribute('aria-current','page');if(currentNav!==previousNav)button.closest('details').open=true;}
      else button.removeAttribute('aria-current');
    });
    document.querySelectorAll('nav details').forEach(group => group.classList.toggle('selected',!!group.querySelector('.active')));
    previousNav = currentNav;
    iterationMarks.update();
  }
  window.addEventListener('message', event => {
    if(event.data?.protocol==='erp-workspace-v1'&&event.data.type==='load-error'){
      const module=Object.keys(frames).find(key=>frames[key].contentWindow===event.source);
      if(module)loadFailed(module);
      return;
    }
    const parsed = ERPWorkspace.readMessage(event,Object.fromEntries(Object.entries(frames).map(([key,frame])=>[key,frame.contentWindow])));
    if (!parsed) return;
    const {module,snapshot} = parsed;
    if (!ready.has(module)) {
      ready.add(module);
      if (pending[module]) {const value=pending[module];delete pending[module];post(module,value);return;}
    }
    const previous = workspace.active;
    workspace.update(module,snapshot,requestedModule === module);
    if (requestedModule === module) {requestedModule=null;clearTimeout(loadingTimer);loading.hidden=true;retry.hidden=true;}
    render();
    // The receiving business module owns its state; activate its selected tab on fallback.
    const active = workspace.tabs.find(t=>t.id===workspace.active);
    if (active && previous !== active.id && active.module !== module) post(active.module,{action:'activate',key:active.key});
  });
  retry.addEventListener('click',()=>{
    if(!retryRequest)return;
    const {module,value}=retryRequest;
    // A module with open tabs may hold unsaved changes: retry its command in place.
    if(!workspace.tabs.some(tab=>tab.module===module)){
      frames[module]?.remove();delete frames[module];ready.delete(module);delete pending[module];
    }
    command(module,value);
  });
  document.querySelector('nav').addEventListener('click', event => {
    const button = event.target.closest('button[data-module]');
    if (button) {command(button.dataset.module,{action:'navigate',page:button.dataset.page});closePhoneNav();}
  });
  document.getElementById('erp-tabs').addEventListener('click', event => {
    const button = event.target.closest('button[data-tab-id]');
    const tab = workspace.tabs.find(t=>t.id===button?.dataset.tabId);
    if (!tab) return;
    // Bring an inactive page forward so any unsaved-changes dialog is visible.
    if (button.dataset.action === 'close' && tab.id !== workspace.active) command(tab.module,{action:'activate',key:tab.key});
    command(tab.module,{action:button.dataset.action,key:tab.key});
  });
  document.getElementById('toggle-nav').addEventListener('click', event => {
    const collapsed = document.body.classList.toggle('nav-collapsed');
    event.currentTarget.setAttribute('aria-expanded',String(!collapsed));
    event.currentTarget.setAttribute('aria-label',collapsed?'展开导航':'折叠导航');
    document.getElementById('erp-version-marks').schedule();
  });
  window.addEventListener('beforeunload', event => {
    if (workspace.tabs.some(t=>t.dirty)) {event.preventDefault();event.returnValue='';}
  });
  command('budget',{action:'navigate',page:'overview'});
})();
