const assert=require('node:assert/strict');
const path=require('node:path');
const fs=require('node:fs');
const {pathToFileURL}=require('node:url');
const {chromium}=require(process.env.ERP_PLAYWRIGHT_MODULE||'playwright');
const root=path.resolve(__dirname,'../../..');
const output=path.join(root,'文档/迭代/预算优化/版本标记验收');
(async()=>{
  const browser=await chromium.launch({channel:'chrome',headless:true});
  try{
    const page=await browser.newPage({viewport:{width:1440,height:1000}}),errors=[];
    page.on('pageerror',e=>errors.push(e.message));
    const local=pathToFileURL(path.join(root,'原型/预算管理/预算优化/prototype/index.html')).href;
    await page.goto(local+'#execute');
    const bar=page.locator('erp-iteration-marks').first();
    const before=await page.locator('#content').boundingBox();
    await bar.getByRole('button',{name:'显示标记',exact:true}).click();
    await bar.locator('.pin[data-mark="execution-monthly"]').waitFor();
    assert.deepEqual(await page.locator('#content').boundingBox(),before,'开启标记不能改变业务区布局');
    assert.equal(await bar.locator('.rail').count(),0,'编号保持在原区域附近');
    async function verify(frame,selector){
      await frame.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))));
      const issues=await frame.locator(selector).evaluate(host=>{
        const pins=[...host.shadowRoot.querySelectorAll('.pin')].map(e=>({id:e.dataset.mark,r:e.getBoundingClientRect()}));
        const overlaps=(a,b)=>a.left<b.right&&a.right>b.left&&a.top<b.bottom&&a.bottom>b.top;
        const text=[],walker=document.createTreeWalker(host.root,NodeFilter.SHOW_TEXT);
        while(walker.nextNode()){
          const n=walker.currentNode;if(!n.textContent.trim()||['SCRIPT','STYLE'].includes(n.parentElement.tagName)||!n.parentElement.checkVisibility())continue;
          const range=document.createRange();range.selectNodeContents(n);
          for(const rect of range.getClientRects()){
            const r=rect.toJSON();
            for(let parent=n.parentElement;parent;parent=parent.parentElement){const s=getComputedStyle(parent),p=parent.getBoundingClientRect();if(/auto|scroll|hidden|clip/.test(s.overflowX)){r.left=Math.max(r.left,p.left);r.right=Math.min(r.right,p.right);}if(/auto|scroll|hidden|clip/.test(s.overflowY)){r.top=Math.max(r.top,p.top);r.bottom=Math.min(r.bottom,p.bottom);}}
            if(r.right>r.left&&r.bottom>r.top)text.push({...r,text:n.textContent});
          }
        }
        const failures=[];
        for(let i=0;i<pins.length;i++){
          if(text.some(r=>overlaps(pins[i].r,r)))failures.push(pins[i].id+' covers text '+JSON.stringify({pin:pins[i].r.toJSON(),texts:text.filter(r=>overlaps(pins[i].r,r))}));
          for(let j=i+1;j<pins.length;j++)if(overlaps(pins[i].r,pins[j].r))failures.push('pins overlap');
        }
        return failures;
      });
      assert.deepEqual(issues,[]);
    }
    await verify(page,'erp-iteration-marks');
    // Repeated identical and nested targets still need separate, clickable markers.
    await page.evaluate(()=>{
      const host=document.querySelector('erp-iteration-marks');
      const config=JSON.parse(JSON.stringify(host.config));
      for(let i=0;i<12;i++)config.marks.push({id:'collision-'+i,version:'ERP-I003',type:'new',title:'相同区域 '+i,page:'execute',selector:'.subject-cascader'});
      host.commitConfig(config);
    });
    await bar.locator('.pin[data-mark="collision-11"]').waitFor();
    await verify(page,'erp-iteration-marks');
    await bar.locator('.pin[data-mark="collision-11"]').click();
    await bar.locator('article[data-id="collision-11"].selected').waitFor();
    await bar.getByRole('button',{name:'关闭变更说明',exact:true}).click();
    for(const width of [1024,1440]){
      await page.setViewportSize({width,height:768});
      await verify(page,'erp-iteration-marks');
    }
    console.log('PASS 原位编号避字与避让，开启不改变布局，1024／1440 检查');
    await page.evaluate(()=>{const h=document.querySelector('erp-iteration-marks');h.commitConfig(h.defaultConfig);});
    await page.goto(pathToFileURL(path.join(root,'index.html')).href);
    const menus=page.locator('#erp-version-marks');
    const menuWidth=await page.locator('.erp-sidebar').evaluate(e=>e.getBoundingClientRect().width);
    const showAll=menus.getByRole('button',{name:'显示标记',exact:true});
    if(await showAll.count())await showAll.click({timeout:3000});
    await menus.locator('.pin[data-mark="menu-application"]').waitFor();
    assert.equal(await page.locator('.erp-sidebar').evaluate(e=>e.getBoundingClientRect().width),menuWidth,'菜单标记不能改变侧栏宽度');
    await verify(page,'#erp-version-marks');
    await menus.locator('.pin[data-mark="menu-application"]').click();
    await menus.locator('article[data-id="menu-application"].selected').waitFor();
    await menus.getByRole('button',{name:'关闭变更说明',exact:true}).click();
    await menus.getByRole('button',{name:'配置标记',exact:true}).click();
    const editor=menus.getByRole('dialog',{name:'配置版本标记',exact:true});
    await editor.getByRole('button',{name:'新增标记',exact:true}).click();
    await editor.getByLabel('标记标题',{exact:true}).fill('测试一级菜单');
    await editor.getByLabel('标记范围',{exact:true}).selectOption('menu');
    await editor.getByRole('button',{name:'选择页面区域',exact:true}).click();
    await page.locator('nav [data-group="budget"] > summary').click();
    assert.equal(await page.locator('nav [data-group="budget"]').getAttribute('open'),'');
    await menus.getByRole('button',{name:'使用此区域',exact:true}).click();
    await editor.getByRole('button',{name:'保存标记',exact:true}).click();
    await editor.getByRole('button',{name:'关闭配置',exact:true}).click();
    await page.reload();
    await menus.locator('.pin[data-mark="menu-application"]').waitFor();
    await verify(page,'#erp-version-marks');
    await page.locator('nav [data-group="office"] > summary').click();
    await menus.locator('.pin[data-mark="menu-application"]').waitFor({state:'detached'});
    await page.locator('nav [data-group="office"] > summary').click();
    await menus.locator('.pin[data-mark="menu-application"]').waitFor();
    await page.locator('#toggle-nav').click();
    await menus.locator('.pin').first().waitFor({state:'detached'});
    assert.equal(await menus.locator('.pin').count(),0);
    await page.locator('#toggle-nav').click();
    await menus.locator('.pin[data-mark="menu-application"]').waitFor();
    await menus.evaluate(host=>host.commitConfig(host.defaultConfig));
    fs.mkdirSync(output,{recursive:true});
    for(const width of [1024,1440]){
      await page.setViewportSize({width,height:1000});
      await verify(page,'#erp-version-marks');
      const budget=page.frameLocator('iframe[data-module="budget"]');
      const show=menus.getByRole('button',{name:'显示标记',exact:true});
      if(await show.count())await show.click();
      await verify(page.frames().find(f=>f.url().includes('/prototype/index.html')),'erp-iteration-marks');
      await page.screenshot({path:path.join(output,'页面与菜单标记_'+width+'.png')});
      await menus.getByRole('button',{name:'隐藏标记',exact:true}).click();
    }
    await page.locator('nav [data-module="receipt"]').click();
    await page.locator('#erp-tabs button[data-tab-id="receipt:list"][aria-current="page"]').waitFor();
    assert.equal(await page.frameLocator('iframe[data-module="receipt"]').locator('erp-iteration-marks').count(),0);
    if(await menus.getByRole('button',{name:'隐藏标记',exact:true}).count())await menus.getByRole('button',{name:'隐藏标记',exact:true}).click();
    assert.equal(await page.locator('nav').getAttribute('data-erp-marks-visible'),null);
    assert.deepEqual(errors,[]);
    console.log('PASS 菜单说明、一级／二级区域点选、刷新、折叠恢复及回单隔离');
  }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
