const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict');
const handlers=[],flags=new Map(),event={addListener(){}};let running=false,inaccessible=false;
const chrome={runtime:{onMessage:{addListener:f=>handlers.push(f)},getURL:p=>'chrome-extension://test/'+p},action:{onClicked:event},tabs:{onUpdated:event,onRemoved:event,query:async()=>[{id:1,url:'https://www.educoder.net/tasks/a'},{id:2,url:'https://trustie.educoder.net/tasks/b'},{id:3,url:'https://example.com'}]},storage:{local:{setAccessLevel:async()=>{}}},scripting:{executeScript:async({target,args:[busy]})=>{if(target.tabId===1&&inaccessible)throw Error('tab closed');if(target.tabId===2&&busy&&running)return [{result:false}];flags.set(target.tabId,busy);return [{result:true}];}}};
vm.runInNewContext(fs.readFileSync('background.js','utf8'),{chrome,URL,console,importScripts(){}});
const handler=handlers.find(f=>String(f).includes('eh-update-prepare'));
const send=(type,sender={url:chrome.runtime.getURL('options.html')})=>new Promise(resolve=>{if(handler({type},sender,resolve)!==true)resolve(null);});
(async()=>{
 assert.equal(await send('eh-update-prepare',{url:'https://www.educoder.net/tasks/a',tab:{id:1}}),null);
 running=true;assert.equal((await send('eh-update-prepare')).ok,false);await send('eh-update-finish');assert.ok([...flags.values()].every(v=>v===false));
 running=false;assert.equal((await send('eh-update-prepare')).ok,true);assert.deepEqual([...flags.keys()],[1,2]);assert.ok([...flags.values()].every(Boolean));
 inaccessible=true;assert.equal((await send('eh-update-finish')).ok,true);assert.equal(flags.get(2),false);
 console.log('通过：更新前检查所有答题标签、运行中拒绝、非答题页不注入、普通网页无权锁定、异常后解锁逐页执行不因关页中断。');
})().catch(e=>{console.error(e);process.exitCode=1;});
