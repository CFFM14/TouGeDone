const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict'),{execFileSync}=require('node:child_process');
const nodes=Object.fromEntries(['current-version','update-check','update-download','update-status','update-notes','updates','update-cleanup'].map(id=>[id,{hidden:true,scrollIntoView(){}}]));
const calls=[],deleted=[];let cleanup;
const chrome={runtime:{getManifest:()=>({version:'2.9.6'}),reload(){throw Error('must not reload automatically');},sendMessage:async message=>{calls.push(message.type);return message.type==='eh-update-check'?{ok:true,state:'available',latest:'2.9.7',notes:'notes'}:{ok:true};}},storage:{session:{get:async()=>({})}}};
vm.runInNewContext(fs.readFileSync('update-options.js','utf8'),{document:{getElementById:id=>nodes[id]},chrome,indexedDB:{deleteDatabase:name=>{deleted.push(name);return cleanup={};},open(){throw Error('must not read old backups');}},showDirectoryPicker(){throw Error('must not request directory');},fetch(){throw Error('must not fetch executable payload');}});
(async()=>{
 await new Promise(setImmediate);assert.deepEqual(deleted,['tougedone-updater']);cleanup.onblocked();assert.match(nodes['update-cleanup'].textContent,/关闭/);
 await nodes['update-check'].onclick();await nodes['update-download'].onclick();assert.deepEqual(calls,['eh-update-check','eh-update-download']);assert.match(nodes['update-status'].textContent,/手动覆盖/);
 const report=JSON.parse(execFileSync('python',['-c',"import sys,json;sys.path.insert(0,'scripts');from package import build;from zipfile import ZipFile;v,p,c=build();z=ZipFile(p);print(json.dumps({'files':z.namelist(),'html':z.read('options.html').decode('utf-8')}))"],{encoding:'utf8'}));
 assert.ok(!report.files.some(name=>name.includes('directory-update')||name.endsWith('.bundle.json')));
 for(const term of ['update-install','update-folder','update-restore','directory-update.js'])assert.ok(!report.html.includes(term));
 for(const file of ['update-options.js','update-service.js','background.js'])assert.ok(!/showDirectoryPicker|createWritable|EhDirectoryUpdate|eh-update-prepare|eh-update-finish/.test(fs.readFileSync(file,'utf8')),file);
 assert.ok(!fs.existsSync('directory-update.js'));
 console.log('通过：正式ZIP无目录更新器或自动安装载荷，无旧按钮/接口，只检查和打开ZIP下载；仅删除旧数据库，不读取备份、不请求目录、不自动重载。');
})().catch(e=>{console.error(e);process.exitCode=1;});
