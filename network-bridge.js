// Runs in MAIN world. Authentication remains in the page; only normalized results cross worlds.
(() => {
  const supportedHosts = new Set(['www.educoder.net', 'educoder.net', 'trustie.educoder.net']);
  if (!supportedHosts.has(location.hostname) || !location.pathname.startsWith('/tasks/')) return;
  if (window.__eduHelperBridgeV1) return;
  window.__eduHelperBridgeV1 = true;
  const original = window.fetch;
  const requests = new Map(), fileRequests = new Map();
  let serial = 0;
  const emit = data => document.dispatchEvent(new CustomEvent('eh-network-result', {detail:JSON.stringify(data)}));
  const identify = url => {
    const u = new URL(url, location.href);
    const supportedOrigin = u.origin === 'https://data.educoder.net' || u.origin === location.origin;
    return u.protocol === 'https:' && supportedOrigin ? u.pathname.match(/^\/api\/tasks\/([^/]+)\/(evaluate_logs|choose_build|rep_content)\.json$/) : null;
  };
  window.fetch = function(input, init) {
    let match, saved;
    try {
      match = identify(typeof input === 'string' || input instanceof URL ? String(input) : input.url);
      if (match?.[2] === 'rep_content') { const request=new Request(input,init); if(request.method==='GET')fileRequests.set(match[1],request.clone()); }
      if (match?.[2] === 'evaluate_logs') {
        saved = new Request(input, init);
        if (saved.method === 'GET') requests.set(match[1], saved.clone());
      }
    } catch { /* Observation must never interrupt the platform request. */ }
    const buildId = match?.[2] === 'choose_build' ? ++serial : null;
    if (buildId) emit({kind:'build-start', task:match[1], buildId});
    const pending = Reflect.apply(original, this, [input, init]);
    if (buildId) pending.then(async response => {
      let data;
      try { data = await response.clone().json(); } catch {}
      // choose_build has a different schema from evaluate_logs. HTTP completion
      // only permits polling; a newer final log is still required for success.
      emit({kind:'build-end', task:match[1], buildId, ok:response.ok, message:String(data?.message || (response.ok ? '评测请求已响应' : '评测请求返回异常'))});
    }, () => emit({kind:'build-end', task:match[1], buildId, ok:false, message:'评测请求网络失败'})).catch(() => {});
    return pending;
  };
  document.addEventListener('eh-network-request', async event => {
    let command;try{command=JSON.parse(event.detail);}catch{return;}
    if(command.op!=='files'||typeof command.id!=='string'||!Array.isArray(command.paths))return;
    const reply=data=>emit({kind:'reply',id:command.id,...data});
    if(location.pathname.split('/').pop()!==command.task)return reply({error:'关卡已变化'});
    const request=fileRequests.get(command.task),files=[],missing=[];
    if(!request)return reply({files,missing:command.paths.map(path=>({path,reason:'未捕获页面文件读取请求，重新加载扩展并刷新页面后可用'}))});
    const deadline=Date.now()+25000;let budget=Number.isFinite(command.budget)?Math.max(0,Math.min(250000,command.budget)):250000;
    for(const path of command.paths.slice(0,20)){
      if(typeof path!=='string'||path.length>500||path.split('/').includes('..')){missing.push({path,reason:'文件路径无效'});continue;}
      if(location.pathname.split('/').pop()!==command.task)return reply({error:'关卡已变化'});
      if(Date.now()>deadline||budget<=0){missing.push({path,reason:'上下文预算或读取时间已达上限'});continue;}
      try{
        const url=new URL(request.url);url.searchParams.set('path',path);
        const response=await Reflect.apply(original,window,[new Request(url,{headers:request.headers,credentials:request.credentials,mode:request.mode,cache:'no-store',signal:AbortSignal.timeout(Math.min(8000,Math.max(1,deadline-Date.now())))})]);
        if(!response.ok)throw Error('页面文件接口返回 HTTP '+response.status);
        const data=await response.json();let code=data.content?.content??data.data?.content?.content??data.content??data.data?.content;
        if(typeof code!=='string')throw Error('页面没有返回可读取的源代码');
        const explicit=[data.encoding,data.content?.encoding,data.data?.encoding,data.data?.content?.encoding].includes('base64');
        const wrapper=typeof data.content==='object'?data.content:data.data?.content;
        if(explicit)code=new TextDecoder('utf-8',{fatal:true}).decode(Uint8Array.from(atob(code),c=>c.charCodeAt(0)));
        else if(Number.isFinite(wrapper?.size)&&code.length%4===0&&/^[A-Za-z0-9+/]*={0,2}$/.test(code))try{
          const bytes=Uint8Array.from(atob(code),c=>c.charCodeAt(0)),decoded=new TextDecoder('utf-8',{fatal:true}).decode(bytes);
          if(wrapper.size===bytes.length||wrapper.size===decoded.length)code=decoded;
        }catch{ /* Unmarked content that cannot be decoded stays unchanged. */ }
        const count=Math.min(150000,budget);files.push({path,code:code.slice(0,count),truncated:code.length>count,source:'page-file-api'});budget-=Math.min(code.length,count);
      }catch(error){missing.push({path,reason:error.name==='TimeoutError'?'读取超时':error.message});}
    }
    for(const path of command.paths.slice(20))missing.push({path,reason:'单次最多读取20个相关文件'});
    if(location.pathname.split('/').pop()!==command.task)return reply({error:'关卡已变化'});
    reply({files,missing});
  });
  document.addEventListener('eh-network-request', async event => {
    let command;
    try { command = JSON.parse(event.detail); } catch { return; }
    const {id, task} = command;
    if (command.op !== 'records' || typeof id !== 'string' || typeof task !== 'string') return;
    if (location.pathname.split('/').pop() !== task) return emit({kind:'reply', id, error:'任务已切换'});
    const request = requests.get(task);
    if (!request) return emit({kind:'reply', id, error:'尚未捕获记录请求，请先切换学习内容和记录'});
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 10000);
    try {
      const response = await Reflect.apply(original, window, [new Request(request, {signal:controller.signal, cache:'no-store'})]);
      const data = await response.json();
      if (!response.ok || data.status !== 0 || !Array.isArray(data.data?.list)) throw Error('记录接口返回异常');
      const row = data.data.list[0];
      const record = row ? {index:row.query_index, time:row.created_at, output:row.output_detail} : null;
      emit({kind:'reply', id, record});
    } catch (error) { emit({kind:'reply', id, error:error.message}); }
    finally { clearTimeout(timer); }
  });
})();
