"use client";
import { CatalogPagination, catalogPage, useCatalogPageSize } from "./CatalogNavigation";
import { StickyCatalogTable } from "./StickyCatalogTable";
import { speedPickerRank, speedPickerRankSource } from "../lib/speed-picker";
import { useUsageRankings } from "../lib/use-usage";
import { UsageFreshness } from "./UsageFreshness";
import { MoveTarget } from "./MoveTarget";
import { borrowedStatNotes } from '../lib/damage-moves';
import { RegulationFilter } from "./RegulationFilter";
import { matchesRegulation, validRegulationFilter } from "../lib/catalog-history";
import { MOVE_FAMILIES, isMoveFamily } from "../lib/move-taxonomy";
import { matchesPokemon } from "../lib/pokemon-query";

import { useMemo, useState } from "react";
import { useSessionState } from "../lib/use-session-state";
import { getCatalog } from "../lib/catalog";
import { formatPriority, priorityMatches, totalBaseStats } from "../lib/domain";
import { abilityCategories, compareValues, itemEffectCategories, type SortDirection } from "../lib/filtering";
import { ALL_TYPES } from "../lib/type-chart";
import { localizedTerm, localizedTerms } from "../lib/localization";
import type { Move, Pokemon, Stats } from "../lib/types";
import { InfoTooltip } from "./InfoTooltip";
import { ItemTooltip } from "./ItemDisplay";
import { PokemonDetailDialog } from "./PokemonDetailDialog";
import { PokemonUsersDialog, type ReverseSelection } from "./PokemonUsersDialog";
import { ResetFiltersButton } from "./ResetFiltersButton";
import { TypeBadge } from "./TypeBadge";

type Locale = "en" | "zh-Hant";
type PriorityClass = "positive" | "zero" | "negative";
type SortState<Key extends string> = { key: Key; direction: SortDirection };

const statKeys = ["hp", "attack", "defense", "specialAttack", "specialDefense", "speed"] as const;
const statLabels: Record<(typeof statKeys)[number], string> = { hp: "HP", attack: "Atk", defense: "Def", specialAttack: "SpA", specialDefense: "SpD", speed: "Spe" };
const abilityFilterOptions = ["Weather", "Terrain", "Offense", "Defense", "Status", "Stat Changes", "Speed", "Type", "Contact", "Switch / Hazard", "Item / Berry", "Ability / Move", "Other"];
const itemEffectOptions = ["HP Recovery", "Status Cure", "PP Recovery", "Damage Halving", "Other"];

const localName = (entry: { name: string; nameZh: string }, locale: Locale) => locale === "zh-Hant" ? entry.nameZh : entry.name;
const toggleValue = (values: string[], value: string) => values.includes(value) ? values.filter((entry) => entry !== value) : [...values, value];

function nextSort<Key extends string>(sort: SortState<Key>, key: Key, initialDirection: SortDirection): SortState<Key> {
  return sort.key === key ? { key, direction: sort.direction === "asc" ? "desc" : "asc" } : { key, direction: initialDirection };
}

function SortHeader<Key extends string>({ label, column, sort, onChange, initialDirection = "asc" }: { label: string; column: Key; sort: SortState<Key>; onChange: (sort: SortState<Key>) => void; initialDirection?: SortDirection }) {
  const active = sort.key === column;
  return <th aria-sort={active ? (sort.direction === "asc" ? "ascending" : "descending") : "none"}><button className="sort-button" onClick={() => onChange(nextSort(sort, column, initialDirection))}>{label}<span aria-hidden="true">{active ? (sort.direction === "asc" ? "↑" : "↓") : "↕"}</span></button></th>;
}

function FilterGroup({ label, options, selected, onToggle, locale }: { label: string; options: string[]; selected: string[]; onToggle: (value: string) => void; locale: Locale }) {
  return <div className="filter-group"><b>{localizedTerm(label, locale)}</b><div>{options.map((option) => <button type="button" className="filter-chip" key={option} onClick={() => onToggle(option)} aria-pressed={selected.includes(option)}>{localizedTerm(option, locale)}</button>)}</div></div>;
}

function MoveTooltip({ move, locale, onActivate }: { move: Move; locale: Locale; onActivate?: () => void }) {
  return <InfoTooltip label={localName(move, locale)} onActivate={onActivate}><strong>{localName(move, locale)}</strong><div className="tooltip-meta"><TypeBadge type={move.type} locale={locale} /><span>{localizedTerm(move.category, locale)}</span><span>{localizedTerm("Priority", locale)} {formatPriority(move.priority)}</span></div><div className="tooltip-stats"><span>{localizedTerm("Power", locale)} {move.power ?? "—"}</span><span>{localizedTerm("Acc.", locale)} {move.accuracy ?? "—"}</span><span>PP {move.pp || "—"}</span></div><p>{locale === "zh-Hant" ? move.descriptionZh : move.description}</p></InfoTooltip>;
}

function AbilityTooltip({ id, locale, onActivate }: { id: string; locale: Locale; onActivate?: () => void }) {
  const ability = getCatalog().abilityById.get(id);
  if (!ability) return <span>—</span>;
  return <InfoTooltip label={localName(ability, locale)} onActivate={onActivate}><strong>{localName(ability, locale)}</strong><p>{locale === "zh-Hant" ? ability.descriptionZh : ability.description}</p></InfoTooltip>;
}
type PokemonSortKey = "usage" | "name" | "type" | keyof Stats | "total" | "ability";

export function PokemonTableV2({ locale, format, onSelect, onScrapbook = () => undefined, active = true }: { locale: Locale; format: "singles" | "doubles"; onSelect: (entry: Pokemon) => void; onScrapbook?: (entry: Pokemon) => void; active?: boolean }) {
  const rankingState = useUsageRankings(active);
  const rankings = rankingState.value!;
  const ranks = rankings.ranksByBattleDataKey;
  const [query, setQuery] = useSessionState("pokemon-query", "");
  const [regulation, setRegulation] = useSessionState("pokemon-regulation", "", validRegulationFilter);
  const [generations, setGenerations] = useSessionState<string[]>("pokemon-generations", [], v => Array.isArray(v) && v.every(x => /^[1-9]$/.test(x)));
  const [filtersExpanded, setFiltersExpanded] = useSessionState("pokemon-filters-open", false);
  const [sort, setSort] = useSessionState<SortState<PokemonSortKey>>(`pokemon-sort-usage-v2-${format}`, { key: "usage", direction: "desc" }, v => !!v && typeof v === "object" && "key" in v && "direction" in v && typeof v.key === "string" && typeof v.direction === "string" && ["usage", "name", "type", ...statKeys, "total", "ability"].includes(String(v.key)) && ["asc", "desc"].includes(String(v.direction)));
  const [details, setDetails] = useState<Pokemon | null>(null);
  const [page, setPage] = useSessionState(`pokemon-page-${format}`, 1, v => Number.isInteger(v) && Number(v) >= 1);
  const [selectedTypes, setSelectedTypes] = useSessionState<string[]>("pokemon-types", [], v => Array.isArray(v) && v.every(t => ALL_TYPES.includes(t)));
  const [typeMode, setTypeMode] = useSessionState<"or" | "and">("pokemon-type-mode", "or", v => v === "or" || v === "and");
  const [form, setForm] = useSessionState<"all" | "regular" | "mega">("pokemon-form", "all", v => ["all", "regular", "mega"].includes(String(v)));
  const [abilityId, setAbilityId] = useSessionState("pokemon-ability", "", v => v === "" || getCatalog().abilityById.has(String(v)));
  const [abilityInput, setAbilityInput] = useSessionState("pokemon-ability-input", "");
  const [knownMoveIds, setKnownMoveIds] = useSessionState<string[]>("pokemon-known-moves", [], v => Array.isArray(v) && v.every(id => getCatalog().moveById.has(id)));
  const [moveInput, setMoveInput] = useSessionState("pokemon-move-input", "");
  const [statMinimums, setStatMinimums] = useSessionState<Stats>("pokemon-minimums", { hp: 0, attack: 0, defense: 0, specialAttack: 0, specialDefense: 0, speed: 0 }, v => !!v && typeof v === "object" && statKeys.every(k => k in v && Number.isFinite((v as Stats)[k]) && (v as Stats)[k] >= 0 && (v as Stats)[k] <= 255));
  const [totalMinimum, setTotalMinimum] = useSessionState("pokemon-total-minimum", 0, v => Number.isFinite(v) && Number(v) >= 0 && Number(v) <= 1530);
  const [pageSize, setPageSize] = useCatalogPageSize("pokemon");
  const matches = getCatalog().pokemon.filter(entry => matchesPokemon(entry, {q:query, regulation, generations: generations.map(Number), types:selectedTypes, typeMode, form, abilityId, moveIds:knownMoveIds, minStats:statMinimums, totalMinimum}));
  const value = (entry: Pokemon) => {
    if (sort.key === "usage") return speedPickerRank(entry, format, ranks);
    if (sort.key === "name") return localName(entry, locale);
    if (sort.key === "type") return entry.types.join(" ");
    if (sort.key === "ability") return entry.abilityIds.map((id) => getCatalog().abilityById.get(id)?.name ?? id).join(" ");
    if (sort.key === "total") return totalBaseStats(entry.baseStats);
    return entry.baseStats[sort.key];
  };
  const sorted = [...matches].sort((a, b) => {
    if (sort.key === "usage") {
      const left = speedPickerRank(a, format, ranks), right = speedPickerRank(b, format, ranks);
      // Null is unknown, never zero usage. Lower upstream rank means higher usage.
      if (left === null || right === null) return left === right ? a.id.localeCompare(b.id) : left === null ? 1 : -1;
      return (sort.direction === "desc" ? left-right : right-left) || a.id.localeCompare(b.id);
    }
    return compareValues(value(a), value(b), sort.direction) || a.id.localeCompare(b.id);
  });
  const {pageCount, safePage, start, rows} = catalogPage(sorted, page, pageSize);
  const rangeStart = sorted.length ? start + 1 : 0;
  const rangeEnd = Math.min(start + rows.length, sorted.length);
  const changeSort = (next: SortState<PokemonSortKey>) => { setSort(next); setPage(1); };
  const updateMinimum = (key: keyof Stats, value: number) => { setStatMinimums((current) => ({ ...current, [key]: Math.max(0, Math.min(255, value || 0)) })); setPage(1); };
  const clearFilters = () => { setQuery(""); setRegulation(""); setGenerations([]); setSelectedTypes([]); setTypeMode("or"); setForm("all"); setAbilityId(""); setAbilityInput(""); setKnownMoveIds([]); setMoveInput(""); setStatMinimums({ hp: 0, attack: 0, defense: 0, specialAttack: 0, specialDefense: 0, speed: 0 }); setTotalMinimum(0); setPage(1); };
  const matchAbility = (value: string) => getCatalog().abilities.find((entry) => [entry.name, entry.nameZh].some((name) => name.toLocaleLowerCase() === value.trim().toLocaleLowerCase()));
  const matchMove = (value: string) => getCatalog().moves.find((entry) => [entry.name, entry.nameZh].some((name) => name.toLocaleLowerCase() === value.trim().toLocaleLowerCase()));
  const copy = locale === "zh-Hant" ? { title: "寶可夢資料庫", legal: "個示範型態", showing: "顯示", of: "共", page: "頁", previous: "上一頁", next: "下一頁", hint: "點擊名稱查看可學招式、特性及 DEMO 單打／雙打資料" } : { title: "Pokémon DB", legal: "demo forms", showing: "showing", of: "of", page: "Page", previous: "Previous", next: "Next", hint: "Select a name for moves, abilities, and DEMO Singles / Doubles data" };
  if (!active) return null;
  return <><section className="panel catalog-panel"><div className="panel-head"><div><p className="eyebrow">DEMO CATALOG</p><h1 tabIndex={-1}>{copy.title}</h1><p>{matches.length} {copy.legal} · {copy.showing} {rangeStart}–{rangeEnd} {copy.of} {sorted.length} · {copy.hint}</p></div></div>
    <div className="advanced-filters pokemon-advanced-filters">
      <FilterGroup label={locale === "zh-Hant" ? "世代" : "Generation"} locale={locale} options={["1","2","3","4","5","6","7","8","9"]} selected={generations} onToggle={v => { setGenerations(current => toggleValue(current, v)); setPage(1); }} />
      <RegulationFilter kind="pokemon" locale={locale} value={regulation} onChange={v => { setRegulation(v); setPage(1); }} />
      <div className="filter-group pokemon-name-filter"><b>{locale === "zh-Hant" ? "名稱" : "Name"}</b><label><span className="sr-only">Search Pokémon by name</span><input value={query} onChange={(event) => { setQuery(event.target.value); setPage(1); }} placeholder={locale === "zh-Hant" ? "搜尋寶可夢名稱…" : "Search Pokémon name…"} /></label></div>
      <details className="catalog-filter-details" open={filtersExpanded} onToggle={(event) => setFiltersExpanded(event.currentTarget.open)}><summary>{locale === "zh-Hant" ? "進階篩選" : "Advanced filters"} · {matches.length} {locale === "zh-Hant" ? "個結果" : "results"}</summary><FilterGroup locale={locale} label={locale === "zh-Hant" ? "屬性" : "Type"} options={ALL_TYPES} selected={selectedTypes} onToggle={(entry) => { setSelectedTypes((current) => toggleValue(current, entry)); setPage(1); }} />
      <div className="filter-group filter-logic-row"><b>{locale === "zh-Hant" ? "屬性邏輯" : "Type logic"}</b><div className="segmented" role="group" aria-label="Type filter logic"><button className={typeMode === "or" ? "active" : ""} aria-pressed={typeMode === "or"} onClick={() => { setTypeMode("or"); setPage(1); }}>OR</button><button className={typeMode === "and" ? "active" : ""} aria-pressed={typeMode === "and"} onClick={() => { setTypeMode("and"); setPage(1); }}>AND</button><span>{locale === "zh-Hant" ? typeMode === "or" ? "符合任一所選屬性" : "同時具有全部所選屬性" : typeMode === "or" ? "Match any selected type" : "Match every selected type"}</span></div></div>
      <div className="filter-group"><b>{locale === "zh-Hant" ? "型態" : "Form"}</b><div>{(["all", "regular", "mega"] as const).map((entry) => <button key={entry} className="filter-chip" aria-pressed={form === entry} onClick={() => { setForm(entry); setPage(1); }}>{locale === "zh-Hant" ? entry === "all" ? "全部" : entry === "regular" ? "一般" : "Mega" : entry === "all" ? "All" : entry === "regular" ? "Regular" : "Mega"}</button>)}</div></div>
      <div className="filter-group filter-select-row"><b>{locale === "zh-Hant" ? "特性" : "Ability"}</b><div><input list="pokemon-ability-options" aria-label="Search ability filter" value={abilityInput} onChange={(event) => { const value = event.target.value; const matched = matchAbility(value); setAbilityInput(value); setAbilityId(matched?.id ?? ""); setPage(1); }} placeholder={locale === "zh-Hant" ? "輸入特性名稱…" : "Type an ability…"} /><datalist id="pokemon-ability-options">{getCatalog().abilities.map((entry) => <option key={entry.id} value={localName(entry, locale)} />)}</datalist>{abilityId && <button className="selected-filter" onClick={() => { setAbilityId(""); setAbilityInput(""); setPage(1); }}>{localName(getCatalog().abilityById.get(abilityId)!, locale)} ×</button>}</div></div>
      <div className="filter-group filter-select-row"><b>{locale === "zh-Hant" ? "可學招式" : "Known moves"}</b><div><input list="pokemon-move-options" aria-label="Search known move filter" value={moveInput} onChange={(event) => { const value = event.target.value; const matched = matchMove(value); if (matched) { setKnownMoveIds((current) => current.includes(matched.id) ? current : [...current, matched.id]); setMoveInput(""); } else setMoveInput(value); setPage(1); }} placeholder={locale === "zh-Hant" ? "輸入招式名稱…" : "Type a move…"} /><datalist id="pokemon-move-options">{getCatalog().moves.map((entry) => <option key={entry.id} value={localName(entry, locale)} />)}</datalist>{knownMoveIds.map((id) => <button key={id} className="selected-filter" onClick={() => { setKnownMoveIds((current) => current.filter((entry) => entry !== id)); setPage(1); }}>{localName(getCatalog().moveById.get(id)!, locale)} ×</button>)}</div></div>
      <div className="filter-group stat-minimum-filter"><b>{locale === "zh-Hant" ? "最低種族值" : "Minimum stats"}</b><div>{statKeys.map((key) => <label key={key}>{statLabels[key]}<input aria-label={`Minimum ${statLabels[key]}`} type="number" min="0" max="255" value={statMinimums[key] || ""} placeholder="0" onChange={(event) => updateMinimum(key, Number(event.target.value))} /></label>)}<label>TOT<input aria-label="Minimum TOT" type="number" min="0" max="1530" value={totalMinimum || ""} placeholder="0" onChange={(event) => { setTotalMinimum(Math.max(0, Math.min(1530, Number(event.target.value) || 0))); setPage(1); }} /></label></div></div>
      <div className="filter-actions"><ResetFiltersButton locale={locale} onClick={clearFilters} /><span>{locale === "zh-Hant" ? "多個招式條件會同時套用（AND）。" : "Multiple known moves use AND matching."}</span></div></details>
    </div>
    <div className="catalog-sort-toolbar"><button className="filter-chip" aria-pressed={sort.key === "usage" && sort.direction === "desc"} onClick={() => changeSort({key:"usage",direction:"desc"})}>{locale === "zh-Hant" ? `${format === "singles" ? "單打" : "雙打"} DEMO 使用率 ↓` : `${format === "singles" ? "Singles" : "Doubles"} DEMO usage ↓`}</button><span><UsageFreshness provenance={rankings.provenance} locale={locale} /></span></div>
    <StickyCatalogTable header={<tr><SortHeader label="Pokémon" column="name" sort={sort} onChange={changeSort} /><SortHeader label={localizedTerm("Type", locale)} column="type" sort={sort} onChange={changeSort} />{statKeys.map((key) => <SortHeader key={key} label={statLabels[key]} column={key} sort={sort} onChange={changeSort} initialDirection="desc" />)}<SortHeader label="TOT" column="total" sort={sort} onChange={changeSort} initialDirection="desc" /><SortHeader label={localizedTerm("Ability", locale)} column="ability" sort={sort} onChange={changeSort} /><th><span className="sr-only">Action</span></th></tr>}><tbody>{rows.map((entry) => <tr key={entry.id}><td><button className="pokemon-name pokemon-detail-trigger" aria-label={localName(entry,locale)} onClick={() => setDetails(entry)}><img src={entry.imageUrl} alt="" width="54" height="54" loading="lazy" /><span><strong>{localName(entry, locale)}</strong>{entry.isMega && <small>Mega</small>}<small className="catalog-usage-rank">{speedPickerRank(entry,format,ranks) === null ? (locale === "zh-Hant" ? "無 DEMO 排名" : "No DEMO rank") : `${speedPickerRankSource(entry,format,ranks).id !== entry.id ? (locale === "zh-Hant" ? "共用 DEMO 排名" : "Shared DEMO rank") : (locale === "zh-Hant" ? "DEMO 排名" : "DEMO rank")} #${speedPickerRank(entry,format,ranks)}`}</small></span></button></td><td><div className="badge-row">{entry.types.map((type) => <TypeBadge key={type} type={type} locale={locale} />)}</div></td>{statKeys.map((key) => <td key={key} className={key === "speed" ? "stat-accent" : "stat-cell"}>{entry.baseStats[key]}</td>)}<td className="stat-accent stat-total" data-stat="total">{totalBaseStats(entry.baseStats)}</td><td><div className="ability-list">{entry.abilityIds.length ? entry.abilityIds.map((id) => <AbilityTooltip id={id} locale={locale} key={id} />) : "—"}</div></td><td><div className="catalog-row-actions"><button className="scrapbook-add-button" onClick={() => onScrapbook(entry)} aria-label={`${locale === "zh-Hant" ? "加入畫本" : "Add to scrapbook"} ${localName(entry, locale)}`}>▣＋</button><button className="add-button" onClick={() => onSelect(entry)} aria-label={`Configure ${entry.name}`}>+</button></div></td></tr>)}</tbody></StickyCatalogTable><CatalogPagination kind="Pokémon" locale={locale} page={safePage} pageCount={pageCount} pageSize={pageSize} onPage={setPage} onPageSize={setPageSize} /></section>{details && <PokemonDetailDialog key={details.id} pokemon={details} locale={locale} initialFormat={format} onClose={() => setDetails(null)} onBuild={() => { const entry = details; setDetails(null); onSelect(entry); }} onScrapbook={onScrapbook} />}</>;
}

type MoveSortKey = "name" | "type" | "category" | "power" | "accuracy" | "pp" | "priority" | "target" | "flags" | "users";

export function MoveDatabaseV2({ locale, onScrapbook = () => undefined, active = true }: { locale: Locale; onScrapbook?: (entry: Pokemon) => void; active?: boolean }) {
  const [query, setQuery] = useState("");
  const [priorities, setPriorities] = useState<PriorityClass[]>([]);
  const [types, setTypes] = useState<string[]>([]);
  const [categories, setCategories] = useState<string[]>([]);
  const [targets, setTargets] = useState<string[]>([]);
  const [properties, setProperties] = useState<string[]>([]);
  const [sort, setSort] = useState<SortState<MoveSortKey>>({ key: "name", direction: "asc" });
  const [selected, setSelected] = useState<ReverseSelection | null>(null);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useCatalogPageSize("moves");
  const typeOptions = useMemo(() => ALL_TYPES.filter((type) => getCatalog().moves.some((move) => move.type === type)), []);
  const targetOptions = useMemo(() => [...new Set(getCatalog().moves.map((move) => move.target))].sort(), []);
  const propertyOptions = useMemo(() => [...new Set(getCatalog().moves.flatMap((move) => move.flags))].sort(), []);
  const families = properties.filter(isMoveFamily);
  const interactions = properties.filter(flag => !isMoveFamily(flag));
  const value = (move: Move) => sort.key === "flags" ? move.flags.join(" ") : sort.key === "users" ? (getCatalog().pokemonByMoveId.get(move.id)?.length ?? 0) : move[sort.key];
  const allMatches = getCatalog().moves.filter((move) => {
    const searchMatch = `${move.name} ${move.nameZh}`.toLowerCase().includes(query.toLowerCase());
    return searchMatch && priorityMatches(move, priorities) && (!types.length || types.includes(move.type)) && (!categories.length || categories.includes(move.category)) && (!targets.length || targets.includes(move.target)) && (!families.length || families.some(flag => move.flags.includes(flag))) && (!interactions.length || interactions.some(flag => move.flags.includes(flag)));
  });
  const sorted = [...allMatches].sort((a, b) => {
    const aValue = value(a);
    const bValue = value(b);
    if (aValue == null || bValue == null) {
      if (aValue == null && bValue == null) return a.name.localeCompare(b.name);
      return aValue == null ? 1 : -1;
    }
    return compareValues(aValue, bValue, sort.direction) || a.name.localeCompare(b.name);
  });
  const {pageCount, safePage, start, rows} = catalogPage(sorted, page, pageSize);
  const rangeStart = sorted.length ? start + 1 : 0;
  const rangeEnd = Math.min(start + rows.length, sorted.length);
  const changeSort = (next: SortState<MoveSortKey>) => { setSort(next); setPage(1); };
  const openUsers = (move: Move) => setSelected({ id: move.id, kind: "move", name: localName(move, locale), description: locale === "zh-Hant" ? move.descriptionZh : move.description, users: getCatalog().pokemonByMoveId.get(move.id) ?? [], move });
  const userLabel = locale === "zh-Hant" ? "可使用此招式的寶可夢" : "Usable Pokémon";
  const pageCopy = locale === "zh-Hant" ? { showing: "顯示", of: "共", page: "第", pageSuffix: "頁", previous: "上一頁", next: "下一頁" } : { showing: "showing", of: "of", page: "Page", pageSuffix: "", previous: "Previous", next: "Next" };
  const resetPage = () => setPage(1);
  const clearFilters = () => { setQuery(""); setPriorities([]); setTypes([]); setCategories([]); setTargets([]); setProperties([]); resetPage(); };
  if (!active) return null;
  return <>
    <section className="panel">
      <div className="panel-head moves-head">
        <div><p className="eyebrow">MOVE INTELLIGENCE</p><h1 tabIndex={-1}>{locale === "zh-Hant" ? "招式資料庫" : "Move DB"}</h1><p>{allMatches.length} / {getCatalog().moves.length} {locale === "zh-Hant" ? "個招式" : "moves"} · {pageCopy.showing} {rangeStart}–{rangeEnd} {pageCopy.of} {sorted.length}</p><p className="demo-catalog-note">{locale === "zh-Hant" ? "精簡 DEMO 範例；命中率與 PP 未收錄，以 — 顯示。" : "Small DEMO subset. Accuracy and PP are not included and display as —."}</p></div>
        <input aria-label="Search moves" className="move-search" value={query} onChange={(event) => { setQuery(event.target.value); resetPage(); }} placeholder={locale === "zh-Hant" ? "搜尋招式…" : "Search moves…"} />
      </div>
      <div className="advanced-filters">
        <FilterGroup locale={locale} label="Priority" options={["+ Positive", "0 Neutral", "− Negative"]} selected={priorities.map((entry) => entry === "positive" ? "+ Positive" : entry === "zero" ? "0 Neutral" : "− Negative")} onToggle={(label) => { const entry = label.startsWith("+") ? "positive" : label.startsWith("0") ? "zero" : "negative"; setPriorities((current) => toggleValue(current, entry) as PriorityClass[]); resetPage(); }} />
        <FilterGroup locale={locale} label="Type" options={typeOptions} selected={types} onToggle={(entry) => { setTypes((current) => toggleValue(current, entry)); resetPage(); }} />
        <FilterGroup locale={locale} label={localizedTerm("Category", locale)} options={["Physical", "Special", "Status"]} selected={categories} onToggle={(entry) => { setCategories((current) => toggleValue(current, entry)); resetPage(); }} />
        <FilterGroup locale={locale} label="Target" options={targetOptions} selected={targets} onToggle={(entry) => { setTargets((current) => toggleValue(current, entry)); resetPage(); }} />
        <FilterGroup locale={locale} label="Move families" options={MOVE_FAMILIES} selected={properties} onToggle={(entry) => { setProperties((current) => toggleValue(current, entry)); resetPage(); }} /><details className="mechanics-filter-details"><summary>{localizedTerm("Interaction flags", locale)}</summary><FilterGroup locale={locale} label="Interaction flags" options={propertyOptions.filter(flag => !isMoveFamily(flag))} selected={properties} onToggle={(entry) => { setProperties((current) => toggleValue(current, entry)); resetPage(); }} /></details>
        <div className="filter-actions"><ResetFiltersButton locale={locale} onClick={clearFilters} /></div>
      </div>
      <div className="table-scroll"><table><thead><tr>{([ ["Move", "name", "asc"], ["Type", "type", "asc"], ["Class", "category", "desc"], ["Power", "power", "desc"], ["Acc.", "accuracy", "desc"], ["PP", "pp", "desc"], ["Priority", "priority", "desc"], ["Target", "target", "asc"] ] as Array<[string, MoveSortKey, SortDirection]>).map(([label, key, initialDirection]) => <SortHeader key={key} label={localizedTerm(label, locale)} column={key} sort={sort} onChange={changeSort} initialDirection={initialDirection} />)}<th>{localizedTerm("Effect", locale)}</th>{([ ["Properties", "flags", "asc"], [userLabel, "users", "asc"] ] as Array<[string, MoveSortKey, SortDirection]>).map(([label, key, initialDirection]) => <SortHeader key={key} label={localizedTerm(label, locale)} column={key} sort={sort} onChange={changeSort} initialDirection={initialDirection} />)}</tr></thead><tbody>{rows.map((move) => { const userCount = getCatalog().pokemonByMoveId.get(move.id)?.length ?? 0; return <tr key={move.id}><td><MoveTooltip move={move} locale={locale} onActivate={() => openUsers(move)} /></td><td><TypeBadge type={move.type} locale={locale} /></td><td>{localizedTerm(move.category, locale)}</td><td>{move.power ?? "—"}{borrowedStatNotes[move.id]&&<small className="move-power-note">{locale === "zh-Hant"?(move.id==='body-press'?'使用自身防禦':'使用目標攻擊'):(move.id==='body-press'?'Own Defense':'Target Attack')}</small>}</td><td>{move.accuracy ?? "—"}</td><td>{move.pp || "—"}</td><td><span className={`priority-value priority-${move.priority > 0 ? "positive" : move.priority < 0 ? "negative" : "zero"}`}>{formatPriority(move.priority)}</span></td><td><MoveTarget move={move} locale={locale} /></td><td className="move-effect-cell">{locale === "zh-Hant" ? move.descriptionZh : move.description}</td><td>{move.flags.length ? localizedTerms(move.flags, locale) : "—"}</td><td><button className="reverse-count" onClick={() => openUsers(move)} aria-label={`View ${userCount} Pokémon that can use ${move.name}`}>{userCount}</button></td></tr>; })}</tbody></table></div>
      <CatalogPagination kind="Move" locale={locale} page={safePage} pageCount={pageCount} pageSize={pageSize} onPage={setPage} onPageSize={setPageSize} />
    </section>
      {selected && <PokemonUsersDialog key={`${selected.kind}-${selected.id}`} selection={selected} locale={locale} onClose={() => setSelected(null)} onScrapbook={onScrapbook} />}
  </>;
}

type AbilitySortKey = "name" | "category" | "users";

export function ResourceDatabaseV2({ kind, locale, onScrapbook = () => undefined, active = true }: { kind: "abilities" | "items"; locale: Locale; onScrapbook?: (entry: Pokemon) => void; active?: boolean }) {
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useCatalogPageSize(kind);
  const [query, setQuery] = useState("");
  const [categories, setCategories] = useState<string[]>([]);
  const [effects, setEffects] = useState<string[]>([]);
  const [includeMega, setIncludeMega] = useState(true);
  const [regulation, setRegulation] = useState("");
  const [abilitySort, setAbilitySort] = useState<SortState<AbilitySortKey>>({ key: "name", direction: "asc" });
  const [selected, setSelected] = useState<ReverseSelection | null>(null);
  const clearFilters = () => { setPage(1); setQuery(""); setCategories([]); setEffects([]); setIncludeMega(true); setRegulation(""); };
  if (!active) return null;
  if (kind === "abilities") {
    const matches = getCatalog().abilities.filter((entry) => `${entry.name} ${entry.nameZh} ${entry.description}`.toLowerCase().includes(query.toLowerCase()) && (!categories.length || categories.some((category) => abilityCategories(entry).includes(category))));
    const abilityValue = (entry: ReturnType<typeof getCatalog>["abilities"][number]) => abilitySort.key === "name" ? localName(entry, locale) : abilitySort.key === "category" ? abilityCategories(entry).join(" ") : (getCatalog().pokemonByAbilityId.get(entry.id)?.length ?? 0);
    const filtered = [...matches].sort((left, right) => compareValues(abilityValue(left), abilityValue(right), abilitySort.direction) || left.name.localeCompare(right.name));
    const {rows, safePage, pageCount} = catalogPage(filtered,page,pageSize);
    const openUsers = (entry: ReturnType<typeof getCatalog>["abilities"][number]) => setSelected({ id: entry.id, kind: "ability", name: localName(entry, locale), description: locale === "zh-Hant" ? entry.descriptionZh : entry.description, users: getCatalog().pokemonByAbilityId.get(entry.id) ?? [] });
    const userLabel = locale === "zh-Hant" ? "可使用此特性的寶可夢" : "Usable Pokémon";
    return <><section className="panel resource-panel"><div className="panel-head"><div><p className="eyebrow">ABILITY INTELLIGENCE</p><h1 tabIndex={-1}>{locale === "zh-Hant" ? "特性資料庫" : "Ability DB"}</h1><p>{filtered.length} / {getCatalog().abilities.length} abilities</p></div><input aria-label="Search abilities" className="move-search" value={query} onChange={(event) => {setQuery(event.target.value);setPage(1);}} placeholder={locale === "zh-Hant" ? "搜尋特性…" : "Search abilities…"} /></div><div className="advanced-filters"><FilterGroup locale={locale} label={localizedTerm("Category", locale)} options={abilityFilterOptions} selected={categories} onToggle={(value) => {setCategories((current) => toggleValue(current, value));setPage(1);}} /><div className="filter-actions"><ResetFiltersButton locale={locale} onClick={clearFilters} /></div></div><div className="table-scroll"><table className="resource-table"><thead><tr><SortHeader label={localizedTerm("Name", locale)} column="name" sort={abilitySort} onChange={next => {setAbilitySort(next);setPage(1);}} /><SortHeader label={localizedTerm("Category", locale)} column="category" sort={abilitySort} onChange={next => {setAbilitySort(next);setPage(1);}} /><th>{localizedTerm("Effect", locale)}</th><SortHeader label={userLabel} column="users" sort={abilitySort} onChange={next => {setAbilitySort(next);setPage(1);}} /></tr></thead><tbody>{rows.map((entry) => { const userCount = getCatalog().pokemonByAbilityId.get(entry.id)?.length ?? 0; return <tr key={entry.id}><td><AbilityTooltip id={entry.id} locale={locale} onActivate={() => openUsers(entry)} /></td><td>{localizedTerms(abilityCategories(entry), locale)}</td><td>{locale === "zh-Hant" ? entry.descriptionZh : entry.description}</td><td><button className="reverse-count" onClick={() => openUsers(entry)} aria-label={`View ${userCount} Pokémon that can use ${entry.name}`}>{userCount}</button></td></tr>; })}</tbody></table></div><CatalogPagination kind={kind} locale={locale} page={safePage} pageCount={pageCount} pageSize={pageSize} onPage={setPage} onPageSize={setPageSize} /></section>{selected && <PokemonUsersDialog key={`${selected.kind}-${selected.id}`} selection={selected} locale={locale} onClose={() => setSelected(null)} onScrapbook={onScrapbook} />}</>;
  }
  const filtered = getCatalog().items.filter((entry) => matchesRegulation(entry.id, "items", regulation) && `${entry.name} ${entry.nameZh} ${entry.description}`.toLowerCase().includes(query.toLowerCase()) && (includeMega || entry.category !== "Mega Stone") && (!categories.length || categories.includes(entry.category)) && (!effects.length || effects.some((effect) => itemEffectCategories(entry).includes(effect))));
  const {rows, safePage, pageCount} = catalogPage(filtered,page,pageSize);
  return <section className="panel resource-panel"><div className="panel-head"><div><p className="eyebrow">ITEM INTELLIGENCE</p><h1 tabIndex={-1}>{locale === "zh-Hant" ? "持有物資料庫" : "Held Item DB"}</h1><p>{filtered.length} / {getCatalog().items.length} items · {locale === "zh-Hant" ? "DEMO 規則" : "DEMO rules"}</p></div><input aria-label="Search held items" className="move-search" value={query} onChange={(event) => {setQuery(event.target.value);setPage(1);}} placeholder={locale === "zh-Hant" ? "搜尋持有物…" : "Search held items…"} /></div><div className="advanced-filters"><RegulationFilter kind="items" locale={locale} value={regulation} onChange={value => {setRegulation(value);setPage(1);}} /><FilterGroup locale={locale} label="Category" options={["Mega Stone", "Item", "Berry"]} selected={categories} onToggle={(value) => {setCategories((current) => toggleValue(current, value));setPage(1);}} /><FilterGroup locale={locale} label="Effect" options={itemEffectOptions} selected={effects} onToggle={(value) => {setEffects((current) => toggleValue(current, value));setPage(1);}} /><div className="filter-group inline-filter"><b>{locale === "zh-Hant" ? "超級石" : "Mega Stones"}</b><button className="filter-chip" aria-pressed={includeMega} onClick={() => {setIncludeMega((value) => !value);setPage(1);}}>{includeMega ? "ON" : "OFF"}</button><span>{locale === "zh-Hant" ? "精簡示範持有物，用於展示篩選與隊伍配置。" : "A small sample of held items for filtering and team-building demonstrations."}</span></div><div className="filter-actions"><ResetFiltersButton locale={locale} onClick={clearFilters} /></div></div><div className="table-scroll"><table className="resource-table"><thead><tr><th>{localizedTerm("Name", locale)}</th><th>{localizedTerm("Category", locale)}</th><th>{localizedTerm("Effect class", locale)}</th><th>{localizedTerm("Effect", locale)}</th></tr></thead><tbody>{rows.map((entry) => { const effectClasses = itemEffectCategories(entry); return <tr key={entry.id}><td><ItemTooltip item={entry} locale={locale} size={28} /></td><td>{localizedTerm(entry.category, locale)}</td><td>{effectClasses.length ? localizedTerms(effectClasses, locale) : localizedTerm("Other", locale)}</td><td>{locale === "zh-Hant" ? entry.descriptionZh : entry.description}</td></tr>; })}</tbody></table></div><CatalogPagination kind={kind} locale={locale} page={safePage} pageCount={pageCount} pageSize={pageSize} onPage={setPage} onPageSize={setPageSize} /></section>;
}
