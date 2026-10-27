# CBS 与金蝶状态追踪改造 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 在审批确认页中新增回单状态、金蝶状态的本地模拟数据、组合筛选、表格展示和详情展示，同时保留表单状态的现有行为。

**Architecture:** `logic.js` 保持筛选纯函数并增加两个精确状态维度；`data.js` 为每条记录提供状态值；`index.html` 定义筛选和列结构；`app.js` 负责渲染与状态色彩映射。Node 内置测试锁定数据筛选和页面契约。

**Tech Stack:** HTML5、CSS3、原生 JavaScript、Node.js `node:test`。

---

### Task 1: Add tested status filtering and simulation data

**Files:**

- Modify: `tests/logic.test.js`
- Modify: `assets/js/logic.js`
- Modify: `assets/js/data.js`

- [ ] **Step 1: Write failing combined-status regression**

Append a test with three local records that filters `status: '已支付'` plus `receiptStatus: '已归档'` plus `kingdeeStatus: '同步成功'`, expecting only the record that has all three values.

- [ ] **Step 2: Run it and verify it fails before the new fields are filtered**

Run: `node --test tests/logic.test.js --test-name-pattern "receipt and kingdee status"`

Expected: the unfiltered extra matching record remains in the result.

- [ ] **Step 3: Implement two exact-match filters and complete data coverage**

Add `matchesField(document, 'receiptStatus', activeFilters.receiptStatus)` and `matchesField(document, 'kingdeeStatus', activeFilters.kingdeeStatus)` to `filterDocuments`. Add both string fields to every local record, covering each specified value at least once.

- [ ] **Step 4: Re-run logic tests**

Run: `node --test tests/logic.test.js`

Expected: all tests pass.

### Task 2: Render status controls, columns, and details

**Files:**

- Modify: `tests/page-structure.test.js`
- Modify: `index.html`
- Modify: `assets/js/app.js`
- Modify: `assets/css/styles.css`

- [ ] **Step 1: Write failing page contract test**

Assert that the markup contains the two filter groups and both table headers, and that `app.js` renders `receiptStatus` and `kingdeeStatus` in both rows and details.

- [ ] **Step 2: Run it and verify it fails before markup and rendering are changed**

Run: `node --test tests/page-structure.test.js --test-name-pattern "CBS and Kingdee status"`

Expected: failure mentioning the absent state group or header.

- [ ] **Step 3: Implement the minimal UI integration**

Add filters and columns without renaming the existing status controls. Extend app state/reset behavior, row colspan, render functions, and detail fields. Add color classes for successful, pending, failed/overdue, and manual-action states.

- [ ] **Step 4: Run complete verification**

Run: `node --test tests/*.test.js; node --check assets/js/logic.js; node --check assets/js/data.js; node --check assets/js/app.js`

Expected: all tests pass and syntax checks exit with status 0.
