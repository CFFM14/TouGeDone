// Shared, bounded extraction of source context and public evaluation diagnostics.
globalThis.EhContext = {
  compileStatus(value) {
    return value===false||value===0||value==='0'?false:value===true||value===1||value==='1'?true:null;
  },
  text(value, limit=32000) {
    let text='';
    if(typeof value==='string')text=value;
    else if(value!==undefined&&value!==null){try{text=JSON.stringify(value);}catch{text='[无法序列化]';}}
    return {text:text.slice(0,limit),truncated:text.length>limit};
  },
  compare(expected,actual) {
    if(typeof expected!=='string'||typeof actual!=='string')return {available:false};
    let i=0;while(i<Math.min(expected.length,actual.length)&&expected[i]===actual[i])i++;
    const visible=s=>s.replace(/ /g,'·').replace(/\t/g,'\\t').replace(/\r/g,'\\r').replace(/\n/g,'\\n\n');
    return {available:true,equal:expected===actual,whitespaceOnly:expected!==actual&&expected.replace(/\s/g,'')===actual.replace(/\s/g,''),firstDifference:i,expectedLength:expected.length,actualLength:actual.length,expectedExcerpt:visible(expected.slice(Math.max(0,i-60),i+160)),actualExcerpt:visible(actual.slice(Math.max(0,i-60),i+160))};
  },
  tests(tests) {
    return (tests||[]).map((test,index)=>{
      const readable=test.is_public===true&&!test.show_lock&&!test.is_invisible;
      const input=readable&&test.input!=null?this.text(test.input,12000):null;
      const expected=readable&&test.output!=null?this.text(test.output,12000):null;
      const actual=(readable||test.actual_output_visible===true)&&test.actual_output!=null?this.text(test.actual_output,12000):null;
      const compile=this.compileStatus(test.compile_success);
      const logs=(readable||compile===false)?['compile_output','compile_error','error_message','error'].filter(k=>test[k]!=null).map(k=>({source:k,...this.text(test[k],24000)})):[];
      return {number:index+1,public:readable,result:test.result,compile,input:input?.text??null,expected:expected?.text??null,actual:actual?.text??null,truncated:{input:!!input?.truncated,expected:!!expected?.truncated,actual:!!actual?.truncated},comparison:this.compare(expected?String(test.output):undefined,actual?String(test.actual_output):undefined),logs,unavailable:!readable?'测试输入和预期输出未公开，不猜测':null};
    });
  },
  feedback(state) {
    const failed=(state.tests||[]).filter(test=>test.compile===false||test.result===false||test.result===0);
    const ordered=[...failed,...(state.tests||[]).filter(test=>!failed.includes(test))];
    const result={status:state.status,message:state.message,compileLogs:[],omittedLogs:0,tests:[],omittedTests:0};
    for(const log of state.compileLogs||[]){result.compileLogs.push(log);if(JSON.stringify(result).length>96000){result.compileLogs.pop();result.omittedLogs++;}}
    for(const test of ordered){result.tests.push(test);if(JSON.stringify(result).length>155000){result.tests.pop();result.omittedTests++;}}
    return result;
  }
};
