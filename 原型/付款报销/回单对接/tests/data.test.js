const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const dataPath = path.join(__dirname, '..', 'assets', 'js', 'data.js');

function loadDocuments() {
  const context = { window: {} };
  vm.runInNewContext(fs.readFileSync(dataPath, 'utf8'), context, { filename: dataPath });
  return context.window.RECEIPT_DOCUMENTS;
}

test('simulated documents use only the existing payment statuses', () => {
  const documents = loadDocuments();
  const correctedDocument = documents.find((document) => document.id === '202607010019');
  const kingdeeStatuses = new Set(documents.map((document) => document.kingdeeStatus));

  assert.equal(correctedDocument.kingdeeStatus, '同步失败');
  assert.ok(documents.some((document) => document.id === '202608080004' && document.status === '支付失败'));
  assert.ok(documents.every((document) => document.status !== '查询超期'));
  assert.deepEqual([...kingdeeStatuses].sort(), ['—', '同步失败', '部分失败', '同步成功'].sort());
});

test('simulated data includes an archived document with a partial Kingdee sync failure', () => {
  const documents = loadDocuments();
  const partiallyFailed = documents.find((document) => document.kingdeeStatus === '部分失败');

  assert.ok(partiallyFailed);
  assert.equal(partiallyFailed.status, '已支付');
  assert.equal(partiallyFailed.receiptStatus, '已归档');
  assert.match(partiallyFailed.kingdeeFailureReason, /部分单据同步失败.*部分附件同步失败/);
});

test('only archived domestic receipts can start with a simulated Kingdee failure', () => {
  const documents = loadDocuments();
  const failedIds = Array.from(documents
    .filter((document) => !document.isOverseasPayment && document.kingdeeStatus === '同步失败')
    .map((document) => document.id)
    .sort());

  assert.deepEqual(failedIds, ['202608040008', '202607010019'].sort());
});

test('failure fixtures cover both receipt upload and manual Kingdee sync demonstrations', () => {
  const documents = loadDocuments();
  const byId = Object.fromEntries(documents.map((document) => [document.id, document]));

  ['202608040008', '202607010019'].forEach((id) => {
    assert.equal(byId[id].status, '已支付');
    assert.equal(byId[id].receiptStatus, '已归档');
    assert.equal(byId[id].kingdeeStatus, '同步失败');
  });
  ['202608060006'].forEach((id) => {
    assert.equal(byId[id].status, '已支付');
    assert.equal(byId[id].receiptStatus, '拉取失败');
    assert.equal(byId[id].kingdeeStatus, '—');
  });
});

test('downstream statuses follow the payment, receipt, and Kingdee sequence', () => {
  const documents = loadDocuments();

  documents.forEach((document) => {
    if (document.status !== '已支付') {
      assert.equal(document.receiptStatus, '—', document.id + ' must not enter receipt processing before payment');
      assert.equal(document.kingdeeStatus, '—', document.id + ' must not enter Kingdee sync before payment');
    } else if (document.isOverseasPayment) {
      assert.equal(document.receiptStatus, '—', document.id + ' must bypass receipt processing for overseas payment');
    } else if (document.receiptStatus !== '已归档') {
      assert.equal(document.kingdeeStatus, '—', document.id + ' must not enter Kingdee sync before receipt archival');
    }
  });
});

test('initial integration timeline records auditable CBS, receipt, and Kingdee nodes', () => {
  const documents = loadDocuments();
  const succeeded = documents.find((document) => document.kingdeeStatus === '同步成功');
  const failed = documents.find((document) => document.kingdeeStatus === '同步失败');
  const manual = documents.find((document) => document.kingdeeStatus === '同步失败');

  [succeeded, failed, manual].forEach((document) => {
    assert.ok(document.timeline.every((event) => event.at));
    assert.ok(document.timeline.every((event) => event.operator));
    assert.ok(document.timeline.filter((event) => event.action !== '审批').every((event) => event.operator === '系统'));
  });
  assert.ok(succeeded.timeline.some((event) => event.action === '提交付款' && /CBS申请单编号：/.test(event.note)));
  assert.ok(succeeded.timeline.some((event) => event.action === '获取支付结果' && /CBS交易流水号：/.test(event.note)));
  assert.ok(succeeded.timeline.some((event) => event.action === '拉取回单结果' && /回单号：/.test(event.note)));
  assert.ok(succeeded.timeline.some((event) => event.action === '同步金蝶' && /金蝶编码：/.test(event.note)));
  assert.ok(failed.timeline.some((event) => event.action === '同步金蝶' && /金蝶同步失败：/.test(event.note)));
  assert.ok(manual.timeline.some((event) => event.action === '同步金蝶' && /金蝶同步失败：/.test(event.note)));
});

test('payment entities are company names rather than bank names', () => {
  const documents = loadDocuments();

  assert.ok(documents.every((document) => /公司|有限公司|集团|Sands Bosum Business Pte\. Ltd/.test(document.payer)));
  assert.ok(documents.every((document) => !/银行/.test(document.payer)));
});

test('Kingdee encoding and stage-specific failure reasons match final integration states', () => {
  const documents = loadDocuments();

  documents.forEach((document) => {
    assert.equal(document.kingdeeCode, document.kingdeeStatus === '同步成功' ? document.kingdeeCode : '');
    if (document.kingdeeStatus === '同步成功') assert.match(document.kingdeeCode, /^FKD\d{7}$/);
    if (document.status !== '支付失败') assert.equal(document.paymentFailureReason, '');
    if (document.receiptStatus !== '拉取失败') assert.equal(document.receiptFailureReason, '');
    if (!['同步失败', '部分失败'].includes(document.kingdeeStatus)) assert.equal(document.kingdeeFailureReason, '');
  });
});

test('simulated data includes a paid document waiting for the CBS receipt pull', () => {
  const documents = loadDocuments();
  const pendingReceipt = documents.find((document) => document.id === '202608120025');

  assert.ok(pendingReceipt);
  assert.equal(pendingReceipt.status, '\u5df2\u652f\u4ed8');
  assert.equal(pendingReceipt.receiptStatus, '\u5f85\u62c9\u53d6');
  assert.equal(pendingReceipt.kingdeeStatus, '\u2014');
});

test('overseas payer fixtures bypass CBS and receipt processing', () => {
  const documents = loadDocuments();
  const overseasDocuments = documents.filter((document) => document.payer === 'Sands Bosum Business Pte. Ltd');
  const pendingApproval = documents.find((document) => document.id === '202608130026');

  assert.ok(overseasDocuments.length > 0);
  assert.ok(overseasDocuments.every((document) => document.receiptStatus === '—'));
  assert.ok(overseasDocuments.every((document) => !document.cbsNumber && !document.cbsApplicationNumber));
  assert.ok(overseasDocuments.every((document) => !document.timeline.some((event) => /CBS|回单/.test(event.note))));
  assert.equal(pendingApproval.status, '待财务审核');
});
