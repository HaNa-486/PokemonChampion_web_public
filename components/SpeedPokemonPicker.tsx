"use client";
import {useMemo,useState} from 'react';
import {getCatalog} from '../lib/catalog';
import {filterSpeedPicker,speedPickerDex,speedPickerRankSource,speedPickerRank,speedPickerSorts,type SpeedPickerSort} from '../lib/speed-picker';
import {useUsageRankings} from '../lib/use-usage';
import {UsageFreshness} from './UsageFreshness';
import {ALL_TYPES} from '../lib/type-chart';
import {TypeBadge} from './TypeBadge';
import {useSessionState} from '../lib/use-session-state';
import type {BattleFormat} from '../lib/types';

export function SpeedPokemonPicker({locale,format,side,onSideChange,count,total,onAdd,selections=[],onRemove}:{locale:'en'|'zh-Hant';format:BattleFormat;side:'own'|'enemy';onSideChange:(side:'own'|'enemy')=>void;count:number;total:number;onAdd:(id:string)=>void;selections?:{id:string;pokemonId:string;side:"own"|"enemy"}[];onRemove?:(id:string)=>void}) {
  const zh=locale==='zh-Hant',t=(en:string,cn:string)=>zh?cn:en;
  const [query,setQuery]=useState(''),[types,setTypes]=useState<string[]>([]),[match,setMatch]=useState<'or'|'and'>('or');
  const [sort,setSort]=useSessionState<SpeedPickerSort>('speed-picker-sort','usage',v=>speedPickerSorts.includes(v as SpeedPickerSort));
  const rankingState=useUsageRankings(),rankings=rankingState.value!,ranks=rankings.ranksByBattleDataKey;
  const pokemon=getCatalog().pokemon;
  const roster=selections.filter(s=>s.side===side);
  const entries=useMemo(()=>filterSpeedPicker(pokemon,{locale,format,sort,query,types,match,ranks}),[pokemon,locale,format,sort,query,types,match,ranks]);
  return <>
    <div className="speed-picker-toolbar"><label>{t('Side','隊伍')}<select value={side} onChange={e=>onSideChange(e.target.value as typeof side)}><option value="own">{t('Own','我方')}</option><option value="enemy">{t('Enemy','敵方')}</option></select></label><label>{t('Find Pokémon','搜尋寶可夢')}<input autoFocus value={query} onChange={e=>setQuery(e.target.value)}/></label><label>{t('Sort','排序')}<select value={sort} onChange={e=>setSort(e.target.value as SpeedPickerSort)}>{speedPickerSorts.map((s,i)=><option value={s} key={s}>{(zh?['DEMO 排名','速度種族值：高 → 低','速度種族值：低 → 高','全國圖鑑編號','名稱']:['DEMO rank','Base Speed: high → low','Base Speed: low → high','National Dex','Name'])[i]}</option>)}</select></label></div>
    <section className="speed-picker-roster" aria-label={t('Selected roster','已選隊伍')}><h3>{side==='own'?t('Own side','我方'):t('Enemy side','敵方')} · {t('Selected','已選擇')} {count}/6</h3><div>{roster.map(entry=>{const p=getCatalog().pokemonById.get(entry.pokemonId);if(!p)return null;const name=zh?p.nameZh||p.name:p.name;return <div className="speed-picker-selected" key={entry.id}><img src={p.imageUrl} alt=""/><strong>{name}</strong>{onRemove&&<button onClick={()=>onRemove(entry.id)} aria-label={`${t('Remove selected','移除已選')} ${name}`}>×</button>}</div>;})}{!roster.length&&<p>{t('No Pokémon selected on this side.','此方尚未加入寶可夢。')}</p>}</div><small>{t('One form per species on each side. Remove a selection to change its form.','每方同種寶可夢只能選一個型態；移除後即可改選。')}</small></section>
    <details className="speed-type-filter"><summary>{t("Type filters","屬性篩選")} · {types.length} · {match.toUpperCase()}</summary><div className="speed-filter-heading"><strong>{t('Types','屬性')}</strong><button aria-pressed={match==='or'} onClick={()=>setMatch('or')}>{t('Any (OR)','任一 OR')}</button><button aria-pressed={match==='and'} onClick={()=>setMatch('and')}>{t('All (AND)','全部 AND')}</button><button onClick={()=>{setTypes([]);setQuery('');setMatch('or');}}>{t('Reset filters','重設篩選')}</button></div><div className="speed-type-chips">{ALL_TYPES.map(type=><button className="filter-chip" key={type} aria-pressed={types.includes(type)} onClick={()=>setTypes(types.includes(type)?types.filter(v=>v!==type):[...types,type])}><TypeBadge type={type} locale={locale}/></button>)}</div></details>
    <details className="speed-picker-source"><summary>{t("DEMO usage details","DEMO 使用率說明")} · {format==='singles'?t('Singles','單打'):t('Doubles','雙打')}</summary><p><UsageFreshness provenance={rankings.provenance} locale={locale}/><br/>{t('Ranks are invented examples. Mega forms share the base fixture; Speed sorting uses each form’s base Speed.','排名是虛構範例。超級型態共用原型範例；速度排序依各型態的速度種族值。')}</p></details>
    <p role="status">{t('Selected','已加入')} {count}/6 · {total}/12 · {t('Results','結果')} {entries.length}{count>=6&&` · ${t('This side is full; switch sides or remove a Pokémon.','此方已滿，請切換隊伍或移除寶可夢。')}`}</p>
    <div className="speed-picker-results">{entries.map(p=>{const rank=speedPickerRank(p,format,ranks),shared=speedPickerRankSource(p,format,ranks).id!==p.id,selected=roster.find(s=>getCatalog().pokemonById.get(s.pokemonId)?.speciesKey===p.speciesKey);return <button key={p.id} className={selected?"is-added":""} disabled={Boolean(selected)||count>=6||total>=12} onClick={()=>onAdd(p.id)} aria-label={`${t('Add','加入')} ${zh?p.nameZh||p.name:p.name}`}><img src={p.imageUrl} alt=""/><span><strong>{zh?p.nameZh||p.name:p.name}</strong><small>{rank===null?t('No DEMO rank','無 DEMO 排名'):`DEMO #${rank}`} {shared?t('· shared','· 共用'):''} · {t('Base Spe','速度種族值')} {p.baseStats.speed}</small><small>#{speedPickerDex(p)??'—'} · {p.isMega?(p.name.endsWith(' Z')?'Mega Z':'Mega'):t('Base / other form','原型／其他型態')}</small></span>{selected&&<small className="speed-picker-added">✓ {selected.pokemonId===p.id?t('Selected','已選擇'):t('Another form selected','已選同種其他型態')}</small>}<b>{selected?'✓':'＋'}</b></button>;})}</div>{!entries.length&&<p>{t('No Pokémon match these filters.','沒有符合條件的寶可夢。')}</p>}
  </>;
}
