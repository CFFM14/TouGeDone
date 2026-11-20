(() => {
  if (window.__ehEditorBridgeV5) return;
  window.__ehEditorBridgeV5=true;
  const visible=el=>el?.getClientRects().length;
  const identities=new WeakMap();let serial=0;
  const activeCommands=new Map();
  const identity=value=>{if(!identities.has(value))identities.set(value,++serial);return identities.get(value);};
  function activeFiber(node){
    const fiber=node?.[Object.keys(node).find(k=>k.startsWith('__reactFiber'))];
    let root=fiber;while(root?.return)root=root.return;
    return root?.stateNode?.current&&root.stateNode.current!==root?fiber?.alternate||fiber:fiber;
  }
  const treeRows=()=>[...document.querySelectorAll('[role=treeitem]')].filter(visible);
  function treePath(row){
    let fiber=activeFiber(row);
    for(let n=0;fiber&&n<5;n++,fiber=fiber.return){const p=fiber.memoizedProps;if(typeof p?.data?.path==='string')return p.data.path;if(typeof p?.eventKey==='string')return p.eventKey;}
    return null;
  }
  async function revealDirectory(path,url,guard=()=>{}){
    guard();
    if(!treeRows().length)document.querySelector('a[title="显示目录"]')?.click();
    const parts=path.split('/'),expanded=new Set(),end=Date.now()+3000;
    while(Date.now()<end){
      guard();
      if(location.href!==url)throw Error('关卡已变化。');
      const rows=treeRows();if(rows.some(row=>treePath(row)===path))return;
      for(let i=1;i<parts.length;i++){
        const parent=parts.slice(0,i).join('/'),row=rows.find(el=>treePath(el)===parent);
        if(row?.getAttribute('aria-expanded')==='false'&&!expanded.has(parent)){row.querySelector('.ant-tree-switcher')?.click();expanded.add(parent);break;}
      }
      await new Promise(resolve=>setTimeout(resolve,100));
    }
  }
  function currentEditor() {
    const editors=new Set();
    const add=editor=>{try{if(editor?.getModel?.()&&visible(editor.getDomNode?.()))editors.add(editor);}catch{}};
    window.monaco?.editor?.getEditors?.().forEach(add);
    for(const node of document.querySelectorAll('.monaco-editor')) {
      if(!visible(node))continue;
      let fiber=activeFiber(node);
      let owner=node.parentElement;
      for(let p=0;!fiber&&owner&&p<8;p++,owner=owner.parentElement) fiber=activeFiber(owner);
      const seen=new Set();let budget=250;
      const search=(value,depth)=>{
        if(!value||typeof value!=='object'||seen.has(value)||depth>3||--budget<0)return;
        seen.add(value);add(value);
        if(editors.has(value))return;
        for(const key of ['current','editor','editorRef','monacoEditor','memoizedState','next']){try{search(value[key],depth+1);}catch{}}
      };
      for(let i=0;fiber&&i<16;i++,fiber=fiber.return){search(fiber.memoizedProps,0);let hook=fiber.memoizedState;for(let h=0;hook&&h<35;h++,hook=hook.next)search(hook.memoizedState,0);search(fiber.ref,0);}
    }
    const focused=[...editors].filter(e=>e.hasTextFocus?.());
    const list=focused.length===1?focused:[...editors];
    if(list.length>1)throw Error('检测到多个编辑器，请先聚焦需要写入的文件。');
    if(list.length===1){const editor=list[0],model=editor.getModel();return {id:String(model.uri),readonly:!!editor.getRawOptions?.().readOnly,language:model.getLanguageId(),read:()=>model.getValue(),write:code=>{if(editor.getRawOptions?.().readOnly)throw Error('当前编辑器只读。');editor.pushUndoStop?.();if(typeof editor.executeEdits!=='function')throw Error('编辑器不支持安全写入。');editor.executeEdits('educoder-ai',[{range:model.getFullModelRange(),text:code,forceMoveMarkers:true}]);editor.pushUndoStop?.();}};}
    const ace=[...document.querySelectorAll('.ace_editor')].filter(visible).map(n=>n.env?.editor).filter(Boolean);
    if(ace.length===1){const e=ace[0];return {id:'ace:'+identity(e.session),readonly:!!e.getReadOnly(),language:e.session.$modeId||'',read:()=>e.getValue(),write:code=>{if(e.getReadOnly())throw Error('当前编辑器只读。');e.setValue(code,-1);}};}
    const cm=[...document.querySelectorAll('.CodeMirror')].filter(visible).map(n=>n.CodeMirror).filter(Boolean);
    if(cm.length===1){const e=cm[0];return {id:'codemirror:'+identity(e.getDoc()),readonly:!!e.getOption('readOnly'),language:e.getOption('mode')||'',read:()=>e.getValue(),write:code=>{if(e.getOption('readOnly'))throw Error('当前编辑器只读。');e.setValue(code);}};}
    throw Error('未找到可安全写入的代码编辑器。请打开目标代码文件并聚焦；当前不支持仅终端或远程桌面的关卡。');
  }
  function taskProps() {
    let props=null;
    for(const node of document.querySelectorAll('.monaco-editor,.ace_editor,.CodeMirror')){
      let owner=node,fiber;
      for(let i=0;owner&&!fiber&&i<10;i++,owner=owner.parentElement)fiber=activeFiber(owner);
      for(let i=0;fiber&&i<30;i++,fiber=fiber.return){const p=fiber.memoizedProps;if(p?.taskData && typeof p.evaluateLoading==='boolean')props=p;}
      if(props)break;
    }
    if(!props)throw Error('未识别编程评测状态，停止自动提交。');
    return props;
  }
  function evaluationState() {
    const props=taskProps(),task=props.taskData,game=task.game||{};
    const logs=['compile_error','compile_output','error_message'].filter(key=>task[key]!=null).map(key=>({source:key,...EhContext.text(task[key],32000)}));
    if((task.test_sets||[]).some(test=>EhContext.compileStatus(test.compile_success)===false)){
      const seen=new Set();
      for(const el of document.querySelectorAll('pre,code,[role=alert],div,span')){
        if(!visible(el)||el.closest?.('.markdown-body,.monaco-editor,.ace_editor,.CodeMirror,#edu-helper-panel'))continue;
        if(!['PRE','CODE'].includes(el.tagName)&&el.children?.length!==0)continue;
        const text=el.innerText||el.textContent||'';
        if(!/\.(?:java|py|cpp|c|h|js|ts):\d+(?::\d+)?:|Traceback \(most recent|SyntaxError:/.test(text))continue;
        if(!text||seen.has(text))continue;
        seen.add(text);logs.push({source:'visible-compiler-output',...EhContext.text(text,32000)});
        if(seen.size>=8)break;
      }
    }
    return {loading:props.evaluateLoading,status:game.status,count:game.evaluate_count,updated:game.updated_at,file:props.codeRepData?.currentPath||'',message:EhContext.text(props.evaluateMessage,32000),compileLogs:logs,tests:EhContext.tests(task.test_sets)};
  }
  function sourceContext() {
    const props=taskProps(),current=currentEditor(),path=props.codeRepData?.currentPath||current.id;
    const declared=new Set();
    function walk(value,depth=0){
      if(depth>8||declared.size>100)return;
      if(typeof value==='string'){if(/\.(java|py|c|cpp|cc|h|hpp|js|ts|jsx|tsx|html|css|sql|go|rs|rb|php|cs|kt|scala|sh|json|xml|txt)$/i.test(value)&&!value.split('/').includes('..'))declared.add(value);return;}
      if(Array.isArray(value)){value.forEach(v=>walk(v,depth+1));return;}
      if(value&&typeof value==='object')for(const key of ['path','name','children','files'])walk(value[key],depth+1);
    }
    walk(props.codeRepData?.paths);
    if(!declared.size)declared.add(path);
    const writableDeclared=[...declared];
    declared.add(path);
    // Task paths are writable exercise files. Sibling entry points/interfaces
    // visible in the normal directory are additional read-only context.
    const directory=path.slice(0,path.lastIndexOf('/')+1);
    for(const row of treeRows()){
      const sibling=treePath(row);
      if(sibling&&sibling.startsWith(directory)&&!sibling.slice(directory.length).includes('/')&&/\.(java|py|c|cpp|cc|h|hpp|js|ts|jsx|tsx|sql|go|rs|rb|php|cs|kt|scala|sh)$/i.test(sibling))declared.add(sibling);
    }
    const files=[{path,code:current.read(),source:'active-editor',truncated:false}],missing=[];
    let budget=400000-files[0].code.length;
    for(const model of window.monaco?.editor?.getModels?.()||[]){
      let uri;try{uri=decodeURIComponent(String(model.uri));}catch{continue;}
      const name=[...declared].find(p=>uri.endsWith('/'+p)||uri===p);
      if(!name||name===path||files.some(f=>f.path===name))continue;
      const text=model.getValue(),count=Math.max(0,Math.min(100000,budget));
      if(!count)continue;files.push({path:name,code:text.slice(0,count),source:'loaded-editor-model',truncated:text.length>count});budget-=Math.min(text.length,count);
    }
    for(const name of declared)if(!files.some(f=>f.path===name))missing.push(name);
    return {files,missing,declared:[...declared],writableDeclared,editable:path,note:'任务指定源文件可修改；目录中的同级入口和接口只作为上下文。'};
  }
  async function openFile(path,url,guard=()=>{}) {
    guard();
    if(!globalThis.EhSolution?.path(path)||!sourceContext().declared.includes(path))throw Error('未确认的本关文件路径。');
    const check=()=>{guard();if(location.href!==url)throw Error('关卡已变化。');};
    let reason='编辑器尚未就绪';
    const read=()=>{try{
      const props=taskProps();
      if(props.codeRepData?.currentPath!==path){reason='页面尚未切换到目标路径';return null;}
      if(props.codeLoading===true||props.codeRepData?.codeLoading===true){reason='页面仍在加载代码';return null;}
      const editor=currentEditor(),content=props.codeRepData?.content;
      if(typeof content!=='string'||content.replace(/\r\n/g,'\n')!==editor.read().replace(/\r\n/g,'\n')){reason='页面代码与编辑器内容尚未同步';return null;}
      return editor;
    }catch(error){reason=error.message;return null;}};
    await revealDirectory(path,url,guard);guard();
    // Clicking an already selected file can reset currentPath and restart its
    // pending load. Wait for that load instead of toggling the same tree row.
    let clicked=false;try{clicked=taskProps().codeRepData?.currentPath===path;}catch{}
    let stable=null,since=0;
    const deadline=Date.now()+30000,parts=path.split('/');
    const expanded=new Set();
    while(Date.now()<deadline){
      check();
      const editor=read();
      if(editor){const value=editor.id+'\0'+editor.read();if(stable!==value){stable=value;since=Date.now();}else if(Date.now()-since>=300)return;}
      else {stable=null;since=0;}
      if(!clicked){
        const nodes=treeRows(),target=nodes.filter(row=>treePath(row)===path);
        if(target.length===1){target[0].querySelector('.ant-tree-node-content-wrapper')?.click();clicked=true;}
        else if(target.length>1)throw Error('目录中存在重复文件路径。');
        else for(let i=1;i<parts.length;i++){
          const parent=parts.slice(0,i).join('/'),row=nodes.find(el=>treePath(el)===parent);
          if(row?.getAttribute('aria-expanded')==='false'&&!expanded.has(parent)){row.querySelector('.ant-tree-switcher')?.click();expanded.add(parent);break;}
        }
      }
      await new Promise(resolve=>setTimeout(resolve,100));
    }
    throw Error('文件加载等待30秒仍未完成：'+path+'（'+reason+'）。请等代码显示后重试；若一直转圈，请刷新答题页。');
  }
  async function confirmSaved(path,expected,saved){
    const normalize=value=>value.replace(/\r\n/g,'\n');
    const content=saved?.content?.content??saved?.data?.content?.content??saved?.content??saved?.data?.content;
    if(typeof saved?.status==='number'&&saved.status<0)throw Error('页面保存接口拒绝了请求（状态 '+saved.status+'）；未评测。');
    if(typeof content==='string'){
      if(normalize(content)===normalize(expected))return;
      // Repository replies can use Base64 without an encoding field. Accept
      // decoding only when it exactly reproduces the intended source.
      if(content.length%4===0&&/^[A-Za-z0-9+/]*={0,2}$/.test(content))try{
        const decoded=new TextDecoder('utf-8',{fatal:true}).decode(Uint8Array.from(atob(content),c=>c.charCodeAt(0)));
        if(normalize(decoded)===normalize(expected))return;
      }catch{}
    }
    // Some page versions acknowledge a save without returning plain source.
    // Read through the page's previously observed, authenticated file request.
    const receipt=typeof content==='string'?'保存回执文本与编辑器不一致':'保存回执不含可核对的源码';
    await new Promise((resolve,reject)=>{
      const id=crypto.randomUUID(),cleanup=()=>{clearTimeout(timer);document.removeEventListener('eh-network-result',receive);};
      const fail=reason=>{cleanup();reject(Error(receipt+'；'+reason+'。未确认服务器已保存，未评测。'));};
      const receive=event=>{
        let data;try{data=JSON.parse(event.detail);}catch{return;}
        if(data.kind!=='reply'||data.id!==id)return;
        if(data.error)return fail(data.error);
        const file=data.files?.find(file=>file.path===path);
        if(!file||file.truncated||typeof file.code!=='string')return fail(data.missing?.find(file=>file.path===path)?.reason||'服务器源码无法完整读回');
        if(normalize(file.code)!==normalize(expected))return fail('服务器读回代码仍不一致（期望 '+expected.length+' 字符，读回 '+file.code.length+' 字符）');
        cleanup();resolve();
      };
      const timer=setTimeout(()=>fail('服务器文件读回超时'),12000);
      document.addEventListener('eh-network-result',receive);
      document.dispatchEvent(new CustomEvent('eh-network-request',{detail:JSON.stringify({id,op:'files',task:location.pathname.split('/').pop(),paths:[path],budget:150000})}));
    });
  }
  document.addEventListener('eh-editor-v5-request',async event=>{
    let command;try{command=JSON.parse(event.detail);}catch{return;}
    if(command.op==='cancel'){const active=activeCommands.get(command.id);if(active)active.cancelled=true;return;}
    if(!['read','write','open','state','context'].includes(command.op)||typeof command.id!=='string')return;
    const reply=data=>document.dispatchEvent(new CustomEvent('eh-editor-v5-result',{detail:JSON.stringify({id:command.id,...data})}));
    const active={cancelled:false};activeCommands.set(command.id,active);
    const guard=()=>{if(active.cancelled)throw Error('编辑器操作已取消。');if(command.url!==location.href)throw Error('关卡已变化。');};
    try{
      if(command.url!==location.href)throw Error('关卡已变化，未写入。');
      if(command.op==='context'){
        const path=taskProps().codeRepData?.currentPath;
        if(path&&globalThis.EhSolution?.path(path))await revealDirectory(path,command.url,guard);
        guard();
        reply({ok:true,context:sourceContext()});return;
      }
      if(command.op==='state'){reply({ok:true,state:evaluationState()});return;}
      if(command.op==='open')await openFile(command.path,command.url,guard);
      guard();
      const editor=currentEditor();
      if(command.op==='write'){
        if(command.path&&taskProps().codeRepData?.currentPath!==command.path)throw Error('当前文件路径不符，未写入。');
        if(command.file!==editor.id||command.expected!==editor.read())throw Error('文件或原代码已改变，未覆盖你的修改。');
        if(typeof command.code!=='string'||command.code.length>200000)throw Error('代码无效或过长。');
        editor.write(command.code);
        if(editor.read().replace(/\r\n/g,'\n')!==command.code.replace(/\r\n/g,'\n'))throw Error('编辑器未接受写入，请手动检查。');
        if(command.save){
          const props=taskProps();
          if(props.codeRepData?.currentPath!==command.path||typeof props.onUpdateCode!=='function')throw Error('未找到当前文件的正常保存操作；未评测。');
          // Same page handler as normal save, evaluate=0: never starts a build.
          if(editor.readonly||!sourceContext().writableDeclared.includes(command.path))throw Error('当前文件不在本关可写范围。');
          const saved=await props.onUpdateCode(0,editor.read(),true);
          guard();
          await confirmSaved(command.path,editor.read(),saved);
          if(location.href!==command.url||taskProps().codeRepData?.currentPath!==command.path||currentEditor().id!==editor.id||editor.read().replace(/\r\n/g,'\n')!==command.code.replace(/\r\n/g,'\n'))throw Error('保存期间关卡、文件或代码变化，停止评测。');
        }
      }
      let path;try{path=taskProps().codeRepData?.currentPath;}catch{}
      reply({ok:true,file:editor.id,path,readonly:!!editor.readonly,language:editor.language,code:editor.read()});
    }catch(error){reply({ok:false,error:error.message});}finally{activeCommands.delete(command.id);}
  });
})();
