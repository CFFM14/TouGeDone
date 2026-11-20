// Release metadata only. Remote code is never evaluated or installed here.
globalThis.EhUpdate={
  api:'https://api.github.com/repos/CFFM14/TouGeDone/releases/latest',
  releases:'https://github.com/CFFM14/TouGeDone/releases',
  parts(version){
    if(typeof version!=='string'||! /^(?:0|[1-9]\d{0,4})(?:\.(?:0|[1-9]\d{0,4})){0,3}$/.test(version))throw Error('版本号格式无效。');
    const parts=version.split('.').map(Number);if(parts.some(n=>n>65535)||parts.every(n=>n===0))throw Error('版本号范围无效。');
    while(parts.length<4)parts.push(0);return parts;
  },
  compare(a,b){const left=this.parts(a),right=this.parts(b);for(let i=0;i<4;i++)if(left[i]!==right[i])return left[i]>right[i]?1:-1;return 0;},
  async check(current,{fetchImpl=fetch}={}){
    this.parts(current);
    const response=await fetchImpl(this.api,{credentials:'omit',cache:'no-store',redirect:'error',referrerPolicy:'no-referrer',headers:{Accept:'application/vnd.github+json'},signal:AbortSignal.timeout(15000)});
    if(response.status===404)return {state:'no_release',current,releases:this.releases};
    if(response.status===403||response.status===429)throw Error('GitHub 检查更新受限，请稍后再试。');
    if(!response.ok)throw Error('无法检查更新（HTTP '+response.status+'）。');
    const release=await response.json();
    if(release.draft||release.prerelease||typeof release.tag_name!=='string')throw Error('更新信息不是有效的正式版本。');
    const latest=release.tag_name.replace(/^v/,'');this.parts(latest);
    const page=this.releases+'/tag/'+encodeURIComponent(release.tag_name);
    if(this.compare(latest,current)<=0)return {state:'current',current,latest,page,releases:this.releases};
    const name='TouGeDone-v'+latest+'.zip',asset=release.assets?.find(asset=>asset.name===name&&(!asset.state||asset.state==='uploaded'));
    if(!asset)throw Error('发现 v'+latest+'，但正式安装包尚未发布，请稍后重试。');
    const expected='https://github.com/CFFM14/TouGeDone/releases/download/'+encodeURIComponent(release.tag_name)+'/'+name;
    if(asset.browser_download_url!==expected)throw Error('更新安装包地址不属于预期仓库，已拒绝打开。');
    return {state:'available',current,latest,page,url:expected,name,notes:typeof release.body==='string'?release.body.slice(0,2000):'',releases:this.releases};
  }
};
