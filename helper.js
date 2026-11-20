(() => {
  if (document.getElementById('edu-helper-panel')) return;
  if (location.hostname !== 'www.educoder.net' || !location.pathname.startsWith('/tasks/')) return alert('请进入头歌答题界面后打开助手。');
  let choices = [], picking = false, running = false, stopped = false;
  const panel = document.createElement('div');
  panel.id = 'edu-helper-panel';
  panel.style.cssText = 'position:fixed;z-index:2147483647;right:20px;top:70px;width:340px;padding:16px;background:white;color:#172033;border:2px solid #1677ff;border-radius:10px;font:14px/1.6 sans-serif;box-shadow:0 4px 20px #0005';
  panel.innerHTML = '<b>头歌逐题组合助手</b><button id="eh-close" style="float:right">关闭</button><p>① 打开左侧“记录 → 评测记录”。</p><p>② 点“选选项”，依次点击同一道多选题的全部选项文字或方框。此时不会改变答案。</p><button id="eh-pick">选选项</button> <button id="eh-clear">清空</button> <span id="eh-count">0 个</span><p>③ 开始后先提交当前答案作为基准，再逐一提交该题的其他组合。其他题保持不变。</p><label>最小提交间隔（秒） <input id="eh-delay" type="number" min="1" max="60" value="1" style="width:60px"></label><p><button id="eh-start">开始尝试</button> <button id="eh-stop" disabled>停止</button></p><p id="eh-status" role="status" aria-live="polite">等待设置。平台按最新提交计分，停止后请核查记录。</p>';
  document.body.appendChild(panel);
  const $ = id => panel.querySelector('#eh-' + id);
  const status = text => { $('status').textContent = text; };
  const sleep = ms => new Promise(r => setTimeout(r, ms));
  const parse = text => {
    const m = text.match(/其中有\s*(\d+)\s*组测试结果\s*不匹配/);
    return m ? Number(m[1]) : /评测通过|全部通过|所有测试(?:集)?.*通过/.test(text) ? 0 : null;
  };
  const records = () => {
    const tables = [...document.querySelectorAll('table')].filter(e => e.getClientRects().length && /评测时间/.test(e.tHead?.innerText || '') && /评测结果/.test(e.tHead?.innerText || ''));
    if (tables.length !== 1) throw Error('请打开“记录 → 评测记录”并保持打开。');
    return [...tables[0].querySelectorAll('tbody tr.ant-table-row')];
  };
  const signature = row => row ? [...row.cells].slice(0, 4).map(e => e.innerText.trim()).join('|') : '';
  async function refreshRecords() {
    const tab = text => {
      const matches = [...document.querySelectorAll('a')].filter(e => !panel.contains(e) && e.getClientRects().length && e.innerText.trim() === text);
      if (matches.length !== 1) throw Error('无法识别“' + text + '”标签，请保持答题界面打开。');
      return matches[0];
    };
    tab('学习内容').click();
    await sleep(200);
    tab('记录').click();
    // The records request is asynchronous; allow the table to finish loading.
    const deadline = Date.now() + 10000;
    while (Date.now() < deadline) {
      await sleep(500);
      try {
        records();
        const loading = [...document.querySelectorAll('.ant-table-wrapper .ant-spin-spinning')].some(e => e.getClientRects().length);
        if (!loading) return;
      } catch { /* The records panel can be absent during the tab transition. */ }
    }
    throw Error('切回记录后列表未加载完成，请检查网络。');
  }
  const button = () => {
    const buttons = [...document.querySelectorAll('button')].filter(e => !panel.contains(e) && e.getClientRects().length && e.innerText.trim() === '评测');
    if (buttons.length !== 1) throw Error('无法唯一识别评测按钮。');
    const e = buttons[0];
    if (e.disabled || e.getAttribute('aria-disabled') === 'true' || e.classList.contains('ant-btn-loading')) throw Error('评测按钮暂不可用。');
    return e;
  };
  function pick(event) {
    if (!picking || running || panel.contains(event.target)) return;
    event.preventDefault(); event.stopImmediatePropagation();
    const target = event.target;
    const box = target.closest('a.flex-container, label')?.querySelector('input[type=checkbox]') || (target.matches('input[type=checkbox]') ? target : null);
    if (!box) return status('未识别到多选框，请点击选项方框或文字。暂不支持单选题。');
    if (!choices.includes(box)) choices.push(box);
    $('count').textContent = choices.length + ' 个';
    status('已选 ' + choices.length + ' 个选项，选完点击“开始尝试”。');
  }
  document.addEventListener('click', pick, true);
  $('pick').onclick = () => { picking = !picking; status(picking ? '依次点击同一道多选题的全部选项。' : '已退出选择。'); };
  $('clear').onclick = () => { choices = []; picking = false; $('count').textContent = '0 个'; status('已清空助手选择，页面答案未改变。'); };
  $('stop').onclick = () => { stopped = true; status('正在停止；等待已发出的评测结束，之后不再提交。'); };
  $('close').onclick = () => {
    if (running) { stopped = true; return status('正在停止，请等待当前评测结束后关闭。'); }
    document.removeEventListener('click', pick, true); panel.remove();
  };
  const lock = value => {
    running = value;
    for (const id of ['pick', 'clear', 'start', 'delay']) $(id).disabled = value;
    $('stop').disabled = !value;
  };
  $('start').onclick = async () => {
    if (running) return;
    picking = false;
    const selected = [...choices];
    let submitted = false;
    try {
      if (!selected.length || selected.length > 12 || selected.some(e => !e.isConnected || e.disabled)) throw Error('请选择一道多选题的全部选项（1～12 个）。');
      let group = selected[0].closest('a.flex-container')?.parentElement;
      while (group && group.querySelectorAll('input[type=checkbox]').length < 2) group = group.parentElement;
      const boxes = group ? [...group.querySelectorAll('input[type=checkbox]')] : [];
      if (!boxes.length || boxes.length !== selected.length || boxes.some(e => !selected.includes(e))) throw Error('请完整选择同一道多选题的所有选项，不要跨题。');
      records(); button();
      const url = location.href;
      const others = [...document.querySelectorAll('input[type=checkbox], input[type=radio]')].filter(e => !panel.contains(e) && !selected.includes(e)).map(e => ({e, checked:e.checked}));
      const check = () => {
        if (location.href !== url || selected.some(e => !e.isConnected)) throw Error('页面或题目已变化，请重新设置。');
        if (others.some(({e, checked}) => !e.isConnected || e.checked !== checked)) throw Error('其他题的选项已变化，停止比较。');
      };
      const initial = selected.reduce((n, e, i) => n | (e.checked ? 1 << i : 0), 0);
      const delay = Math.max(1, Math.min(60, Number($('delay').value) || 1)) * 1000;
      let lastSubmissionAt = 0;
      const task = location.pathname.split('/').pop();
      let useNetwork = false;
      lock(true); stopped = false;
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
      async function submit(label) {
        check();
        if (!useNetwork) await refreshRecords();
        const before = useNetwork ? await readNetwork() : null;
        const previous = useNetwork ? [] : records(), old = signature(previous[0]), oldTime = previous[0]?.cells[0]?.innerText.trim() || '';
        while (Date.now() - lastSubmissionAt < delay && !stopped) await sleep(100);
        check();
        if (stopped) throw Error('已停止，未发出本次评测。');
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
          lastSubmissionAt = Date.now();
          button().click(); submitted = true;
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
      const baseline = await submit('提交当前答案建立基准');
      if (stopped) return status('已停止，基准不匹配 ' + baseline + ' 组。');
      if (baseline === 0) return status('当前答案已全部通过。');
      const total = 1 << selected.length;
      // Try small changes to the user's current answer before distant combinations.
      const distance = mask => { let bits = mask ^ initial, count = 0; while (bits) { bits &= bits - 1; count++; } return count; };
      const candidates = Array.from({length:total - 1}, (_, i) => i + 1).filter(mask => mask !== initial).sort((a,b) => distance(a) - distance(b) || b - a);
      let attempt = 0;
      // The platform does not create an evaluation record for an unanswered question.
      for (const mask of candidates) {
        if (stopped) break;
        check();
        for (let i = 0; i < selected.length; i++) {
          if (stopped) break;
          check();
          if (selected[i].checked !== Boolean(mask & (1 << i))) selected[i].closest('a.flex-container').click();
          await sleep(80);
        }
        await sleep(300);
        if (stopped) return status('已停止；页面可能存在未提交的选项，请核查。');
        check();
        if (selected.some((e, i) => e.checked !== Boolean(mask & (1 << i)))) throw Error('选项状态未正确改变。');
        const result = await submit('尝试非空组合 ' + (++attempt) + ' / ' + candidates.length);
        if (result < baseline) return status('找到改善组合！不匹配从 ' + baseline + ' 降至 ' + result + ' 组，已停止并保留答案。');
        if (result > baseline) throw Error('不匹配数增加到 ' + result + '，请核查最新提交。');
        if (stopped) break;
      }
      status(stopped ? '已停止，当前提交结果已核查。' : '所有其他组合已尝试，未发现改善。保留最后提交的组合。');
    } catch (e) { status('停止：' + e.message + (submitted ? ' 平台按最新提交计分，请核查记录与页面选项。' : '')); }
    finally { lock(false); }
  };
})();
