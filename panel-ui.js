globalThis.EhPanel = {
  guide(mode){
    if(mode==='choice')return ['打开选择题关卡，选择“选择题助手”。','直接点击“开始”；无需 DeepSeek 密钥。','助手自动提交评测，通过后按勾选设置进入下一关。'];
    return ['先点右下角“设置”，填写 DeepSeek API Key 并保存；同一扩展只需配置一次。',mode==='mixed'?'选择“混合模式”，回到答题页点击“开始”。':'选择“编程题助手”，回到答题页点击“开始”。','助手自动生成、保存和评测代码；失败后等待至少30秒再修复重试。'+(mode==='mixed'?'遇到选择题会自动切换处理。':'')];
  },
  appearance({panel,storage,win=window,key='educoder-helper-appearance-v1'}){
    const defaults={theme:'light',accent:'blue',density:'comfortable'};
    let settings={...defaults};
    try{const saved=JSON.parse(storage.getItem(key)||'null');if(saved)settings={...settings,...saved};}catch{}
    const controls={theme:panel.querySelector('#eh-appearance-theme'),accent:panel.querySelector('#eh-appearance-accent'),density:panel.querySelector('#eh-appearance-density')};
    const media=win.matchMedia?.('(prefers-color-scheme: dark)');
    const apply=()=>{
      if(!['light','dark','system','pink','cyber','classic'].includes(settings.theme))settings.theme=defaults.theme;
      if(!['blue','violet','teal'].includes(settings.accent))settings.accent=defaults.accent;
      if(!['comfortable','compact'].includes(settings.density))settings.density=defaults.density;
      panel.dataset.theme=settings.theme==='system'?(media?.matches?'dark':'light'):settings.theme;
      panel.dataset.accent=settings.accent;panel.dataset.density=settings.density;
      for(const key of Object.keys(controls))controls[key].value=settings[key];
    };
    const changes=Object.entries(controls).map(([name,control])=>{const listener=()=>{settings[name]=control.value;apply();try{storage.setItem(key,JSON.stringify(settings));}catch{}};control.addEventListener('change',listener);return [control,listener];});
    apply();media?.addEventListener?.('change',apply);
    return {dispose(){changes.forEach(([control,listener])=>control.removeEventListener('change',listener));media?.removeEventListener?.('change',apply);}};
  },
  mount({panel,handle,storage,win=window,key='educoder-helper-position-v1'}){
    let drag=null,disposed=false;
    const bounds=(left,top)=>{const rect=panel.getBoundingClientRect();return {left:Math.max(0,Math.min(Math.max(0,win.innerWidth-rect.width),left)),top:Math.max(0,Math.min(Math.max(0,win.innerHeight-rect.height),top))};};
    const place=(left,top)=>{const value=bounds(left,top);panel.style.left=value.left+'px';panel.style.top=value.top+'px';panel.style.right='auto';return value;};
    const position=()=>{const rect=panel.getBoundingClientRect();return {left:rect.left,top:rect.top};};
    const save=()=>{try{storage.setItem(key,JSON.stringify(position()));}catch{}};
    const clamp=()=>{if(disposed)return;const p=position();place(p.left,p.top);};
    try{const saved=JSON.parse(storage.getItem(key)||'null');if(saved&&Number.isFinite(saved.left)&&Number.isFinite(saved.top))place(saved.left,saved.top);else clamp();}catch{clamp();}
    const interactive=target=>target?.closest?.('button,a,input,select,textarea,summary,label');
    const down=event=>{
      if(event.button!==0||interactive(event.target))return;
      const p=position();drag={id:event.pointerId,x:event.clientX,y:event.clientY,left:p.left,top:p.top};
      try{handle.setPointerCapture(event.pointerId);}catch{}
      handle.style.cursor='grabbing';event.preventDefault();event.stopPropagation();
    };
    const move=event=>{if(!drag||event.pointerId!==drag.id)return;place(drag.left+event.clientX-drag.x,drag.top+event.clientY-drag.y);event.preventDefault();};
    const up=event=>{if(!drag||event.pointerId!==drag.id)return;try{handle.releasePointerCapture(drag.id);}catch{}drag=null;handle.style.cursor='grab';save();};
    const keyboard=event=>{
      if(interactive(event.target)||!['ArrowLeft','ArrowRight','ArrowUp','ArrowDown'].includes(event.key))return;
      const p=position(),step=event.shiftKey?40:10;
      place(p.left+(event.key==='ArrowRight'?step:event.key==='ArrowLeft'?-step:0),p.top+(event.key==='ArrowDown'?step:event.key==='ArrowUp'?-step:0));save();event.preventDefault();
    };
    const resize=()=>{clamp();save();};
    handle.addEventListener('pointerdown',down);handle.addEventListener('keydown',keyboard);
    win.addEventListener('pointermove',move);win.addEventListener('pointerup',up);win.addEventListener('pointercancel',up);win.addEventListener('resize',resize);
    const observer=typeof win.ResizeObserver==='function'?new win.ResizeObserver(clamp):null;observer?.observe(panel);
    return {position,dispose(){disposed=true;observer?.disconnect();handle.removeEventListener('pointerdown',down);handle.removeEventListener('keydown',keyboard);win.removeEventListener('pointermove',move);win.removeEventListener('pointerup',up);win.removeEventListener('pointercancel',up);win.removeEventListener('resize',resize);}};
  }
};
