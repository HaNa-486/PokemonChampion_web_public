import { localizedTerm, type Locale } from '../lib/localization';
import type { Move } from '../lib/types';

const notes: Record<string, [string, string]> = {
  curse: ['Ghost user: one adjacent target; otherwise self.', '使用者是幽靈屬性時為單一鄰近目標；否則為自己。'],
  'expanding-force': ['Grounded user on Psychic Terrain: all adjacent foes.', '使用者接地且處於精神場地時，改為所有鄰近對手。'],
  'dragon-darts': ['In Doubles, the two hits can target different opponents; redirection depends on eligible targets.', '雙打時兩發可分別命中不同對手；分配會依可命中的目標改變。'],
};
export function MoveTarget({move, locale}: {move: Move; locale: Locale}) {
  const note = notes[move.id]?.[locale === 'zh-Hant' ? 1 : 0];
  return <span>{localizedTerm(move.target, locale)}{note && <small className="move-target-note">{note}</small>}</span>;
}
