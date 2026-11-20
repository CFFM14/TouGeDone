// Runs in MAIN world. Authentication remains in the page; only normalized results cross worlds.
(() => {
  const supportedHosts = new Set(['www.educoder.net', 'educoder.net', 'trustie.educoder.net']);
  if (!supportedHosts.has(location.hostname) || !location.pathname.startsWith('/tasks/')) return;
  if (window.__eduHelperBridgeV1) return;
  window.__eduHelperBridgeV1 = true;
  const original = window.fetch;
  const requests = new Map();
  let serial = 0;
  const emit = data => document.dispatchEvent(new CustomEvent('eh-network-result', {detail:JSON.stringify(data)}));
  const identify = url => {
    const u = new URL(url, location.href);
    const supportedOrigin = u.origin === 'https://data.educoder.net' || u.origin === location.origin;
    return u.protocol === 'https:' && supportedOrigin ? u.pathname.match(/^\/api\/tasks\/([^/]+)\/(evaluate_logs|choose_build)\.json$/) : null;
  };
  window.fetch = function(input, init) {
    let match, saved;
    try {
      match = identify(typeof input === 'string' || input instanceof URL ? String(input) : input.url);
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
