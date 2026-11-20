const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict');
const ctx={fetch:()=>{throw Error('unexpected network');}};
for(const file of ['solution-policy.js','source-session.js','ai-service.js'])vm.runInNewContext(fs.readFileSync(file,'utf8'),ctx);
const {EhSolution:P,EhSources:S,EhAI:AI}=ctx;
const initial=[{path:'src/Main.java',code:'class Main {}',file:'main',readonly:true},{path:'src/Teacher.java',code:'class Teacher {}',file:'teacher'},{path:'src/Student.java',code:'class Student {}',file:'student'}];
const context={declared:initial.map(f=>f.path),editable:'src/Student.java',editablePaths:initial.slice(1).map(f=>f.path),files:initial};
const solution={plan:{kind:'面向对象多文件题',approach:'保留主程序，补齐调用所需的两个类。'},files:initial.slice(1).map(f=>({path:f.path,code:f.code+' // fixed',reason:'实现主程序调用的方法'}))};
function fixture(){const files=initial.map(f=>({...f})),writes=[];let current=files[2];return {files,writes,request:async(op,data)=>{if(op==='open'){current=files.find(f=>f.path===data.path);if(!current)throw Error('not found');return {...current};}if(op==='write'){if(current.readonly||data.file!==current.file||data.path!==current.path||data.expected!==current.code)throw Error('conflict');current.code=data.code;writes.push(data.path);return {...current};}throw Error(op);},check:()=>{}};}
(async()=>{
let body;
const result=await AI.generate({key:'mock'},{task:'完成教师输入与学生计算，保留主程序',code:initial[2].code,file:initial[2].path,context},{fetchImpl:async(_,r)=>{body=JSON.parse(r.body);return {ok:true,json:async()=>({choices:[{message:{content:JSON.stringify(solution)}}]})};}});
assert.equal(result.files.length,2);assert.equal(JSON.parse(body.messages[1].content).editable_paths.length,2);assert.ok(body.messages[0].content.includes('调用契约'));
for(const path of ['../Secret.java','src/Unknown.java','src/Main.java','C:/secret','src/Teacher.java']){
 const bad=structuredClone(solution);if(path==='src/Teacher.java')bad.files.push({...bad.files[0]});else bad.files[0].path=path;
 assert.throws(()=>P.validate(bad,{context}));
}
assert.throws(()=>P.validate({...solution,plan:null},{context}),/解法/);
assert.throws(()=>P.validate({plan:solution.plan,files:[],ready:true},{context,feedback:{matches_current_sources:true,tests:[{result:false}]}}),/失败/);
assert.equal(P.validate({plan:solution.plan,files:[],ready:true},{context}).ready,true);
const original='class A {\n// begin\nold\n// end\n}',replacement='class A {\n// begin\nnew\n// end\n}';
const templateCtx={files:[{path:'A.java',code:original}],editablePaths:['A.java']};
const templateResult={plan:solution.plan,files:[{path:'A.java',code:replacement,reason:'填空'}]};assert.equal(P.validate(templateResult,{context:templateCtx}).files.length,1);
assert.throws(()=>P.validate({...templateResult,files:[{...templateResult.files[0],code:replacement.replace('class A','class B')}]},{context:templateCtx}),/模板/);
let f=fixture();const captured=await S.capture(context,f);assert.equal(captured.files.length,3);assert.equal(captured.editablePaths.length,2);
const written=await S.apply(solution,context,f);assert.equal(written.journal.length,2);assert.equal(f.files[0].code,initial[0].code);await S.verify(written.files,f);await S.restore(written.journal,f);assert.deepEqual(f.files.map(x=>x.code),initial.map(x=>x.code));
f=fixture();f.files[2].code='user edit';await assert.rejects(S.apply(solution,context,f),/变化/);assert.equal(f.writes.length,0);
f=fixture();let stopped=false;const request=f.request;f.check=()=>{if(stopped)throw Error('stopped');};f.request=async(op,data)=>{const reply=await request(op,data);if(op==='write')stopped=true;return reply;};let journal=[];
await assert.rejects(S.apply(solution,context,{...f,onJournal:entries=>{journal=entries.map(e=>({...e}));}}),/stopped/);assert.equal(f.writes.length,1);assert.equal(journal.length,1);
f=fixture();const applied=await S.apply(solution,context,f);f.files[2].code='user changed after generation';const count=f.writes.length;await assert.rejects(S.restore(applied.journal,f),/变化/);assert.equal(f.writes.length,count);
// A fresh Monaco model identity after each switch is normal, not a conflict.
f=fixture();const switchRequest=f.request;let version=0;f.request=async(op,data)=>{const read=await switchRequest(op,data);if(op==='open'){f.files.find(x=>x.path===data.path).file='model-'+(++version);return {...read,file:'model-'+version};}return read;};
assert.equal((await S.apply(solution,context,f)).journal.length,2);
console.log('通过：按题分析的多文件协议、路径/只读/重复文件/模板保护、全量读取、联合写入、恢复、手动改码冲突、停止后不再写入。API 使用模拟响应。');
})().catch(e=>{console.error(e);process.exitCode=1;});
