# ERP 公共原型框架

入口为 [ERP 工作台](../../index.html)。`shell.css`、`shell.js` 管理唯一顶部栏、导航与工作页签；`workspace.js` 合并模块页签并校验消息来源，`client.js` 是模块共用客户端；`hosted.css` 只在嵌入模式隐藏原外壳。

## 模块接入

1. 模块页面引入 `client.js`，保持相对路径正确。仅当 `?erp=1` 且处于 iframe 中时启用；独立打开不改变原外壳。
2. 业务初始化后调用 `ERPClient.connect({snapshot,navigate,activate,close})`，业务页面／页签及脏标记变化时调用 `ERPClient.publish()`。
3. `snapshot()` 返回 `{active,tabs:[{key,label,nav,dirty}]}`，`active` 为当前 key 或 `null`。公共页签身份为模块名加 key，`nav` 对应公共二级菜单 `data-page`。
4. 适配器处理导航、激活、关闭，并负责业务确认、状态保留。公共页签只根据业务返回快照移除，不能提前丢弃业务页。
5. 在根入口登记公共菜单，在 `shell.js` 登记模块页面地址。每个模块只创建一个常驻 iframe，切换时隐藏；不以复制两套外壳作为公共复用。

消息协议为 `erp-workspace-v1`。快照只接受登记 iframe 的 `event.source`，指令只接受父窗口；为支持本地 `file:` 空 origin 使用 `postMessage('*')`，不得去掉 source 校验。协议仅携带页签元数据与命令，不放业务单据内容。

## 版本变更标记

`iteration-marks.js` 提供通用 `<erp-iteration-marks>` 组件：按迭代筛选新增／优化／规则，展示区域编号、变更清单、资料链接和页面定位。预算优化已接入 13 项，其他模块通过自己的配置复用。详见[配置与接入说明](版本标记.md)。

工作台顶部只保留一个“版本标记”工具栏，页面与菜单共用显示开关、迭代筛选、清单、配置和导入导出；配置面板按“标记范围”选择页面或菜单。`version-marks-config.js` 聚合默认 16 项，桥接脚本 `iteration-marks-bridge.js` 协调业务 iframe，自动合并旧的两份浏览器自定义配置。预算 iframe 隐藏重复入口，独立页继续可用；回单业务页不注入。

编号仍贴近原区域，遮字或相撞时向附近空白处微调，不另设标记栏、不改变侧栏宽度。新增模块登记步骤及来源校验见公共标记规范；页签协议保持不变。

## 验证命令

```powershell
node --test 原型/公共/tests/workspace.test.cjs
node --test 原型/公共/tests/iteration-marks.test.cjs
node 原型/公共/tests/iteration-marks.browser.cjs
node 原型/公共/tests/iteration-marks-editor.browser.cjs
node 原型/公共/tests/iteration-marks-layout.browser.cjs
node 原型/公共/tests/iteration-marks-unified.browser.cjs
node 原型/公共/tests/browser-smoke.cjs
```

浏览器脚本需要已安装的 Playwright 与 Chrome，可通过 `ERP_PLAYWRIGHT_MODULE` 指定模块路径。完整结果与复验方法见[验收记录](../../文档/迭代/公共框架验收/验收记录.md)。修改公共样式或协议必须同时检查预算和回单，保持菜单高亮、折叠、未保存关闭与跨模块状态保留。
