/* Shared navigation configuration. Keep business-page marks in the owning module. */
window.ERPMenuIterationMarks={
  id:'erp-navigation',
  versions:[{id:'ERP-I003',label:'预算优化'}],
  marks:[
    {id:'menu-office',version:'ERP-I003',type:'new',page:'navigation',pageLabel:'公共菜单',selector:'[data-group="office"] > summary',title:'办公管理菜单接入预算调整',description:'办公管理统一承载申请、审批入口；一级菜单支持展开与折叠，沿用 ERP 公共导航样式。',delivery:'公共入口可演示'},
    {id:'menu-application',version:'ERP-I003',type:'new',page:'navigation',pageLabel:'公共菜单',selector:'[data-module="budget"][data-page="application"]',title:'申请菜单进入团队预算调整',description:'通过办公管理“申请”进入团队预算调整申请入口，选择团队及财年后打开独立工作页签。',delivery:'原型可演示；提交与审批为本地模拟'},
    {id:'menu-approval',version:'ERP-I003',type:'new',page:'navigation',pageLabel:'公共菜单',selector:'[data-module="budget"][data-page="approval"]',title:'审批菜单进入预算调整审批',description:'通过办公管理“审批”进入预算调整审批列表，再查看本次调整与完整预算。正式规则为整条流程审批通过后生效。',delivery:'原型可演示；正式审批及预算生效待实现'}
  ]
};
for(const mark of window.ERPMenuIterationMarks.marks)mark.documents=[{title:'预算优化需求',url:'文档/迭代/预算优化/详细需求说明.md'},{title:'版本标记接入',url:'文档/迭代/预算优化/版本标记接入.md'}];
