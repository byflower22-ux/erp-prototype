(function (root) {
  'use strict';
  function createWorkspace() {
    return {
      tabs: [], active: null,
      update(module, snapshot, focus = false) {
        const previousIndex = this.tabs.findIndex(t => t.id === this.active);
        const wasCurrent = this.tabs[previousIndex]?.module === module;
        const incoming = snapshot.tabs.map(t => ({...t, module, id: module + ':' + t.key}));
        const byId = new Map(incoming.map(t => [t.id, t]));
        this.tabs = this.tabs.filter(t => t.module !== module || byId.has(t.id))
          .map(t => t.module === module ? byId.get(t.id) : t);
        for (const tab of incoming) if (!this.tabs.some(t => t.id === tab.id)) this.tabs.push(tab);
        if ((focus || wasCurrent) && snapshot.active) this.active = module + ':' + snapshot.active;
        if (!this.tabs.some(t => t.id === this.active)) {
          this.active = this.tabs[Math.max(0, Math.min(previousIndex - 1, this.tabs.length - 1))]?.id || null;
        }
      }
    };
  }
  function readMessage(event, frames) {
    const module = Object.keys(frames).find(key => frames[key] === event.source);
    const data = event.data;
    if (!module || !data || data.protocol !== 'erp-workspace-v1' || data.type !== 'snapshot') return null;
    if (!Array.isArray(data.tabs) || data.tabs.some(t => !t || typeof t.key !== 'string' || typeof t.label !== 'string' || typeof t.nav !== 'string')) return null;
    if (new Set(data.tabs.map(t => t.key)).size !== data.tabs.length) return null;
    if (data.active !== null && !data.tabs.some(t => t.key === data.active)) return null;
    return {module, snapshot: data};
  }
  const api = {createWorkspace, readMessage};
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.ERPWorkspace = api;
})(typeof window === 'undefined' ? globalThis : window);
