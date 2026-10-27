"use client";
import { useState } from "react";
import { ResourcePicker, type ResourcePickerOption } from "./ResourcePicker";
import { getCatalog } from "../lib/catalog";
import { useSpeedUsage } from "../lib/use-speed-usage";
import { rankedAbilityChoices, rankedItemChoices, rankedNatureChoices, rankedApChoices } from "../lib/battle-recommendations";
import { NATURES } from "../lib/domain";
import { itemEffectCategories } from "../lib/filtering";
import type { BattleFormat, Pokemon, Stats } from "../lib/types";
import type { SpeedCandidate } from "../lib/speed-research";

export type SpeedBuildMetadata = { natureName?: string | null; spread?: Stats | null };
export function SpeedBuildFields({pokemon,format,locale,value,onChange}:{pokemon:Pokemon;format:BattleFormat;locale:"en"|"zh-Hant";value:SpeedCandidate & SpeedBuildMetadata;onChange:(patch:Partial<SpeedCandidate & SpeedBuildMetadata>)=>void}) {
  const catalog=getCatalog(),zh=locale==="zh-Hant",t=(en:string,cn:string)=>zh?cn:en;
  const source=catalog.battleDataSourcePokemon(pokemon);
  const {usage,busy,retry}=useSpeedUsage(pokemon,format);
  const [detailed,setDetailed]=useState(true);
  const name=(x:{name:string;nameZh?:string})=>zh?x.nameZh??x.name:x.name;
  const abilities=new Map(rankedAbilityChoices(usage,pokemon).map(x=>[x.id,x.rank]));
  const items=new Map(rankedItemChoices(usage).map(x=>[x.id,x.rank]));
  const natures=new Map(rankedNatureChoices(usage).map(x=>[x.nature.name,x.rank]));
  const spreads=rankedApChoices(usage);
  const percentage=(category:string,rank?:number)=>rank?usage?.rows.find(r=>r.category===category&&r.rank===rank)?.percentage??"": "";
  const abilityOptions:ResourcePickerOption[]=pokemon.abilityIds.map(id=>catalog.abilityById.get(id)!).filter(Boolean).map(a=>({id:a.id,name:name(a),searchText:`${a.id} ${a.name} ${a.nameZh} ${a.description} ${a.descriptionZh}`,description:zh?a.descriptionZh:a.description,rank:abilities.get(a.id),meta:percentage("ability",abilities.get(a.id))})).sort((a,b)=>(a.rank??999)-(b.rank??999));
  const groups=["Common","Mega Stone","HP Recovery","Status Cure","PP Recovery","Damage Halving","Other"];
  const stone=catalog.megaStoneIdByPokemonId.get(pokemon.id);
  const itemOptions:ResourcePickerOption[]=catalog.items.map(i=>({id:i.id,name:name(i),searchText:`${i.id} ${i.name} ${i.nameZh} ${i.description} ${i.descriptionZh}`,description:zh?i.descriptionZh:i.description,rank:items.get(i.id),group:items.has(i.id)?"Common":i.category==="Mega Stone"?"Mega Stone":itemEffectCategories(i)[0]??"Other",meta:percentage("held_item",items.get(i.id)),icon:i.imageUrl?<img className="item-icon" src={i.imageUrl} alt="" width={24} height={24}/>:null})).sort((a,b)=>(a.rank??999)-(b.rank??999)||groups.indexOf(a.group!)-groups.indexOf(b.group!)||a.name.localeCompare(b.name));
  const stats=zh?{hp:"HP",attack:"攻擊",defense:"防禦",specialAttack:"特攻",specialDefense:"特防",speed:"速度"}:{hp:"HP",attack:"Atk",defense:"Def",specialAttack:"SpA",specialDefense:"SpD",speed:"Spe"};
  const natureOptions:ResourcePickerOption[]=NATURES.map(n=>{const effect=n.up&&n.down?`${stats[n.up]} ↑ / ${stats[n.down]} ↓`:t("No stat change","能力值不變");return {id:n.name,name:`${name(n)} · ${effect}`,searchText:`${n.name} ${n.nameZh} ${effect}`,description:effect,rank:natures.get(n.name),meta:percentage("stat_alignment",natures.get(n.name))};}).sort((a,b)=>(a.rank??999)-(b.rank??999));
  const spreadOptions:ResourcePickerOption[]=spreads.map(s=>{const text=Object.entries(s.ap).map(([k,v])=>`${stats[k as keyof Stats]} ${v}`).join(" / ");return {id:String(s.rank),name:`${t("DEMO","DEMO")} #${s.rank} · ${text}`,searchText:`${text} ${s.rank} ${s.percentage}`,description:t("Only Speed AP is used in this comparison.","速度線只採用此配置的速度 AP，其餘配點供辨識。"),rank:s.rank,meta:s.percentage};});
  const matching=value.spread?spreads.find(s=>Object.keys(s.ap).every(k=>s.ap[k as keyof Stats]===value.spread?.[k as keyof Stats])):null;
  if(!value.natureName) natureOptions.push({id:`speed-${value.nature}`,name:value.nature==="positive"?t("Speed ↑ (nature unspecified)","速度 ↑（未指定性格名）"):value.nature==="negative"?t("Speed ↓ (nature unspecified)","速度 ↓（未指定性格名）"):t("Neutral Speed (nature unspecified)","速度中性（未指定性格名）"),searchText:"",description:""});
  const selectedNature=value.natureName??`speed-${value.nature}`;
  return <div className="speed-build-ranked">
    <div className="speed-usage-status" role="status">{busy?t("Loading usage; you can edit now…","正在讀取使用率；可先搜尋與設定，不必等待…"):usage?<>{format==="singles"?t("Singles","單打"):t("Doubles","雙打")} · {t("DEMO ranks; choices stay editable","依 DEMO 排名排序，可自由修改")}{source.id!==pokemon.id&&<> · {t("Shared base-form DEMO sample","與原始型態共用 DEMO 範例")}</>}</>:<>{t("Usage unavailable; all demo choices remain searchable.","使用率暫時無法取得；仍可搜尋所有示範選項。")} <button onClick={retry}>{t("Retry","重試")}</button></>}</div>
    <div className="speed-picker-mode"><span>{t("Option descriptions","選項說明")}</span><button aria-pressed={detailed} onClick={()=>setDetailed(true)}>{t("Detailed","詳細")}</button><button aria-pressed={!detailed} onClick={()=>setDetailed(false)}>{t("Compact","精簡")}</button><button disabled={!usage} onClick={()=>{const n=rankedNatureChoices(usage)[0]?.nature,a=spreads[0]?.ap;onChange({mode:"fixed",variantIds:["normal"],abilityId:rankedAbilityChoices(usage,pokemon)[0]?.id??value.abilityId,itemId:pokemon.isMega?stone??null:rankedItemChoices(usage)[0]?.id??value.itemId,...(n?{natureName:n.name,nature:n.up==="speed"?"positive" as const:n.down==="speed"?"negative" as const:"neutral" as const}:{}),...(a?{spread:a,speedAp:a.speed}:{}),condition:{...value.condition,unburden:false}});}}>{t("Apply top choices (assumed)","套用各欄常用配置（推定）")}</button></div>
    <div className="speed-build-controls">
      <ResourcePicker label={t("Ability","特性")} value={value.abilityId} options={abilityOptions} locale={locale} detailed={detailed} onChange={id=>onChange({abilityId:id,variantIds:["normal"],condition:{...value.condition,unburden:false}})}/>
      <ResourcePicker label={t("Held item","持有物")} value={value.itemId??(pokemon.isMega?stone??null:null)} options={itemOptions} locale={locale} detailed={detailed} onChange={id=>onChange({itemId:id,variantIds:["normal"],condition:{...value.condition,unburden:false}})}/>
      <ResourcePicker label={t("Nature","性格")} value={selectedNature} options={natureOptions} locale={locale} detailed={detailed} onChange={id=>{if(!id||id.startsWith("speed-")){onChange({natureName:null});return;}const n=NATURES.find(n=>n.name===id);onChange({natureName:id,nature:n?.up==="speed"?"positive":n?.down==="speed"?"negative":"neutral",mode:"fixed"});}}/>
      <ResourcePicker label={t("AP spread","AP 配置")} value={matching?String(matching.rank):null} options={spreadOptions} locale={locale} detailed={detailed} onChange={id=>{const s=spreads.find(s=>String(s.rank)===id);if(s)onChange({spread:s.ap,speedAp:s.ap.speed,mode:"fixed"});else onChange({spread:null});}}/>
    </div>
    <p className="speed-config-note">{value.mode==="range"?t("AP / nature unknown. Selecting a nature or AP spread switches to a fixed assumption.","目前 AP／性格未知；選擇性格或 AP 配置後，會切換為固定假設。"):t(`Current Speed AP ${value.speedAp}; ${value.nature} Speed nature.`, `目前速度 AP ${value.speedAp}；${value.nature==="positive"?"加速":value.nature==="negative"?"減速":"中性"}性格。`)} {t("Separate rankings are not a joint set frequency.","各欄使用率不是整套配置的聯合機率。")}</p>
  </div>;
}
