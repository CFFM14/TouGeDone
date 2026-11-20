const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict');
const ctx={};vm.runInNewContext(fs.readFileSync('panel-ui.js','utf8'),ctx);
function fixture(){const listeners=new Set(),attrs={};let resolve,closed=false;const button={title:'设置',setAttribute:(k,v)=>attrs[k]=v},dot={hidden:false};
 const runtime={id:'self',getManifest:()=>({version:'2.10.0'}),onMessage:{addListener:f=>listeners.add(f),removeListener:f=>listeners.delete(f)},sendMessage:message=>{assert.equal(message.type,'eh-update-status');return new Promise(r=>resolve=r);}};
 const control=ctx.EhPanel.updateNotice({button,dot,runtime,isClosed:()=>closed});
 return {button,dot,attrs,listeners,control,resolve:value=>resolve(value),close:()=>{closed=true;},notice:(value,id='self')=>{for(const listener of listeners)listener({type:'eh-update-notice',current:'2.10.0',available:true,latest:'2.11.0',checkedAt:100,...value},{id});}};
}
(async()=>{
 const f=fixture();assert.equal(f.dot.hidden,true);f.notice({},'other');f.notice({current:'2.9.6'});assert.equal(f.dot.hidden,true);
 f.notice();assert.equal(f.dot.hidden,false);assert.match(f.attrs['aria-label'],/2.11.0/);
 f.resolve({current:'2.10.0',available:false,checkedAt:50});await new Promise(setImmediate);assert.equal(f.dot.hidden,false,'晚到的旧检查不能覆盖新通知');
 f.notice({ok:false,stale:true,checkedAt:200});assert.equal(f.dot.hidden,false);assert.match(f.button.title,/未成功/);
 f.notice({available:false,latest:null,checkedAt:300});assert.equal(f.dot.hidden,true);assert.equal(f.attrs['aria-label'],'设置');
 f.control.dispose();assert.equal(f.listeners.size,0);f.notice({checkedAt:400});assert.equal(f.dot.hidden,true);
 const late=fixture();late.close();late.control.dispose();late.resolve({current:'2.10.0',available:true,latest:'2.11.0',checkedAt:500});await new Promise(setImmediate);assert.equal(late.dot.hidden,true);
 const source=fs.readFileSync('helper.js','utf8');assert.ok(!source.includes('id="eh-updates"'));assert.ok(source.includes('id="eh-update-dot"'));assert.ok(source.includes("updates:!$('update-dot').hidden"));
 console.log('通过：主面板仅保留设置入口，已知新版显示可访问红点、旧/伪造通知忽略、失败保留提示、确认无更新清除、关闭后无晚到改动。');
})().catch(e=>{console.error(e);process.exitCode=1;});
