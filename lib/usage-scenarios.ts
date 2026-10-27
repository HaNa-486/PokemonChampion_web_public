import { rankedAbilityChoices, rankedApChoices, rankedItemChoices, rankedMoveChoices, rankedNatureChoices } from './battle-recommendations';
import { getCatalog } from "./catalog";
import { statisticalScope } from './research-provenance';
import { calculateFinalStats } from './domain';
import type { Pokemon, BattleUsage } from './types';
import type { DamageBuild } from './damage';

export function usageScenarios(pokemon: Pokemon, usage: BattleUsage) {
  const ability=rankedAbilityChoices(usage,pokemon)[0];
  // A form's sole legal ability is a mechanics constraint, not a usage claim.
  const fixedAbility=pokemon.abilityIds.length===1?pokemon.abilityIds[0]:null;
  const abilityId=fixedAbility??ability?.id??null;
  const abilityEvidence=fixedAbility?{kind:'fixed-form-ability' as const,id:fixedAbility}:ability?{kind:'usage' as const,id:ability.id,rank:ability.rank}:null;
  const item=rankedItemChoices(usage)[0];
  const natures=rankedNatureChoices(usage);
  const nature=natures[0];
  const moves=rankedMoveChoices(usage,pokemon).slice(0,4);
  const ap=rankedApChoices(usage);
  const row=(category:string,rank:number|undefined)=>usage.rows.find(r=>r.category===category&&r.rank===rank)??null;
  const sources={ability:row('ability',ability?.rank),item:row('held_item',item?.rank),nature:row('stat_alignment',nature?.rank),moves:moves.map(m=>row('move',m.rank))};
  const requiredItem=getCatalog().megaStoneIdByPokemonId.get(pokemon.id);
  const defaults={abilityId,itemId:requiredItem??item?.id??null,nature:nature?.nature.name??null,ap:ap[0]?.ap??null,moveSlots:moves.length?Array.from({length:4},(_,i)=>moves[i]?.id??null):null};
  const missingFields=Object.entries(defaults).filter(([,value])=>value===null).map(([key])=>key);
  const candidates=abilityId&&nature&&moves.length&&ap.length ? ap.map(spread=>{
    const build:DamageBuild={pokemonId:pokemon.id,abilityId,itemId:requiredItem??item?.id??null,nature:nature.nature.name,ap:spread.ap,moveSlots:Array.from({length:4},(_,i)=>moves[i]?.id??null)};
    return {label:`AP #${spread.rank}`,build,finalStats:calculateFinalStats(pokemon.baseStats,spread.ap,nature.nature),apEvidence:row('stat_points',spread.rank),
      itemEvidence:pokemon.isMega?{kind:'required-mega-stone',id:build.itemId}:sources.item,
      abilityEvidence,jointUsagePercentage:null};
  }):[];
  return {kind:'inferred-from-marginal-usage',format:usage.format,source:usage.source,sourceDate:usage.date,fetchedAt:usage.fetchedAt??null,season:usage.season,
    provenance:usage.provenance,missingCategories:usage.missingCategories,scope:statisticalScope(pokemon),sources,candidates,defaults,missingFields,abilityEvidence,
    alternatives:{natures:natures.map(x=>({...x,evidence:row('stat_alignment',x.rank)})),abilities:rankedAbilityChoices(usage,pokemon).map(x=>({...x,name:getCatalog().abilityById.get(x.id)?.name,evidence:row('ability',x.rank)})),items:rankedItemChoices(usage).map(x=>({...x,name:getCatalog().itemById.get(x.id)?.name,evidence:row('held_item',x.rank)})),moves:rankedMoveChoices(usage,pokemon).map(x=>({...x,name:getCatalog().moveById.get(x.id)?.name,evidence:row('move',x.rank)})),ap:rankedApChoices(usage)},
    limitations:['Individual usage percentages are not the probability of this combined set.', 'Missing required source rows produce no candidate. Mega stones are form requirements, not inferred joint usage.', 'Opponent configuration remains a hypothesis; inspect alternatives and use explicit battle conditions.']};
}
