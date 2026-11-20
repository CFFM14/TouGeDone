// Serial programming workflow; no overlapping evaluation requests.
globalThis.EhProgrammingRun = async function(options) {
  const {generate,evaluate,status,isStopped,saveCooldown=()=>{},now=Date.now,sleep=ms=>new Promise(r=>setTimeout(r,ms))}=options;
  const limit=Math.max(1,Math.min(30,Number(options.maxAttempts)||10));
  let nextAllowed=Number(options.nextAllowed)||0,feedback='';
  const guard=()=>{if(isStopped())throw Error('已停止编程题自动流程。');};
  for(let attempt=1;attempt<=limit;attempt++){
    guard();status('DeepSeek Flash 生成/修正代码：'+attempt+'/'+limit);
    const written=await generate(feedback);guard();
    while(now()<nextAllowed){guard();status('评测冷却中，剩余 '+Math.ceil((nextAllowed-now())/1000)+' 秒…');await sleep(Math.min(500,nextAllowed-now()));}
    guard();status('自动评测：'+attempt+'/'+limit);
    const result=await evaluate(written);guard();
    if(result.passed){saveCooldown(0);return {passed:true,attempts:attempt};}
    nextAllowed=now()+31000;saveCooldown(nextAllowed);
    feedback=result.feedback||{message:'评测未通过，请根据题目要求检查代码。'};
  }
  throw Error('已达本关 AI 重试上限 '+limit+' 次，保留最后代码并停止。');
};
