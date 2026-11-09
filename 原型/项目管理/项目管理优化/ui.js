(function(root){
  'use strict';
  const esc=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const money=value=>value===null||value===undefined||!Number.isFinite(Number(value))?'—':Number(value).toLocaleString('zh-CN',{minimumFractionDigits:2,maximumFractionDigits:2});
  const percent=value=>value===null||value===undefined||!Number.isFinite(Number(value))?'—':(Number(value)*100).toFixed(1)+'%';
  const badge=(text,tone='neutral')=>`<span class="badge ${esc(tone)}">${esc(text)}</span>`;
  const button=(text,action,attrs='',tone='')=>`<button type="button" class="btn ${tone}" data-action="${esc(action)}" ${attrs}>${esc(text)}</button>`;
  const card=(label,value,note='',tone='')=>`<div class="metric ${tone}"><span>${esc(label)}</span><strong>${esc(value)}</strong><small>${esc(note)}</small></div>`;
  const empty=text=>`<div class="empty"><span class="empty-symbol">▦</span><b>${esc(text)}</b><p>调整筛选条件，或添加一条记录开始。</p></div>`;
  const table=(headers,rows)=>rows.length?`<div class="table-wrap"><table><thead><tr>${headers.map(h=>`<th>${esc(h)}</th>`).join('')}</tr></thead><tbody>${rows.map(row=>`<tr>${row.map((v,i)=>`<td${i?'':' class="row-title"'}>${v??'—'}</td>`).join('')}</tr>`).join('')}</tbody></table></div>`:empty('暂无符合条件的数据');
  const options=(rows,value)=>rows.map(r=>`<option value="${esc(r.id??r.value)}" ${String(r.id??r.value)===String(value)?'selected':''}>${esc(r.name??r.label)}</option>`).join('');
  root.ProjectUI={esc,money,percent,badge,button,card,table,empty,options};
})(window);
