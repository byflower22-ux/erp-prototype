(function () {
  'use strict';
  const hosted = window.parent !== window && new URLSearchParams(location.search).get('erp') === '1';
  let adapter;
  if (hosted) {
    document.documentElement.classList.add('erp-hosted');
    const style = document.createElement('link');
    style.rel = 'stylesheet';
    style.href = new URL('hosted.css', document.currentScript.src).href;
    document.head.append(style);
  }
  const publish = () => {
    if (hosted && adapter) parent.postMessage({protocol:'erp-workspace-v1', type:'snapshot', ...adapter.snapshot()}, '*');
  };
  window.ERPClient = {
    hosted,
    publish,
    connect(value) { if (hosted) { adapter = value; publish(); } }
  };
  window.addEventListener('message', event => {
    const data = event.data;
    if (!hosted || event.source !== parent || !adapter || data?.protocol !== 'erp-workspace-v1' || data.type !== 'command') return;
    if (data.action === 'navigate' && typeof data.page === 'string') adapter.navigate(data.page);
    if (['activate','close'].includes(data.action) && typeof data.key === 'string') adapter[data.action](data.key);
    publish();
  });
})();
