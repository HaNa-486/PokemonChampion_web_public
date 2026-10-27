"use client";
import { MoveTarget } from "./MoveTarget";
import { useBattleUsage } from "../lib/use-usage";
import { UsageFreshness } from "./UsageFreshness";
import { statisticalScope } from "../lib/research-provenance";

import { useId, useMemo, useState } from "react";
import { getCatalog } from "../lib/catalog";
import { formatPriority, NATURES, priorityMatches } from "../lib/domain";
import { compareValues, type SortDirection } from "../lib/filtering";
import type { BattleUsage, BattleUsageRow, Move, Pokemon } from "../lib/types";
import { InfoTooltip } from "./InfoTooltip";
import { ItemDisplay, ItemTooltip } from "./ItemDisplay";
import { MOVE_FAMILIES } from "../lib/move-taxonomy";
import { ResetFiltersButton } from "./ResetFiltersButton";
import { TypeBadge } from "./TypeBadge";
import { TypeMatchups } from "./TypeMatchups";
import { PokemonUsersDialog, type ReverseSelection } from "./PokemonUsersDialog";
import { localizedTerm } from "../lib/localization";
import { useDialogEscape } from "../lib/use-dialog-escape";
import { ALL_TYPES } from "../lib/type-chart";

type Locale = "en" | "zh-Hant";
type PriorityClass = "positive" | "zero" | "negative";
type LearnableMoveSortKey = "name" | "type" | "category" | "power" | "accuracy" | "pp" | "priority" | "target" | "users";
type LearnableMoveSort = { key: LearnableMoveSortKey; direction: SortDirection };
const statKeys = ["hp", "attack", "defense", "specialAttack", "specialDefense", "speed"] as const;
const statLabels = { hp: "HP", attack: "Atk", defense: "Def", specialAttack: "SpA", specialDefense: "SpD", speed: "Spe" };
const categoryOrder = ["move", "held_item", "ability", "stat_alignment", "stat_points", "teammate"];
const categoryLabels: Record<string, [string, string]> = {
  move: ["Moves", "招式"], held_item: ["Held items", "持有物"], ability: ["Abilities", "特性"], stat_alignment: ["Natures", "性格"], stat_points: ["AP spreads", "AP 配置"], teammate: ["Teammates", "隊友"],
};
const localName = (entry: { name: string; nameZh: string }, locale: Locale) => locale === "zh-Hant" ? entry.nameZh : entry.name;
const toggleValue = (values: string[], value: string) => values.includes(value) ? values.filter((entry) => entry !== value) : [...values, value];
const moveCategoryRank: Record<Move["category"], number> = { Physical: 0, Special: 1, Status: 2 };
const typeRank = new Map(ALL_TYPES.map((type, index) => [type, index]));

export function compareLearnableMoves(a: Move, b: Move) {
  return (typeRank.get(a.type) ?? ALL_TYPES.length) - (typeRank.get(b.type) ?? ALL_TYPES.length)
    || moveCategoryRank[a.category] - moveCategoryRank[b.category]
    || b.priority - a.priority
    || [...a.flags].sort().join(" ").localeCompare([...b.flags].sort().join(" "))
    || a.target.localeCompare(b.target)
    || a.name.localeCompare(b.name);
}

function FilterGroup({ label, options, selected, onToggle, locale }: { label: string; options: string[]; selected: string[]; onToggle: (value: string) => void; locale: Locale }) {
  return <div className="filter-group"><b>{localizedTerm(label, locale)}</b><div>{options.map((option) => <button type="button" className="filter-chip" key={option} onClick={() => onToggle(option)} aria-pressed={selected.includes(option)}>{localizedTerm(option, locale)}</button>)}</div></div>;
}

export function MoveEntry({ move, locale, compact = false }: { move: Move; locale: Locale; compact?: boolean }) {
  return <span className="learnable-move-entry"><InfoTooltip label={localName(move, locale)}><strong>{localName(move, locale)}</strong><div className="tooltip-meta"><TypeBadge type={move.type} locale={locale} /><span>{localizedTerm(move.category, locale)}</span><span>{localizedTerm("Priority", locale)} {formatPriority(move.priority)}</span></div><div className="tooltip-stats"><span>{localizedTerm("Power", locale)} {move.power ?? "—"}</span><span>{localizedTerm("Acc.", locale)} {move.accuracy ?? "—"}</span><span>PP {move.pp || "—"}</span></div><p>{locale === "zh-Hant" ? move.descriptionZh : move.description}</p></InfoTooltip>{!compact && <span className="usage-move-summary"><span className="usage-move-mechanics"><span>{localizedTerm(move.category, locale)}</span><span className={`usage-priority priority-${move.priority > 0 ? "positive" : move.priority < 0 ? "negative" : "zero"}`}>{locale === "zh-Hant" ? "先制度" : "Priority"} {formatPriority(move.priority)}</span></span><small className="learnable-move-stats">{localizedTerm("Power", locale)} {move.power ?? "—"} · {localizedTerm("Acc.", locale)} {move.accuracy ?? "—"} · PP {move.pp || "—"}</small></span>}</span>;
}

function LearnableSortHeader({ label, column, sort, onChange, initialDirection = "asc" }: { label: string; column: LearnableMoveSortKey; sort: LearnableMoveSort | null; onChange: (sort: LearnableMoveSort | null) => void; initialDirection?: SortDirection }) {
  const active = sort?.key === column;
  const oppositeDirection = initialDirection === "asc" ? "desc" : "asc";
  const nextSort = !active ? { key: column, direction: initialDirection } as LearnableMoveSort : sort.direction === initialDirection ? { key: column, direction: oppositeDirection } as LearnableMoveSort : null;
  return <th aria-sort={active ? (sort.direction === "asc" ? "ascending" : "descending") : "none"}><button className="sort-button" onClick={() => onChange(nextSort)}>{label}<span aria-hidden="true">{active ? (sort.direction === "asc" ? "↑" : "↓") : "↕"}</span></button></th>;
}

function LearnableMoveTable({ moves, locale, sort, onSort, onOpenUsers, onAssignMove, savedMoveIds = [], observedMoveIds = [], onToggleObservedMove }: { moves: Move[]; locale: Locale; sort: LearnableMoveSort | null; onSort: (sort: LearnableMoveSort | null) => void; onOpenUsers: (move: Move) => void; onAssignMove?: (moveId: string, slot: number) => void; savedMoveIds?: string[]; observedMoveIds?: string[]; onToggleObservedMove?: (id:string)=>void }) {
  const userLabel = locale === "zh-Hant" ? "可使用此招式的寶可夢" : "Usable Pokémon";
  const columns: Array<[string, LearnableMoveSortKey, SortDirection]> = [["Move", "name", "asc"], ["Type", "type", "asc"], ["Class", "category", "desc"], ["Power", "power", "desc"], ["Acc.", "accuracy", "desc"], ["PP", "pp", "desc"], ["Priority", "priority", "desc"], ["Target", "target", "asc"]];
  return <div className="table-scroll learnable-table-scroll" tabIndex={0}><table className="learnable-move-table"><thead><tr>{columns.map(([label, key, initialDirection]) => <LearnableSortHeader key={key} label={localizedTerm(label, locale)} column={key} sort={sort} onChange={onSort} initialDirection={initialDirection} />)}<th>{localizedTerm("Effect", locale)}</th><LearnableSortHeader label={userLabel} column="users" sort={sort} onChange={onSort} /></tr></thead><tbody>{moves.map((move) => { const userCount = getCatalog().pokemonByMoveId.get(move.id)?.length ?? 0; return <tr key={move.id}><td>{onToggleObservedMove && <input type="checkbox" aria-label={`${locale === "zh-Hant" ? "記錄招式" : "Record move"} ${localName(move,locale)}`} checked={observedMoveIds.includes(move.id)} disabled={observedMoveIds.length>=4&&!observedMoveIds.includes(move.id)} onChange={()=>onToggleObservedMove(move.id)}/>}<MoveEntry move={move} locale={locale} compact />{onAssignMove && <select aria-label={`${locale === "zh-Hant" ? "套用招式" : "Assign move"} ${localName(move, locale)}`} value="" onChange={(event) => { if (event.target.value !== "") onAssignMove(move.id, Number(event.target.value)); }}><option value="">{locale === "zh-Hant" ? "放入招式格…" : "Assign to slot…"}</option>{[0,1,2,3].map((slot) => <option key={slot} value={slot}>{slot+1}: {savedMoveIds[slot] ? (getCatalog().moveById.has(savedMoveIds[slot]) ? localName(getCatalog().moveById.get(savedMoveIds[slot])!, locale) : `${locale === "zh-Hant" ? "已不可用" : "Unavailable"}: ${savedMoveIds[slot]}`) : locale === "zh-Hant" ? "空白" : "Empty"}</option>)}</select>}</td><td><TypeBadge type={move.type} locale={locale} /></td><td>{localizedTerm(move.category, locale)}</td><td>{move.power ?? "—"}</td><td>{move.accuracy ?? "—"}</td><td>{move.pp || "—"}</td><td><span className={`priority-value priority-${move.priority > 0 ? "positive" : move.priority < 0 ? "negative" : "zero"}`}>{formatPriority(move.priority)}</span></td><td><MoveTarget move={move} locale={locale} /></td><td className="move-effect-cell">{locale === "zh-Hant" ? move.descriptionZh : move.description}</td><td><button type="button" className="reverse-count learnable-user-count" onClick={() => onOpenUsers(move)} aria-label={`${locale === "zh-Hant" ? "查看" : "View"} ${userCount} ${locale === "zh-Hant" ? "隻可使用" : "Pokémon that can use"} ${localName(move, locale)}`}>{userCount}</button></td></tr>; })}</tbody></table></div>;
}

function usageName(row: BattleUsageRow, locale: Locale) {
  if (row.ap) {
    const labels = locale === "zh-Hant"
      ? { hp: "HP", attack: "攻擊", defense: "防禦", specialAttack: "特攻", specialDefense: "特防", speed: "速度" }
      : statLabels;
    return statKeys.map((key) => `${labels[key]} ${row.ap![key]}`).join(" / ");
  }
  if (row.name) return row.statUp || row.statDown ? `${row.name} (${row.statUp || "—"} ↑ / ${row.statDown || "—"} ↓)` : row.name;
  return "—";
}

export function UsageEntry({ category, row, locale }: { category: string; row: BattleUsageRow; locale: Locale }) {
  const fallback = usageName(row, locale);
  if (category === "move") {
    const move = getCatalog().moveById.get(getCatalog().moveIdByUsageName.get(getCatalog().usageEntityKey(row.name)) ?? "");
    if (move) return <span className="usage-resource"><TypeBadge type={move.type} locale={locale} /><MoveEntry move={move} locale={locale} /></span>;
  }
  if (category === "ability") {
    const ability = getCatalog().abilityById.get(getCatalog().abilityIdByUsageName.get(getCatalog().usageEntityKey(row.name)) ?? "");
    if (ability) return <InfoTooltip label={localName(ability, locale)}><strong>{localName(ability, locale)}</strong><p>{locale === "zh-Hant" ? ability.descriptionZh : ability.description}</p></InfoTooltip>;
  }
  if (category === "held_item") {
    const item = getCatalog().itemById.get(getCatalog().itemIdByUsageName.get(getCatalog().usageEntityKey(row.name)) ?? "");
    if (item) return <span className="usage-resource"><ItemTooltip item={item} locale={locale} /></span>;
    return <span className="usage-resource"><ItemDisplay locale={locale} fallbackName={fallback} /></span>;
  }
  if (category === "stat_alignment") {
    const nature = NATURES.find((entry) => getCatalog().usageEntityKey(entry.name) === getCatalog().usageEntityKey(row.name));
    if (nature) {
      const name = locale === "zh-Hant" ? nature.nameZh ?? nature.name : nature.name;
      const labels = locale === "zh-Hant"
        ? { hp: "HP", attack: "攻擊", defense: "防禦", specialAttack: "特攻", specialDefense: "特防", speed: "速度" }
        : statLabels;
      return <span>{name}{nature.up && nature.down ? ` (${labels[nature.up]} ↑ / ${labels[nature.down]} ↓)` : locale === "zh-Hant" ? "（能力值不變）" : " (No stat change)"}</span>;
    }
  }
  if (category === "teammate") {
    const teammate = getCatalog().pokemon.find((entry) => getCatalog().usageEntityKey(entry.name) === getCatalog().usageEntityKey(row.name));
    if (teammate) return <span>{localName(teammate, locale)}</span>;
  }
  return <span>{fallback}</span>;
}

function BattlePanel({ usage, locale, visibleCategories = categoryOrder }: { usage: BattleUsage | null | undefined; locale: Locale; visibleCategories?: string[] }) {
  if (!usage) return <p className="detail-empty">{locale === "zh-Hant" ? "目前無法取得此模式的使用率資料。" : "Usage is currently unavailable for this format."}</p>;
  const groups = categoryOrder.filter((category) => visibleCategories.includes(category)).map((category) => ({ category, rows: usage.rows.filter((row) => row.category === category).sort((left, right) => left.rank - right.rank) })).filter((group) => group.rows.length);
  const rankGapByCategory = new Map((usage.rankGaps ?? []).map((gap) => [gap.category, gap.missingRanks]));
  return <div className="battle-usage"><p className="battle-source"><UsageFreshness provenance={usage.provenance} locale={locale} missingCategories={usage.missingCategories}/><br/>{locale === "zh-Hant" ? "固定範例 · 每個欄位獨立示範" : "Fixed fixtures · each category is a separate demonstration"}</p>{groups.map(({ category, rows }) => { const missingRanks = rankGapByCategory.get(category) ?? []; return <section key={category}><h3>{categoryLabels[category]?.[locale === "zh-Hant" ? 1 : 0] ?? category}</h3>{missingRanks.length > 0 && <p className="battle-rank-warning" role="note">{locale === "zh-Hant" ? `示範資料缺少第 ${missingRanks.join("、")} 名；以下保留虛構範例排名。` : `The demo fixture is missing ranks ${missingRanks.map((rank) => `#${rank}`).join(", ")}; the fabricated ranks are preserved below.`}</p>}<div className="usage-table"><div className="usage-head"><span>DEMO #</span><span>{locale === "zh-Hant" ? "項目" : "Entry"}</span><span>{locale === "zh-Hant" ? "DEMO 使用率" : "DEMO usage"}</span></div>{rows.map((row, index) => <div className="usage-row" key={`${category}-${row.rank}-${index}`}><b>{row.rank || index + 1}</b><UsageEntry category={category} row={row} locale={locale} /><strong>{row.percentage || "—"}</strong></div>)}</div></section>; })}</div>;
}

export function PokemonDetailDialog({ pokemon, locale, initialFormat, onClose, onBuild, onScrapbook }: { pokemon: Pokemon; locale: Locale; initialFormat: "singles" | "doubles"; onClose: () => void; onBuild: () => void; onScrapbook?: (entry: Pokemon) => void }) {
  useDialogEscape(onClose);
  return <PokemonDetailPanel pokemon={pokemon} locale={locale} initialFormat={initialFormat} onClose={onClose} onBuild={onBuild} onScrapbook={onScrapbook} />;
}

export function compareScrapbookLearnableMoves(preferredTypes: Pokemon["types"], left: Move, right: Move) {
  const preferred = Number(!preferredTypes.includes(left.type)) - Number(!preferredTypes.includes(right.type));
  return preferred || (typeRank.get(left.type) ?? ALL_TYPES.length) - (typeRank.get(right.type) ?? ALL_TYPES.length)
    || moveCategoryRank[left.category] - moveCategoryRank[right.category]
    || bumpyMoveSort(left, right);
}

export function PokemonDetailPanel({ pokemon, locale, initialFormat, onClose, onBuild, onScrapbook, inline = false, buildLabel, visibleBattleCategories: controlledBattleCategories, onVisibleBattleCategoriesChange, onAssignMove, savedMoveIds }: { pokemon: Pokemon; locale: Locale; initialFormat: "singles" | "doubles"; onClose?: () => void; onBuild: () => void; onScrapbook?: (entry: Pokemon) => void; inline?: boolean; buildLabel?: string; visibleBattleCategories?: string[]; onVisibleBattleCategoriesChange?: (categories: string[]) => void; onAssignMove?: (moveId: string, slot: number) => void; savedMoveIds?: string[] }) {
  const titleId = useId();
  const [format, setFormat] = useState(initialFormat);
  const {data:battle,error,retry} = useBattleUsage(pokemon);
  const [internalBattleCategories, setInternalBattleCategories] = useState<string[]>(categoryOrder);
  const visibleBattleCategories = controlledBattleCategories ?? internalBattleCategories;
  const setVisibleBattleCategories = (updater: (current: string[]) => string[]) => {
    const next = updater(visibleBattleCategories);
    if (onVisibleBattleCategoriesChange) onVisibleBattleCategoriesChange(next);
    else setInternalBattleCategories(next);
  };
  const megaStoneId = getCatalog().megaStoneIdByPokemonId.get(pokemon.id);
  const megaBase = megaStoneId ? getCatalog().pokemonById.get(getCatalog().megaBasePokemonIdByMegaId.get(pokemon.id) ?? "") : null;
  const sharesBaseBattleData = Boolean(pokemon.isMega && megaBase) || statisticalScope(pokemon).kind === "base-and-mega-combined";
  const copy = locale === "zh-Hant" ? { close: "關閉", build: buildLabel ?? "配置並加入隊伍", scrapbook: "加入其他畫本", moves: "可學招式", abilities: "可選特性", battle: "DEMO 對戰資料", loading: "正在讀取 DEMO 範例…", note: sharesBaseBattleData ? "普通與 Mega 型態共用虛構 DEMO 範例。" : "" } : { close: "Close", build: buildLabel ?? "Build & add to team", scrapbook: "Add to another scrapbook", moves: "Learnable moves", abilities: "Available abilities", battle: "DEMO battle data", loading: "Loading DEMO fixtures…", note: sharesBaseBattleData ? "Base and Mega forms share the same fabricated DEMO sample." : "" };

  const content = <><header className="detail-identity"><img src={pokemon.imageUrl} alt="" width="112" height="112" /><div><p className="eyebrow">POKÉMON INTELLIGENCE</p><h2 id={titleId}>{localName(pokemon, locale)}</h2><div className="badge-row">{pokemon.types.map((type) => <TypeBadge key={type} type={type} locale={locale} />)}</div></div><div className="detail-actions">{onScrapbook && <button className="secondary-button" onClick={() => onScrapbook(pokemon)}>{copy.scrapbook}</button>}<button className="primary-button detail-build" onClick={onBuild}>{copy.build}</button></div></header>{!inline && <div className="detail-stats">{statKeys.map((key) => <span key={key}><small>{statLabels[key]}</small><b>{pokemon.baseStats[key]}</b></span>)}</div>}<TypeMatchups types={pokemon.types} locale={locale} /><div className="detail-section"><h3>{copy.abilities} <span>{pokemon.abilityIds.length}</span></h3><div className="detail-abilities">{pokemon.abilityIds.map((id) => { const ability = getCatalog().abilityById.get(id); return ability ? <InfoTooltip key={id} label={localName(ability, locale)}><strong>{localName(ability, locale)}</strong><p>{locale === "zh-Hant" ? ability.descriptionZh : ability.description}</p></InfoTooltip> : null; })}</div></div><LearnableMovesSection pokemon={pokemon} locale={locale} inline={inline} onScrapbook={onScrapbook} onAssignMove={onAssignMove} savedMoveIds={savedMoveIds} /><div className="detail-section"><div className="detail-section-head"><h3>{copy.battle}</h3><div className="segmented"><button className={format === "singles" ? "active" : ""} onClick={() => setFormat("singles")}>{locale === "zh-Hant" ? "單打" : "Singles"}</button><button className={format === "doubles" ? "active" : ""} onClick={() => setFormat("doubles")}>{locale === "zh-Hant" ? "雙打" : "Doubles"}</button></div></div>{inline && <fieldset className="battle-category-toggles"><legend>{locale === "zh-Hant" ? "顯示的 DEMO 排名" : "DEMO rankings to show"}</legend>{categoryOrder.map((category) => <label key={category}><input type="checkbox" checked={visibleBattleCategories.includes(category)} onChange={() => setVisibleBattleCategories((current) => current.includes(category) ? current.filter((entry) => entry !== category) : [...current, category])} /><span>{categoryLabels[category]?.[locale === "zh-Hant" ? 1 : 0] ?? category}</span></label>)}</fieldset>}{sharesBaseBattleData && <p className="data-scope-note">{copy.note}</p>}{error && !battle ? <p className="form-error">{locale === "zh-Hant" ? "使用率暫時無法取得。" : "Usage is temporarily unavailable."} <button onClick={retry}>{locale === "zh-Hant" ? "重試" : "Retry"}</button></p> : battle ? <BattlePanel usage={format === "singles" ? battle.singles : battle.doubles} locale={locale} visibleCategories={visibleBattleCategories} /> : <p className="detail-empty">{copy.loading}</p>}</div></>;

  if (inline) return <><section className="pokemon-detail scrapbook-inline-detail" aria-labelledby={titleId}>{content}</section></>;
  return <><div className="detail-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose?.(); }}><section className="pokemon-detail" role="dialog" aria-modal="true" aria-labelledby={titleId}><button className="close-button" onClick={onClose} aria-label={copy.close}>×</button>{content}</section></div></>;
}

function bumpyMoveSort(left: Move, right: Move) {
  return right.priority - left.priority
    || [...left.flags].sort().join(" ").localeCompare([...right.flags].sort().join(" "))
    || left.target.localeCompare(right.target)
    || left.name.localeCompare(right.name);
}

export function LearnableMovesSection({pokemon,locale,inline=false,onScrapbook,onAssignMove,savedMoveIds,observedMoveIds=[],onToggleObservedMove}:{pokemon:Pokemon;locale:Locale;inline?:boolean;onScrapbook?:(entry:Pokemon)=>void;onAssignMove?:(moveId:string,slot:number)=>void;savedMoveIds?:string[];observedMoveIds?:string[];onToggleObservedMove?:(id:string)=>void}) {
  const [moveQuery, setMoveQuery] = useState("");
  const [priorities, setPriorities] = useState<PriorityClass[]>([]);
  const [types, setTypes] = useState<string[]>([]);
  const [categories, setCategories] = useState<string[]>([]);
  const [targets, setTargets] = useState<string[]>([]);
  const [families, setFamilies] = useState<string[]>([]);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [moveSort, setMoveSort] = useState<LearnableMoveSort | null>(null);
  const [reverseSelection, setReverseSelection] = useState<ReverseSelection | null>(null);
  const learnableMoves = useMemo(() => pokemon.moveIds.map((id) => getCatalog().moveById.get(id)).filter((entry): entry is Move => Boolean(entry)), [pokemon.moveIds]);
  const typeOptions = useMemo(() => ALL_TYPES.filter((type) => learnableMoves.some((move) => move.type === type)), [learnableMoves]);
  const targetOptions = useMemo(() => [...new Set(learnableMoves.map((move) => move.target))].sort(), [learnableMoves]);
  const moveEntries = useMemo(() => learnableMoves.filter((move) => {
    const searchMatch = `${move.name} ${move.nameZh}`.toLowerCase().includes(moveQuery.toLowerCase());
    return searchMatch && priorityMatches(move, priorities) && (!types.length || types.includes(move.type)) && (!categories.length || categories.includes(move.category)) && (!targets.length || targets.includes(move.target)) && (!families.length || families.some(flag => move.flags.includes(flag)));
  }).sort((left, right) => {
    if (!moveSort) return inline ? compareScrapbookLearnableMoves(pokemon.types, left, right) : compareLearnableMoves(left, right);
    const value = (move: Move) => moveSort.key === "users" ? (getCatalog().pokemonByMoveId.get(move.id)?.length ?? 0) : move[moveSort.key];
    const leftValue = value(left);
    const rightValue = value(right);
    if (leftValue == null || rightValue == null) {
      if (leftValue == null && rightValue == null) return left.name.localeCompare(right.name);
      return leftValue == null ? 1 : -1;
    }
    return compareValues(leftValue, rightValue, moveSort.direction) || left.name.localeCompare(right.name);
  }), [inline, learnableMoves, moveQuery, priorities, types, categories, targets, families, pokemon.types, moveSort]);
  const activeFilterCount = priorities.length + types.length + categories.length + targets.length + families.length;
  const clearMoveFilters = () => { setMoveQuery(""); setPriorities([]); setTypes([]); setCategories([]); setTargets([]); setFamilies([]); };
  const openMoveUsers = (move: Move) => setReverseSelection({
    id: move.id,
    kind: "move",
    name: localName(move, locale),
    description: locale === "zh-Hant" ? move.descriptionZh : move.description,
    users: getCatalog().pokemonByMoveId.get(move.id) ?? [],
    move,
  });
  const reverseDialog = reverseSelection ? <PokemonUsersDialog key={`move-${reverseSelection.id}`} selection={reverseSelection} locale={locale} onClose={() => setReverseSelection(null)} onScrapbook={onScrapbook ?? (() => undefined)} /> : null;
  return <><div className="detail-section"><div className="detail-section-head"><h3>{locale === "zh-Hant" ? "可學招式" : "Learnable moves"} <span>{moveEntries.length} / {pokemon.moveIds.length}</span></h3><input aria-label="Search learnable moves" value={moveQuery} onChange={(event) => setMoveQuery(event.target.value)} placeholder={locale === "zh-Hant" ? "搜尋可學招式…" : "Search learnable moves…"} /></div><button type="button" className="move-filter-toggle filter-chip" aria-expanded={filtersOpen} onClick={() => setFiltersOpen((value) => !value)}>{locale === "zh-Hant" ? "招式篩選" : "Move filters"}{activeFilterCount ? ` (${activeFilterCount})` : ""}</button><div className={`advanced-filters detail-move-filters${filtersOpen ? " open" : ""}`}><FilterGroup locale={locale} label="Priority" options={["+ Positive", "0 Neutral", "− Negative"]} selected={priorities.map((entry) => entry === "positive" ? "+ Positive" : entry === "zero" ? "0 Neutral" : "− Negative")} onToggle={(label) => { const entry = label.startsWith("+") ? "positive" : label.startsWith("0") ? "zero" : "negative"; setPriorities((current) => toggleValue(current, entry) as PriorityClass[]); }} /><FilterGroup locale={locale} label="Type" options={typeOptions} selected={types} onToggle={(entry) => setTypes((current) => toggleValue(current, entry))} /><FilterGroup locale={locale} label="Category" options={["Physical", "Special", "Status"]} selected={categories} onToggle={(entry) => setCategories((current) => toggleValue(current, entry))} /><FilterGroup locale={locale} label="Target" options={targetOptions} selected={targets} onToggle={(entry) => setTargets((current) => toggleValue(current, entry))} /><FilterGroup locale={locale} label="Move families" options={MOVE_FAMILIES} selected={families} onToggle={(entry) => setFamilies((current) => toggleValue(current, entry))} /><div className="detail-filter-actions"><ResetFiltersButton locale={locale} onClick={clearMoveFilters} /></div></div>{moveEntries.length ? <LearnableMoveTable moves={moveEntries} locale={locale} sort={moveSort} onSort={setMoveSort} onOpenUsers={openMoveUsers} onAssignMove={onAssignMove} savedMoveIds={savedMoveIds} observedMoveIds={observedMoveIds} onToggleObservedMove={onToggleObservedMove} /> : <p className="detail-empty">{locale === "zh-Hant" ? "沒有符合目前篩選條件的招式。" : "No learnable moves match the current filters."}</p>}</div>{reverseDialog}</>;
}
