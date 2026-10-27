/** Independent per-hit 85..100 rolls. Counts stay exact through 10 hits (16^10 < 2^53). */
export function combineDamageHits(hits:number[][],hp:number,survival:boolean,healing?:{threshold:number;amount:number;maxHp:number}){
 type State={damage:number;hp:number;usedBerry:boolean;count:number};
 let states:State[]=[{damage:0,hp,usedBerry:false,count:1}];let survivalApplied=false,healingApplied=false;
 const rawRange=[hits.reduce((n,r)=>n+Math.min(...r),0),hits.reduce((n,r)=>n+Math.max(...r),0)];
 const cumulative:Array<{hit:number;range:number[];conditionalKoChance:number}>=[];
 for(const [index,rolls] of hits.entries()){
  const next=new Map<string,State>();
  for(const state of states)for(const roll of rolls){
   const damage=index===0&&survival?Math.min(roll,Math.max(0,hp-1)):roll;
   survivalApplied ||= damage!==roll;
   let remaining=Math.max(0,state.hp-damage),usedBerry=state.usedBerry;
   if(healing&&!usedBerry&&remaining>0&&remaining<=Math.floor(healing.maxHp*healing.threshold)){
    remaining=Math.min(healing.maxHp,remaining+healing.amount);usedBerry=true;healingApplied=true;
   }
   const total=state.damage+damage,key=`${total}:${remaining}:${usedBerry}`;
   const prior=next.get(key);
   if(prior)prior.count+=state.count;else next.set(key,{damage:total,hp:remaining,usedBerry,count:state.count});
  }
  states=[...next.values()];
  const total=states.reduce((n,s)=>n+s.count,0);
  cumulative.push({hit:index+1,range:[Math.min(...states.map(s=>s.damage)),Math.max(...states.map(s=>s.damage))],conditionalKoChance:states.filter(s=>s.hp===0).reduce((n,s)=>n+s.count,0)/total});
 }
 const counts=new Map<number,number>();for(const s of states)counts.set(s.damage,(counts.get(s.damage)??0)+s.count);
 const distribution=[...counts].sort(([a],[b])=>a-b).map(([damage,count])=>({damage,count}));
 const combinations=distribution.reduce((n,r)=>n+r.count,0);
 return {distribution,combinations,cumulative,rawRange,survivalApplied,healingApplied,remainingHpRange:[Math.min(...states.map(s=>s.hp)),Math.max(...states.map(s=>s.hp))],conditionalKoChance:states.filter(s=>s.hp===0).reduce((n,s)=>n+s.count,0)/combinations};
}
