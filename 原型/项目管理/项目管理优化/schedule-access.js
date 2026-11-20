(function(root){
  'use strict';
  const U=root.ProjectUI,{esc:e,button:b,options,table}=U;
  const time=value=>value?new Intl.DateTimeFormat('zh-CN',{timeZone:'Asia/Shanghai',year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',second:'2-digit',hour12:false}).format(new Date(value)):'—';
  function deadlineReason(date,isAdmin,now=new Date()){
    if(isAdmin)return '';
    const month=String(date).slice(0,7);if(!/^\d{4}-(0[1-9]|1[0-2])$/.test(month))return '';
    const [year,number]=month.split('-').map(Number),next=new Date(Date.UTC(year,number,1)).toISOString().slice(0,7),deadline=next+'-05';
    const today=new Intl.DateTimeFormat('sv-SE',{timeZone:'Asia/Shanghai',year:'numeric',month:'2-digit',day:'2-digit'}).format(now);
    return today>=deadline?month+' 的日程已超过次月5日修改截止时间，请联系管理员调整':'';
  }
  function assertDeadline(changes,isAdmin,now=new Date()){
    for(const change of changes)for(const row of [change.before,change.after])if(row){const reason=deadlineReason(row.date,isAdmin,now);if(reason)throw Error(reason);}
  }
  function controls(c){
    return `<section class="schedule-access-bar" aria-label="日程人员"><div class="schedule-access-fields">${c.scheduleAdmin?`<label>人员<select id="schedule-access-person">${options(c.state.people,c.personId)}</select></label>`:`<span class="schedule-current-person">${e(c.state.people.find(p=>p.id===c.currentUserId)?.name||'本人')}</span>`}</div>${c.mobile?'':b('操作日志','schedule-logs','','schedule-log-button')}</section>`;
  }
  function changes(before,after,actor){
    const prev=new Map(before.times.map(r=>[r.id,r])),next=new Map(after.times.map(r=>[r.id,r])),rows=[],at=new Date().toISOString();
    for(const id of new Set([...prev.keys(),...next.keys()])){
      const old=prev.get(id),value=next.get(id);if(JSON.stringify(old)===JSON.stringify(value))continue;
      const r=value||old;
      rows.push({id:crypto.randomUUID(),at,revision:after.revision,actor:{...actor},personId:r.personId,personName:before.people.find(p=>p.id===r.personId)?.name||r.personId,projectName:before.projects.find(p=>p.id===r.projectId)?.name||r.projectId,action:!old?'新增':!value?'删除':'修改',before:old?structuredClone(old):null,after:value?structuredClone(value):null});
    }
    return rows;
  }
  function defaultRange(now=new Date()){
    const end=new Intl.DateTimeFormat('sv-SE',{timeZone:'Asia/Shanghai',year:'numeric',month:'2-digit',day:'2-digit'}).format(now),[year,month,day]=end.split('-').map(Number);
    const previous=new Date(Date.UTC(year,month-2,1)),lastDay=new Date(Date.UTC(previous.getUTCFullYear(),previous.getUTCMonth()+1,0)).getUTCDate();
    return {start:previous.toISOString().slice(0,7)+'-'+String(Math.min(day,lastDay)).padStart(2,'0'),end,page:1,size:10};
  }
  function logPage(c,filter){
    const target=c.scheduleAdmin?c.personId:c.currentUserId,size=[10,20,50].includes(Number(filter.size))?Number(filter.size):10;
    const start=filter.start?Date.parse(filter.start+'T00:00:00+08:00'):-Infinity,end=filter.end?Date.parse(filter.end+'T23:59:59.999+08:00'):Infinity;
    const rows=(c.state.scheduleLogs||[]).filter(row=>row.personId===target&&Date.parse(row.at)>=start&&Date.parse(row.at)<=end).slice().reverse().sort((a,b)=>Date.parse(b.at)-Date.parse(a.at));
    const pages=Math.max(1,Math.ceil(rows.length/size)),page=Math.min(pages,Math.max(1,Number(filter.page)||1));
    return {rows:rows.slice((page-1)*size,page*size),count:rows.length,pages,page,size};
  }
  function logs(c,filter=defaultRange()){
    const data=logPage(c,filter);
    return `<div id="schedule-logs"><div class="schedule-log-filters"><div class="schedule-log-dates"><label class="field">操作时间<input id="schedule-log-start" type="date" aria-label="日志开始时间" value="${e(filter.start)}"></label><span>至</span><label class="field"><input id="schedule-log-end" type="date" aria-label="日志结束时间" value="${e(filter.end)}"></label>${b('查询','schedule-log-search','','primary')}${b('重置','schedule-log-reset')}</div></div><div id="schedule-log-error" class="form-error" hidden role="alert"></div>${table(['操作时间','操作人','操作','日程日期 / 项目','修改前','修改后'],data.rows.map(row=>[e(time(row.at)),e(row.actor.name),e(row.action),`${e((row.after||row.before).date)}<small>${e(row.projectName)}</small>`,summary(row.before),summary(row.after)]))}<div class="schedule-log-pagination"><span>共 ${data.count} 条</span><select id="schedule-log-size" aria-label="日志每页条数">${options([10,20,50].map(n=>({id:n,name:n+'条/页'})),data.size)}</select>${b('‹','schedule-log-page',`data-page="${data.page-1}" aria-label="上一页日志" ${data.page===1?'disabled':''}`)}<span>${data.page} / ${data.pages}</span>${b('›','schedule-log-page',`data-page="${data.page+1}" aria-label="下一页日志" ${data.page===data.pages?'disabled':''}`)}<label>跳至 <input id="schedule-log-jump" type="number" min="1" max="${data.pages}" value="${data.page}" aria-label="日志页码"> 页</label>${b('确定','schedule-log-jump')}</div><div class="form-actions">${b('关闭','dialog-close')}</div></div>`;
  }
  function summary(row){return row?`<b>${e(row.hours)}h</b><small>${e(row.activity||'未分类')} · ${e(row.role)}</small>${row.description?`<small>${e(row.description)}</small>`:''}`:'—';}
  root.ProjectScheduleAccess={controls,changes,logs,defaultRange,logPage,deadlineReason,assertDeadline};
})(window);
