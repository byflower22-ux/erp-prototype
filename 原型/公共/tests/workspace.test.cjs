const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const target = path.join(__dirname, '../workspace.js');
const api = fs.existsSync(target) ? require(target) : {};
const snapshot = (active, tabs) => ({ active, tabs: tabs.map(key => ({key, label:key, nav:'overview'})) });

test('同名业务页在模块之间隔离，重复快照不重复打开', () => {
  assert.equal(typeof api.createWorkspace, 'function');
  const w = api.createWorkspace();
  w.update('budget', snapshot('overview', ['overview']), true);
  w.update('receipt', snapshot('overview', ['overview']), true);
  w.update('receipt', snapshot('overview', ['overview']));
  assert.deepEqual(w.tabs.map(t => t.id), ['budget:overview', 'receipt:overview']);
  assert.equal(w.active, 'receipt:overview');
});
test('后台模块更新不抢走当前页签，显式导航才切换', () => {
  assert.equal(typeof api.createWorkspace, 'function');
  const w = api.createWorkspace();
  w.update('budget', snapshot('overview', ['overview']), true);
  w.update('receipt', snapshot('list', ['list']));
  assert.equal(w.active, 'budget:overview');
  w.update('receipt', snapshot('list', ['list']), true);
  assert.equal(w.active, 'receipt:list');
});
test('关闭等待业务确认，拒绝关闭的快照保留脏标记', () => {
  assert.equal(typeof api.createWorkspace, 'function');
  const w = api.createWorkspace();
  const s = snapshot('budget-t1', ['overview','budget-t1']);
  s.tabs[1].dirty = true;
  w.update('budget', s, true);
  w.update('budget', s);
  assert.equal(w.active, 'budget:budget-t1');
  assert.equal(w.tabs[1].dirty, true);
  w.update('budget', snapshot('overview', ['overview']));
  assert.equal(w.active, 'budget:overview');
});
test('关闭模块最后页签切换至另一模块，全部关闭进入空态', () => {
  assert.equal(typeof api.createWorkspace, 'function');
  const w = api.createWorkspace();
  w.update('budget', snapshot('overview', ['overview']), true);
  w.update('receipt', snapshot('list', ['list']), true);
  w.update('receipt', snapshot(null, []));
  assert.equal(w.active, 'budget:overview');
  w.update('budget', snapshot(null, []));
  assert.equal(w.active, null);
});
test('只接收已登记窗口的合法协议快照', () => {
  assert.equal(typeof api.readMessage, 'function');
  const frame = {}, other = {};
  const frames = {budget:frame};
  const data = {protocol:'erp-workspace-v1', type:'snapshot', ...snapshot('overview',['overview'])};
  assert.equal(api.readMessage({source:other,data},frames), null);
  assert.equal(api.readMessage({source:frame,data:{...data,protocol:'other'}},frames), null);
  assert.equal(api.readMessage({source:frame,data:{...data,active:'missing'}},frames), null);
  assert.equal(api.readMessage({source:frame,data:{...data,tabs:[null]}},frames), null);
  assert.equal(api.readMessage({source:frame,data},frames).module, 'budget');
});
