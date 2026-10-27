# 审批确认状态操作 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 为审批确认列表提供按单据状态显示的审批、支付、回单和金蝶操作，并在本地模拟完整流转。

**Architecture:** `action-logic.js` 是状态机的唯一入口，负责按钮可用性、校验、状态改变、日志与固定失败单号。`app.js` 只负责渲染动作、打开弹窗和替换本地单据；详情、日志使用独立弹层展示。

**Tech Stack:** 原生 HTML、CSS、JavaScript、Node.js 内置测试运行器。

---

### Task 1: 状态机与回归测试

**Files:**
- Modify: `tests/action-logic.test.js`
- Modify: `assets/js/action-logic.js`

- [ ] 为待审核、待支付、支付失败、回单失败、金蝶失败编写可用操作测试。
- [ ] 为审批、驳回、支付含回单、上传回单、金蝶同步的状态和时间线编写测试。
- [ ] 运行 `node --test tests/action-logic.test.js`，确认新测试在实现前失败。
- [ ] 实现常量化操作、固定失败单号和不可变状态转换。
- [ ] 再次运行 `node --test tests/action-logic.test.js`，确认通过。

### Task 2: 列表操作与弹层

**Files:**
- Modify: `index.html`
- Modify: `assets/js/app.js`
- Modify: `assets/css/styles.css`
- Test: `tests/page-structure.test.js`

- [ ] 为操作列固定渲染详情、日志，并渲染状态机返回的补充操作。
- [ ] 添加日志弹层；审批详情与审批使用本地跳转提示模拟。
- [ ] 添加审批/驳回、支付含必填回单、上传回单、同步确认表单。
- [ ] 调整操作列为可换行的按钮布局，避免与单号列重叠。
- [ ] 运行 `node --test tests/page-structure.test.js`，确认页面契约通过。

### Task 3: 整体验证

**Files:**
- Modify: `tests/*.test.js`

- [ ] 运行 `node --test tests/*.test.js`。
- [ ] 运行 `node --check assets/js/action-logic.js` 和 `node --check assets/js/app.js`。
- [ ] 核对固定失败单号仅为 `202608040008`、`202608020010`、`202607010019`、`202511150021`。
