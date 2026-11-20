const {execFileSync}=require('node:child_process');
execFileSync('python',['scripts/test_publish.py'],{stdio:'pipe'});
console.log('通过：发布备用信息始终使用正式标签地址，不残留草稿临时地址；摘要无效时停止发布。');
