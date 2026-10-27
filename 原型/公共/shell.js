(function () {
  'use strict';
  const workspace = ERPWorkspace.createWorkspace();
  const frames = {}, ready = new Set(), pending = {};
  const sources = {
    budget:'原型/预算管理/预算优化/prototype/index.html?erp=1#overview',
    receipt:'原型/付款报销/回单对接/index.html?erp=1'
  };
  let requestedModule = null, previousNav = null;
  const stage = document.getElementById('erp-stage');
  const iterationMarks=ERPIterationBridge.host({
    element:document.getElementById('erp-version-marks'),frames,
    getActive:()=>workspace.tabs.find(tab=>tab.id===workspace.active),
    navigate:module=>command(module,{action:'navigate',page:'overview'})
  });
  function post(module, command) {
    frames[module].contentWindow.postMessage({protocol:'erp-workspace-v1',type:'command',...command}, '*');
  }
  function command(module, value) {
    requestedModule = module;
    if (!frames[module]) {
      const frame = document.createElement('iframe');
      frame.title = module === 'budget' ? '预算管理业务页面' : '付款报销业务页面';
      frame.dataset.module = module;
      frame.hidden = true;
      frames[module] = frame;
      pending[module] = value;
      frame.src = sources[module];
      stage.append(frame);
      document.getElementById('erp-loading').hidden = false;
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
    const parsed = ERPWorkspace.readMessage(event,Object.fromEntries(Object.entries(frames).map(([key,frame])=>[key,frame.contentWindow])));
    if (!parsed) return;
    const {module,snapshot} = parsed;
    if (!ready.has(module)) {
      ready.add(module);
      if (pending[module]) {const value=pending[module];delete pending[module];post(module,value);return;}
    }
    const previous = workspace.active;
    workspace.update(module,snapshot,requestedModule === module);
    if (requestedModule === module) {requestedModule=null;document.getElementById('erp-loading').hidden=true;}
    render();
    // The receiving business module owns its state; activate its selected tab on fallback.
    const active = workspace.tabs.find(t=>t.id===workspace.active);
    if (active && previous !== active.id && active.module !== module) post(active.module,{action:'activate',key:active.key});
  });
  document.querySelector('nav').addEventListener('click', event => {
    const button = event.target.closest('button[data-module]');
    if (button) command(button.dataset.module,{action:'navigate',page:button.dataset.page});
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
