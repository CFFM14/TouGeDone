const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict');
const ctx={crypto:require('node:crypto').webcrypto,TextEncoder,TextDecoder,Uint8Array,atob,fetch:async()=>({ok:true,json:async()=>({nonce:'wrong-directory'})})};
vm.runInNewContext(fs.readFileSync('directory-update.js','utf8'),ctx);const D=ctx.EhDirectoryUpdate;
const enc=s=>new TextEncoder().encode(s),manifest=JSON.parse(fs.readFileSync('manifest.json'));
function directory(initial={},fail=()=>false){const data=new Map(Object.entries(initial).map(([k,v])=>[k,enc(v)])),writes=[];const missing=()=>Object.assign(Error('missing'),{name:'NotFoundError'});
  function dir(prefix=''){return {name:'extension',async getDirectoryHandle(part){return dir(prefix+part+'/');},async removeEntry(name){data.delete(prefix+name);},async getFileHandle(name,{create=false}={}){const path=prefix+name;if(!data.has(path)&&!create)throw missing();if(!data.has(path))data.set(path,new Uint8Array());return {async getFile(){return {async arrayBuffer(){return data.get(path).slice().buffer;}};},async createWritable(){let pending;return {async write(bytes){if(fail(path))throw Error('disk full');pending=bytes.slice();},async close(){data.set(path,pending);writes.push(path);},async abort(){}};}};}};}
  return {root:dir(),data,writes};
}
(async()=>{
 const bundle={format:1,version:manifest.version,files:await Promise.all(D.names.map(async path=>{const bytes=fs.readFileSync(path);return {path,data:bytes.toString('base64'),sha256:await D.hash(bytes)};}))};
 const files=await D.validate(bundle,manifest.version,manifest);assert.equal(files.at(-1).path,'manifest.json');
 for(const mutate of [b=>b.files[0].path='../outside.js',b=>b.files[1].path=b.files[0].path,b=>b.files[0].sha256='0'.repeat(64),b=>b.version='3.0.0',b=>b.files.pop()]){const b=structuredClone(bundle);mutate(b);await assert.rejects(D.validate(b,manifest.version,manifest));}
 const old={...manifest,host_permissions:[]};await assert.rejects(D.validate(bundle,manifest.version,old),/权限/);
 const state=new Map(),save=async(k,v)=>{if(v===null)state.delete(k);else state.set(k,v);};
 const targets=[{path:'helper.js',bytes:enc('new helper')},{path:'manifest.json',bytes:enc('new manifest')}];
 let mock=directory({'helper.js':'old helper','manifest.json':'old manifest'});
 await D.install(mock.root,targets,'3.0',save);assert.equal(new TextDecoder().decode(mock.data.get('helper.js')),'new helper');assert.equal(mock.writes.at(-1),'manifest.json');assert.equal(state.get('completed'),'3.0');assert.ok(state.get('journal'));
 state.clear();let once=true;mock=directory({'helper.js':'old helper','manifest.json':'old manifest'},path=>{if(path==='manifest.json'&&once){once=false;return true;}return false;});
 await assert.rejects(D.install(mock.root,targets,'3.0',save),/已恢复/);assert.equal(new TextDecoder().decode(mock.data.get('helper.js')),'old helper');assert.equal(state.size,0);
 state.clear();mock=directory({'helper.js':'old helper','manifest.json':'old manifest'},path=>path==='manifest.json');await assert.rejects(D.install(mock.root,targets,'3.0',save),/恢复记录已保留/);assert.ok(state.get('journal'));
 mock=directory({'manifest.json':JSON.stringify(manifest)});await assert.rejects(D.bind(mock.root,{getManifest:()=>manifest,getURL:p=>'chrome-extension://test/'+p}),/不是当前加载/);assert.equal(mock.data.has('tougedone-install-binding.json'),false);
 await assert.rejects(D.permission({queryPermission:async()=> 'prompt',requestPermission:async()=> 'denied'},true),/允许/);
 await D.permission({queryPermission:async()=> 'granted'});
 console.log('通过：真实打包文件校验、路径/重复/损坏/权限扩展拦截、manifest最后写、更新前持久备份、写失败回滚、回滚失败留恢复记录、选错同版本目录拒绝且移除验证标记。文件系统使用模拟目录。');
})().catch(e=>{console.error(e);process.exitCode=1;});
