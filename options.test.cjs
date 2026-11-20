const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict');
const nodes=Object.fromEntries(['key','model','status','save','clear','test','return'].map(id=>[id,{value:'',placeholder:'',textContent:'',dataset:{},disabled:false}]));
const store={deepseekConfig:{key:'mock-key-not-for-page',model:'old'}},actions=[];let sourceAvailable=true;
const chrome={storage:{local:{get:async key=>({[key]:store[key]}),set:async values=>Object.assign(store,values),remove:async key=>{delete store[key];}},session:{get:async()=>({'eh-options-source':4})}},runtime:{sendMessage:async message=>{assert.deepEqual(JSON.parse(JSON.stringify(message)),{type:'eh-ai-test'});return {ok:true,models:['deepseek-flash']};}},tabs:{get:async id=>{if(!sourceAvailable)throw Error('closed');return {id,url:'https://trustie.educoder.net/tasks/task',windowId:2};},query:async()=>[{id:1,url:'https://example.com/tasks/test',lastAccessed:100},{id:3,url:'https://www.educoder.net/tasks/test',lastAccessed:5,windowId:2}],update:async(id,value)=>actions.push({id,...value})},windows:{update:async(id,value)=>actions.push({window:id,...value})}};
vm.runInNewContext(fs.readFileSync('options.js','utf8'),{document:{getElementById:id=>nodes[id]},chrome});
(async()=>{
await new Promise(setImmediate);assert.equal(nodes.key.value,'');assert.ok(!JSON.stringify(nodes).includes('mock-key-not-for-page'));
await nodes.save.onclick();assert.equal(store.deepseekConfig.key,'mock-key-not-for-page');assert.equal(store.deepseekConfig.model,'deepseek-flash');
nodes.key.value='mock-new-key';await nodes.save.onclick();assert.equal(store.deepseekConfig.key,'mock-new-key');assert.equal(nodes.key.value,'');assert.equal(nodes.status.dataset.tone,'success');
await nodes.test.onclick();assert.equal(nodes.test.disabled,false);assert.match(nodes.status.textContent,/连接成功/);
await nodes.return.onclick();assert.equal(actions[0].id,4);assert.equal(actions[1].window,2);
sourceAvailable=false;actions.length=0;await nodes.return.onclick();assert.equal(actions[0].id,3);
await nodes.clear.onclick();assert.equal(store.deepseekConfig,undefined);await nodes.save.onclick();assert.equal(nodes.status.dataset.tone,'error');
console.log('通过：设置页不回填明文Key、空白保存保留密钥、新密钥保存后清空输入、Flash固定、连接状态、返回原题页/关闭后回退、清除与未填写提示。');
})().catch(e=>{console.error(e);process.exitCode=1;});
