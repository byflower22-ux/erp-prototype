/* Standalone project marks share the confirmed workbench configuration. */
(function(){
  const config=window.ERPVersionMarks;
  const marks=config.marks.filter(mark=>mark.scope==='page'&&mark.module==='project');
  const versions=config.versions.filter(version=>marks.some(mark=>mark.version===version.id));
  window.ERPProjectAnalysisMarks={versions,marks};
})();
