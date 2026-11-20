const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict');
const events=[];let config={key:'never-send-this-key'},reads=0;
const event=()=>({addListener:fn=>events.push(fn)});
const chrome={runtime:{onMessage:event(),getURL:path=>'chrome-extension://test/'+path},action:{onClicked:event()},tabs:{onUpdated:event(),onRemoved:event()},storage:{local:{setAccessLevel:async()=>{},get:async()=>{reads++;return {deepseekConfig:config};}}}};
vm.runInNewContext(fs.readFileSync('background.js','utf8'),{chrome,importScripts:()=>{},URL,console});
const handler=events.find(fn=>String(fn).includes("message.type==='eh-ai-status'"));
async function status(sender){let reply;const keep=handler({type:'eh-ai-status'},sender,value=>reply=value);await new Promise(setImmediate);return {reply,keep};}
const helper=fs.readFileSync('helper.js','utf8'),start=helper.indexOf("      const mode=$('mode').value;",helper.indexOf("  $('start').onclick = async")),end=helper.indexOf('      groups = discover(); render();',start),branch=helper.slice(start,end);
(async()=>{
const sender={tab:{id:1},url:'https://trustie.educoder.net/tasks/test'};let result=await status(sender);assert.equal(result.reply.configured,true);assert.ok(!JSON.stringify(result).includes('never-send-this-key'));
config=null;result=await status(sender);assert.equal(result.reply.configured,false);const before=reads;assert.equal((await status({tab:{id:1},url:'https://example.com/tasks/test'})).reply,undefined);assert.equal(reads,before);
for(const mode of ['mixed','code']){let actions=0;await vm.runInNewContext('(async()=>{'+branch+"})()",{$:()=>({value:mode}),ensureAiConfigured:async()=>false,waitForLevel:async()=>{actions++;return false;},solveProgramming:async()=>{actions++;},chainActive:false});assert.equal(actions,0,'no page operation or generation before the key is configured');}
console.log('通过：配置检查仅返回布尔值、不暴露Key、外站无法查询、混合/编程未配置时不读取题目或生成评测。');
})().catch(e=>{console.error(e);process.exitCode=1;});
