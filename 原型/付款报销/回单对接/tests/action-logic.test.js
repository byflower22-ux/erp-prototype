const test = require('node:test');
const assert = require('node:assert/strict');

const {
  getAvailableActions,
  applyManualAction,
  FAILED_KINGDEE_SYNC_IDS,
  getLatestFailureReason,
  isOverseasPayment,
} = require('../assets/js/action-logic.js');

function documentFor(overrides) {
  return {
    id: '202608110001',
    status: '待财务审核',
    receiptStatus: '—',
    kingdeeStatus: '—',
    timeline: [],
    ...overrides,
  };
}

test('状态只提供其对应的业务操作', () => {
  assert.deepEqual(getAvailableActions(documentFor()), ['approve', 'reject']);
  assert.deepEqual(getAvailableActions(documentFor({ status: '待支付' })), ['pay']);
  assert.deepEqual(getAvailableActions(documentFor({ status: '支付失败' })), ['pay']);
  assert.deepEqual(getAvailableActions(documentFor({
    status: '已支付', receiptStatus: '拉取失败', kingdeeStatus: '待同步',
  })), ['upload-receipt']);
  assert.deepEqual(getAvailableActions(documentFor({
    status: '已支付', receiptStatus: '已归档', kingdeeStatus: '同步失败',
  })), ['sync-kingdee']);
  assert.deepEqual(getAvailableActions(documentFor({
    status: '已支付', receiptStatus: '已归档', kingdeeStatus: '部分失败',
  })), ['sync-kingdee']);
});

test('审批与驳回改变表单状态并写入日志', () => {
  const document = documentFor();
  const approved = applyManualAction(document, 'approve', {}, {
    operator: '超级管理员', now: '2026-08-12T09:00:00',
  });
  const rejected = applyManualAction(document, 'reject', { note: '预算信息不完整' }, {
    operator: '超级管理员', now: '2026-08-12T09:01:00',
  });

  assert.equal(approved.status, '待支付');
  assert.equal(approved.receiptStatus, '—');
  assert.equal(approved.kingdeeStatus, '—');
  assert.equal(approved.approvalPassedAt, '2026-08-12T09:00:00');
  assert.equal(approved.timeline.at(-1).action, '审批');
  assert.equal(approved.timeline.at(-1).note, '审批通过');
  assert.equal(rejected.status, '已驳回');
  assert.equal(rejected.approvalPassedAt, '');
  assert.equal(rejected.timeline.at(-1).note, '审批驳回：预算信息不完整');
  assert.equal(document.status, '待财务审核');
});

test('支付必须包含回单并自动归档和模拟金蝶结果', () => {
  const succeeded = applyManualAction(documentFor({ id: '202608110001', status: '待支付' }), 'pay', {
    receiptNumber: 'RC-20260812-01', fileName: '付款回单.pdf', note: '已完成付款',
  }, { operator: '超级管理员', now: '2026-08-12T10:00:00' });
  const failed = applyManualAction(documentFor({ id: '202608040008', status: '支付失败' }), 'pay', {
    receiptNumber: 'RC-20260812-02', fileName: '失败后重试回单.pdf',
  }, { operator: '超级管理员', now: '2026-08-12T10:01:00' });

  assert.equal(succeeded.status, '已支付');
  assert.equal(succeeded.receiptStatus, '已归档');
  assert.equal(succeeded.kingdeeStatus, '同步成功');
  assert.match(succeeded.kingdeeCode, /^FKD\d{7}$/);
  assert.equal(succeeded.paymentFailureReason, '');
  assert.equal(succeeded.receiptFailureReason, '');
  assert.equal(succeeded.kingdeeFailureReason, '');
  assert.equal(failed.kingdeeStatus, '同步失败');
  assert.deepEqual(succeeded.timeline.map((event) => event.action), [
    '手动支付', '手动上传回单', '同步金蝶',
  ]);
  assert.ok(!succeeded.timeline.some((event) => event.action === '提交付款'));
  assert.ok(!succeeded.timeline.some((event) => event.action === '获取支付结果'));
  assert.equal(succeeded.timeline[1].operator, '超级管理员');
  assert.match(succeeded.timeline.at(-1).note, /金蝶编码：FKD/);
  assert.match(failed.timeline.at(-1).note, /金蝶同步失败：/);
  assert.throws(() => applyManualAction(documentFor({ status: '待支付' }), 'pay', {
    receiptNumber: 'RC-01', fileName: '',
  }), /回单文件/);
  assert.throws(() => applyManualAction(documentFor({ status: '待支付' }), 'pay', {
    receiptNumber: 'RC-02', fileNames: Array.from({ length: 10 }, (_, index) => '回单' + index + '.dat'),
  }), /最多上传9个/);
});

test('海外付款主体跳过CBS和回单，支付后直接同步金蝶', () => {
  const overseasDocument = documentFor({
    id: '202608130026',
    status: '待支付',
    payer: 'Sands Bosum Business Pte. Ltd',
  });
  const result = applyManualAction(overseasDocument, 'pay', { note: '已完成海外付款' }, {
    operator: '超级管理员', now: '2026-08-13T10:00:00',
  });

  assert.equal(isOverseasPayment(overseasDocument), true);
  assert.equal(result.status, '已支付');
  assert.equal(result.receiptStatus, '—');
  assert.equal(result.kingdeeStatus, '同步成功');
  assert.equal(result.cbsNumber, '');
  assert.equal(result.cbsApplicationNumber, '');
  assert.deepEqual(result.timeline.map((event) => event.action), ['手动支付', '同步金蝶']);
  assert.ok(!result.timeline.some((event) => /CBS|回单/.test(event.note)));
});

test('上传回单后归档并自动模拟金蝶同步结果', () => {
  const result = applyManualAction(documentFor({
    id: '202608060006', status: '已支付', receiptStatus: '拉取失败', kingdeeStatus: '待同步',
  }), 'upload-receipt', {
    receiptNumber: 'RC-20260812-03', fileName: '补传回单.pdf', note: '人工补传',
  }, { operator: '超级管理员', now: '2026-08-12T10:02:00' });

  assert.equal(result.receiptStatus, '已归档');
  assert.equal(result.kingdeeStatus, '同步成功');
  assert.deepEqual(result.timeline.map((event) => event.action), ['手动上传回单', '同步金蝶']);
  assert.equal(result.timeline[0].operator, '超级管理员');
  assert.match(result.timeline.at(-1).note, /金蝶编码：FKD/);
});

test('同步金蝶仅在已支付、已归档、同步失败时可用且重试成功', () => {
  const document = documentFor({
    id: '202608040008', status: '已支付', receiptStatus: '已归档', kingdeeStatus: '同步失败',
  });
  const result = applyManualAction(document, 'sync-kingdee', {}, {
    operator: '超级管理员', now: '2026-08-12T10:03:00',
  });

  assert.equal(result.kingdeeStatus, '同步成功');
  assert.match(result.kingdeeCode, /^FKD\d{7}$/);
  assert.equal(result.kingdeeFailureReason, '');
  assert.deepEqual(result.timeline.map((event) => event.action), ['手动同步金蝶', '同步金蝶']);
  assert.equal(result.timeline[0].operator, '超级管理员');
  assert.equal(result.timeline.at(-1).operator, '系统');
  assert.match(result.timeline.at(-1).note, /金蝶编码：FKD/);
  assert.deepEqual(getAvailableActions(result), []);
  assert.deepEqual(FAILED_KINGDEE_SYNC_IDS, ['202608040008', '202608020010', '202607010019', '202511150021']);
});

test('最新失败原因带阶段标题且只展示当前未完结阶段', () => {
  assert.equal(getLatestFailureReason(documentFor({
    status: '支付失败', paymentFailureReason: '收款账户状态异常',
  })), '支付失败：收款账户状态异常');
  assert.equal(getLatestFailureReason(documentFor({
    status: '已支付', receiptStatus: '拉取失败', receiptFailureReason: '超过T+3仍未生成回单',
  })), '回单拉取失败：超过T+3仍未生成回单');
  assert.equal(getLatestFailureReason(documentFor({
    status: '已支付', receiptStatus: '已归档', kingdeeStatus: '同步失败', kingdeeFailureReason: '凭证校验失败',
  })), '金蝶同步失败：凭证校验失败');
  assert.equal(getLatestFailureReason(documentFor({
    status: '已支付', receiptStatus: '已归档', kingdeeStatus: '同步成功', kingdeeFailureReason: '历史异常',
  })), '');
});
