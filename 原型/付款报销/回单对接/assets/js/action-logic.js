(function (root) {
  'use strict';

  const APPROVE_ACTION = 'approve';
  const REJECT_ACTION = 'reject';
  const PAY_ACTION = 'pay';
  const RECEIPT_UPLOAD_ACTION = 'upload-receipt';
  const KINGDEE_SYNC_ACTION = 'sync-kingdee';
  const FAILED_KINGDEE_SYNC_IDS = ['202608040008', '202608020010', '202607010019', '202511150021'];
  const OVERSEAS_PAYER_NAMES = ['Sands Bosum Business Pte. Ltd'];
  const KINGDEE_FAILURE_STATUSES = ['同步失败', '部分失败'];

  function isOverseasPayment(document) {
    return Boolean(document && OVERSEAS_PAYER_NAMES.includes(String(document.payer || '').trim()));
  }

  function getAvailableActions(document) {
    if (!document) return [];
    if (document.status === '待财务审核') return [APPROVE_ACTION, REJECT_ACTION];
    if (document.status === '待支付' || document.status === '支付失败') return [PAY_ACTION];
    if (document.status === '已支付' && document.receiptStatus === '拉取失败') return [RECEIPT_UPLOAD_ACTION];
    if (document.status === '已支付'
      && (isOverseasPayment(document) || document.receiptStatus === '已归档')
      && KINGDEE_FAILURE_STATUSES.includes(document.kingdeeStatus)) {
      return [KINGDEE_SYNC_ACTION];
    }
    return [];
  }

  function requireValue(value, message) {
    if (typeof value !== 'string' || !value.trim()) throw new Error(message);
    return value.trim();
  }

  function normalizeReceiptFiles(payload) {
    const names = Array.isArray(payload.fileNames)
      ? payload.fileNames.filter(function (name) { return typeof name === 'string' && name.trim(); })
      : (typeof payload.fileName === 'string' && payload.fileName.trim() ? [payload.fileName.trim()] : []);
    if (!names.length) throw new Error('请上传回单文件');
    if (names.length > 9) throw new Error('回单文件最多上传9个');
    return names;
  }

  function makeEvent(action, note, operator, at, fields) {
    return { action, note, operator, at, ...(fields || {}) };
  }

  function makeNextDocument(document, context) {
    const actionContext = context || {};
    return {
      ...document,
      timeline: Array.isArray(document.timeline) ? document.timeline.map((event) => ({ ...event })) : [],
      statusAt: actionContext.now || new Date().toISOString(),
    };
  }

  function makeKingdeeCode(id) {
    return 'FKD' + String(id || '').slice(-7).padStart(7, '0');
  }

  function makeCBSApplicationNumber(id) {
    return 'CBSAPP' + String(id || '').slice(-11).padStart(11, '0');
  }

  function makeCBSTransactionNumber(id) {
    return 'CBS' + String(id || '').slice(-11).padStart(11, '0');
  }

  function appendCBSSubmission(document) {
    document.cbsApplicationNumber = document.cbsApplicationNumber || makeCBSApplicationNumber(document.id);
    document.timeline.push(makeEvent(
      '提交付款',
      '同步CBS成功，CBS申请单编号：' + document.cbsApplicationNumber,
      '系统',
      document.statusAt,
    ));
  }

  function appendCBSPaymentResult(document) {
    document.cbsNumber = document.cbsNumber || makeCBSTransactionNumber(document.id);
    document.timeline.push(makeEvent(
      '获取支付结果',
      '查询CBS支付成功，CBS交易流水号：' + document.cbsNumber,
      '系统',
      document.statusAt,
    ));
  }

  function getLatestFailureReason(document) {
    if (!document) return '';
    if (document.status === '支付失败') {
      return document.paymentFailureReason ? '支付失败：' + document.paymentFailureReason : '';
    }
    if (document.status === '已支付' && document.receiptStatus === '拉取失败') {
      return document.receiptFailureReason ? '回单拉取失败：' + document.receiptFailureReason : '';
    }
    if (document.status === '已支付'
      && (isOverseasPayment(document) || document.receiptStatus === '已归档')
      && KINGDEE_FAILURE_STATUSES.includes(document.kingdeeStatus)) {
      const prefix = document.kingdeeStatus === '部分失败' ? '金蝶部分失败：' : '金蝶同步失败：';
      return document.kingdeeFailureReason ? prefix + document.kingdeeFailureReason : '';
    }
    return '';
  }

  function appendAutomaticKingdeeResult(document, operator) {
    const failed = FAILED_KINGDEE_SYNC_IDS.includes(String(document.id));
    document.kingdeeStatus = failed ? '同步失败' : '同步成功';
    document.kingdeeFailureReason = failed ? '金蝶凭证校验失败，请人工同步' : '';
    document.kingdeeCode = failed ? '' : makeKingdeeCode(document.id);
    document.timeline.push(makeEvent(
      '同步金蝶',
      failed ? '金蝶同步失败：' + document.kingdeeFailureReason : '同步成功，金蝶编码：' + document.kingdeeCode,
      operator,
      document.statusAt,
    ));
  }

  function applyManualAction(document, action, payload, context) {
    if (!document || typeof document !== 'object') throw new Error('单据不能为空');
    if (!getAvailableActions(document).includes(action)) throw new Error('当前操作不可用');

    const actionPayload = payload || {};
    const actionContext = context || {};
    const operator = actionContext.operator || '超级管理员';
    const nextDocument = makeNextDocument(document, actionContext);
    const note = typeof actionPayload.note === 'string' ? actionPayload.note.trim() : '';

    if (action === APPROVE_ACTION) {
      nextDocument.status = '待支付';
      nextDocument.approvalPassedAt = nextDocument.statusAt;
      nextDocument.receiptStatus = '—';
      nextDocument.kingdeeStatus = '—';
      nextDocument.paymentFailureReason = '';
      nextDocument.receiptFailureReason = '';
      nextDocument.kingdeeFailureReason = '';
      nextDocument.kingdeeCode = '';
      nextDocument.timeline.push(makeEvent('审批', note || '审批通过', operator, nextDocument.statusAt));
      return nextDocument;
    }

    if (action === REJECT_ACTION) {
      nextDocument.status = '已驳回';
      nextDocument.approvalPassedAt = '';
      nextDocument.receiptStatus = '—';
      nextDocument.kingdeeStatus = '—';
      nextDocument.paymentFailureReason = '';
      nextDocument.receiptFailureReason = '';
      nextDocument.kingdeeFailureReason = '';
      nextDocument.kingdeeCode = '';
      nextDocument.timeline.push(makeEvent('审批', '审批驳回：' + requireValue(note, '请填写驳回原因'), operator, nextDocument.statusAt));
      return nextDocument;
    }

    if (action === PAY_ACTION && isOverseasPayment(nextDocument)) {
      nextDocument.status = '已支付';
      nextDocument.receiptStatus = '—';
      nextDocument.receiptNumber = '';
      nextDocument.fileName = '';
      nextDocument.receiptFiles = [];
      nextDocument.cbsNumber = '';
      nextDocument.cbsApplicationNumber = '';
      nextDocument.paymentFailureReason = '';
      nextDocument.receiptFailureReason = '';
      nextDocument.timeline.push(makeEvent('手动支付', note || '已手动确认支付', operator, nextDocument.statusAt));
      appendAutomaticKingdeeResult(nextDocument, '系统');
      return nextDocument;
    }

    if (action === PAY_ACTION || action === RECEIPT_UPLOAD_ACTION) {
      const receiptNumber = requireValue(actionPayload.receiptNumber, '请填写回单号');
      const fileNames = normalizeReceiptFiles(actionPayload);
      const fileName = fileNames.join('、');
      nextDocument.status = '已支付';
      nextDocument.receiptStatus = '已归档';
      nextDocument.receiptNumber = receiptNumber;
      nextDocument.fileName = fileName;
      nextDocument.receiptFiles = fileNames;
      if (action === PAY_ACTION) nextDocument.paymentFailureReason = '';
      nextDocument.receiptFailureReason = '';
      if (action === PAY_ACTION) {
        nextDocument.timeline.push(makeEvent('手动支付', note || '已手动确认支付', operator, nextDocument.statusAt));
      }
      nextDocument.timeline.push(makeEvent(
        '手动上传回单',
        note || '已手动上传回单',
        operator,
        nextDocument.statusAt,
        { receiptNumber, fileName, fileNames },
      ));
      appendAutomaticKingdeeResult(nextDocument, '系统');
      return nextDocument;
    }

    if (action === KINGDEE_SYNC_ACTION) {
      nextDocument.timeline.push(makeEvent('手动同步金蝶', '已确认手动同步金蝶', operator, nextDocument.statusAt));
      nextDocument.kingdeeStatus = '同步成功';
      nextDocument.kingdeeFailureReason = '';
      nextDocument.kingdeeCode = makeKingdeeCode(nextDocument.id);
      nextDocument.timeline.push(makeEvent('同步金蝶', '同步成功，金蝶编码：' + nextDocument.kingdeeCode, '系统', nextDocument.statusAt));
      return nextDocument;
    }

    throw new Error('当前操作不可用');
  }

  const api = {
    getAvailableActions,
    applyManualAction,
    getLatestFailureReason,
    FAILED_KINGDEE_SYNC_IDS,
    isOverseasPayment,
  };

  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (root) root.IntegrationActionLogic = api;
}(typeof window !== 'undefined' ? window : null));
