(() => {
  const $=id=>document.getElementById(id),check=$('update-check'),download=$('update-download');
  $('current-version').textContent='v'+chrome.runtime.getManifest().version;
  const message=text=>{$('update-status').textContent=text;};
  check.onclick=async()=>{
    check.disabled=true;download.hidden=true;$('update-notes').hidden=true;message('正在检查 GitHub 正式发布版本…');
    try{
      const result=await chrome.runtime.sendMessage({type:'eh-update-check'});
      if(!result?.ok)throw Error(result?.error||'检查失败，请稍后重试。');
      if(result.state==='available'){
        message('发现新版 v'+result.latest+'。下载 ZIP 后手动覆盖原目录，再在扩展页重新加载。');download.hidden=false;download.textContent='下载 v'+result.latest;
        $('update-notes').textContent=result.notes||'';$('update-notes').hidden=!result.notes;
      }else if(result.state==='current')message('当前 v'+result.current+' 已是最新正式版。');
      else if(result.state==='no_release')message('仓库尚未发布正式安装包，请稍后再试。');
      else throw Error('更新信息无效，请稍后重试。');
    }catch(error){message(error.message);}finally{check.disabled=false;}
  };
  download.onclick=async()=>{
    check.disabled=true;download.disabled=true;message('正在打开新版安装包下载…');
    try{const result=await chrome.runtime.sendMessage({type:'eh-update-download'});if(!result?.ok)throw Error(result?.error||'无法打开下载。');message('已打开下载。请先停止助手，解压后手动覆盖原目录，在扩展页重新加载，再刷新答题页。');}
    catch(error){message(error.message);}finally{download.disabled=false;check.disabled=false;}
  };
  // Discard handles and backups from the removed installer; never read or restore them.
  if(globalThis.indexedDB){
    const cleanup=$('update-cleanup');
    try{
      const request=indexedDB.deleteDatabase('tougedone-updater');
      request.onblocked=()=>{if(cleanup){cleanup.hidden=false;cleanup.textContent='请关闭其他旧版设置页，再重新打开此页，以清理旧更新缓存。';}};
      request.onerror=()=>{if(cleanup){cleanup.hidden=false;cleanup.textContent='旧更新缓存未能清理，可关闭旧设置页后重试；新版不会使用这些缓存。';}};
    }catch{if(cleanup){cleanup.hidden=false;cleanup.textContent='旧更新缓存暂未清理；新版已移除目录读写和自动安装功能。';}}
  }
  (async()=>{try{const value=await chrome.storage.session.get('eh-update-autocheck');if(value['eh-update-autocheck']){await chrome.storage.session.remove('eh-update-autocheck');$('updates').scrollIntoView({block:'start'});await check.onclick();}}catch{message('无法自动检查，请点击“检查更新”。');}})();
})();
