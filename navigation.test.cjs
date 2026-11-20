const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict');const src=fs.readFileSync('helper.js','utf8');
const navigation=src.slice(src.indexOf('  async function waitForLevel()'),src.indexOf("  $('start').onclick = async"));
async function harness({href='https://trustie.educoder.net/tasks/course/home/a',next='/tasks/course/home/b',visited,stopDuringSleep=false,choiceAt=0,coding=false,loading=false,timeout=false}={}){
let now=0,assigned=null,saved=null,message='',locked=false;const location=new URL(href);location.assign=value=>assigned=value;const control={chainActive:true,stopped:false};const link={href:next?new URL(next,href).href:'',getClientRects:()=>[1],innerText:'下一关',getAttribute:()=>null};
const ctx={URL,location,Date:{now:()=>now},panel:{contains:()=>false},sessionStorage:{setItem:(k,v)=>saved=JSON.parse(v)},canonical:value=>new URL(value,href).href,chainKey:'test',visited:visited||[href],status:text=>message=text,lock:value=>locked=value,$:()=>({value:'1'}),sleep:async ms=>{now+=ms;if(stopDuringSleep){ctx.stopped=true;ctx.chainActive=false;}},chainActive:true,stopped:false,document:{title:'关卡',querySelectorAll:selector=>selector==='a[href]'?(next?[link]:[]):selector.includes('input[type=')?(!coding&&now>=choiceAt?[{getClientRects:()=>[1]}]:[]):selector==='.ant-spin-spinning'?(loading?[{getClientRects:()=>[1]}]:[]):timeout?[]:[{getClientRects:()=>[1],innerText:'评测'}]}};
vm.createContext(ctx);vm.runInContext(navigation+';globalThis.next=goNext;globalThis.ready=waitForLevel;',ctx);return {ctx,next:()=>ctx.next('通过'),ready:()=>ctx.ready(),result:()=>({now,assigned,saved,message,locked})};}
(async()=>{
let h=await harness();await h.next();assert.equal(h.result().assigned,'https://trustie.educoder.net/tasks/course/home/b');assert.deepEqual(h.result().saved.visited,['https://trustie.educoder.net/tasks/course/home/a','https://trustie.educoder.net/tasks/course/home/b']);
h=await harness({next:'/tasks/b?coursesId=course'});await h.next();assert.equal(h.result().assigned,'https://trustie.educoder.net/tasks/course/home/b?coursesId=course');
h=await harness({next:null});await h.next();assert.equal(h.result().assigned,null);assert.match(h.result().message,/没有下一关/);
h=await harness({next:'/tasks/course/home/a'});await assert.rejects(h.next(),/已访问/);
h=await harness({next:'https://example.com/tasks/course/home/b'});await assert.rejects(h.next(),/范围/);
h=await harness({next:'/tasks/course/other/b'});await assert.rejects(h.next(),/范围/);
h=await harness({stopDuringSleep:true});await h.next();assert.equal(h.result().assigned,null);assert.equal(h.result().locked,false,'stop during next-level delay must release running lock');
h=await harness({choiceAt:5000});assert.equal(await h.ready(),true);assert.ok(h.result().now>=5000);
h=await harness({coding:true});assert.equal(await h.ready(),false);assert.ok(h.result().now>=8000);
h=await harness({coding:true,loading:true});await assert.rejects(h.ready(),/加载未完成/);
h=await harness({timeout:true,coding:true});await assert.rejects(h.ready(),/加载未完成/);
const choice={};vm.runInNewContext(fs.readFileSync('choice-batch.js','utf8'),choice);for(let n=2;n<=12;n++){const result=choice.EhChoiceBatch.candidates({type:'checkbox',boxes:Array.from({length:n})},1);const counts=result.map(mask=>mask.toString(2).replace(/0/g,'').length);assert.equal(result[0],(1<<n)-1);assert.ok(counts.every((value,i)=>!i||counts[i-1]>=value));assert.equal(new Set(result).size,(1<<n)-2);}assert.deepEqual(Array.from(choice.EhChoiceBatch.candidates({type:'radio',boxes:Array.from({length:4})},4)),[1,2,8]);
// Resume validation is covered by resume.test.cjs.
console.log('通过：跨关续跑状态、末关结束、循环/跨任务拦截、停止取消、延迟加载与编程跳过、过期续跑拦截；2～12项多选均按选中数量递减，单选逐项。');
})().catch(e=>{console.error(e);process.exitCode=1});

