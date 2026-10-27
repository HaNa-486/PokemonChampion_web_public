import { DEMO_VERSION } from '../data/demo-catalog';

export function getPublishedData() {
  return {
    publishedRuleset: { regulationId: 'Demo', seasonId: 'Illustrative', effectiveFrom: null, effectiveTo: null, formats: ['singles', 'doubles'] },
    publishedDataVersion: DEMO_VERSION,
    publishedSnapshotGeneratedAt: null,
    publishedRulesetCode: 'portfolio-demo',
  };
}
export const { publishedRuleset, publishedDataVersion, publishedSnapshotGeneratedAt, publishedRulesetCode } = getPublishedData();
