const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict');
const context={};vm.runInNewContext(fs.readFileSync('panel-ui.js','utf8'),context);const UI=context.EhPanel;
class Target {constructor(){this.events=new Map();}addEventListener(n,f){if(!this.events.has(n))this.events.set(n,new Set());this.events.get(n).add(f);}removeEventListener(n,f){this.events.get(n)?.delete(f);}emit(n,extra={}){const event={button:0,pointerId:1,clientX:0,clientY:0,target:{closest:()=>null},preventDefault(){},stopPropagation(){},...extra};for(const fn of this.events.get(n)||[])fn(event);}}
function harness(storage){const win=new Target();win.innerWidth=1000;win.innerHeight=800;const panel={style:{left:'600px',top:'60px'},getBoundingClientRect(){return {left:parseFloat(this.style.left),top:parseFloat(this.style.top),width:380,height:500};}};const handle=new Target();handle.style={};handle.setPointerCapture=()=>{};handle.releasePointerCapture=()=>{};return {win,panel,handle,control:UI.mount({panel,handle,storage,win})};}
const memory={};const storage={getItem:key=>memory[key]||null,setItem:(key,value)=>memory[key]=value};
let h=harness(storage);const position=()=>JSON.parse(JSON.stringify(h.control.position()));h.handle.emit('pointerdown',{clientX:650,clientY:80});h.win.emit('pointermove',{clientX:350,clientY:180});h.win.emit('pointerup');assert.deepEqual(position(),{left:300,top:160});h.control.dispose();
h=harness(storage);assert.deepEqual(position(),{left:300,top:160},'next task must restore last position');
h.handle.emit('pointerdown',{clientX:300,clientY:160,target:{closest:()=>({})}});h.win.emit('pointermove',{clientX:900,clientY:700});assert.equal(position().left,300,'clicking close/settings must not start dragging');
h.handle.emit('pointerdown',{clientX:300,clientY:160});h.win.emit('pointermove',{clientX:3000,clientY:3000});h.win.emit('pointerup');assert.deepEqual(position(),{left:620,top:300});
h.win.innerWidth=700;h.win.innerHeight=600;h.win.emit('resize');assert.deepEqual(position(),{left:320,top:100});
h.handle.emit('keydown',{key:'ArrowLeft'});assert.equal(position().left,310);
h.control.dispose();const saved=position();h.win.emit('pointermove',{clientX:0,clientY:0});assert.deepEqual(position(),saved);
memory['educoder-helper-position-v1']='{"left":99999,"top":99999}';h=harness(storage);assert.deepEqual(position(),{left:620,top:300});h.control.dispose();
memory['educoder-helper-position-v1']='invalid';h=harness(storage);assert.deepEqual(position(),{left:600,top:60});h.control.dispose();
assert.ok(UI.guide('mixed')[0].includes('API Key'));assert.ok(UI.guide('code')[0].includes('API Key'));assert.ok(UI.guide('choice')[1].includes('无需'));
const controls=Object.fromEntries(['theme','accent','density'].map(name=>{const node=new Target();node.value='';return ['#eh-appearance-'+name,node];}));
const appearancePanel={dataset:{},querySelector:selector=>controls[selector]},media=new Target();media.matches=false;
let appearance=UI.appearance({panel:appearancePanel,storage,win:{matchMedia:()=>media}});
assert.equal(appearancePanel.dataset.theme,'light');controls['#eh-appearance-theme'].value='dark';controls['#eh-appearance-theme'].emit('change');assert.equal(appearancePanel.dataset.theme,'dark');
controls['#eh-appearance-accent'].value='violet';controls['#eh-appearance-accent'].emit('change');controls['#eh-appearance-density'].value='compact';controls['#eh-appearance-density'].emit('change');appearance.dispose();
appearance=UI.appearance({panel:appearancePanel,storage,win:{matchMedia:()=>media}});assert.equal(appearancePanel.dataset.theme,'dark');assert.equal(appearancePanel.dataset.accent,'violet');assert.equal(appearancePanel.dataset.density,'compact');
controls['#eh-appearance-theme'].value='system';controls['#eh-appearance-theme'].emit('change');media.matches=true;media.emit('change');assert.equal(appearancePanel.dataset.theme,'dark');media.matches=false;media.emit('change');assert.equal(appearancePanel.dataset.theme,'light');appearance.dispose();
for(const theme of ['pink','cyber','classic']){
  appearance=UI.appearance({panel:appearancePanel,storage,win:{matchMedia:()=>media}});
  controls['#eh-appearance-theme'].value=theme;controls['#eh-appearance-theme'].emit('change');assert.equal(appearancePanel.dataset.theme,theme);appearance.dispose();
  appearance=UI.appearance({panel:appearancePanel,storage,win:{matchMedia:()=>media}});assert.equal(appearancePanel.dataset.theme,theme,'特色主题应保留到下一关');assert.equal(appearancePanel.dataset.accent,'violet');appearance.dispose();
}
const helper=fs.readFileSync('helper.js','utf8');assert.ok(helper.includes('<option value="mixed" selected>'));assert.ok(helper.indexOf('id="eh-ai-run"')>helper.indexOf('id="eh-advanced"'));assert.ok(helper.indexOf('id="eh-ai-settings"')>helper.indexOf('id="eh-status"'));
console.log('通过：拖动保存与下一关恢复、视口限位/缩放、交互按钮不触发拖动、键盘移动、监听清理、损坏位置恢复；默认混合模式与密钥引导。');
