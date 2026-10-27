/* ERP-I003 owns its content. The renderer is shared by all ERP iterations. */
window.BudgetIterationMarks={
  id:'budget-optimization',
  versions:[{id:'ERP-I003',label:'预算优化'}],
  marks:[
    {id:'overview-execution',version:'ERP-I003',type:'improved',page:'overview',pageLabel:'财务预算概览',selector:'.legacy-ops [data-page="execute"]',title:'执行入口替换原“实际”入口',description:'保留预算、预测及概览表格结构。“执行”携带责任团队与财年，打开唯一预算执行页签；从其他团队再次进入时复用该页签。',delivery:'原型可演示 · 需求 3.1'},
    {id:'execution-monthly',version:'ERP-I003',type:'improved',page:'execute',pageLabel:'月度预算执行',selector:'.execution-panel table:not(.annual-execution)',title:'月度执行统一展示预算、实际与冻结',description:'按预算归属月展示预算、实际、当前有效冻结及管控可用额度。实际与冻结支持下钻；收入科目冻结及支出管控额度不适用时显示“—”。',delivery:'原型可演示 · 需求 3.3'},
    {id:'execution-subject',version:'ERP-I003',type:'improved',page:'execute',pageLabel:'预算执行',selector:'.subject-cascader',title:'预算科目双栏级联筛选',description:'支持一级／二级科目单选与完整路径回显；选择二级时保留所属一级。月度、全年及导出沿用同一科目范围。',delivery:'原型可演示 · 需求 3.3'},
    {id:'execution-balance',version:'ERP-I003',type:'rule',page:'execute',pageLabel:'月度预算执行',selector:'.execution-panel table:not(.annual-execution) thead th:last-child',title:'可用额度按管控范围扣实际与冻结',description:'根据现有管控方式确定科目池与期间，再计算：可用额度＝范围预算－范围实际值－范围冻结金额。一级共享额度不能在子科目重复相加，累计期间不等于仅本月；点击额度查看计算说明。',delivery:'原型可演示计算说明；正式接口映射与金额对账待联调 · 需求 2.4／3.6'},
    {id:'execution-annual',version:'ERP-I003',type:'improved',page:'execute',pageLabel:'全年预算执行',selector:'.annual-execution',title:'全年执行支持预算／实际／冻结月分布',description:'三项财年汇总保持不变；各月分布可切换预算、实际、冻结，实际和冻结可下钻。全年冻结按预算归属月统计当前余额，不累计历史快照。请切换“全年执行”查看此区域。',delivery:'原型可演示 · 需求 3.3'},
    {id:'frozen-detail',version:'ERP-I003',type:'new',page:'frozen',pageLabel:'在途冻结明细',selector:'.source-summaries',title:'当前有效冻结可追溯到单据分摊行',description:'继承团队、科目与预算归属期间；按费用行／预算分摊行查看当前冻结，单据数去重。支持单据类型、状态、申请人、单号等筛选与导出。',delivery:'原型可演示；正式数据取数与状态映射待联调 · 需求 3.4'},
    {id:'actual-detail',version:'ERP-I003',type:'improved',page:'actual',pageLabel:'实际使用明细',selector:'.source-summaries',title:'实际明细区分单据使用与人工导入',description:'展示实际使用净额、来源类型、预算科目、归属月、申请人及确认日期。原单查看与人工导入批次追溯分别处理，导出沿用完整筛选范围。',delivery:'原型可演示 · 需求 3.5'},
    {id:'budget-negative',version:'ERP-I003',type:'rule',page:'budget',pageLabel:'团队预算编制',selector:'.annual-table thead',title:'收入预算允许负数',description:'已确认需求：收入科目在预算编制、预算导入及调整申请中允许负数，支出仍按原金额校验。当前原型仍有非负输入约束，此标记用于研发与测试追踪，不能据此判定已实现。',delivery:'需求规则说明 · 原型尚未完整实现 · 需求 3.2'},
    {id:'adjustment-entry',version:'ERP-I003',type:'new',page:'application',pageLabel:'申请入口',selector:'.application-entry',title:'团队预算调整申请入口',description:'从办公管理“申请”选择财年与责任团队后打开调整申请页签；同一团队重复打开复用页签。',delivery:'原型可演示 · 需求 3.7'},
    {id:'adjustment-request',version:'ERP-I003',type:'new',page:'request',pageLabel:'预算调整申请',selector:'.application-request-page .panel:last-child',title:'预算调整草稿与提交快照',description:'默认当前月，可展开全年；二级科目填写调整后预算及原因，一级自动汇总。草稿按团队保存，未保存关闭需确认，提交后保存只读快照供审批对比。',delivery:'原型可演示本地草稿与提交；不接入真实审批 · 需求 3.7'},
    {id:'adjustment-review',version:'ERP-I003',type:'new',page:'adjustment',pageLabel:'预算调整审批详情',selector:'.adjustment-comparison',title:'审批详情对比本次调整与完整预算',description:'展示原始预算、提交时调整前预算、调整后、变动金额、变动率及科目原因，可定位完整预算。正式规则为整条流程审批通过后预算生效；当前原型审批仅为本地演示。',delivery:'原型可演示对比；真实流程与生效逻辑待联调 · 需求 3.7'},
    {id:'document-lifecycle',version:'ERP-I003',type:'rule',page:'frozen',pageLabel:'冻结与实际状态规则',title:'14 类单据冻结、释放及转已使用',description:'正式提交成功冻结；业务／财务审批中、待支付、支付失败继续冻结。驳回（含退回修改）、撤回或终止成功释放，重新提交成功再冻结。内部调账单财务确认成功、费用记账单整条流程审批通过、其余 12 类单据支付成功后整单转已使用，不存在“部分已使用”。',delivery:'需求规则说明 · 生产事件及接口验证待执行 · 需求第 2 节',documents:[{title:'状态流转图',url:'文档/迭代/预算优化/图片/预算状态审批流转图.png'}]},
    {id:'historical-rebuild',version:'ERP-I003',type:'rule',page:'frozen',pageLabel:'上线历史数据处理',title:'历史冻结与实际按单据重建',description:'上线前不沿用有缺陷的旧汇总总额，按历史单据状态、有效结果及预算分摊重建冻结和实际明细，保留取数快照、核对结果与切换记录。该项属于上线数据方案，没有可点击的业务页面区域。',delivery:'需求规则说明 · 数据迁移与核验待执行 · 需求第 5 节'}
  ]
};
for(const mark of window.BudgetIterationMarks.marks){
  mark.documents=[...(mark.documents||[]),{title:'需求 Word V1.11',url:'文档/迭代/预算优化/预算优化详细需求说明_V1.11.docx'},{title:'需求 Markdown',url:'文档/迭代/预算优化/详细需求说明.md'},{title:'测试验收清单',url:'文档/迭代/预算优化/测试验收清单.md'}];
}
