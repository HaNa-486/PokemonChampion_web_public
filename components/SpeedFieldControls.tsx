"use client";
import type {SpeedStudy} from '../lib/speed-research';

export function SpeedFieldControls({field,ownTailwind,enemyTailwind,onFieldChange,onTailwindChange,locale}:{field:SpeedStudy['field'];ownTailwind:boolean;enemyTailwind:boolean;onFieldChange:(patch:Partial<SpeedStudy['field']>)=>void;onTailwindChange:(side:'own'|'enemy',enabled:boolean)=>void;locale:'en'|'zh-Hant'}) {
  const zh=locale==='zh-Hant',t=(en:string,cn:string)=>zh?cn:en;
  return <div className="speed-field-controls" role="group" aria-label={t('Battlefield controls','戰場快速切換')}>
    {(['own','enemy'] as const).map(side=>{const active=side==='own'?ownTailwind:enemyTailwind;return <button key={side} className={`speed-field-toggle ${side}`} aria-pressed={active} onClick={()=>onTailwindChange(side,!active)} aria-label={`${side==='own'?t('OWN SIDE','我方全隊'):t('ENEMY SIDE','對方全隊')} ${t('Tailwind','順風')} ${active?'ON · ×2':'OFF'}`}><span aria-hidden="true">≋</span> {side==='own'?t('Own Tailwind','我方順風'):t('Enemy Tailwind','敵方順風')} <b>{active?'ON ×2':'OFF'}</b></button>;})}
    <div className="speed-field-order"><button className="speed-field-toggle room" aria-label={`${t('Trick Room','戲法空間')} ${field.trickRoom?'ON':'OFF'}`} aria-pressed={field.trickRoom} onClick={()=>onFieldChange({trickRoom:!field.trickRoom})}>⇄ {field.trickRoom?t('Trick Room','戲法空間'):t('Normal','一般狀態')}</button><span>{field.trickRoom?t('Slower first','低速先動'):t('Faster first','高速先動')}</span></div>
    <label className="speed-field-weather"><select aria-label={t('Weather','共同天氣')} value={field.weather} onChange={e=>onFieldChange({weather:e.target.value as typeof field.weather})}>{['none','sun','rain','sand','snow'].map((v,i)=><option key={v} value={v}>{(zh?['○ 無天氣','☀ 晴天','☂ 雨天','≋ 沙暴','❄ 下雪']:['○ No weather','☀ Sun','☂ Rain','≋ Sand','❄ Snow'])[i]}</option>)}</select></label>
    <label className="speed-field-terrain" data-active={field.electricTerrain}><input type="checkbox" checked={field.electricTerrain} onChange={e=>onFieldChange({electricTerrain:e.target.checked})}/>⚡ {t('Electric Terrain','電氣場地')} <b>{field.electricTerrain?'ON':'OFF'}</b></label>
  </div>;
}
