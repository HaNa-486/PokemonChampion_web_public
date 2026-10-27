import { battleUsageKey, loadBattleUsage, peekBattleUsage } from './usage-client';
import type { BattleFormat,BattleUsage,Pokemon } from "./types";
export const speedUsageKey=(pokemon:Pokemon,format:BattleFormat)=>`${battleUsageKey(pokemon)}:${format}`;
export const peekSpeedUsage=(pokemon:Pokemon,format:BattleFormat)=>peekBattleUsage(pokemon)?.[format] ?? undefined;
export async function loadSpeedUsage(pokemon:Pokemon,format:BattleFormat,force=false):Promise<BattleUsage> {
  const usage=(await loadBattleUsage(pokemon,force))[format];
  if(!usage)throw new Error('Usage unavailable');
  return usage;
}
