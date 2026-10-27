import type { BattleFormat, BattleUsage } from './types';

/** Kept for interface compatibility. Demo hooks never schedule refreshes. */
export const USAGE_CHECK_MS = 5 * 60_000;
export const USAGE_RETRY_MS = 60_000;
export const USAGE_PENDING_MS = 5_000;
export const USAGE_CLIENT_TIMEOUT_MS = 20_000;
export const USAGE_CATEGORIES = ['move', 'held_item', 'ability', 'stat_alignment', 'stat_points', 'teammate'] as const;
export type UsageProvenance = {
  provider: 'Portfolio demo';
  sourceUrl: string;
  sourceDate: null;
  sourceVersion: string | null;
  snapshotId: string;
  fetchedAt: string;
  checkedAt: null;
  nextCheckAt: string;
  status: 'demo';
  errorCode: string | null;
  storage: 'bundled';
};
export type UsageRanks = Record<string, Record<BattleFormat, number | null>>;
export type UsageRankings = {
  source: { url: string; dataVersion: string; generatedAt: string; retrievedAt: string; sha256: string; season: string };
  ranksByBattleDataKey: UsageRanks;
  provenance: UsageProvenance;
};
export type BattleUsageData = {
  singles: BattleUsage | null;
  doubles: BattleUsage | null;
  errors?: { singles: string | null; doubles: string | null };
};
/** A fixture has no real-world freshness to verify. UI labels it as a demo. */
export function usageIsStale(_provenance: UsageProvenance | undefined, _now?: number) { return false; }
