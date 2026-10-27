/** Fabricated, deterministic examples for UI exploration. No observed samples. */
import { DEMO_VERSION, demoAbilities, demoItems, demoMoves, demoPokemon } from './demo-catalog';
import type { BattleFormat, BattleUsage, BattleUsageRow, Pokemon, Stats } from '../lib/types';
import type { BattleUsageData, UsageProvenance, UsageRankings } from '../lib/usage-contract';

export const demoUsageProvenance: UsageProvenance = {
  provider: 'Portfolio demo', sourceUrl: '', sourceDate: null, sourceVersion: DEMO_VERSION,
  snapshotId: DEMO_VERSION, fetchedAt: '', checkedAt: null, nextCheckAt: '',
  status: 'demo', errorCode: null, storage: 'bundled',
};
export const demoRankingSource = {
  url: '', dataVersion: DEMO_VERSION, generatedAt: '', retrievedAt: '', sha256: '', season: 'Fabricated demo',
};
const singlesOrder = ['garchomp', 'dragonite', 'gengar', 'charizard', 'venusaur', 'blastoise', 'snorlax'];
const doublesOrder = ['charizard', 'venusaur', 'dragonite', 'blastoise', 'garchomp', 'snorlax', 'gengar'];
export const demoUsageRankings: UsageRankings = {
  source: demoRankingSource,
  ranksByBattleDataKey: Object.fromEntries(singlesOrder.map((id, index) => [id, { singles: index + 1, doubles: doublesOrder.indexOf(id) + 1 }])),
  provenance: demoUsageProvenance,
};
const abilityName = new Map(demoAbilities.map(a => [a.id, a.name]));
const itemName = new Map(demoItems.map(item => [item.id, item.name]));
const moveName = new Map(demoMoves.map(move => [move.id, move.name]));
const emptyStats = (): Stats => ({ hp: 0, attack: 0, defense: 0, specialAttack: 0, specialDefense: 0, speed: 0 });
const row = (category: string, rank: number, name: string, percentageValue: number): BattleUsageRow => ({
  category, rank, name, percentage: `${percentageValue.toFixed(1)}%`, percentageValue, statUp: '', statDown: '', ap: null,
});

function createUsage(pokemon: Pokemon, format: BattleFormat): BattleUsage {
  const special = pokemon.baseStats.specialAttack > pokemon.baseStats.attack;
  const offense = special ? 'specialAttack' : 'attack';
  const fast = { ...emptyStats(), hp: 2, [offense]: 32, speed: 32 };
  const bulky = { ...emptyStats(), hp: 32, [offense]: 32, speed: 2 };
  const preferredItems = pokemon.id === 'snorlax' ? ['leftovers', 'sitrus-berry']
    : pokemon.id === 'charizard' ? ['life-orb', 'charizardite-x']
      : special ? ['focus-sash', 'choice-scarf'] : ['life-orb', 'choice-scarf'];
  const movePercentages = format === 'singles' ? [84, 71, 55, 38, 25, 12] : [81, 68, 52, 44, 28, 17];
  const rows = [
    ...pokemon.moveIds.map((id, index) => row('move', index + 1, moveName.get(id)!, movePercentages[index] ?? 10)),
    ...pokemon.abilityIds.map((id, index) => row('ability', index + 1, abilityName.get(id)!, pokemon.abilityIds.length === 1 ? 100 : index === 0 ? 70 : 30)),
    ...preferredItems.map((id, index) => row('held_item', index + 1, itemName.get(id)!, index === 0 ? 60 : 40)),
    { ...row('stat_alignment', 1, special ? 'Modest' : 'Adamant', 65), statUp: special ? 'special attack' : 'attack', statDown: special ? 'attack' : 'special attack' },
    { ...row('stat_alignment', 2, special ? 'Timid' : 'Jolly', 35), statUp: 'speed', statDown: special ? 'attack' : 'special attack' },
    { ...row('stat_points', 1, format === 'singles' ? 'Demo fast spread' : 'Demo bulky spread', 60), ap: format === 'singles' ? fast : bulky },
    { ...row('stat_points', 2, format === 'singles' ? 'Demo bulky spread' : 'Demo fast spread', 40), ap: format === 'singles' ? bulky : fast },
    ...demoPokemon.filter(p => !p.isMega && p.id !== pokemon.id).slice(0, 3).map((p, index) => row('teammate', index + 1, p.name, 42 - index * 10)),
  ];
  return { pokemon: pokemon.name, format: format === 'singles' ? 'Singles' : 'Doubles',
    season: 'Fabricated demo', date: null, source: 'Portfolio demo (fabricated)', sourceVersion: DEMO_VERSION,
    rows, provenance: demoUsageProvenance, missingCategories: [], ignoredCategories: [], rankGaps: [] };
}
export const demoBattleUsage = new Map<string, BattleUsageData>(demoPokemon.filter(p => !p.isMega).map(p => [p.id, {
  singles: createUsage(p, 'singles'), doubles: createUsage(p, 'doubles'), errors: { singles: null, doubles: null },
}]));
