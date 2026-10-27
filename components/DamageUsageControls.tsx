"use client";
import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { getCatalog } from '../lib/catalog';
import { loadSpeedUsage } from '../lib/speed-usage';
import { useSpeedUsage } from '../lib/use-speed-usage';
import { UsageFreshness } from './UsageFreshness';
import { usageScenarios } from '../lib/usage-scenarios';
import { applyDamageUsage, reconcileDamageAttack, type DamageUsage, type UsageMode } from '../lib/damage-build';
import type { DamageBuild } from '../lib/damage';
import type { BattleFormat, Stats } from '../lib/types';
import { calculateFinalStats, NATURES } from '../lib/domain';

const stats: Array<keyof Stats>=['hp','attack','defense','specialAttack','specialDefense','speed'];
const statNames={en:['HP','Atk','Def','SpA','SpD','Spe'],zh:['HP','攻擊','防禦','特攻','特防','速度']};
export const apDescription=(ap:Stats,zh:boolean)=>stats.map((s,i)=>`${statNames[zh?'zh':'en'][i]} ${ap[s]}`).join(' / ');
const fieldNames={zh:{abilityId:'特性',itemId:'持有物',nature:'性格',ap:'AP',moveSlots:'招式'},en:{abilityId:'Ability',itemId:'Item',nature:'Nature',ap:'AP',moveSlots:'Moves'}};

export type DamageUsageReport={notice:string;changes:string[]};

export function DamageUsageControls({build,format,zh,moveId,onApply,children,initialReport}:{build:DamageBuild;format:BattleFormat;zh:boolean;moveId?:string;initialReport?:DamageUsageReport|null;onApply:(build:DamageBuild,preferRanked:boolean,report:DamageUsageReport)=>void;children:(usage:DamageUsage|null,controls:React.ReactNode)=>React.ReactNode}) {
  const [usage,setUsage]=useState<DamageUsage|null>(null),[busy,setBusy]=useState(false),[notice,setNotice]=useState(initialReport?.notice??'');
  const [changes,setChanges]=useState<string[]>(initialReport?.changes??[]);
  const [loading,setLoading]=useState(true),[sourceError,setSourceError]=useState(false);
  const request=useRef(0),pending=useRef(false),pendingMode=useRef<UsageMode|null>(null);
  const pendingContext=useRef<string|null>(null);
  const context=JSON.stringify([build.pokemonId,build.abilityId,build.itemId,build.nature,stats.map(stat=>build.ap[stat]),build.moveSlots,moveId??null,format,zh]);
  const p=getCatalog().pokemonById.get(build.pokemonId)!;
  const refreshed=useSpeedUsage(p,format);
  const fields=fieldNames[zh?'zh':'en'];
  // Evidence loading only enriches the existing selectors; it never edits a build.
  useEffect(()=>{
    // Scheduling the view update keeps the effect free of synchronous state cascades.
    let cancelled=false;
    queueMicrotask(()=>{if(!cancelled){setUsage(refreshed.usage?usageScenarios(p,refreshed.usage):null);setSourceError(!refreshed.busy&&!refreshed.usage);setLoading(refreshed.busy);}});
    return ()=>{cancelled=true;};
  },[p,format,refreshed.usage,refreshed.busy]);
  // Compare the committed values with this request's start context. A prior
  // commit's passive cleanup must not invalidate a newer click on the new DOM.
  useLayoutEffect(()=>{
    if(!pending.current||pendingContext.current===context)return;
    const cancelled=++request.current;pending.current=false;
    const wasApply=pendingMode.current!==null;
    queueMicrotask(()=>{
      if(request.current!==cancelled||pending.current)return;
      setBusy(false);setNotice(wasApply?(zh?'你已修改配置，已取消先前的套用；可再次按下套用。':'Settings changed. Previous application cancelled; you can apply again.'):(zh?'你已修改配置，已取消先前的讀取；可重試使用率。':'Settings changed. Previous lookup cancelled; retry usage to load ranks.'));
    });
  },[context,zh]);
  useLayoutEffect(()=>()=>{request.current++;pending.current=false;},[]);
  const describe=(key:string,b:DamageBuild)=>{
    const c=getCatalog(),name=(r:{name:string;nameZh?:string}|undefined)=>r?(zh?r.nameZh??r.name:r.name):'—';
    if(key==='ap')return apDescription(b.ap,zh);
    if(key==='abilityId')return name(c.abilityById.get(b.abilityId??''));
    if(key==='itemId')return name(c.itemById.get(b.itemId??''));
    if(key==='nature')return name(NATURES.find(n=>n.name===b.nature));
    return b.moveSlots.filter(Boolean).map(id=>name(c.moveById.get(id!))).join(' / ');
  };
  const apply=(evidence:DamageUsage,mode:UsageMode)=>{
    const result=applyDamageUsage(build,evidence,mode);
    const preferRanked=mode==='full'&&evidence.defaults.moveSlots!==null;
    const attack=moveId===undefined?null:reconcileDamageAttack(result.build,moveId,preferRanked);
    const missing=mode==='full'?evidence.missingFields.filter(key=>key!=='abilityId'||result.build.pokemonId===build.pokemonId||getCatalog().pokemonById.get(result.build.pokemonId)!.abilityIds.length!==1):[...((mode==='ap'||mode==='stats')&&!evidence.alternatives.ap.length?['ap']:[]),...((mode==='nature'||mode==='stats')&&!evidence.alternatives.natures.length?['nature']:[])];
    const moveChanged=attack!==null&&attack.moveId!==moveId;
    const changed=result.changed.length>0||moveChanged;
    const before=calculateFinalStats(p.baseStats,build.ap,NATURES.find(n=>n.name===build.nature)!);
    const after=calculateFinalStats(getCatalog().pokemonById.get(result.build.pokemonId)!.baseStats,result.build.ap,NATURES.find(n=>n.name===result.build.nature)!);
    const statChanges=stats.flatMap((s,i)=>before[s]===after[s]?[]:[`${statNames[zh?'zh':'en'][i]} ${before[s]} → ${after[s]}`]);
    const reportChanges=[...result.changed.filter(key=>key in fields).map(key=>`${fields[key as keyof typeof fields]}: ${describe(key,build)} → ${describe(key,attack?.build??result.build)}`),...(statChanges.length?[`${zh?'能力值':'Stats'}: ${statChanges.join(' / ')}`]:[]),...(moveChanged?[`${zh?'本次招式':'Tested move'}: ${describe('moveSlots',{...build,moveSlots:[moveId!]})} → ${describe('moveSlots',{...build,moveSlots:[attack.moveId]})}`]:[]),...(attack&&mode==='full'&&!result.build.moveSlots.some(id=>id&&getCatalog().moveById.get(id)?.category!=='Status')?[zh?'熱門招式沒有攻擊招式；保留或帶入示範攻擊招式供本次計算。':'Popular moves contain no attack; a retained or example attack is included for this calculation.']:[])];
    setChanges(reportChanges);
    const message=changed?(zh?'已套用。':'Applied.'):(zh?'目前配置沒有變更。':'No settings changed.');
    const reportNotice=missing.length?`${message} ${zh?'缺少可用資料，保留原值：':'Missing usable data; kept current values: '}${missing.map(k=>fields[k as keyof typeof fields]??k).join('、')}`:changed?message:(zh?'目前已是此配置。':'Already using these settings.');
    setNotice(reportNotice);
    // Full-set selection may also change the tested move, even if its slots match.
    if(result.changed.length||moveChanged)onApply(result.build,preferRanked,{notice:reportNotice,changes:reportChanges});
  };
  async function load(mode:UsageMode|null) {
    const version=++request.current;pending.current=true;pendingContext.current=context;pendingMode.current=mode;setBusy(true);setNotice('');setChanges([]);
    try {
      const data=await loadSpeedUsage(p,format,mode===null);
      if(version!==request.current)return;
      const evidence=usageScenarios(p,data);setUsage(evidence);setSourceError(false);
      pending.current=false;setBusy(false);
      if(mode)apply(evidence,mode);
      else setNotice(zh?'已載入使用率，尚未修改配置。':'Usage loaded; settings unchanged.');
    }catch{if(version===request.current)setNotice(zh?'使用率暫時無法取得，設定已保留。請再次按下套用重試。':'Usage unavailable. Settings kept; press Apply again to retry.');}
    finally{if(version===request.current){pending.current=false;setBusy(false);}}
  }
  const combined=getCatalog().formRelations.some(r=>r.baseFormId===p.id||r.megaFormId===p.id);
  return children(usage,<div className="damage-usage-controls">
    {usage&&<p><UsageFreshness provenance={usage.provenance} locale={zh?'zh-Hant':'en'} missingCategories={usage.missingCategories}/></p>}
    <div className="damage-usage-buttons"><button type="button" disabled={busy} onClick={()=>load('stats')}>{zh?'套用 DEMO 能力配置（AP＋性格）':'Apply DEMO stats (AP + nature)'}</button><button type="button" disabled={busy} onClick={()=>load('full')}>{zh?'套用 DEMO 配置':'Apply DEMO set'}</button>{busy&&<span>{zh?'讀取中…':'Loading…'}</span>}</div>
    <p className="damage-usage-scope">{format==='singles'?(zh?'單打':'Singles'):(zh?'雙打':'Doubles')} · {combined?(zh?'普通／Mega 共用虛構 DEMO 範例。':'Shared fabricated base/Mega DEMO fixture.'):(zh?'此型態的 DEMO 使用率。':'DEMO usage for this form.')} {zh?'使用率皆為虛構；各欄分別示範。':'Usage is fabricated; each field is a separate demonstration.'}</p>
    <details className="damage-usage"><summary>{zh?'使用率來源與套用說明':'Usage source and application details'}</summary>
    <p className="damage-usage-scope">{zh?'常見能力配置採用各自排名最高的 AP 與性格，保留本次招式、特性、道具與戰鬥條件。完整套用另會替換有資料的特性、道具及招式，並選擇最高排名的攻擊招式。':'Common stats applies the top AP and nature separately, keeping the tested move, ability, item and battle conditions. Full application also replaces available ability, item and moves and selects the highest-ranked attack.'}</p>
    {usage&&<>
      <p>{usage.format} · {zh?'固定 DEMO 範例，無統計日期':'Fixed DEMO fixture; no statistics date'}</p>
      <p>{zh?'AP 與性格分別統計，不代表一起使用的比例或最佳組合。':'AP and nature are separate statistics, not joint frequencies or an optimal set.'}</p>
      <p>{zh?'特性來源':'Ability source'}: {usage.abilityEvidence?.kind==='fixed-form-ability'?(zh?'型態固定特性（不是使用率推定）':'Fixed form ability (not inferred from usage)'):usage.sources.ability?`${usage.sources.ability.name} · #${usage.sources.ability.rank}`:(zh?'缺少匹配資料，保留原值':'No matching data; current value kept')}</p>
      {p.isMega&&<p>{zh?'道具來源：此型態必需的超級石。':'Item source: required stone for this form.'}</p>}
    </>}
    </details>
    {loading&&<small>{zh?'正在讀取選項使用率…':'Loading usage ranks…'}</small>}
    {sourceError&&<p className="damage-usage-scope">{zh?'使用率暫時無法取得，仍可手動調整。':'Usage unavailable; manual editing is available.'} <button type="button" disabled={busy} onClick={()=>load(null)}>{zh?'重試使用率':'Retry usage'}</button></p>}
    {notice&&<p role="status" className="damage-usage-status">{notice}</p>}
    {changes.length>0&&<details className="damage-usage-changes"><summary>{zh?'本次變更':'Changes applied'}</summary><ul>{changes.map(line=><li key={line}>{line}</li>)}</ul></details>}
  </div>);
}


/** Same compact, ranked-first native-select pattern as the database Build Workbench. */
export function DamageNatureSelect({build,usage,zh,onChange}:{build:DamageBuild;usage:DamageUsage|null;zh:boolean;onChange:(nature:string)=>void}) {
  const ranked=usage?.alternatives.natures??[];
  const byName=new Map(ranked.map(c=>[c.nature.name,c]));
  const label=(n:typeof NATURES[number])=>`${zh?n.nameZh:n.name}${n.up&&n.down?` (${statNames[zh?'zh':'en'][stats.indexOf(n.up)]}↑ ${statNames[zh?'zh':'en'][stats.indexOf(n.down)]}↓)`:(zh?'（能力值不變）':' (neutral)')}`;
  const options=[...ranked.map(c=>c.nature),...NATURES.filter(n=>!byName.has(n.name)).sort((a,b)=>label(a).localeCompare(label(b)))];
  return <label className="damage-nature-select">{zh?'性格':'Nature'}<select value={build.nature} onChange={e=>onChange(e.target.value)}>{options.map(n=>{
    const c=byName.get(n.name);
    return <option key={n.name} value={n.name}>{c?`${zh?'DEMO':'DEMO'} #${c.rank} · `:''}{label(n)}{c?` · ${c.evidence?.percentage||'—'}`:''}</option>;
  })}</select></label>;
}

export function DamageApSelect({build,usage,zh,onChange}:{build:DamageBuild;usage:DamageUsage|null;zh:boolean;onChange:(ap:Stats)=>void}) {
  const choices=usage?.alternatives.ap??[];
  const selected=choices.find(c=>stats.every(s=>c.ap[s]===build.ap[s]));
  return <label className="damage-ap-select">{zh?'AP 配置':'AP spread'}<select value={selected?.rank??''} onChange={e=>{const c=choices.find(c=>String(c.rank)===e.target.value);if(c)onChange({...c.ap});}}>
    <option value="" disabled>{zh?'自訂（手動調整 AP）':'Custom (edit AP manually)'}</option>
    {choices.map(c=><option key={c.rank} value={c.rank}>{zh?'DEMO':'DEMO'} #{c.rank} · {apDescription(c.ap,zh)} · {c.percentage||'—'}</option>)}
  </select></label>;
}
