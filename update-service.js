// Read release metadata; the settings page handles explicitly authorized installs.
globalThis.EhUpdate={
  api:'https://api.github.com/repos/CFFM14/TouGeDone/releases/latest',
  releases:'https://github.com/CFFM14/TouGeDone/releases',
  fallback:'https://github.com/CFFM14/TouGeDone/releases/latest/download/TouGeDone-update.json',
  parts(version){
    if(typeof version!=='string'||! /^(?:0|[1-9]\d{0,4})(?:\.(?:0|[1-9]\d{0,4})){0,3}$/.test(version))throw Error('版本号格式无效。');
    const parts=version.split('.').map(Number);if(parts.some(n=>n>65535)||parts.every(n=>n===0))throw Error('版本号范围无效。');
    while(parts.length<4)parts.push(0);return parts;
  },
  compare(a,b){const left=this.parts(a),right=this.parts(b);for(let i=0;i<4;i++)if(left[i]!==right[i])return left[i]>right[i]?1:-1;return 0;},
  async fallbackRelease(fetchImpl){
    try{
      const response=await fetchImpl(this.fallback,{credentials:'omit',cache:'no-store',redirect:'follow',referrerPolicy:'no-referrer',signal:AbortSignal.timeout(20000)});
      if(!response.ok)throw Error('HTTP '+response.status);
      const url=new URL(response.url);
      if(url.protocol!=='https:'||!['github.com','release-assets.githubusercontent.com'].includes(url.hostname))throw Error('备用源重定向无效');
      const reader=response.body.getReader(),chunks=[];let size=0;
      while(true){const {done,value}=await reader.read();if(done)break;size+=value.length;if(size>65536){await reader.cancel();throw Error('备用信息过大');}chunks.push(value);}
      const bytes=new Uint8Array(size);let offset=0;for(const chunk of chunks){bytes.set(chunk,offset);offset+=chunk.length;}
      const release=JSON.parse(new TextDecoder().decode(bytes));
      if(release.format!==1||release.repository!=='CFFM14/TouGeDone')throw Error('备用信息身份无效');
      return release;
    }catch{throw Error('GitHub 主接口受限或不可用，备用更新源也未能读取，请稍后重试或查看发布历史。');}
  },
  async check(current,{fetchImpl=fetch}={}){
    this.parts(current);
    let response,release,source='api';
    try{response=await fetchImpl(this.api,{credentials:'omit',cache:'no-store',redirect:'error',referrerPolicy:'no-referrer',headers:{Accept:'application/vnd.github+json'},signal:AbortSignal.timeout(15000)});}catch{source='fallback';}
    if(source==='api'&&response.status===404)return {state:'no_release',current,releases:this.releases};
    if(source==='fallback'||[403,429].includes(response.status)||response.status>=500){source='fallback';release=await this.fallbackRelease(fetchImpl);}
    else{if(!response.ok)throw Error('无法检查更新（HTTP '+response.status+'）。');release=await response.json();}
    if(release.draft||release.prerelease||typeof release.tag_name!=='string')throw Error('更新信息不是有效的正式版本。');
    const latest=release.tag_name.replace(/^v/,'');this.parts(latest);
    const page=this.releases+'/tag/'+encodeURIComponent(release.tag_name);
    if(this.compare(latest,current)<=0)return {state:'current',current,latest,page,source,releases:this.releases};
    const name='TouGeDone-v'+latest+'.zip',asset=release.assets?.find(asset=>asset.name===name&&(!asset.state||asset.state==='uploaded'));
    if(!asset)throw Error('发现 v'+latest+'，但正式安装包尚未发布，请稍后重试。');
    const expected='https://github.com/CFFM14/TouGeDone/releases/download/'+encodeURIComponent(release.tag_name)+'/'+name;
    if(asset.browser_download_url!==expected)throw Error('更新安装包地址不属于预期仓库，已拒绝打开。');
    const bundleName='TouGeDone-v'+latest+'.bundle.json',bundle=release.assets?.find(a=>a.name===bundleName&&a.state==='uploaded');
    const bundleURL=this.releases+'/download/'+encodeURIComponent(release.tag_name)+'/'+bundleName;
    if(bundle&&(bundle.browser_download_url!==bundleURL||!/^sha256:[a-f0-9]{64}$/.test(bundle.digest||'')))throw Error('一键更新包地址或校验信息无效。');
    return {state:'available',current,latest,page,source,url:expected,name,bundle:bundle?{url:bundleURL,digest:bundle.digest.slice(7)}:null,notes:typeof release.body==='string'?release.body.slice(0,2000):'',releases:this.releases};
  }
};
