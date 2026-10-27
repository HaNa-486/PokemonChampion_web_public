import { DEMO_VERSION, demoAbilities, demoFormRelations, demoItems, demoMoves, demoPokemon } from '../data/demo-catalog';

/** A single bundled demonstration. There is no server catalog or remote update. */
export const bundledRelease = {
  id: DEMO_VERSION,
  schemaVersion: 1 as const,
  sourceCommit: 'public-demo',
  snapshot: {
    pokemon: demoPokemon, abilities: demoAbilities, moves: demoMoves, items: demoItems,
    formRelations: demoFormRelations,
  },
};
export type CatalogRelease = typeof bundledRelease;
export function getCatalogRelease(): CatalogRelease { return bundledRelease; }
