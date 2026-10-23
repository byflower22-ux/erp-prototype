/* Build embeds the local HTML so the delivered prototype remains standalone. */
(function(global){
  const documentHtml=/* REIMBURSEMENT_DOCUMENT */ null;
  global.renderReimbursementExample=function(){
    const escape=value=>value.replace(/&/g,'&amp;').replace(/"/g,'&quot;').replace(/</g,'&lt;');
    return `<iframe class="reimbursement-frame" title="报销申请审批详情" sandbox="allow-scripts" ${documentHtml?'srcdoc="'+escape(documentHtml)+'"':'src="reimbursement-detail.html"'}></iframe>`;
  };
})(window);
