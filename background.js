importScripts('context-utils.js','solution-policy.js','ai-service.js','update-service.js');
chrome.storage.local.setAccessLevel({accessLevel:'TRUSTED_CONTEXTS'}).catch(console.error);
const supportedPage = value => {
  try { const url = new URL(value); return url.protocol === 'https:' && ['www.educoder.net','educoder.net','trustie.educoder.net'].includes(url.hostname) && url.pathname.startsWith('/tasks/'); }
  catch { return false; }
};
const keyFor = tabId => 'panel:' + tabId;
const injections = new Map();
async function inject(tabId, restore = false) {
  if (injections.has(tabId)) return injections.get(tabId);
  const pending = (async () => {
    await chrome.scripting.executeScript({target:{tabId},world:'MAIN',files:['context-utils.js','solution-policy.js','network-bridge.js','editor-bridge.js']});
    await chrome.scripting.executeScript({target:{tabId},func:restore => {
      globalThis.__ehBootstrap = restore;
      globalThis.__ehRestorePanel = restore;
      if(!restore)try{sessionStorage.removeItem('educoder-helper-dismissed-v1');}catch{}
    },args:[restore]});
    await chrome.scripting.executeScript({target:{tabId},files:['context-utils.js','solution-policy.js','source-session.js','choice-batch.js','panel-ui.js','page-controls.js','program-runner.js','helper.js']});
  })();
  injections.set(tabId, pending);
  try { await pending; } finally { injections.delete(tabId); }
}
chrome.action.onClicked.addListener(async tab => {
  if (!tab.id) return;
  try {
    if (supportedPage(tab.url)) await chrome.storage.session.set({[keyFor(tab.id)]:true});
    await inject(tab.id);
    await chrome.action.setBadgeText({tabId:tab.id,text:''});
  } catch (error) {
    console.error('无法打开助手', error);
    await chrome.action.setBadgeText({tabId:tab.id,text:'!'});
    await chrome.action.setTitle({tabId:tab.id,title:'请在头歌答题页打开助手；扩展更新后请刷新页面。'});
  }
});
chrome.runtime.onMessage.addListener((message, sender) => {
  const tabId = sender.tab?.id;
  if (!tabId || !supportedPage(sender.url)) return;
  if (message.type === 'eh-panel-open') chrome.storage.session.set({[keyFor(tabId)]:true}).catch(console.error);
  if (message.type === 'eh-panel-close') chrome.storage.session.remove(keyFor(tabId)).catch(console.error);
});
chrome.tabs.onUpdated.addListener(async (tabId, change, tab) => {
  if(change.url)aiRequests.get(tabId)?.abort();
  if (!change.url && change.status !== 'complete') return;
  if (!supportedPage(tab.url)) return;
  try {
    const state = await chrome.storage.session.get(keyFor(tabId));
    if (state[keyFor(tabId)]) await inject(tabId, true);
  } catch (error) {
    // A rapid redirect can destroy the old document; the completed page retries.
    console.debug('等待答题页完成加载', error);
  }
});
chrome.tabs.onRemoved.addListener(tabId => {
  chrome.storage.session.remove(keyFor(tabId)).catch(console.error);
});

const aiRequests = new Map();
let updateRequest=null,releaseState=null;
const releaseStateKey='eh-release-state';
const releaseNotice=()=>{
  const current=chrome.runtime.getManifest().version,state=releaseState?.version===current?releaseState:null;
  const available=state?.result?.state==='available';
  return {current,available,latest:available?state.result.latest:null,checkedAt:state?.at||0,stale:!!state?.error};
};
const announceRelease=async()=>{
  if(!chrome.tabs.query||!chrome.tabs.sendMessage)return;
  try{const tabs=(await chrome.tabs.query({})).filter(tab=>supportedPage(tab.url));await Promise.allSettled(tabs.map(tab=>chrome.tabs.sendMessage(tab.id,{type:'eh-update-notice',...releaseNotice()})));}catch{}
};
const checkRelease=async(force=true)=>{
  const version=chrome.runtime.getManifest().version;
  try{
    const stored=(await chrome.storage.session.get(releaseStateKey))[releaseStateKey];
    if(stored?.version===version&&(!releaseState||releaseState.version!==version||stored.at>releaseState.at))releaseState=stored;
  }catch{}
  if(updateRequest)return updateRequest;
  const prior=releaseState?.version===version?releaseState:null,age=Date.now()-(prior?.at||0);
  if(!force&&prior&&age>=0&&age<(prior.error?60000:300000)){
    if(prior.error)throw Error(prior.error);
    return prior.result;
  }
  updateRequest=(async()=>{
    try{
      const result=await EhUpdate.check(version);
      releaseState={version,at:Date.now(),result};
      return result;
    }catch(error){releaseState={version,at:Date.now(),result:prior?.result||null,error:error.message};throw error;}
    finally{
      try{await chrome.storage.session.set({[releaseStateKey]:releaseState});}catch{}
      await announceRelease();
    }
  })().finally(()=>{updateRequest=null;});
  return updateRequest;
};
chrome.runtime.onMessage.addListener((message, sender, reply) => {
  const fromTask = sender.tab?.id && supportedPage(sender.url);
  const fromSettings = sender.url === chrome.runtime.getURL('options.html');
  if(message.type==='eh-update-status'&&fromTask){
    checkRelease(false).then(()=>reply({ok:true,...releaseNotice()}),error=>reply({ok:false,error:error.message,...releaseNotice()}));return true;
  }
  if(fromSettings&&['eh-update-check','eh-update-download'].includes(message.type)){
    (async()=>{const result=await checkRelease(message.type==='eh-update-download'||message.force!==false);
      if(message.type==='eh-update-download'){
        if(result.state!=='available')throw Error('目前没有可下载的更新，请先检查版本。');
        await chrome.tabs.create({url:result.url});return {state:'download_opened',latest:result.latest};
      }
      return result;
    })().then(result=>reply({ok:true,...result}),error=>reply({ok:false,error:error.name==='TimeoutError'?'检查更新超时，请稍后重试。':'更新失败：'+error.message}));return true;
  }
  if(message.type==='eh-ai-status'&&fromTask){
    chrome.storage.local.get('deepseekConfig').then(({deepseekConfig:config})=>reply({ok:true,configured:typeof config?.key==='string'&&!!config.key.trim()}),()=>reply({ok:false,error:'无法读取密钥配置，请重新加载扩展。'}));
    return true;
  }
  if (message.type === 'eh-ai-settings' && fromTask) { chrome.storage.session.set({'eh-options-source':sender.tab.id,'eh-update-autocheck':message.updates===true}).then(()=>chrome.runtime.openOptionsPage()).catch(console.error); return; }
  if (message.type === 'eh-ai-cancel' && fromTask) { aiRequests.get(sender.tab.id)?.abort(); return; }
  if (!((message.type === 'eh-ai-generate' && fromTask) || (message.type === 'eh-ai-test' && fromSettings))) return;
  (async () => {
    const {deepseekConfig:config} = await chrome.storage.local.get('deepseekConfig');
    if (!config?.key) throw Error('请先保存 DeepSeek API Key。');
    if (message.type === 'eh-ai-test') {
      const response = await fetch('https://api.deepseek.com/models',{headers:{Authorization:'Bearer '+config.key},signal:AbortSignal.timeout(20000)});
      if (!response.ok) throw Error('连接失败（HTTP '+response.status+'），请检查 Key 和账户余额。');
      const data = await response.json();
      return {models:(data.data||[]).map(item=>item.id).filter(id=>typeof id==='string').slice(0,30)};
    }
    const id=sender.tab.id;
    if (aiRequests.has(id)) throw Error('本标签页已有 AI 请求，请等待或停止。');
    const controller=new AbortController(); aiRequests.set(id,controller);
    const timer=setTimeout(()=>controller.abort(),180000);
    try { return await EhAI.generate(config,message.input,{signal:controller.signal,onRetry:progress=>chrome.tabs.sendMessage(id,{type:'eh-ai-progress',requestId:message.requestId,url:sender.url,...progress}).catch(()=>{})}); }
    finally {clearTimeout(timer);aiRequests.delete(id);}
  })().then(result=>reply({ok:true,...result}),error=>reply({ok:false,error:error.name==='AbortError'?'AI 请求已取消或超时。':error.message}));
  return true;
});
chrome.tabs.onRemoved.addListener(id=>aiRequests.get(id)?.abort());
