const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict');
const src=fs.readFileSync('helper.js','utf8');
const dispose=src.slice(src.indexOf('  const pendingEditors='),src.indexOf('  const $ ='));
const handlers=src.slice(src.indexOf("  $('stop').onclick"),src.indexOf('  const records ='));
function fixture(running,stopped){
 const messages=[],removed=[],nodes=Object.fromEntries(['stop','close','scan','scope','question','delay','start','auto','ai-run','mode','ai-limit','batch'].map(id=>[id,{disabled:false,value:id==='mode'?'mixed':'all'}]));
 let disposed=0,panelRemoved=0,cancelled=0;
 const ctx={closed:false,running,stopped,chainActive:true,chainKey:'chain',panelKey:'panel',notify:type=>messages.push(type),uiDispose:()=>disposed++,panel:{remove:()=>panelRemoved++,querySelector:()=>nodes.close},location:{href:'https://www.educoder.net/tasks/test'},sessionStorage:{setItem:()=>{},removeItem:key=>removed.push(key)},status:()=>{},$:id=>nodes[id],chrome:{runtime:{sendMessage:async()=>{}}}};
 vm.createContext(ctx);vm.runInContext(dispose+handlers+';globalThis.testLock=lock;pendingEditors.add(()=>globalThis.cancelCount++);',Object.assign(ctx,{cancelCount:0}));
 return {ctx,nodes,messages,removed,stats:()=>({disposed,panelRemoved,cancelled:ctx.cancelCount})};
}
for(const [running,stopped] of [[false,false],[true,false],[true,true],[false,true]]){
 const f=fixture(running,stopped);if(running)f.nodes.stop.onclick();f.nodes.close.onclick();
 assert.equal(f.ctx.closed,true);assert.equal(f.ctx.running,false);assert.equal(f.ctx.chainActive,false);assert.deepEqual(f.stats(),{disposed:1,panelRemoved:1,cancelled:1});assert.deepEqual(f.removed,['chain','chain','panel'].slice(running?0:1));
 f.nodes.close.onclick();f.ctx.__ehController.dispose();f.ctx.testLock(true);assert.equal(f.ctx.running,false);assert.equal(f.stats().panelRemoved,1,'repeated close/dispose is idempotent');
 assert.equal(f.messages.filter(t=>t==='eh-panel-close').length,1);
}
const bootGuard=src.slice(0,src.indexOf('  const chainKey ='))+"return 'opened';})();";
assert.equal(vm.runInNewContext(bootGuard,{globalThis:{__ehBootstrap:true},sessionStorage:{getItem:()=> '1'}}),undefined);
let cleared=false;assert.equal(vm.runInNewContext(bootGuard,{globalThis:{__ehBootstrap:false},sessionStorage:{getItem:()=> '1',removeItem:()=>cleared=true}}),'opened');assert.equal(cleared,true);
let broken=fixture(false,false);broken.ctx.sessionStorage.setItem=()=>{throw Error('storage blocked');};broken.nodes.close.onclick();assert.equal(broken.stats().panelRemoved,1);
broken=fixture(false,false);broken.ctx.uiDispose=()=>{throw Error('partial UI failure');};assert.throws(()=>broken.nodes.close.onclick(),/partial UI/);assert.equal(broken.stats().panelRemoved,1);
const check=src.slice(src.indexOf('      const check = () => {',src.indexOf('const questionSignature')),src.indexOf('      const delay =',src.indexOf('const questionSignature')));
const closed={closed:true};vm.runInNewContext(check+';globalThis.guard=check;',closed);assert.throws(()=>closed.guard(),/已关闭/);
// A recovery flag may bypass a soft stop, never a hard close.
const wait=src.slice(src.indexOf('  const waitButton ='),src.indexOf('  let aiUndo'));
let clicked=false;const c={closed:true,stopped:true,document:{},panel:{},status:()=>{},sleep:async()=>{},EhControls:{waitEvaluation:async options=>{options.check();clicked=true;}}};vm.runInNewContext(wait+';globalThis.wait=waitButton;',c);
(async()=>{await assert.rejects(c.wait(()=>{},true),/已关闭/);assert.equal(clicked,false);console.log('通过：空闲/运行/停止等待/停止完成后均能立即关闭，重复关闭安全，取消挂起编辑器请求，清理续跑和面板状态，关闭后旧任务不能重新锁定或执行恢复评测。');})().catch(e=>{console.error(e);process.exitCode=1;});
