import { NATURES, NEUTRAL_NATURE, ZERO_STATS } from "./domain";
import { DEFAULT_CONDITION, DEFAULT_SCENARIO, effectiveSpeed, type SpeedCondition, type SpeedScenario } from "./speed-matrix";
import type { Pokemon, TeamMember, Nature } from "./types";

export type SpeedVariant = { id: string; label: string; labelZh: string; member: TeamMember; condition: SpeedCondition; field: SpeedScenario };
export const speedNatures = [NATURES.find(n => n.down === "speed")!, NEUTRAL_NATURE, NATURES.find(n => n.up === "speed")!];
export function speedAt(pokemon: Pokemon, variant: SpeedVariant, ap: number, nature: Nature) {
  return effectiveSpeed(pokemon, { ...variant.member, ap: { ...ZERO_STATS, speed: ap }, nature }, variant.condition, variant.field, "own").speed;
}
/** Enumerate compatible assumptions. A Mega must retain its stone; only one ability,
 * one weather and one item may apply. Unburden requires loss of the held item. */
export function speedVariants(pokemon: Pokemon, scarfLegal = true): SpeedVariant[] {
  const member: TeamMember = { id: pokemon.id, pokemonId: pokemon.id, moveIds: [], abilityId: null, itemId: null, ap: { ...ZERO_STATS }, nature: NEUTRAL_NATURE };
  const base: SpeedVariant = { id: "normal", label: "Normal", labelZh: "一般", member, condition: { ...DEFAULT_CONDITION }, field: { ...DEFAULT_SCENARIO } };
  const abilityCases: SpeedVariant[] = [base];
  if (pokemon.abilityIds.includes("speed-boost")) for (let stage = 1; stage <= 6; stage++) abilityCases.push({ ...base, id: `speed-boost-${stage}`, label: `Speed Boost +${stage}`, labelZh: `加速已觸發 +${stage}`, member: { ...member, abilityId: "speed-boost" }, condition: { ...base.condition, stage } });
  const triggeredStages = [
    ["weak-armor",[2,4,6],"Weak Armor triggered","碎裂鎧甲已觸發"],
    ["steam-engine",[6],"Steam Engine triggered","蒸汽機已觸發"],
    ["motor-drive",[1,2,3,4,5,6],"Motor Drive triggered","電氣引擎已觸發"],
    ["rattled",[1,2,3,4,5,6],"Rattled triggered","膽怯已觸發"],
    ["anger-shell",[1,2,3,4,5,6],"Anger Shell triggered","憤怒甲殼已觸發"],
  ] as const;
  for (const [abilityId,stages,label,labelZh] of triggeredStages) if (pokemon.abilityIds.includes(abilityId)) for (const stage of stages) abilityCases.push({...base,id:`${abilityId}-${stage}`,label:`${label} +${stage}`,labelZh:`${labelZh} +${stage}`,member:{...member,abilityId},condition:{...base.condition,stage}});
  const weatherAbilities = [["swift-swim", "rain", "Rain / Swift Swim", "雨天／悠游自如"], ["chlorophyll", "sun", "Sun / Chlorophyll", "晴天／葉綠素"], ["sand-rush", "sand", "Sand / Sand Rush", "沙暴／撥沙"], ["slush-rush", "snow", "Snow / Slush Rush", "下雪／撥雪"]] as const;
  for (const [abilityId, weather, label, labelZh] of weatherAbilities) if (pokemon.abilityIds.includes(abilityId)) abilityCases.push({ ...base, id: abilityId, label, labelZh, member: { ...member, abilityId }, field: { ...base.field, weather } });
  if (pokemon.abilityIds.includes("surge-surfer")) abilityCases.push({ ...base, id: "surge-surfer", label: "Electric Terrain / Surge Surfer", labelZh: "電氣場地／衝浪之尾", member: { ...member, abilityId: "surge-surfer" }, field: { ...base.field, electricTerrain: true } });
  if (pokemon.abilityIds.includes("unburden")) abilityCases.push({ ...base, id: "unburden", label: "Unburden triggered", labelZh: "輕裝已觸發", member: { ...member, abilityId: "unburden" }, condition: { ...base.condition, unburden: true } });
  if (pokemon.abilityIds.includes("quick-feet")) abilityCases.push({ ...base, id: "quick-feet", label: "Status / Quick Feet", labelZh: "異常狀態／飛毛腿", member: { ...member, abilityId: "quick-feet" }, condition: { ...base.condition, status: "other" } });
  const variants: SpeedVariant[] = [];
  for (const ability of abilityCases) for (const scarf of [false, true]) for (const tailwind of [false, true]) {
    if (scarf && (!scarfLegal || pokemon.isMega || ability.id === "unburden")) continue;
    variants.push({ ...ability, id: `${ability.id}${scarf ? "+scarf" : ""}${tailwind ? "+tailwind" : ""}`, label: `${ability.label}${scarf ? " + Scarf" : ""}${tailwind ? " + Tailwind" : ""}`, labelZh: `${ability.labelZh}${scarf ? "＋圍巾" : ""}${tailwind ? "＋順風" : ""}`, member: { ...ability.member, itemId: scarf ? "choice-scarf" : null }, field: { ...ability.field, ownTailwind: tailwind } });
  }
  return variants;
}

export function speedBounds(pokemon: Pokemon, variant: SpeedVariant) {
  const values = speedNatures.flatMap(nature => Array.from({ length: 33 }, (_, ap) => speedAt(pokemon, variant, ap, nature)));
  return { min: Math.min(...values), max: Math.max(...values), zero: speedAt(pokemon, variant, 0, NEUTRAL_NATURE), full: speedAt(pokemon, variant, 32, NEUTRAL_NATURE) };
}
export function apThreshold(pokemon: Pokemon, variant: SpeedVariant, target: number, nature: Nature, trickRoom = false) {
  const passing = Array.from({ length: 33 }, (_, ap) => ap).filter(ap => trickRoom ? speedAt(pokemon, variant, ap, nature) < target : speedAt(pokemon, variant, ap, nature) > target);
  return passing.length ? { min: passing[0], max: passing[passing.length - 1] } : null;
}

/** Interval ordering makes no claim about an opponent's unknown allocation. */
export function compareSpeedRanges(own: {min:number;max:number}, other: {min:number;max:number}, trickRoom = false) {
  if (own.min === own.max && other.min === other.max && own.min === other.min) return "tie";
  if (own.min > other.max) return trickRoom ? "last" : "first";
  if (own.max < other.min) return trickRoom ? "first" : "last";
  return "conditional";
}
