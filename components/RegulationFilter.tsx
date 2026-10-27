import { regulationHistory } from '../lib/catalog-history';
import type { Locale } from '../lib/localization';

export function RegulationFilter({value, onChange, locale, kind}: {value: string; onChange: (value: string) => void; locale: Locale; kind: 'pokemon' | 'items'}) {
  const zh = locale === 'zh-Hant';
  return <div className="filter-group regulation-filter"><b>{zh ? 'DEMO 規則' : 'DEMO rules'}</b><div role="group" aria-label={zh ? '規則篩選' : 'Regulation filter'}>
    <button className="filter-chip" aria-pressed={!value} onClick={() => onChange('')}>{zh ? '全部' : 'All'}</button>
    {regulationHistory.map(rule => <button className="filter-chip" key={rule.regulationId} aria-pressed={value === rule.regulationId} onClick={() => onChange(rule.regulationId)}>{rule.regulationId}</button>)}
    {regulationHistory.slice(1).map(rule => <button className="filter-chip" key={`new:${rule.regulationId}`} aria-pressed={value === `new:${rule.regulationId}`} onClick={() => onChange(`new:${rule.regulationId}`)}>{zh ? `${rule.regulationId} 新增${kind === 'pokemon' ? '寶可夢' : '持有物'}` : `New in ${rule.regulationId}`}</button>)}
  </div></div>;
}
