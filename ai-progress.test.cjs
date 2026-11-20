const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict');
const source=fs.readFileSync('helper.js','utf8'),start=source.indexOf('    const requestId=crypto.randomUUID();'),end=source.indexOf('    if(!result?.ok)',start),code='(async()=>{'+source.slice(start,end)+'return result;})()';
function fixture(){const listeners=new Set(),statuses=[];let resolve,reject;const ctx={page:'https://www.educoder.net/tasks/a',location:{href:'https://www.educoder.net/tasks/a'},stopped:false,closed:false,input:{task:'mock'},crypto:{randomUUID:()=> 'request-1'},status:text=>statuses.push(text),chrome:{runtime:{id:'extension',onMessage:{addListener:f=>listeners.add(f),removeListener:f=>listeners.delete(f)},sendMessage:message=>{assert.equal(message.requestId,'request-1');return new Promise((yes,no)=>{resolve=yes;reject=no;});}}}};
 const result=vm.runInNewContext(code,ctx);return {ctx,listeners,statuses,result,resolve:value=>resolve(value),reject:error=>reject(error),send(extra={},sender={id:'extension'}){for(const listener of listeners)listener({type:'eh-ai-progress',requestId:'request-1',url:ctx.page,attempt:2,maxAttempts:3,reason:'JSON无效',...extra},sender);}};
}
(async()=>{
 const f=fixture();assert.equal(f.listeners.size,1);f.send({requestId:'other'});f.send({url:'https://www.educoder.net/tasks/b'});f.send({}, {id:'other'});assert.equal(f.statuses.length,0);
 f.ctx.stopped=true;f.send();f.ctx.stopped=false;f.ctx.closed=true;f.send();f.ctx.closed=false;f.ctx.location.href+='?changed';f.send();assert.equal(f.statuses.length,0);f.ctx.location.href=f.ctx.page;
 f.send();assert.match(f.statuses[0],/2\/3/);f.resolve({ok:true});await f.result;assert.equal(f.listeners.size,0);f.send();assert.equal(f.statuses.length,1);
 const failed=fixture();failed.reject(Error('connection closed'));await assert.rejects(failed.result,/closed/);assert.equal(failed.listeners.size,0);
 console.log('通过：AI纠正进度只影响同一扩展、同一页面、同一次请求；停止/关闭/跳关后忽略，成功失败均清理监听。');
})().catch(e=>{console.error(e);process.exitCode=1;});
