// All reads and edits use the real editor; no guessed file-save endpoints.
globalThis.EhSources = {
  async capture(context,{request,check,status=()=>{}}) {
    const paths=[...new Set(context.declared||[context.editable])];
    if(paths.length>20)throw Error('本关超过20个源文件，暂不能完整自动处理。');
    const files=[],editablePaths=[];
    let budget=0;
    for(const path of paths){
      check();if(!EhSolution.path(path))throw Error('页面文件路径不支持：'+path);
      status('读取题目代码：'+path);
      const read=await request('open',{path});check();
      if(read.path!==path||typeof read.code!=='string')throw Error('文件切换未确认：'+path);
      if(read.code.length>150000||(budget+=read.code.length)>400000)throw Error('源代码超过读取上限，未请求 AI。');
      files.push({path,code:read.code,file:read.file,readonly:!!read.readonly,truncated:false,source:'verified-editor'});
      if(!read.readonly&&(context.writableDeclared||paths).includes(path))editablePaths.push(path);
    }
    if(!editablePaths.length)throw Error('本关未确认可写的源文件，停止自动评测。');
    check();await request('open',{path:context.editable});check();
    return {...context,files,missing:[],editablePaths,note:'所有文件均在本关编辑器逐个读取。仅 editablePaths 可修改，按题目限制保留主程序、接口和模板固定部分。'};
  },
  async verify(files,{request,check}) {
    for(const expected of files){
      check();const read=await request('open',{path:expected.path});check();
      // Monaco can recreate its model URI on each normal file switch.
      if(read.path!==expected.path||read.code!==expected.code)throw Error('文件或代码已变化：'+expected.path+'，未继续提交。');
    }
  },
  async restore(files,{request,check,status=()=>{}}) {
    // Preflight the whole batch before restoring anything.
    await this.verify(files.map(f=>({...f,code:f.written})),{request,check});
    const restored=[];
    for(const file of [...files].reverse()){
      check();const read=await request('open',{path:file.path});check();
      await request('write',{path:file.path,file:read.file,expected:file.written,code:file.code,save:true});restored.push(file.path);
    }
    status('已恢复 '+restored.length+' 个文件，未提交。');
  },
  async apply(result,context,{request,check,status=()=>{},onJournal=()=>{}}) {
    // Validate again next to the writer, independent of the AI background.
    const validated=EhSolution.validate(result,{context});
    await this.verify(context.files,{request,check});
    const journal=[],written=[];
    onJournal(journal);
    try{
      for(const patch of validated.files){
        check();const old=context.files.find(f=>f.path===patch.path);
        const current=await request('open',{path:patch.path});check();
        if(current.readonly||current.code!==old.code)throw Error('文件已变化或只读：'+patch.path);
        if(patch.code===old.code)continue;
        status('按方案写入：'+patch.path);
        // Save the intended replacement before writing, even if verification fails.
        const entry={path:patch.path,file:current.file,code:old.code,written:patch.code};journal.push(entry);onJournal(journal);
        const saved=await request('write',{path:patch.path,file:current.file,expected:old.code,code:patch.code,save:true});
        entry.written=saved.code;onJournal(journal);written.push({...entry,code:saved.code});
      }
      check();
      if(!written.length&&!validated.ready)throw Error('AI 没有产生代码修改，停止重复评测。');
      const finalFiles=context.files.map(old=>written.find(f=>f.path===old.path)||old);
      await this.verify(finalFiles,{request,check});
      return {files:finalFiles,journal,plan:validated.plan,evaluationPath:context.editablePaths[0]};
    }catch(error){
      // Keep the exact journal for guarded manual recovery; never submit a partial batch.
      throw Error(error.message+(journal.length?' 已停止本轮评测；可用“恢复原代码”核查并恢复本轮文件。':''));
    }
  }
};
