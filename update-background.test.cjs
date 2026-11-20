const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict');
const handlers=[],opened=[];let checks=0,keyReads=0;
const event={addListener:()=>{}};
const chrome={runtime:{onMessage:{addListener:fn=>handlers.push(fn)},getURL:path=>'chrome-extension://test/'+path,getManifest:()=>({version:'2.9.0'})},action:{onClicked:event},tabs:{onUpdated:event,onRemoved:event,create:async value=>opened.push(value.url)},storage:{local:{setAccessLevel:async()=>{},get:async()=>{keyReads++;return {};}},session:{get:async()=>({})}}};
const EhUpdate={check:async()=>{checks++;await Promise.resolve();return {state:'available',url:'https://github.com/CFFM14/TouGeDone/releases/download/v3.0.0/TouGeDone-v3.0.0.zip'};}};
vm.runInNewContext(fs.readFileSync('background.js','utf8'),{chrome,EhUpdate,URL,console,importScripts:()=>{}});
const handler=handlers.find(fn=>String(fn).includes('eh-update-check'));
const send=(type,sender)=>new Promise(resolve=>{const keep=handler({type},sender,resolve);if(keep!==true)resolve(null);});
(async()=>{const settings={url:chrome.runtime.getURL('options.html')};const replies=await Promise.all([send('eh-update-check',settings),send('eh-update-check',settings)]);assert.equal(checks,1);assert.ok(replies.every(r=>r.ok));await send('eh-update-download',settings);assert.equal(opened.length,1);assert.equal(keyReads,0);const before=checks;for(const url of ['https://www.educoder.net/tasks/test','https://evil.example/options.html'])assert.equal(await send('eh-update-download',{url,tab:{id:1}}),null);assert.equal(checks,before);console.log('通过：仅扩展设置页可检查/下载更新，并发查询合并，普通页面不能指定或打开下载，不读取DeepSeek配置。');})().catch(e=>{console.error(e);process.exitCode=1;});
