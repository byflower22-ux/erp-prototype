const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const pagePath = path.join(__dirname, '..', 'index.html');
const appPath = path.join(__dirname, '..', 'assets', 'js', 'app.js');
const stylePath = path.join(__dirname, '..', 'assets', 'css', 'styles.css');

function attribute(openingTag, name) {
  const match = openingTag.match(new RegExp(`\\s${name}="([^"]*)"`));
  return match ? match[1] : undefined;
}

function hasClass(openingTag, className) {
  return (attribute(openingTag, 'class') || '').split(/\s+/).includes(className);
}

function openingTagWithAttribute(page, tagName, name, value) {
  const tags = page.match(new RegExp(`<${tagName}\\b[^>]*>`, 'g')) || [];
  return tags.find((tag) => attribute(tag, name) === value);
}

function openingTagWithClass(page, tagName, className) {
  const tags = page.match(new RegExp(`<${tagName}\\b[^>]*>`, 'g')) || [];
  return tags.find((tag) => hasClass(tag, className));
}

test('receipt list page provides the required application structure', () => {
  const page = fs.readFileSync(pagePath, 'utf8');
  const appShell = openingTagWithClass(page, 'div', 'app-shell');
  const sidebar = openingTagWithAttribute(page, 'aside', 'id', 'sidebar');
  const topbar = openingTagWithClass(page, 'header', 'topbar');
  const main = openingTagWithClass(page, 'main', 'main-content');
  const filterPanel = openingTagWithAttribute(page, 'section', 'id', 'filter-panel');
  const table = (page.match(/<table\b[^>]*>[\s\S]*?<\/table>/g) || []).find((item) => /<tbody\b[^>]*\bid="receipt-table-body"[^>]*><\/tbody>/.test(item));
  const pagination = openingTagWithAttribute(page, 'nav', 'id', 'pagination');
  const dialog = openingTagWithAttribute(page, 'div', 'id', 'detail-dialog');
  const closeButton = openingTagWithAttribute(page, 'button', 'id', 'detail-dialog-close');
  const toast = openingTagWithAttribute(page, 'div', 'id', 'toast');
  const helpButton = (page.match(/<button\b[^>]*>/g) || []).find((tag) => hasClass(tag, 'floating-button--help'));
  const supportButton = (page.match(/<button\b[^>]*>/g) || []).find((tag) => hasClass(tag, 'floating-button--support'));

  assert.ok(appShell, 'an app-shell container is present');
  assert.ok(sidebar, 'a sidebar aside is present');
  assert.ok(hasClass(sidebar, 'sidebar'), 'the sidebar has its sidebar class');
  assert.ok(topbar, 'a top bar header is present');
  assert.ok(main, 'the main content landmark is present');
  assert.ok(filterPanel, 'a filter panel section is present');
  assert.ok(hasClass(filterPanel, 'filter-panel'), 'the filter panel has its filter-panel class');
  assert.ok(table, 'a table contains the receipt table body');
  assert.ok(pagination, 'a pagination nav is present');
  assert.ok(dialog, 'a detail dialog container is present');
  assert.equal(attribute(dialog, 'role'), 'dialog');
  assert.equal(attribute(dialog, 'aria-modal'), 'true');
  assert.match(dialog, /\shidden(?:\s|=|>)/);
  assert.ok(closeButton, 'an accessible dialog close button is present');
  assert.equal(attribute(closeButton, 'aria-label'), '关闭详情');
  assert.ok(toast, 'a toast container is present');
  assert.ok(helpButton, 'a help floating button is present');
  assert.ok(hasClass(helpButton, 'floating-button'), 'the help button uses floating button styling');
  assert.ok(supportButton, 'a support floating button is present');
  assert.ok(hasClass(supportButton, 'floating-button'), 'the support button uses floating button styling');
  assert.match(
    page,
    /<script\b[^>]*\bsrc="assets\/js\/logic\.js"[^>]*><\/script>\s*<script\b[^>]*\bsrc="assets\/js\/data\.js"[^>]*><\/script>\s*<script\b[^>]*\bsrc="assets\/js\/action-logic\.js"[^>]*><\/script>\s*<script\b[^>]*\bsrc="assets\/js\/app\.js"[^>]*><\/script>\s*<\/body>\s*<\/html>\s*$/,
  );
});

test('search label describes the input without wrapping its search button', () => {
  const page = fs.readFileSync(pagePath, 'utf8');
  const searchLabel = openingTagWithAttribute(page, 'label', 'for', 'keyword-input');
  const searchContainer = openingTagWithClass(page, 'div', 'keyword-search');
  const searchLabelContent = page.match(/<label\b[^>]*\bfor="keyword-input"[^>]*>([\s\S]*?)<\/label>/);

  assert.ok(searchLabel, 'the search input has an associated label');
  assert.ok(searchContainer, 'the search controls use a non-label container');
  assert.match(searchContainer, /<div\b/);
  assert.ok(searchLabelContent, 'the search label has closing markup');
  assert.doesNotMatch(searchLabelContent[1], /<(?:input|button)\b/);
});

test('approval page uses 审批确认 as its active menu name', () => {
  const html = fs.readFileSync(pagePath, 'utf8');
  assert.match(html, /class="submenu-item--selected"[^>]*>审批确认<\/button>/);
  assert.match(html, /class="page-tab page-tab--active"[^>]*>审批确认/);
  assert.doesNotMatch(html, /<h1>审批确认<\/h1>/);
  assert.doesNotMatch(html, /付款与报销单据列表/);
});

test('approval page keeps the result count but removes the refresh shortcut', () => {
  const html = fs.readFileSync(pagePath, 'utf8');
  const script = fs.readFileSync(appPath, 'utf8');
  const styles = fs.readFileSync(stylePath, 'utf8');

  assert.match(html, /id="result-summary"/);
  assert.doesNotMatch(html, /id="refresh-button"/);
  assert.doesNotMatch(script, /getElementById\('refresh-button'\)/);
  assert.match(styles, /\.page-toolbar\s+\.toolbar-actions\s*\{[^}]*margin-left:\s*auto/);
});

test('list approval, title, and detail actions navigate to the standalone approval detail page', () => {
  const page = fs.readFileSync(pagePath, 'utf8');
  const script = fs.readFileSync(appPath, 'utf8');

  assert.match(page, /<section id="approval-detail-page" class="approval-detail-page" hidden>/);
  assert.match(script, /function openApprovalDetails\(id, approvalMode\) \{[\s\S]*?renderApprovalDetailPage\(receipt, approvalMode\)/);
  assert.match(script, /function renderApprovalDetailPage\(receipt, approvalMode\)/);
  assert.match(script, /data-action="approval-detail-back"/);
  assert.match(script, /action === 'approval-detail-back'/);
});

test('approval detail tab has a fixed name and a working close action', () => {
  const script = fs.readFileSync(appPath, 'utf8');

  assert.match(script, /data-action="approval-detail-close">审批详情/);
  assert.match(script, /action === 'approval-detail-close'/);
});

test('standalone approval detail page uses the compact red action toolbar style', () => {
  const script = fs.readFileSync(appPath, 'utf8');
  const styles = fs.readFileSync(stylePath, 'utf8');

  assert.match(script, /actionButtons\s*=\s*renderStateActionButtons\(receipt, true\)\s*\.replace\(\/operation-button\/g, 'operation-button operation-button--detail'\)/);
  assert.doesNotMatch(script, /approval-detail-page__back/);
  assert.match(styles, /\.approval-detail-page__toolbar\s*\{[^}]*min-height:\s*52px/);
  assert.match(styles, /\.operation-button--detail\s*\{[^}]*color:\s*#fff[^}]*background:\s*var\(--accent\)/);
});

test('file preview opens a dedicated page with a receipt category', () => {
  const page = fs.readFileSync(pagePath, 'utf8');
  const script = fs.readFileSync(appPath, 'utf8');

  assert.match(page, /<section id="file-preview-page" class="file-preview-page" hidden><\/section>/);
  assert.match(script, /function openFilePreview\(id\)/);
  assert.match(script, /data-action="file-preview"/);
  assert.match(script, /category === '回单' \? 'receipt'/);
  assert.match(script, /readFilePreviewIdFromHash/);
});

test('receipt category in file preview is marked as a new function', () => {
  const script = fs.readFileSync(appPath, 'utf8');

  assert.match(script, /const categoryLabel = category === '回单'/);
  assert.match(script, /本次新增：回单文件分类/);
  assert.match(script, /change-marker--new/);
});

test('file preview category marker keeps the receipt label left aligned', () => {
  const styles = fs.readFileSync(stylePath, 'utf8');

  assert.match(styles, /\.preview-category h3 > span:last-child\s*\{[^}]*margin-left:\s*auto/);
  assert.doesNotMatch(styles, /\.preview-category h3 span\s*\{[^}]*margin-left:\s*auto/);
});

test('approval detail file preview is marked as an updated function', () => {
  const script = fs.readFileSync(appPath, 'utf8');

  assert.match(script, /change-marker-anchor"><button class="operation-button operation-button--detail file-preview-button"/);
  assert.match(script, /本次调整：文件预览/);
  assert.match(script, /change-marker--updated/);
});

test('file preview tab close returns to the approval list', () => {
  const script = fs.readFileSync(appPath, 'utf8');

  assert.match(script, /data-action="file-preview-close"/);
  assert.match(script, /action === 'file-preview-close'/);
});

test('manual receipt uploads persist locally for the new preview page', () => {
  const script = fs.readFileSync(appPath, 'utf8');

  assert.match(script, /function persistDocuments\(\)/);
  assert.match(script, /function hydrateDocumentsFromStorage\(\)/);
  assert.match(script, /const mergedDocuments = RECEIPT_DOCUMENTS\.map/);
  assert.match(script, /RECEIPT_DOCUMENTS\.splice\.apply\(RECEIPT_DOCUMENTS, \[0, RECEIPT_DOCUMENTS\.length\]\.concat\(mergedDocuments\)\)/);
});

test('cached manual payments remove CBS submission and payment-result log nodes', () => {
  const script = fs.readFileSync(appPath, 'utf8');

  assert.match(script, /function normalizeDocumentFields\(\)/);
  assert.match(script, /event\.action !== '\u63d0\u4ea4\u4ed8\u6b3e'/);
  assert.match(script, /event\.action !== '\u83b7\u53d6\u652f\u4ed8\u7ed3\u679c'/);
});

test('receipt app contains dialog, custom date range, and menu dismissal hooks', () => {
  const script = fs.readFileSync(appPath, 'utf8');

  assert.match(script, /function openDetails\(id(?:, options)?\)/);
  assert.match(script, /function closeDetails\(\)/);
  assert.match(script, /detail-dialog-close/);
  assert.match(script, /data-close-dialog/);
  assert.match(script, /event\.key === 'Escape'/);
  assert.match(script, /function trapDialogFocus\(event, dialog\)/);
  assert.match(script, /event\.key === 'Tab'/);
  assert.match(script, /state\.filters\.startDate/);
  assert.match(script, /state\.filters\.endDate/);
  assert.match(script, /document\.addEventListener\('click'/);
});

test('approval page exposes CBS receipt and Kingdee status tracking', () => {
  const page = fs.readFileSync(pagePath, 'utf8');
  const script = fs.readFileSync(appPath, 'utf8');

  assert.match(page, /aria-label="回单状态"/);
  assert.match(page, /aria-label="金蝶状态"/);
  assert.match(page, /data-value="拉取失败"/);
  assert.doesNotMatch(page, /拉取超期|待人工上传|待人工处理/);
  assert.match(page, /<th scope="col"><span class="change-marker-anchor">回单状态<span class="change-marker change-marker--new"[^>]*><\/span><\/span><\/th>/);
  assert.match(page, /<th scope="col"><span class="change-marker-anchor">金蝶状态<span class="change-marker change-marker--new"[^>]*><\/span><\/span><\/th>/);
  assert.match(script, /receiptStatus/);
  assert.match(script, /kingdeeStatus/);
});

test('overseas payments hide receipt workflow and require no receipt upload on payment', () => {
  const script = fs.readFileSync(appPath, 'utf8');

  assert.match(script, /function isOverseasPayment\(receipt\)/);
  assert.match(script, /action === 'pay' && isOverseasPayment\(receipt\)/);
  assert.match(script, /\\u8bf7\\u786e\\u8ba4\\u5df2\\u5b8c\\u6210\\u6d77\\u5916\\u4ed8\\u6b3e/);
  assert.match(script, /isOverseasPayment\(receipt\) \? '\\u2014' : displayValue\(receipt\.cbsNumber\)/);
});

test('overseas payment confirmation does not provide a remark field', () => {
  const script = fs.readFileSync(appPath, 'utf8');

  assert.match(
    script,
    /else if \(action === 'pay' && isOverseasPayment\(receipt\)\) \{\s*controls = '<p class="operation-confirmation">\\u8bf7\\u786e\\u8ba4\\u5df2\\u5b8c\\u6210\\u6d77\\u5916\\u4ed8\\u6b3e\\uff0c\\u5355\\u636e\\u5c06\\u76f4\\u63a5\\u540c\\u6b65\\u91d1\\u8776<\/p>';/
  );
});

test('cached paid overseas documents are migrated into the Kingdee-only path', () => {
  const script = fs.readFileSync(appPath, 'utf8');

  assert.match(script, /document\.isOverseasPayment && document\.status === '\u5df2\u652f\u4ed8' && document\.kingdeeStatus === '\u2014'/);
  assert.match(script, /document\.kingdeeStatus = '\u540c\u6b65\u6210\u529f'/);
});

test('cached receipt-failure fixture stays domestic so its receipt status remains visible', () => {
  const script = fs.readFileSync(appPath, 'utf8');

  assert.match(script, /document\.id === '202608060006'\) \{\s*document\.overseas = false;/);
});

test('partial receipt pulls are normalized as failures with their receipt files cleared', () => {
  const script = fs.readFileSync(appPath, 'utf8');

  assert.match(script, /document\.receiptStatus === '部分拉取失败'/);
  assert.match(script, /document\.receiptStatus = '拉取失败';/);
  assert.match(script, /document\.receiptFiles = \[\];/);
});

test('Kingdee status filter includes partial failure', () => {
  const page = fs.readFileSync(pagePath, 'utf8');

  assert.match(page, /data-filter="kingdeeStatus" data-value="部分失败">部分失败<\/button>/);
});

test('cached sample document is migrated to the partial Kingdee failure state', () => {
  const script = fs.readFileSync(appPath, 'utf8');

  assert.match(script, /document\.id === '202608100002' && document\.kingdeeStatus === '同步成功'/);
  assert.match(script, /document\.kingdeeStatus = '部分失败';/);
});

test('approval page provides approval-time and payee-type columns with filters', () => {
  const page = fs.readFileSync(pagePath, 'utf8');
  const script = fs.readFileSync(appPath, 'utf8');

  assert.match(page, /data-filter="approvalDatePreset"/);
  assert.match(page, /id="approval-start-date"/);
  assert.match(page, /data-filter="payeeType" data-value="公司"/);
  assert.match(page, /<th scope="col">流程审批通过时间<\/th>/);
  assert.match(page, /<th scope="col">收款方类型<\/th>/);
  assert.match(script, /approvalPassedAt/);
  assert.match(script, /payeeType/);
});

test('desktop layout reserves readable navigation and table column widths', () => {
  const styles = fs.readFileSync(stylePath, 'utf8');

  assert.match(styles, /--sidebar-width:\s*196px/);
  assert.match(styles, /font:\s*14px\/1\.5/);
  assert.match(styles, /\.financial-submenu button\s*\{[^}]*font-size:\s*13px/s);
  assert.match(styles, /table\s*\{[^}]*width:\s*3400px/s);
  assert.match(styles, /th:nth-child\(13\)\s*\{\s*width:\s*280px/);
  assert.match(styles, /th:nth-child\(22\)\s*\{\s*width:\s*220px/);
  assert.match(styles, /th:nth-child\(23\)\s*\{\s*width:\s*90px/);
});

test('approval page provides the operation dialog contract', () => {
  const page = fs.readFileSync(pagePath, 'utf8');
  const operationDialog = openingTagWithAttribute(page, 'div', 'id', 'operation-dialog');
  const operationForm = openingTagWithAttribute(page, 'form', 'id', 'operation-form');
  const operationFields = openingTagWithAttribute(page, 'div', 'id', 'operation-fields');
  const operationTitle = openingTagWithAttribute(page, 'h2', 'id', 'operation-dialog-title');
  const operationClose = openingTagWithAttribute(page, 'button', 'id', 'operation-dialog-close');
  const operationError = openingTagWithAttribute(page, 'p', 'id', 'operation-error');
  const cancelButton = openingTagWithAttribute(page, 'button', 'id', 'operation-cancel');
  const submitButton = openingTagWithAttribute(page, 'button', 'id', 'operation-submit');

  assert.match(page, /<th scope="col"><span class="change-marker-anchor">操作<span class="change-marker change-marker--updated"[^>]*><\/span><\/span><\/th>/);
  assert.match(page, /<th scope="col">金蝶编码<\/th>/);
  assert.doesNotMatch(page, /<th scope="col">金额编号<\/th>/);
  assert.doesNotMatch(page, /<th scope="col">处理<\/th>/);
  assert.ok(operationDialog, 'an operation dialog container is present');
  assert.equal(attribute(operationDialog, 'role'), 'dialog');
  assert.equal(attribute(operationDialog, 'aria-modal'), 'true');
  assert.equal(attribute(operationDialog, 'aria-labelledby'), 'operation-dialog-title');
  assert.match(operationDialog, /\shidden(?:\s|=|>)/);
  assert.ok(operationTitle, 'the operation dialog has a labelled title');
  assert.ok(operationClose, 'an operation dialog close control is present');
  assert.ok(attribute(operationClose, 'aria-label'), 'the operation close control has an accessible name');
  assert.ok(operationForm, 'an operation form is present');
  assert.ok(operationFields, 'the operation form provides a dynamic fields host');
  assert.ok(operationError, 'the operation form has an inline error host');
  assert.equal(attribute(operationError, 'role'), 'alert');
  assert.ok(cancelButton, 'an operation cancel button is present');
  assert.equal(attribute(cancelButton, 'type'), 'button');
  assert.ok(submitButton, 'an operation submit button is present');
  assert.equal(attribute(submitButton, 'type'), 'submit');
  assert.match(
    page,
    /<script\b[^>]*\bsrc="assets\/js\/logic\.js"[^>]*><\/script>\s*<script\b[^>]*\bsrc="assets\/js\/data\.js"[^>]*><\/script>\s*<script\b[^>]*\bsrc="assets\/js\/action-logic\.js"[^>]*><\/script>\s*<script\b[^>]*\bsrc="assets\/js\/app\.js"[^>]*><\/script>\s*<\/body>\s*<\/html>\s*$/,
  );
});

test('approval page renders common and state-driven operation controls', () => {
  const script = fs.readFileSync(appPath, 'utf8');

  assert.match(script, /function renderOperationButtons\(receipt, showCommonMarkers\)/);
  assert.match(script, /function submitOperation\(event\)/);
  assert.match(script, /function renderTimeline\(timeline\)/);
  assert.match(script, /IntegrationActionLogic\.applyManualAction/);
  assert.match(script, /data-action="details"/);
  assert.match(script, /data-action="logs"/);
  assert.match(script, /data-action="operation"/);
  assert.match(script, /'approve': '\\u5ba1\\u6279'/);
  assert.match(script, /'pay': '\\u652f\\u4ed8'/);
  assert.match(script, /'sync-kingdee': '\\u540c\\u6b65\\u91d1\\u8776'/);
});

test('operation logs render as an auditable four-column table', () => {
  const script = fs.readFileSync(appPath, 'utf8');

  assert.match(script, /function renderOperationLogs\(timeline\)/);
  assert.match(script, /<th>操作时间<\/th><th>操作人<\/th><th>操作节点<\/th><th>备注<\/th>/);
  assert.match(script, /content\.innerHTML = renderOperationLogs\(receipt\.timeline\)/);
});

test('operation log people display as name and employee number while system stays system', () => {
  const script = fs.readFileSync(appPath, 'utf8');

  assert.match(script, /function formatOperator\(operator\)/);
  assert.match(script, /\\u8d22\\u52a1\\u4e13\\u5458': 'F0001'/);
  assert.match(script, /\\u8d85\\u7ea7\\u7ba1\\u7406\\u5458': 'A0001'/);
  assert.match(script, /formatOperator\(event\.operator\)/);
});

test('receipt upload accepts up to nine required files without format restriction', () => {
  const script = fs.readFileSync(appPath, 'utf8');

  assert.match(script, /<label for="receipt-number"><span class="required-mark" aria-hidden="true">\*<\/span>\\u56de\\u5355\\u53f7<\/label>/);
  assert.match(script, /<label for="receipt-file"><span class="required-mark" aria-hidden="true">\*<\/span>\\u56de\\u5355\\u6587\\u4ef6<\/label>/);
  assert.doesNotMatch(script, /<label for="operation-note"><span class="required-mark"/);
  assert.match(script, /id="receipt-file" name="file" type="file" multiple required/);
  assert.doesNotMatch(script, /id="receipt-file"[^>]*accept=/);
  assert.match(script, /fileInput\.files\.length > 9/);
});

test('payment confirmation prompts for completed payment and receipt upload', () => {
  const script = fs.readFileSync(appPath, 'utf8');

  assert.match(script, /action === 'pay' \? '<p class="operation-confirmation">\\u8bf7\\u786e\\u8ba4\\u5df2\\u5b8c\\u6210\\u652f\\u4ed8\\u5e76\\u4e0a\\u4f20\\u652f\\u4ed8\\u56de\\u5355<\/p>' : ''/);
});

test('Kingdee sync confirmation provides no remark field', () => {
  const script = fs.readFileSync(appPath, 'utf8');
  const styles = fs.readFileSync(path.join(__dirname, '..', 'assets', 'css', 'styles.css'), 'utf8');

  assert.match(script, /action === 'sync-kingdee'/);
  assert.match(script, /确认后单据将同步到金蝶/);
  assert.match(styles, /\.operation-confirmation\s*\{[^}]*border:\s*0/);
  assert.match(styles, /\.operation-confirmation\s*\{[^}]*background:\s*transparent/);
});

test('partial Kingdee failures prompt users to delete synced documents before retrying', () => {
  const script = fs.readFileSync(appPath, 'utf8');

  assert.match(script, /receipt\.kingdeeStatus === '部分失败' \? '请将已同步到金蝶的单据删除，再确认重新同步'/);
});

test('partial Kingdee failure provides a visible example of this-release markers', () => {
  const page = fs.readFileSync(pagePath, 'utf8');
  const script = fs.readFileSync(appPath, 'utf8');
  const styles = fs.readFileSync(stylePath, 'utf8');

  assert.match(page, /class="change-marker-guide"/);
  assert.match(page, /本次新增：回单状态筛选/);
  assert.match(page, /本次新增：金蝶状态筛选/);
  assert.match(page, /本次新增：回单状态字段/);
  assert.match(page, /本次新增：金蝶状态字段/);
  assert.match(page, /本次调整：操作栏合并状态处理动作/);
  assert.match(page, /本次调整：失败原因字段/);
  assert.match(script, /change-marker--new/);
  assert.match(script, /change-marker--updated/);
  assert.match(script, /pay:\s*'updated'/);
  assert.match(script, /'upload-receipt':\s*'new'/);
  assert.match(script, /'sync-kingdee':\s*'new'/);
  assert.doesNotMatch(script, /本次新增：金蝶部分失败状态/);
  assert.match(styles, /\.change-marker--new/);
  assert.match(styles, /\.change-marker--updated/);
  assert.match(styles, /\.change-marker\s*\{[^}]*width:\s*18px[^}]*height:\s*18px/);
  assert.match(styles, /\.change-marker\s*\{[^}]*border:\s*2px solid/);
  assert.match(styles, /border-radius:\s*50%/);
  assert.doesNotMatch(styles, /\.status::before/);
});

test('details and logs show this-release markers only on the first rendered row', () => {
  const script = fs.readFileSync(appPath, 'utf8');

  assert.match(script, /function renderOperationButtons\(receipt, showCommonMarkers\)/);
  assert.match(script, /showCommonMarkers\s*\?\s*'<span class="change-marker-anchor">'/);
  assert.match(script, /renderOperationButtons\(receipt, index === 0\)/);
});

test('change markers float above their target without consuming layout space', () => {
  const styles = fs.readFileSync(stylePath, 'utf8');

  assert.match(styles, /\.change-marker-anchor\s*\{[^}]*position:\s*relative/);
  assert.match(styles, /\.change-marker\s*\{[^}]*position:\s*absolute[^}]*top:\s*-\d+px[^}]*right:\s*-\d+px/);
  assert.match(styles, /\.change-marker-guide\s+\.change-marker\s*\{[^}]*position:\s*static/);
});

test('change marker guide lives in the upper-right toolbar and supports hiding markers', () => {
  const page = fs.readFileSync(pagePath, 'utf8');
  const script = fs.readFileSync(appPath, 'utf8');
  const styles = fs.readFileSync(stylePath, 'utf8');
  const toolbar = openingTagWithClass(page, 'section', 'page-toolbar');
  const toolbarStart = page.indexOf(toolbar);
  const toolbarEnd = page.indexOf('</section>', toolbarStart);
  const toolbarContent = page.slice(toolbarStart, toolbarEnd);

  assert.match(toolbarContent, /class="change-marker-guide"/);
  assert.match(toolbarContent, /id="change-marker-toggle"/);
  assert.equal(page.indexOf('change-marker-guide', toolbarEnd), -1);
  assert.match(script, /getElementById\('change-marker-toggle'\)/);
  assert.match(script, /change-markers-hidden/);
  assert.match(styles, /\.change-markers-hidden\s+\.change-marker/);
});

test('upper-right reset button clears locally persisted workflow data and reloads the initial fixtures', () => {
  const page = fs.readFileSync(pagePath, 'utf8');
  const script = fs.readFileSync(appPath, 'utf8');
  const toolbar = openingTagWithClass(page, 'section', 'page-toolbar');
  const toolbarStart = page.indexOf(toolbar);
  const toolbarEnd = page.indexOf('</section>', toolbarStart);
  const toolbarContent = page.slice(toolbarStart, toolbarEnd);

  assert.match(toolbarContent, /id="reset-data-button"/);
  assert.match(script, /getElementById\('reset-data-button'\)/);
  assert.match(script, /localStorage\.removeItem\(DOCUMENT_STORAGE_KEY\)/);
  assert.match(script, /location\.reload\(\)/);
});

test('manual operation refreshes only the matching open detail dialog', () => {
  const script = fs.readFileSync(appPath, 'utf8');

  assert.match(script, /detailDocumentId/);
  assert.match(script, /state\.detailDocumentId === String\(documentToUpdate\.id\)/);
});

test('manual operation keeps the original detail trigger as the refreshed dialog return target', () => {
  const script = fs.readFileSync(appPath, 'utf8');

  assert.match(script, /function openDetails\(id, options\)/);
  assert.match(script, /preserveFocus/);
  assert.match(script, /detailReturnFocus/);
  assert.match(script, /detailReturnFocus\.isTitleLink/);
  assert.match(script, /openDetails\(updated\.id, \{ preserveFocus: true \}\)/);
});

test('manual operation UI hides empty processing text and preserves timeline notes', () => {
  const script = fs.readFileSync(appPath, 'utf8');
  const styles = fs.readFileSync(path.join(__dirname, '..', 'assets', 'css', 'styles.css'), 'utf8');

  assert.doesNotMatch(script, /暂无待处理事项|\\u6682\\u65e0\\u5f85\\u5904\\u7406\\u4e8b\\u9879/);
  assert.match(styles, /th:nth-child\(1\)\s*\{\s*width:\s*220px/);
  assert.match(styles, /\.table-actions\s*\{[^}]*flex-wrap:\s*wrap/s);
  assert.match(script, /timeline-note/);
  assert.match(styles, /\.timeline-note\s*\{[^}]*white-space:\s*pre-wrap/);
});

test('operation buttons use a neutral default and red hover or pressed states', () => {
  const styles = fs.readFileSync(path.join(__dirname, '..', 'assets', 'css', 'styles.css'), 'utf8');

  assert.doesNotMatch(styles, /\.operation-button\s*\{[^}]*color:\s*#e06161/);
  assert.match(styles, /\.detail-button:hover,\s*\.detail-button:focus-visible,\s*\.detail-button:active,[\s\S]*?\.operation-button:hover,\s*\.operation-button:focus-visible,\s*\.operation-button:active\s*\{[^}]*color:\s*#f45656/);
});
