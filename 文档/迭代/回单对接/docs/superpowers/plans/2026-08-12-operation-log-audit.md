# 操作日志审计改造 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 为付款、CBS、回单和金蝶流程提供可追溯的四列操作日志。

**Architecture:** `action-logic.js` 在状态流转时写入标准化 timeline 事件；`data.js` 为本地模拟数据补齐既有系统事件；`app.js` 将日志弹窗渲染为审计表格。事件保留 `action`、`operator`、`at`、`note` 四项。

**Tech Stack:** 原生 HTML、CSS、JavaScript、Node.js 内置测试运行器。

---

### Task 1: 写入流程审计事件

**Files:**
- Modify: `assets/js/action-logic.js`
- Test: `tests/action-logic.test.js`

- [ ] 支付并上传回单写入“手动支付、提交付款、获取支付结果、手动上传回单、同步金蝶”事件；CBS 与金蝶步骤操作人写“系统”。
- [ ] 补传回单写入“手动上传回单、同步金蝶”事件；手动重试金蝶写入“手动同步金蝶、同步金蝶”事件。
- [ ] 运行 `node --test tests/action-logic.test.js`，预期全部通过。

### Task 2: 补齐模拟数据的系统日志

**Files:**
- Modify: `assets/js/data.js`
- Test: `tests/data.test.js`

- [ ] 为已提交付款数据写入 CBS 申请单编号；支付成功写交易流水号，支付失败写失败原因；回单和金蝶节点分别写编号或失败原因。
- [ ] 运行 `node --test tests/data.test.js`，预期全部通过。

### Task 3: 渲染日志弹窗审计表

**Files:**
- Modify: `assets/js/app.js`
- Modify: `assets/css/styles.css`
- Test: `tests/page-structure.test.js`

- [ ] 新增四列“操作时间、操作人、操作节点、备注”的日志表；日志按钮使用该表渲染。
- [ ] 运行 `node --test tests/page-structure.test.js`，预期全部通过。
