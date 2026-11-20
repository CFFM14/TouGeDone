const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict');
const ctx={AbortSignal,fetch:()=>{throw Error('unexpected network');}};vm.runInNewContext(fs.readFileSync('update-service.js','utf8'),ctx);const U=ctx.EhUpdate;
const release=version=>({tag_name:'v'+version,prerelease:false,draft:false,body:'release notes',assets:[{name:'TouGeDone-v'+version+'.zip',state:'uploaded',browser_download_url:'https://github.com/CFFM14/TouGeDone/releases/download/v'+version+'/TouGeDone-v'+version+'.zip'}]});
const fetchRelease=data=>async(url,request)=>{assert.equal(url,U.api);assert.equal(request.credentials,'omit');assert.equal(request.redirect,'error');assert.ok(!request.headers.Authorization);return {ok:true,status:200,json:async()=>data};};
(async()=>{
assert.equal(U.compare('2.10.0','2.9.9'),1);assert.equal(U.compare('2.9','2.9.0.0'),0);assert.equal(U.compare('2.8.2','2.9'),-1);
for(const value of ['2.9-beta','2.09.0','65536.1','0.0.0','javascript:alert(1)'])assert.throws(()=>U.parts(value));
let r=await U.check('2.9.0',{fetchImpl:fetchRelease(release('2.10.0'))});assert.equal(r.state,'available');assert.equal(r.latest,'2.10.0');
for(const v of ['2.9.0','2.8.2'])assert.equal((await U.check('2.9.0',{fetchImpl:fetchRelease(release(v))})).state,'current');
assert.equal((await U.check('2.9.0',{fetchImpl:async()=>({status:404})})).state,'no_release');
for(const status of [403,429,500])await assert.rejects(U.check('2.9.0',{fetchImpl:async()=>({ok:false,status})}));
for(const field of ['draft','prerelease']){const data=release('2.10.0');data[field]=true;await assert.rejects(U.check('2.9.0',{fetchImpl:fetchRelease(data)}));}
for(const url of ['https://evil.example/extension.zip','http://github.com/CFFM14/TouGeDone/releases/download/v2.10.0/TouGeDone-v2.10.0.zip','https://github.com/Other/Repo/releases/download/v2.10.0/TouGeDone-v2.10.0.zip']){const data=release('2.10.0');data.assets[0].browser_download_url=url;await assert.rejects(U.check('2.9.0',{fetchImpl:fetchRelease(data)}),/地址/);}
const missing=release('2.10.0');missing.assets=[];await assert.rejects(U.check('2.9.0',{fetchImpl:fetchRelease(missing)}),/安装包/);
console.log('通过：GitHub更新版本数值比较、正式版筛选、空发布/限流/错误处理、安装包地址白名单、不发送认证或Cookie。模拟GitHub API。');
})().catch(e=>{console.error(e);process.exitCode=1;});
