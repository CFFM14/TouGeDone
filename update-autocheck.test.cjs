const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict');
let time=1000000,version='2.10.0',checks=0,fail=false,opened=0,keyReads=0;
const memory={},announcements=[];let result={state:'available',current:version,latest:'3.0.0',url:'https://github.com/CFFM14/TouGeDone/releases/download/v3.0.0/TouGeDone-v3.0.0.zip',notes:'public notes'};
class Clock extends Date{static now(){return time;}}
function worker(){const handlers=[],event={addListener(){}};
 const chrome={runtime:{getManifest:()=>({version}),getURL:p=>'chrome-extension://test/'+p,onMessage:{addListener:f=>handlers.push(f)},openOptionsPage:async()=>opened++},action:{onClicked:event},tabs:{onUpdated:event,onRemoved:event,query:async()=>[{id:1,url:'https://www.educoder.net/tasks/a'},{id:2,url:'https://trustie.educoder.net/tasks/b'},{id:3,url:'https://example.com'}],sendMessage:async(id,message)=>announcements.push({id,message}),create:async()=>opened++},storage:{local:{setAccessLevel:async()=>{},get:async()=>{keyReads++;return{};}},session:{get:async key=>({[key]:memory[key]}),set:async values=>Object.assign(memory,values)}}};
 vm.runInNewContext(fs.readFileSync('background.js','utf8'),{chrome,URL,Date:Clock,console,importScripts(){},EhUpdate:{check:async()=>{checks++;if(fail)throw Error('offline');return result;}}});
 const handler=handlers.find(f=>String(f).includes('eh-update-status'));
 return (type,settings=false,extra={},url)=>new Promise(resolve=>{const sender=settings?{url:chrome.runtime.getURL('options.html')}:{tab:{id:1},url:url||'https://www.educoder.net/tasks/a'};if(handler({type,...extra},sender,resolve)!==true)resolve(null);});
}
(async()=>{
 let send=worker();const replies=await Promise.all([send('eh-update-status'),send('eh-update-status')]);assert.equal(checks,1);assert.ok(replies.every(r=>r.ok&&r.available&&r.latest==='3.0.0'));assert.equal('url' in replies[0],false);assert.equal('notes' in replies[0],false);assert.deepEqual(announcements.map(a=>a.id),[1,2]);
 await send('eh-update-status');assert.equal(checks,1);
 send=worker();assert.equal((await send('eh-update-status')).available,true);assert.equal(checks,1,'缓存应跨后台重启复用');
 fail=true;time+=1000;assert.equal((await send('eh-update-check',true)).ok,false);assert.equal(checks,2);
 const stale=await send('eh-update-status');assert.equal(stale.ok,false);assert.equal(stale.available,true);assert.equal(stale.stale,true);assert.equal(checks,2,'失败后一分钟内避免重复请求');
 fail=false;time+=61000;assert.equal((await send('eh-update-status')).ok,true);assert.equal(checks,3);
 result={state:'current',current:version,latest:version};await send('eh-update-check',true);assert.equal(checks,4);assert.equal(announcements.at(-1).message.available,false);
 await send('eh-update-check',true,{force:false});assert.equal(checks,4);time+=300001;await send('eh-update-status');assert.equal(checks,5);
 version='3.0.0';result={state:'current',current:version,latest:version};send=worker();assert.equal((await send('eh-update-status')).available,false);assert.equal(checks,6,'已安装版本变化时旧缓存应失效');
 assert.equal(await send('eh-update-status',false,{},'https://evil.example/tasks/a'),null);assert.equal(await send('eh-update-download'),null);assert.equal(await send('eh-update-check'),null);
 await send('eh-ai-settings',false,{updates:true});assert.equal(memory['eh-update-autocheck'],true);assert.equal(opened,1);
 assert.equal(keyReads,0);assert.equal(checks,6);
 console.log('通过：使用时自动检查、并发合并、成功五分钟/失败一分钟缓存、后台重启复用、失败保留已知红点、手动强制检查与广播清除、升级后缓存失效及来源限制；不读取密钥。');
})().catch(e=>{console.error(e);process.exitCode=1;});
