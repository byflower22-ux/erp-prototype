/* Interactions for the fixed local reimbursement example. No backend writes. */
function closeExample(){parent.postMessage({type:'budget-close-reimbursement'},'*');}
function showToast(message){const toast=document.getElementById('toast');toast.textContent=message;toast.classList.add('show');clearTimeout(window.exampleToast);window.exampleToast=setTimeout(()=>toast.classList.remove('show'),2500);}
function switchApprovalPageTab(tab){document.getElementById('approvalDetailView').hidden=tab!=='detail';document.getElementById('approvalHistoryView').hidden=tab!=='history';document.querySelectorAll('[data-approval-tab]').forEach(button=>button.classList.toggle('active',button.dataset.approvalTab===tab));}
function switchExpensePanel(button){const group=button.closest('.expense-group'),tab=button.dataset.expenseTab;group.querySelectorAll('[data-expense-tab]').forEach(el=>el.classList.toggle('active',el===button));group.querySelectorAll('[data-expense-panel]').forEach(el=>el.hidden=el.dataset.expensePanel!==tab);}
function toggleReviewDrawer(){const drawer=document.getElementById('reviewDrawer'),layout=document.getElementById('approvalLayout');const open=!drawer.classList.contains('show');drawer.classList.toggle('show',open);layout.classList.toggle('is-collapsed',!open);drawer.setAttribute('aria-hidden',String(!open));document.getElementById('openReviewDrawer').hidden=open;}
function selectAiFeedback(button){document.querySelectorAll('[data-feedback]').forEach(el=>el.classList.toggle('is-selected',el===button));document.getElementById('inaccuracySection').hidden=button.dataset.feedback!=='inaccurate';}
function toggleConditionFeedback(input){const row=input.closest('.condition-feedback-item');row.querySelector('.condition-reason').hidden=!input.checked;}
function exampleDialog(title,content,onConfirm){
  document.querySelector('dialog')?.remove();const dialog=document.createElement('dialog');dialog.className='example-dialog';
  const heading=document.createElement('h2');heading.textContent=title;dialog.append(heading,content);
  const footer=document.createElement('div');footer.className='example-dialog-foot';const cancel=document.createElement('button');cancel.textContent=onConfirm?'取消':'关闭';cancel.onclick=()=>dialog.close();footer.append(cancel);
  if(onConfirm){const confirm=document.createElement('button');confirm.className='approval-action';confirm.textContent='确认';confirm.onclick=()=>{if(onConfirm()!==false)dialog.close();};footer.append(confirm);}
  dialog.append(footer);document.body.append(dialog);dialog.showModal();
}
function submitApprovalAction(kind){
  if(kind==='cancel'){closeExample();return;}
  const content=document.createElement('div'),field=document.createElement('textarea');field.rows=3;field.placeholder=kind==='reject'?'请填写驳回意见（必填）':'请输入审批意见';field.setAttribute('aria-label','审批意见');content.append(field);
  exampleDialog(kind==='reject'?'驳回申请':'审批通过',content,()=>{
    if(kind==='reject'&&!field.value.trim()){showToast('请填写驳回意见');return false;}
    const tr=document.createElement('tr');['财务审批','财务管理员',kind==='reject'?'驳回':'通过',field.value.trim()||'同意',new Date().toLocaleString('sv-SE')].forEach(value=>{const td=document.createElement('td');td.textContent=value;tr.append(td);});document.querySelector('#approvalHistoryView tbody').append(tr);showToast('已记录本地示例操作');
  });
}
function previewApprovalFiles(){
  const content=document.createElement('div');content.className='example-file-list';
  document.querySelectorAll('[data-expense-panel="attachment"] strong,.approval-attachment-file').forEach(el=>{const p=document.createElement('p');p.textContent=el.textContent;content.append(p);});
  if(!content.children.length)content.textContent='客户拜访行程说明.pdf、客户拜访业务说明.pdf';
  exampleDialog('附件预览',content);
}
