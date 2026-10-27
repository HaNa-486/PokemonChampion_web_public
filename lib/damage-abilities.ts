import { getCatalogRelease, type CatalogRelease } from './catalog-release';
import audit from '../data/damage-ability-coverage.json';
import { getCatalog } from "./catalog";
const updated: Record<string,[string,string,string]> = {
  'trace':['requires-explicit-condition','指定目前複製的特性，或明確選擇尚未觸發；使用複製後的效果與條件。','Choose the acquired ability or explicitly not activated. Uses effective ability conditions.'],
  'receiver':['requires-explicit-condition','雙打指定目前繼承的特性；單打或尚未繼承時選擇尚未觸發。','Choose inherited ability in doubles; otherwise select not activated.'],
  'imposter':['unsupported-needs-refusal','尚未支援變身後原本 HP、複製能力值與招式的組合；不能直接換成目標配置。','Transform requires original HP with copied stats and moves; replacing the species is not equivalent.'],
  'parental-bond':['automatic-supported','適用招式以親子兩擊分別計算；指定擊數、範圍及蓄力招式不額外加擊。部分依 HP 決定傷害、拍落／硬壓或擊間換特性組合仍未支援。','Eligible attacks include the child hit. Native multi-hit, spread and charge moves do not gain an extra hit; fixed-HP, Knock Off/Hard Press and between-hit replacement combinations remain unsupported.'],
  'disguise':['requires-explicit-condition','指定完整或已破損。完整畫皮擋下首次有效傷害並損失最大 HP 的八分之一；結果明列破皮 HP 損失。完整畫皮＋會觸發的減傷果＋原生多擊仍未支援。','Specify intact or busted. The first effective hit is blocked and loses floor(maxHP/8), explicitly reported as HP loss. Intact Disguise plus a triggering resist Berry and native multi-hit is not supported.'],
  'damp':['automatic-supported','阻止自爆類招式；破格可略過其他持有者的濕氣。','Blocks Explosion-family moves; Mold Breaker bypasses other holders.'],
  'mirror-armor':['requires-explicit-condition','威嚇啟動時反射降低攻擊；其他先前變化請輸入目前階級。','Reflects explicit entry Intimidate; enter current stages for other prior events.'],
  'analytic':['requires-explicit-condition','請指定是否最後出手，不會只憑双方速度猜測。','Specify movesLast across all active combatants; speed alone is insufficient.'],
  'protean':['requires-explicit-condition','輸入目前屬性；若本次首次觸發則勾選觸發特性。','Enter currentTypes or activate a new attack trigger; no automatic repeated STAB.'],
  'libero':['requires-explicit-condition','輸入目前屬性；若本次首次觸發則勾選觸發特性。','Enter currentTypes or activate a new attack trigger; no automatic repeated STAB.'],
  'mimicry':['automatic-supported','依目前場地自動轉為單一屬性。','Uses the single type of the effective terrain.'],
  'rivalry':['requires-explicit-condition','需指定攻守雙方性別；無性別不獲加成。','Requires both genders; genderless gets no modifier.'],
  'friend-guard':['ally-field-supported','只保護隊友；在雙打防守方隊友特性設定。破格可略過。','Set defenderAllyAbility in doubles; never protects the holder itself. Mold Breaker bypasses.'],
  'steely-spirit':['ally-field-supported','本人及隊友各自提供鋼招式威力加成；隊友須另外設定。','Self and allied Steel boosts stack in the fixed-point base-power chain.'],
  'stamina':['requires-explicit-condition','每擊使用該擊前的防禦階級；連擊會在存活的各擊之間提升。另一次出招請更新階級與 HP。','This hit uses current Defense; multi-hit moves raise it between surviving hits. Update stages/HP for a separate move.'],
  'plus':['ally-field-supported','雙打設定正電或負電隊友後自動生效。','Automatically applies with a Plus/Minus ally in doubles.'],
  'minus':['ally-field-supported','雙打設定正電或負電隊友後自動生效。','Automatically applies with a Plus/Minus ally in doubles.'],
  'fairy-aura':['ally-field-supported','本人、對手或場上隊友的妖精氣場會套用；不重複疊加。','Participant or allied aura applies once.'],
  'queenly-majesty':['ally-field-supported','阻止對手先制招式；隊友保護另由双打隊友設定。','Blocks opposing priority attacks; allied coverage is explicit.'],
  'armor-tail':['ally-field-supported','阻止對手先制招式；隊友保護另由双打隊友設定。','Blocks opposing priority attacks; allied coverage is explicit.'],
  'cloud-nine':['ally-field-supported','本人或場上隊友會使有效天氣失效。','Participant or explicit ally suppresses weather.'],
  'lightning-rod':['ally-field-supported','自身免疫；若隊友會引走招式，需改選真正受擊者。','Self immunity; ally redirection requires selecting the actual receiver.'],
};
const categoryZh:Record<string,string>={
 'automatic-supported':'依招式與目前狀態自動套用；命中後效果不包含在此傷害數字。',
 'requires-explicit-condition':'請指定目前血量、狀態、階級或場地；先前觸發造成的變化須填入目前狀態。',
 'out-of-scope-non-damage-effect':'不改變本次成功命中的直接傷害；命中率、附加效果、回血、反傷及回合結束效果不在單次傷害範圍。',
 'unsupported-needs-refusal':'涉及未提供的複製、變身或多段狀態；受影響的計算會拒絕或需選擇實際狀態。',
 'ally-field-support-missing':'目前僅處理本次直接攻擊；隊友／先前事件的影響請填入目前狀態，部分交互作用尚未支援。',
 'ally-field-supported':'由雙打隊友特性設定；不會把隊友效果套在錯誤一方。',
};
const abilityIdsCache=new WeakMap<CatalogRelease,Set<string>>();
const currentAbilityIds=()=>{const release=getCatalogRelease();let ids=abilityIdsCache.get(release);if(!ids){ids=new Set(getCatalog().pokemon.flatMap(p=>p.abilityIds));abilityIdsCache.set(release,ids);}return ids;};
export const isCurrentChampionsAbility=(id:string)=>getCatalog().abilityById.has(id)&&currentAbilityIds().has(id);
export function abilityCoverage(id:string) {
 const row=audit.find(a=>a.id===id);const ability=getCatalog().abilityById.get(id);
 if(!ability || !isCurrentChampionsAbility(id)) throw new Error(`Ability is not included in this demo catalog: ${id}`);
 if(!row)return {id,name:ability.name,nameZh:ability.nameZh,category:'pending-engine-review',noteZh:'已納入示範圖鑑；傷害引擎尚待驗證，不會直接套用一般系列效果。',scope:'Demo catalog entry; calculation review pending.',description:ability.description,descriptionZh:ability.descriptionZh,review:'pending',limitations:['New ability has not been reviewed against the pinned engine.']};
 const update=updated[id];
 return {id,name:ability.name,nameZh:ability.nameZh,category:update?.[0]??row.classification,
   noteZh:update?.[1]??categoryZh[row.classification],scope:update?.[2]??row.scope,
   description:ability.description,descriptionZh:ability.descriptionZh,
   review:'source-and-contract-review; not exhaustive game validation',
   limitations:update?[]:row.risks};
}
const coverageCache=new WeakMap<CatalogRelease,ReturnType<typeof abilityCoverage>[]>();
export const getDamageAbilityCoverage=()=>{const release=getCatalogRelease();let rows=coverageCache.get(release);if(!rows){rows=[...getCatalog().abilityById.keys()].filter(isCurrentChampionsAbility).map(abilityCoverage);coverageCache.set(release,rows);}return rows;};

export const damageAbilityCoverage=getDamageAbilityCoverage();
