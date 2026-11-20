// Evaluation controls are resolved by role/semantic attributes, never by transient text alone.
globalThis.EhControls = {
  evaluation(doc, panel) {
    const text=el=>(el.textContent||el.innerText||'').replace(/\s+/g,'');
    const view=doc.defaultView||globalThis;
    const visible=el=>{
      const r=el.getBoundingClientRect();
      if(!el.isConnected||!el.getClientRects().length||r.width<=0||r.height<=0||el.closest('[hidden],[aria-hidden="true"],[inert]'))return false;
      for(let n=el;n&&n.nodeType===1;n=n.parentElement){const style=view.getComputedStyle(n);if(style.display==='none'||style.visibility==='hidden'||style.visibility==='collapse'||parseFloat(style.opacity)===0)return false;}
      return true;
    };
    const candidates=[...doc.querySelectorAll('button,[role="button"],a[title]')].filter(el=>!panel?.contains(el)&&visible(el)).map(el=>{
      const title=(el.getAttribute('title')||'').replace(/\s/g,'');
      const cls=String(el.className||''),label=text(el);
      const score=title==='运行评测'?100:title==='评测'?90:/btn-run(?:_|\b)/.test(cls)?80:label==='评测'?30:0;
      const busy=el.disabled||el.getAttribute('aria-disabled')==='true'||/ant-btn-loading|is-loading/.test(cls)||el.querySelector('.anticon-loading,.ant-spin-spinning')||/\d+(?:S|秒)|评测中|运行中|排队|等待|冷却/i.test(label);
      return {el,score,busy:!!busy,label,title};
    }).filter(item=>item.score>0);
    if(!candidates.length)return {button:null,reason:'未找到可见的评测按钮，等待页面加载'};
    const highest=Math.max(...candidates.map(item=>item.score));
    let best=candidates.filter(item=>item.score===highest);
    if(best.length>1){const viewport=best.filter(({el})=>{const r=el.getBoundingClientRect();return r.bottom>0&&r.right>0&&r.top<(view.innerHeight||Infinity)&&r.left<(view.innerWidth||Infinity);});if(viewport.length===1)best=viewport;}
    if(best.length!==1)return {button:null,reason:'有 '+best.length+' 个同优先级评测控件，等待页面稳定'};
    const result=best[0];
    if(result.busy)return {button:null,reason:'平台评测按钮暂不可用（'+(result.label||'加载或冷却中')+'）'};
    return {button:result.el,reason:'评测按钮已就绪'};
  },
  async waitEvaluation({doc,panel,check=()=>{},isStopped=()=>false,status=()=>{},sleep=ms=>new Promise(resolve=>setTimeout(resolve,ms)),now=Date.now,timeout=45000}) {
    const deadline=now()+timeout;let reason='';
    while(now()<deadline){
      if(isStopped())throw Error('已停止，未发出本次评测。');
      await check();
      const result=this.evaluation(doc,panel);
      if(result.button)return result.button;
      if(reason!==result.reason){reason=result.reason;status(reason+'…');}
      await sleep(250);
    }
    throw Error('等待评测按钮超时：'+reason+'。未重复点击提交。');
  }
};
