const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict');
const ctx={fetch:()=>{throw Error('unexpected real API');}};
for(const file of ['solution-policy.js','source-session.js','ai-service.js'])vm.runInNewContext(fs.readFileSync(file,'utf8'),ctx);
const {EhSolution:P,EhAI:AI,EhSources:S}=ctx;
const original=['import java.util.Scanner;','public class MainClass {','    static final double PRECISION=1e-3;','    public static void main(String[] args) {','        /********begin********/','        // first placeholder','        /********end********/','        // 固定注释和输出格式不可改','        // begin','        // second placeholder','        // end','    }','}',''].join('\r\n');
const context={editablePaths:['src/MainClass.java','src/Other.java'],files:[{path:'src/MainClass.java',code:original},{path:'src/Other.java',code:'class Other {}'}]};
const input={task:'只填begin/end区域，保留其余代码',file:context.files[0].path,code:original,language:'java',context};
const plan={kind:'多区域模板填空',approach:'只填两个指定区域，固定常量、标记、注释和import原样保留'};
const patched={plan,files:[{path:input.file,regions:[{index:2,code:'        int n=1;\n        System.out.println(n);'},{index:1,code:'        System.out.println("区域1");'}],reason:'补齐指定逻辑'}]};
const reply=value=>({ok:true,json:async()=>({choices:[{finish_reason:'stop',message:{content:JSON.stringify(value)}}]})});
(async()=>{
 const regions=P.regions(original);assert.equal(regions.length,2);assert.deepEqual(Array.from(regions,r=>r.index),[1,2]);
 const result=P.validate(patched,input),code=result.files[0].code;
 assert.equal(P.outsideRegions(code),P.outsideRegions(original));assert.ok(code.includes('PRECISION=1e-3;\r\n'));assert.ok(code.includes('        // 固定注释和输出格式不可改\r\n'));assert.ok(code.includes('System.out.println("区域1");\r\n        /********end'));
 assert.equal(P.validate(result,input).files[0].code,code,'front-end validation must accept normalized region output');
 const partial=structuredClone(patched);partial.files[0].regions=[{index:2,code:''}];const partialCode=P.validate(partial,input).files[0].code;assert.equal(partialCode.slice(P.regions(partialCode)[0].start,P.regions(partialCode)[0].end),original.slice(regions[0].start,regions[0].end));
 for(const edits of [[{index:0,code:'x'}],[{index:3,code:'x'}],[{index:1,code:'x'},{index:1,code:'y'}],[{index:1,code:'// begin\nx\n// end'}]]){
  const bad=structuredClone(patched);bad.files[0].regions=edits;assert.throws(()=>P.validate(bad,input),e=>e.code==='EH_TEMPLATE');
 }
 assert.throws(()=>P.regions('// begin\nx'),e=>e.code==='EH_TEMPLATE');
 const changedOutside={plan,files:[{path:input.file,code:code.replace('PRECISION=1e-3','PRECISION=1e-6'),reason:'bad'}]};
 assert.throws(()=>P.validate(changedOutside,input),e=>e.code==='EH_TEMPLATE');
 let calls=0,requests=[];
 const generated=await AI.generate({key:'mock-not-real'},input,{fetchImpl:async(_,request)=>{requests.push(JSON.parse(request.body));return reply(++calls===1?changedOutside:patched);}});
 assert.equal(calls,2);assert.equal(generated.files[0].code,code);assert.equal(requests[0].messages.length,2);assert.equal(requests[1].messages.length,4);assert.ok(requests[1].messages[3].content.includes('未写入'));assert.ok(!JSON.stringify(requests).includes('mock-not-real'));
 const sent=JSON.parse(requests[0].messages[1].content);assert.equal(sent.template_regions[0].regions.length,2);assert.equal(sent.template_regions[0].regions[0].index,1);
 calls=0;await assert.rejects(AI.generate({key:'mock'},input,{fetchImpl:async()=>{calls++;return reply(changedOutside);}}),e=>e.code==='EH_TEMPLATE');assert.equal(calls,2,'template repair must be bounded to one retry');
 calls=0;const forbidden=structuredClone(patched);forbidden.files[0].path='../outside.java';await assert.rejects(AI.generate({key:'mock'},input,{fetchImpl:async()=>{calls++;return reply(forbidden);}}),/未确认/);assert.equal(calls,1,'unconfirmed paths must not trigger a template retry');
 let writes=0;await assert.rejects(S.apply(changedOutside,context,{request:async()=>{writes++;},check:()=>{}}),/模板/);assert.equal(writes,0,'the whole response must validate before any editor access');
 console.log('通过：星号/行注释双区域识别、编号补丁、区域外逐字保留、CRLF/中文/精度保留、部分区域更新、非法编号/重复/嵌套拦截、前后端重复校验、模板拒绝后仅纠正一次、密钥不进提示词、无效整批零写入。API使用模拟响应。');
})().catch(e=>{console.error(e);process.exitCode=1;});
