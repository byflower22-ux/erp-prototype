# 审批确认人工处理操作 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 为审批确认页实现本地模拟的人工确认支付结果、人工上传回单、重新同步金蝶及详情处理时间线。

**Architecture:** 纯状态流转从 `action-logic.js` 中的可测试函数开始，UI 层只判断可用动作、收集弹层输入并调用状态流转函数。模拟单据在页面内存中被更新；`timeline` 数组承载初始系统事件和新产生的人工操作记录，页面刷新后恢复 `data.js` 的初始值。

**Tech Stack:** HTML5、CSS3、原生 JavaScript、Node.js `node:test`。

---

## File Structure

- `assets/js/action-logic.js` — 人工操作资格判断、不可变状态更新、时间线事件创建；浏览器全局与 CommonJS 双暴露。
- `assets/js/data.js` — 每条模拟单据增加初始 `timeline`。
- `assets/js/app.js` — 操作入口、通用操作弹层、表格/详情重渲染和内存数据更新。
- `index.html` — 处理按钮列与操作弹层容器。
- `assets/css/styles.css` — 操作按钮、表单弹层、时间线和状态提示样式。
- `tests/action-logic.test.js` — 三类人工操作的状态流转与拒绝行为。
- `tests/page-structure.test.js` — 操作弹层、表格处理入口、时间线渲染钩子。

### Task 1: Create the tested manual-action state machine

**Files:**

- Create: `tests/action-logic.test.js`
- Create: `assets/js/action-logic.js`

- [ ] **Step 1: Write failing state-transition tests**

```js
const test = require('node:test');
const assert = require('node:assert/strict');
const { getAvailableActions, applyManualAction } = require('../assets/js/action-logic.js');

const overduePayment = { id: 'A1', status: '查询超期', receiptStatus: '待拉取', kingdeeStatus: '待同步', timeline: [] };

test('manual payment confirmation success creates a receipt task and timeline entry', () => {
  const updated = applyManualAction(overduePayment, 'confirm-payment', { result: '已支付', note: '已与银行确认' }, { operator: '超级管理员', now: '2026-08-11T10:00:00' });
  assert.equal(updated.status, '已支付');
  assert.equal(updated.receiptStatus, '待拉取');
  assert.equal(updated.kingdeeStatus, '待同步');
  assert.equal(updated.timeline.at(-1).action, '人工确认支付结果');
});

test('manual receipt upload archives only an overdue receipt with a receipt number and file', () => {
  const source = { id: 'A2', status: '已支付', receiptStatus: '待人工上传', kingdeeStatus: '待同步', timeline: [] };
  const updated = applyManualAction(source, 'upload-receipt', { receiptNumber: 'RC-20260811', fileName: '回单.pdf', note: '补充上传' }, { operator: '超级管理员', now: '2026-08-11T10:00:00' });
  assert.equal(updated.receiptStatus, '已归档');
  assert.equal(updated.timeline.at(-1).fileName, '回单.pdf');
  assert.throws(() => applyManualAction({ ...source, receiptStatus: '待拉取' }, 'upload-receipt', { receiptNumber: 'R', fileName: 'a.pdf' }, { operator: '超级管理员' }), /不可用/);
});

test('Kingdee retry succeeds only for failed or manual-processing documents', () => {
  const source = { id: 'A3', status: '已支付', receiptStatus: '已归档', kingdeeStatus: '同步失败', timeline: [] };
  const updated = applyManualAction(source, 'retry-kingdee', { note: '修正附件后重试' }, { operator: '超级管理员', now: '2026-08-11T10:00:00' });
  assert.equal(updated.kingdeeStatus, '同步成功');
  assert.equal(getAvailableActions(updated).length, 0);
});
```

- [ ] **Step 2: Run tests and verify the absent module fails**

Run: `node --test tests/action-logic.test.js`

Expected: failure containing `Cannot find module '../assets/js/action-logic.js'`.

- [ ] **Step 3: Implement the minimal pure action module**

Create `assets/js/action-logic.js` with CommonJS plus `window.IntegrationActionLogic` exposure. Implement:

```js
function getAvailableActions(document) {
  const actions = [];
  if (document.status === '查询超期') actions.push('confirm-payment');
  if (document.receiptStatus === '拉取超期' || document.receiptStatus === '待人工上传') actions.push('upload-receipt');
  if (document.kingdeeStatus === '同步失败' || document.kingdeeStatus === '待人工处理') actions.push('retry-kingdee');
  return actions;
}
```

`applyManualAction(document, action, payload, context)` must clone the document and timeline, require `action` to be in `getAvailableActions`, validate required fields, update statuses exactly as the approved design specifies, set `statusAt` to `context.now || new Date().toISOString()`, and append `{ action, note, operator, at, fileName?, receiptNumber? }`. Throw an error whose message contains `不可用` for unavailable actions and a Chinese validation message for missing form values.

- [ ] **Step 4: Run the action tests and verify they pass**

Run: `node --test tests/action-logic.test.js`

Expected: `# pass 3`, `# fail 0`.

### Task 2: Add initial timelines and operation structure

**Files:**

- Modify: `assets/js/data.js`
- Modify: `index.html`
- Modify: `tests/page-structure.test.js`

- [ ] **Step 1: Write a failing page contract test**

Append a test that asserts `index.html` has `#operation-dialog`, `#operation-form`, `#operation-cancel`, `#operation-submit`, a table header `处理`, and script loading order `action-logic.js` after `data.js` and before `app.js`. Also assert `app.js` contains `renderTimeline` and `getAvailableActions`.

- [ ] **Step 2: Run it and verify it fails before markup is added**

Run: `node --test tests/page-structure.test.js --test-name-pattern "manual integration actions"`

Expected: failure mentioning the absent operation dialog or header.

- [ ] **Step 3: Add initial timeline data and semantic UI containers**

For every document in `data.js`, add a `timeline` array with at least the system event `{ action: '付款指令提交', note: '已提交至CBS', operator: '系统', at: createdAt }`; for `已支付` add `{ action: '支付结果确认', ... }`; for `已归档` add `{ action: '电子回单归档', ... }`.

In `index.html`, add a `处理` table header as the second column after `操作`, and place a hidden modal `#operation-dialog` after the detail dialog. Give it `role="dialog"`, `aria-modal="true"`, a title placeholder, `form#operation-form`, `#operation-fields`, `button#operation-cancel`, `button#operation-submit`, and a close button. Include `assets/js/action-logic.js` in script order between data and app.

- [ ] **Step 4: Run page structure tests**

Run: `node --test tests/page-structure.test.js`

Expected: all page tests pass.

### Task 3: Connect UI actions, dialogs, and timeline rendering

**Files:**

- Modify: `assets/js/app.js`
- Modify: `assets/css/styles.css`
- Modify: `tests/page-structure.test.js`

- [ ] **Step 1: Add a failing static interaction contract**

Assert `app.js` contains `openOperationDialog`, `submitOperation`, `renderTimeline`, `IntegrationActionLogic.applyManualAction`, and the `data-action="process"` row action. Run the named test; it must fail until the functions exist.

- [ ] **Step 2: Implement guarded action availability and table controls**

Read `root.IntegrationActionLogic`. Add `getDocumentById`, `replaceDocument`, and `renderProcessButton(receipt)`. Render a process button only when `getAvailableActions(receipt)` is nonempty; otherwise render `--`. Increment table empty-state colspan from 21 to 22. Keep detail action behavior unchanged.

- [ ] **Step 3: Implement the operation dialog**

Implement `openOperationDialog(id)` with one-choice action selection when a document has multiple available actions. Dynamically render fields:

- `confirm-payment`: select `已支付`/`支付失败`, required textarea `确认说明`.
- `upload-receipt`: required text `回单号`, required file input accepting `.pdf,.jpg,.png`, optional textarea `说明`.
- `retry-kingdee`: required textarea `重试说明`.

On submit, gather fields, use `fileInput.files[0]?.name` as `fileName`, call `IntegrationActionLogic.applyManualAction`, replace the record in the in-memory `RECEIPT_DOCUMENTS` array, rerender, close dialog, show a success toast, and reopen the details dialog if it was the active context. On thrown validation errors, display the message inside the dialog without closing it. Cancel, close, backdrop and Escape close the operation dialog and restore focus. Trap Tab focus inside it using the existing dialog-focus pattern.

- [ ] **Step 4: Render timeline in details**

Implement `renderTimeline(timeline)` to display the events newest first with action, at, operator, note and optional receipt number/file name. Append it after base detail fields. Add appropriate `aria-label="处理记录"`.

- [ ] **Step 5: Add CSS**

Add compact styles for `.process-button`, `.operation-fields`, `.field-error`, `.timeline`, `.timeline-item`, and `.timeline-dot`, visually matching the existing red/blue-gray system. Use `white-space: pre-wrap` for notes and ensure timeline rows wrap without expanding the table.

- [ ] **Step 6: Run full verification**

Run: `node --test tests/*.test.js; node --check assets/js/action-logic.js; node --check assets/js/data.js; node --check assets/js/app.js`

Expected: all tests pass and all syntax checks exit with status 0.
