"use client";
import {getCatalog} from '../lib/catalog';
import {rankedAbilityChoices,rankedItemChoices,rankedNatureChoices,rankedApChoices,rankedMoveChoices} from '../lib/battle-recommendations';
import {useSpeedUsage} from '../lib/use-speed-usage';
import {UsageFreshness} from './UsageFreshness';
import {UsageEntry} from './PokemonDetailDialog';
import type {BattleFormat,Pokemon} from '../lib/types';
import type {SpeedCandidate} from '../lib/speed-research';
import type {SpeedBuildMetadata} from './SpeedBuildFields';

export function SpeedUsageRankings({pokemon,format,locale,value,onChange,observedMoveIds,onToggleObservedMove}:{pokemon:Pokemon;format:BattleFormat;locale:'en'|'zh-Hant';value:SpeedCandidate&SpeedBuildMetadata;onChange:(patch:Partial<SpeedCandidate&SpeedBuildMetadata>)=>void;observedMoveIds:string[];onToggleObservedMove:(id:string)=>void}) {
  const {usage,busy,retry}=useSpeedUsage(pokemon,format),zh=locale==='zh-Hant',t=(en:string,cn:string)=>zh?cn:en;
  if(busy)return <p role="status">{t('Loading rankings; expand manual settings to edit now.','正在載入排名；展開手動設定即可立即使用。')}</p>;
  if(!usage)return <p role="status">{t('Rankings unavailable. Manual settings and learnable moves still work.','暫時無法取得排名，仍可使用手動設定與可學招式。')} <button onClick={retry}>{t('Retry rankings','重試排名')}</button></p>;
  const abilities=rankedAbilityChoices(usage,pokemon,Infinity),items=rankedItemChoices(usage,Infinity),natures=rankedNatureChoices(usage,Infinity),spreads=rankedApChoices(usage,Infinity),moves=rankedMoveChoices(usage,pokemon,Infinity);
  const groups=[['ability','Abilities','特性'],['stat_points','AP spreads','AP 配置'],['stat_alignment','Natures','性格'],['held_item','Held items','持有物'],['move','Moves','招式']] as const;
  return <div className="speed-ranking-grid"><p className="speed-ranking-provenance"><UsageFreshness provenance={usage.provenance} locale={locale} missingCategories={usage.missingCategories}/><br/>{format==='singles'?t('Singles','單打'):t('Doubles','雙打')}<br/>{getCatalog().battleDataSourcePokemon(pokemon).id!==pokemon.id&&t('Shared base-form DEMO fixture. ','與原型共用 DEMO 範例。')}{t('Each category is a separate fabricated distribution. Moves reflect your records or the copied team, not usage predictions.','各欄皆為獨立虛構使用率；招式依你的紀錄或載入隊伍勾選，不依使用率推定。')}</p>{groups.map(([category,en,cn])=>{
    const rows=usage.rows.filter(r=>r.category===category).sort((a,b)=>a.rank-b.rank);
    return <section key={category} className={`speed-rank-section ${category==='move'?'speed-rank-moves':''}`} aria-label={t(en,cn)}><h3>{t(en,cn)}</h3><div className="usage-table"><div className="speed-usage-head"><span>DEMO #</span><span>{t('Select / details','選用／說明')}</span><span>{t('DEMO usage','DEMO 使用率')}</span></div>{rows.map((row,i)=>{
      const ability=abilities.find(x=>x.rank===row.rank),item=items.find(x=>x.rank===row.rank),nature=natures.find(x=>x.rank===row.rank)?.nature,spread=spreads.find(x=>x.rank===row.rank)?.ap,move=moves.find(x=>x.rank===row.rank);
      const selected=category==='ability'?Boolean(ability&&value.abilityId===ability.id):category==='held_item'?Boolean(item&&value.itemId===item.id):category==='stat_alignment'?Boolean(nature&&value.natureName===nature.name):category==='stat_points'?Boolean(spread&&value.spread&&Object.keys(spread).every(k=>spread[k as keyof typeof spread]===value.spread?.[k as keyof typeof spread])):Boolean(move&&observedMoveIds.includes(move.id));
      const applicable=category==='ability'?ability:category==='held_item'?item:category==='stat_alignment'?nature:category==='stat_points'?spread:move;
      const apply=()=>{if(category==='move'&&move){onToggleObservedMove(move.id);return;}if(category==='ability'&&ability)onChange({abilityId:ability.id,condition:{...value.condition,unburden:false}});if(category==='held_item'&&item)onChange({itemId:item.id,condition:{...value.condition,unburden:false}});if(category==='stat_alignment'&&nature)onChange({mode:'fixed',natureName:nature.name,nature:nature.up==='speed'?'positive':nature.down==='speed'?'negative':'neutral'});if(category==='stat_points'&&spread)onChange({mode:'fixed',spread,speedAp:spread.speed});};
      const moveName=move?getCatalog().moveById.get(move.id):null;
      return <div key={`${row.rank}-${i}`} className={`speed-usage-row ${selected?'selected':''}`}><b>{row.rank}</b><div className="speed-ranked-choice"><input type={category==='move'?'checkbox':'radio'} name={category==='move'?undefined:`speed-usage-${category}`} checked={selected} disabled={!applicable||(category==='move'&&!selected&&observedMoveIds.length>=4)} onChange={apply} aria-label={category==='move'&&moveName?`${t('Record move','記錄招式')} ${zh?moveName.nameZh:moveName.name}`:`${t('Apply','套用')} ${t(en,cn)} #${row.rank}`}/><div><UsageEntry category={category} row={row} locale={locale}/>{!applicable&&<small>{t('Unavailable for this form','此型態無法選用')}</small>}</div></div><strong>{row.percentage||'—'}</strong></div>;
    })}</div>{!rows.length&&<p>{t('No source data for this category.','來源未提供此欄資料。')}</p>}</section>;
  })}</div>;
}
