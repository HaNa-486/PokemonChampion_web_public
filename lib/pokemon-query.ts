import { matchesRegulation, pokemonGeneration } from "./catalog-history";
import type { Pokemon, Stats } from "./types";
export type PokemonFilters = { q?: string; regulation?: string; generations?: number[]; types?: string[]; typeMode?: "or" | "and"; form?: "all" | "regular" | "mega"; abilityId?: string; moveIds?: string[]; minStats?: Partial<Stats>; totalMinimum?: number };
export function matchesPokemon(entry: Pokemon, filters: PokemonFilters) {
  const types = filters.types ?? [];
  return matchesRegulation(entry.id, "pokemon", filters.regulation)
    && (!filters.generations?.length || filters.generations.includes(pokemonGeneration(entry.id) ?? 0))
    && `${entry.name} ${entry.nameZh}`.toLowerCase().includes((filters.q ?? "").toLowerCase())
    && (!types.length || (filters.typeMode === "and" ? types.every(type => entry.types.includes(type as Pokemon["types"][number])) : types.some(type => entry.types.includes(type as Pokemon["types"][number]))))
    && (!filters.form || filters.form === "all" || (filters.form === "mega" ? !!entry.isMega : !entry.isMega))
    && (!filters.abilityId || entry.abilityIds.includes(filters.abilityId))
    && (filters.moveIds ?? []).every(id => entry.moveIds.includes(id))
    && Object.entries(filters.minStats ?? {}).every(([stat, min]) => entry.baseStats[stat as keyof Stats] >= min!)
    && Object.values(entry.baseStats).reduce((a,b) => a+b, 0) >= (filters.totalMinimum ?? 0);
}
