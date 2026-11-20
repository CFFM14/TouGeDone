(() => {
  const boot = globalThis.__ehBootstrap === true;
  delete globalThis.__ehBootstrap;
  try{if(boot&&sessionStorage.getItem('educoder-helper-dismissed-v1')==='1')return;if(!boot)sessionStorage.removeItem('educoder-helper-dismissed-v1');}catch{}
  const chainKey = 'educoder-helper-next-v1', panelKey = 'educoder-helper-panel-v1';
  const canonical = value => { const url = new URL(value, location.href); url.hash = ''; return url.href; };
  const sameTask = (left, right) => {
    try {
      const a = new URL(left), b = new URL(right);
      const ap = a.pathname.split('/').filter(Boolean), bp = b.pathname.split('/').filter(Boolean);
      if (a.origin !== b.origin || ap[0] !== 'tasks' || bp[0] !== 'tasks' || ap.at(-1) !== bp.at(-1)) return false;
      if (ap.length > 2 && bp.length > 2 && ap.slice(0,-1).join('/') !== bp.slice(0,-1).join('/')) return false;
      const ac = a.searchParams.get('coursesId'), bc = b.searchParams.get('coursesId');
      return !ac || !bc || ac === bc;
    } catch { return false; }
  };
  let resume = null, sticky = null;
  try { resume = JSON.parse(sessionStorage.getItem(chainKey) || 'null'); sticky = JSON.parse(sessionStorage.getItem(panelKey) || 'null'); } catch {}
  const validResume = resume && sameTask(resume.next, location.href) && Array.isArray(resume.visited) && Number.isFinite(resume.at) && Date.now() - resume.at >= 0 && Date.now() - resume.at <= 120000;
  if (!validResume) resume = null;
  const controller = globalThis.__ehController;
  if (controller && !sameTask(controller.url, location.href)) controller.dispose();
  if (document.getElementById('edu-helper-panel')) return;
  if (boot && !resume && !sticky && !globalThis.__ehRestorePanel) return;
  delete globalThis.__ehRestorePanel;
  if (resume) sessionStorage.removeItem(chainKey);
  if (!boot) resume = null;
  const supportedHosts = new Set(['www.educoder.net', 'educoder.net', 'trustie.educoder.net']);
  if (!supportedHosts.has(location.hostname) || !location.pathname.startsWith('/tasks/')) return alert('请在头歌答题界面打开助手。当前页面：' + location.hostname + location.pathname);
  let running = false, stopped = false, closed = false, groups = [], chainActive = false, visited = [];
  const choiceKnown=new Map();
  const panel = document.createElement('div');
  panel.id = 'edu-helper-panel';
  panel.style.cssText = 'position:fixed;z-index:2147483647;right:20px;top:60px;width:380px;max-width:calc(100vw - 20px);max-height:calc(100vh - 20px);display:flex;flex-direction:column;box-sizing:border-box;background:white;color:#172033;border:1px solid #b7cbea;border-radius:14px;font:14px/1.6 sans-serif;box-shadow:0 8px 30px #0003;overflow:hidden';
  panel.innerHTML = `<style>
    #edu-helper-panel{--eh-bg:#fff;--eh-soft:#f5f8fd;--eh-text:#172b4d;--eh-muted:#63748b;--eh-border:#dbe5f2;--eh-accent:#2563eb;--eh-link:#2563eb;--eh-accent-soft:#edf3ff;--eh-head:#edf4ff;--eh-success:#16804a;--eh-warning:#9a5b00;background:var(--eh-bg)!important;color:var(--eh-text)!important;border-color:var(--eh-border)!important;font-size:14px!important}
    #edu-helper-panel[data-theme=dark]{--eh-bg:#121d30;--eh-soft:#1b2a41;--eh-text:#e6edf7;--eh-muted:#a7b6cd;--eh-border:#334861;--eh-accent-soft:#1d3356;--eh-head:#192c49;--eh-success:#61d9a5;--eh-warning:#f7c879}
    #edu-helper-panel[data-accent=violet]{--eh-accent:#7c3aed;--eh-accent-soft:#f2ecff}
    #edu-helper-panel[data-accent=teal]{--eh-accent:#0f766e;--eh-accent-soft:#e8f7f3}
    #edu-helper-panel[data-theme=dark][data-accent=violet]{--eh-accent-soft:#33264d}
    #edu-helper-panel[data-theme=dark][data-accent=teal]{--eh-accent-soft:#193c3b}
    #edu-helper-panel[data-accent=violet]{--eh-link:#7c3aed}
    #edu-helper-panel[data-accent=teal]{--eh-link:#0f766e}
    #edu-helper-panel[data-theme=dark]{--eh-link:#9abcff}
    #edu-helper-panel[data-theme=dark][data-accent=violet]{--eh-link:#c6a4ff}
    #edu-helper-panel[data-theme=dark][data-accent=teal]{--eh-link:#7de2ce}
    #edu-helper-panel[data-theme=pink]{--eh-bg:#fff8fc;--eh-soft:#fff0f6;--eh-text:#64364e;--eh-muted:#906578;--eh-border:#efc6d9;--eh-accent:#b72d70;--eh-link:#ad2568;--eh-accent-soft:#ffe4f0;--eh-head:linear-gradient(120deg,#ffe0ee,#f3e6ff);--eh-success:#267344;--eh-warning:#935018;border-radius:22px!important;box-shadow:0 12px 36px #ab387c24!important}
    #edu-helper-panel[data-theme=cyber]{--eh-bg:#0b1022;--eh-soft:#141a32;--eh-text:#e1edff;--eh-muted:#a4b4d2;--eh-border:#344c73;--eh-accent:#56e8ee;--eh-link:#74f2ed;--eh-accent-soft:#172841;--eh-head:linear-gradient(120deg,#142c44,#281739);--eh-success:#83f2bb;--eh-warning:#ffcf78;border-radius:7px!important;border-color:#56e8ee!important;box-shadow:0 0 0 1px #56e8ee24,0 10px 32px #080d26aa,0 0 24px #ce4cff24!important;font-family:Consolas,"Microsoft YaHei",monospace!important}
    #edu-helper-panel[data-theme=classic]{--eh-bg:#faf5e8;--eh-soft:#f1ead8;--eh-text:#403e33;--eh-muted:#756c56;--eh-border:#cfc3a7;--eh-accent:#8d453d;--eh-link:#834039;--eh-accent-soft:#eee3d0;--eh-head:linear-gradient(120deg,#ede0c5,#e5e9dc);--eh-success:#3d6d4a;--eh-warning:#885d21;border-radius:10px!important;box-shadow:0 10px 30px #55472e26!important;font-family:"Noto Serif SC","Songti SC",SimSun,serif!important}
    #edu-helper-panel[data-theme=pink] #eh-drag-handle,#edu-helper-panel[data-theme=cyber] #eh-drag-handle,#edu-helper-panel[data-theme=classic] #eh-drag-handle{background:var(--eh-head)!important;border-bottom:1px solid var(--eh-border)}
    #edu-helper-panel[data-theme=pink] button{border-radius:12px}
    #edu-helper-panel[data-theme=cyber] #eh-start{color:#0b1022}
    #edu-helper-panel[data-theme=cyber] #eh-drag-handle>div>span{color:#0b1022!important}
    #edu-helper-panel[data-theme=classic] #eh-drag-handle b{letter-spacing:.5px}
    #edu-helper-panel[data-density=compact]{font-size:13px!important}
    #edu-helper-panel[data-density=compact] #eh-body{padding:9px 13px!important}
    #edu-helper-panel[data-density=compact] #eh-guide li{margin:3px 0}
    #edu-helper-panel button{transition:background .15s,box-shadow .15s}
    #edu-helper-panel button:not(:disabled):hover{box-shadow:0 2px 9px #0002}
    #edu-helper-panel button:focus-visible,#edu-helper-panel select:focus-visible,#edu-helper-panel input:focus-visible{outline:2px solid var(--eh-accent);outline-offset:2px}
    #edu-helper-panel input[type=checkbox]{accent-color:var(--eh-accent)}
    #edu-helper-panel textarea{background:var(--eh-bg);color:var(--eh-text);border:1px solid var(--eh-border);border-radius:6px;padding:7px}
    #edu-helper-panel #eh-guide-card{border:1px solid var(--eh-border)}
    #edu-helper-panel #eh-guide li::marker{color:var(--eh-link);font-weight:700}
    #edu-helper-panel #eh-ai-settings{display:flex;gap:6px;align-items:center;color:var(--eh-link)}
    #edu-helper-panel #eh-ai-settings{position:relative}
    #edu-helper-panel #eh-update-dot{position:absolute;top:2px;right:3px;width:8px;height:8px;border-radius:50%;background:#ef4444;box-shadow:0 0 0 2px var(--eh-bg);pointer-events:none}
    #edu-helper-panel svg{flex-shrink:0}
    @media(prefers-reduced-motion:reduce){#edu-helper-panel button{transition:none}}

    #edu-helper-panel *{box-sizing:border-box}
    #edu-helper-panel [hidden]{display:none!important}
    #edu-helper-panel button,#edu-helper-panel select,#edu-helper-panel input,#edu-helper-panel textarea{font:inherit}
    #edu-helper-panel button{cursor:pointer;border:1px solid var(--eh-border);background:var(--eh-bg);color:var(--eh-text);border-radius:7px;padding:6px 11px}
    #edu-helper-panel button:disabled{cursor:default;opacity:.5}
    #edu-helper-panel select,#edu-helper-panel input[type=number]{border:1px solid var(--eh-border);border-radius:6px;padding:5px;background:var(--eh-bg);color:var(--eh-text)}
    #edu-helper-panel summary{cursor:pointer;color:var(--eh-muted)}
    #edu-helper-panel p{margin:10px 0}
    #edu-helper-panel #eh-start{background:var(--eh-accent);border-color:var(--eh-accent);color:white;flex:1;font-weight:600}
    #edu-helper-panel ol{padding-left:22px;margin:8px 0;list-style:decimal}
    #edu-helper-panel li{margin:6px 0;list-style:decimal}
  </style>
    <div id="eh-drag-handle" tabindex="0" aria-label="拖动标题移动助手，也可用方向键移动" style="display:flex;align-items:center;justify-content:space-between;padding:13px 16px;background:var(--eh-accent-soft);cursor:grab;touch-action:none;user-select:none;flex-shrink:0">
      <div style="display:flex;gap:10px;align-items:center"><span style="display:flex;align-items:center;justify-content:center;width:34px;height:34px;flex-shrink:0;border-radius:10px;background:var(--eh-accent);color:#fff"><svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="1.8" aria-hidden="true"><path d="m12 3 2.5 6.5L21 12l-6.5 2.5L12 21l-2.5-6.5L3 12l6.5-2.5Z"/></svg></span><div><b>天下人苦头歌久矣 · ${globalThis.chrome?.runtime?.getManifest?.().version||'开发版'}</b><div style="font-size:11px;color:var(--eh-muted)">拖动标题移动，跨关保留位置</div></div></div><button id="eh-close" aria-label="关闭助手">关闭</button>
    </div>
    <div id="eh-body" style="padding:12px 16px;overflow:auto;min-height:0">
      <label style="display:flex;align-items:center;justify-content:space-between">工作模式 <select id="eh-mode"><option value="mixed" selected>混合模式</option><option value="choice">选择题助手</option><option value="code">编程题助手</option></select></label>
      <p id="eh-mode-help" style="font-size:12px;color:var(--eh-muted)"></p>
      <div id="eh-guide-card" style="padding:10px 12px;background:var(--eh-soft);border-radius:9px"><b style="font-size:13px">使用顺序</b><ol id="eh-guide" style="font-size:13px"></ol></div>
      <p id="eh-config-status" role="status" style="font-size:12px;color:var(--eh-warning)"></p>
      <p><label><input id="eh-auto" type="checkbox" checked> 通过后自动下一关<span id="eh-auto-note"></span></label></p>
      <div style="display:flex;gap:8px;margin-top:12px"><button id="eh-start">开始</button><button id="eh-stop" disabled>停止</button></div>
      <p id="eh-status" role="status" aria-live="polite" style="padding:9px 11px;background:var(--eh-accent-soft);border-radius:8px;overflow-wrap:anywhere">等待开始。</p>
      <details id="eh-advanced" style="margin-top:14px"><summary>高级选项与外观</summary>
        <div style="padding:10px 0;border-bottom:1px solid var(--eh-border)"><b style="font-size:12px">外观设置</b>
          <p style="display:flex;gap:6px;flex-wrap:wrap"><label>主题 <select id="eh-appearance-theme"><option value="light">浅色</option><option value="dark">深色</option><option value="system">跟随系统</option><option value="pink">少女心</option><option value="cyber">赛博朋克</option><option value="classic">古风古韵</option></select></label><label>配色 <select id="eh-appearance-accent"><option value="blue">蓝色</option><option value="violet">紫色</option><option value="teal">青绿</option></select></label></p>
          <p style="font-size:12px;color:var(--eh-muted)">特色主题自带配色，切换后自动记住；浅色、深色和跟随系统可单独调整配色。</p>
          <label>布局 <select id="eh-appearance-density"><option value="comfortable">舒适</option><option value="compact">紧凑</option></select></label>
        </div>
        <p><button id="eh-scan">重新识别题目</button> <span id="eh-count"></span></p>
        <div id="eh-questions" style="margin:10px 0"></div>
        <label>范围 <select id="eh-scope"><option value="all">当前整关</option><option value="one">指定一道题</option></select></label>
        <select id="eh-question" aria-label="指定题目" disabled></select>
        <p id="eh-batch-row"><label>多选题每批 <select id="eh-batch"><option value="3">3 题（清洗后并行）</option><option value="4">4 题（清洗后并行）</option><option value="2">2 题（清洗后并行）</option><option value="1">1 题（逐题尝试）</option></select></label></p>
        <p><label>最小提交间隔（秒） <input id="eh-delay" type="number" min="1" max="60" value="1" style="width:55px"></label></p>
        <p style="font-size:12px;color:var(--eh-muted)">单选逐题尝试；多选先清洗锁定，再同时更改3题（最多4题）；命中后拆分定位。多选从多选项到少选项尝试。停止时保留最佳提交。</p>
        <details id="eh-ai-section" style="margin:10px 0"><summary>编程题：生成、恢复与预览</summary>
          <details style="margin:10px 0"><summary>AI 输出异常与自动补试</summary><p style="font-size:12px">每轮生成遇到下列问题，会反馈原因并最多补试2次，共3次；期间不写入、不评测。补试会产生额外API调用。</p><ul style="font-size:12px;padding-left:20px"><li>JSON格式错误、空响应或输出截断。</li><li>缺少题型、解法、代码、文件列表或修改原因。</li><li>文件路径不合法、重复、未完整读取或只读；代码为空或超限。</li><li>模板区域编号错误、区域重复、标记损坏或改动了固定部分。</li><li>评测已确认失败，却没有提供实际修复。</li></ul><p style="font-size:12px">三次均不合规时显示最后原因并停止。密钥、余额、服务错误，以及停止、跳关、文件变化、保存或评测状态未确认，单独提示处理。</p></details>
          <p><button id="eh-ai-run">仅生成并写入</button> <button id="eh-ai-undo" disabled>恢复原代码</button></p>
          <p style="font-size:12px">日常使用直接点击上方“开始”。本处用于只生成不评测，或恢复最近一次写入。题干、源代码和公开评测反馈会发送给 DeepSeek。</p>
          <p><label>每关 AI 最多轮次 <input id="eh-ai-limit" type="number" min="1" max="30" value="10" style="width:55px"></label></p>
          <details><summary>读取的上下文预览（不含密钥）</summary><textarea id="eh-ai-context" readonly style="width:100%;height:160px"></textarea></details>
          <textarea id="eh-ai-preview" readonly placeholder="生成结果预览" style="width:100%;height:130px"></textarea>
        </details>
      </details>
      <p style="font-size:11px;color:var(--eh-muted)">“开始”会真实提交评测；未确认通过时不会进入下一关。</p>
    </div>
    <div style="display:flex;align-items:center;justify-content:space-between;padding:10px 16px;border-top:1px solid var(--eh-border);background:var(--eh-bg);flex-shrink:0"><span style="font-size:11px;color:var(--eh-muted)">位置自动记忆</span><button id="eh-ai-settings" title="密钥与版本更新" aria-label="设置"><svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="1.8" aria-hidden="true"><path d="m9 3-1 3-3 1-2 5 2 5 3 1 1 3h6l1-3 3-1 2-5-2-5-3-1-1-3Z"/><circle cx="12" cy="12" r="3"/></svg>设置<span id="eh-update-dot" hidden aria-hidden="true"></span></button></div>`;
  document.body.appendChild(panel);
  const notify = type => {
    try { globalThis.chrome?.runtime?.sendMessage({type}).catch(() => {}); } catch {}
  };
  const rememberPanel = () => { try { sessionStorage.setItem(panelKey, JSON.stringify({open:true})); } catch {} };
  rememberPanel(); notify('eh-panel-open');
  let uiDispose=()=>{};
  const pendingEditors=new Set();
  const dispose=()=>{if(closed)return;closed=true;stopped=true;running=false;chainActive=false;notify('eh-ai-cancel');pendingEditors.forEach(cancel=>{try{cancel();}catch{}});try{uiDispose();}finally{panel.remove();}};
  const closePanel=()=>{if(closed)return;for(const key of [chainKey,panelKey])try{sessionStorage.removeItem(key);}catch{}try{sessionStorage.setItem('educoder-helper-dismissed-v1','1');}catch{}notify('eh-panel-close');dispose();};
  // Bind before optional UI modules initialize: even a partial startup failure
  // must leave a working close button.
  panel.querySelector('#eh-close').onclick=closePanel;
  globalThis.__ehController = {url:location.href, dispose, get running(){return running||chainActive;}};
  const $ = id => panel.querySelector('#eh-' + id);
  const status = text => { if(!closed)$('status').textContent = text; };
  const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));
  let configRequest=null;
  async function refreshConfig(){
    if(configRequest)return configRequest;
    $('config-status').textContent='正在检查 DeepSeek 密钥配置…';
    configRequest=(async()=>{
      try{
        const result=await globalThis.chrome?.runtime?.sendMessage({type:'eh-ai-status'});
        if(!result?.ok||typeof result.configured!=='boolean')throw Error(result?.error||'无法检查配置，请重新加载扩展并刷新页面。');
        $('config-status').textContent=result.configured?'DeepSeek 密钥已保存，可以点击“开始”。':'请先点右下角“设置”，填写并保存 DeepSeek API Key。';
        $('config-status').style.color=result.configured?'var(--eh-success)':'var(--eh-warning)';
        return result.configured;
      }catch(error){$('config-status').textContent=error.message;return null;}
    })();
    try{return await configRequest;}finally{configRequest=null;}
  }
  async function ensureAiConfigured(){
    const configured=await refreshConfig();
    if(closed)return false;
    if(configured===true)return true;
    chainActive=false;sessionStorage.removeItem(chainKey);
    status(configured===false?'请先在“设置”保存 DeepSeek 密钥，再回到这里点击“开始”。':'密钥配置检查失败，请重新加载扩展并刷新页面。');
    if(configured===false)notify('eh-ai-settings');
    return false;
  }
  const appearanceUi=EhPanel.appearance({panel,storage:sessionStorage});
  const panelUi=EhPanel.mount({panel,handle:$('drag-handle'),storage:sessionStorage});
  const updateUi=EhPanel.updateNotice({button:$('ai-settings'),dot:$('update-dot'),runtime:globalThis.chrome?.runtime,isClosed:()=>closed});
  const refreshOnReturn=()=>{if(panel.isConnected&&$('mode').value!=='choice'&&!document.hidden)refreshConfig();};
  window.addEventListener('focus',refreshOnReturn);document.addEventListener('visibilitychange',refreshOnReturn);
  uiDispose=()=>{updateUi.dispose();appearanceUi.dispose();panelUi.dispose();window.removeEventListener('focus',refreshOnReturn);document.removeEventListener('visibilitychange',refreshOnReturn);};
  const maskOf = group => group.boxes.reduce((mask, box, i) => mask | (box.checked ? 1 << i : 0), 0);
  const answer = mask => [...Array(26)].map((_, i) => mask & (1 << i) ? String.fromCharCode(65 + i) : '').filter(Boolean).join('、') || '未作答';
  const parse = text => {
    const match = text.match(/其中有\s*(\d+)\s*组测试结果\s*不匹配/);
    return match ? Number(match[1]) : /^(?:评测通过|全部通过|所有测试(?:集)?(?:均|全部)?通过)[\s。!！]*$/.test(text.trim()) ? 0 : null;
  };
  function discover() {
    const found = [...document.querySelectorAll('div.option')].filter(el => !panel.contains(el) && el.getClientRects().length).map((el, index) => {
      const boxes = [...el.querySelectorAll('input[type=radio],input[type=checkbox]')];
      const type = boxes[0]?.type;
      if (!boxes.length || boxes.some(box => box.type !== type || box.disabled || !box.closest('a.flex-container'))) throw Error('第 ' + (index + 1) + ' 题结构不支持或不可操作。');
      if (boxes.length > (type === 'radio' ? 26 : 12)) throw Error('第 ' + (index + 1) + ' 题选项过多，暂不支持。');
      if (type === 'radio' && boxes.filter(box => box.checked).length > 1) throw Error('单选题存在多个选中项，无法确认题目分组。');
      const number = el.parentElement.querySelector('.order')?.textContent.trim().replace(/[、.]/g, '') || String(index + 1);
      return {el, boxes, type, number, note:'待处理'};
    });
    const all = [...document.querySelectorAll('input[type=radio],input[type=checkbox]')].filter(el => !panel.contains(el) && el.getClientRects().length);
    const recognized = found.flatMap(group => group.boxes);
    if (!found.length || recognized.length !== all.length || all.some(box => !recognized.includes(box))) throw Error('未能完整识别当前关卡的选择题，请确认答题页已加载。');
    return found;
  }
  function render() {
    const selector=$('question');
    if(selector.options.length!==groups.length||groups.some((group,i)=>selector.options[i]?.textContent!=='第 '+group.number+' 题')){
      const selected=selector.value;
      selector.replaceChildren();
      groups.forEach((group,index)=>{const option=document.createElement('option');option.value=index;option.textContent='第 '+group.number+' 题';selector.appendChild(option);});
      if([...selector.options].some(option=>option.value===selected))selector.value=selected;
    }
    $('questions').replaceChildren();
    for (const group of groups) {
      const row = document.createElement('div');
      row.textContent = '第 ' + group.number + ' 题 · ' + (group.type === 'radio' ? '单选' : '多选') + '（' + group.boxes.length + ' 项） ' + answer(maskOf(group)) + ' · ' + group.note;
      row.style.cssText = 'padding:5px 0;border-bottom:1px solid var(--eh-border);font-size:12px';
      $('questions').appendChild(row);
    }
    $('count').textContent = groups.length + ' 题';
  }
  function scan(manual=false) {
    try {
      groups = discover();
      $('question').replaceChildren();
      groups.forEach((group, index) => { const option = document.createElement('option'); option.value = index; option.textContent = '第 ' + group.number + ' 题'; $('question').appendChild(option); });
      render(); status('已识别 ' + groups.length + ' 题，可直接开始。');
    } catch (error) { groups = []; $('questions').replaceChildren(); $('count').textContent = '等待自动识别'; status(manual||$('mode').value==='choice'?error.message:'点击“开始”后会自动识别题目并运行。'); }
  }
  $('scan').onclick = scan;
  function updateMode() {
    const mode=$('mode').value;
    $('ai-section').hidden=mode==='choice';
    $('mode-help').textContent=mode==='choice'?'仅处理选择题，跨关时跳过编程题。':mode==='code'?'仅处理编程题，跨关时跳过选择题。':'自动处理选择题和编程题。';
    $('start').textContent='开始';
    $('auto-note').textContent=mode==='choice'?'；跳过编程题':mode==='code'?'；跳过选择题':'';
    $('config-status').hidden=mode==='choice';
    $('guide').replaceChildren();
    for(const text of EhPanel.guide(mode)){const li=document.createElement('li');li.textContent=text;$('guide').appendChild(li);}
    if(mode!=='choice')refreshConfig();
    $('question').disabled=$('scope').value==='all';
    $('batch-row').hidden=mode==='code';
    $('batch').disabled=running||mode==='code'||$('scope').value!=='all';
  }
  $('scope').onchange=updateMode;
  $('mode').onchange=updateMode;
  $('stop').onclick = () => { globalThis.chrome?.runtime?.sendMessage({type:'eh-ai-cancel'}).catch(()=>{}); stopped = true; chainActive = false; sessionStorage.removeItem(chainKey); status('正在停止：等待当前结果，必要时恢复并提交最佳答案，不再尝试新组合。'); };
  $('close').onclick = closePanel;
  const lock = value => {
    if(closed)return;
    running = value;
    for (const id of ['scan','scope','question','delay','start','auto','ai-run','mode','ai-limit','batch']) $(id).disabled = value;
    if (!value) $('question').disabled = $('scope').value === 'all';
    if (!value) $('batch').disabled=$('mode').value==='code'||$('scope').value!=='all';
    $('stop').disabled = !value;
  };
  const records = () => {
    const tables = [...document.querySelectorAll('table')].filter(el => el.getClientRects().length && /评测时间/.test(el.tHead?.innerText || '') && /评测结果/.test(el.tHead?.innerText || ''));
    if (tables.length !== 1) throw Error('评测记录未加载，请检查页面和网络。');
    return [...tables[0].querySelectorAll('tbody tr.ant-table-row')];
  };
  const signature = row => row ? [...row.cells].slice(0,4).map(el => el.innerText.trim()).join('|') : '';
  async function refreshRecords() {
    if(closed)throw Error('助手已关闭。');
    const tab = text => {
      const matches = [...document.querySelectorAll('a')].filter(el => !panel.contains(el) && el.getClientRects().length && el.innerText.trim() === text);
      if (matches.length !== 1) throw Error('无法识别“' + text + '”标签。');
      return matches[0];
    };
    tab('学习内容').click(); await sleep(200);if(closed)throw Error('助手已关闭。');tab('记录').click();
    const deadline = Date.now() + 10000;
    while (Date.now() < deadline) {
      await sleep(500);
      try {
        records();
        if (![...document.querySelectorAll('.ant-table-wrapper .ant-spin-spinning')].some(el => el.getClientRects().length)) return;
      } catch { /* Wait for the records panel to mount. */ }
    }
    throw Error('记录列表加载超时。');
  }
  const waitButton = (check = () => {}, recovery = false, timeout = 45000) => EhControls.waitEvaluation({doc:document,panel,check:()=>{if(closed)throw Error('助手已关闭。');check();},isStopped:()=>closed||stopped&&!recovery,status,sleep,timeout});
  let aiUndo = null;
  const editorRequest = (op, data = {}) => new Promise((resolve,reject) => {
    if(closed){reject(Error('助手已关闭。'));return;}
    const id=crypto.randomUUID();
    const cancel=(message='助手已关闭。')=>{cleanup();document.dispatchEvent(new CustomEvent('eh-editor-v5-request',{detail:JSON.stringify({id,op:'cancel',url:location.href})}));reject(Error(message));};
    const cleanup=()=>{clearTimeout(timer);document.removeEventListener('eh-editor-v5-result',receive);pendingEditors.delete(cancel);};
    const receive=event=>{let reply;try{reply=JSON.parse(event.detail);}catch{return;}if(reply.id!==id)return;cleanup();reply.ok?resolve(reply):reject(Error(reply.error));};
    const timer=setTimeout(()=>cancel('编辑器连接超时，请重新加载扩展并刷新页面。'),op==='open'||op==='write'?40000:10000);
    document.addEventListener('eh-editor-v5-result',receive);
    pendingEditors.add(cancel);
    document.dispatchEvent(new CustomEvent('eh-editor-v5-request',{detail:JSON.stringify({id,op,url:location.href,...data})}));
  });
  $('ai-settings').onclick=()=>globalThis.chrome?.runtime?.sendMessage({type:'eh-ai-settings',updates:!$('update-dot').hidden});
  async function generateCode(feedback = '') {
    if(!globalThis.EhSources||!globalThis.EhSolution)throw Error('编程模块未加载，请在扩展页重新加载插件，再刷新答题页。');
    const page=location.href;
    if([...document.querySelectorAll('div.option input')].some(el=>el.getClientRects().length))throw Error('当前是选择题，请使用整关模式。');
    const learning=[...document.querySelectorAll('a')].find(el=>el.getClientRects().length&&el.innerText.trim()==='学习内容');
    learning?.click();await sleep(300);
    const task=[...document.querySelectorAll('.markdown-body,.task-pass')].filter(el=>!panel.contains(el)&&el.getClientRects().length).map(el=>el.innerText).filter(Boolean).join('\n\n');
    if(!task.trim())throw Error('未读取到编程题题干，请打开学习内容后重试。');
    const check=()=>{if(stopped||location.href!==page)throw Error('任务已停止或关卡已变化。');};
    const original=await editorRequest('read');
    const declared=(await editorRequest('context')).context;
    const context=await EhSources.capture(declared,{request:editorRequest,check,status});
    check();
    const state=(await editorRequest('state')).state;
    if(!feedback)feedback={...EhContext.feedback(state),matches_current_sources:false};
    status('DeepSeek 正在分析本题、文件调用关系和实现方案…');
    const input={task,code:original.code,file:state.file||original.file,language:original.language,feedback,context};
    $('ai-context').value=JSON.stringify(input,null,2);
    const requestId=crypto.randomUUID();
    const progress=(message,sender)=>{
      if(sender.id!==chrome.runtime.id||message.type!=='eh-ai-progress'||message.requestId!==requestId||message.url!==page||location.href!==page||stopped||closed)return;
      status('AI 返回内容需要纠正，自动重试 '+message.attempt+'/'+message.maxAttempts+'：'+String(message.reason||'').slice(0,800));
    };
    globalThis.chrome?.runtime?.onMessage?.addListener(progress);
    let result;
    try{result=await chrome.runtime.sendMessage({type:'eh-ai-generate',requestId,input});}
    finally{globalThis.chrome?.runtime?.onMessage?.removeListener(progress);}
    if(!result?.ok)throw Error(result?.error||'DeepSeek 请求失败。');
    $('ai-preview').value=JSON.stringify({plan:result.plan,files:result.files,explanation:result.explanation},null,2);
    if(stopped||location.href!==page)throw Error('已停止或关卡已变化，代码仅保留预览，未写入。');
    const written=await EhSources.apply(result,context,{request:editorRequest,check,status,onJournal:files=>{
      if(files.length){aiUndo={url:page,files:files.map(f=>({...f}))};$('ai-undo').disabled=false;}
    }});
    status('已按“'+written.plan.kind+'”方案写入 '+written.journal.length+' 个文件。'+written.plan.approach);
    return written;
  }
  async function solveProgramming() {
    const page=location.href,task=location.pathname.split('/').pop(),cooldownKey='eh-program-cooldown:'+task;
    const readState=async()=>{if(stopped||location.href!==page)throw Error('已停止或关卡变化。');return (await editorRequest('state')).state;};
    const initial=await readState();
    if(initial.status===2){status('本关已有通过结果，保留代码并继续。');return true;}
    let deadline=Number(sessionStorage.getItem(cooldownKey))||0;
    if(initial.status!==2 && initial.tests.some(test=>test.result===false||test.result===0||test.compile===false))deadline=Math.max(deadline,Date.now()+31000);
    const result=await EhProgrammingRun({maxAttempts:$('ai-limit').value,nextAllowed:deadline,status,isStopped:()=>stopped||location.href!==page,
      saveCooldown:value=>{if(value)sessionStorage.setItem(cooldownKey,String(value));else sessionStorage.removeItem(cooldownKey);},
      generate:generateCode,
      evaluate:async written=>{
        await readState();
        await EhSources.verify(written.files,{request:editorRequest,check:()=>{if(stopped||location.href!==page)throw Error('已停止或关卡变化。');}});
        await editorRequest('open',{path:written.evaluationPath});
        // Respect the platform's own disabled/countdown state in addition to our timer.
        await waitButton(readState,false,90000);
        await EhSources.verify(written.files,{request:editorRequest,check:()=>{if(stopped||location.href!==page)throw Error('已停止或关卡变化。');}});
        await editorRequest('open',{path:written.evaluationPath});
        const evalButton=await waitButton(readState,false,90000);
        const before=await readState();
        let sawBusy=false;
        evalButton.click();
        const evaluationDeadline=Date.now()+180000;
        while(Date.now()<evaluationDeadline){
          await sleep(250);const state=await readState();sawBusy ||= state.loading;
          const fresh=sawBusy||state.count>before.count||state.status!==before.status;
          const finalTests=state.tests.length>0&&state.tests.every(test=>test.result===true||test.result===false||test.result===0||test.result===1);
          const failed=state.tests.some(test=>test.result===false||test.result===0||test.compile===false);
          const compileFailure=state.tests.some(test=>test.compile===false);
          if(fresh&&!state.loading&&(state.status===2||finalTests||compileFailure||failed&&Boolean(typeof state.message==='string'?state.message:state.message?.text))){
            const passed=state.status===2 && !failed;
            return {passed,feedback:{...EhContext.feedback(state),matches_current_sources:true}};
          }
          if(!sawBusy&&!fresh&&Date.now()>evaluationDeadline-170000)throw Error('未检测到新评测，请检查页面提示；未重复提交。');
          status('本次编程评测处理中，等待最终结果…');
        }
        throw Error('编程评测超时，未确认结果，停止自动提交。');
      }
    });
    status('编程题评测通过，Flash 尝试 '+result.attempts+' 轮。');
    return true;
  }
  $('ai-run').onclick=async()=>{
    if(running)return;stopped=false;chainActive=false;lock(true);
    try{if(!await ensureAiConfigured())return;await generateCode();}catch(error){status('AI：'+error.message);}finally{lock(false);}
  };
  $('ai-undo').onclick=async()=>{
    if(running||!aiUndo)return;
    stopped=false;
    lock(true);
    try{const backup=aiUndo;const check=()=>{if(stopped||location.href!==backup.url)throw Error('已停止或关卡变化，未继续恢复。');};await EhSources.restore(backup.files,{request:editorRequest,check,status});aiUndo=null;$('ai-undo').disabled=true;}catch(error){status(error.message);}finally{lock(false);}
  };
  async function waitForLevel() {
    const started = Date.now();
    let stable = '', since = 0;
    while (Date.now() - started < 30000) {
      if (stopped) throw Error('已停止自动流程。');
      const inputs = [...document.querySelectorAll('input[type=radio],input[type=checkbox]')].filter(el => !panel.contains(el) && el.getClientRects().length);
      const loading = [...document.querySelectorAll('.ant-spin-spinning')].some(el => el.getClientRects().length);
      const ready = [...document.querySelectorAll('a,button')].some(el => el.getClientRects().length && (el.title==='运行评测'||/^(评测|下一关|上一关)$/.test(el.innerText.trim())));
      const signature = document.title + ':' + inputs.length;
      if (signature !== stable || loading) { stable = signature; since = Date.now(); }
      if (!loading && ready && Date.now() - since >= 1200 && (inputs.length || Date.now() - started >= 8000)) return inputs.length > 0;
      await sleep(300);
    }
    throw Error('关卡加载未完成，已停止，未将加载失败的页面当作编程题跳过。');
  }
  async function goNext(reason) {
    if (!chainActive || stopped) return;
    lock(true);
    status(reason + '，准备进入下一关…');
    await sleep(1000);
    if (stopped || !chainActive) {lock(false);return;}
    const links = [...document.querySelectorAll('a[href]')].filter(el => !panel.contains(el) && el.getClientRects().length && el.innerText.trim() === '下一关' && el.getAttribute('aria-disabled') !== 'true');
    if (!links.length) { chainActive = false; status(reason + '；自动流程结束，没有下一关。'); lock(false); return; }
    if (links.length !== 1) throw Error('下一关链接不唯一，已停止。');
    const next = new URL(links[0].href, location.href);
    const prefix = location.pathname.slice(0, location.pathname.lastIndexOf('/') + 1);
    // Some task links omit classroom/homework segments; retain the current context.
    if (next.origin === location.origin && /^\/tasks\/[^/]+\/?$/.test(next.pathname) && prefix !== '/tasks/') {
      next.pathname = prefix + next.pathname.split('/').filter(Boolean).pop();
    }
    if (next.origin !== location.origin || !next.pathname.startsWith(prefix) || !next.pathname.startsWith('/tasks/')) throw Error('下一关链接超出当前任务范围，已停止。');
    const target = canonical(next.href);
    if (visited.includes(target)) throw Error('下一关指向已访问关卡，已停止，避免循环。');
    sessionStorage.setItem(chainKey, JSON.stringify({next:target, visited:[...visited,target], delay:$('delay').value, mode:$('mode').value, aiLimit:$('ai-limit').value, batch:$('batch').value, at:Date.now()}));
    // Full navigation lets the extension resume in a new isolated world reliably.
    location.assign(target);
  }
  $('start').onclick = async () => {
    if (running) return;
    let submitted = false, confirmedMasks = null, bestMasks = null, bestScore = null, passed = false;
    const pageUrl = location.href;
    try {
      stopped = false;
      const pendingResume = resume; resume = null;
      chainActive = $('scope').value === 'all' && $('auto').checked;
      visited = pendingResume?.visited || [canonical(location.href)];
      lock(true);
      const mode=$('mode').value;
      if(mode!=='choice'&&!await ensureAiConfigured())return;
      const hasChoices=await waitForLevel();
      if (mode==='code' && hasChoices) {
        if (chainActive) await goNext('编程题模式：本关是选择题，跳过（未提交）');
        else status('本关是选择题；编程题模式未作答。');
        return;
      }
      if (!hasChoices) {
        if (mode==='code' || mode==='mixed') { passed=await solveProgramming(); return; }
        if (chainActive) await goNext('本关未检测到选择题，跳过（未提交评测）');
        else status('本关未检测到选择题，请切换编程题助手或混合模式。');
        return;
      }
      groups = discover(); render();
      if(!globalThis.EhChoiceBatch)throw Error('选择题模块未加载，请重新加载插件并刷新答题页。');
      const full = $('scope').value === 'all';
      const selectedIndex = Number($('question').value);
      if (!full && (!Number.isInteger(selectedIndex) || !groups[selectedIndex])) throw Error('请先选择目标题。');
      const questionSignature=group=>(group.el.parentElement.innerText||'').replace(/\s+/g,' ').trim();
      const confirmedCorrect=new Set();
      groups.forEach((group,index)=>{const known=choiceKnown.get(index);if(known&&known.signature===questionSignature(group)&&known.mask===maskOf(group)){confirmedCorrect.add(index);group.note='已确认正确，锁定';}});
      const confirmCorrect=index=>{confirmedCorrect.add(index);choiceKnown.set(index,{signature:questionSignature(groups[index]),mask:maskOf(groups[index])});groups[index].note='已确认正确，锁定';};
      const targets = (full ? groups.map((_, index) => index) : [selectedIndex]).filter(index=>!confirmedCorrect.has(index));
      const inputs = groups.flatMap(group => group.boxes);
      const expected = new Map(inputs.map(el => [el, el.checked]));
      const capture = () => groups.map(maskOf);
      const same = (a,b) => a && b && a.length === b.length && a.every((value,i) => value === b[i]);
      const check = () => {
        if(closed)throw Error('助手已关闭。');
        if (!sameTask(location.href, pageUrl) || inputs.some(el => !el.isConnected)) throw Error('页面或题目已变化，请重新识别。');
        if (inputs.some(el => el.checked !== expected.get(el))) throw Error('检测到手动改动答案，已停止，避免误判结果。');
        const currentInputs = [...document.querySelectorAll('div.option input[type=radio],div.option input[type=checkbox]')];
        if (currentInputs.length !== inputs.length || currentInputs.some(el => !expected.has(el))) throw Error('题目列表已变化，请重新识别。');
      };
      const delay = Math.max(1, Math.min(60, Number($('delay').value) || 1)) * 1000;
      let lastSubmissionAt = 0;
      const task = location.pathname.split('/').pop();
      let useNetwork = false;
      lock(true);
      async function applyMask(group, mask, recovery = false) {
        check();
        if (stopped && !recovery) return false;
        if (group.type === 'radio') {
          if (!mask || (mask & (mask - 1))) throw Error('单选题组合无效。');
          if (maskOf(group) !== mask) {
            const index = Math.log2(mask);
            group.boxes[index].closest('a.flex-container').click();
            group.boxes.forEach((el, i) => expected.set(el, i === index));
            await sleep(80); check();
          }
        } else {
          for (let i = 0; i < group.boxes.length; i++) {
            if (stopped && !recovery) return false;
            const el = group.boxes[i], wanted = Boolean(mask & (1 << i));
            if (el.checked !== wanted) {
              check(); el.closest('a.flex-container').click(); expected.set(el, wanted);
              await sleep(80); check();
            }
          }
        }
        render(); return true;
      }
      for (const group of groups) {
        if (!maskOf(group)) {
          if (!full) throw Error('存在未作答题目，请填写后再运行指定题模式，或使用整关模式。');
          group.note = '临时选择首项建立基准';
          if (!await applyMask(group, 1)) return status('已停止，尚未提交基准。');
        }
      }
      async function readNetwork() {
        return new Promise((resolve, reject) => {
          const id = crypto.randomUUID();
          const cleanup = () => { clearTimeout(timer); document.removeEventListener('eh-network-result', receive); };
          function receive(event) {
            let data; try { data = JSON.parse(event.detail); } catch { return; }
            if (data.kind !== 'reply' || data.id !== id) return;
            cleanup();
            if (data.error) reject(Error(data.error)); else resolve(data.record);
          }
          const timer = setTimeout(() => { cleanup(); reject(Error('记录接口连接超时')); }, 12000);
          document.addEventListener('eh-network-result', receive);
          document.dispatchEvent(new CustomEvent('eh-network-request', {detail:JSON.stringify({id, op:'records', task})}));
        });
      }
      // A single normal tab refresh teaches the bridge the page's authenticated GET request.
      await refreshRecords();
      try { await readNetwork(); useNetwork = true; } catch { useNetwork = false; }
      async function submit(label, recovery = false) {
        check();
        if (!useNetwork) await refreshRecords();
        while (Date.now() - lastSubmissionAt < delay && (!stopped || recovery)) await sleep(100);
        await waitButton(check,recovery);
        const before = useNetwork ? await readNetwork() : null;
        const previous = useNetwork ? [] : records(), old = signature(previous[0]), oldTime = previous[0]?.cells[0]?.innerText.trim() || '';
        check();
        if (stopped && !recovery) throw Error('已停止，未发出本次评测。');
        const build = {id:null, done:false, error:null};
        const observe = event => {
          let data; try { data = JSON.parse(event.detail); } catch { return; }
          if (data.task !== task) return;
          if (data.kind === 'build-start') {
            if (build.id !== null) build.error = '检测到并发评测，无法确认结果归属';
            else build.id = data.buildId;
          }
          if (data.kind === 'build-end' && data.buildId === build.id) {
            build.done = true;
            if (!data.ok) build.error = data.message;
          }
        };
        if (useNetwork) document.addEventListener('eh-network-result', observe);
        try {
          status(label + '：正在提交评测（' + (useNetwork ? '接口读取结果' : '页面兼容模式') + '）…');
          const evalButton=await waitButton(check,recovery);
          lastSubmissionAt = Date.now();
          evalButton.click(); submitted = true;
          if (useNetwork) {
            const deadline = Date.now() + 90000;
            let interval = 300;
            while (Date.now() < deadline) {
              await sleep(interval); check();
              if (build.error) throw Error(build.error);
              if (!build.done) {
                if (!build.id && Date.now() - lastSubmissionAt > 10000) throw Error('未检测到评测请求，请检查页面提示');
                if (!stopped) status(label + '：评测请求处理中，尚未完成…');
                continue;
              }
              const record = await readNetwork(); check();
              const fresh = record && Number.isInteger(record.index) && record.index > (before?.index ?? 0);
              if (fresh && record.index !== (before?.index ?? 0) + 1) throw Error('出现多条新评测，无法确认结果归属');
              const result = fresh && typeof record.output === 'string' ? parse(record.output) : null;
              if (result !== null) return result;
              if (!stopped) status(label + '：提交已响应，等待本次最终记录…');
              interval = Math.min(2000, interval * 1.5);
            }
          } else {
        const deadline = Date.now() + 90000;
        let stable = '', since = 0, refreshAt = Date.now() + 2000;
        // A stop request prevents future submissions but still waits for this result.
        while (Date.now() < deadline) {
          await sleep(500); check();
          if (Date.now() >= refreshAt) {
            await refreshRecords();
            check();
            refreshAt = Date.now() + 3000;
          }
          const rows = records(), top = rows[0], sig = signature(top), time = top?.cells[0]?.innerText.trim() || '';
          const fresh = sig && sig !== old && (time !== oldTime || rows.length > previous.length);
          const result = top?.cells[1] ? parse(top.cells[1].innerText) : null;
          if (fresh && result !== null) {
            if (stable !== sig) { stable = sig; since = Date.now(); }
            else if (Date.now() - since >= 1500) return result;
          } else { stable = ''; since = 0; }
        }

          }
          throw Error('90 秒内未确认本次最终评测结果，已停止，未继续提交。');
        } finally {
          document.removeEventListener('eh-network-result', observe);
        }
      }

      async function evaluate(label, recovery = false) {
        const result = await submit(label, recovery);
        confirmedMasks = capture();
        return result;
      }
      async function restoreBest(reason) {
        for (let i = 0; i < groups.length; i++) if (maskOf(groups[i]) !== bestMasks[i]) await applyMask(groups[i], bestMasks[i], true);
        if (!same(confirmedMasks, bestMasks)) {
          const restored = await evaluate(reason + '，恢复并提交最佳答案', true);
          if (restored !== bestScore) throw Error('恢复相同答案后的评测结果不一致，已停止。');
        }
        render();
      }
      bestScore = await evaluate('提交当前整关答案建立基准'); bestMasks = capture();
      if (bestScore === 0) { passed = true; groups.forEach(group => { group.note = '整关通过'; }); render(); return status('整关完成：评测通过，已保留最终提交。'); }
      if (stopped) return status('已停止并保留基准答案，不匹配 ' + bestScore + ' 组。');
      async function solveOne(index) {
        if(confirmedCorrect.has(index))return;
        const group = groups[index], initial = bestMasks[index];
        const candidates = EhChoiceBatch.candidates(group,initial);
        let improved = false, kept = false, attempt = 0;
        for (const mask of candidates) {
          if (stopped || !await applyMask(group, mask)) break;
          group.note = '尝试 ' + (++attempt) + '/' + candidates.length; render();
          const result = await evaluate('第 ' + group.number + ' 题（' + (group.type === 'radio' ? '单选' : '多选') + '） ' + attempt + '/' + candidates.length);
          if (result < bestScore) {
            const previous = bestScore; bestScore = result; bestMasks = capture(); improved = true;
            confirmCorrect(index);group.note = '已确认正确，锁定（'+previous+'→'+result+'）'; render();
            if (bestScore === 0) { passed = true; groups.forEach(g => { g.note = '整关通过'; }); render(); return status('整关完成：评测通过，已保留全部答案和最新提交。'); }
            break;
          }
          if (result > bestScore) {
            kept = true; await restoreBest('第 ' + group.number + ' 题结果变差');
            confirmCorrect(index);group.note = '原答案已确认正确，恢复并锁定'; render(); break;
          }
          if (stopped) break;
        }
        if (!improved && !kept) {
          await restoreBest(stopped ? '停止' : '第 ' + group.number + ' 题未发现改善');
          group.note = stopped ? '已停止，保留最佳' : '未定位改善，保留原答案'; render();
        }
        if (stopped) { await restoreBest('停止'); return status('已停止并保留最佳提交，不匹配 ' + bestScore + ' 组。'); }
      }
      const audit=async indices=>{for(const index of indices){if(passed||stopped)break;await solveOne(index);}};
      const batchSize=full?Math.max(1,Math.min(4,Number($('batch').value)||3)):1;
      if(batchSize>1){
        await audit(targets.filter(index=>groups[index].type==='radio'));
        if(!passed&&!stopped)await EhChoiceBatch.run({targets:targets.filter(index=>groups[index].type==='checkbox'),size:batchSize,groups,
          state:()=>({score:bestScore,masks:[...bestMasks]}),
          set:async(masks,recovery=false)=>{for(let i=0;i<groups.length;i++){if(confirmedCorrect.has(i)&&maskOf(groups[i])!==masks[i])throw Error('不能修改已锁定的正确题。');if(maskOf(groups[i])!==masks[i]&&!await applyMask(groups[i],masks[i],recovery))return false;}return recovery||!stopped;},
          evaluate,accept:result=>{if(result<bestScore){bestScore=result;bestMasks=capture();}},restore:restoreBest,confirm:confirmCorrect,isStopped:()=>stopped,isConfirmed:index=>confirmedCorrect.has(index),
          note:(indices,text)=>{indices.forEach(index=>{groups[index].note=text;});render();}
        });
      }else await audit(targets);
      if(bestScore===0){passed=true;groups.forEach(group=>{group.note='整关通过';});render();return status('整关完成：评测通过，已保留全部答案和最新提交。');}
      if(stopped){await restoreBest('停止');return status('已停止并保留最佳提交，不匹配 '+bestScore+' 组。');}
      await restoreBest('本轮结束');
      status((full ? '整关尝试结束' : '本题尝试结束') + '，当前不匹配 ' + bestScore + ' 组。已保留最佳提交；剩余问题未能定位。');
    } catch (error) {
      if(closed)return;
      chainActive = false; sessionStorage.removeItem(chainKey);
      status('停止：' + error.message + (submitted ? ' 最新结果可能尚未确认，请核查记录；未自动重试提交。' : ''));
    } finally {
      if (!closed && submitted && sameTask(location.href, pageUrl)) { try { await refreshRecords(); } catch { /* Preserve the more useful result/error message. */ } }
      lock(false);
      if (passed && chainActive && !stopped) {
        try { await goNext('本关评测通过'); }
        catch (error) { chainActive = false; sessionStorage.removeItem(chainKey); lock(false); status('停止：' + error.message); }
      }
    }
  };
  scan();
  updateMode();
  if (resume) {
    $('scope').value = 'all'; $('auto').checked = true; $('mode').value = ['choice','code','mixed'].includes(resume.mode)?resume.mode:'mixed';
    updateMode();
    $('ai-limit').value=Math.max(1,Math.min(30,Number(resume.aiLimit)||10));
    $('batch').value=String([1,2,3,4].includes(Number(resume.batch))?Number(resume.batch):3);
    $('delay').value = Math.max(1, Math.min(60, Number(resume.delay) || 1));
    setTimeout(() => { if (panel.isConnected && !stopped) $('start').onclick(); }, 0);
  }
})();
