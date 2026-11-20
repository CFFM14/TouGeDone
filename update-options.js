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
        message('发现新版 v'+result.latest+'。可点击“一键更新”，或下载后手动覆盖原目录。');download.hidden=false;download.textContent='下载 v'+result.latest;
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

(() => {
  const D=globalThis.EhDirectoryUpdate;if(!D)return;
  const $=id=>document.getElementById(id),folder=$('update-folder'),install=$('update-install'),restore=$('update-restore');
  const message=text=>{$('update-status').textContent=text;};
  let busy=false;
  const lock=value=>{busy=value;for(const id of ['update-folder','update-install','update-restore','update-check','update-download'])$(id).disabled=value;};
  async function exclusive(action){
    if(busy)return;
    lock(true);
    try{await navigator.locks.request('tougedone-install',{ifAvailable:true},async token=>{if(!token)throw Error('另一设置页正在更新，请稍后重试。');await action();});}
    catch(e){message(e.name==='AbortError'?'已取消目录选择。':e.message);}finally{lock(false);}
  }
  async function result(type){const response=await chrome.runtime.sendMessage({type});if(!response?.ok)throw Error(response?.error||'无法连接插件，请重新加载。');return response;}
  folder.onclick=()=>{
    // Open the native chooser directly in the click event, while user activation exists.
    if(busy)return;
    if(typeof showDirectoryPicker!=='function'){message('当前浏览器不支持目录授权，请下载 ZIP 手动更新。');return;}
    const choice=showDirectoryPicker({id:'tougedone-install',mode:'readwrite'});
    choice.catch(()=>{});
    return exclusive(async()=>{const root=await choice;if(await D.store('journal'))throw Error('请先恢复上次中断的更新，再更换目录。');await D.bind(root,chrome.runtime);folder.textContent='已授权：'+root.name;message('目录验证成功。以后点击“一键更新”即可；浏览器可能再次询问权限。');});
  };
  install.onclick=()=>{
    if(busy)return;
    // Permission must be requested from this user gesture, before network work.
    const ready=(async()=>{const root=await D.store('directory');if(!root)throw Error('首次使用请先点“选择插件目录”，选中 Edge 加载的原文件夹。');await D.permission(root,true);return root;})();
    ready.catch(()=>{});
    return exclusive(async()=>{
      const root=await ready;
      if(await D.store('journal'))throw Error('上次更新未完成，请先点击“恢复更新前文件”。');
      message('正在检查最新正式版…');const release=await result('eh-update-check');
      if(release.state!=='available'){message('当前已是最新正式版，暂无需要安装的更新。');return;}
      if(!release.bundle)throw Error('这个版本没有一键更新包，请点击“下载新版”手动更新。');
      await D.bind(root,chrome.runtime);
      message('正在下载并校验 v'+release.latest+'，请保持设置页打开…');
      const response=await fetch(release.bundle.url,{credentials:'omit',referrerPolicy:'no-referrer',cache:'no-store',signal:AbortSignal.timeout(90000)});
      if(!response.ok)throw Error('下载更新失败（HTTP '+response.status+'）。');
      const finalURL=new URL(response.url);if(finalURL.protocol!=='https:'||!['github.com','release-assets.githubusercontent.com'].includes(finalURL.hostname))throw Error('下载重定向地址无效。');
      const reader=response.body.getReader(),chunks=[];let total=0;
      while(true){const {done,value}=await reader.read();if(done)break;total+=value.length;if(total>16e6){await reader.cancel();throw Error('更新包过大，已取消。');}chunks.push(value);}
      const bytes=new Uint8Array(total);let offset=0;for(const chunk of chunks){bytes.set(chunk,offset);offset+=chunk.length;}
      if(await D.hash(bytes)!==release.bundle.digest)throw Error('更新包 SHA-256 校验失败，未改动任何文件。');
      const files=await D.validate(JSON.parse(new TextDecoder().decode(bytes)),release.latest,chrome.runtime.getManifest());
      try{
        await result('eh-update-prepare');message('正在备份并安装，请勿关闭此页…');
        await D.install(root,files,release.latest);
      }finally{await result('eh-update-finish').catch(()=>{});}
      message('v'+release.latest+' 已写入并校验，正在重新加载插件。完成后请刷新答题页。');
      chrome.runtime.reload();
    }).finally(async()=>{restore.hidden=!await D.store('journal');});
  };
  restore.onclick=()=>{
    if(busy)return;
    const ready=(async()=>{const root=await D.store('directory');if(!root)throw Error('找不到已授权的目录。');await D.permission(root,true);return root;})();
    ready.catch(()=>{});
    return exclusive(async()=>{const root=await ready,journal=await D.store('journal');if(!journal){restore.hidden=true;return;}
      try{await result('eh-update-prepare');await D.rollback(root,journal);await D.store('journal',null);await D.store('completed',null);restore.hidden=true;message('已恢复更新前文件。请重新加载插件，再刷新答题页。');}finally{await result('eh-update-finish').catch(()=>{});}
    });
  };
  (async()=>{try{
    const root=await D.store('directory');if(root)folder.textContent='已选择：'+root.name;
    const completed=await D.store('completed'),journal=await D.store('journal');
    if(completed===chrome.runtime.getManifest().version){await D.store('journal',null);await D.store('completed',null);message('更新完成：v'+completed+' 已加载。请刷新答题页继续使用。');}
    else if(journal){restore.hidden=false;message('检测到上次更新中断。请先恢复更新前文件，再重新尝试。');}
  }catch(e){message('无法读取更新设置：'+e.message);}})();
})();
