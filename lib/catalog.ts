import type { Pokemon } from './types';
import { bundledRelease, type CatalogRelease } from './catalog-release';

export type FormRelation = { baseFormId: string; megaFormId: string; requiredItemId: string; source: string };

export function createCatalog(release: CatalogRelease) {
  const { abilities, items, moves, pokemon, formRelations } = release.snapshot;
  const catalogSnapshotDate = 'Demo fixture';
  const moveById = new Map(moves.map(entry => [entry.id, entry]));
  const abilityById = new Map(abilities.map(entry => [entry.id, entry]));
  const itemById = new Map(items.map(entry => [entry.id, entry]));
  const pokemonById = new Map(pokemon.map(entry => [entry.id, entry]));
  const megaStoneIdByPokemonId = new Map(formRelations.map(r => [r.megaFormId, r.requiredItemId]));
  const megaBasePokemonIdByMegaId = new Map(formRelations.map(r => [r.megaFormId, r.baseFormId]));
  const megaPokemonByStoneId = new Map<string, Pokemon>();
  const megaBasePokemonIdByStoneId = new Map<string, string>();
  for (const relation of formRelations) {
    const mega = pokemonById.get(relation.megaFormId);
    if (mega) megaPokemonByStoneId.set(relation.requiredItemId, mega);
    megaBasePokemonIdByStoneId.set(relation.requiredItemId, relation.baseFormId);
  }
  const megaStoneMatchesPokemon = (stoneId: string, pokemonId: string) => formRelations.some(r => r.requiredItemId === stoneId && r.baseFormId === pokemonId);
  function megaPokemonForStone(stoneId: string, baseId: string) {
    const relation = formRelations.find(r => r.requiredItemId === stoneId && r.baseFormId === baseId);
    return relation ? pokemonById.get(relation.megaFormId) : undefined;
  }
  function battleDataSourcePokemon(entry: Pokemon) {
    const baseId = megaBasePokemonIdByMegaId.get(entry.id);
    return baseId ? pokemonById.get(baseId) ?? entry : entry;
  }
  const battleDataKeyForPokemon = (entry: Pokemon) => {
    const source = battleDataSourcePokemon(entry);
    return source.battleDataKey ?? source.speciesKey;
  };
  const usageEntityKey = (name: string) => name.toLowerCase().replace(/[^a-z0-9]+/g, '');
  const moveIdByUsageName = new Map(moves.map(entry => [usageEntityKey(entry.name), entry.id]));
  const itemIdByUsageName = new Map(items.map(entry => [usageEntityKey(entry.name), entry.id]));
  const abilityIdByUsageName = new Map(abilities.map(entry => [usageEntityKey(entry.name), entry.id]));
  function reversePokemonIndex(selectIds: (entry: Pokemon) => string[]) {
    const index = new Map<string, Pokemon[]>();
    for (const entry of pokemon) for (const id of selectIds(entry)) index.set(id, [...(index.get(id) ?? []), entry]);
    for (const users of index.values()) users.sort((a, b) => a.name.localeCompare(b.name));
    return index;
  }
  const pokemonByMoveId = reversePokemonIndex(entry => entry.moveIds);
  const pokemonByAbilityId = reversePokemonIndex(entry => entry.abilityIds);
  return { catalogSnapshotDate, abilities, formRelations, megaStoneIdByPokemonId, items, moves, pokemon,
    moveById, abilityById, itemById, pokemonById, megaBasePokemonIdByMegaId, megaPokemonByStoneId,
    megaBasePokemonIdByStoneId, megaStoneMatchesPokemon, megaPokemonForStone, battleDataSourcePokemon,
    battleDataKeyForPokemon, moveIdByUsageName, itemIdByUsageName, abilityIdByUsageName, usageEntityKey,
    pokemonByMoveId, pokemonByAbilityId };
}

const catalog = createCatalog(bundledRelease);
export function getCatalog() { return catalog; }
export const { catalogSnapshotDate, abilities, formRelations, megaStoneIdByPokemonId, items, moves, pokemon, moveById, abilityById, itemById, pokemonById, megaBasePokemonIdByMegaId, megaPokemonByStoneId, megaBasePokemonIdByStoneId, megaStoneMatchesPokemon, megaPokemonForStone, battleDataSourcePokemon, battleDataKeyForPokemon, moveIdByUsageName, itemIdByUsageName, abilityIdByUsageName, usageEntityKey, pokemonByMoveId, pokemonByAbilityId } = catalog;
