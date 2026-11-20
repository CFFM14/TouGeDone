const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict');
const helper=fs.readFileSync('helper.js','utf8');
const gate=helper.slice(0,helper.indexOf('  let running'))+'return true;})();';
const bridge=fs.readFileSync('network-bridge.js','utf8');
function locationFor(host,path='/tasks/test'){return {hostname:host,pathname:path,origin:'https://'+host,href:'https://'+host+path};}
(async()=>{
for(const host of ['www.educoder.net','educoder.net','trustie.educoder.net','example.com'])for(const path of ['/tasks/test','/classrooms/test']){
let alerted=false;const accepted=vm.runInNewContext(gate,{location:locationFor(host,path),document:{getElementById:()=>null},alert:()=>{alerted=true;}});assert.equal(accepted===true,host!=='example.com'&&path.startsWith('/tasks/'));assert.equal(alerted,accepted!==true);
}
for(const host of ['www.educoder.net','educoder.net','trustie.educoder.net']){
const doc=new EventTarget(),events=[];doc.addEventListener('eh-network-result',e=>events.push(JSON.parse(e.detail)));
const fake=async input=>{const url=typeof input==='string'?input:input.url;return {ok:true,clone:()=>({json:async()=>({})}),json:async()=>({status:0,data:{list:[{query_index:2,created_at:'now',output_detail:'评测通过'}]}})};};
const ctx={window:{fetch:fake},location:locationFor(host),document:doc,URL,Request,CustomEvent,AbortController,setTimeout,clearTimeout};vm.runInNewContext(bridge,ctx);
for(const origin of ['https://data.educoder.net','https://'+host]){
events.length=0;await ctx.window.fetch(origin+'/api/tasks/test/evaluate_logs.json');doc.dispatchEvent(new CustomEvent('eh-network-request',{detail:JSON.stringify({op:'records',task:'test',id:origin})}));await new Promise(setImmediate);assert.equal(events.find(e=>e.kind==='reply')?.record?.index,2);
await ctx.window.fetch(origin+'/api/tasks/test/choose_build.json',{method:'POST'});await new Promise(setImmediate);assert.equal(events.filter(e=>e.kind==='build-start').length,1);assert.equal(events.find(e=>e.kind==='build-end')?.ok,true);
}
events.length=0;await ctx.window.fetch('https://example.com/api/tasks/test/choose_build.json');await new Promise(setImmediate);assert.equal(events.length,0);
}
console.log('通过：6 个受支持的域名/接口组合；主站及 trustie 答题页准入；非答题页和外站排除。');
})().catch(e=>{console.error(e);process.exitCode=1});
