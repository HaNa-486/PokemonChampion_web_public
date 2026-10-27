import { demoGenerationByPokemonId, demoItems, demoPokemon } from '../data/demo-catalog';

/** One fictional filter collection; no production regulations or release history. */
export const regulationHistory = [{ regulationId: 'Demo', pokemonIds: demoPokemon.map(p => p.id), itemIds: demoItems.map(item => item.id), addedPokemonIds: [] as string[], addedItemIds: [] as string[] }];
export function matchesRegulation(id: string, kind: 'pokemon' | 'items', selection = '') {
  if (!selection) return true;
  const added = selection.startsWith('new:');
  const rule = regulationHistory.find(r => r.regulationId === (added ? selection.slice(4) : selection));
  if (!rule) return false;
  return (kind === 'pokemon' ? (added ? rule.addedPokemonIds : rule.pokemonIds) : (added ? rule.addedItemIds : rule.itemIds)).includes(id);
}
export function pokemonGeneration(id: string): number | undefined { return demoGenerationByPokemonId[id]; }
export function validRegulationFilter(value: unknown) { return typeof value === 'string' && (value === '' || value === 'Demo' || value === 'new:Demo'); }
