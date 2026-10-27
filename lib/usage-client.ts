import { demoBattleUsage, demoUsageRankings } from '../data/demo-usage';
import { getCatalog } from './catalog';
import { getCatalogRelease } from './catalog-release';
import type { BattleUsageData, UsageRankings } from './usage-contract';
import type { BattleUsage, Pokemon } from './types';

export class UsageClientError extends Error {
  constructor(readonly retryAt: number) { super('This Pokémon has no demo usage fixture.'); }
}
export const battleUsageKey = (pokemon: Pokemon) => getCatalogRelease().id + ':' + getCatalog().battleDataSourcePokemon(pokemon).id;
export const usageRankingsKey = () => getCatalogRelease().id + ':rankings';

export function peekBattleUsage(pokemon: Pokemon): BattleUsageData | undefined {
  return demoBattleUsage.get(getCatalog().battleDataSourcePokemon(pokemon).id);
}
/** Promise-shaped local adapter preserves the UI contract without any network. */
export async function loadBattleUsage(pokemon: Pokemon, _force = false): Promise<BattleUsageData> {
  const data = peekBattleUsage(pokemon);
  if (!data) throw new UsageClientError(0);
  return data;
}
export function bootstrapUsageRankings(): UsageRankings { return demoUsageRankings; }
export function peekUsageRankings(): UsageRankings { return demoUsageRankings; }
export async function loadUsageRankings(_force = false): Promise<UsageRankings> { return demoUsageRankings; }
export function staleBattleUsage(usage: BattleUsage | null, _retryAt: number): BattleUsage | null { return usage; }
/** Fixtures have no mutable request cache. */
export function clearUsageMemoryCache() {}
