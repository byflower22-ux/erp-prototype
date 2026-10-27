const fs = require('node:fs');
const path = require('node:path');
const base = __dirname;
const detailPath = path.join(base, 'reimbursement-detail.html');
const detail = fs.readFileSync(detailPath, 'utf8').replace(/<script(?: src="reimbursement-runtime.js")?>[\s\S]*?<\/script>/, () => '<script>' + fs.readFileSync(path.join(base, 'reimbursement-runtime.js'), 'utf8') + '</script>');
let html = fs.readFileSync(path.join(base, 'index.html'), 'utf8');
// The exported standalone artifact keeps its own shell; ERP hosts the source page.
html = html.replace('<script src="../../../公共/client.js"></script>', '');
html = html.replace('<script src="../../../公共/iteration-marks-bridge.js"></script>', '');
html = html.replace('<script src="../../../公共/iteration-marks.js"></script>', () => '<script>\n' + fs.readFileSync(path.resolve(base, '../../../公共/iteration-marks.js'), 'utf8') + '\n</script>');
html = html.replace('<link rel="stylesheet" href="styles.css">', () => '<style>\n' + fs.readFileSync(path.join(base, 'styles.css'), 'utf8') + '\n</style>');
for (const file of ['iteration-marks.js', 'model.js', 'approval.js', 'adjustment.js', 'application.js', 'reimbursement.js', 'app.js']) {
  let source = fs.readFileSync(path.join(base, file), 'utf8');
  if(file === 'reimbursement.js') {
    source = source.replace('/* REIMBURSEMENT_DOCUMENT */ null', () => JSON.stringify(detail).replace(/</g, '\\u003c'));
  }
  html = html.replace(`<script src="${file}"></script>`, () => '<script>\n' + source + '\n</script>');
}
// Never overwrite the migrated baseline or mutate source detail pages during export.
const outputFlag = process.argv.indexOf('--output');
if(outputFlag>=0 && !process.argv[outputFlag+1]) throw new Error('--output 需要目标 HTML 路径');
const output = outputFlag>=0 ? path.resolve(process.argv[outputFlag+1]) : path.join(base, '..', '预算管理交互原型_当前.html');
const baseline = path.resolve(base, '..', '预算管理交互原型.html');
if(output.toLowerCase() === baseline.toLowerCase()) throw new Error('不能覆盖迁入基线，请使用新的输出文件名');
const documentBase = require('node:url').pathToFileURL(path.resolve(base,'../../../..')+path.sep).href;
html = html.replace('<script>\n/* ERP-I003', () => '<script>\nwindow.BudgetMarkDocumentBase='+JSON.stringify(documentBase)+';\n/* ERP-I003');
fs.writeFileSync(output, html);
console.log('已生成：' + output);
