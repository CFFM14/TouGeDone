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
        message('发现新版 v'+result.latest+'。下载后按下方步骤覆盖原目录。');download.hidden=false;download.textContent='下载 v'+result.latest;
        $('update-notes').textContent=result.notes||'';$('update-notes').hidden=!result.notes;
      }else if(result.state==='current')message('当前 v'+result.current+' 已是最新正式版。');
      else if(result.state==='no_release')message('仓库尚未发布正式安装包，请稍后再试。');
      else throw Error('更新信息无效，请稍后重试。');
    }catch(error){message(error.message);}finally{check.disabled=false;}
  };
  download.onclick=async()=>{
    check.disabled=true;download.disabled=true;message('正在打开新版安装包下载…');
    try{const result=await chrome.runtime.sendMessage({type:'eh-update-download'});if(!result?.ok)throw Error(result?.error||'无法打开下载。');message('已打开下载。下载完成后覆盖原目录，在扩展页重新加载，再刷新答题页；尚未自动安装。');}
    catch(error){message(error.message);}finally{download.disabled=false;check.disabled=false;}
  };
  (async()=>{try{const value=await chrome.storage.session.get('eh-update-autocheck');if(value['eh-update-autocheck']){await chrome.storage.session.remove('eh-update-autocheck');$('updates').scrollIntoView({block:'start'});await check.onclick();}}catch{message('无法自动检查，请点击“检查更新”。');}})();
})();
