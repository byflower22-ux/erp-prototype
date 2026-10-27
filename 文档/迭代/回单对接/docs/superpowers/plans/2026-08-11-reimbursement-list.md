# 付款报销单列表页复刻 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 交付一个不依赖后端和构建工具、可直接打开使用的财务报销单列表页，视觉还原参考截图并实现本地搜索、筛选、详情、展开和分页。

**Architecture:** 使用静态 HTML 搭建后台壳层，CSS 负责参考图的紧凑宽屏视觉。业务规则放在可被浏览器与 Node 测试同时加载的 `logic.js`，本地单据放在 `data.js`，`app.js` 仅管理 DOM 状态、事件和渲染，避免筛选规则散落到 UI 层。

**Tech Stack:** HTML5、CSS3、原生 JavaScript、Node.js 内置 `node:test`/`assert`。

---

## File Structure

- `index.html` — 页面语义结构、筛选控件、表格容器、弹层和浮动入口。
- `assets/css/styles.css` — 侧栏、顶栏、筛选区、表格、弹层和响应式样式。
- `assets/js/data.js` — 24 条本地单据数据和付款主体选项。
- `assets/js/logic.js` — 日期范围、组合筛选、分页等不依赖 DOM 的纯函数；以浏览器全局与 CommonJS 双方式暴露。
- `assets/js/app.js` — 页面状态、渲染、事件监听、详情弹层和提示消息。
- `tests/logic.test.js` — 筛选、日期快捷范围和分页的行为测试。

### Task 1: Create the tested data-filtering core

**Files:**

- Create: `assets/js/logic.js`
- Create: `assets/js/data.js`
- Create: `tests/logic.test.js`

- [ ] **Step 1: Write the failing tests for filtering and pagination**

```js
// tests/logic.test.js
const test = require('node:test');
const assert = require('node:assert/strict');
const { filterDocuments, paginate, getPresetRange } = require('../assets/js/logic.js');

const docs = [
  { id: 'A001', title: '广州差旅报销', applicant: '陈昊', department: '企业运营部', content: '机票与住宿', status: '已支付', type: '报销单', overseas: false, invoice: true, payer: '深圳博商管理有限公司', createdAt: '2026-08-11T09:00:00' },
  { id: 'A002', title: '海外付款申请', applicant: '安平', department: '三部', content: '香港服务费', status: '待财务审核', type: '付款单', overseas: true, invoice: false, payer: '深圳博商管理有限公司', createdAt: '2026-08-04T09:00:00' },
  { id: 'A003', title: '采购报销', applicant: '张天虹', department: '企业文化', content: '办公耗材', status: '已驳回', type: '报销单', overseas: false, invoice: true, payer: '深圳博商科技有限公司', createdAt: '2026-07-15T09:00:00' }
];

test('filterDocuments combines keyword, status and boolean filters', () => {
  const result = filterDocuments(docs, { keyword: '香港', status: '待财务审核', type: '全部', overseas: '是', invoice: '全部', payer: '全部', datePreset: '全部' }, new Date('2026-08-11T12:00:00'));
  assert.deepEqual(result.map((doc) => doc.id), ['A002']);
});

test('getPresetRange returns an inclusive current-month range', () => {
  const range = getPresetRange('本月', new Date('2026-08-11T12:00:00'));
  assert.equal(range.start.toISOString().slice(0, 10), '2026-08-01');
  assert.equal(range.end.toISOString().slice(0, 10), '2026-08-31');
});

test('paginate clamps an out-of-range page to the final page', () => {
  const result = paginate(['a', 'b', 'c'], 9, 2);
  assert.deepEqual(result.items, ['c']);
  assert.equal(result.page, 2);
  assert.equal(result.totalPages, 2);
});
```

- [ ] **Step 2: Run the core test file and verify it fails because the module is absent**

Run: `node --test tests/logic.test.js`

Expected: failure containing `Cannot find module '../assets/js/logic.js'`.

- [ ] **Step 3: Implement the minimal reusable filtering module**

```js
// assets/js/logic.js
const ReceiptLogic = (() => {
  const startOfDay = (date) => new Date(date.getFullYear(), date.getMonth(), date.getDate());
  const endOfDay = (date) => new Date(date.getFullYear(), date.getMonth(), date.getDate(), 23, 59, 59, 999);
  const range = (start, end) => ({ start: startOfDay(start), end: endOfDay(end) });

  function getPresetRange(preset, now = new Date()) {
    const today = startOfDay(now);
    if (preset === '今天') return range(today, today);
    if (preset === '昨天') return range(new Date(today.getFullYear(), today.getMonth(), today.getDate() - 1), new Date(today.getFullYear(), today.getMonth(), today.getDate() - 1));
    if (preset === '近7天') return range(new Date(today.getFullYear(), today.getMonth(), today.getDate() - 6), today);
    if (preset === '本月') return range(new Date(today.getFullYear(), today.getMonth(), 1), new Date(today.getFullYear(), today.getMonth() + 1, 0));
    if (preset === '上月') return range(new Date(today.getFullYear(), today.getMonth() - 1, 1), new Date(today.getFullYear(), today.getMonth(), 0));
    if (preset === '本季度' || preset === '上季度') {
      const shift = preset === '上季度' ? -3 : 0;
      const month = today.getMonth() + shift;
      const quarterStart = Math.floor(month / 3) * 3;
      return range(new Date(today.getFullYear(), quarterStart, 1), new Date(today.getFullYear(), quarterStart + 3, 0));
    }
    if (preset === '本年') return range(new Date(today.getFullYear(), 0, 1), new Date(today.getFullYear(), 11, 31));
    if (preset === '去年') return range(new Date(today.getFullYear() - 1, 0, 1), new Date(today.getFullYear() - 1, 11, 31));
    return null;
  }

  function filterDocuments(documents, filters, now = new Date()) {
    const keyword = (filters.keyword || '').trim().toLocaleLowerCase();
    const dateRange = getPresetRange(filters.datePreset, now);
    return documents.filter((doc) => {
      const searchable = [doc.id, doc.title, doc.applicant, doc.department, doc.content].join(' ').toLocaleLowerCase();
      const inDateRange = !dateRange || (new Date(doc.createdAt) >= dateRange.start && new Date(doc.createdAt) <= dateRange.end);
      return (!keyword || searchable.includes(keyword)) &&
        (filters.status === '全部' || doc.status === filters.status) &&
        (filters.type === '全部' || doc.type === filters.type) &&
        (filters.overseas === '全部' || String(doc.overseas ? '是' : '否') === filters.overseas) &&
        (filters.invoice === '全部' || String(doc.invoice ? '是' : '否') === filters.invoice) &&
        (filters.payer === '全部' || doc.payer === filters.payer) && inDateRange;
    });
  }

  function paginate(items, requestedPage, pageSize) {
    const totalPages = Math.max(1, Math.ceil(items.length / pageSize));
    const page = Math.min(Math.max(1, requestedPage), totalPages);
    return { items: items.slice((page - 1) * pageSize, page * pageSize), page, totalPages };
  }

  return { filterDocuments, getPresetRange, paginate };
})();

if (typeof window !== 'undefined') window.ReceiptLogic = ReceiptLogic;
if (typeof module !== 'undefined') module.exports = ReceiptLogic;
```

Create `assets/js/data.js` as a browser-global `window.RECEIPT_DOCUMENTS` array with 24 complete records following this shape:

```js
{ id: '20190904154516046114', title: '8月份车费报销', type: '报销单', invoice: true, overseas: false, amount: 341.74, currency: '人民币', createdAt: '2026-08-11T14:54:15', applicant: '陈昊', department: '企业运营服务中心/深圳博商', payer: '深圳博商管理有限公司', content: '费用时间：2026-08-04\n批注内容：否', status: '已支付', statusAt: '2026-08-11T15:50:54', cbsNumber: '--', failureReason: '--' }
```

Include at least one record for every status (`待财务审核`、`已驳回`、`待支付`、`已支付`、`支付失败`), both types, both boolean values, and dates in the present month, prior month and previous year. Also expose `window.PAYER_OPTIONS` with each distinct payer.

- [ ] **Step 4: Run tests and verify all three assertions pass**

Run: `node --test tests/logic.test.js`

Expected: `# pass 3`, `# fail 0`.

- [ ] **Step 5: Commit the tested data core when Git is available**

Run: `git rev-parse --is-inside-work-tree`

If output is `true`, run `git add assets/js/logic.js assets/js/data.js tests/logic.test.js && git commit -m "feat: add receipt list filtering core"`; otherwise record that this standalone folder is intentionally not a Git repository.

### Task 2: Build the visual admin shell

**Files:**

- Create: `index.html`
- Create: `assets/css/styles.css`

- [ ] **Step 1: Add a static structure smoke check before creating the markup**

Create `tests/page-structure.test.js`:

```js
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');

test('page has the required shell landmarks and scripts', () => {
  const html = fs.readFileSync('index.html', 'utf8');
  for (const selector of ['class="app-shell"', 'id="sidebar"', 'id="filter-panel"', 'id="receipt-table-body"', 'id="detail-dialog"', 'assets/js/app.js']) {
    assert.ok(html.includes(selector), `missing ${selector}`);
  }
});
```

- [ ] **Step 2: Run the structure test and verify it fails because `index.html` does not exist**

Run: `node --test tests/page-structure.test.js`

Expected: failure containing `ENOENT` for `index.html`.

- [ ] **Step 3: Create semantic page markup and the matching CSS**

Create `index.html` with a `div.app-shell` containing `aside#sidebar.sidebar`, `header.topbar`, `main.main-content`, `section#filter-panel.filter-panel`, a `table` whose `tbody` is `#receipt-table-body`, `nav#pagination`, `div#detail-dialog.modal[role="dialog"][aria-modal="true"]`, `div#toast`, and two bottom-right floating buttons. Include these scripts in order at the end of `body`:

```html
<script src="assets/js/logic.js"></script>
<script src="assets/js/data.js"></script>
<script src="assets/js/app.js"></script>
```

Use form buttons rather than anchors for every interactive item. Mark filter groups with `aria-label`, add `aria-expanded` to the financial-management submenu trigger, set the dialog hidden initially, and provide an accessible close button.

Create `assets/css/styles.css` with the visual tokens and layout foundation below, then add focused rules for each named component:

```css
:root { --navy: #303d5b; --navy-deep: #27334f; --accent: #f26b6b; --accent-soft: #fff1f1; --line: #edf0f5; --muted: #8d97a9; --text: #303846; --canvas: #f6f8fb; }
* { box-sizing: border-box; }
body { margin: 0; min-width: 1180px; color: var(--text); background: var(--canvas); font-family: "Microsoft YaHei", "PingFang SC", Arial, sans-serif; font-size: 12px; }
button, input, select { font: inherit; }
button:focus-visible, input:focus-visible, select:focus-visible { outline: 2px solid #78a9ed; outline-offset: 2px; }
.app-shell { min-height: 100vh; padding-left: 122px; }
.sidebar { position: fixed; inset: 0 auto 0 0; width: 122px; overflow-y: auto; color: #c4cbe0; background: var(--navy); transition: width .2s; }
.main-content { padding: 14px 14px 44px; }
.filter-panel, .table-card { background: #fff; border: 1px solid var(--line); }
```

Required visual details: 36px top bar; white tab strip; 122px deep-blue sidebar with pale active stripe; 28px tall compact filter rows; coral selected filters; low-contrast horizontal separators; 50px table rows; blue title links; green status dot; fixed-width table overflows inside `.table-scroll`; 680px centered white dialog; dark translucent modal overlay; red circular help and blue customer-service buttons. Add a breakpoint at `max-width: 1280px` that preserves the desktop table via horizontal scrolling instead of hiding columns.

- [ ] **Step 4: Run the static structure test and verify it passes**

Run: `node --test tests/page-structure.test.js`

Expected: `# pass 1`, `# fail 0`.

- [ ] **Step 5: Commit the page shell when Git is available**

Run: `git rev-parse --is-inside-work-tree`

If output is `true`, run `git add index.html assets/css/styles.css tests/page-structure.test.js && git commit -m "feat: build reimbursement list shell"`; otherwise do not create a commit.

### Task 3: Render and control the receipt list

**Files:**

- Create: `assets/js/app.js`
- Modify: `index.html`

- [ ] **Step 1: Add a failing test for date preset coverage not yet covered by Task 1**

Append to `tests/logic.test.js`:

```js
test('filterDocuments accepts records from the rolling seven-day range including today', () => {
  const result = filterDocuments(docs, { keyword: '', status: '全部', type: '全部', overseas: '全部', invoice: '全部', payer: '全部', datePreset: '近7天' }, new Date('2026-08-11T12:00:00'));
  assert.deepEqual(result.map((doc) => doc.id), ['A001', 'A002']);
});
```

- [ ] **Step 2: Run the test to verify current implementation fails if the date range has not been corrected**

Run: `node --test tests/logic.test.js --test-name-pattern "rolling seven-day"`

Expected: pass only after `getPresetRange('近7天')` has an inclusive six-day offset as specified in Task 1; if it already passes, retain it as regression protection and proceed.

- [ ] **Step 3: Implement DOM state, rendering, and event wiring in `app.js`**

Use this state shape and render pipeline:

```js
const state = {
  filters: { keyword: '', status: '全部', type: '全部', overseas: '全部', invoice: '全部', payer: '全部', datePreset: '全部' },
  page: 1,
  pageSize: 8,
  expandedIds: new Set(),
  lastFocusedElement: null
};

function getVisibleDocuments() {
  return window.ReceiptLogic.filterDocuments(window.RECEIPT_DOCUMENTS, state.filters);
}

function render() {
  const result = window.ReceiptLogic.paginate(getVisibleDocuments(), state.page, state.pageSize);
  state.page = result.page;
  renderRows(result.items);
  renderPagination(result.page, result.totalPages, getVisibleDocuments().length);
  renderResultCount(getVisibleDocuments().length);
}
```

Implement `renderRows` with HTML escaping for all values, `formatMoney` using `Intl.NumberFormat('zh-CN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })`, `formatDate` as `YYYY-MM-DD HH:mm:ss`, and `--` fallback. Each row must have buttons with `data-action="details"` and `data-action="toggle-content"`, using document id in `data-id`. Render an empty-state row spanning all columns, with a `data-action="clear-filters"` button.

Wire delegated clicks from `#receipt-table-body`, preset and option buttons from `#filter-panel`, payer `<select>`, keyword search click/Enter, refresh, more menu, pagination, sidebar collapse/submenu and floating buttons. Filtering must reset `state.page = 1`; pagination changes only `state.page`. Set `aria-pressed` for selectable button chips and `disabled` for unavailable page controls. Populate payer options from `window.PAYER_OPTIONS`.

- [ ] **Step 4: Run the full unit suite and JavaScript syntax check**

Run: `node --test tests/logic.test.js tests/page-structure.test.js; node --check assets/js/app.js; node --check assets/js/data.js; node --check assets/js/logic.js`

Expected: all tests pass and every syntax command exits with status 0.

- [ ] **Step 5: Commit list rendering when Git is available**

Run: `git rev-parse --is-inside-work-tree`

If output is `true`, run `git add assets/js/app.js index.html tests/logic.test.js && git commit -m "feat: add interactive receipt table"`; otherwise do not create a commit.

### Task 4: Add detail dialog, auxiliary actions, and accessibility behavior

**Files:**

- Modify: `index.html`
- Modify: `assets/js/app.js`
- Modify: `assets/css/styles.css`

- [ ] **Step 1: Add the dialog structure regression test**

Append to `tests/page-structure.test.js`:

```js
test('page declares an accessible detail dialog', () => {
  const html = fs.readFileSync('index.html', 'utf8');
  assert.match(html, /id="detail-dialog"[^>]*role="dialog"/);
  assert.match(html, /id="detail-close"/);
});
```

- [ ] **Step 2: Run it and verify the markup requirement fails before dialog markup is completed**

Run: `node --test tests/page-structure.test.js --test-name-pattern "accessible detail dialog"`

Expected: failure mentioning the unmatched dialog selector if the markup is incomplete; otherwise retain the passing regression test.

- [ ] **Step 3: Implement dialog and transient-message behavior**

In `app.js`, add `openDetails(id)` that saves `document.activeElement`, finds the record, fills `#detail-content` with escaped label/value pairs, removes `hidden` from `#detail-dialog`, and focuses `#detail-close`. Add `closeDetails()` that restores `hidden` and refocuses the saved element. Close on close button, backdrop click only when `event.target === dialog`, and `Escape`. The dialog fields must include id, title, type, applicant, department, payer, createdAt, amount/currency, invoice, overseas, status, statusAt, failureReason and full multi-line content.

Implement `showToast(message)` by replacing toast text, adding `.is-visible`, clearing a previous timeout, and removing `.is-visible` after 2200ms. Use it for refresh, more-menu actions and both floating buttons. The more menu must close on outside click and Escape; its demonstration actions only show messages and must not mutate the document data.

Add CSS for `.modal[hidden]`, `.modal-backdrop`, `.modal-card`, `.detail-grid`, `.toast.is-visible`, `.more-menu`, `.floating-actions`, and `.sidebar.is-collapsed`; hide labels but retain an accessible `aria-label` when sidebar is collapsed.

- [ ] **Step 4: Run the complete automated checks**

Run: `node --test tests/logic.test.js tests/page-structure.test.js; node --check assets/js/app.js`

Expected: `# fail 0` and exit code 0.

- [ ] **Step 5: Commit dialog and auxiliary behavior when Git is available**

Run: `git rev-parse --is-inside-work-tree`

If output is `true`, run `git add index.html assets/js/app.js assets/css/styles.css tests/page-structure.test.js && git commit -m "feat: add receipt detail dialog"`; otherwise do not create a commit.

### Task 5: Verify the finished page in a browser

**Files:**

- Verify: `index.html`
- Verify: `assets/css/styles.css`
- Verify: `assets/js/data.js`
- Verify: `assets/js/logic.js`
- Verify: `assets/js/app.js`

- [ ] **Step 1: Run every automated check**

Run: `node --test tests/*.test.js; node --check assets/js/logic.js; node --check assets/js/data.js; node --check assets/js/app.js`

Expected: all tests pass and no syntax command reports errors.

- [ ] **Step 2: Open `index.html` in a Chromium browser and inspect the first viewport at 1536px width**

Verify: deep-blue fixed sidebar; white top bar; compact coral filter chips; table uses the full content width; no overlap, clipped controls, console errors or external network dependencies.

- [ ] **Step 3: Run the visible interaction smoke test**

Verify, in order:

1. Search a known title and confirm result count and table update.
2. Clear the search, select `已支付`, then `本月`, and confirm only matching records remain.
3. Toggle a content cell, open its details, close via Escape, then verify focus returns to its details button.
4. Move to the next page and verify the rows change; change any filter and verify it returns to page 1.
5. Trigger refresh, more menu, help and customer service, confirming each gives a local feedback message.
6. Narrow the viewport below 1280px and confirm table has horizontal scroll rather than dropping columns.

- [ ] **Step 4: Record standalone delivery state**

Run: `git status --short`

Expected: if this folder remains outside a Git repository, record that no commit is possible; otherwise report the exact changed files and final commit hash.
