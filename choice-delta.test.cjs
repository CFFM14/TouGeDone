const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict');
const src=fs.readFileSync('helper.js','utf8'),start=src.indexOf('      async function applyMask('),end=src.indexOf('      for (const group of groups)',start);
const clicks=[],expected=new Map();let waits=0;
const boxes=Array.from({length:7},(_,index)=>{const box={checked:index<6,closest:()=>({click(){box.checked=!box.checked;clicks.push(index);}})};expected.set(box,box.checked);return box;});
const ctx={expected,stopped:false,check:()=>{},render:()=>{},sleep:async()=>{waits++;},maskOf:group=>group.boxes.reduce((m,b,i)=>m|(b.checked?1<<i:0),0)};
vm.createContext(ctx);vm.runInContext(src.slice(start,end)+';globalThis.apply=applyMask;',ctx);
(async()=>{const group={type:'checkbox',boxes};assert.equal(await ctx.apply(group,119),true);assert.deepEqual(clicks,[3,6]);assert.equal(waits,2);assert.deepEqual(boxes.map(b=>b.checked),[true,true,true,false,true,true,true]);clicks.length=0;await ctx.apply(group,119);assert.equal(clicks.length,0);console.log('通过：实际applyMask实现从ABCDEF到ABCEFG只点击D/G两次，共同选项保持不动，相同组合零点击。');})().catch(e=>{console.error(e);process.exitCode=1;});
