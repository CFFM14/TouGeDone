// Runs only in the extension settings page; installed code is never eval'd.
globalThis.EhDirectoryUpdate = (() => {
  const names = ['manifest.json','background.js','bootstrap.js','context-utils.js','solution-policy.js','source-session.js','choice-batch.js','panel-ui.js','network-bridge.js','editor-bridge.js','page-controls.js','program-runner.js','helper.js','ai-service.js','update-service.js','directory-update.js','options.html','options.js','update-options.js','README.md','使用说明.md','版本更新记录.md','icons/icon16.png','icons/icon32.png','icons/icon48.png','icons/icon128.png'];
  const marker = 'tougedone-install-binding.json';
  const hash = async bytes => Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',bytes)), n=>n.toString(16).padStart(2,'0')).join('');
  async function file(root,path,create=false) {
    const parts=path.split('/');let parent=root;
    for(const part of parts.slice(0,-1))parent=await parent.getDirectoryHandle(part,{create});
    return parent.getFileHandle(parts.at(-1),{create});
  }
  async function read(root,path) {try{return new Uint8Array(await (await (await file(root,path)).getFile()).arrayBuffer());}catch(e){if(e.name==='NotFoundError')return null;throw e;}}
  async function write(root,path,bytes) {const stream=await (await file(root,path,true)).createWritable();try{await stream.write(bytes);await stream.close();}catch(e){try{await stream.abort();}catch{}throw e;}}
  async function remove(root,path) {const parts=path.split('/');let parent=root;for(const part of parts.slice(0,-1))parent=await parent.getDirectoryHandle(part);try{await parent.removeEntry(parts.at(-1));}catch(e){if(e.name!=='NotFoundError')throw e;}}
  async function store(key,value) {
    const db=await new Promise((resolve,reject)=>{const req=indexedDB.open('tougedone-updater',1);req.onupgradeneeded=()=>req.result.createObjectStore('state');req.onsuccess=()=>resolve(req.result);req.onerror=()=>reject(req.error);});
    try{return await new Promise((resolve,reject)=>{const tx=db.transaction('state',value===undefined?'readonly':'readwrite'),s=tx.objectStore('state'),req=value===undefined?s.get(key):value===null?s.delete(key):s.put(value,key);let result;req.onsuccess=()=>{result=req.result;};tx.oncomplete=()=>resolve(result);tx.onerror=tx.onabort=()=>reject(tx.error||Error('无法保存更新恢复记录。'));});}finally{db.close();}
  }
  async function permission(root,request=false) {if(await root.queryPermission({mode:'readwrite'})==='granted')return; if(request&&await root.requestPermission({mode:'readwrite'})==='granted')return;throw Error('请点击“一键更新”，允许浏览器读写已选择的插件目录。');}
  async function bind(root,runtime) {
    const bytes=await read(root,'manifest.json');if(!bytes)throw Error('请选择包含 manifest.json 的插件目录。');
    const manifest=JSON.parse(new TextDecoder().decode(bytes));
    if(manifest.name!==runtime.getManifest().name||manifest.version!==runtime.getManifest().version)throw Error('目录名称或版本与当前加载的插件不一致，请选择原加载目录。');
    const old=await read(root,marker),nonce=crypto.randomUUID();
    try{
      await write(root,marker,new TextEncoder().encode(JSON.stringify({nonce})));
      const response=await fetch(runtime.getURL(marker)+'?binding='+nonce,{cache:'no-store'});
      if(!response.ok||(await response.json()).nonce!==nonce)throw Error('不是当前加载的插件目录，请在扩展详情中核对路径。');
    }finally{if(old)await write(root,marker,old);else await remove(root,marker);}
    await store('directory',root);
  }
  async function validate(bundle,version,installed) {
    if(bundle?.format!==1||bundle.version!==version||!Array.isArray(bundle.files)||bundle.files.length!==names.length)throw Error('更新包格式或文件数量不正确。');
    const result=[],seen=new Set();let size=0;
    for(const item of bundle.files){
      if(!names.includes(item.path)||seen.has(item.path)||typeof item.data!=='string'||item.data.length>4e6)throw Error('更新包包含非法或重复文件。');
      seen.add(item.path);const bytes=Uint8Array.from(atob(item.data),c=>c.charCodeAt(0));size+=bytes.length;
      if(size>12e6||await hash(bytes)!==item.sha256)throw Error('更新文件校验失败。');result.push({path:item.path,bytes});
    }
    const manifest=JSON.parse(new TextDecoder().decode(result.find(f=>f.path==='manifest.json').bytes));
    if(manifest.version!==version||manifest.name!==installed.name||manifest.manifest_version!==3)throw Error('更新包身份不正确。');
    // A browser review is required for new permissions, rather than silently expanding access.
    for(const key of ['permissions','host_permissions','optional_permissions','optional_host_permissions'])if((manifest[key]||[]).some(p=>!(installed[key]||[]).includes(p)))throw Error('新版增加了权限，请使用安装包手动更新并在浏览器中确认。');
    const runtimeFiles=[manifest.background?.service_worker,...(manifest.content_scripts||[]).flatMap(s=>s.js||[]),...Object.values(manifest.icons||{}),manifest.options_page];
    if(runtimeFiles.some(p=>!seen.has(p)))throw Error('更新包缺少运行文件。');
    return result.sort((a,b)=>(a.path==='manifest.json')-(b.path==='manifest.json'));
  }
  async function rollback(root,journal) {for(const entry of [...journal.files].reverse()){if(entry.bytes===null)await remove(root,entry.path);else await write(root,entry.path,entry.bytes);}}
  async function install(root,files,version,save=store) {
    const journal={version,files:[]};
    for(const entry of files)journal.files.push({path:entry.path,bytes:await read(root,entry.path)});
    await save('journal',journal); // Durable backup before the first mutation.
    try{for(const entry of files)await write(root,entry.path,entry.bytes);for(const entry of files)if(await hash(await read(root,entry.path))!==await hash(entry.bytes))throw Error('写入后文件校验失败。');await save('completed',version);}
    catch(error){try{await rollback(root,journal);await save('journal',null);await save('completed',null);}catch{throw Error('更新中断，恢复记录已保留。请点击“恢复更新前文件”，暂勿重新加载插件。');}throw Error('更新失败，已恢复原文件：'+error.message);}
  }
  return {names,hash,read,write,store,permission,bind,validate,install,rollback};
})();
