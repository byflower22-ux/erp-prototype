const fs = require('node:fs');
const path = require('node:path');
const base = __dirname;
const detailPath = path.join(base, 'reimbursement-detail.html');
const detail = fs.readFileSync(detailPath, 'utf8').replace(/<script(?: src="reimbursement-runtime.js")?>[\s\S]*?<\/script>/, () => '<script>' + fs.readFileSync(path.join(base, 'reimbursement-runtime.js'), 'utf8') + '</script>');
fs.writeFileSync(detailPath, detail);
let html = fs.readFileSync(path.join(base, 'index.html'), 'utf8');
html = html.replace('<link rel="stylesheet" href="styles.css">', () => '<style>\n' + fs.readFileSync(path.join(base, 'styles.css'), 'utf8') + '\n</style>');
for (const file of ['model.js', 'approval.js', 'adjustment.js', 'application.js', 'reimbursement.js', 'app.js']) {
  let source = fs.readFileSync(path.join(base, file), 'utf8');
  if(file === 'reimbursement.js') {
    source = source.replace('/* REIMBURSEMENT_DOCUMENT */ null', () => JSON.stringify(detail).replace(/</g, '\\u003c'));
  }
  html = html.replace(`<script src="${file}"></script>`, () => '<script>\n' + source + '\n</script>');
}
const output = path.join(base, '..', '预算管理交互原型.html');
fs.writeFileSync(output, html);
console.log('已生成：' + output);
