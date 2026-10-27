import { getCatalog } from "./catalog";
import type { SpeedCandidate } from "./speed-research";

/** Keep a Speed editor's form and held stone atomic, using explicit catalog relations. */
export function reconcileSpeedBuild<T extends SpeedCandidate>(value:T, itemChanged=false):T {
  const catalog=getCatalog(), current=catalog.pokemonById.get(value.pokemonId);
  if(!current)return value;
  const base=catalog.pokemonById.get(catalog.megaBasePokemonIdByMegaId.get(current.id)??current.id)!;
  const itemId=current.isMega&&value.itemId===null&&!itemChanged?catalog.megaStoneIdByPokemonId.get(current.id)??null:value.itemId;
  const next=(itemId?catalog.megaPokemonForStone(itemId,base.id):null)??base;
  const changed=next.id!==current.id;
  // Direct Mega picks and restored sessions need the same unique ability as a stone transition.
  const reconcileAbility=(changed||next.isMega)&&!next.abilityIds.includes(value.abilityId??"");
  return {...value,pokemonId:next.id,itemId,abilityId:reconcileAbility?(next.abilityIds.length===1?next.abilityIds[0]:null):value.abilityId,condition:{...value.condition,unburden:changed||itemChanged?false:value.condition.unburden}};
}
