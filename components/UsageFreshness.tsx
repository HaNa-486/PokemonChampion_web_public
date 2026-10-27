"use client";
import type { UsageProvenance } from '../lib/usage-contract';

export function UsageFreshness({locale,missingCategories=[]}:{provenance?:UsageProvenance;locale:'en'|'zh-Hant';missingCategories?:string[]}) {
  const zh=locale==='zh-Hant';
  return <span className="usage-freshness" aria-label={zh?'DEMO 使用率資料':'DEMO usage data'}>
    {zh?'DEMO · 虛構固定使用率，非真實對戰統計':'DEMO · Fixed fabricated usage, not real battle statistics'}
    {missingCategories.length>0&&<> · {zh?'部分範例欄位未提供':'Some sample categories are unavailable'}</>}
  </span>;
}
