(function (root) {
  'use strict';

  if (typeof document === 'undefined') {
    return;
  }

  const ALL = '\u5168\u90e8';
  const ReceiptLogic = root.ReceiptLogic;
  const IntegrationActionLogic = root.IntegrationActionLogic;
  const RECEIPT_DOCUMENTS = root.RECEIPT_DOCUMENTS;
  const PAYER_OPTIONS = root.PAYER_OPTIONS;
  const DOCUMENT_STORAGE_KEY = 'receipt-app-documents-v1';
  let toastTimer;
  let erpWorkspace = null;

  const state = {
    filters: {
      keyword: '',
      status: ALL,
      receiptStatus: ALL,
      kingdeeStatus: ALL,
      type: ALL,
      overseas: ALL,
      invoice: ALL,
      payer: ALL,
      datePreset: ALL,
      startDate: '',
      endDate: '',
      approvalDatePreset: ALL,
      approvalStartDate: '',
      approvalEndDate: '',
      payeeType: ALL,
    },
    page: 1,
    pageSize: 8,
    expandedIds: new Set(),
    lastFocusedElement: null,
    detailDocumentId: null,
    detailReturnFocus: null,
    operationDocumentId: null,
    operationAction: null,
    operationLastFocusedElement: null,
  };

  function escapeHtml(value) {
    return String(value)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  function displayValue(value) {
    return value === undefined || value === null || value === '' ? '--' : String(value);
  }

  function formatOperator(operator) {
    const value = displayValue(operator);
    if (value === '\u7cfb\u7edf' || value === '--' || /\uff08.+\uff09$/.test(value)) {
      return value;
    }
    const employeeNumbers = {
      '\u8d22\u52a1\u4e13\u5458': 'F0001',
      '\u8d85\u7ea7\u7ba1\u7406\u5458': 'A0001',
    };
    return employeeNumbers[value] ? value + '\uff08' + employeeNumbers[value] + '\uff09' : value;
  }

  function formatMoney(value) {
    const amount = Number(value);
    if (!Number.isFinite(amount)) {
      return '--';
    }

    return new Intl.NumberFormat('zh-CN', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(amount);
  }

  function formatDate(value) {
    if (!value) {
      return '--';
    }

    const date = new Date(value);
    if (Number.isNaN(date.getTime())) {
      return '--';
    }

    const pad = function (part) { return String(part).padStart(2, '0'); };
    return [date.getFullYear(), pad(date.getMonth() + 1), pad(date.getDate())].join('-')
      + ' ' + [pad(date.getHours()), pad(date.getMinutes()), pad(date.getSeconds())].join(':');
  }

  function getStatusClass(status) {
    if (status === '\u5df2\u652f\u4ed8') {
      return 'status';
    }
    if (status === '\u5f85\u8d22\u52a1\u5ba1\u6838' || status === '\u5f85\u652f\u4ed8') {
      return 'status status--pending';
    }
    if (status === '\u652f\u4ed8\u5931\u8d25') {
      return 'status status--failed';
    }
    if (status === '\u5df2\u9a73\u56de') {
      return 'status status--rejected';
    }
    return 'status';
  }

  function getIntegrationStatusClass(status) {
    if (status === '—') {
      return 'status status--not-started';
    }
    if (status === '\u5df2\u5f52\u6863' || status === '\u540c\u6b65\u6210\u529f') {
      return 'status';
    }
    if (status === '\u5f85\u62c9\u53d6' || status === '\u5f85\u540c\u6b65') {
      return 'status status--pending';
    }
    if (status === '\u62c9\u53d6\u5931\u8d25' || status === '\u540c\u6b65\u5931\u8d25' || status === '部分失败') {
      return 'status status--failed';
    }
    return 'status';
  }

  function getVisibleDocuments() {
    return ReceiptLogic.filterDocuments(RECEIPT_DOCUMENTS, state.filters);
  }

  function getDocumentById(id) {
    return (RECEIPT_DOCUMENTS || []).find(function (item) {
      return String(item.id) === String(id);
    });
  }

  function persistDocuments() {
    try {
      if (root.localStorage && Array.isArray(RECEIPT_DOCUMENTS)) {
        root.localStorage.setItem(DOCUMENT_STORAGE_KEY, JSON.stringify(RECEIPT_DOCUMENTS));
      }
    } catch (error) {
      // Local file previews continue to work in the current page if storage is unavailable.
    }
  }

  function hydrateDocumentsFromStorage() {
    try {
      if (!root.localStorage || !Array.isArray(RECEIPT_DOCUMENTS)) return;
      const stored = JSON.parse(root.localStorage.getItem(DOCUMENT_STORAGE_KEY) || 'null');
      if (!Array.isArray(stored) || !stored.length) return;
      const storedDocumentsById = new Map(stored.map(function (document) {
        return [String(document.id), document];
      }));
      const mergedDocuments = RECEIPT_DOCUMENTS.map(function (document) {
        return storedDocumentsById.get(String(document.id)) || document;
      });
      stored.forEach(function (document) {
        if (!RECEIPT_DOCUMENTS.some(function (seedDocument) {
          return String(seedDocument.id) === String(document.id);
        })) {
          mergedDocuments.push(document);
        }
      });
      RECEIPT_DOCUMENTS.splice.apply(RECEIPT_DOCUMENTS, [0, RECEIPT_DOCUMENTS.length].concat(mergedDocuments));
    } catch (error) {
      // Ignore incomplete or inaccessible local storage and use the mock data instead.
    }
  }

  function normalizeDocumentFields() {
    if (!Array.isArray(RECEIPT_DOCUMENTS)) return;
    RECEIPT_DOCUMENTS.forEach(function (document) {
      if (document.receiptStatus === '部分拉取失败') {
        document.receiptStatus = '拉取失败';
        document.receiptNumber = '';
        document.fileName = '';
        document.receiptFiles = [];
      }
      if (document.id === '202608060006') {
        document.overseas = false;
        document.payer = '博商科技（深圳）有限公司';
        document.cbsNumber = 'CBS20260806006';
        document.cbsApplicationNumber = 'CBSAPP20260806006';
        document.receiptStatus = '拉取失败';
        document.receiptFailureReason = 'CBS未返回电子回单，请人工上传';
        document.kingdeeStatus = '—';
        document.kingdeeCode = '';
        document.kingdeeFailureReason = '';
      }
      if (document.id === '202608100002' && document.kingdeeStatus === '同步成功') {
        document.kingdeeStatus = '部分失败';
        document.kingdeeCode = '';
        document.kingdeeFailureReason = '拆单时部分单据同步失败、部分附件同步失败';
        if (Array.isArray(document.timeline)) {
          document.timeline.forEach(function (event) {
            if (event.action === '同步金蝶') {
              event.note = '金蝶部分失败：' + document.kingdeeFailureReason;
            }
          });
        }
      }
      if (document.overseas && document.payer !== 'Sands Bosum Business Pte. Ltd') {
        document.payer = 'Sands Bosum Business Pte. Ltd';
      }
      document.isOverseasPayment = isOverseasPayment(document);
      if (document.isOverseasPayment) {
        document.receiptStatus = '—';
        document.receiptNumber = '';
        document.receiptFiles = [];
        document.cbsNumber = '';
        document.cbsApplicationNumber = '';
        document.receiptFailureReason = '';
        if (Array.isArray(document.timeline)) {
          document.timeline = document.timeline.filter(function (event) {
            return event.action !== '提交付款' && event.action !== '获取支付结果' && event.action !== '拉取回单结果';
          });
        }
        if (document.isOverseasPayment && document.status === '已支付' && document.kingdeeStatus === '—') {
          document.kingdeeStatus = '同步成功';
          document.kingdeeCode = 'FKD' + String(document.id || '').slice(-7).padStart(7, '0');
          document.kingdeeFailureReason = '';
          document.timeline = Array.isArray(document.timeline) ? document.timeline : [];
          if (!document.timeline.some(function (event) { return event.action === '同步金蝶'; })) {
            document.timeline.push({
              action: '同步金蝶',
              note: '同步成功，金蝶编码：' + document.kingdeeCode,
              operator: '系统',
              at: document.statusAt || document.createdAt,
            });
          }
        }
      }
      if (!document.payeeType) {
        document.payeeType = (document.type === '报销单' || document.type === '差旅报销单') ? '个人' : '公司';
      }
      if (document.approvalPassedAt === undefined) {
        document.approvalPassedAt = ['待支付', '支付失败', '已支付'].includes(document.status)
          ? document.createdAt
          : '';
      }
      if (Array.isArray(document.timeline)
        && document.timeline.some(function (event) { return event.action === '手动支付'; })) {
        document.timeline = document.timeline.filter(function (event) {
          return event.action !== '提交付款' && event.action !== '获取支付结果';
        });
      }
    });
  }

  function replaceDocument(updated) {
    if (!updated || !Array.isArray(RECEIPT_DOCUMENTS)) {
      return false;
    }
    const index = RECEIPT_DOCUMENTS.findIndex(function (item) {
      return String(item.id) === String(updated.id);
    });
    if (index < 0) {
      return false;
    }
    RECEIPT_DOCUMENTS.splice(index, 1, updated);
    persistDocuments();
    return true;
  }

  function actionLabel(action) {
    const labels = {
      'approve': '\u5ba1\u6279',
      'reject': '\u9a73\u56de',
      'pay': '\u652f\u4ed8',
      'upload-receipt': '\u4e0a\u4f20\u56de\u5355',
      'sync-kingdee': '\u540c\u6b65\u91d1\u8776',
    };
    return labels[action] || '\u5904\u7406\u5355\u636e';
  }

  function operationTitle(action) {
    const titles = {
      'approve': '\u5ba1\u6279\u901a\u8fc7',
      'reject': '\u9a73\u56de\u5355\u636e',
      'pay': '\u786e\u8ba4\u652f\u4ed8',
      'upload-receipt': '\u4e0a\u4f20\u56de\u5355',
      'sync-kingdee': '\u786e\u8ba4\u540c\u6b65\u91d1\u8776',
    };
    return titles[action] || actionLabel(action);
  }

  function getWorkflowActions(receipt) {
    const actions = IntegrationActionLogic && typeof IntegrationActionLogic.getAvailableActions === 'function'
      ? IntegrationActionLogic.getAvailableActions(receipt)
      : [];
    return actions;
  }

  function getLatestFailureReason(receipt) {
    if (!IntegrationActionLogic || typeof IntegrationActionLogic.getLatestFailureReason !== 'function') {
      return '';
    }
    return IntegrationActionLogic.getLatestFailureReason(receipt);
  }

  function isOverseasPayment(receipt) {
    return Boolean(receipt && (
      receipt.isOverseasPayment
      || (IntegrationActionLogic && typeof IntegrationActionLogic.isOverseasPayment === 'function'
        && IntegrationActionLogic.isOverseasPayment(receipt))
    ));
  }

  function renderStateActionButtons(receipt, approvalMode) {
    const id = escapeHtml(displayValue(receipt.id));
    return getWorkflowActions(receipt).map(function (action) {
      if (action === 'approve' && !approvalMode) {
        return '<button class="operation-button" type="button" data-action="approval-page" data-id="' + id + '">\u5ba1\u6279</button>';
      }
      const changeType = {
        pay: 'updated',
        'upload-receipt': 'new',
        'sync-kingdee': 'new',
      }[action];
      const actionTitle = changeType ? ' title="本次' + (changeType === 'new' ? '新增' : '调整') + '：' + actionLabel(action) + '"' : '';
      return (changeType ? '<span class="change-marker-anchor">' : '')
        + '<button class="operation-button" type="button" data-action="operation" data-operation="'
        + escapeHtml(action) + '" data-id="' + id + '"' + actionTitle + '>' + escapeHtml(action === 'approve' ? '\u5ba1\u6279' : actionLabel(action)) + '</button>'
        + (changeType
          ? '<span class="change-marker change-marker--' + changeType + '" title="本次' + (changeType === 'new' ? '新增' : '调整') + '：' + actionLabel(action) + '"></span>'
          : '')
        + (changeType ? '</span>' : '');
    }).join('');
  }

  function renderOperationButtons(receipt, showCommonMarkers) {
    const id = escapeHtml(displayValue(receipt.id));
    const detailMarker = showCommonMarkers
      ? '<span class="change-marker change-marker--updated" title="本次调整：详情"></span>'
      : '';
    const logMarker = showCommonMarkers
      ? '<span class="change-marker change-marker--new" title="本次新增：日志"></span>'
      : '';
    const detailTitle = showCommonMarkers ? ' title="本次调整：详情"' : '';
    const logTitle = showCommonMarkers ? ' title="本次新增：日志"' : '';
    return '<div class="table-actions">'
      + (showCommonMarkers ? '<span class="change-marker-anchor">' : '')
      + '<button class="detail-button" type="button" data-action="details" data-id="' + id + '"' + detailTitle + '>\u8be6\u60c5</button>'
      + detailMarker
      + (showCommonMarkers ? '</span>' : '')
      + (showCommonMarkers ? '<span class="change-marker-anchor">' : '')
      + '<button class="log-button" type="button" data-action="logs" data-id="' + id + '"' + logTitle + '>\u65e5\u5fd7</button>'
      + logMarker
      + (showCommonMarkers ? '</span>' : '')
      + renderStateActionButtons(receipt)
      + '</div>';
  }

  function renderRows(items) {
    const body = document.getElementById('receipt-table-body');
    if (!body) {
      return;
    }

    if (!items.length) {
      body.innerHTML = '<tr class="empty-row"><td colspan="23">'
        + '<span>\u6682\u65e0\u7b26\u5408\u6761\u4ef6\u7684\u5355\u636e</span> '
        + '<button class="text-button" type="button" data-action="clear-filters">\u6e05\u9664\u7b5b\u9009</button>'
        + '</td></tr>';
      return;
    }

    body.innerHTML = items.map(function (receipt, index) {
      const id = displayValue(receipt.id);
      const expanded = state.expandedIds.has(String(receipt.id));
      const contentClass = expanded ? 'content-cell is-expanded' : 'content-cell';
      const contentTextClass = expanded ? 'cell-text is-expanded' : 'cell-text';
      const domesticAmount = receipt.currency === 'CNY' ? formatMoney(receipt.amount) : '--';
      const foreignAmount = receipt.currency && receipt.currency !== 'CNY'
        ? formatMoney(receipt.amount) + ' ' + displayValue(receipt.currency)
        : '--';
      return '<tr>'
        + '<td>' + renderOperationButtons(receipt, index === 0) + '</td>'
        + '<td><span class="cell-text">' + escapeHtml(id) + '</span></td>'
        + '<td><button class="title-link cell-text" type="button" data-action="details" data-id="' + escapeHtml(id) + '">' + escapeHtml(displayValue(receipt.title)) + '</button></td>'
        + '<td>' + escapeHtml(receipt.invoice ? '\u662f' : '\u5426') + '</td>'
        + '<td>' + escapeHtml(receipt.overseas ? '\u662f' : '\u5426') + '</td>'
        + '<td>' + escapeHtml(receipt.kingdeeStatus === '\u540c\u6b65\u6210\u529f' ? displayValue(receipt.kingdeeCode) : '\u2014') + '</td>'
        + '<td><span class="cell-text">' + escapeHtml(isOverseasPayment(receipt) ? '\u2014' : displayValue(receipt.cbsNumber)) + '</span></td>'
        + '<td>' + escapeHtml(formatDate(receipt.createdAt)) + '</td>'
        + '<td>' + escapeHtml(formatDate(receipt.approvalPassedAt)) + '</td>'
        + '<td>' + escapeHtml(displayValue(receipt.applicant)) + '</td>'
        + '<td><span class="cell-text">' + escapeHtml(displayValue(receipt.department)) + '</span></td>'
        + '<td><span class="cell-text">' + escapeHtml(displayValue(receipt.payer)) + '</span></td>'
        + '<td class="' + contentClass + '"><span class="' + contentTextClass + '">' + escapeHtml(displayValue(receipt.content)) + '</span>'
        + '<button class="content-toggle" type="button" data-action="toggle-content" data-id="' + escapeHtml(id) + '" aria-expanded="' + String(expanded) + '">'
        + (expanded ? '\u6536\u8d77' : '\u5c55\u5f00') + '</button></td>'
        + '<td>' + escapeHtml(domesticAmount) + '</td>'
        + '<td>' + escapeHtml(foreignAmount) + '</td>'
        + '<td>' + escapeHtml(displayValue(receipt.type)) + '</td>'
        + '<td><span class="' + getStatusClass(receipt.status) + '">' + escapeHtml(displayValue(receipt.status)) + '</span></td>'
        + '<td>' + escapeHtml(displayValue(receipt.payeeType)) + '</td>'
        + '<td><span class="' + getIntegrationStatusClass(receipt.receiptStatus) + '">' + escapeHtml(displayValue(receipt.receiptStatus)) + '</span></td>'
        + '<td><span class="' + getIntegrationStatusClass(receipt.kingdeeStatus) + '">' + escapeHtml(displayValue(receipt.kingdeeStatus)) + '</span></td>'
        + '<td>' + escapeHtml(formatDate(receipt.statusAt)) + '</td>'
        + '<td><span class="cell-text">' + escapeHtml(getLatestFailureReason(receipt) || '\u2014') + '</span></td>'
        + '<td>' + escapeHtml(displayValue(receipt.approver)) + '</td>'
        + '</tr>';
    }).join('');
  }

  function pageButton(label, page, disabled, current, action) {
    const disabledAttribute = disabled ? ' disabled' : '';
    const currentAttribute = current ? ' aria-current="page"' : '';
    const actionAttribute = action ? ' data-page-action="' + action + '"' : '';
    return '<button type="button" data-page="' + page + '"' + actionAttribute + currentAttribute + disabledAttribute + '>'
      + escapeHtml(label) + '</button>';
  }

  function renderPagination(pageData) {
    const pagination = document.getElementById('pagination');
    if (!pagination) {
      return;
    }

    const controls = [
      pageButton('\u9996\u9875', 1, pageData.page === 1, false, 'first'),
      pageButton('\u4e0a\u4e00\u9875', pageData.page - 1, pageData.page === 1, false, 'previous'),
    ];

    for (let page = 1; page <= pageData.totalPages; page += 1) {
      controls.push(pageButton(String(page), page, false, page === pageData.page));
    }

    controls.push(pageButton('\u4e0b\u4e00\u9875', pageData.page + 1, pageData.page === pageData.totalPages, false, 'next'));
    controls.push(pageButton('\u5c3e\u9875', pageData.totalPages, pageData.page === pageData.totalPages, false, 'last'));
    pagination.innerHTML = controls.join('');
  }

  function renderResultSummary(total) {
    const summary = document.getElementById('result-summary');
    if (summary) {
      summary.textContent = '\u5171 ' + total + ' \u6761\u8bb0\u5f55';
    }
  }

  function render() {
    const visibleDocuments = getVisibleDocuments();
    const pageData = ReceiptLogic.paginate(visibleDocuments, state.page, state.pageSize);
    state.page = pageData.page;
    renderRows(pageData.items);
    renderPagination(pageData);
    renderResultSummary(pageData.total);
    syncFilterControls();
  }

  function detailRow(label, value, isMultiline) {
    const content = escapeHtml(displayValue(value));
    const formattedContent = isMultiline ? content.replace(/\r?\n/g, '<br>') : content;
    const rowClass = isMultiline ? 'detail-row detail-row--content' : 'detail-row';
    return '<div class="' + rowClass + '"><dt>' + escapeHtml(label) + '</dt><dd>' + formattedContent + '</dd></div>';
  }

  function approvalField(label, value, options) {
    const settings = options || {};
    const classes = ['approval-field'];
    if (settings.wide) classes.push('approval-field--wide');
    const labelClass = settings.required ? ' class="is-required"' : '';
    const content = escapeHtml(displayValue(value));
    return '<div class="' + classes.join(' ') + '"><dt' + labelClass + '>' + escapeHtml(label)
      + '</dt><dd>' + (settings.multiline ? content.replace(/\r?\n/g, '<br>') : content) + '</dd></div>';
  }

  function renderApprovalDetailPage(receipt, approvalMode) {
    const page = document.getElementById('approval-detail-page');
    if (!page || !receipt) return;

    const amountWithCurrency = formatMoney(receipt.amount) + ' ' + displayValue(receipt.currency);
    const overseasPayment = isOverseasPayment(receipt);
    const receiptFile = receipt.receiptNumber ? '支付回单_' + receipt.receiptNumber + '.pdf' : '';
    const actionButtons = renderStateActionButtons(receipt, true)
      .replace(/operation-button/g, 'operation-button operation-button--detail')
      + '<span class="change-marker-anchor"><button class="operation-button operation-button--detail file-preview-button" type="button" data-action="file-preview" data-id="'
        + escapeHtml(displayValue(receipt.id)) + '" title="本次调整：文件预览">文件预览</button>'
        + '<span class="change-marker change-marker--updated" title="本次调整：文件预览"></span></span>';
    page.innerHTML = '<div class="approval-detail-page__tabs" aria-label="页面标签">'
      + '<button type="button" data-action="approval-detail-back">审批确认</button>'
      + '<button class="detail-tab-active" type="button" aria-current="page" data-action="approval-detail-close">审批详情 <span aria-hidden="true">×</span></button>'
      + '</div><div class="approval-detail-page__toolbar">'
      + actionButtons
      + '</div><div class="approval-detail-page__content"><section class="detail-card">'
      + '<div class="detail-card__tabs" role="tablist" aria-label="详情内容">'
      + '<button class="is-active" type="button" role="tab" aria-selected="true" data-action="approval-detail-tab" data-tab="form">表单详情</button>'
      + '<button type="button" role="tab" aria-selected="false" data-action="approval-detail-tab" data-tab="history">审批记录</button></div>'
      + '<div class="detail-card__panel approval-form" data-detail-panel="form"><dl class="approval-fields">'
      + approvalField('标题', receipt.title, { required: true })
      + approvalField('申请人', receipt.applicant, { required: true })
      + approvalField('申请部门', receipt.department, { required: true })
      + approvalField('申请时间', formatDate(receipt.createdAt), { required: true })
      + approvalField('付款主体', receipt.payer, { required: true })
      + approvalField('单据类型', receipt.type, { required: true })
      + approvalField('表单状态', receipt.status)
      + (overseasPayment ? '' : approvalField('回单状态', receipt.receiptStatus))
      + approvalField('金蝶状态', receipt.kingdeeStatus)
      + approvalField('金额', amountWithCurrency, { required: true })
      + approvalField('金蝶编码', receipt.kingdeeStatus === '同步成功' ? receipt.kingdeeCode : '—')
      + approvalField('CBS流水号', overseasPayment ? '—' : (receipt.cbsNumber || '—'))
      + approvalField('内容', receipt.content, { wide: true, multiline: true })
      + '</dl><section class="approval-detail-section"><h3>费用明细</h3><table class="approval-detail-table"><thead><tr>'
      + '<th>费用类型</th><th>费用内容</th><th>报销金额（' + escapeHtml(displayValue(receipt.currency)) + '）</th><th>审核金额（' + escapeHtml(displayValue(receipt.currency)) + '）</th><th>事由</th>'
      + '</tr></thead><tbody><tr><td>' + escapeHtml(displayValue(receipt.type)) + '</td><td>' + escapeHtml(displayValue(receipt.title)) + '</td><td>' + escapeHtml(formatMoney(receipt.amount)) + '</td><td>' + escapeHtml(formatMoney(receipt.amount)) + '</td><td>' + escapeHtml(displayValue(receipt.content)) + '</td></tr></tbody></table></section>'
      + '<section class="approval-detail-section"><h3>附件</h3><div class="approval-attachments">'
      + (receiptFile ? '<span class="approval-attachment">' + escapeHtml(receiptFile) + '</span>' : '<span class="approval-detail-empty">暂无附件</span>')
      + '</div></section></div>'
      + '<div class="detail-card__panel approval-history" data-detail-panel="history" hidden>' + renderOperationLogs(receipt.timeline)
      + '</div></section></div>';
  }

  function getReceiptPreviewFiles(receipt) {
    if (!receipt || receipt.receiptStatus !== '已归档') return [];
    const manualEvent = (receipt.timeline || []).slice().reverse().find(function (event) {
      return event.action === '手动上传回单';
    });
    const files = manualEvent && Array.isArray(manualEvent.fileNames) ? manualEvent.fileNames
      : (Array.isArray(receipt.receiptFiles) ? receipt.receiptFiles : []);
    if (files.length) {
      return files.map(function (name) { return { name: name, source: '手动上传' }; });
    }
    return receipt.receiptNumber
      ? [{ name: 'CBS回单_' + receipt.receiptNumber + '.pdf', source: 'CBS自动拉取' }]
      : [];
  }

  function renderFilePreviewPage(receipt, selectedFileName) {
    const page = document.getElementById('file-preview-page');
    if (!page || !receipt) return;
    const receiptFiles = getReceiptPreviewFiles(receipt);
    const files = [
      { category: '流程附件', name: '审批单_' + receipt.id + '.pdf', source: '审批单' },
    ].concat(receipt.invoice ? [{ category: '发票', name: '发票_' + receipt.id + '.pdf', source: '发票' }] : [], receiptFiles.map(function (file) {
      return { category: '回单', name: file.name, source: file.source };
    }));
    const active = files.find(function (file) { return file.name === selectedFileName; }) || files[0];
    const categories = ['流程附件', '发票', '回单'];
    const listHtml = categories.map(function (category) {
      const categoryFiles = files.filter(function (file) { return file.category === category; });
      const categoryLabel = category === '回单'
        ? '<span class="change-marker-anchor">' + escapeHtml(category)
          + '<span class="change-marker change-marker--new" title="本次新增：回单文件分类"></span></span>'
        : escapeHtml(category);
      return '<section class="preview-category" data-preview-category="' + (category === '回单' ? 'receipt' : category === '发票' ? 'invoice' : 'process') + '">'
        + '<h3>' + categoryLabel + '<span>' + categoryFiles.length + '</span></h3>'
        + (categoryFiles.length ? '<div>' + categoryFiles.map(function (file) {
          const current = active.name === file.name;
          return '<button class="preview-file' + (current ? ' is-active' : '') + '" type="button" data-action="preview-file" data-id="'
            + escapeHtml(displayValue(receipt.id)) + '" data-file-name="' + escapeHtml(file.name) + '">▧ ' + escapeHtml(file.name) + '</button>';
        }).join('') + '</div>' : '<p class="preview-category__empty">暂无文件</p>')
        + '</section>';
    }).join('');

    page.innerHTML = '<div class="file-preview-page__tabs"><button type="button" data-action="file-preview-back">审批确认</button>'
      + '<button class="detail-tab-active" type="button" aria-current="page" data-action="file-preview-close">文件预览 <span aria-hidden="true">×</span></button></div>'
      + '<div class="file-preview-page__header"><span>单据号：' + escapeHtml(displayValue(receipt.id)) + '</span><span>状态：' + escapeHtml(displayValue(receipt.status)) + '</span>'
      + '<button class="text-button" type="button" data-action="file-preview-back">返回详情</button></div>'
      + '<div class="file-preview-layout"><aside class="file-preview-sidebar"><div class="file-preview-search">⌕ 搜索文件名</div>' + listHtml + '</aside>'
      + '<section class="file-preview-viewer"><div class="file-preview-viewer__bar"><span>' + escapeHtml(active.name) + '</span><span>◀ 1 / 1 ▶　100%　＋</span><button type="button" data-action="preview-download">⇩ 下载</button></div>'
      + '<div class="file-preview-canvas"><article class="receipt-document"><p class="receipt-document__eyebrow">付款报销管理系统</p><h1>' + escapeHtml(active.category) + '</h1>'
      + '<dl><div><dt>单据号</dt><dd>' + escapeHtml(displayValue(receipt.id)) + '</dd></div><div><dt>文件来源</dt><dd>' + escapeHtml(active.source) + '</dd></div>'
      + '<div><dt>回单号</dt><dd>' + escapeHtml(displayValue(receipt.receiptNumber)) + '</dd></div><div><dt>付款主体</dt><dd>' + escapeHtml(displayValue(receipt.payer)) + '</dd></div>'
      + '<div><dt>金额</dt><dd>' + escapeHtml(formatMoney(receipt.amount)) + ' ' + escapeHtml(displayValue(receipt.currency)) + '</dd></div><div><dt>状态</dt><dd>' + escapeHtml(displayValue(receipt.receiptStatus)) + '</dd></div></dl>'
      + '<p class="receipt-document__note">此处为本地模拟的文件预览内容。</p></article></div></section></div>';
  }

  function renderTimeline(timeline) {
    const events = Array.isArray(timeline) ? timeline.slice().reverse() : [];
    if (!events.length) {
      return '<section class="timeline" aria-label="\u5904\u7406\u8bb0\u5f55"><h3>\u5904\u7406\u8bb0\u5f55</h3><p class="timeline__empty">\u6682\u65e0\u5904\u7406\u8bb0\u5f55</p></section>';
    }
    return '<section class="timeline" aria-label="\u5904\u7406\u8bb0\u5f55"><h3>\u5904\u7406\u8bb0\u5f55</h3>'
      + events.map(function (event) {
        const extras = [];
        if (event.receiptNumber) extras.push('\u56de\u5355\u53f7\uff1a' + escapeHtml(event.receiptNumber));
        if (event.fileName) extras.push('\u6587\u4ef6\uff1a' + escapeHtml(event.fileName));
        return '<div class="timeline-item"><span class="timeline-dot" aria-hidden="true"></span><div>'
          + '<strong>' + escapeHtml(displayValue(event.action)) + '</strong>'
          + '<p>' + escapeHtml(formatDate(event.at)) + ' \u00b7 ' + escapeHtml(formatOperator(event.operator)) + '</p>'
          + (event.note ? '<p class="timeline-note">' + escapeHtml(event.note) + '</p>' : '')
          + (extras.length ? '<p>' + extras.join(' / ') + '</p>' : '')
          + '</div></div>';
      }).join('') + '</section>';
  }

  function renderOperationLogs(timeline) {
    const events = Array.isArray(timeline) ? timeline.slice().reverse() : [];
    if (!events.length) {
      return '<section class="operation-log" aria-label="操作日志"><p class="timeline__empty">暂无操作日志</p></section>';
    }
    return '<section class="operation-log" aria-label="操作日志"><div class="operation-log__scroll"><table>'
      + '<thead><tr><th>操作时间</th><th>操作人</th><th>操作节点</th><th>备注</th></tr></thead><tbody>'
      + events.map(function (event) {
        return '<tr><td>' + escapeHtml(formatDate(event.at)) + '</td>'
          + '<td>' + escapeHtml(formatOperator(event.operator)) + '</td>'
          + '<td>' + escapeHtml(displayValue(event.action)) + '</td>'
          + '<td>' + escapeHtml(displayValue(event.note)) + '</td></tr>';
      }).join('')
      + '</tbody></table></div></section>';
  }

  function openDetails(id, options) {
    const dialog = document.getElementById('detail-dialog');
    const content = document.getElementById('detail-dialog-content');
    const title = document.getElementById('detail-dialog-title');
    const closeButton = document.getElementById('detail-dialog-close');
    const receipt = getDocumentById(id);

    if (!dialog || !content || !receipt) {
      showToast('\u672a\u627e\u5230\u8be5\u5355\u636e');
      return;
    }

    const preserveFocus = options && options.preserveFocus;
    const approvalMode = options && options.approvalMode;
    if (!preserveFocus && document.activeElement && typeof document.activeElement.focus === 'function') {
      state.lastFocusedElement = document.activeElement;
      state.detailReturnFocus = {
        id: String(id),
        isTitleLink: document.activeElement.classList.contains('title-link'),
        element: document.activeElement,
      };
    }

    const amountWithCurrency = formatMoney(receipt.amount) + ' ' + displayValue(receipt.currency);
    const overseasPayment = isOverseasPayment(receipt);
    if (title) title.textContent = approvalMode ? '\u5ba1\u6279\u8be6\u60c5' : '\u5355\u636e\u8be6\u60c5';
    state.detailDocumentId = String(receipt.id);
    content.innerHTML = '<dl class="detail-list">'
      + detailRow('\u5355\u53f7', receipt.id)
      + detailRow('\u6807\u9898', receipt.title)
      + detailRow('\u5355\u636e\u7c7b\u578b', receipt.type)
      + detailRow('\u7533\u8bf7\u4eba', receipt.applicant)
      + detailRow('\u7533\u8bf7\u90e8\u95e8', receipt.department)
      + detailRow('\u4ed8\u6b3e\u4e3b\u4f53', receipt.payer)
      + detailRow('\u7533\u8bf7\u65f6\u95f4', formatDate(receipt.createdAt))
      + detailRow('\u91d1\u989d / \u5e01\u79cd', amountWithCurrency)
      + detailRow('\u662f\u5426\u6709\u53d1\u7968', receipt.invoice ? '\u662f' : '\u5426')
      + detailRow('\u662f\u5426\u6d89\u6d77\u5916', receipt.overseas ? '\u662f' : '\u5426')
      + detailRow('\u72b6\u6001', receipt.status)
      + (overseasPayment ? '' : detailRow('\u56de\u5355\u72b6\u6001', receipt.receiptStatus))
      + detailRow('\u91d1\u8776\u72b6\u6001', receipt.kingdeeStatus)
      + detailRow('\u91d1\u8776\u7f16\u7801', receipt.kingdeeStatus === '\u540c\u6b65\u6210\u529f' ? receipt.kingdeeCode : '\u2014')
      + detailRow('CBS\u6d41\u6c34\u53f7', overseasPayment ? '\u2014' : (receipt.cbsNumber || '\u2014'))
      + detailRow('\u72b6\u6001\u65f6\u95f4', formatDate(receipt.statusAt))
      + detailRow('\u5931\u8d25\u539f\u56e0', getLatestFailureReason(receipt) || '\u2014')
      + detailRow('\u5185\u5bb9', receipt.content, true)
      + '</dl>'
      + '<div class="detail-process">' + renderStateActionButtons(receipt, approvalMode) + '</div>'
      + renderTimeline(receipt.timeline);
    dialog.hidden = false;
    if (closeButton && typeof closeButton.focus === 'function') {
      closeButton.focus();
    }
  }

  function openLogs(id) {
    const dialog = document.getElementById('detail-dialog');
    const content = document.getElementById('detail-dialog-content');
    const title = document.getElementById('detail-dialog-title');
    const closeButton = document.getElementById('detail-dialog-close');
    const receipt = getDocumentById(id);
    if (!dialog || !content || !receipt) {
      showToast('\u672a\u627e\u5230\u8be5\u5355\u636e');
      return;
    }
    state.lastFocusedElement = document.activeElement;
    state.detailReturnFocus = null;
    state.detailDocumentId = String(receipt.id);
    if (title) title.textContent = '\u64cd\u4f5c\u65e5\u5fd7';
    content.innerHTML = renderOperationLogs(receipt.timeline);
    dialog.hidden = false;
    if (closeButton && typeof closeButton.focus === 'function') closeButton.focus();
  }

  function openApprovalDetails(id, approvalMode) {
    const receipt = getDocumentById(id);
    const listPage = document.getElementById('approval-list-page');
    const detailPage = document.getElementById('approval-detail-page');
    if (!receipt || !listPage || !detailPage) {
      showToast('\u672a\u627e\u5230\u8be5\u5355\u636e');
      return;
    }
    state.detailDocumentId = String(receipt.id);
    listPage.hidden = true;
    detailPage.hidden = false;
    renderApprovalDetailPage(receipt, approvalMode);
    if (root.location && root.location.hash !== '#approval-detail-' + encodeURIComponent(receipt.id)) {
      root.location.hash = 'approval-detail-' + encodeURIComponent(receipt.id);
    }
    if (typeof root.scrollTo === 'function') root.scrollTo(0, 0);
    if (erpWorkspace) erpWorkspace.record('detail', receipt.id);
  }

  function showApprovalListPage() {
    const listPage = document.getElementById('approval-list-page');
    const detailPage = document.getElementById('approval-detail-page');
    const previewPage = document.getElementById('file-preview-page');
    if (listPage) listPage.hidden = false;
    if (detailPage) detailPage.hidden = true;
    if (previewPage) previewPage.hidden = true;
    state.detailDocumentId = null;
    if (erpWorkspace) { erpWorkspace.record('list'); return; }
    if (root.location && root.location.hash.indexOf('#approval-detail-') === 0) {
      root.location.hash = '';
    }
  }

  function readApprovalDetailIdFromHash() {
    if (!root.location || root.location.hash.indexOf('#approval-detail-') !== 0) return '';
    try {
      return decodeURIComponent(root.location.hash.slice('#approval-detail-'.length));
    } catch (error) {
      return '';
    }
  }

  function openFilePreview(id) {
    const receipt = getDocumentById(id);
    if (!receipt || !root.location) {
      showToast('未找到该单据');
      return;
    }
    if (erpWorkspace) { showFilePreviewPage(id); return; }
    const previewUrl = String(root.location.href).split('#')[0] + '#file-preview-' + encodeURIComponent(receipt.id);
    const previewWindow = typeof root.open === 'function' ? root.open(previewUrl, '_blank') : null;
    if (!previewWindow) root.location.hash = 'file-preview-' + encodeURIComponent(receipt.id);
  }

  function showFilePreviewPage(id, fileName) {
    const receipt = getDocumentById(id);
    const listPage = document.getElementById('approval-list-page');
    const detailPage = document.getElementById('approval-detail-page');
    const previewPage = document.getElementById('file-preview-page');
    if (!receipt || !previewPage) {
      showToast('未找到该单据');
      return;
    }
    if (listPage) listPage.hidden = true;
    if (detailPage) detailPage.hidden = true;
    previewPage.hidden = false;
    state.detailDocumentId = String(receipt.id);
    renderFilePreviewPage(receipt, fileName);
    if (erpWorkspace) erpWorkspace.record('preview', receipt.id);
    if (typeof root.scrollTo === 'function') root.scrollTo(0, 0);
  }

  function readFilePreviewIdFromHash() {
    if (!root.location || root.location.hash.indexOf('#file-preview-') !== 0) return '';
    try {
      return decodeURIComponent(root.location.hash.slice('#file-preview-'.length));
    } catch (error) {
      return '';
    }
  }

  function closeDetails() {
    const dialog = document.getElementById('detail-dialog');
    if (!dialog) {
      return;
    }
    dialog.hidden = true;
    state.detailDocumentId = null;
    const returnFocus = state.detailReturnFocus;
    const detailSelector = state.detailReturnFocus && state.detailReturnFocus.isTitleLink
      ? 'button.title-link[data-action="details"]'
      : 'button.detail-button[data-action="details"]';
    const refreshedTrigger = returnFocus && Array.prototype.slice.call(document.querySelectorAll(detailSelector))
      .find(function (button) { return button.dataset.id === returnFocus.id; });
    if (refreshedTrigger && typeof refreshedTrigger.focus === 'function') {
      refreshedTrigger.focus();
    } else if (state.lastFocusedElement && state.lastFocusedElement.isConnected
      && typeof state.lastFocusedElement.focus === 'function') {
      state.lastFocusedElement.focus();
    }
    state.lastFocusedElement = null;
    state.detailReturnFocus = null;
  }

  function setOperationError(message) {
    const error = document.getElementById('operation-error');
    if (!error) return;
    error.textContent = message || '';
    error.hidden = !message;
  }

  function renderOperationFields(action, receipt) {
    const fields = document.getElementById('operation-fields');
    if (!fields) return;
    let controls = '';
    if (action === 'reject') {
      controls = '<div class="operation-field"><label for="operation-note">\u9a73\u56de\u539f\u56e0</label><textarea id="operation-note" name="note" required></textarea></div>';
    } else if (action === 'pay' && isOverseasPayment(receipt)) {
      controls = '<p class="operation-confirmation">\u8bf7\u786e\u8ba4\u5df2\u5b8c\u6210\u6d77\u5916\u4ed8\u6b3e\uff0c\u5355\u636e\u5c06\u76f4\u63a5\u540c\u6b65\u91d1\u8776</p>';
    } else if (action === 'pay' || action === 'upload-receipt') {
      controls = (action === 'pay' ? '<p class="operation-confirmation">\u8bf7\u786e\u8ba4\u5df2\u5b8c\u6210\u652f\u4ed8\u5e76\u4e0a\u4f20\u652f\u4ed8\u56de\u5355</p>' : '')
        + '<div class="operation-field"><label for="receipt-number"><span class="required-mark" aria-hidden="true">*</span>\u56de\u5355\u53f7</label><input id="receipt-number" name="receiptNumber" type="text" required /></div>'
        + '<div class="operation-field"><label for="receipt-file"><span class="required-mark" aria-hidden="true">*</span>\u56de\u5355\u6587\u4ef6</label><input id="receipt-file" name="file" type="file" multiple required /></div>'
        + '<div class="operation-field"><label for="operation-note">\u5907\u6ce8</label><textarea id="operation-note" name="note"></textarea></div>';
    } else if (action === 'sync-kingdee') {
      controls = '<p class="operation-confirmation">'
        + (receipt.kingdeeStatus === '部分失败' ? '请将已同步到金蝶的单据删除，再确认重新同步' : '确认后单据将同步到金蝶')
        + '</p>';
    }
    fields.innerHTML = controls;
  }

  function openOperationDialog(id, action) {
    const dialog = document.getElementById('operation-dialog');
    const title = document.getElementById('operation-dialog-title');
    const closeButton = document.getElementById('operation-dialog-close');
    const receipt = getDocumentById(id);
    const actions = getWorkflowActions(receipt);
    if (!dialog || !receipt || !action || !actions.includes(action)) {
      showToast('\u5f53\u524d\u5355\u636e\u6ca1\u6709\u53ef\u5904\u7406\u7684\u4e8b\u9879');
      return;
    }
    state.operationDocumentId = String(receipt.id);
    state.operationAction = action;
    state.operationLastFocusedElement = document.activeElement && typeof document.activeElement.focus === 'function'
      ? document.activeElement : null;
    if (title) title.textContent = operationTitle(state.operationAction);
    setOperationError('');
    renderOperationFields(state.operationAction, receipt);
    dialog.hidden = false;
    if (closeButton && typeof closeButton.focus === 'function') closeButton.focus();
  }

  function closeOperationDialog(restoreFocus) {
    const dialog = document.getElementById('operation-dialog');
    if (dialog) dialog.hidden = true;
    const focused = state.operationLastFocusedElement;
    state.operationDocumentId = null;
    state.operationAction = null;
    state.operationLastFocusedElement = null;
    setOperationError('');
    if (restoreFocus !== false && focused && focused.isConnected && typeof focused.focus === 'function') {
      focused.focus();
    }
  }

  function submitOperation(event) {
    event.preventDefault();
    const form = event.currentTarget;
    const documentToUpdate = getDocumentById(state.operationDocumentId);
    const action = (form.elements.action && form.elements.action.value) || state.operationAction;
    if (!IntegrationActionLogic || typeof IntegrationActionLogic.applyManualAction !== 'function' || !documentToUpdate || !action) {
      setOperationError('\u5f53\u524d\u64cd\u4f5c\u65e0\u6cd5\u6267\u884c');
      return;
    }
    const formData = new FormData(form);
    const payload = {};
    formData.forEach(function (value, key) {
      if (key !== 'file') payload[key] = typeof value === 'string' ? value : '';
    });
    const fileInput = form.elements.file;
    if (fileInput && fileInput.files) {
      if (!fileInput.files.length) {
        setOperationError('\u8bf7\u4e0a\u4f20\u56de\u5355\u6587\u4ef6');
        return;
      }
      if (fileInput.files.length > 9) {
        setOperationError('\u56de\u5355\u6587\u4ef6\u6700\u591a\u4e0a\u4f209\u4e2a');
        return;
      }
      payload.fileNames = Array.prototype.map.call(fileInput.files, function (file) { return file.name; });
      payload.fileName = payload.fileNames.join('\u3001');
    }
    const detailsOpen = state.detailDocumentId === String(documentToUpdate.id);
    const approvalPage = document.getElementById('approval-detail-page');
    const approvalPageOpen = detailsOpen && approvalPage && !approvalPage.hidden;
    try {
      const updated = IntegrationActionLogic.applyManualAction(documentToUpdate, action, payload, { operator: '\u8d85\u7ea7\u7ba1\u7406\u5458' });
      if (!replaceDocument(updated)) throw new Error('\u5355\u636e\u66f4\u65b0\u5931\u8d25');
      render();
      closeOperationDialog(false);
      showToast(actionLabel(action) + '\u6210\u529f');
      if (approvalPageOpen) {
        renderApprovalDetailPage(updated, true);
      } else if (detailsOpen) {
        openDetails(updated.id, { preserveFocus: true });
      }
    } catch (error) {
      setOperationError(error && error.message ? error.message : '\u64cd\u4f5c\u5931\u8d25');
    }
  }

  function trapDialogFocus(event, dialog) {
    if (!dialog || event.key !== 'Tab') {
      return;
    }

    const selector = 'a[href], area[href], button:not([disabled]), input:not([disabled]), '
      + 'select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';
    const focusable = Array.prototype.slice.call(dialog.querySelectorAll(selector)).filter(function (element) {
      if (element.hidden || element.closest('[hidden]')) {
        return false;
      }
      const style = typeof root.getComputedStyle === 'function' ? root.getComputedStyle(element) : null;
      return !style || (style.display !== 'none' && style.visibility !== 'hidden');
    });

    const closeButton = dialog.querySelector('.modal__close');
    if (!focusable.length && closeButton && !closeButton.disabled) {
      focusable.push(closeButton);
    }
    if (!focusable.length) {
      return;
    }

    const first = focusable[0];
    const last = focusable[focusable.length - 1];
    const active = document.activeElement;
    const outsideDialog = !dialog.contains(active);

    if (event.shiftKey && (outsideDialog || active === first)) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && (outsideDialog || active === last)) {
      event.preventDefault();
      first.focus();
    }
  }

  function showToast(message) {
    const toast = document.getElementById('toast');
    if (!toast) {
      return;
    }
    root.clearTimeout(toastTimer);
    toast.textContent = message;
    toast.classList.add('is-visible');
    toastTimer = root.setTimeout(function () {
      toast.classList.remove('is-visible');
    }, 2200);
  }

  function normalizedFilterValue(value) {
    return value === '' ? ALL : value;
  }

  function updateFilter(filter, value) {
    if (!Object.prototype.hasOwnProperty.call(state.filters, filter)) {
      return;
    }
    state.filters[filter] = normalizedFilterValue(value);
    state.page = 1;
    render();
  }

  function syncFilterControls() {
    document.querySelectorAll('.filter-chip[data-filter]').forEach(function (chip) {
      const filter = chip.dataset.filter;
      const chipValue = normalizedFilterValue(chip.dataset.value || '');
      const active = state.filters[filter] === chipValue;
      chip.classList.toggle('is-active', active);
      chip.setAttribute('aria-pressed', String(active));
    });

    const keywordInput = document.getElementById('keyword-input');
    if (keywordInput && keywordInput.value !== state.filters.keyword) {
      keywordInput.value = state.filters.keyword;
    }

    const payerSelect = document.getElementById('payer-select');
    if (payerSelect) {
      payerSelect.value = state.filters.payer === ALL ? '' : state.filters.payer;
    }

    const dateInputs = [
      ['start-date', state.filters.startDate],
      ['end-date', state.filters.endDate],
      ['approval-start-date', state.filters.approvalStartDate],
      ['approval-end-date', state.filters.approvalEndDate],
    ];
    dateInputs.forEach(function (entry) {
      const input = document.getElementById(entry[0]);
      if (input && input.value !== entry[1]) input.value = entry[1];
    });
  }

  function resetFilters() {
    state.filters.keyword = '';
    state.filters.status = ALL;
    state.filters.receiptStatus = ALL;
    state.filters.kingdeeStatus = ALL;
    state.filters.type = ALL;
    state.filters.overseas = ALL;
    state.filters.invoice = ALL;
    state.filters.payer = ALL;
    state.filters.datePreset = ALL;
    state.filters.startDate = '';
    state.filters.endDate = '';
    state.filters.approvalDatePreset = ALL;
    state.filters.approvalStartDate = '';
    state.filters.approvalEndDate = '';
    state.filters.payeeType = ALL;
    state.page = 1;
    state.expandedIds.clear();
    const startDate = document.getElementById('start-date');
    const endDate = document.getElementById('end-date');
    const approvalStartDate = document.getElementById('approval-start-date');
    const approvalEndDate = document.getElementById('approval-end-date');
    if (startDate) startDate.value = '';
    if (endDate) endDate.value = '';
    if (approvalStartDate) approvalStartDate.value = '';
    if (approvalEndDate) approvalEndDate.value = '';
    render();
  }

  function isValidDateInput(value) {
    return value === '' || /^\d{4}-\d{2}-\d{2}$/.test(value);
  }

  function applyDateRange() {
    const startDate = document.getElementById('start-date');
    const endDate = document.getElementById('end-date');
    const startValue = startDate ? startDate.value : '';
    const endValue = endDate ? endDate.value : '';

    if (!isValidDateInput(startValue) || !isValidDateInput(endValue)) {
      showToast('\u8bf7\u8f93\u5165\u6709\u6548\u7684\u65e5\u671f');
      return;
    }

    state.filters.startDate = startValue;
    state.filters.endDate = endValue;
    state.filters.datePreset = ALL;
    state.page = 1;
    render();
  }

  function applyApprovalDateRange() {
    const startDate = document.getElementById('approval-start-date');
    const endDate = document.getElementById('approval-end-date');
    const startValue = startDate ? startDate.value : '';
    const endValue = endDate ? endDate.value : '';

    if (!isValidDateInput(startValue) || !isValidDateInput(endValue)) {
      showToast('\u8bf7\u8f93\u5165\u6709\u6548\u7684\u65e5\u671f');
      return;
    }

    state.filters.approvalStartDate = startValue;
    state.filters.approvalEndDate = endValue;
    state.filters.approvalDatePreset = ALL;
    state.page = 1;
    render();
  }

  function populatePayerOptions() {
    const select = document.getElementById('payer-select');
    if (!select) {
      return;
    }
    select.innerHTML = '';
    const allOption = document.createElement('option');
    allOption.value = '';
    allOption.textContent = ALL;
    select.appendChild(allOption);
    (PAYER_OPTIONS || []).forEach(function (payer) {
      const option = document.createElement('option');
      option.value = payer;
      option.textContent = payer;
      select.appendChild(option);
    });
  }

  function ensureMoreMenu() {
    let menu = document.getElementById('more-actions-menu');
    if (menu) {
      return menu;
    }

    const button = document.getElementById('more-actions-button');
    if (!button || !button.parentNode) {
      return null;
    }

    menu = document.createElement('div');
    menu.id = 'more-actions-menu';
    menu.className = 'more-actions-menu';
    menu.hidden = true;
    menu.innerHTML = '<button type="button" data-action="refresh-list">\u5237\u65b0\u5217\u8868</button>'
      + '<button type="button" data-action="export-list">\u5bfc\u51fa\u5f53\u524d\u7ed3\u679c</button>';
    button.setAttribute('aria-controls', menu.id);
    button.setAttribute('aria-expanded', 'false');
    button.parentNode.appendChild(menu);
    return menu;
  }

  function setMoreMenu(open) {
    const button = document.getElementById('more-actions-button');
    const menu = ensureMoreMenu();
    if (!button || !menu) {
      return;
    }
    menu.hidden = !open;
    button.setAttribute('aria-expanded', String(open));
  }

  function bindEvents() {
    const searchInput = document.getElementById('keyword-input');
    const searchButton = document.getElementById('search-button');
    const filterPanel = document.getElementById('filter-panel');
    const payerSelect = document.getElementById('payer-select');
    const tableBody = document.getElementById('receipt-table-body');
    const pagination = document.getElementById('pagination');
    const moreButton = document.getElementById('more-actions-button');
    const resetDataButton = document.getElementById('reset-data-button');
    const changeMarkerToggle = document.getElementById('change-marker-toggle');
    const moreMenu = ensureMoreMenu();
    const sidebarToggle = document.getElementById('sidebar-toggle') || document.querySelector('.topbar-left .icon-button');
    const financialMenu = document.getElementById('financial-menu-trigger');
    const financialSubmenu = document.getElementById('financial-submenu');
    const detailDialog = document.getElementById('detail-dialog');
    const detailCloseButton = document.getElementById('detail-dialog-close');
    const operationDialog = document.getElementById('operation-dialog');
    const operationCloseButton = document.getElementById('operation-dialog-close');
    const operationCancelButton = document.getElementById('operation-cancel');
    const operationForm = document.getElementById('operation-form');
    const approvalDetailPage = document.getElementById('approval-detail-page');
    const filePreviewPage = document.getElementById('file-preview-page');

    function runSearch() {
      updateFilter('keyword', searchInput ? searchInput.value.trim() : '');
    }

    if (searchButton) searchButton.addEventListener('click', runSearch);
    if (searchInput) {
      searchInput.addEventListener('keydown', function (event) {
        if (event.key === 'Enter') {
          event.preventDefault();
          runSearch();
        }
      });
    }

    if (changeMarkerToggle) {
      changeMarkerToggle.addEventListener('click', function () {
        const hidden = document.body.classList.toggle('change-markers-hidden');
        changeMarkerToggle.textContent = hidden ? '显示标记' : '隐藏标记';
        changeMarkerToggle.setAttribute('aria-pressed', String(hidden));
      });
    }

    if (resetDataButton) {
      resetDataButton.addEventListener('click', function () {
        try {
          if (root.localStorage) root.localStorage.removeItem(DOCUMENT_STORAGE_KEY);
        } catch (error) {
          // Continue to reload the seed fixtures even when storage is unavailable.
        }
        if (root.location) {
          root.location.hash = '';
          root.location.reload();
        }
      });
    }

    if (filterPanel) {
      filterPanel.addEventListener('click', function (event) {
        const chip = event.target.closest('.filter-chip[data-filter]');
        if (chip) {
          if (chip.dataset.filter === 'datePreset' || chip.dataset.filter === 'approvalDatePreset') {
            const isApprovalDate = chip.dataset.filter === 'approvalDatePreset';
            const startFilter = isApprovalDate ? 'approvalStartDate' : 'startDate';
            const endFilter = isApprovalDate ? 'approvalEndDate' : 'endDate';
            const startInputId = isApprovalDate ? 'approval-start-date' : 'start-date';
            const endInputId = isApprovalDate ? 'approval-end-date' : 'end-date';
            state.filters[startFilter] = '';
            state.filters[endFilter] = '';
            const startDate = document.getElementById(startInputId);
            const endDate = document.getElementById(endInputId);
            if (startDate) startDate.value = '';
            if (endDate) endDate.value = '';
          }
          updateFilter(chip.dataset.filter, chip.dataset.value || '');
          return;
        }
        if (event.target.id === 'date-range-apply') {
          applyDateRange();
        } else if (event.target.id === 'approval-date-range-apply') {
          applyApprovalDateRange();
        }
      });
    }

    if (payerSelect) {
      payerSelect.addEventListener('change', function () {
        updateFilter('payer', payerSelect.value);
      });
    }

    if (tableBody) {
      tableBody.addEventListener('click', function (event) {
        const button = event.target.closest('button[data-action]');
        if (!button) {
          return;
        }
        const action = button.dataset.action;
        const id = button.dataset.id;
        if (action === 'clear-filters') {
          resetFilters();
          return;
        }
        if (action === 'toggle-content') {
          if (state.expandedIds.has(id)) {
            state.expandedIds.delete(id);
          } else {
            state.expandedIds.add(id);
          }
          render();
          return;
        }
        if (action === 'operation') {
          openOperationDialog(id, button.dataset.operation);
          return;
        }
        if (action === 'approval-page') {
          openApprovalDetails(id, true);
          return;
        }
        if (action === 'logs') {
          openLogs(id);
          return;
        }
        if (action === 'details') {
          state.lastFocusedElement = button;
          openApprovalDetails(id, false);
        }
      });
    }

    if (approvalDetailPage) {
      approvalDetailPage.addEventListener('click', function (event) {
        const button = event.target.closest('button[data-action]');
        if (!button) return;
        const action = button.dataset.action;
        if (action === 'approval-detail-back') {
          showApprovalListPage();
          return;
        }
        if (action === 'approval-detail-close') {
          showApprovalListPage();
          return;
        }
        if (action === 'approval-detail-tab') {
          const tab = button.dataset.tab;
          approvalDetailPage.querySelectorAll('[data-action="approval-detail-tab"]').forEach(function (item) {
            const active = item.dataset.tab === tab;
            item.classList.toggle('is-active', active);
            item.setAttribute('aria-selected', String(active));
          });
          approvalDetailPage.querySelectorAll('[data-detail-panel]').forEach(function (panel) {
            panel.hidden = panel.dataset.detailPanel !== tab;
          });
          return;
        }
        if (action === 'operation') {
          openOperationDialog(button.dataset.id, button.dataset.operation);
          return;
        }
        if (action === 'file-preview') {
          openFilePreview(button.dataset.id);
        }
      });
    }

    if (filePreviewPage) {
      filePreviewPage.addEventListener('click', function (event) {
        const button = event.target.closest('button[data-action]');
        if (!button) return;
        const action = button.dataset.action;
        const id = button.dataset.id || state.detailDocumentId;
        if (action === 'preview-file') {
          const receipt = getDocumentById(id);
          if (receipt) renderFilePreviewPage(receipt, button.dataset.fileName);
          return;
        }
        if (action === 'file-preview-back' || action === 'file-preview-close') {
          const receipt = getDocumentById(id);
          if (receipt) {
            if (root.location) root.location.hash = 'approval-detail-' + encodeURIComponent(receipt.id);
            showApprovalListPage();
            openApprovalDetails(receipt.id, false);
          }
          return;
        }
        if (action === 'preview-download') showToast('当前为本地模拟文件，暂不生成下载文件');
      });
    }

    if (pagination) {
      pagination.addEventListener('click', function (event) {
        const button = event.target.closest('button[data-page]');
        if (!button || button.disabled) {
          return;
        }
        state.page = Number(button.dataset.page) || 1;
        render();
      });
    }

    if (moreButton) {
      moreButton.addEventListener('click', function () {
        const menu = document.getElementById('more-actions-menu');
        setMoreMenu(menu ? menu.hidden : false);
      });
    }
    if (moreMenu) {
      moreMenu.addEventListener('click', function (event) {
        const action = event.target.dataset.action;
        if (action === 'refresh-list') {
          render();
          showToast('\u5df2\u5237\u65b0\u5f53\u524d\u7b5b\u9009\u7ed3\u679c');
        }
        if (action === 'export-list') {
          showToast('\u5f53\u524d\u4e3a\u672c\u5730\u6a21\u62df\u6570\u636e\uff0c\u672a\u521b\u5efa\u5bfc\u51fa\u6587\u4ef6');
        }
        setMoreMenu(false);
      });
    }

    if (detailCloseButton) {
      detailCloseButton.addEventListener('click', closeDetails);
    }
    if (detailDialog) {
      detailDialog.addEventListener('click', function (event) {
        const operationButton = event.target.closest('button[data-action="operation"]');
        if (operationButton) {
          openOperationDialog(operationButton.dataset.id, operationButton.dataset.operation);
          return;
        }
        const approvalButton = event.target.closest('button[data-action="approval-page"]');
        if (approvalButton) {
          openApprovalDetails(approvalButton.dataset.id, true);
          return;
        }
        if (event.target && event.target.getAttribute
          && event.target.getAttribute('data-close-dialog') === 'true') {
          closeDetails();
        }
      });
    }

    if (operationCloseButton) operationCloseButton.addEventListener('click', closeOperationDialog);
    if (operationCancelButton) operationCancelButton.addEventListener('click', closeOperationDialog);
    if (operationForm) operationForm.addEventListener('submit', submitOperation);
    if (operationDialog) {
      operationDialog.addEventListener('click', function (event) {
        if (event.target && event.target.getAttribute
          && event.target.getAttribute('data-close-operation-dialog') === 'true') {
          closeOperationDialog();
        }
      });
    }

    document.addEventListener('click', function (event) {
      if (!moreMenu || moreMenu.hidden) {
        return;
      }
      if ((moreButton && moreButton.contains(event.target)) || moreMenu.contains(event.target)) {
        return;
      }
      setMoreMenu(false);
    });

    document.addEventListener('keydown', function (event) {
      if (operationDialog && !operationDialog.hidden) {
        if (event.key === 'Tab') {
          trapDialogFocus(event, operationDialog);
          return;
        }
        if (event.key === 'Escape') {
          closeOperationDialog();
          return;
        }
      }
      if (detailDialog && !detailDialog.hidden) {
        if (event.key === 'Tab') {
          trapDialogFocus(event, detailDialog);
          return;
        }
        if (event.key === 'Escape') {
          closeDetails();
          return;
        }
      }
      if (event.key === 'Escape') {
        setMoreMenu(false);
      }
    });

    if (sidebarToggle) {
      sidebarToggle.setAttribute('aria-pressed', 'false');
      sidebarToggle.addEventListener('click', function () {
        const shell = document.querySelector('.app-shell');
        const collapsed = shell ? shell.classList.toggle('sidebar-is-collapsed') : false;
        sidebarToggle.setAttribute('aria-pressed', String(collapsed));
      });
    }

    if (financialMenu && financialSubmenu) {
      financialMenu.addEventListener('click', function () {
        const open = financialMenu.getAttribute('aria-expanded') !== 'true';
        financialMenu.setAttribute('aria-expanded', String(open));
        financialSubmenu.hidden = !open;
      });
      financialSubmenu.addEventListener('click', function (event) {
        const item = event.target.closest('button');
        if (!item) return;
        financialSubmenu.querySelectorAll('button').forEach(function (button) {
          button.classList.toggle('submenu-item--selected', button === item);
          if (button === item) {
            button.setAttribute('aria-current', 'page');
          } else {
            button.removeAttribute('aria-current');
          }
        });
      });
    }

    if (typeof root.addEventListener === 'function') {
      root.addEventListener('hashchange', function () {
        const filePreviewId = readFilePreviewIdFromHash();
        if (filePreviewId) {
          showFilePreviewPage(filePreviewId);
          return;
        }
        const approvalDetailId = readApprovalDetailIdFromHash();
        if (approvalDetailId) {
          openApprovalDetails(approvalDetailId, false);
        } else {
          showApprovalListPage();
        }
      });
    }

    const helpButton = document.getElementById('help-button') || document.querySelector('.floating-button--help');
    const supportButton = document.getElementById('support-button') || document.querySelector('.floating-button--support');
    if (helpButton) helpButton.addEventListener('click', function () { showToast('\u5df2\u6253\u5f00\u5e2e\u52a9\u6307\u5f15'); });
    if (supportButton) supportButton.addEventListener('click', function () { showToast('\u5ba2\u670d\u5df2\u6536\u5230\u60a8\u7684\u8bf7\u6c42'); });
  }

  function initialize() {
    if (!ReceiptLogic || !Array.isArray(RECEIPT_DOCUMENTS)) {
      return;
    }
    hydrateDocumentsFromStorage();
    normalizeDocumentFields();
    persistDocuments();
    populatePayerOptions();
    bindEvents();
    render();
    if (root.createERPReceiptWorkspace) erpWorkspace = root.createERPReceiptWorkspace(root.ReceiptApp);
    const filePreviewId = readFilePreviewIdFromHash();
    if (filePreviewId) {
      showFilePreviewPage(filePreviewId);
      return;
    }
    const approvalDetailId = readApprovalDetailIdFromHash();
    if (approvalDetailId) openApprovalDetails(approvalDetailId, false);
  }

  root.ReceiptApp = {
    state: state,
    formatMoney: formatMoney,
    formatDate: formatDate,
    getVisibleDocuments: getVisibleDocuments,
    render: render,
    openApprovalDetails: openApprovalDetails,
    showApprovalListPage: showApprovalListPage,
    renderApprovalDetailPage: renderApprovalDetailPage,
    openFilePreview: openFilePreview,
    showFilePreviewPage: showFilePreviewPage,
    renderFilePreviewPage: renderFilePreviewPage,
    persistDocuments: persistDocuments,
    hydrateDocumentsFromStorage: hydrateDocumentsFromStorage,
    openDetails: openDetails,
    closeDetails: closeDetails,
    openOperationDialog: openOperationDialog,
    submitOperation: submitOperation,
    renderTimeline: renderTimeline,
    renderOperationLogs: renderOperationLogs,
    getDocumentById: getDocumentById,
    replaceDocument: replaceDocument,
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initialize, { once: true });
  } else {
    initialize();
  }
}(typeof window !== 'undefined' ? window : globalThis));
