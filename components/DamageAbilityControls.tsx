"use client";
import { useState } from 'react';
import { getCatalog } from "../lib/catalog";
import { ALL_TYPES } from '../lib/type-chart';
import { getDamageAbilityCoverage, abilityCoverage } from "../lib/damage-abilities";
import type { DamageCondition } from '../lib/damage';
import { copiesAbility, copiedAbilityChoices } from '../lib/damage-battle-state';
import { ResourcePicker } from './ResourcePicker';

export function DamageAbilityControls({id,condition,zh,onChange}:{id:string|null;condition:DamageCondition;zh:boolean;onChange:(c:DamageCondition)=>void}) {
 const originalId=id;
 if(copiesAbility(id)&&condition.copiedAbilityId&&condition.copiedAbilityId!=='unchanged')id=condition.copiedAbilityId;
 const ability=id?getCatalog().abilityById.get(id):undefined;
 const evidence=id?abilityCoverage(id):null;
 const triggered=['intimidate','flash-fire','unburden','stakeout','electromorphosis','protean','libero'].includes(id??'');
 return <aside className="damage-ability-card">
  {copiesAbility(originalId)&&<div className="damage-current-ability"><ResourcePicker label={zh?'目前複製／繼承的特性':'Current copied / inherited ability'} value={condition.copiedAbilityId} allowClear={false} locale={zh?'zh-Hant':'en'} detailed={false} startAtFirstOption options={[
   {id:'unchanged',name:zh?'尚未觸發／未取得特性':'Not activated / no ability acquired',searchText:'unchanged not activated 尚未觸發 未取得',description:zh?'保留原生特性，尚未獲得其他特性效果。':'Original ability retained; no acquired ability effect.'},
   ...copiedAbilityChoices(originalId!).map(a=>({id:a.id,name:zh?a.nameZh:a.name,searchText:`${a.id} ${a.name} ${a.nameZh} ${a.descriptionZh}`,description:zh?a.descriptionZh:a.description})),
  ]} onChange={copiedAbilityId=>onChange({...condition,copiedAbilityId,abilityOn:false,movesLast:null,disguiseBusted:false})}/><small>{zh?'只設定目前對戰狀態，保留原生特性。雙打請指定實際取得的特性；不會猜測複製目標。取得特性後的能力階級、天氣等請填目前狀態。':'Current battle state only; the original ability stays unchanged. Choose the actual acquired ability, including the chosen target in doubles. Enter current stages and weather separately.'}</small></div>}
  <details className="damage-ability-explanation"><summary>{zh?'效果說明':'Ability details'}</summary><p>{zh?ability?.descriptionZh:ability?.description}</p><p>{zh?evidence?.noteZh:evidence?.scope}</p></details>
  <label className="damage-check"><input type="checkbox" checked={condition.abilityEnabled} onChange={e=>onChange({...condition,abilityEnabled:e.target.checked})}/>{zh?'特性生效':'Ability enabled'}</label>
  {id==='disguise'&&<label>{zh?'畫皮狀態':'Disguise state'}<select value={condition.disguiseBusted?'busted':'intact'} onChange={e=>onChange({...condition,disguiseBusted:e.target.value==='busted'})}><option value="intact">{zh?'完整（尚未擋下攻擊）':'Intact (has not blocked a hit)'}</option><option value="busted">{zh?'已破損':'Busted'}</option></select></label>}
  {triggered&&<label className="damage-check"><input type="checkbox" checked={condition.abilityOn} onChange={e=>onChange({...condition,abilityOn:e.target.checked})}/>{zh?'本次觸發／先前觸發仍有效':'Trigger now / previous activation remains active'}</label>}
  {id==='analytic'&&<label>{zh?'其他場上寶可夢已全數行動？':'Have all other active Pokémon acted?'}<select value={condition.movesLast===null?'unknown':String(condition.movesLast)} onChange={e=>onChange({...condition,movesLast:e.target.value==='unknown'?null:e.target.value==='true'})}><option value="unknown">{zh?'請指定':'Choose'}</option><option value="true">{zh?'是，分析生效':'Yes, Analytic applies'}</option><option value="false">{zh?'否，不套用分析':'No Analytic boost'}</option></select></label>}
  <details open={['rivalry','protean','libero'].includes(id??'')||undefined}><summary>{zh?'性別與目前屬性':'Gender & current types'}</summary><p>{zh?'鬥爭心需指定雙方性別；變幻自如／自由者曾觸發後，請指定目前屬性。這裡描述對戰中狀態，不改變原始配置。':'Rivalry requires both genders. Enter current types after a previous Protean/Libero trigger. These describe battle state, not the original build.'}</p>
  <div className="damage-fields"><label>{zh?'性別':'Gender'}<select value={condition.gender??''} onChange={e=>onChange({...condition,gender:(e.target.value||null) as DamageCondition['gender']})}><option value="">{zh?'未指定':'Unspecified'}</option><option value="M">♂</option><option value="F">♀</option><option value="N">{zh?'無性別':'Genderless'}</option></select></label>
  {[0,1].map(i=><label key={i}>{zh?`目前屬性 ${i+1}`:`Current type ${i+1}`}<select value={condition.currentTypes?.[i]??''} onChange={e=>{const types=[...(condition.currentTypes??[])];types[i]=e.target.value;onChange({...condition,currentTypes:types.filter(Boolean).length?types.filter(Boolean):null});}}><option value="">{zh?(i===0?'使用原始屬性':'無第二屬性'):(i===0?'Original types':'No second type')}</option>{ALL_TYPES.map(t=><option key={t} value={t}>{t}</option>)}</select></label>)}</div></details>
  {id==='stamina'&&<div><p>{zh?`目前防禦階級 ${condition.boosts.defense}。持久力不會先降低第一擊傷害。`:`Current Defense stage ${condition.boosts.defense}. Stamina does not reduce the first hit.`}</p><button type="button" disabled={condition.boosts.defense>=6} onClick={()=>onChange({...condition,boosts:{...condition.boosts,defense:Math.min(6,condition.boosts.defense+1)}})}>{zh?'模擬先前已受一擊：防禦 +1':'One prior hit: Defense +1'}</button><p>{zh?'若已在能力階級填入加成，請勿重複增加；也請更新目前 HP。':'Do not add a trigger already included in your stages. Also update current HP.'}</p></div>}
 </aside>;
}
export function DamageAbilityDirectory({zh}:{zh:boolean}) {
 const [search,setSearch]=useState('');const rows=getDamageAbilityCoverage().filter(a=>`${a.id} ${a.name} ${a.nameZh}`.toLowerCase().includes(search.toLowerCase()));
 return <details className="damage-ability-directory"><summary>{zh?`全部 ${getDamageAbilityCoverage().length} 個特性的計算範圍`:`Scope of all ${getDamageAbilityCoverage().length} abilities`}</summary><p>{zh?'逐項檢視資料說明與計算分支；不代表所有遊戲交互作用已實測。非傷害效果也會列出範圍。':'Implementation notes describe the sample abilities; these are not official game validation. Non-damage effects are included.'}</p><label>{zh?'查找特性':'Find ability'}<input value={search} onChange={e=>setSearch(e.target.value)} placeholder={zh?'名稱、英文或 ID':'Name or ID'}/></label><p>{rows.length} / {getDamageAbilityCoverage().length}</p><div className="damage-ability-list">{rows.map(a=><article key={a.id}><h3>{zh?a.nameZh:a.name} <small>{a.id}</small></h3><p>{zh?a.noteZh:a.scope}</p><p>{zh ? getCatalog().abilityById.get(a.id)?.descriptionZh : getCatalog().abilityById.get(a.id)?.description}</p></article>)}</div></details>;
}
