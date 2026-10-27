import { demoDexByPokemonId } from '../data/demo-catalog';
import { demoUsageRankings } from '../data/demo-usage';
import { getCatalog } from './catalog';
import type { BattleFormat, Pokemon } from './types';
import type { UsageRanks } from './usage-contract';

export const speedRankingSource = demoUsageRankings.source;
export const speedPickerSorts = ['usage','speed-desc','speed-asc','dex','name'] as const;
export type SpeedPickerSort = typeof speedPickerSorts[number];
type RankingRecords = UsageRanks;
const rankingRecords: RankingRecords = demoUsageRankings.ranksByBattleDataKey;
/** Demonstration rankings share the base form's explicitly mapped fixture. */
export function speedPickerRankSource(p:Pokemon,format:BattleFormat,ranks:RankingRecords=rankingRecords):Pokemon {
  void format;
  void ranks;
  return getCatalog().battleDataSourcePokemon(p);
}
export function speedPickerRank(p:Pokemon,format:BattleFormat,ranks:RankingRecords=rankingRecords):number|null {
  const source = speedPickerRankSource(p,format,ranks);
  return ranks[source.battleDataKey??source.id]?.[format] ?? null;
}
export function speedPickerDex(p:Pokemon):number|null { return demoDexByPokemonId[p.id] ?? null; }
export function speedPickerFamily(p:Pokemon):Pokemon {
  const catalog=getCatalog();
  return catalog.pokemonById.get(catalog.megaBasePokemonIdByMegaId.get(p.id)??'')??p;
}
export function filterSpeedPicker(pokemon:Pokemon[],options:{format:BattleFormat;locale:'en'|'zh-Hant';sort:SpeedPickerSort;query:string;types:string[];match:'or'|'and';ranks?:RankingRecords}) {
  const {format,locale,sort,types,match}=options, query=options.query.trim().toLocaleLowerCase();
  const names=(p:Pokemon)=>[p.name,p.nameZh??''].map(n=>n.toLocaleLowerCase());
  const name=(p:Pokemon)=>locale==='zh-Hant'?p.nameZh||p.name:p.name;
  const relevance=(p:Pokemon)=>!query?0:names(p).some(n=>n===query)?0:names(p).some(n=>n.startsWith(query))?1:2;
  const missingLast=(a:number|null,b:number|null)=>a===null?(b===null?0:1):b===null?-1:a-b;
  return pokemon.filter(p=>(!query||names(p).some(n=>n.includes(query)))&&(!types.length||(match==='and'?types.every(t=>p.types.some(type=>type===t)):types.some(t=>p.types.some(type=>type===t))))).sort((a,b)=>{
    const searchOrder=relevance(a)-relevance(b);if(searchOrder)return searchOrder;
    if(sort==='speed-asc'||sort==='speed-desc')return (sort==='speed-asc'?1:-1)*(a.baseStats.speed-b.baseStats.speed)||name(a).localeCompare(name(b),locale)||a.id.localeCompare(b.id);
    const af=speedPickerFamily(a),bf=speedPickerFamily(b);
    const group=sort==='usage'?missingLast(speedPickerRank(af,format,options.ranks),speedPickerRank(bf,format,options.ranks)):sort==='dex'?missingLast(speedPickerDex(af),speedPickerDex(bf)):name(af).localeCompare(name(bf),locale);
    return group||name(af).localeCompare(name(bf),locale)||Number(a.id!==af.id)-Number(b.id!==bf.id)||name(a).localeCompare(name(b),locale)||a.id.localeCompare(b.id);
  });
}
