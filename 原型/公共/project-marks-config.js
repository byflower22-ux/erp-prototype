/* Project versions append to the published workbench marks. */
(function(){
  const version={id:'ERP-I006',label:'项目管理与分析'};
  const changes=[
    ['schedule','我的项目日程','schedule','便捷工时填报','Web按周／按月填写、事项分类、项目置顶、工时统计；手机端先选项目再填写。'],
    ['projects','项目交付单','project-list','交付单与成员核算设置','复用订单管理项目交付单入口，在项目成员中维护收入比例。'],
    ['consultants','咨询师列表','consultants','咨询师账号关联','咨询师关联ERP账号，自动带入工号、状态、部门及联系方式。'],
    ['project-analysis','项目分析','analysis','项目管理驾驶舱','按项目团队筛选，查看利润、回款、交付趋势、预警与经营诊断；支持AI龙虾对话及Excel导入。'],
    ['person-analysis','项目人效分析','analysis','按角色分析项目人效','默认咨询师，可切换角色分析利用率、小时产出、投入产出及项目接续风险。']
  ];
  const marks=changes.map(([page,pageLabel,region,title,description])=>({id:'project-analysis-version-'+page,version:version.id,type:'improved',scope:'page',module:'project',page,pageLabel,selector:'[data-change="'+region+'"]',title,description,delivery:'前端交互Demo · 虚构数据 · AI模拟分析',documents:[]}));
  window.ERPProjectAnalysisMarks={version,marks,upgrade(element){
    const config=JSON.parse(JSON.stringify(element.config));let changed=false;
    if(!config.versions.some(v=>v.id===version.id)){config.versions.push({...version});changed=true;}
    for(const mark of marks)if(!config.marks.some(m=>m.id===mark.id)){config.marks.push({...mark});changed=true;}
    if(changed)element.commitConfig(config);
  }};
  const config=window.ERPVersionMarks;
  if(!config)return;
  config.versions.push({id:'ERP-I005',label:'项目管理优化'});
  const pages=[['consultants','咨询师列表','consultants','咨询师档案管理'],['schedule','项目日程','schedule','通用工时与AI草稿'],['projects','项目交付单','project-list','项目核算设置'],['project-analysis','项目分析','analysis','项目月度与累计核算'],['person-analysis','项目人效分析','analysis','个人核算及盈亏平衡']];
  config.marks.push(...pages.map(([page,pageLabel,region,title])=>({id:'project-'+page,version:'ERP-I005',type:'new',scope:'page',module:'project',page,pageLabel,selector:'[data-change="'+region+'"]',title,description:'前端交互 Demo，使用虚构数据及实际核算。',delivery:'前端Demo · 真实接口待联调',documents:[{title:'本迭代需求',url:'文档/迭代/项目管理优化/详细需求说明.md'}]})));
  config.versions.push(version);config.marks.push(...marks);
})();
