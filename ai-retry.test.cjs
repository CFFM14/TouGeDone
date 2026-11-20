const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict');
const ctx={};vm.runInNewContext(fs.readFileSync('solution-policy.js','utf8')+fs.readFileSync('ai-service.js','utf8')+fs.readFileSync('source-session.js','utf8'),ctx);
const {EhAI:AI,EhSources:S}=ctx,config={key:'mock-retry-secret'};
const input={task:'保留主程序，补齐各类',code:'class A {}',file:'A.java',language:'java',context:{editable:'A.java',editablePaths:['A.java','B.java','C.java','R.java','T.java'],files:[...['A','B','C'].map(n=>({path:n+'.java',code:'class '+n+' {}'})),{path:'R.java',code:'class R {}',readonly:true},{path:'T.java',code:'class T {}',truncated:true}]}};
const valid={plan:{kind:'类与对象',approach:'实现调用需要的方法'},files:[{path:'A.java',code:'class A { int value=1; }',reason:'补齐成员'}]};
const reply=(value,extra={})=>({ok:true,json:async()=>({choices:[{finish_reason:'stop',message:{content:JSON.stringify(value)},...extra}]})});
const raw=content=>({ok:true,json:async()=>({choices:[{message:{content}}]})});
const patch=fn=>{const value=structuredClone(valid);fn(value);return value;};
const invalids=[
 ['无效JSON',()=>raw('{broken')],['围栏JSON',()=>raw('```json\n{}\n```')],['JSON后混入说明',()=>raw(JSON.stringify(valid)+'说明')],
 ['响应体损坏',()=>({ok:true,json:async()=>{throw SyntaxError('truncated body');}})],['输出截断',()=>reply(valid,{finish_reason:'length'})],
 ['无choices',()=>({ok:true,json:async()=>({})})],['空choices',()=>({ok:true,json:async()=>({choices:[]})})],['空白内容',()=>raw('  ')],['非文本内容',()=>raw({text:'bad'})],
 ...[null,[],42,'code'].map(v=>['顶层非对象',()=>reply(v)]),
 ...[
 ['缺少plan',r=>delete r.plan],['空题型',r=>r.plan.kind=' '],['缺少解法',r=>delete r.plan.approach],['解法过长',r=>r.plan.approach='x'.repeat(4001)],
 ['缺少files',r=>delete r.files],['空files',r=>r.files=[]],['文件数超限',r=>r.files=Array(21).fill(r.files[0])],['条目为null',r=>r.files=[null]],['条目为数组',r=>r.files=[[]]],
 ['非法路径',r=>r.files[0].path='../A.java'],['未知路径',r=>r.files[0].path='Unknown.java'],['非文本路径',r=>r.files[0].path={toString:'bad'}],
 ['只读文件',r=>r.files[0].path='R.java'],['读取不全',r=>r.files[0].path='T.java'],['重复文件',r=>r.files.push({...r.files[0]})],
 ['缺少代码',r=>delete r.files[0].code],['空代码',r=>r.files[0].code=' '],['代码非文本',r=>r.files[0].code={}],['单文件超限',r=>r.files[0].code='x'.repeat(150001)],
 ['总内容超限',r=>r.files=['A','B','C'].map(n=>({path:n+'.java',code:'x'.repeat(140000),reason:'实现'}))],
 ['缺少原因',r=>delete r.files[0].reason],['原因空白',r=>r.files[0].reason=' '],['原因过长',r=>r.files[0].reason='x'.repeat(3001)],['没有代码变化',r=>r.files[0].code=input.code]
 ].map(([name,fn])=>[name,()=>reply(patch(fn))])
];
(async()=>{
 for(const [name,bad] of invalids){let calls=0;const requests=[],progress=[],before=JSON.stringify(input);
  const result=await AI.generate(config,input,{fetchImpl:async(_,r)=>{requests.push(JSON.parse(r.body));return ++calls===1?bad():reply(valid);},onRetry:p=>progress.push(p)});
  assert.equal(calls,2,name);assert.equal(result.files[0].code,valid.files[0].code,name);assert.equal(progress[0].attempt,2);assert.equal(progress[0].maxAttempts,3);assert.ok(progress[0].reason);
  assert.equal(requests[0].messages[1].content,requests[1].messages[1].content,'题目与已有源码始终保留');assert.ok(requests[1].messages[2].content.includes('未写入'));assert.equal(JSON.stringify(input),before);
 }
 let calls=0;const progress=[];await assert.rejects(AI.generate(config,input,{fetchImpl:async()=>{calls++;return raw('{bad');},onRetry:p=>progress.push(p)}),e=>e.code==='EH_AI_RESPONSE'&&e.attempts===3&&e.message.includes('JSON'));assert.equal(calls,3);assert.deepEqual(progress.map(p=>p.attempt),[2,3]);
 calls=0;const bodies=[];await AI.generate(config,input,{fetchImpl:async(_,r)=>{bodies.push(JSON.parse(r.body));calls++;return calls===1?raw('not JSON '+config.key):calls===2?reply({}):reply(valid);}});assert.equal(calls,3);assert.ok(bodies.every(b=>b.messages.length<=4));assert.ok(!JSON.stringify(bodies).includes(config.key));
 for(const status of [401,402,403,429,500]){calls=0;await assert.rejects(AI.generate(config,input,{fetchImpl:async()=>{calls++;return {ok:false,status};}}));assert.equal(calls,1,'HTTP错误单独报告，不作为模型内容反复重试');}
 const aborted=new AbortController();aborted.abort();calls=0;await assert.rejects(AI.generate(config,input,{signal:aborted.signal,fetchImpl:async()=>{calls++;return reply(valid);}}),e=>e.name==='AbortError');assert.equal(calls,0);
 const cancel=new AbortController();calls=0;await assert.rejects(AI.generate(config,input,{signal:cancel.signal,fetchImpl:async()=>{calls++;return raw('{bad');},onRetry:()=>cancel.abort()}),e=>e.name==='AbortError');assert.equal(calls,1,'停止后不得发起第二次请求');
 const late=new AbortController();calls=0;await assert.rejects(AI.generate(config,input,{signal:late.signal,fetchImpl:async()=>{calls++;return {ok:true,json:async()=>{late.abort();return {choices:[{message:{content:JSON.stringify(valid)}}]};}};}}),e=>e.name==='AbortError');assert.equal(calls,1);
 const failed={...input,feedback:{matches_current_sources:true,tests:[{result:false}]}};
 for(const value of [{plan:valid.plan,files:[],ready:true},{...valid,files:[{...valid.files[0],code:input.code}]}]){calls=0;await AI.generate(config,failed,{fetchImpl:async()=>++calls===1?reply(value):reply(valid)});assert.equal(calls,2);}
 const legacy={task:'补齐代码',code:'//TODO'};for(const value of [{},null,{code:' '},{code:123}]){calls=0;await AI.generate(config,legacy,{fetchImpl:async()=>++calls===1?reply(value):reply({code:'class Main {}'})});assert.equal(calls,2);}
 // The writer is only invoked after a valid response, with the original snapshot intact.
 const context={editable:'A.java',editablePaths:['A.java'],files:[{path:'A.java',file:'model',code:input.code}]};let text=input.code,writes=0;calls=0;
 const result=await AI.generate(config,{...input,context},{fetchImpl:async()=>{assert.equal(writes,0);assert.equal(text,input.code);return ++calls===1?raw('{bad'):reply(valid);}});
 await S.apply(result,context,{check(){},request:async(op,data)=>{if(op==='write'){assert.equal(data.expected,input.code);text=data.code;writes++;}return {path:'A.java',file:'model',code:text};}});assert.equal(writes,1);
 console.log('通过：'+invalids.length+'类AI返回错误后纠正、两次补试上限、上下文保留/密钥隐藏、HTTP错误不盲重试、停止与晚返回取消、失败后无修复拒绝，以及合法返回前零写入。均使用模拟API。');
})().catch(e=>{console.error(e);process.exitCode=1;});
