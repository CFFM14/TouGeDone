const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict');const ctx={};vm.runInNewContext(fs.readFileSync('program-runner.js','utf8'),ctx);
(async()=>{
let time=0,calls=0,active=0,max=0;const starts=[],feedbacks=[],deadlines=[];let stop=false;
const result=await ctx.EhProgrammingRun({maxAttempts:5,now:()=>time,sleep:async ms=>{time+=ms},isStopped:()=>stop,status:()=>{},saveCooldown:t=>deadlines.push(t),generate:async feedback=>{feedbacks.push(feedback);time+=2000;return {code:'trial'}},evaluate:async()=>{starts.push(time);max=Math.max(max,++active);time+=1200;active--;return ++calls>=3?{passed:true}:{passed:false,feedback:'编译错误 '+calls};}});
assert.equal(result.attempts,3);assert.ok(starts[1]-starts[0]>=32200);assert.ok(starts[2]-starts[1]>=32200);assert.equal(max,1);assert.equal(feedbacks[1],'编译错误 1');assert.equal(deadlines.at(-1),0);
let generated=0,evaluated=0;await assert.rejects(ctx.EhProgrammingRun({maxAttempts:1,isStopped:()=>false,status:()=>{},generate:async()=>{generated++;return{}},evaluate:async()=>{evaluated++;return {passed:false,feedback:'失败'}}}),/重试上限/);assert.equal(generated,1);assert.equal(evaluated,1);
let stopped=false,evals=0;await assert.rejects(ctx.EhProgrammingRun({nextAllowed:10000,now:()=>0,sleep:async()=>{stopped=true},isStopped:()=>stopped,status:()=>{},generate:async()=>({}),evaluate:async()=>{evals++;return{passed:true}}}),/停止/);assert.equal(evals,0);
console.log('通过：失败后从最终结果起至少31秒再评测、反馈修复、单次在途、重试上限、冷却中停止不提交。');
})().catch(e=>{console.error(e);process.exitCode=1});
