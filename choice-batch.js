// Binary per-question protocol: wash/lock, wrong-only parallel exclusion, isolate hits.
globalThis.EhChoiceBatch = {
  candidates(group,initial){
    const popcount=mask=>{let count=0;while(mask){mask&=mask-1;count++;}return count;};
    return (group.type==='radio'?group.boxes.map((_,i)=>1<<i):Array.from({length:(1<<group.boxes.length)-1},(_,i)=>i+1))
      .filter(mask=>mask!==initial).sort((a,b)=>group.type==='radio'?a-b:popcount(b)-popcount(a)||popcount(a^initial)-popcount(b^initial)||b-a);
  },
  async run({targets,size=3,groups,state,set,evaluate,accept,restore,confirm,isStopped,isConfirmed=()=>false,note=()=>{}}){
    // Radios are solved by the caller's direct single-question search.
    targets=targets.filter(index=>groups[index].type==='checkbox');
    size=Math.max(1,Math.min(4,Number(size)||3));
    const initial=state();
    let E=initial.score,base=[...initial.masks],zeroRounds=0;
    const locked=new Set(groups.map((_,i)=>i).filter(isConfirmed));
    const excluded=new Map(),queues=new Map();
    const valid=value=>Number.isInteger(value)&&value>=0&&value<=groups.length;
    if(!valid(E))throw Error('错误总数与题数不符，不能按整题通过规则并行。');
    const lock=index=>{locked.add(index);confirm(index);note([index],'已确认正确，锁定');};
    const place=async(masks,recovery=false)=>{
      for(const index of locked)if(masks[index]!==base[index])throw Error('检测到修改已锁定题，停止。');
      return await set(masks,recovery);
    };
    const stop=async()=>{if(!isStopped())return false;await restore('停止并行，保留最佳提交');return true;};
    const anomaly=async message=>{await restore('并行异常，回滚最佳提交');throw Error(message+'；已回滚，停止继续试探。');};
    const exclude=(index,mask)=>excluded.get(index).add(mask);
    const next=index=>queues.get(index).find(mask=>!excluded.get(index).has(mask));
    const baseline=async(label,verify=false)=>{
      await place(base,true);
      if(verify){const result=await evaluate(label,true);if(result!==E)throw Error('恢复同一基线后的错误数不一致，停止。');}
    };
    // One alternate per question establishes whether the current answer is right.
    // Equal error counts prove BOTH choices wrong under the binary premise.
    for(const index of targets){
      if(await stop())return;
      if(locked.has(index)||E===0)continue;
      excluded.set(index,new Set([base[index]]));
      queues.set(index,this.candidates(groups[index],base[index]));
      const candidate=next(index);
      if(candidate===undefined)throw Error('第'+groups[index].number+'题没有可用清洗候选，无法确认正误。');
      const proposal=[...base];proposal[index]=candidate;
      note([index],'清洗：单题确认当前答案');
      if(!await place(proposal)){await stop();return;}
      const result=await evaluate('清洗第'+groups[index].number+'题');
      if(!valid(result)||Math.abs(result-E)>1){await anomaly('清洗单题时错误数变化超过1或结果无效');}
      if(result>E){
        await baseline('清洗：恢复原正确答案',true);lock(index);
      }else if(result<E){
        E=result;base=proposal;accept(result);lock(index);
      }else{
        exclude(index,candidate);await baseline('清洗：两候选均未命中');
        note([index],'已确认当前错误，等待并行');
      }
    }
    if(await stop())return;
    if(E===0){await restore('清洗完成，整关通过');return;}
    let remaining=targets.filter(index=>!locked.has(index));
    if(E!==remaining.length)await anomaly('清洗后错误总数不等于未锁定题数，整题二值前提或锁定记录不成立');
    while(remaining.length){
      if(await stop())return;
      for(const index of remaining)if(next(index)===undefined)await anomaly('第'+groups[index].number+'题候选耗尽仍未通过');
      const count=size===3&&zeroRounds>=3?4:size;
      const batch=remaining.slice(0,count),candidates=new Map(batch.map(index=>[index,next(index)]));
      const before=[...base],E0=E,proposal=[...base];
      batch.forEach(index=>proposal[index]=candidates.get(index));
      note(batch,'并行：同时更改'+batch.length+'题');
      if(!await place(proposal)){await stop();return;}
      const result=await evaluate('并行 '+batch.map(i=>'第'+groups[i].number+'题').join('、'));
      if(!valid(result)||result>E0||E0-result>batch.length)await anomaly('并行错误数异常（基线'+E0+'，本轮'+result+'）：检查锁定题、基线或混入正确题');
      if(result===E0){
        batch.forEach(index=>exclude(index,candidates.get(index)));
        // All changed answers are still wrong. Keep this already assessed
        // combination as the new wrong baseline, so the next proposal can
        // toggle only differing checkboxes instead of round-tripping via the
        // old baseline. Hit isolation and recovery still restore as required.
        zeroRounds++;base=proposal;
        note(batch,'本轮全部未命中，候选已排除');
      }else{
        // Preserve the complete winning combination for stop/recovery. Internal
        // E/base remain at the pre-round baseline until each hit is isolated.
        accept(result);zeroRounds=0;
        if(await stop())return;
        let hits=0;
        for(const index of batch){
          if(await stop())return;
          // base contains only already isolated hits; all other batch members
          // still have their pre-round wrong answers, never their trial choices.
          const isolated=[...base];isolated[index]=candidates.get(index);
          for(const other of batch)if(other!==index&&!locked.has(other))isolated[other]=before[other];
          note([index],'拆分定位：仅验证本轮候选');
          if(!await place(isolated)){await stop();return;}
          const single=await evaluate('拆分第'+groups[index].number+'题（基线'+E+'）');
          if(!valid(single)||(single!==E&&single!==E-1))await anomaly('拆分单题结果异常，其他题或基线可能发生变化');
          if(single===E-1){E=single;base=isolated;accept(single);lock(index);hits++;}
          else{exclude(index,candidates.get(index));await baseline('拆分：候选未命中');note([index],'本轮候选已排除，仍未通过');}
        }
        if(hits!==E0-result)await anomaly('拆分命中数与本轮总改善数不一致');
        await baseline('拆分完成');
      }
      remaining=targets.filter(index=>!locked.has(index));
      if(E!==remaining.length)await anomaly('错误基线与未锁定题数不一致');
    }
    if(await stop())return;
    await restore('并行完成，确认最佳提交');
    return {score:E,locked:[...locked],excluded};
  }
};
