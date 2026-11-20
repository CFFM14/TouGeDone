// Shared response validation. Model output never grants access to a new path.
globalThis.EhSolution = {
  path(value) {
    return typeof value==='string' && value.length<=500 && !/[:\\\x00-\x1f]/.test(value) && !value.startsWith('/') && value.split('/').every(p=>p && p!=='.' && p!=='..');
  },
  regions(code) {
    const result=[];let open=null,line=0;
    const fail=()=>{const e=Error('begin/end 模板标记不成对或出现嵌套，未写入。');e.code='EH_TEMPLATE';throw e;};
    for(const match of code.matchAll(/[^\r\n]*(?:\r\n|\n|\r|$)/g)){
      if(!match[0])break;line++;
      const text=match[0].replace(/[\r\n]+$/,'');
      const marker=text.match(/^\s*(?:\/\/|#|\/\*+|\*)\s*[-*=]*\s*(begin|end)\b.*$/i)?.[1]?.toLowerCase();
      if(marker==='begin'){if(open)fail();open={index:result.length+1,start:match.index+match[0].length,beginLine:line};}
      else if(marker==='end'){if(!open)fail();result.push({...open,end:match.index,endLine:line});open=null;}
    }
    if(open)fail();return result;
  },
  outsideRegions(code) {
    const regions=this.regions(code);if(!regions.length)return null;
    const fixed=[];let offset=0;
    for(const region of regions){fixed.push(code.slice(offset,region.start).replace(/\r\n/g,'\n'));offset=region.end;}
    fixed.push(code.slice(offset).replace(/\r\n/g,'\n'));
    return JSON.stringify(fixed);
  },
  templateCode(file,original) {
    const regions=this.regions(original.code);
    const fail=message=>{const e=Error(message+'：'+file.path);e.code='EH_TEMPLATE';e.path=file.path;throw e;};
    if(!Array.isArray(file.regions))return file.code;
    if(typeof file.code==='string')fail('模板文件不能同时返回完整 code 与 regions');
    if(!regions.length||!file.regions.length)fail('没有可填充的模板区域');
    const seen=new Set(),edits=[];
    const eol=original.code.includes('\r\n')?'\r\n':'\n';
    for(const edit of file.regions){
      if(!edit||typeof edit!=='object'||Array.isArray(edit))fail('AI 返回了无效的模板区域条目');
      if(!Number.isInteger(edit.index)||edit.index<1||edit.index>regions.length||seen.has(edit.index)||typeof edit.code!=='string'||edit.code.length>150000)fail('AI 返回了无效或重复的模板区域编号');
      seen.add(edit.index);let text=edit.code.replace(/\r\n|\r|\n/g,eol);
      if(text&&!text.endsWith(eol))text+=eol;
      edits.push({...regions[edit.index-1],text});
    }
    let code=original.code;
    for(const edit of edits.sort((a,b)=>b.start-a.start))code=code.slice(0,edit.start)+edit.text+code.slice(edit.end);
    return code;
  },
  validate(result,input) {
    const fail=message=>{const error=Error(message);error.code='EH_AI_RESPONSE';throw error;};
    if(!result||typeof result!=='object'||Array.isArray(result))fail('AI 返回的 JSON 必须是对象，不能是空值、数组或文本。');
    const explanation=typeof result.explanation==='string'?result.explanation:'';
    if(!Array.isArray(input.context?.editablePaths)){
      if(typeof result.code!=='string'||!result.code.trim()||result.code.length>200000)fail('AI 未给出可写入代码。'+(explanation||'请检查题目是否需要修改另一个文件。').slice(0,500));
      return {code:result.code,explanation:explanation.slice(0,3000)};
    }
    const plan=result.plan;
    if(!plan||typeof plan.kind!=='string'||!plan.kind.trim()||typeof plan.approach!=='string'||!plan.approach.trim()||plan.approach.length>4000)fail('AI 未说明题型和解法，未写入。');
    if(!Array.isArray(result.files)||(!result.files.length&&result.ready!==true)||result.files.length>20)fail('AI 未给出有效的文件修改列表。'+explanation.slice(0,500));
    const failed=input.feedback?.matches_current_sources===true&&input.feedback?.tests?.some(test=>test.compile===false||test.result===false||test.result===0);
    if(!result.files.length&&failed)fail('当前评测失败，AI 未提供修复代码，停止重复提交。');
    const seen=new Set(),files=[];
    let budget=0;
    for(const file of result.files){
      if(!file||typeof file!=='object'||Array.isArray(file))fail('AI 文件修改列表中包含无效的条目。');
      const original=input.context.files.find(f=>f.path===file.path);
      if(!this.path(file.path)||seen.has(file.path)||!input.context.editablePaths.includes(file.path)||!original||original.truncated||original.readonly)fail('AI 请求修改未完整读取、只读或未确认的文件：'+(typeof file.path==='string'?file.path.slice(0,500):'[非文本路径]'));
      const code=this.templateCode(file,original);
      if(typeof code!=='string'||!code.trim()||code.length>150000||(budget+=code.length)>400000)fail('AI 文件内容为空或超过上限。');
      if(typeof file.reason!=='string'||!file.reason.trim()||file.reason.length>3000)fail('AI 未说明文件修改原因：'+file.path);
      const fixed=this.outsideRegions(original.code);
      if(fixed!==null&&this.outsideRegions(code)!==fixed){const error=Error('AI 修改了 begin/end 区域外的模板：'+file.path);error.code='EH_TEMPLATE';error.path=file.path;throw error;}
      seen.add(file.path);files.push({path:file.path,code,reason:file.reason});
    }
    const changed=files.some(file=>file.code!==input.context.files.find(old=>old.path===file.path).code);
    if(failed&&!changed)fail('评测失败后 AI 没有提供实际修复，停止重复提交。');
    if(files.length&&!changed&&result.ready!==true)fail('AI 没有产生代码修改；当前代码已满足要求且评测未确认时，应返回 ready:true，否则应提供实际修复。');
    return {plan:{kind:plan.kind.slice(0,200),approach:plan.approach},files,ready:result.ready===true,explanation:explanation.slice(0,3000)};
  }
};
