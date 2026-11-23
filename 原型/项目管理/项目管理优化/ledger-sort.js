/* Shared header sorting for the two accounting ledgers. */
(function(root){
  'use strict';
  const e=root.ProjectUI.esc,excluded=new Set(['序号','核算期间','缺失内容']);
  function headers(columns,order,scope,renderTitle){return columns.map(([label,,numeric,sortable])=>{
    const canSort=!excluded.has(label)&&sortable!==false;
    const active=order?.field===label,direction=active?order.direction:'none';
    const title=canSort?`<button type="button" class="ledger-sort-button" data-action="ledger-sort" data-ledger="${e(scope)}" data-field="${e(label)}" aria-label="${e(label)}排序" title="${direction==='asc'?'切换为降序':direction==='desc'?'取消排序':'切换为升序'}"><span>${e(label)}</span><span class="ledger-sort-arrows" aria-hidden="true"><i class="${direction==='asc'?'active':''}">▲</i><i class="${direction==='desc'?'active':''}">▼</i></span></button>`:e(label);
    return `<th scope="col"${numeric?' class="num"':''}${canSort?` aria-sort="${direction==='asc'?'ascending':direction==='desc'?'descending':'none'}"`:''}>${renderTitle?.(label,title)??title}</th>`;
  }).join('');}
  function sort(rows,columns,order){
    const column=columns.find(([label])=>label===order?.field);
    if(!column||excluded.has(column[0])||column[3]===false||!['asc','desc'].includes(order.direction))return rows.slice();
    const container=document.createElement('div'),get=row=>{
      container.innerHTML=String(column[1](row)??'');
      const value=container.textContent.trim();
      if(!value||['-','—'].includes(value)||/待补充|待补齐|试算/.test(value))return null;
      if(column[2]){const numeric=Number(value.replace(/,/g,'').replace(/h$|%$|\s*倍$/g,''));return Number.isFinite(numeric)?numeric:null;}
      return value;
    };
    return rows.map((row,index)=>({row,index,value:get(row)})).sort((a,b)=>{
      if(a.value===null||b.value===null)return a.value===b.value?a.index-b.index:a.value===null?1:-1;
      const compared=column[2]?a.value-b.value:a.value.localeCompare(b.value,'zh-CN',{numeric:true});
      return (order.direction==='desc'?-compared:compared)||a.index-b.index;
    }).map(x=>x.row);
  }
  function exportTable(table){
    const headings=[...table.tHead.rows],leaf=headings.at(-1);
    const columns=[...leaf.cells].map(cell=>{
      const copy=cell.cloneNode(true);copy.querySelectorAll('.ledger-sort-arrows,svg').forEach(el=>el.remove());
      return {label:copy.textContent.trim(),numeric:cell.classList.contains('num')};
    });
    return {columns,groups:headings.length>1?[...headings[0].cells].map(cell=>({label:cell.textContent.trim(),span:cell.colSpan})):[],rows:[...table.tBodies[0].rows].filter(row=>row.cells.length===columns.length&&!row.cells[0].hasAttribute('colspan')).map(row=>[...row.cells].map(cell=>cell.textContent.trim()))};
  }
  root.LedgerSort={headers,sort,exportTable};
})(window);
