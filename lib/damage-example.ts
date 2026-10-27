import { getPublishedData } from "./published-data";
import { ZERO_STATS } from './domain';
/** Reproducible demonstration, not a recommended team or observed opponent. */
export function getDamageExample() { return {
  action:'damage', format:'singles', dataVersion:getPublishedData().publishedDataVersion,
  attacker:{pokemonId:'dragonite',abilityId:'multiscale',itemId:null,nature:'Adamant',ap:{...ZERO_STATS,hp:2,attack:32,speed:32},moveSlots:['dragon-claw','earthquake','extreme-speed',null]},
  defender:{pokemonId:'garchomp',abilityId:'sand-veil',itemId:null,nature:'Jolly',ap:{...ZERO_STATS,hp:2,attack:32,speed:32},moveSlots:['earthquake',null,null,null]},
  moveId:'dragon-claw', field:{weather:'none',terrain:'none'},
  alternatives:[{label:'Defender: 32 HP / 32 Def / 2 Spe',side:'defender',ap:{...ZERO_STATS,hp:32,defense:32,speed:2}}],
};

}
export const damageExample=getDamageExample();
