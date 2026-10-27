import { getCatalogRelease } from './catalog-release';
import { getCatalog } from './catalog';
import { getPublishedData } from './published-data';
import type { Pokemon } from './types';

export function getResearchMeta() {
  return { releaseId: getCatalogRelease().id, ruleset: getPublishedData().publishedRulesetCode,
    ...getPublishedData().publishedRuleset, catalogSnapshotVersion: getPublishedData().publishedDataVersion,
    catalogSourceGeneratedAt: null, catalogSnapshotGeneratedAt: null, catalogPublishedAt: null,
    mechanicsRevision: '@smogon/calc@0.12.0', translationRevision: 'original-demo-labels',
    freshnessStatus: 'demonstration-only', upstreamCheckedAt: null, statusUrl: null,
    attribution: [{ name: '@smogon/calc (MIT)', url: 'https://github.com/smogon/damage-calc' }],
  };
}
export const researchMeta = getResearchMeta();
export function statisticalScope(entry: Pokemon) {
  const combined = getCatalog().formRelations.some(r => r.baseFormId === entry.id || r.megaFormId === entry.id);
  return { kind: combined ? 'base-and-mega-combined' : 'form', battleDataKey: getCatalog().battleDataKeyForPokemon(entry),
    warning: 'Fabricated portfolio examples. Values are not observed usage, recommendations or current game statistics.' };
}
export function translationProvenance(_kind: 'moves' | 'abilities' | 'items', _id: string, _english: string) {
  return { state: 'original-demo-description', sourceRevision: 'portfolio-demo-v1', humanApproved: false };
}
