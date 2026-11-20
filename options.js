const $=id=>document.getElementById(id);
const show=(text,tone='info')=>{$('status').textContent=text;$('status').dataset.tone=tone;};
(async()=>{try{const {deepseekConfig:config}=await chrome.storage.local.get('deepseekConfig');$('model').value='deepseek-flash';$('key').placeholder=config?.key?'已保存密钥；留空即可保留':'填写 DeepSeek API Key';show(config?.key?'密钥已保存，可以返回答题页点击“开始”。':'请填写 API Key，然后点击“保存设置”。',config?.key?'success':'info');}catch{show('无法读取配置，请重新加载扩展后重试。','error');}})();
$('save').onclick=async()=>{try{const {deepseekConfig:old}=await chrome.storage.local.get('deepseekConfig');const key=$('key').value.trim()||old?.key;if(!key)throw Error('请先填写 DeepSeek API Key。');await chrome.storage.local.set({deepseekConfig:{key,model:'deepseek-flash'}});$('key').value='';$('key').placeholder='已保存密钥；留空即可保留';show('已保存。返回答题页，点击助手中的“开始”即可。','success');}catch(error){show(error.message,'error');}};
$('clear').onclick=async()=>{try{await chrome.storage.local.remove('deepseekConfig');$('key').value='';$('key').placeholder='填写 DeepSeek API Key';show('密钥已清除。编程题和混合模式需重新配置。');}catch{show('清除失败，请重试。','error');}};
$('test').onclick=async()=>{const button=$('test');button.disabled=true;show('正在测试连接…请先保存配置。');try{const result=await chrome.runtime.sendMessage({type:'eh-ai-test'});if(!result?.ok)throw Error(result?.error||'连接失败。');show('连接成功，可以返回答题页开始使用。','success');}catch(error){show(error.message,'error');}finally{button.disabled=false;}};
$('return').onclick=async()=>{try{
 const supported=url=>/^https:\/\/(?:www\.)?educoder\.net\/tasks\/|^https:\/\/trustie\.educoder\.net\/tasks\//.test(url||'');
 const saved=await chrome.storage.session.get('eh-options-source');let tab;
 if(Number.isInteger(saved['eh-options-source']))try{tab=await chrome.tabs.get(saved['eh-options-source']);if(!supported(tab.url))tab=null;}catch{}
 if(!tab){const tabs=await chrome.tabs.query({currentWindow:true});tab=tabs.filter(t=>supported(t.url)).sort((a,b)=>(b.lastAccessed||0)-(a.lastAccessed||0))[0];}
 if(!tab)throw Error('没有找到答题标签页，请先打开头歌题目页面。');
 await chrome.tabs.update(tab.id,{active:true});await chrome.windows.update(tab.windowId,{focused:true});
 }catch(error){show(error.message,'error');}};
