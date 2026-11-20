const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict');
const service={};vm.runInNewContext(fs.readFileSync('choice-batch.js','utf8'),service);const B=service.EhChoiceBatch;
async function harness(truth,initial=truth.map(()=>1),{size=3,types=truth.map(()=> 'checkbox'),options=3,locked=[],stopAt,stopDuringSet=false,fault,unknown=false}={}){
 const groups=truth.map((_,i)=>({number:String(i+1),type:types[i],mask:initial[i],boxes:Array.from({length:options})}));
 const score=masks=>truth.filter((m,i)=>m!==masks[i]).length,capture=()=>groups.map(g=>g.mask);
 const baseline=[...initial],known=new Set(locked),history=[{label:'baseline',masks:[...initial],score:score(initial)}],sets=[],tried=new Map();
 let best={score:score(initial),masks:[...initial]},confirmed=[...initial],stopped=false,inFlight=0,maxInFlight=0,phase='',batch=[],round=null,faulted=false,stopUsed=false;
 const set=async(masks,recovery=false)=>{
  for(const i of known)assert.equal(masks[i],baseline[i],'a locked correct answer was changed');
  if(stopped&&!recovery)return false;
  for(let i=0;i<groups.length;i++)if(groups[i].mask!==masks[i]){groups[i].mask=masks[i];if(stopDuringSet&&phase==='parallel'&&!recovery&&!stopUsed){stopped=true;stopUsed=true;return false;}}
  sets.push({masks:capture(),recovery});return true;
 };
 const evaluate=async(label,recovery=false)=>{
  inFlight++;maxInFlight=Math.max(maxInFlight,inFlight);await Promise.resolve();inFlight--;
  const masks=capture();let result=score(masks);
  if(label.startsWith('并行 ')){
   assert.ok(batch.length>=1&&batch.length<=4);
   for(let i=0;i<groups.length;i++){
    if(batch.includes(i)){assert.ok(!known.has(i));assert.notEqual(baseline[i],truth[i],'parallel pool contained an originally correct question');assert.notEqual(masks[i],baseline[i],'a batch member was not actually changed');const seen=tried.get(i)||new Set();assert.ok(!seen.has(masks[i]),'an excluded candidate was tried again');seen.add(masks[i]);tried.set(i,seen);}
    else assert.equal(masks[i],baseline[i],'a question outside this batch was changed');
   }
   round={masks:[...masks],indices:[...batch],E0:score(baseline)};
   assert.ok(result<=round.E0,'binary wrong-only parallel stage must never increase errors');
   if(unknown)throw Error('unconfirmed assessment');
   if(fault&&!faulted){result=fault(result,round.E0);faulted=true;}
  }
  if(label.startsWith('拆分第')){
   const index=Number(label.match(/^拆分第(\d+)题/)[1])-1;
   assert.equal(masks[index],round.masks[index],'split did not verify the exact candidate from the winning round');
   for(let i=0;i<groups.length;i++)if(i!==index)assert.equal(masks[i],baseline[i],'split retained another unconfirmed batch candidate');
   assert.ok(result===score(baseline)||result===score(baseline)-1);
  }
  if(label.startsWith('清洗第')){
   const index=Number(label.match(/^清洗第(\d+)题/)[1])-1;
   for(let i=0;i<groups.length;i++)if(i!==index)assert.equal(masks[i],baseline[i]);
   if(result===score(baseline)){const seen=tried.get(index)||new Set();seen.add(masks[index]);tried.set(index,seen);}
  }
  confirmed=[...masks];history.push({label,masks,score:result,baseline:[...baseline],batch:[...batch],setsAt:sets.length});
  if(stopAt&&!stopUsed&&stopAt(label,result,score(baseline))){stopped=true;stopUsed=true;}
  if(label.startsWith('并行 ')&&result===score(baseline))masks.forEach((mask,i)=>baseline[i]=mask);
  return result;
 };
 const restore=async reason=>{await set(best.masks,true);if(JSON.stringify(confirmed)!==JSON.stringify(best.masks))assert.equal(await evaluate('回滚：'+reason,true),best.score);};
 const call=()=>B.run({targets:groups.map((_,i)=>i).filter(i=>!known.has(i)),size,groups,state:()=>({score:best.score,masks:[...best.masks]}),set,evaluate,
  accept:value=>{if(value<best.score)best={score:value,masks:capture()};},restore,
  confirm:index=>{assert.equal(groups[index].mask,truth[index],'incorrect answer was locked');known.add(index);baseline[index]=groups[index].mask;},
  isStopped:()=>stopped,isConfirmed:i=>known.has(i),note:(indices,text)=>{if(text.startsWith('并行：')){phase='parallel';batch=[...indices];}else if(text.startsWith('清洗：'))phase='clean';else if(text.startsWith('拆分定位'))phase='split';}});
 try{const result=await call();return {best,history,known,baseline,sets,maxInFlight,result,stopped,current:capture()};}
 catch(error){error.trace={best,history,known,baseline,sets,maxInFlight,stopped,current:capture()};throw error;}
}
(async()=>{
 let h=await harness([1,2,4,1,2,4]);assert.equal(h.best.score,0);assert.equal(h.known.size,6);assert.deepEqual(h.current,[1,2,4,1,2,4]);
 const firstParallel=h.history.findIndex(x=>x.label.startsWith('并行 '));assert.ok(firstParallel>0);assert.equal(h.history.slice(1,firstParallel).filter(x=>x.label.startsWith('清洗第')).length,6,'every unknown question must be washed before parallel probing');
 h=await harness([4,4,4,4,4,4]);assert.equal(h.best.score,0);assert.ok(h.history.filter(x=>x.label.startsWith('拆分第')).length>=6,'a multi-hit round must still isolate every member');
 h=await harness([4,4,8,8],undefined,{options:4,size:4});assert.equal(h.best.score,0);assert.equal(h.known.size,4);
 h=await harness([1,4,4,1,4,4],undefined,{locked:[0,3]});assert.ok(h.history.every(x=>x.masks[0]===1&&x.masks[3]===1));
 h=await harness([2,4,8,16,32,64],undefined,{types:Array(6).fill('checkbox'),options:8});assert.equal(h.best.score,0);assert.ok(h.history.some(x=>x.label.startsWith('并行 ')&&x.batch.length===4),'three empty rounds should allow four-question batches');
 const transitions=h.history.slice(1).map((entry,i)=>[h.history[i],entry]).filter(([a,b])=>a.label.startsWith('并行 ')&&b.label.startsWith('并行 ')&&a.score===b.score);assert.ok(transitions.length>0);assert.ok(transitions.every(([a,b])=>b.setsAt-a.setsAt===1),'net-zero rounds must transition directly with no intermediate baseline reset');
 h=await harness([4,4,4],undefined,{stopAt:(label,result,E)=>label.startsWith('并行 ')&&result<E});assert.ok(h.stopped);assert.equal(h.best.score,0);assert.deepEqual(h.current,h.best.masks);assert.deepEqual(h.history.at(-1).masks,h.best.masks);
 h=await harness([4,4,4],undefined,{stopAt:label=>label.startsWith('拆分第')});assert.ok(h.stopped);assert.deepEqual(h.current,h.best.masks);
 h=await harness([4,4,4],undefined,{stopDuringSet:true});assert.ok(h.stopped);assert.equal(h.history.filter(x=>x.label.startsWith('并行 ')).length,0);assert.deepEqual(h.current,h.best.masks);
 await assert.rejects(harness([1,4,4,4],undefined,{fault:(_,E)=>E+1}),error=>{assert.match(error.message,/并行错误数异常/);assert.deepEqual(error.trace.current,error.trace.best.masks);assert.equal(error.trace.history.filter(x=>x.label.startsWith('并行 ')).length,1);return true;});
 await assert.rejects(harness([4,4,4],undefined,{unknown:true}),/unconfirmed/);
 h=await harness([1,4,4],undefined,{types:['radio','checkbox','checkbox'],locked:[0]});assert.equal(h.best.score,0);assert.ok(h.history.every(x=>!x.label.startsWith('清洗第1题')&&!x.batch?.includes(0)),'radio must stay outside cleaning and parallel batches');
 const combinations=[];for(const a of [1,2,4])for(const b of [1,2,4])for(const c of [1,2,4])combinations.push([a,b,c]);
 for(const truth of combinations)for(const initial of combinations){h=await harness(truth,initial);assert.equal(h.best.score,0,JSON.stringify({truth,initial}));assert.deepEqual(h.current,truth);assert.ok(h.maxInFlight<=1);}
 for(const size of [2,3,4]){h=await harness([7,3,6,2,4],undefined,{size,types:Array(5).fill('checkbox')});assert.equal(h.best.score,0);}
 console.log('通过：729组多选清洗/锁定组合；清洗后才真正同时更改多题；并行净零逐题排除且不重试；命中立即还原其他候选再拆分；动态基线、多题命中、8选项/255组合、自动4题、已锁定题不动、异常回滚、停止恢复及未知结果停止。均为模拟评测。');
})().catch(e=>{console.error(e);process.exitCode=1;});
