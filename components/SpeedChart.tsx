"use client";
import { useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { z } from "zod";
import { getCatalog } from "../lib/catalog";
import { useTeamStore } from "../lib/team-store";
import { useSessionState } from "../lib/use-session-state";
import { useDialogEscape } from "../lib/use-dialog-escape";
import { useModalFocus } from "../lib/use-modal-focus";
import { SpeedFieldControls } from "./SpeedFieldControls";
import { SpeedBattleAxis } from "./SpeedBattleAxis";
import { SpeedPokemonPicker } from "./SpeedPokemonPicker";
import { SpeedDetailPanel } from "./SpeedDetailPanel";
import { SpeedBuildFields } from "./SpeedBuildFields";
import { reconcileSpeedBuild } from "../lib/speed-build";
import { loadSpeedUsage } from "../lib/speed-usage";
import { speedVariants } from "../lib/speed-scenarios";
import { speedCandidateSchema, speedFieldSchema, studySpeeds, type SpeedSubject } from "../lib/speed-research";
import type { BattleFormat, Pokemon } from "../lib/types";

const selectionSchema=speedCandidateSchema.extend({id:z.string(),side:z.enum(["own","enemy"]),observedMoves:z.array(z.string()).max(4).refine(ids=>new Set(ids).size===ids.length).default([]),legacyScenario:z.boolean().optional(),natureName:z.string().nullable().optional(),spread:z.object({hp:z.number(),attack:z.number(),defense:z.number(),specialAttack:z.number(),specialDefense:z.number(),speed:z.number()}).nullable().optional()});
const selectionsSchema=z.array(selectionSchema).max(12).refine(a=>new Set(a.map(s=>s.id)).size===a.length&&["own","enemy"].every(side=>a.filter(s=>s.side===side).length<=6));
type Selection=z.infer<typeof selectionSchema>;
function restoreSelections(value:unknown):Selection[] {
  return selectionsSchema.parse(value).map(s=>{
    if(s.variantIds.length===1&&s.variantIds[0]==="normal")return s;
    if(s.mode==="fixed")return {...s,variantIds:["normal"]};
    const p=getCatalog().pokemonById.get(s.pokemonId),v=p&&s.variantIds.length===1?speedVariants(p,true).find(v=>v.id===s.variantIds[0]):null;
    return {...s,variantIds:["normal"],legacyScenario:true,abilityId:s.abilityId??v?.member.abilityId??null,itemId:s.itemId??v?.member.itemId??null,tailwind:s.tailwind||Boolean(v?.field.ownTailwind),condition:{...s.condition,stage:Math.max(-6,Math.min(6,s.condition.stage+(v?.condition.stage??0))),status:s.condition.status!=="none"?s.condition.status:v?.condition.status??"none",unburden:s.condition.unburden||Boolean(v?.condition.unburden)}};
  }).map(s=>reconcileSpeedBuild(s));
}

const settingsSchema=z.object({showTarget:z.boolean().default(false),target:z.number().int().min(1).max(10000).default(213),ownTailwind:z.boolean().optional(),enemyTailwind:z.boolean().optional(),referenceId:z.string().default(""),field:speedFieldSchema.prefault({}),view:z.enum(["summary","chart"]).default("summary"),focus:z.boolean().default(false),crossings:z.boolean().default(false)});
const label=(p:{name:string;nameZh?:string},zh:boolean)=>zh?p.nameZh||p.name:p.name;
const candidate=(s:Selection)=>speedCandidateSchema.parse(Object.fromEntries(Object.entries(s).filter(([k])=>k!=="id"&&k!=="side"&&k!=="natureName"&&k!=="spread"&&k!=="legacyScenario"&&k!=="observedMoves")));
const subject=(s:Selection):SpeedSubject=>{const {variantIds,...rest}=candidate(s);void variantIds;return rest;};
function Modal({title,onClose,children}:{title:string;onClose:()=>void;children:React.ReactNode}) {
  useDialogEscape(onClose);const ref=useModalFocus();
  return createPortal(<div className="speed-modal-backdrop" onClick={onClose}><section className="speed-modal" role="dialog" aria-modal="true" aria-label={title} ref={ref} onClick={e=>e.stopPropagation()}><header><h2>{title}</h2><button onClick={onClose} aria-label="Close / 關閉">×</button></header><div className="speed-modal-body">{children}</div><footer><button className="primary-button" onClick={onClose}>完成 / Done</button></footer></section></div>,document.body);
}
export function SpeedChart({locale,format,onScrapbook}:{locale:"en"|"zh-Hant";format:BattleFormat;onScrapbook?:(p:Pokemon)=>void}) {
  const zh=locale==="zh-Hant",t=(en:string,cn:string)=>zh?cn:en;
  const [saved,setSaved]=useSessionState<Selection[]>(`speed-chart-${format}`,[],v=>selectionsSchema.safeParse(v).success,v=>restoreSelections(v));
  const [settings,setSettings]=useSessionState(`speed-study-settings-${format}`,settingsSchema.parse({}),v=>settingsSchema.safeParse(v).success,v=>settingsSchema.parse(v));
  const [adding,setAdding]=useState(false),[side,setSide]=useState<"own"|"enemy">("enemy"),[detail,setDetail]=useState<string|null>(null);
  const [removed,setRemoved]=useState<Selection[]>([]);
  const team=useTeamStore(s=>s.teams[format]),catalog=getCatalog();
  const selections=saved.filter(s=>catalog.pokemonById.has(s.pokemonId));
  const selected=selections.find(s=>s.id===detail),p=selected?catalog.pokemonById.get(selected.pokemonId)!:null;
  const reference=selections.find(s=>s.id===settings.referenceId);
  const tailwind=(side:"own"|"enemy")=>(side==="own"?settings.ownTailwind:settings.enemyTailwind)??selections.some(s=>s.side===side&&(s.tailwind||s.variantIds.some(id=>id.includes("tailwind"))));
  const normalized=(s:Selection)=>({...s,tailwind:tailwind(s.side),variantIds:[...new Set(s.variantIds.map(id=>id.replace("+tailwind","")))]});
  const legacyTailwind=(settings.ownTailwind===undefined||settings.enemyTailwind===undefined)&&selections.some(s=>s.tailwind||s.variantIds.some(id=>id.includes("tailwind")));
  const results=useMemo(()=>selections.map(s=>{
    try {return {selection:s,data:studySpeeds({action:"speedStudy",candidates:[candidate(normalized(s))],target:reference?subject(normalized(reference)):{speed:settings.target},field:settings.field}).results[0],error:null};}
    catch(e){return {selection:s,data:null,error:e instanceof Error?e.message:"Invalid scenario"};}
  // The session values contain every calculation input.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }),[saved,settings]);
  const current=results.find(r=>r.selection.id===detail);
  const change=(patch:Partial<Selection>)=>{if(selected)setSaved(saved.map(s=>s.id===selected.id?reconcileSpeedBuild({...s,...patch},Object.hasOwn(patch,"itemId")):s));};
  const remove=(ids:string[])=>{setRemoved(saved.filter(s=>ids.includes(s.id)));setSaved(saved.filter(s=>!ids.includes(s.id)));if(detail&&ids.includes(detail))setDetail(null);if(ids.includes(settings.referenceId))setSettings({...settings,referenceId:""});};
  const undoBlocked=removed.some(r=>selections.filter(s=>s.side===r.side).length+removed.filter(s=>s.side===r.side).length>6||selections.some(s=>s.side===r.side&&catalog.pokemonById.get(s.pokemonId)?.speciesKey===catalog.pokemonById.get(r.pokemonId)?.speciesKey));
  const undo=()=>{if(!undoBlocked){setSaved([...saved,...removed]);setRemoved([]);}};
  const toggleObserved=(id:string)=>{if(!selected)return;const moves=selected.observedMoves??[];if(moves.includes(id))change({observedMoves:moves.filter(x=>x!==id)});else if(moves.length<4&&p?.moveIds.includes(id))change({observedMoves:[...moves,id]});};
  const orderText=(order:string)=>({first:t("Guaranteed first","保證先手"),last:t("Guaranteed last","保證後手"),tie:t("Speed tie","同速抽籤"),conditional:t("Conditional","視條件而定")}[order]??order);
  const natureText=(n:string)=>({negative:t("Negative","減速性格"),neutral:t("Neutral","中性性格"),positive:t("Positive","加速性格")}[n]??n);
  const weatherText=(n:string)=>({none:t("no weather","無天氣"),sun:t("sun","晴天"),rain:t("rain","雨天"),sand:t("sand","沙暴"),snow:t("snow","下雪")}[n]??n);
  const factorText=(factor:string)=>{const [id,...rest]=factor.split(" ");const entry=catalog.abilityById.get(id)??catalog.itemById.get(id);return `${entry?label(entry,zh):id==="tailwind"?t("Tailwind","順風"):id==="paralysis"?t("Paralysis","麻痺"):id} ${rest.join(" ")}`;};
  const warningText=(code:string)=>({RANDOM_ACTION_ORDER:t("Random action order cannot guarantee first action","隨機出手效果無法保證先手"),STALL_ORDER:t("Stall acts after others even in Trick Room","慢出特性在戲法空間仍後出手"),UNSPECIFIED_ORDER_ABILITY:t("Choose the candidate's action-order ability","請指定候選的出手順序特性"),UNSPECIFIED_TARGET_ORDER_ABILITY:t("Choose the target's action-order ability","請指定基準的出手順序特性")}[code]??code);
  const sameFamily=(a:string,b:string)=>catalog.pokemonById.get(a)?.speciesKey===catalog.pokemonById.get(b)?.speciesKey;
  const add=(pokemonId:string)=>{if(!selections.some(s=>s.side===side&&sameFamily(s.pokemonId,pokemonId))&&selections.length<12&&selections.filter(s=>s.side===side).length<6){setSaved([...saved,reconcileSpeedBuild(selectionSchema.parse({id:crypto.randomUUID(),pokemonId,side}))]);void loadSpeedUsage(catalog.pokemonById.get(pokemonId)!,format).catch(()=>{});}};
  const axisEntries=results.map(r=>{const values=r.data?.variants??[];return {id:r.selection.id,name:label(catalog.pokemonById.get(r.selection.pokemonId)!,zh),image:catalog.pokemonById.get(r.selection.pokemonId)!.imageUrl,side:r.selection.side,min:values.length?Math.min(...values.map(v=>v.range.min)):0,max:values.length?Math.max(...values.map(v=>v.range.max)):0,fixed:r.selection.mode==="fixed",warning:values.some(v=>v.warnings.length>0),error:r.error};});
  const example=()=>{if(saved.length)return;setSaved([
    {pokemonId:"garchomp",side:"own",itemId:"choice-scarf"},
    {pokemonId:"gengar",side:"enemy",mode:"fixed",nature:"positive",speedAp:32,abilityId:"cursed-body"},
    {pokemonId:"venusaur",side:"own",abilityId:"chlorophyll"},
    {pokemonId:"snorlax",side:"enemy",mode:"fixed",nature:"negative",speedAp:0,abilityId:"thick-fat"},
  ].map(s=>selectionSchema.parse({...s,id:crypto.randomUUID()})));setSettings(settingsSchema.parse({target:213,field:{weather:"sun"}}));};
  return <section className="speed-chart-workspace speed-study speed-live" aria-label={t("Speed research","速度研究")}>
    <div className="speed-chart-title"><div><h1>{t("Speed · battle order","速度線・即時出手順序")}</h1><p>{t("One battlefield. Set the sides, then read left to right.","一條線看全場；先切換戰場狀態，再由左往右看。")}</p></div><button onClick={()=>setAdding(true)}>{t("＋Add Pokémon","＋加入寶可夢")} {selections.length}/12</button><button disabled={!team.length} onClick={()=>setSaved([...team.map(m=>selectionSchema.parse({id:crypto.randomUUID(),pokemonId:m.pokemonId,side:"own",mode:"fixed",nature:m.nature.up==="speed"?"positive":m.nature.down==="speed"?"negative":"neutral",natureName:m.nature.name,spread:m.ap,observedMoves:[...new Set(m.moveIds)].slice(0,4),speedAp:m.ap.speed,abilityId:m.abilityId,itemId:m.itemId})).map(s=>reconcileSpeedBuild(s)),...saved.filter(s=>s.side==="enemy")].slice(0,12))}>{t("Copy own builds","載入我方配置")}</button></div>
    {legacyTailwind&&<p role="status">{t("Previous individual Tailwind assumptions now apply to the entire side. Use the side switches to change them.","舊版個別順風假設已轉為該方全隊順風，請用上方全隊開關確認或關閉。")}</p>}
    <div className="speed-chart-controls speed-battle-secondary">
      <details><summary>{t("Comparison target / AP evidence","比較基準／配點證據")}</summary><div className="speed-chart-controls"><label><input type="checkbox" checked={settings.showTarget} onChange={e=>setSettings({...settings,showTarget:e.target.checked})}/>{t("Show target line","顯示比較基準線")}</label><label>{t("Compare against","比較基準")}<select value={reference?.id??""} onChange={e=>setSettings({...settings,referenceId:e.target.value})}><option value="">{t("Target Speed","指定速度")}</option>{selections.map(s=><option key={s.id} value={s.id}>{s.side==="own"?t("Own","我方"):t("Enemy","對方")} · {label(catalog.pokemonById.get(s.pokemonId)!,zh)}</option>)}</select></label>{!reference&&<label>{t("Target Speed","比較速度")}<input type="number" min={1} max={10000} value={settings.target} onChange={e=>setSettings({...settings,target:Math.max(1,Math.min(10000,Math.trunc(Number(e.target.value)||1)))})}/></label>}</div></details>
    </div>
    <div className="speed-roster-actions"><button disabled={!selections.some(s=>s.side==="own")} onClick={()=>remove(selections.filter(s=>s.side==="own").map(s=>s.id))}>{t("Clear own side","清除我方全部")} ({selections.filter(s=>s.side==="own").length})</button><button disabled={!selections.some(s=>s.side==="enemy")} onClick={()=>remove(selections.filter(s=>s.side==="enemy").map(s=>s.id))}>{t("Clear enemy side","清除敵方全部")} ({selections.filter(s=>s.side==="enemy").length})</button>{removed.length>0&&<span role="status">{t(`Removed ${removed.length} Pokémon.`,`已移除 ${removed.length} 隻寶可夢。`)} <button disabled={undoBlocked} title={undoBlocked?t("Remove the conflicting family or free a slot before restoring.","請先移除同種寶可夢或騰出位置再復原。"):undefined} onClick={undo}>{t("Undo removal","復原移除")}</button></span>}</div>
    {!selections.length?<div className="speed-study-empty"><h2>{t("Bring both teams onto one line","把雙方隊伍放上同一條線")}</h2><p>{t("Copy your team or add Pokémon. Unknown opponents remain ranges.","直接載入我方配置或加入寶可夢；未知的對手配置會保留範圍。")}</p><button className="primary-button" onClick={example}>{t("Load demo example","載入示範案例")}</button><button onClick={()=>setAdding(true)}>{t("Choose Pokémon","自行選擇寶可夢")}</button></div>:<SpeedBattleAxis field={settings.field} ownTailwind={tailwind("own")} enemyTailwind={tailwind("enemy")} controls={<SpeedFieldControls field={settings.field} ownTailwind={tailwind("own")} enemyTailwind={tailwind("enemy")} onFieldChange={patch=>setSettings({...settings,field:{...settings.field,...patch}})} onTailwindChange={(side,enabled)=>setSettings({...settings,[side==="own"?"ownTailwind":"enemyTailwind"]:enabled})} locale={locale}/>} entries={axisEntries} trickRoom={settings.field.trickRoom} target={settings.showTarget?(reference?axisEntries.find(e=>e.id===reference.id&&e.min===e.max)?.min??null:settings.target):null} onSelect={setDetail} selectedId={detail} onRemove={id=>remove([id])} locale={locale}/>}
    {results.some(r=>r.error)&&<div role="alert">{t("Some conditions conflict. Select the marked Pokémon to repair them.","部分配置條件互相衝突，請點選警示寶可夢修正。")}</div>}
    {axisEntries.some(e=>e.warning)&&<p className="speed-warning" role="note">{t("⚠ Speed alone does not determine these marked Pokémon’s action order. Inspect ability/item conditions.","⚠ 標記寶可夢有出手順序特性／道具限制，不能只按速度判定；請點選查看。")}</p>}
    <p className="speed-chart-note">{t("Same move priority only. Weather is shared; Tailwind applies to the entire side. Click a Pokémon for assumptions, usage and AP evidence.","僅比較相同招式優先度。天氣共用，順風套用該方全隊。點寶可夢查看假設、使用率與配點證據。")}</p>
    {adding&&<Modal title={t("Add to Speed chart","加入速度比較")} onClose={()=>setAdding(false)}><SpeedPokemonPicker locale={locale} format={format} side={side} onSideChange={setSide} count={selections.filter(s=>s.side===side).length} total={selections.length} selections={selections} onRemove={id=>remove([id])} onAdd={add}/></Modal>}
    {selected&&p&&<SpeedDetailPanel key={`${selected.id}-${format}`} pokemon={p} format={format} locale={locale} own={selected.side==="own"} value={selected} onChange={change} observedMoveIds={selected.observedMoves??[]} onToggleObservedMove={toggleObserved} onClose={()=>setDetail(null)} onScrapbook={onScrapbook} speedLabel={(()=>{const e=axisEntries.find(e=>e.id===selected.id);return e?.error?"⚠":e?.min===e?.max?String(e?.min):`${e?.min}–${e?.max}`;})()}>
    <div className="speed-current-form"><img src={p.imageUrl} alt={label(p,zh)}/><div><strong>{t("Current form","目前型態")}：{label(p,zh)}</strong><span>{t("Base stats","種族值")} · HP {p.baseStats.hp} / {t("Atk","攻擊")} {p.baseStats.attack} / {t("Def","防禦")} {p.baseStats.defense} / {t("SpA","特攻")} {p.baseStats.specialAttack} / {t("SpD","特防")} {p.baseStats.specialDefense} / <b>{t("Spe","速度")} {p.baseStats.speed}</b></span></div></div>
    <SpeedBuildFields key={`${selected.id}-${format}`} pokemon={p} format={format} locale={locale} value={selected} onChange={change}/>
    <div className="speed-build-controls">
      <label>{t("Configuration","配置方式")}<select value={selected.mode} onChange={e=>change({mode:e.target.value as Selection["mode"]})}><option value="range">{t("Unknown AP range","未知 AP 範圍")}</option><option value="fixed">{t("Fixed build","固定配置")}</option></select></label>
      {selected.mode==="fixed"&&<><label>{t("Speed nature","速度性格")}<select value={selected.nature} onChange={e=>change({nature:e.target.value as Selection["nature"],natureName:null})}>{["negative","neutral","positive"].map(n=><option key={n} value={n}>{natureText(n)}</option>)}</select></label><label>{t("Speed AP","速度 AP")}<input type="number" min={0} max={32} value={selected.speedAp} onChange={e=>change({speedAp:Math.max(0,Math.min(32,Math.trunc(Number(e.target.value)||0))),spread:null})}/></label></>}
      <p>{t("Side Tailwind is controlled on the battlefield toolbar.","順風請使用外層的全隊開關。")}</p>
    </div>
    {selected.legacyScenario&&<p role="note">{t("Previous hypothetical scenarios now use the shared battlefield above. Confirm the current weather and individual assumptions.","舊版假設情境已改用外層的共同戰場，請確認目前天氣與個別配置。")}</p>}
    {current?.error&&<p role="alert">{current.error}</p>}
    {current?.data?.variants.map(v=><div className="speed-threshold-evidence" key={v.id}><h3>{zh?v.labelZh:v.label} · {orderText(v.order)}</h3><p>{v.range.min}–{v.range.max} vs {v.targetRange.min}–{v.targetRange.max}</p>{v.thresholds.map(n=><p key={n.nature}><strong>{natureText(n.nature)}</strong>：{n.passingAp?`${n.passingAp.min}–${n.passingAp.max} AP`:t("Cannot guarantee first action","無法保證先手")}{n.boundary&&<> · {n.boundary.ap} AP → {n.boundary.speed}（{t("difference","速度差")} {n.boundary.speedDelta}）{n.boundary.adjacent&&<>；{n.boundary.adjacent.ap} AP → {n.boundary.adjacent.speed} · {orderText(n.boundary.adjacent.order)}</>}</>}{n.tieAps.length>0&&<> · {t("Tie AP","同速 AP")} {n.tieAps.join(", ")}</>}</p>)}{!!v.warnings.length&&<p role="note">{t("Action-order limits: ","額外出手順序限制：")}{v.warnings.map(warningText).join("；")}</p>}<p>{t("Assumptions","成立條件")}：{v.assumptions.abilityId?label(catalog.abilityById.get(v.assumptions.abilityId)!,zh):t("no ability effect","無特性效果")} · {v.assumptions.itemId?label(catalog.itemById.get(v.assumptions.itemId)!,zh):t("no item","無道具")} · {weatherText(v.assumptions.field.weather)} · {v.factors.map(factorText).join(" / ")}</p></div>)}
    <button className="secondary-button" onClick={()=>remove([selected.id])}>{t("Remove Pokémon","移除此寶可夢")}</button></SpeedDetailPanel>}
  </section>;
}
