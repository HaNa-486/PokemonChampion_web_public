"use client";
import type {ReactNode} from "react";
import type {SpeedStudy} from "../lib/speed-research";
import { useEffect, useRef, useState } from "react";

export type AxisEntry={id:string;name:string;image:string;side:"own"|"enemy";min:number;max:number;fixed:boolean;warning:boolean;error:string|null};
export function SpeedBattleAxis({entries,trickRoom,field,ownTailwind=false,enemyTailwind=false,controls,target,onSelect,onRemove,selectedId,locale}:{entries:AxisEntry[];trickRoom:boolean;field?:SpeedStudy["field"];ownTailwind?:boolean;enemyTailwind?:boolean;controls?:ReactNode;target:number|null;onSelect:(id:string)=>void;onRemove?:(id:string)=>void;selectedId?:string|null;locale:"en"|"zh-Hant"}) {
  const zh=locale==="zh-Hant",t=(en:string,cn:string)=>zh?cn:en,ref=useRef<HTMLDivElement>(null),[width,setWidth]=useState(1100),[active,setActive]=useState<string|null>(null);
  useEffect(()=>{if(!ref.current||typeof ResizeObserver==="undefined")return;const observer=new ResizeObserver(([e])=>setWidth(e.contentRect.width));observer.observe(ref.current);return ()=>observer.disconnect();},[]);
  const upper=Math.ceil(Math.max(100,target??0,...entries.filter(e=>!e.error).map(e=>e.max))/50)*50;
  const x=(speed:number)=>64+(trickRoom?speed/upper:1-speed/upper)*(width-128);
  // Keep six labels per side in two rows; leaders preserve exact numerical anchors.
  const placed=(["own","enemy"] as const).flatMap(side=>{
    const rows=entries.filter(e=>e.side===side).map(e=>({...e,pos:x((e.min+e.max)/2),labelX:x((e.min+e.max)/2)})).sort((a,b)=>a.pos-b.pos||a.id.localeCompare(b.id));
    rows.forEach((e,i)=>{e.labelX=Math.max(e.labelX,i?rows[i-1].labelX+116:64);});
    for(let i=rows.length-1;i>=0;i--)rows[i].labelX=Math.min(rows[i].labelX,i===rows.length-1?width-64:rows[i+1].labelX-116);
    return rows;
  });
  const axisY=154,height=330;
  const weather=field?.weather??"none",weatherLabels={none:t("No weather","無天氣"),sun:t("☀ Sun","☀ 晴天"),rain:t("☂ Rain","☂ 雨天"),sand:t("≋ Sandstorm","≋ 沙暴"),snow:t("❄ Snow","❄ 下雪")};
  return <div className={`speed-battle-board weather-${weather} ${field?.electricTerrain?"has-electric-terrain":""} ${trickRoom?"is-trick-room":""}`} data-weather={weather}>
    <div className="speed-field-status" role="status" aria-label={t("Current battlefield","目前戰場")}>{weatherLabels[weather]} · {field?.electricTerrain?t("Electric Terrain","電氣場地"):""} · {t("Own","我方")} · {ownTailwind?t("Tailwind ×2","順風 ×2"):t("No Tailwind","無順風")} · {t("Enemy","敵方")} · {enemyTailwind?t("Tailwind ×2","順風 ×2"):t("No Tailwind","無順風")}</div>
    <div className="speed-axis-heading"><strong className="speed-order-start">{t("ACTS EARLIER","較早出手")} →</strong>{controls??<span>{trickRoom?t("Trick Room · slower first","戲法空間 · 慢速先動"):t("Normal · faster first","一般狀態 · 高速先動")}</span>}<strong className="speed-order-end">→ {t("ACTS LATER","較晚出手")}</strong></div>
    <p className="speed-mobile-pan">{t("← Swipe the shared axis to see both ends →","← 左右滑動速度軸，查看完整隊伍 →")}</p>
    <div className="speed-weather-stage">
      {weather!=="none"&&<svg className="speed-weather-watermark" data-weather={weather} viewBox="0 0 760 330" preserveAspectRatio="xMidYMid meet" aria-hidden="true"><g fill="none" stroke="currentColor" strokeWidth="5" strokeLinecap="round" strokeLinejoin="round">
        {weather==="sun"&&<g transform="translate(380 165)"><circle r="68"/>{Array.from({length:12},(_,i)=><path key={i} d="M 0 -91 L 0 -124" transform={`rotate(${i*30})`}/>)}</g>}
        {weather==="rain"&&<g><path d="M255 123 C211 123 211 65 255 65 C267 14 336 14 355 65 C398 45 432 77 414 112 C464 108 476 160 434 170 H275"/>{[270,330,390,450].map((x,i)=><path key={x} d={`M${x} ${190+i%2*28} l-24 40 m-6 20 l-12 20`}/>)}</g>}
        {weather==="sand"&&<g>{[80,130,180,230].map((y,i)=><path key={y} d={`M140 ${y} C240 ${y-70} 320 ${y+70} 420 ${y} S580 ${y-45} 620 ${y+10}`}/>)}{[180,260,340,430,510,590].map((x,i)=><circle key={x} cx={x} cy={60+i%3*90} r="4" fill="currentColor"/>)}</g>}
        {weather==="snow"&&<g transform="translate(380 165)">{Array.from({length:6},(_,i)=><path key={i} d="M0 0 V-125 M0 -65 L-30 -92 M0 -65 L30 -92 M0 -100 L-18 -118 M0 -100 L18 -118" transform={`rotate(${i*60})`}/>)}</g>}
      </g></svg>}
    <div className="speed-axis-scroll" tabIndex={0} role="region" aria-label={t("Shared Speed axis; scroll horizontally on small screens","共用速度軸；窄螢幕可左右滑動")}><div ref={ref} className="speed-shared-axis" style={{height}} data-testid="speed-shared-axis">
      <svg className="speed-axis-lines" width="100%" height={height} aria-hidden="true">
        <line className="speed-main-axis" x1={32} x2={width-32} y1={axisY} y2={axisY}/>
        {Array.from({length:6},(_,i)=>{const v=Math.round(upper*i/5);return <g key={i}><line className="speed-axis-tick" x1={x(v)} x2={x(v)} y1={axisY-6} y2={axisY+6}/><text x={x(v)} y={axisY+24} textAnchor="middle">{v}</text></g>;})}
        {target!==null&&<g><line className="speed-axis-target" x1={x(target)} x2={x(target)} y1={12} y2={height-12}/><text className="speed-target-caption" x={x(target)} y={height-4} textAnchor="middle">{t("Target","基準")} {target}</text></g>}
        {placed.map(e=>{const top=e.side==="own",y=top?axisY-30:axisY+44;return <g key={e.id} className={`speed-axis-mark ${e.side} ${active===e.id?"highlighted":""}`} opacity={active&&active!==e.id?0.18:1}>
          {!e.error&&<><line className="speed-axis-stem" x1={e.pos} x2={e.labelX} y1={axisY} y2={y}/><line className="speed-axis-interval" x1={x(e.min)} x2={x(e.max)} y1={axisY+(top?-9:9)} y2={axisY+(top?-9:9)}/><circle cx={e.pos} cy={axisY} r={5}/></>}
        </g>;})}
      </svg>
      {placed.map(e=>{const top=e.side==="own",y=top?12:axisY+44;return <div key={e.id} className="speed-axis-node" style={{left:e.labelX-54,top:y}}><button className={`speed-axis-pokemon ${e.side} ${e.error?"has-error":""} ${selectedId===e.id?"is-selected":""}`} aria-pressed={selectedId===e.id} onMouseEnter={()=>setActive(e.id)} onMouseLeave={()=>setActive(null)} onFocus={()=>setActive(e.id)} onBlur={()=>setActive(null)} onClick={()=>onSelect(e.id)} aria-label={`${e.name} · ${e.side==="own"?t("Own","我方"):t("Enemy","對方")} · ${e.error?t("Fix conditions","修正條件"):e.min===e.max?e.min:`${e.min}–${e.max}`} · ${t("Edit","設定")}`}>
        <span className="speed-axis-side">{e.side==="own"?t("OWN","我方"):t("ENEMY","對方")}{(e.side==="own"?ownTailwind:enemyTailwind)?" ≋":""}{e.warning?" ⚠":""}</span><img src={e.image} alt=""/><strong>{e.name}</strong><b>{e.error?"⚠":e.min===e.max?e.min:`${e.min}–${e.max}`}</b>{!e.fixed&&<small>{t("Unknown AP","未知配點")}</small>}
      </button>{onRemove&&<button className="speed-axis-remove" aria-label={`${t("Remove","移除")} ${e.name} · ${e.side==="own"?t("Own","我方"):t("Enemy","對方")}`} onClick={()=>onRemove(e.id)}>×</button>}</div>;})}
    </div></div></div>
    <p className="speed-axis-legend"><span className="own">● {t("Own","我方")}</span><span className="enemy">◆ {t("Enemy","對方")}</span><span>{t("Point = fixed Speed · band = possible range. Labels move to avoid overlap; follow their leaders to the axis. Unknown anchors mark the range midpoint, not expected Speed. Overlaps do not establish order; tied Speed is random.","定點＝確定速度，橫線＝可能範圍。標籤會避讓，請沿連線查看軸上位置；未知配點的錨點是區間中點，不代表預測速度。區間重疊不代表確定順序；同速隨機決定。")}</span></p>
  </div>;
}
