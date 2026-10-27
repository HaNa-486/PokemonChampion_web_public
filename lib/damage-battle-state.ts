import { getCatalog } from './catalog';
import { isCurrentChampionsAbility } from './damage-abilities';

export const copiesAbility = (id:string|null|undefined) => ['trace','receiver','power-of-alchemy'].includes(id??'');
// Pokémon Showdown c046106c / data/abilities.ts: notrace / noreceiver flags.
// Keep rules separate from the legal team ability; this is current battle state.
const noCopy=new Set(['asoneglastrier','asonespectrier','battlebond','comatose','commander','disguise','embodyaspectcornerstone','embodyaspecthearthflame','embodyaspectteal','embodyaspectwellspring','flowergift','forecast','hungerswitch','iceface','illusion','imposter','multitype','neutralizinggas','poisonpuppeteer','powerconstruct','powerofalchemy','protosynthesis','quarkdrive','receiver','rkssystem','schooling','shieldsdown','stancechange','teraformzero','terashell','terashift','trace','zenmode','zerotohero']);
export function canCopyAbility(original:string,id:string) {
  return copiesAbility(original)&&isCurrentChampionsAbility(id)&&!noCopy.has(id.replaceAll('-',''))&&(original==='trace'||id!=='wonder-guard');
}
export const copiedAbilityChoices=(original:string)=>getCatalog().abilities.filter(a=>canCopyAbility(original,a.id));
export function effectiveDamageAbility(original:string|null, copied:string|null) {
  if(!copiesAbility(original)) {
    if(copied!==null)throw new Error('COPIED_ABILITY_STALE: This original ability cannot copy or inherit another ability.');
    return original;
  }
  if(copied===null)throw new Error('COPIED_ABILITY_REQUIRED: Choose the current copied/inherited ability, or explicitly choose not activated.');
  if(copied==='unchanged')return original;
  if(!canCopyAbility(original!,copied))throw new Error('COPIED_ABILITY_INVALID: This ability cannot be copied or inherited.');
  return copied;
}
