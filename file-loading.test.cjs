const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict');
async function run({delay=0,same=true,empty=false,forever=false,changeUrl=false,cancel=false}={}){
 let time=0,clicks=0;const target='src/Main.java',code=empty?'':'class Main {\n}\n';
 const location={href:'https://trustie.educoder.net/tasks/test'};
 const data={currentPath:same?target:'src/A.java',paths:[target,'src/A.java'],get content(){return code.replace(/\n/g,'\r\n');}};
 const props={taskData:{game:{},test_sets:[]},evaluateLoading:false,codeRepData:data,get codeLoading(){return forever||time<delay;}};
 const node={getClientRects:()=>[1],__reactFiberTest:{memoizedProps:props}};
 const row={getClientRects:()=>[1],__reactFiberTest:{memoizedProps:{data:{path:target}}},querySelector:()=>({click:()=>{clicks++;data.currentPath=target;}})};
 const model={uri:'inmemory://model/1',getValue:()=>code,getLanguageId:()=> 'java'};
 const editor={getModel:()=>model,getDomNode:()=>node,getRawOptions:()=>({readOnly:true}),hasTextFocus:()=>true};
 const doc=new EventTarget();doc.querySelectorAll=s=>s==='[role=treeitem]'?[row]:[node];doc.querySelector=()=>null;
 const ctx={window:{monaco:{editor:{getEditors:()=>[editor]}}},document:doc,location,CustomEvent,Date:class extends Date{static now(){return time;}},setTimeout:fn=>{time+=100;if(changeUrl&&time>=500)location.href+='changed';if(cancel&&time>=500)doc.dispatchEvent(new CustomEvent('eh-editor-v5-request',{detail:JSON.stringify({id:'open',op:'cancel',url:location.href})}));queueMicrotask(fn);}};
 vm.runInNewContext(fs.readFileSync('solution-policy.js','utf8')+fs.readFileSync('editor-bridge.js','utf8'),ctx);
 const result=await new Promise(resolve=>{doc.addEventListener('eh-editor-v5-result',e=>resolve(JSON.parse(e.detail)),{once:true});doc.dispatchEvent(new CustomEvent('eh-editor-v5-request',{detail:JSON.stringify({id:'open',op:'open',path:target,url:location.href})}));});
 return {result,time,clicks};
}
(async()=>{
 let r=await run();assert.equal(r.result.ok,true);assert.equal(r.clicks,0,'already selected path must not be toggled');
 r=await run({delay:12000});assert.equal(r.result.ok,true);assert.ok(r.time>=12300);assert.equal(r.clicks,0);
 r=await run({delay:12000,same:false});assert.equal(r.result.ok,true);assert.equal(r.clicks,1);
 r=await run({empty:true});assert.equal(r.result.ok,true);assert.ok(r.time>=300,'empty source still needs stable confirmation');
 r=await run({forever:true});assert.equal(r.result.ok,false);assert.match(r.result.error,/30秒/);assert.equal(r.clicks,0);
 r=await run({delay:12000,changeUrl:true});assert.equal(r.result.ok,false);assert.match(r.result.error,/关卡已变化/);
 r=await run({delay:12000,cancel:true});assert.equal(r.result.ok,false);assert.match(r.result.error,/取消/);assert.ok(r.time<12000);assert.equal(r.clicks,0);
 console.log('通过：trustie页面文件读取、CRLF/LF匹配、12秒慢加载、只点击新路径一次、空文件稳定等待、30秒超时和跳关停止。');
})().catch(e=>{console.error(e);process.exitCode=1;});
