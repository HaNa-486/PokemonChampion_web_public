"use client";
import {useEffect,useId,useRef,useState} from 'react';
import {SpeedUsageContext,useSpeedUsage} from "../lib/use-speed-usage";
import {LearnableMovesSection,MoveEntry} from './PokemonDetailDialog';
import {InfoTooltip} from './InfoTooltip';
import {ItemTooltip} from './ItemDisplay';
import {SpeedUsageRankings} from './SpeedUsageRankings';
import {getCatalog} from '../lib/catalog';
import {useDialogEscape} from '../lib/use-dialog-escape';
import type {BattleFormat,Pokemon} from '../lib/types';
import type {SpeedCandidate} from '../lib/speed-research';
import type {SpeedBuildMetadata} from './SpeedBuildFields';

export function SpeedDetailPanel({pokemon,format,locale,own=false,value,onChange,observedMoveIds,onToggleObservedMove,onClose,onScrapbook,speedLabel,children}:{pokemon:Pokemon;format:BattleFormat;locale:'en'|'zh-Hant';own?:boolean;value:SpeedCandidate&SpeedBuildMetadata;onChange:(patch:Partial<SpeedCandidate&SpeedBuildMetadata>)=>void;observedMoveIds:string[];onToggleObservedMove:(id:string)=>void;onClose:()=>void;onScrapbook?:(p:Pokemon)=>void;speedLabel:string;children:React.ReactNode}) {
  const [tab,setTab]=useState<'usage'|'moves'>('usage'),id=useId(),zh=locale==='zh-Hant',t=(en:string,cn:string)=>zh?cn:en;
  const usage=useSpeedUsage(pokemon,format),panel=useRef<HTMLElement>(null);
  const [topInset,setTopInset]=useState<number|null>(null),scrolled=useRef(false);
  useEffect(()=>{
    const topbar=document.querySelector('.topbar');let active=true;
    const measure=()=>{if(active)setTopInset(Math.ceil(topbar?.getBoundingClientRect().height??0)+8);};
    queueMicrotask(measure);
    const observer=typeof ResizeObserver==='undefined'?null:new ResizeObserver(measure);
    if(topbar)observer?.observe(topbar);
    return ()=>{active=false;observer?.disconnect();};
  },[]);
  useEffect(()=>{if(topInset!==null&&!scrolled.current){scrolled.current=true;if(window.innerWidth<=700)panel.current?.scrollIntoView?.({block:'start'});}},[topInset]);
  useDialogEscape(onClose);
  const catalog=getCatalog(),ability=catalog.abilityById.get(value.abilityId??''),item=catalog.itemById.get(value.itemId??'');
  const condition=value.condition;
  const updateCondition=(patch:Partial<typeof condition>)=>onChange({condition:{...condition,...patch}});
  const stateLabel=(selected:boolean,enabled:boolean)=>!selected?t('Not selected','未選擇'):enabled?t('Enabled','已啟用'):t('Disabled','已停用');
  const name=zh?pokemon.nameZh||pokemon.name:pokemon.name;
  return <SpeedUsageContext.Provider value={usage}><section ref={panel} style={{scrollMarginTop:(topInset??0)+8}} className="speed-detail-panel" aria-label={name}><header className="speed-detail-header" style={{top:topInset??0}}><img src={pokemon.imageUrl} alt=""/><div className="speed-panel-identity"><h2>{name} <span className="speed-panel-value">{speedLabel}</span></h2><p>{t('Edit assumptions below; the axis updates immediately.','直接調整假設，速度線即時更新。')}</p></div><div className="speed-equipment-summary" role="group" aria-label={t('Current ability and held item','目前特性與持有物')}>
      <div className="speed-equipment-entry" data-enabled={Boolean(ability&&condition.abilityEnabled)}><span>{t('Ability','特性')}</span>{ability?<InfoTooltip label={zh?ability.nameZh:ability.name}><strong>{zh?ability.nameZh:ability.name}</strong><p>{zh?ability.descriptionZh:ability.description}</p></InfoTooltip>:<strong>—</strong>}<b>{stateLabel(Boolean(ability),condition.abilityEnabled)}</b></div>
      <div className="speed-equipment-entry" data-enabled={Boolean(item&&condition.itemEnabled)}><span>{t('Held item','持有物')}</span>{item?<ItemTooltip item={item} locale={locale} size={20}/>:<strong>—</strong>}<b>{stateLabel(Boolean(item),condition.itemEnabled)}</b></div>
    </div><button className="speed-jump-axis" onClick={()=>{const axis=document.querySelector<HTMLElement>(".speed-battle-board");if(axis){axis.style.scrollMarginTop=`${(topInset??0)+8}px`;axis.scrollIntoView({block:"start"});}}}>{t("View axis","看速度軸")}</button><button onClick={onClose} aria-label={t('Close Pokémon panel','關閉寶可夢面板')}>×</button></header>
    <div className="speed-quick-controls" role="group" aria-label={t('Battle adjustments','對戰快速調整')}>
      <label className="speed-quick-toggle"><input type="checkbox" checked={condition.abilityEnabled} onChange={e=>updateCondition({abilityEnabled:e.target.checked})}/><span>{t('Ability enabled','特性生效')}</span></label>
      <label className="speed-quick-toggle"><input type="checkbox" checked={condition.itemEnabled} onChange={e=>updateCondition({itemEnabled:e.target.checked})}/><span>{t('Item enabled','道具生效')}</span></label>
      <label>{t('Extra Speed stage','額外速度階級')}<select value={condition.stage} onChange={e=>updateCondition({stage:Number(e.target.value)})}>{Array.from({length:13},(_,i)=>i-6).map(n=><option key={n} value={n}>{n>0?`+${n}`:n}</option>)}</select></label>
      <label>{t('Status','個別狀態')}<select value={condition.status} onChange={e=>updateCondition({status:e.target.value as typeof condition.status})}><option value="none">{t('None','無異常')}</option><option value="paralysis">{t('Paralysis','麻痺')}</option><option value="other">{t('Other status','其他異常')}</option></select></label>
      {value.abilityId==='unburden'&&<label className="speed-quick-toggle"><input type="checkbox" checked={condition.unburden} onChange={e=>updateCondition({unburden:e.target.checked})}/><span>{t('Unburden triggered (item lost)','輕裝已觸發（道具已失去）')}</span></label>}
    </div>
    <div className="speed-observed" role="region" aria-label={own?t('Configured moves','已配置招式'):t('Observed moves','已確認招式')}><strong>{own?t('Configured moves','已配置招式'):t('Observed moves','已確認招式')} {observedMoveIds.length}/4</strong>{observedMoveIds.map(moveId=>{const move=getCatalog().moveById.get(moveId);return <span className="speed-observed-move" key={moveId}>{move?<MoveEntry move={move} locale={locale} compact/>:<strong>{moveId}</strong>}{!pokemon.moveIds.includes(moveId)&&<small>{t('Check form','請核對型態')}</small>}<button className="speed-move-remove" onClick={()=>onToggleObservedMove(moveId)} aria-label={`${t('Unrecord','取消紀錄')} ${move?(zh?move.nameZh:move.name):moveId}`}>×</button></span>;})}<small>{observedMoveIds.length===4?t('Four recorded. Uncheck one to replace it.','已記錄四招；取消其中一招即可更換。'):own?t('Copied from your team; changes here stay in Speed research.','載入時帶入隊伍招式；此處修改只影響速度線。'):t('Check moves in either tab to record them.','在任一分頁勾選招式即可記錄。')}</small></div>
    <div className="speed-detail-tabs" role="tablist" aria-label={t('Pokémon research','寶可夢研究')}>{(['usage','moves'] as const).map((key,i)=><button id={`${id}-${key}`} key={key} role="tab" aria-selected={tab===key} aria-controls={`${id}-${key}-panel`} tabIndex={tab===key?0:-1} onClick={()=>setTab(key)} onKeyDown={e=>{if(['ArrowLeft','ArrowRight','Home','End'].includes(e.key)){e.preventDefault();const next=e.key==='Home'?'usage':e.key==='End'?'moves':tab==='usage'?'moves':'usage';setTab(next);document.getElementById(`${id}-${next}`)?.focus();}}}>{i===0?t('Usage & settings','使用率與設定'):t('Learnable moves','可學招式')}</button>)}</div>
    <div id={`${id}-usage-panel`} role="tabpanel" aria-labelledby={`${id}-usage`} hidden={tab!=='usage'}><details className="speed-manual-settings"><summary>{t('Search choices & manual settings','搜尋選項與手動設定')}</summary>{children}</details><SpeedUsageRankings pokemon={pokemon} format={format} locale={locale} value={value} onChange={onChange} observedMoveIds={observedMoveIds} onToggleObservedMove={onToggleObservedMove}/></div>
    <div id={`${id}-moves-panel`} role="tabpanel" aria-labelledby={`${id}-moves`} hidden={tab!=='moves'}><LearnableMovesSection pokemon={pokemon} locale={locale} observedMoveIds={observedMoveIds} onToggleObservedMove={onToggleObservedMove} onScrapbook={onScrapbook}/></div>
  </section></SpeedUsageContext.Provider>;
}
