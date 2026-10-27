"use client";
import {createContext,useContext} from 'react';
import {loadSpeedUsage,peekSpeedUsage,speedUsageKey} from './speed-usage';
import {useRefreshingUsage} from './use-usage';
import {staleBattleUsage} from './usage-client';
import {USAGE_CHECK_MS} from './usage-contract';
import type {BattleFormat,BattleUsage,Pokemon} from './types';

export const SpeedUsageContext=createContext<{usage:BattleUsage|null;busy:boolean;retry:()=>void}|null>(null);

export function useSpeedUsage(pokemon:Pokemon,format:BattleFormat) {
  const shared=useContext(SpeedUsageContext);
  const key=speedUsageKey(pokemon,format);
  const result=useRefreshingUsage(key,force=>loadSpeedUsage(pokemon,format,force),peekSpeedUsage(pokemon,format),
    usage=>usage.provenance?Date.parse(usage.provenance.nextCheckAt):Date.now()+USAGE_CHECK_MS,
    (usage,retryAt)=>staleBattleUsage(usage,retryAt)!,!shared);
  return shared??{usage:result.value??null,busy:result.busy,retry:result.retry};
}
