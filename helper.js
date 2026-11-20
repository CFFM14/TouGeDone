(() => {
  const boot = globalThis.__ehBootstrap === true;
  delete globalThis.__ehBootstrap;
  const chainKey = 'educoder-helper-next-v1';
  const canonical = value => { const url = new URL(value, location.href); url.hash = ''; return url.href; };
  let resume = null;
  try { resume = JSON.parse(sessionStorage.getItem(chainKey) || 'null'); } catch {}
  if (boot && (!resume || resume.next !== canonical(location.href) || !Array.isArray(resume.visited) || !Number.isFinite(resume.at) || Date.now() - resume.at > 120000)) return;
  if (boot) sessionStorage.removeItem(chainKey);
  if (document.getElementById('edu-helper-panel')) return;
  if (!boot) resume = null;
  const supportedHosts = new Set(['www.educoder.net', 'educoder.net', 'trustie.educoder.net']);
  if (!supportedHosts.has(location.hostname) || !location.pathname.startsWith('/tasks/')) return alert('请在头歌答题界面打开助手。当前页面：' + location.hostname + location.pathname);
  let running = false, stopped = false, groups = [], chainActive = false, visited = [];
  const panel = document.createElement('div');
  panel.id = 'edu-helper-panel';
  panel.style.cssText = 'position:fixed;z-index:2147483647;right:20px;top:60px;width:380px;max-height:82vh;overflow:auto;box-sizing:border-box;padding:16px;background:white;color:#172033;border:2px solid #1677ff;border-radius:12px;font:14px/1.6 sans-serif;box-shadow:0 4px 20px #0005';
  panel.innerHTML = `<b>头歌整关助手 · 2.1.0</b><button id="eh-close" style="float:right">关闭</button>
    <p>识别当前关卡的单选和多选题，逐题尝试并保留最佳提交。</p>
    <button id="eh-scan">重新识别题目</button> <span id="eh-count"></span>
    <div id="eh-questions" style="margin:10px 0"></div>
    <label>范围 <select id="eh-scope"><option value="all">当前整关</option><option value="one">指定一道题</option></select></label>
    <select id="eh-question" aria-label="指定题目" disabled></select>
    <p><label>最小提交间隔（秒） <input id="eh-delay" type="number" min="1" max="60" value="1" style="width:55px"></label></p>
    <p style="font-size:12px;color:#586174">开始后会真实提交。整关模式会为未作答题临时选择首项；一次只改一道题，等待本次结果后才继续。停止时会核查当前结果，必要时恢复并提交最佳答案。</p>
    <p><label><input id="eh-auto" type="checkbox" checked> 通过后自动下一关；无选择题时跳过</label></p><p style="font-size:12px">多选顺序：全选 → 少选一项 → 少选两项 → … → 单项。</p>
    <button id="eh-start">开始整关</button> <button id="eh-stop" disabled>停止并保留最佳</button>
    <p id="eh-status" role="status" aria-live="polite">等待识别。</p>`;
  document.body.appendChild(panel);
  const $ = id => panel.querySelector('#eh-' + id);
  const status = text => { $('status').textContent = text; };
  const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));
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
    $('questions').replaceChildren();
    for (const group of groups) {
      const row = document.createElement('div');
      row.textContent = '第 ' + group.number + ' 题 · ' + (group.type === 'radio' ? '单选' : '多选') + '（' + group.boxes.length + ' 项） ' + answer(maskOf(group)) + ' · ' + group.note;
      row.style.cssText = 'padding:5px 0;border-bottom:1px solid #edf0f5;font-size:12px';
      $('questions').appendChild(row);
    }
    $('count').textContent = groups.length + ' 题';
  }
  function scan() {
    try {
      groups = discover();
      $('question').replaceChildren();
      groups.forEach((group, index) => { const option = document.createElement('option'); option.value = index; option.textContent = '第 ' + group.number + ' 题'; $('question').appendChild(option); });
      render(); status('已识别 ' + groups.length + ' 题，可直接开始。');
    } catch (error) { groups = []; $('questions').replaceChildren(); $('count').textContent = '未识别'; status(error.message); }
  }
  $('scan').onclick = scan;
  $('scope').onchange = () => { $('question').disabled = $('scope').value === 'all'; $('start').textContent = $('scope').value === 'all' ? '开始整关' : '开始本题'; };
  $('stop').onclick = () => { stopped = true; chainActive = false; sessionStorage.removeItem(chainKey); status('正在停止：等待当前结果，必要时恢复并提交最佳答案，不再尝试新组合。'); };
  $('close').onclick = () => { if (running) return $('stop').click(); sessionStorage.removeItem(chainKey); panel.remove(); };
  const lock = value => {
    running = value;
    for (const id of ['scan','scope','question','delay','start','auto']) $(id).disabled = value;
    if (!value) $('question').disabled = $('scope').value === 'all';
    $('stop').disabled = !value;
  };
  const records = () => {
    const tables = [...document.querySelectorAll('table')].filter(el => el.getClientRects().length && /评测时间/.test(el.tHead?.innerText || '') && /评测结果/.test(el.tHead?.innerText || ''));
    if (tables.length !== 1) throw Error('评测记录未加载，请检查页面和网络。');
    return [...tables[0].querySelectorAll('tbody tr.ant-table-row')];
  };
  const signature = row => row ? [...row.cells].slice(0,4).map(el => el.innerText.trim()).join('|') : '';
  async function refreshRecords() {
    const tab = text => {
      const matches = [...document.querySelectorAll('a')].filter(el => !panel.contains(el) && el.getClientRects().length && el.innerText.trim() === text);
      if (matches.length !== 1) throw Error('无法识别“' + text + '”标签。');
      return matches[0];
    };
    tab('学习内容').click(); await sleep(200); tab('记录').click();
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
  const button = () => {
    const buttons = [...document.querySelectorAll('button')].filter(el => !panel.contains(el) && el.getClientRects().length && el.innerText.trim() === '评测');
    if (buttons.length !== 1) throw Error('无法唯一识别评测按钮。');
    const el = buttons[0];
    if (el.disabled || el.getAttribute('aria-disabled') === 'true' || el.classList.contains('ant-btn-loading')) throw Error('评测按钮暂不可用。');
    return el;
  };
  async function waitForLevel() {
    const started = Date.now();
    let stable = '', since = 0;
    while (Date.now() - started < 30000) {
      if (stopped) throw Error('已停止自动流程。');
      const inputs = [...document.querySelectorAll('input[type=radio],input[type=checkbox]')].filter(el => !panel.contains(el) && el.getClientRects().length);
      const loading = [...document.querySelectorAll('.ant-spin-spinning')].some(el => el.getClientRects().length);
      const ready = [...document.querySelectorAll('a,button')].some(el => el.getClientRects().length && /^(评测|下一关|上一关)$/.test(el.innerText.trim()));
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
    if (stopped || !chainActive) return;
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
    sessionStorage.setItem(chainKey, JSON.stringify({next:target, visited:[...visited,target], delay:$('delay').value, at:Date.now()}));
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
      if (chainActive && !await waitForLevel()) {
        await goNext('本关未检测到选择题，跳过（未提交评测）');
        return;
      }
      groups = discover(); render();
      const full = $('scope').value === 'all';
      const selectedIndex = Number($('question').value);
      if (!full && (!Number.isInteger(selectedIndex) || !groups[selectedIndex])) throw Error('请先选择目标题。');
      const targets = full ? groups.map((_, index) => index) : [selectedIndex];
      const inputs = groups.flatMap(group => group.boxes);
      const expected = new Map(inputs.map(el => [el, el.checked]));
      const capture = () => groups.map(maskOf);
      const same = (a,b) => a && b && a.length === b.length && a.every((value,i) => value === b[i]);
      const check = () => {
        if (location.href !== pageUrl || inputs.some(el => !el.isConnected)) throw Error('页面或题目已变化，请重新识别。');
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
        const before = useNetwork ? await readNetwork() : null;
        const previous = useNetwork ? [] : records(), old = signature(previous[0]), oldTime = previous[0]?.cells[0]?.innerText.trim() || '';
        while (Date.now() - lastSubmissionAt < delay && (!stopped || recovery)) await sleep(100);
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
      for (const index of targets) {
        const group = groups[index], initial = bestMasks[index];
        const popcount = mask => { let count = 0; while (mask) { mask &= mask - 1; count++; } return count; };
        const distance = mask => { let bits = mask ^ initial, count = 0; while (bits) { bits &= bits - 1; count++; } return count; };
        const candidates = (group.type === 'radio' ? group.boxes.map((_,i) => 1 << i) : Array.from({length:(1 << group.boxes.length) - 1}, (_,i) => i + 1)).filter(mask => mask !== initial).sort((a,b) => group.type === 'radio' ? a - b : popcount(b) - popcount(a) || distance(a) - distance(b) || b - a);
        let improved = false, kept = false, attempt = 0;
        for (const mask of candidates) {
          if (stopped || !await applyMask(group, mask)) break;
          group.note = '尝试 ' + (++attempt) + '/' + candidates.length; render();
          const result = await evaluate('第 ' + group.number + ' 题（' + (group.type === 'radio' ? '单选' : '多选') + '） ' + attempt + '/' + candidates.length);
          if (result < bestScore) {
            const previous = bestScore; bestScore = result; bestMasks = capture(); improved = true;
            group.note = '已改善 ' + previous + '→' + result; render();
            if (bestScore === 0) { passed = true; groups.forEach(g => { g.note = '整关通过'; }); render(); return status('整关完成：评测通过，已保留全部答案和最新提交。'); }
            break;
          }
          if (result > bestScore) {
            kept = true; await restoreBest('第 ' + group.number + ' 题结果变差');
            group.note = '原答案更好，已恢复'; render(); break;
          }
          if (stopped) break;
        }
        if (!improved && !kept) {
          await restoreBest(stopped ? '停止' : '第 ' + group.number + ' 题未发现改善');
          group.note = stopped ? '已停止，保留最佳' : '未定位改善，保留原答案'; render();
        }
        if (stopped) { await restoreBest('停止'); return status('已停止并保留最佳提交，不匹配 ' + bestScore + ' 组。'); }
      }
      await restoreBest('本轮结束');
      status((full ? '整关尝试结束' : '本题尝试结束') + '，当前不匹配 ' + bestScore + ' 组。已保留最佳提交；剩余问题未能定位。');
    } catch (error) {
      chainActive = false; sessionStorage.removeItem(chainKey);
      status('停止：' + error.message + (submitted ? ' 最新结果可能尚未确认，请核查记录；未自动重试提交。' : ''));
    } finally {
      if (submitted && location.href === pageUrl) { try { await refreshRecords(); } catch { /* Preserve the more useful result/error message. */ } }
      lock(false);
      if (passed && chainActive && !stopped) {
        try { await goNext('本关评测通过'); }
        catch (error) { chainActive = false; sessionStorage.removeItem(chainKey); lock(false); status('停止：' + error.message); }
      }
    }
  };
  scan();
  if (resume) {
    $('scope').value = 'all'; $('auto').checked = true;
    $('delay').value = Math.max(1, Math.min(60, Number(resume.delay) || 1));
    setTimeout(() => { if (panel.isConnected && !stopped) $('start').onclick(); }, 0);
  }
})();
