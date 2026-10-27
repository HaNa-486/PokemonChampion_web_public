import { getCatalog } from './catalog';
import { NATURES, ZERO_STATS } from './domain';
import { unsupportedMoveReasons } from './damage-moves';
import type { DamageBuild } from './damage';
import type { Pokemon } from './types';
import type { usageScenarios } from './usage-scenarios';

export type DamageUsage = ReturnType<typeof usageScenarios>;
export type UsageMode = 'ap' | 'nature' | 'stats' | 'full';

export function reconcileDamageAttack(build:DamageBuild,current:string,preferRanked=false) {
  const c=getCatalog(),p=c.pokemonById.get(build.pokemonId)!;
  const ranked=build.moveSlots.find(id=>id&&c.moveById.get(id)?.category!=='Status');
  const selected=(!preferRanked&&build.moveSlots.includes(current)?current:ranked)
    ??(p.moveIds.includes(current)?current:freshDamageBuild(p.id).moveSlots[0])??'';
  // A status-only popular set still permits testing a separately selected attack.
  const slots=[...build.moveSlots];
  if(selected&&!slots.includes(selected))slots[3]=selected;
  return {build:{...build,moveSlots:slots},moveId:selected};
}

/** An explicitly labelled example, never a usage or optimal-build claim. */
export function freshDamageBuild(id: string): DamageBuild {
  const c=getCatalog(),p=c.pokemonById.get(id)!;
  const category=p.baseStats.specialAttack>p.baseStats.attack?'Special':'Physical';
  const moves=p.moveIds.map(id=>c.moveById.get(id)!).filter(m=>m.category!=='Status'&&!unsupportedMoveReasons[m.id]);
  const preferred=moves.find(m=>m.category===category&&p.types.includes(m.type)&&m.power&&m.power>0)
    ??moves.find(m=>m.category===category&&m.power&&m.power>0)??moves[0];
  return {pokemonId:id,abilityId:p.abilityIds[0]??null,itemId:c.megaStoneIdByPokemonId.get(id)??null,nature:'Serious',ap:{...ZERO_STATS},moveSlots:[preferred?.id??null,null,null,null]};
}

/** Only explicit form relations connect a base and its Mega branches. */
export function damageFormChoices(id: string): Pokemon[] {
  const c=getCatalog(),base=c.megaBasePokemonIdByMegaId.get(id)??id;
  const ids=[base,...c.formRelations.filter(r=>r.baseFormId===base).map(r=>r.megaFormId)];
  return [...new Set(ids)].map(id=>c.pokemonById.get(id)).filter((p):p is Pokemon=>!!p&&p.legal!==false);
}

export function changeDamageForm(build: DamageBuild, id: string): DamageBuild {
  if(!damageFormChoices(build.pokemonId).some(p=>p.id===id))return freshDamageBuild(id);
  const c=getCatalog(),p=c.pokemonById.get(id)!;
  return {...build,pokemonId:id,ap:{...build.ap},itemId:c.megaStoneIdByPokemonId.get(id)??build.itemId,
    abilityId:build.abilityId&&p.abilityIds.includes(build.abilityId)?build.abilityId:p.abilityIds[0]??null,
    moveSlots:build.moveSlots.map(id=>id&&p.moveIds.includes(id)?id:null)};
}

export function changeDamageItem(build: DamageBuild, itemId: string|null): DamageBuild {
  const c=getCatalog(),base=c.megaBasePokemonIdByMegaId.get(build.pokemonId)??build.pokemonId;
  const mega=itemId?c.megaPokemonForStone(itemId,base):undefined;
  const next=mega?changeDamageForm(build,mega.id):c.megaBasePokemonIdByMegaId.has(build.pokemonId)?changeDamageForm(build,base):build;
  return {...next,itemId};
}

export function applyDamageUsage(build: DamageBuild, usage: DamageUsage, mode: UsageMode) {
  let next={...build,ap:{...build.ap},moveSlots:[...build.moveSlots]};
  if(mode!=='full') {
    if((mode==='ap'||mode==='stats')&&usage.alternatives.ap[0])next.ap={...usage.alternatives.ap[0].ap};
    if((mode==='nature'||mode==='stats')&&usage.alternatives.natures[0])next.nature=usage.alternatives.natures[0].nature.name;
  } else {
    // Partial evidence must not erase a user's valid settings.
    const d=usage.defaults;
    if(d.abilityId!==null)next.abilityId=d.abilityId;
    if(d.itemId!==null)next.itemId=d.itemId;
    if(d.nature!==null)next.nature=d.nature;
    if(d.ap!==null)next.ap={...d.ap};
    if(d.moveSlots!==null)next.moveSlots=[...d.moveSlots];
    // Applying a stone is the same explicit action as choosing it manually.
    // Resolve the target form after the source fields so its legal ability wins.
    if(d.itemId!==null)next=changeDamageItem(next,d.itemId);
  }
  const changed=(Object.keys(next) as Array<keyof DamageBuild>).filter(key=>JSON.stringify(next[key])!==JSON.stringify(build[key]));
  return {build:next,changed};
}

/** Warnings describe mismatches; marginal rows cannot justify inventing a joint set. */
export function damageBuildWarnings(build: DamageBuild, moveId: string) {
  const c=getCatalog(),nature=NATURES.find(n=>n.name===build.nature);
  const move=c.moveById.get(moveId),warnings:string[]=[];
  const offense=moveId==='body-press'?'defense':move?.category==='Special'?'specialAttack':move?.category==='Physical'?'attack':null;
  if(offense&&moveId!=='foul-play'&&nature?.down===offense)warnings.push('nature-move');
  if((build.ap.attack>build.ap.specialAttack&&nature?.down==='attack')||(build.ap.specialAttack>build.ap.attack&&nature?.down==='specialAttack'))warnings.push('nature-ap');
  if(moveId!=='foul-play'&&(offense==='attack'&&build.ap.specialAttack>build.ap.attack||offense==='specialAttack'&&build.ap.attack>build.ap.specialAttack))warnings.push('ap-move');
  if(build.moveSlots.includes('detect')&&build.moveSlots.includes('protect'))warnings.push('duplicate-protection');
  return warnings;
}
