/* Shared workbench defaults published from the confirmed browser export (2026-10-27). */
window.ERPVersionMarks = {
  "id": "erp-version-marks",
  "versions": [
    {
      "id": "ERP-I003",
      "label": "预算优化"
    }
  ],
  "marks": [
    {
      "id": "mark-mvqfo4cc-0nqsw",
      "version": "ERP-I003",
      "type": "improved",
      "title": "优化预算编制及执行",
      "page": "navigation",
      "pageLabel": "公共菜单",
      "description": "",
      "delivery": "",
      "scope": "menu",
      "documents": [],
      "selector": "button[data-page=\"overview\"]"
    },
    {
      "id": "mark-mvqgogss-zdm7t",
      "version": "ERP-I003",
      "type": "improved",
      "title": "预算录入优化",
      "page": "overview",
      "pageLabel": "财务预算概览",
      "description": "",
      "delivery": "",
      "scope": "page",
      "module": "budget",
      "selector": "tr:nth-of-type(1) > td:nth-of-type(2) > div.legacy-ops > button[data-action=\"team-nav\"][data-page=\"budget\"]:nth-of-type(1)",
      "documents": []
    },
    {
      "id": "budget-negative",
      "version": "ERP-I003",
      "type": "improved",
      "page": "budget",
      "pageLabel": "团队预算编制",
      "title": "收入预算允许负数",
      "description": "已确认需求：收入科目在预算编制、预算导入及调整申请中允许负数，支出仍按原金额校验。当前原型仍有非负输入约束，此标记用于研发与测试追踪，不能据此判定已实现。",
      "delivery": "需求规则说明 · 原型尚未完整实现 · 需求 3.2",
      "documents": [
        {
          "title": "需求 Word V1.11",
          "url": "文档/迭代/预算优化/预算优化详细需求说明_V1.11.docx"
        }
      ],
      "scope": "page",
      "module": "budget",
      "selector": ".annual-table thead"
    },
    {
      "id": "overview-execution",
      "version": "ERP-I003",
      "type": "new",
      "page": "overview",
      "pageLabel": "财务预算概览",
      "title": "执行入口替换原“实际”入口",
      "description": "保留预算、预测及概览表格结构。“执行”携带责任团队与财年，打开唯一预算执行页签；从其他团队再次进入时复用该页签。",
      "delivery": "原型可演示 · 需求 3.1",
      "documents": [
        {
          "title": "需求 Word V1.11",
          "url": "文档/迭代/预算优化/预算优化详细需求说明_V1.11.docx"
        }
      ],
      "scope": "page",
      "module": "budget",
      "selector": "tr:nth-of-type(1) > td:nth-of-type(2) > div.legacy-ops > button[data-action=\"team-nav\"][data-page=\"execute\"]:nth-of-type(3)"
    },
    {
      "id": "execution-monthly",
      "version": "ERP-I003",
      "type": "new",
      "page": "execute",
      "pageLabel": "月度预算执行",
      "title": "展示预算执行情况",
      "description": "按预算归属月展示预算、实际、当前有效冻结及管控可用额度。实际与冻结支持下钻；收入科目冻结及支出管控额度不适用时显示“—”。",
      "delivery": "原型可演示 · 需求 3.3",
      "documents": [
        {
          "title": "需求 Word V1.11",
          "url": "文档/迭代/预算优化/预算优化详细需求说明_V1.11.docx"
        }
      ],
      "scope": "page",
      "module": "budget",
      "selector": "div.panel.execution-panel"
    },
    {
      "id": "document-lifecycle",
      "version": "ERP-I003",
      "type": "rule",
      "page": "execute",
      "pageLabel": "冻结与实际状态规则",
      "title": "14 类单据冻结、释放及转已使用",
      "description": "正式提交成功冻结；业务／财务审批中、待支付、支付失败继续冻结。驳回（含退回修改）、撤回或终止成功释放，重新提交成功再冻结。内部调账单财务确认成功、费用记账单整条流程审批通过、其余 12 类单据支付成功后整单转已使用，不存在“部分已使用”。",
      "delivery": "需求规则说明 · 生产事件及接口验证待执行 · 需求第 2 节",
      "documents": [
        {
          "title": "状态流转图",
          "url": "文档/迭代/预算优化/图片/预算状态审批流转图.png"
        },
        {
          "title": "需求 Word V1.11",
          "url": "文档/迭代/预算优化/预算优化详细需求说明_V1.11.docx"
        }
      ],
      "scope": "page",
      "module": "budget",
      "selector": "thead > tr"
    },
    {
      "id": "mark-mvqh0baw-q8g7m",
      "version": "ERP-I003",
      "type": "improved",
      "title": "导出预算",
      "page": "overview",
      "pageLabel": "财务预算概览",
      "description": "导出预算excel模版不锁定预算金额输入单元格",
      "delivery": "",
      "scope": "page",
      "module": "budget",
      "selector": "button[data-action=\"legacy-existing\"]:nth-of-type(5)",
      "documents": []
    },
    {
      "id": "menu-application",
      "version": "ERP-I003",
      "type": "improved",
      "page": "navigation",
      "pageLabel": "公共菜单",
      "title": "申请菜单进入团队预算调整",
      "description": "通过办公管理“申请”进入团队预算调整申请入口，选择团队及财年后打开独立工作页签。",
      "delivery": "原型可演示；提交与审批为本地模拟",
      "documents": [],
      "scope": "menu",
      "selector": "[data-module=\"budget\"][data-page=\"application\"]"
    },
    {
      "id": "adjustment-entry",
      "version": "ERP-I003",
      "type": "improved",
      "page": "application",
      "pageLabel": "申请入口",
      "title": "团队预算调整申请入口",
      "description": "从办公管理“申请”选择财年与责任团队后打开调整申请页签；同一团队重复打开复用页签。",
      "delivery": "原型可演示 · 需求 3.7",
      "documents": [
        {
          "title": "需求 Word V1.11",
          "url": "文档/迭代/预算优化/预算优化详细需求说明_V1.11.docx"
        }
      ],
      "scope": "page",
      "module": "budget",
      "selector": ".application-entry"
    },
    {
      "id": "adjustment-request",
      "version": "ERP-I003",
      "type": "new",
      "page": "request",
      "pageLabel": "预算调整申请",
      "title": "预算调整草稿与提交快照",
      "description": "默认当前月，可展开全年；二级科目填写调整后预算及原因，一级自动汇总。草稿按团队保存，未保存关闭需确认，提交后保存只读快照供审批对比。",
      "delivery": "原型可演示本地草稿与提交；不接入真实审批 · 需求 3.7",
      "documents": [
        {
          "title": "需求 Word V1.11",
          "url": "文档/迭代/预算优化/预算优化详细需求说明_V1.11.docx"
        }
      ],
      "scope": "page",
      "module": "budget",
      "selector": ".application-request-page .panel:last-child"
    },
    {
      "id": "menu-approval",
      "version": "ERP-I003",
      "type": "improved",
      "page": "navigation",
      "pageLabel": "公共菜单",
      "title": "审批菜单进入预算调整审批",
      "description": "通过办公管理“审批”进入预算调整审批列表，再查看本次调整与完整预算。正式规则为整条流程审批通过后生效。",
      "delivery": "原型可演示；正式审批及预算生效待实现",
      "documents": [],
      "scope": "menu",
      "selector": "[data-module=\"budget\"][data-page=\"approval\"]"
    },
    {
      "id": "mark-mvqgpydy-ky37i",
      "version": "ERP-I003",
      "type": "improved",
      "title": "预算调整审批",
      "page": "approval",
      "pageLabel": "approval",
      "description": "",
      "delivery": "",
      "scope": "page",
      "module": "budget",
      "selector": "td:nth-of-type(4)",
      "documents": []
    },
    {
      "id": "adjustment-review",
      "version": "ERP-I003",
      "type": "new",
      "page": "adjustment",
      "pageLabel": "预算调整审批详情",
      "title": "审批详情对比本次调整与完整预算",
      "description": "展示原始预算、提交时调整前预算、调整后、变动金额、变动率及科目原因，可定位完整预算。正式规则为整条流程审批通过后预算生效；当前原型审批仅为本地演示。",
      "delivery": "原型可演示对比；真实流程与生效逻辑待联调 · 需求 3.7",
      "documents": [
        {
          "title": "需求 Word V1.11",
          "url": "文档/迭代/预算优化/预算优化详细需求说明_V1.11.docx"
        }
      ],
      "scope": "page",
      "module": "budget",
      "selector": ".adjustment-comparison"
    }
  ]
};
