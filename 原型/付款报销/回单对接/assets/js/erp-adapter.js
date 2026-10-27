/* Connect existing receipt pages to the shared ERP workspace; no business data is copied. */
window.createERPReceiptWorkspace = function (app) {
  'use strict';
  if (!window.ERPClient?.hosted) return null;
  const sections = {list:'approval-list-page', detail:'approval-detail-page', preview:'file-preview-page'};
  const tabs = new Map([['list',{key:'list',label:'审批确认',nav:'list',id:null,scroll:0}]]);
  let active = 'list';
  function snapshot() {return {active,tabs:[...tabs.values()].map(({key,label,nav})=>({key,label,nav}))};}
  function show() {
    for (const [key,id] of Object.entries(sections)) document.getElementById(id).hidden=key!==active;
    const tab=tabs.get(active);
    app.state.detailDocumentId=tab?.id||null;
    history.replaceState(null,'',tab?.id?'#'+(active==='detail'?'approval-detail-':'file-preview-')+encodeURIComponent(tab.id):location.pathname+location.search);
    window.ERPClient.publish();
  }
  function activate(key) {
    if (!tabs.has(key)) return;
    if (active===key) {show();return;}
    if (tabs.has(active)) tabs.get(active).scroll=window.scrollY;
    active=key;show();window.scrollTo(0,tabs.get(key).scroll||0);
  }
  const adapter={
    snapshot,
    record(key,id) {
      const label=key==='list'?'审批确认':(key==='detail'?'审批详情':'文件预览')+' · '+id;
      tabs.set(key,{key,label,nav:'list',id:id?String(id):null,scroll:0});
      active=key;show();
    },
    navigate(page) {if(page==='list'){if(!tabs.has('list'))tabs.set('list',{key:'list',label:'审批确认',nav:'list',id:null,scroll:0});activate('list');}},
    activate,
    close(key) {
      if (!tabs.has(key))return;
      tabs.delete(key);
      if(active===key)active=(key==='preview'&&tabs.has('detail'))?'detail':tabs.has('list')?'list':[...tabs.keys()].at(-1)||null;
      app.closeDetails();show();
      if(active)window.scrollTo(0,tabs.get(active).scroll||0);
    }
  };
  window.ERPClient.connect(adapter);
  return adapter;
};
