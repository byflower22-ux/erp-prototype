/* One configuration for the workbench. Exported configuration scripts may replace this file. */
window.ERPVersionMarks={
  id:'erp-version-marks',
  versions:window.BudgetIterationMarks.versions.map(version=>({...version})),
  marks:[
    ...window.BudgetIterationMarks.marks.map(mark=>({...mark,scope:'page',module:'budget'})),
    ...window.ERPMenuIterationMarks.marks.map(mark=>({...mark,scope:'menu'}))
  ]
};
