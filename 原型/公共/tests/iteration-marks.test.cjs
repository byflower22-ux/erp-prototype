const {test} = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const target = path.join(__dirname, '../iteration-marks.js');
const api = fs.existsSync(target) ? require(target) : {};
const config = {
  id:'sample', versions:[{id:'ERP-I003',label:'预算优化'},{id:'ERP-I004',label:'回单对接'}],
  marks:[
    {id:'entry',version:'ERP-I003',type:'improved',title:'执行入口',page:'overview',selector:'[data-entry]'},
    {id:'rule',version:'ERP-I003',type:'rule',title:'状态规则',page:'frozen',description:'提交成功冻结'},
    {id:'receipt',version:'ERP-I004',type:'new',title:'回单预览',page:'receipt'}
  ]
};
test('版本与当前页筛选相互独立，规则说明可作为无锚点条目',()=>{
  assert.equal(typeof api.selectMarks,'function');
  assert.deepEqual(api.selectMarks(config,'ERP-I003','overview').map(m=>m.id),['entry']);
  assert.deepEqual(api.selectMarks(config,'ERP-I003').map(m=>m.id),['entry','rule']);
  assert.equal(api.selectMarks(config,'all').length,3);
  assert.equal(api.selectMarks(config,'ERP-I004','overview').length,0);
});
test('拒绝重复编号、未知版本与未知类型，避免标记错配',()=>{
  assert.equal(typeof api.validateConfig,'function');
  assert.deepEqual(api.validateConfig(config),[]);
  assert.ok(api.validateConfig({...config,marks:[...config.marks,config.marks[0]]}).length);
  assert.ok(api.validateConfig({...config,marks:[{...config.marks[0],version:'missing'}]}).length);
  assert.ok(api.validateConfig({...config,marks:[{...config.marks[0],type:'oops'}]}).length);
});
test('资料链接仅接受本地相对路径和 HTTP(S)，拒绝可执行地址',()=>{
  assert.equal(typeof api.safeDocumentURL,'function');
  const base='file:///D:/wzz/ERP/';
  assert.equal(api.safeDocumentURL('文档/需求.md',base),new URL('文档/需求.md',base).href);
  assert.equal(api.safeDocumentURL('https://example.com/a',base),'https://example.com/a');
  for(const url of ['javascript:alert(1)','data:text/html,x','vbscript:x','file:///C:/private.txt','//example.com/a'])
    assert.equal(api.safeDocumentURL(url,base),null);
});
