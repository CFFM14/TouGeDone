const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict');
const events={},progress=[];const event=name=>({addListener:fn=>(events[name]??=[]).push(fn)});
const chrome={runtime:{getURL:p=>'chrome-extension://test/'+p,onMessage:event('message')},action:{onClicked:event('click')},tabs:{onUpdated:event('update'),onRemoved:event('remove'),sendMessage:async(id,message)=>progress.push({id,...message})},storage:{local:{setAccessLevel:async()=>{},get:async()=>({deepseekConfig:{key:'mock-backend-secret'}})},session:{remove:async()=>{}}}};
const EhAI={generate:async(config,input,options)=>{await options.onRetry({attempt:2,maxAttempts:3,reason:'JSON无效'});await new Promise((resolve,reject)=>{const abort=()=>{const error=Error('aborted');error.name='AbortError';reject(error);};if(options.signal.aborted)abort();else options.signal.addEventListener('abort',abort,{once:true});});}};
vm.runInNewContext(fs.readFileSync('background.js','utf8'),{chrome,EhAI,AbortController,URL,console,setTimeout,clearTimeout,importScripts(){}});
const handler=events.message.find(f=>String(f).includes('eh-ai-generate')),url='https://www.educoder.net/tasks/a',sender={url,tab:{id:10}};
const send=type=>new Promise(resolve=>{if(handler({type,requestId:'request-1',input:{task:'mock'}},sender,resolve)!==true)resolve(null);});
(async()=>{
 for(const cancel of [()=>send('eh-ai-cancel'),()=>events.update[0](10,{url:'https://example.com'},{url:'https://example.com'}),()=>Promise.all(events.remove.map(f=>f(10)))]){
  const pending=send('eh-ai-generate');await new Promise(setImmediate);
  assert.deepEqual(progress.at(-1),{id:10,type:'eh-ai-progress',requestId:'request-1',url,attempt:2,maxAttempts:3,reason:'JSON无效'});
  await cancel();const result=await pending;assert.equal(result.ok,false);assert.match(result.error,/取消/);
 }
 assert.ok(!JSON.stringify(progress).includes('mock-backend-secret'));
 console.log('通过：后台补试进度带原页面/请求标识，不包含密钥；停止、跳关、关页均取消在途生成并释放请求锁。');
})().catch(e=>{console.error(e);process.exitCode=1;});
