const test = require('node:test');
const assert = require('node:assert/strict');

const {
  filterDocuments,
  getPresetRange,
  paginate,
} = require('../assets/js/logic');

test('filterDocuments combines keyword, status, and boolean filters', () => {
  const documents = [
    {
      id: 'A001',
      title: '差旅报销',
      type: '报销单',
      invoice: true,
      overseas: false,
      amount: 100,
      currency: 'CNY',
      createdAt: '2026-08-08T09:00:00',
      applicant: '张三',
      department: '财务部',
      payer: '招商银行',
      content: '深圳差旅交通费',
      status: '已支付',
    },
    {
      id: 'A002',
      title: '深圳客户招待费',
      type: '付款单',
      invoice: true,
      overseas: false,
      amount: 200,
      currency: 'CNY',
      createdAt: '2026-08-09T10:00:00',
      applicant: '李四',
      department: '销售部',
      payer: '招商银行',
      content: '深圳客户午餐招待',
      status: '已支付',
    },
    {
      id: 'A003',
      title: '深圳客户招待费',
      type: '付款单',
      invoice: false,
      overseas: false,
      amount: 300,
      currency: 'CNY',
      createdAt: '2026-08-10T10:00:00',
      applicant: '王五',
      department: '销售部',
      payer: '招商银行',
      content: '深圳客户午餐招待',
      status: '已支付',
    },
  ];

  const result = filterDocuments(documents, {
    keyword: '深圳客户',
    status: '已支付',
    type: '付款单',
    invoice: true,
    overseas: false,
    payer: '招商银行',
  }, new Date(2026, 7, 11, 12));

  assert.deepEqual(result.map((document) => document.id), ['A002']);
});

test('getPresetRange returns inclusive current-month boundaries', () => {
  const range = getPresetRange('本月', new Date(2026, 7, 11, 12, 30));

  assert.equal(range.start.getFullYear(), 2026);
  assert.equal(range.start.getMonth(), 7);
  assert.equal(range.start.getDate(), 1);
  assert.equal(range.start.getHours(), 0);
  assert.equal(range.end.getFullYear(), 2026);
  assert.equal(range.end.getMonth(), 7);
  assert.equal(range.end.getDate(), 31);
  assert.equal(range.end.getHours(), 23);
  assert.equal(range.end.getMinutes(), 59);
  assert.equal(range.end.getSeconds(), 59);
  assert.equal(range.end.getMilliseconds(), 999);
});

test('filterDocuments includes an early-morning record on a custom date-only startDate', () => {
  const documents = [{
    id: 'A004',
    title: '早餐报销',
    type: '报销单',
    invoice: true,
    overseas: false,
    amount: 18,
    currency: 'CNY',
    createdAt: '2026-08-11T00:30:00',
    applicant: '赵六',
    department: '行政部',
    payer: '招商银行',
    content: '项目启动早餐',
    status: '待财务审核',
  }];

  const result = filterDocuments(documents, { startDate: '2026-08-11' });

  assert.deepEqual(result.map((document) => document.id), ['A004']);
});

test('getPresetRange uses the preceding calendar year for January previous quarter', () => {
  const range = getPresetRange('上季度', new Date(2026, 0, 15, 10));

  assert.deepEqual(
    [range.start.getFullYear(), range.start.getMonth(), range.start.getDate()],
    [2025, 9, 1],
  );
  assert.deepEqual(
    [range.end.getFullYear(), range.end.getMonth(), range.end.getDate()],
    [2025, 11, 31],
  );
  assert.equal(range.end.getHours(), 23);
  assert.equal(range.end.getMilliseconds(), 999);
});

test('paginate clamps an out-of-range page to the final page', () => {
  const result = paginate(['A', 'B', 'C', 'D', 'E'], 99, 2);

  assert.equal(result.page, 3);
  assert.equal(result.totalPages, 3);
  assert.deepEqual(result.items, ['E']);
});

test('filterDocuments accepts records from the rolling seven-day range including today', () => {
  const documents = [
    { id: 'A001', createdAt: '2026-08-11T09:00:00' },
    { id: 'A002', createdAt: '2026-08-05T00:00:00' },
    { id: 'A003', createdAt: '2026-08-04T23:59:59' },
  ];

  const result = filterDocuments(documents, { datePreset: '\u8fd17\u5929' }, new Date('2026-08-11T12:00:00'));

  assert.deepEqual(result.map((document) => document.id), ['A001', 'A002']);
});

test('getPresetRange returns the Monday-through-Sunday range for this week', () => {
  const range = getPresetRange('\u672c\u5468', new Date(2026, 7, 12, 12));

  assert.deepEqual(
    [range.start.getFullYear(), range.start.getMonth(), range.start.getDate(), range.start.getHours()],
    [2026, 7, 10, 0],
  );
  assert.deepEqual(
    [range.end.getFullYear(), range.end.getMonth(), range.end.getDate(), range.end.getHours()],
    [2026, 7, 16, 23],
  );
  assert.equal(range.end.getMinutes(), 59);
  assert.equal(range.end.getSeconds(), 59);
  assert.equal(range.end.getMilliseconds(), 999);
});

test('getPresetRange returns the preceding Monday-through-Sunday range for last week', () => {
  const range = getPresetRange('\u4e0a\u5468', new Date(2026, 7, 12, 12));

  assert.deepEqual(
    [range.start.getFullYear(), range.start.getMonth(), range.start.getDate(), range.start.getHours()],
    [2026, 7, 3, 0],
  );
  assert.deepEqual(
    [range.end.getFullYear(), range.end.getMonth(), range.end.getDate(), range.end.getHours()],
    [2026, 7, 9, 23],
  );
  assert.equal(range.end.getMinutes(), 59);
  assert.equal(range.end.getSeconds(), 59);
  assert.equal(range.end.getMilliseconds(), 999);
});

test('filterDocuments applies an inclusive custom start and end date range', () => {
  const documents = [
    { id: 'A001', createdAt: '2026-08-10T00:00:00' },
    { id: 'A002', createdAt: '2026-08-11T23:59:59' },
    { id: 'A003', createdAt: '2026-08-12T00:00:00' },
  ];

  const result = filterDocuments(documents, {
    startDate: '2026-08-10',
    endDate: '2026-08-11',
  });

  assert.deepEqual(result.map((document) => document.id), ['A001', 'A002']);
});

test('filterDocuments combines receipt and kingdee status with the existing form status', () => {
  const documents = [
    { id: 'A001', status: '已支付', receiptStatus: '已归档', kingdeeStatus: '同步成功', createdAt: '2026-08-11T09:00:00' },
    { id: 'A002', status: '已支付', receiptStatus: '待拉取', kingdeeStatus: '待同步', createdAt: '2026-08-11T09:00:00' },
    { id: 'A003', status: '支付失败', receiptStatus: '待拉取', kingdeeStatus: '待同步', createdAt: '2026-08-11T09:00:00' },
  ];

  const result = filterDocuments(documents, {
    status: '已支付',
    receiptStatus: '已归档',
    kingdeeStatus: '同步成功',
  });

  assert.deepEqual(result.map((document) => document.id), ['A001']);
});

test('filterDocuments filters by approval completion time and payee type', () => {
  const documents = [
    { id: 'A001', createdAt: '2026-08-10T09:00:00', approvalPassedAt: '2026-08-10T10:00:00', payeeType: '公司' },
    { id: 'A002', createdAt: '2026-08-10T09:00:00', approvalPassedAt: '2026-08-11T10:00:00', payeeType: '个人' },
    { id: 'A003', createdAt: '2026-08-10T09:00:00', approvalPassedAt: '', payeeType: '公司' },
  ];

  const result = filterDocuments(documents, {
    approvalStartDate: '2026-08-10',
    approvalEndDate: '2026-08-10',
    payeeType: '公司',
  });

  assert.deepEqual(result.map((document) => document.id), ['A001']);
});

test('filterDocuments applies presets to approval completion time', () => {
  const documents = [
    { id: 'A001', approvalPassedAt: '2026-08-11T09:00:00' },
    { id: 'A002', approvalPassedAt: '2026-08-04T23:59:59' },
  ];

  const result = filterDocuments(documents, { approvalDatePreset: '近7天' }, new Date('2026-08-11T12:00:00'));

  assert.deepEqual(result.map((document) => document.id), ['A001']);
});
