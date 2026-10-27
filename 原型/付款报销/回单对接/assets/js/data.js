(function (root) {
  const documents = [
    { id: '202608130026', title: '新加坡会务服务费', type: '付款单', invoice: true, overseas: true, amount: 6800, currency: 'SGD', createdAt: '2026-08-13T09:30:00', applicant: '周敏', department: '国际业务部', payer: '花旗银行', content: '新加坡合作伙伴会务服务费用', status: '待财务审核', statusAt: '2026-08-13T09:30:00', cbsNumber: '', failureReason: '' },
    { id: '202608120025', title: '8月办公网络服务费', type: '付款单', invoice: true, overseas: false, amount: 3980, currency: 'CNY', createdAt: '2026-08-12T10:12:00', applicant: '刘洋', department: '行政部', payer: '中国工商银行', content: '办公网络专线8月服务费用', status: '已支付', statusAt: '2026-08-12T10:35:00', cbsNumber: 'CBS20260812025', failureReason: '' },
    { id: '202608110001', title: '8月停车费报销', type: '报销单', invoice: true, overseas: false, amount: 341.74, currency: 'CNY', createdAt: '2026-08-11T09:20:00', applicant: '陈昊', department: '企业运营服务中心', payer: '招商银行深圳分行', content: '费用时间：2026-08-10；停车费', status: '已支付', statusAt: '2026-08-11T15:50:54', cbsNumber: 'CBS20260811001', failureReason: '' },
    { id: '202608100002', title: '商务宴请', type: '报销单', invoice: true, overseas: false, amount: 105, currency: 'CNY', createdAt: '2026-08-10T09:59:24', applicant: '安平', department: '深圳三区运营部', payer: '招商银行深圳分行', content: '费用时间：2026-08-09；公司商务宴请', status: '已支付', statusAt: '2026-08-10T17:48:24', cbsNumber: 'CBS20260810002', failureReason: '' },
    { id: '202608090003', title: '程小芳差旅报销', type: '报销单', invoice: true, overseas: false, amount: 151, currency: 'CNY', createdAt: '2026-08-09T09:44:41', applicant: '安平', department: '深圳三区运营部', payer: '招商银行深圳分行', content: '费用时间：2026-08-08；广州至深圳交通费', status: '待财务审核', statusAt: '2026-08-09T09:44:41', cbsNumber: '', failureReason: '' },
    { id: '202608080004', title: '百度充值', type: '付款单', invoice: false, overseas: false, amount: 50000, currency: 'CNY', createdAt: '2026-08-08T16:14:13', applicant: '严佳卫', department: '全媒体文化运营部', payer: '中国工商银行', content: '开户行：招商银行广州分行营业部；百度推广充值', status: '支付失败', statusAt: '2026-08-08T18:28:47', cbsNumber: 'CBS20260808004', failureReason: 'CBS支付结果异常，请重新支付' },
    { id: '202608070005', title: '拍摄设备-素材费用', type: '报销单', invoice: true, overseas: false, amount: 301, currency: 'CNY', createdAt: '2026-08-07T16:43:58', applicant: '谭健', department: '市场部品牌组', payer: '招商银行深圳分行', content: '费用时间：2026-08-07；样片拍摄耗材', status: '已驳回', statusAt: '2026-08-07T19:31:59', cbsNumber: '', failureReason: '发票金额与报销金额不一致' },
    { id: '202608060006', title: '今日头条推广账户费用', type: '付款单', invoice: true, overseas: false, amount: 50000, currency: 'CNY', createdAt: '2026-08-06T10:35:40', applicant: '邓天虹', department: '全媒体文化运营部', payer: '中国工商银行', content: '开户行：招商银行广州分行营业部；头条推广充值', status: '已支付', statusAt: '2026-08-06T11:18:45', cbsNumber: 'CBS20260806006', failureReason: '' },
    { id: '202608050007', title: '今日头条推广费用', type: '付款单', invoice: true, overseas: false, amount: 50000, currency: 'CNY', createdAt: '2026-08-05T11:46:07', applicant: '邓天虹', department: '全媒体文化运营部', payer: '中国工商银行', content: '开户行：招商银行广州分行营业部；头条账户续费', status: '支付失败', statusAt: '2026-08-05T12:16:39', cbsNumber: 'CBS20260805007', failureReason: '收款账户状态异常' },
    { id: '202608040008', title: '8月员工团建费用', type: '报销单', invoice: false, overseas: false, amount: 54000, currency: 'CNY', createdAt: '2026-08-04T12:48:09', applicant: '欧哲程', department: '产品中心线下运营', payer: '招商银行深圳分行', content: '费用时间：2026-08-03；员工团建场地费', status: '已支付', statusAt: '2026-08-04T13:43:16', cbsNumber: 'CBS20260804008', failureReason: '' },
    { id: '202608030009', title: '9月4号加班餐费', type: '报销单', invoice: true, overseas: false, amount: 24, currency: 'CNY', createdAt: '2026-08-03T11:06:10', applicant: '李廷军', department: '直播运营部', payer: '招商银行深圳分行', content: '费用时间：2026-08-02；加班餐费', status: '待财务审核', statusAt: '2026-08-03T15:23:32', cbsNumber: '', failureReason: '' },
    { id: '202608020010', title: '香港展会差旅费', type: '报销单', invoice: true, overseas: true, amount: 8200, currency: 'HKD', createdAt: '2026-08-02T14:30:00', applicant: '周敏', department: '国际业务部', payer: '中国银行深圳分行', content: '香港国际消费电子展往返交通及住宿', status: '已支付', statusAt: '2026-08-02T16:00:00', cbsNumber: 'CBS20260802010', failureReason: '' },
    { id: '202608010011', title: '海外软件订阅续费', type: '付款单', invoice: false, overseas: true, amount: 1299, currency: 'USD', createdAt: '2026-08-01T10:15:00', applicant: '林晓', department: '技术中心', payer: '花旗银行', content: 'Figma 企业版年度订阅续费', status: '已支付', statusAt: '2026-08-01T14:23:00', cbsNumber: 'CBS20260801011', failureReason: '' },
    { id: '202607310012', title: '7月办公用品采购', type: '付款单', invoice: true, overseas: false, amount: 2680, currency: 'CNY', createdAt: '2026-07-31T16:10:00', applicant: '孙博', department: '行政部', payer: '交通银行深圳分行', content: '办公文具、打印纸及耗材采购', status: '已支付', statusAt: '2026-07-31T18:10:00', cbsNumber: 'CBS20260731012', failureReason: '' },
    { id: '202607280013', title: '客户拜访交通费', type: '报销单', invoice: true, overseas: false, amount: 468, currency: 'CNY', createdAt: '2026-07-28T09:30:00', applicant: '王强', department: '华南销售部', payer: '招商银行深圳分行', content: '广州客户拜访高铁及市内交通', status: '已驳回', statusAt: '2026-07-28T13:45:00', cbsNumber: '', failureReason: '缺少行程单附件' },
    { id: '202607240014', title: '云服务器资源采购', type: '付款单', invoice: true, overseas: false, amount: 12600, currency: 'CNY', createdAt: '2026-07-24T11:00:00', applicant: '赵磊', department: '技术中心', payer: '中国工商银行', content: '阿里云计算资源包采购', status: '支付失败', statusAt: '2026-07-24T15:12:00', cbsNumber: 'CBS20260724014', failureReason: '银行返回限额不足' },
    { id: '202607180015', title: '日本客户拜访差旅', type: '报销单', invoice: true, overseas: true, amount: 18300, currency: 'JPY', createdAt: '2026-07-18T08:50:00', applicant: '何静', department: '国际业务部', payer: '中国银行深圳分行', content: '东京客户拜访机票、酒店及交通费', status: '已支付', statusAt: '2026-07-18T17:20:00', cbsNumber: 'CBS20260718015', failureReason: '' },
    { id: '202607150016', title: '视频制作外包款', type: '付款单', invoice: false, overseas: false, amount: 36000, currency: 'CNY', createdAt: '2026-07-15T14:20:00', applicant: '刘洋', department: '品牌市场部', payer: '建设银行深圳分行', content: '新品宣传视频制作尾款', status: '待财务审核', statusAt: '2026-07-15T14:20:00', cbsNumber: '', failureReason: '' },
    { id: '202607090017', title: '社保公积金缴纳', type: '付款单', invoice: false, overseas: false, amount: 238400, currency: 'CNY', createdAt: '2026-07-09T09:00:00', applicant: '唐悦', department: '人力资源部', payer: '中国建设银行', content: '2026年7月社保与公积金缴款', status: '已支付', statusAt: '2026-07-09T11:30:00', cbsNumber: 'CBS20260709017', failureReason: '' },
    { id: '202607030018', title: '北京会务场地费', type: '付款单', invoice: true, overseas: false, amount: 15800, currency: 'CNY', createdAt: '2026-07-03T15:40:00', applicant: '徐晨', department: '市场部', payer: '招商银行深圳分行', content: '北京新品发布会场地租赁费用', status: '待支付', statusAt: '2026-07-03T16:05:00', cbsNumber: 'CBS20260703018', failureReason: '' },
    { id: '202607010019', title: '7月通勤交通补贴', type: '报销单', invoice: false, overseas: false, amount: 680, currency: 'CNY', createdAt: '2026-07-01T10:00:00', applicant: '马骏', department: '客服中心', payer: '招商银行深圳分行', content: '员工7月通勤交通补贴', status: '已支付', statusAt: '2026-07-01T17:30:00', cbsNumber: 'CBS20260701019', failureReason: '' },
    { id: '202512280020', title: '年会酒店预付款', type: '付款单', invoice: true, overseas: false, amount: 78000, currency: 'CNY', createdAt: '2025-12-28T10:20:00', applicant: '陈雨', department: '行政部', payer: '交通银行深圳分行', content: '2026年度年会酒店预订定金', status: '已支付', statusAt: '2025-12-28T15:40:00', cbsNumber: 'CBS20251228020', failureReason: '' },
    { id: '202511150021', title: '德国展会展位费', type: '付款单', invoice: true, overseas: true, amount: 9600, currency: 'EUR', createdAt: '2025-11-15T13:00:00', applicant: '罗欣', department: '国际业务部', payer: '花旗银行', content: '德国慕尼黑展会展位预订费用', status: '已支付', statusAt: '2025-11-15T16:20:00', cbsNumber: 'CBS20251115021', failureReason: '' },
    { id: '202510080022', title: '国庆客户礼品费', type: '报销单', invoice: true, overseas: false, amount: 3280, currency: 'CNY', createdAt: '2025-10-08T09:15:00', applicant: '郭鹏', department: '华东销售部', payer: '建设银行深圳分行', content: '国庆客户礼品采购与快递费', status: '已驳回', statusAt: '2025-10-08T11:00:00', cbsNumber: '', failureReason: '审批备注不完整' },
    { id: '202509220023', title: '海外广告投放', type: '付款单', invoice: false, overseas: true, amount: 5200, currency: 'USD', createdAt: '2025-09-22T11:45:00', applicant: '沈月', department: '增长部', payer: '花旗银行', content: 'Google Ads 北美地区广告账户充值', status: '支付失败', statusAt: '2025-09-22T14:30:00', cbsNumber: 'CBS20250922023', failureReason: '外币账户余额不足' },
    { id: '202508120024', title: '周年庆物料制作费', type: '付款单', invoice: true, overseas: false, amount: 9800, currency: 'CNY', createdAt: '2025-08-12T10:30:00', applicant: '高洁', department: '品牌市场部', payer: '中国工商银行', content: '公司周年庆活动物料设计与制作', status: '待财务审核', statusAt: '2025-08-12T10:30:00', cbsNumber: '', failureReason: '' },
  ];

  const integrationStatusById = {
    '202608120025': ['待拉取', '待同步'],
    '202608110001': ['已归档', '同步成功'],
    '202608100002': ['已归档', '部分失败'],
    '202608090003': ['待拉取', '待同步'],
    '202608080004': ['待拉取', '待同步'],
    '202608070005': ['待拉取', '待同步'],
    '202608060006': ['拉取失败', '待同步'],
    '202608050007': ['待拉取', '待同步'],
    '202608040008': ['已归档', '同步失败'],
    '202608030009': ['待拉取', '待同步'],
    '202608020010': ['拉取失败', '同步失败'],
    '202608010011': ['已归档', '同步成功'],
    '202607310012': ['已归档', '同步成功'],
    '202607280013': ['待拉取', '待同步'],
    '202607240014': ['待拉取', '待同步'],
    '202607180015': ['已归档', '同步成功'],
    '202607150016': ['待拉取', '待同步'],
    '202607090017': ['已归档', '同步成功'],
    '202607030018': ['待拉取', '待同步'],
    '202607010019': ['已归档', '同步失败'],
    '202512280020': ['已归档', '同步成功'],
    '202511150021': ['拉取失败', '同步失败'],
    '202510080022': ['待拉取', '待同步'],
    '202509220023': ['待拉取', '待同步'],
    '202508120024': ['待拉取', '待同步'],
  };

  const OVERSEAS_PAYER = 'Sands Bosum Business Pte. Ltd';
  const payerCompanyByBank = {
    '招商银行深圳分行': '博商管理（深圳）有限公司',
    '中国工商银行': '博商科技（深圳）有限公司',
    '中国银行深圳分行': '博商国际贸易（深圳）有限公司',
    '花旗银行': '博商香港有限公司',
    '交通银行深圳分行': '博商教育科技（深圳）有限公司',
    '建设银行深圳分行': '博商品牌文化（深圳）有限公司',
    '中国建设银行': '博商人力资源服务（深圳）有限公司',
  };

  documents.forEach(function (document) {
    const statuses = integrationStatusById[document.id] || ['待拉取', '待同步'];
    document.payer = document.overseas ? OVERSEAS_PAYER : (payerCompanyByBank[document.payer] || '博商管理（深圳）有限公司');
    document.isOverseasPayment = document.payer === OVERSEAS_PAYER;
    document.receiptStatus = !document.isOverseasPayment && document.status === '已支付' ? statuses[0] : '—';
    document.kingdeeStatus = document.status === '已支付'
      && (document.isOverseasPayment || document.receiptStatus === '已归档') ? statuses[1] : '—';
    document.paymentFailureReason = document.status === '支付失败'
      ? document.failureReason
      : '';
    document.receiptFailureReason = document.receiptStatus === '拉取失败'
      ? 'CBS未返回电子回单，请人工上传'
      : '';
    document.kingdeeFailureReason = document.kingdeeStatus === '同步失败'
      ? '金蝶凭证校验失败，请人工同步'
      : (document.kingdeeStatus === '部分失败' ? '拆单时部分单据同步失败、部分附件同步失败' : '');
    document.kingdeeCode = document.kingdeeStatus === '同步成功'
      ? 'FKD' + String(document.id).slice(-7)
      : '';
    document.cbsNumber = document.isOverseasPayment ? '' : document.cbsNumber;
    document.cbsApplicationNumber = !document.isOverseasPayment && document.cbsNumber ? 'CBSAPP' + String(document.id).slice(-11) : '';
    document.receiptNumber = document.receiptStatus === '已归档' ? 'RC' + String(document.id).slice(-8) : '';
    document.timeline = [];
    document.approvalPassedAt = ['待支付', '支付失败', '已支付'].includes(document.status)
      ? document.createdAt
      : '';
    document.payeeType = (document.type === '报销单' || document.type === '差旅报销单')
      ? '个人'
      : '公司';

    if (document.status !== '待财务审核') {
      document.timeline.push({ action: '审批', note: document.status === '已驳回' ? '审批驳回' : '审批通过', operator: '财务专员', at: document.createdAt });
    }
    if (!document.isOverseasPayment && (document.status === '待支付' || document.status === '支付失败' || document.status === '已支付')) {
      document.timeline.push({ action: '提交付款', note: '同步CBS成功，CBS申请单编号：' + document.cbsApplicationNumber, operator: '系统', at: document.statusAt });
      document.timeline.push({ action: '获取支付结果', note: document.status === '支付失败' ? '查询CBS支付失败：' + document.paymentFailureReason : '查询CBS支付成功，CBS交易流水号：' + document.cbsNumber, operator: '系统', at: document.statusAt });
    }
    if (document.status === '已支付' && document.receiptStatus !== '—') {
      document.timeline.push({ action: '拉取回单结果', note: document.receiptStatus === '拉取失败' ? '拉取CBS回单失败：' + document.receiptFailureReason : '拉取CBS回单成功，回单号：' + document.receiptNumber, operator: '系统', at: document.statusAt });
    }
    if (document.status === '已支付' && (document.isOverseasPayment || document.receiptStatus === '已归档') && document.kingdeeStatus !== '—') {
      document.timeline.push({ action: '同步金蝶', note: document.kingdeeStatus === '同步成功' ? '同步成功，金蝶编码：' + document.kingdeeCode : (document.kingdeeStatus === '部分失败' ? '金蝶部分失败：' : '金蝶同步失败：') + document.kingdeeFailureReason, operator: '系统', at: document.statusAt });
    }
  });

  root.RECEIPT_DOCUMENTS = documents;
  root.PAYER_OPTIONS = Array.from(new Set(documents.map(function (document) {
    return document.payer;
  })));
}(window));
