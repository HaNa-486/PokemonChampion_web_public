"use client";
import { useEffect, useState } from 'react';
import { battleUsageKey, bootstrapUsageRankings, loadBattleUsage, loadUsageRankings, peekBattleUsage, usageRankingsKey } from './usage-client';
import type { BattleUsageData, UsageRankings } from './usage-contract';
import type { Pokemon } from './types';

/** Loads the local fixture once per selection. No timers, polling or focus requests. */
export function useRefreshingUsage<T>(key: string, loader: (force?: boolean) => Promise<T>, initial: T | undefined,
  _nextCheck: (value: T) => number, _failed: (value: T, retryAt: number) => T, enabled = true) {
  const [state, setState] = useState<{ key: string; value?: T; busy: boolean; error: boolean }>({ key, value: initial, busy: !initial, error: false });
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    if (!enabled) return;
    let cancelled = false;
    void loader().then(value => {
      if (!cancelled) setState({ key, value, busy: false, error: false });
    }, () => {
      if (!cancelled) setState({ key, value: initial, busy: false, error: true });
    });
    return () => { cancelled = true; };
    // A key identifies the entire fixture; caller closures do not need refreshes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, attempt, enabled]);
  return { value: state.key === key ? state.value ?? initial : initial,
    busy: enabled && (state.key !== key ? !initial : state.busy),
    error: state.key === key && state.error, retry: () => setAttempt(n => n + 1) };
}
const noDeadline = () => Infinity;
export function useBattleUsage(pokemon: Pokemon) {
  const result = useRefreshingUsage<BattleUsageData>(battleUsageKey(pokemon), () => loadBattleUsage(pokemon),
    peekBattleUsage(pokemon), noDeadline, data => data);
  return { ...result, data: result.value ?? null };
}
export function useUsageRankings(enabled = true) {
  return useRefreshingUsage<UsageRankings>(usageRankingsKey(), loadUsageRankings, bootstrapUsageRankings(),
    noDeadline, data => data, enabled);
}
