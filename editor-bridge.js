(() => {
  if (window.__ehEditorBridge) return;
  window.__ehEditorBridge=true;
  const visible=el=>el?.getClientRects().length;
  const identities=new WeakMap();let serial=0;
  const identity=value=>{if(!identities.has(value))identities.set(value,++serial);return identities.get(value);};
  function currentEditor() {
    const editors=new Set();
    const add=editor=>{try{if(editor?.getModel?.()&&visible(editor.getDomNode?.()))editors.add(editor);}catch{}};
    window.monaco?.editor?.getEditors?.().forEach(add);
    for(const node of document.querySelectorAll('.monaco-editor')) {
      if(!visible(node))continue;
      let fiber=node[Object.keys(node).find(k=>k.startsWith('__reactFiber'))];
      let owner=node.parentElement;
      for(let p=0;!fiber&&owner&&p<8;p++,owner=owner.parentElement) fiber=owner[Object.keys(owner).find(k=>k.startsWith('__reactFiber'))];
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
    if(list.length===1){const editor=list[0],model=editor.getModel();if(editor.getRawOptions?.().readOnly)throw Error('当前编辑器只读。');return {id:String(model.uri),language:model.getLanguageId(),read:()=>model.getValue(),write:code=>{editor.pushUndoStop?.();if(typeof editor.executeEdits!=='function')throw Error('编辑器不支持安全写入。');editor.executeEdits('educoder-ai',[{range:model.getFullModelRange(),text:code,forceMoveMarkers:true}]);editor.pushUndoStop?.();}};}
    const ace=[...document.querySelectorAll('.ace_editor')].filter(visible).map(n=>n.env?.editor).filter(Boolean);
    if(ace.length===1){const e=ace[0];if(e.getReadOnly())throw Error('当前编辑器只读。');return {id:'ace:'+identity(e.session),language:e.session.$modeId||'',read:()=>e.getValue(),write:code=>e.setValue(code,-1)};}
    const cm=[...document.querySelectorAll('.CodeMirror')].filter(visible).map(n=>n.CodeMirror).filter(Boolean);
    if(cm.length===1){const e=cm[0];if(e.getOption('readOnly'))throw Error('当前编辑器只读。');return {id:'codemirror:'+identity(e.getDoc()),language:e.getOption('mode')||'',read:()=>e.getValue(),write:code=>e.setValue(code)};}
    throw Error('未找到可安全写入的代码编辑器。请打开目标代码文件并聚焦；当前不支持仅终端或远程桌面的关卡。');
  }
  document.addEventListener('eh-editor-request',event=>{
    let command;try{command=JSON.parse(event.detail);}catch{return;}
    if(!['read','write'].includes(command.op)||typeof command.id!=='string')return;
    const reply=data=>document.dispatchEvent(new CustomEvent('eh-editor-result',{detail:JSON.stringify({id:command.id,...data})}));
    try{
      if(command.url!==location.href)throw Error('关卡已变化，未写入。');
      const editor=currentEditor();
      if(command.op==='write'){
        if(command.file!==editor.id||command.expected!==editor.read())throw Error('文件或原代码已改变，未覆盖你的修改。');
        if(typeof command.code!=='string'||command.code.length>200000)throw Error('代码无效或过长。');
        editor.write(command.code);
        if(editor.read()!==command.code)throw Error('编辑器未接受写入，请手动检查。');
      }
      reply({ok:true,file:editor.id,language:editor.language,code:editor.read()});
    }catch(error){reply({ok:false,error:error.message});}
  });
})();
