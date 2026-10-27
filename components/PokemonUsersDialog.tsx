"use client";

import { useState } from "react";
import { getCatalog } from "../lib/catalog";
import { compareValues, type SortDirection } from "../lib/filtering";
import { localizedTerm } from "../lib/localization";
import { ALL_TYPES } from "../lib/type-chart";
import type { Move, Pokemon, Stats } from "../lib/types";
import { useDialogEscape } from "../lib/use-dialog-escape";
import { InfoTooltip } from "./InfoTooltip";
import { ResetFiltersButton } from "./ResetFiltersButton";
import { TypeBadge } from "./TypeBadge";

type Locale = "en" | "zh-Hant";
type SortState<Key extends string> = { key: Key; direction: SortDirection };
const statKeys = ["hp", "attack", "defense", "specialAttack", "specialDefense", "speed"] as const;
const statLabels: Record<(typeof statKeys)[number], string> = { hp: "HP", attack: "Atk", defense: "Def", specialAttack: "SpA", specialDefense: "SpD", speed: "Spe" };
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

function AbilityTooltip({ id, locale }: { id: string; locale: Locale }) {
  const ability = getCatalog().abilityById.get(id);
  if (!ability) return <span>—</span>;
  return <InfoTooltip label={localName(ability, locale)}><strong>{localName(ability, locale)}</strong><p>{locale === "zh-Hant" ? ability.descriptionZh : ability.description}</p></InfoTooltip>;
}

export type ReverseSelection = { id: string; kind: "move" | "ability"; name: string; description: string; users: Pokemon[]; move?: Move };
type ReverseSortKey = "relevance" | "name" | "type" | keyof Stats | "ability";

export function PokemonUsersDialog({ selection, locale, onClose, onScrapbook }: { selection: ReverseSelection; locale: Locale; onClose: () => void; onScrapbook: (entry: Pokemon) => void }) {
  useDialogEscape(onClose);
  const [query, setQuery] = useState("");
  const [selectedTypes, setSelectedTypes] = useState<string[]>([]);
  const [typeMode, setTypeMode] = useState<"or" | "and">("or");
  const [form, setForm] = useState<"all" | "regular" | "mega">("all");
  const [abilityId, setAbilityId] = useState("");
  const [abilityInput, setAbilityInput] = useState("");
  const [knownMoveIds, setKnownMoveIds] = useState<string[]>([]);
  const [moveInput, setMoveInput] = useState("");
  const [statMinimums, setStatMinimums] = useState<Stats>({ hp: 0, attack: 0, defense: 0, specialAttack: 0, specialDefense: 0, speed: 0 });
  const [sortKey, setSortKey] = useState<ReverseSortKey>("relevance");
  const [sortDirection, setSortDirection] = useState<SortDirection>("asc");
  const [filtersOpen, setFiltersOpen] = useState(false);
  const copy = locale === "zh-Hant" ? { title: "可使用的寶可夢", search: "搜尋寶可夢名稱…", forms: "個示範型態", empty: "沒有符合目前篩選條件的寶可夢。", close: "關閉", filters: "進階篩選", sort: "排序方式", direction: "排序方向", ascending: "由小到大", descending: "由大到小", matching: "同招式屬性優先" } : { title: "Pokémon that can use this", search: "Search Pokémon name…", forms: "demo forms", empty: "No Pokémon match the current filters.", close: "Close", filters: "Advanced filters", sort: "Sort by", direction: "Direction", ascending: "Ascending", descending: "Descending", matching: "Same move type first" };
  const matchAbility = (value: string) => getCatalog().abilities.find((entry) => [entry.name, entry.nameZh].some((name) => name.toLocaleLowerCase() === value.trim().toLocaleLowerCase()));
  const matchMove = (value: string) => getCatalog().moves.find((entry) => [entry.name, entry.nameZh].some((name) => name.toLocaleLowerCase() === value.trim().toLocaleLowerCase()));
  const users = selection.users.filter((entry) => `${entry.name} ${entry.nameZh}`.toLowerCase().includes(query.toLowerCase())
    && (!selectedTypes.length || (typeMode === "or" ? selectedTypes.some((type) => entry.types.includes(type as Pokemon["types"][number])) : selectedTypes.every((type) => entry.types.includes(type as Pokemon["types"][number]))))
    && (form === "all" || (form === "mega" ? Boolean(entry.isMega) : !entry.isMega))
    && (!abilityId || entry.abilityIds.includes(abilityId))
    && knownMoveIds.every((id) => entry.moveIds.includes(id))
    && statKeys.every((key) => entry.baseStats[key] >= statMinimums[key]));
  const sortValue = (entry: Pokemon) => {
    if (sortKey === "name") return localName(entry, locale);
    if (sortKey === "type") return entry.types.join(" ");
    if (sortKey === "ability") return entry.abilityIds.map((id) => getCatalog().abilityById.get(id)?.name ?? id).join(" ");
    if (sortKey === "relevance") return "";
    return entry.baseStats[sortKey];
  };
  const sortedUsers = [...users].sort((a, b) => {
    if (sortKey === "relevance") {
      const preferredType = selection.move?.type;
      const preferred = preferredType ? Number(!a.types.includes(preferredType)) - Number(!b.types.includes(preferredType)) : 0;
      return preferred || a.types.join(" ").localeCompare(b.types.join(" ")) || localName(a, locale).localeCompare(localName(b, locale));
    }
    return compareValues(sortValue(a), sortValue(b), sortDirection) || localName(a, locale).localeCompare(localName(b, locale));
  });
  const updateMinimum = (key: keyof Stats, value: number) => setStatMinimums((current) => ({ ...current, [key]: Math.max(0, Math.min(255, value || 0)) }));
  const clearFilters = () => { setQuery(""); setSelectedTypes([]); setTypeMode("or"); setForm("all"); setAbilityId(""); setAbilityInput(""); setKnownMoveIds([]); setMoveInput(""); setStatMinimums({ hp: 0, attack: 0, defense: 0, specialAttack: 0, specialDefense: 0, speed: 0 }); };
  const changeSortKey = (value: ReverseSortKey) => { setSortKey(value); setSortDirection(value === "name" || value === "type" || value === "ability" || value === "relevance" ? "asc" : "desc"); };
  const sortOptions: Array<[ReverseSortKey, string]> = [["relevance", selection.move ? copy.matching : "Type → Pokémon name"], ["name", "Pokémon name"], ["type", "Type"], ["hp", "HP"], ["attack", "Atk"], ["defense", "Def"], ["specialAttack", "SpA"], ["specialDefense", "SpD"], ["speed", "Spe"], ["ability", "Ability"]];
  const tableSort: SortState<ReverseSortKey> = { key: sortKey, direction: sortDirection };
  const changeTableSort = (next: SortState<ReverseSortKey>) => { setSortKey(next.key); setSortDirection(next.direction); };
  return <div className="reverse-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}><section className="reverse-dialog" role="dialog" aria-modal="true" aria-labelledby="reverse-title"><button className="close-button" onClick={onClose} aria-label={copy.close}>×</button><div className="reverse-head"><div><p className="eyebrow">REVERSE LOOKUP</p><h2 id="reverse-title">{selection.name}</h2>{selection.move && <div className="badge-row"><TypeBadge type={selection.move.type} locale={locale} /><span className="resource-kind">{localizedTerm(selection.move.category, locale)}</span></div>}<p>{selection.description}</p></div><strong>{selection.users.length}<small>{copy.forms}</small></strong></div><div className="reverse-toolbar"><label><span>{locale === "zh-Hant" ? "名稱" : "Name"}</span><input autoFocus aria-label="Search Pokémon in reverse lookup" value={query} onChange={(event) => setQuery(event.target.value)} placeholder={copy.search} /></label><label><span>{copy.sort}</span><select aria-label="Sort reverse lookup Pokémon" value={sortKey} onChange={(event) => changeSortKey(event.target.value as ReverseSortKey)}>{sortOptions.map(([value, label]) => <option value={value} key={value}>{label}</option>)}</select></label><label><span>{copy.direction}</span><select aria-label="Reverse lookup sort direction" value={sortDirection} disabled={sortKey === "relevance"} onChange={(event) => setSortDirection(event.target.value as SortDirection)}><option value="asc">{copy.ascending}</option><option value="desc">{copy.descending}</option></select></label></div><button type="button" className="reverse-filter-toggle filter-chip" aria-expanded={filtersOpen} onClick={() => setFiltersOpen((value) => !value)}>{copy.filters}</button><div className={`advanced-filters reverse-filters${filtersOpen ? " open" : ""}`}><FilterGroup locale={locale} label="Type" options={ALL_TYPES} selected={selectedTypes} onToggle={(entry) => setSelectedTypes((current) => toggleValue(current, entry))} /><div className="filter-group filter-logic-row"><b>{locale === "zh-Hant" ? "屬性邏輯" : "Type logic"}</b><div className="segmented" role="group" aria-label="Reverse lookup type filter logic"><button className={typeMode === "or" ? "active" : ""} aria-pressed={typeMode === "or"} onClick={() => setTypeMode("or")}>OR</button><button className={typeMode === "and" ? "active" : ""} aria-pressed={typeMode === "and"} onClick={() => setTypeMode("and")}>AND</button></div></div><div className="filter-group"><b>{locale === "zh-Hant" ? "型態" : "Form"}</b><div>{(["all", "regular", "mega"] as const).map((entry) => <button key={entry} className="filter-chip" aria-pressed={form === entry} onClick={() => setForm(entry)}>{entry === "all" ? (locale === "zh-Hant" ? "全部" : "All") : entry === "regular" ? (locale === "zh-Hant" ? "一般" : "Regular") : "Mega"}</button>)}</div></div><div className="filter-group filter-select-row"><b>{locale === "zh-Hant" ? "特性" : "Ability"}</b><div><input list="reverse-ability-options" aria-label="Search reverse lookup ability filter" value={abilityInput} onChange={(event) => { const value = event.target.value; const matched = matchAbility(value); setAbilityInput(value); setAbilityId(matched?.id ?? ""); }} placeholder={locale === "zh-Hant" ? "輸入特性名稱…" : "Type an ability…"} /><datalist id="reverse-ability-options">{getCatalog().abilities.map((entry) => <option key={entry.id} value={localName(entry, locale)} />)}</datalist>{abilityId && <button className="selected-filter" onClick={() => { setAbilityId(""); setAbilityInput(""); }}>{localName(getCatalog().abilityById.get(abilityId)!, locale)} ×</button>}</div></div><div className="filter-group filter-select-row"><b>{locale === "zh-Hant" ? "可學招式" : "Known moves"}</b><div><input list="reverse-move-options" aria-label="Search reverse lookup known move filter" value={moveInput} onChange={(event) => { const value = event.target.value; const matched = matchMove(value); if (matched) { setKnownMoveIds((current) => current.includes(matched.id) ? current : [...current, matched.id]); setMoveInput(""); } else setMoveInput(value); }} placeholder={locale === "zh-Hant" ? "輸入招式名稱…" : "Type a move…"} /><datalist id="reverse-move-options">{getCatalog().moves.map((entry) => <option key={entry.id} value={localName(entry, locale)} />)}</datalist>{knownMoveIds.map((id) => <button key={id} className="selected-filter" onClick={() => setKnownMoveIds((current) => current.filter((entry) => entry !== id))}>{localName(getCatalog().moveById.get(id)!, locale)} ×</button>)}</div></div><div className="filter-group stat-minimum-filter"><b>{locale === "zh-Hant" ? "最低能力值" : "Minimum stats"}</b><div>{statKeys.map((key) => <label key={key}>{statLabels[key]}<input aria-label={`Reverse lookup minimum ${statLabels[key]}`} type="number" min="0" max="255" value={statMinimums[key] || ""} placeholder="0" onChange={(event) => updateMinimum(key, Number(event.target.value))} /></label>)}</div></div><div className="filter-actions"><ResetFiltersButton locale={locale} onClick={clearFilters} /><span>{locale === "zh-Hant" ? "多個可學招式使用 AND。" : "Multiple known moves use AND matching."}</span></div></div><h3>{copy.title} <span>{sortedUsers.length} / {selection.users.length}</span></h3>{sortedUsers.length ? <div className="reverse-table-scroll" tabIndex={0} aria-label={copy.title}><table className="reverse-results-table"><thead><tr><SortHeader label="Pokémon" column="name" sort={tableSort} onChange={changeTableSort} /><SortHeader label={localizedTerm("Type", locale)} column="type" sort={tableSort} onChange={changeTableSort} />{statKeys.map((key) => <SortHeader key={key} label={statLabels[key]} column={key} sort={tableSort} onChange={changeTableSort} />)}<SortHeader label={localizedTerm("Ability", locale)} column="ability" sort={tableSort} onChange={changeTableSort} /><th><span className="sr-only">{locale === "zh-Hant" ? "畫本" : "Scrapbook"}</span></th></tr></thead><tbody>{sortedUsers.map((entry) => <tr key={entry.id} className={selection.move && entry.types.includes(selection.move.type) ? "preferred-type" : ""}><td><div className="reverse-pokemon-cell"><img src={entry.imageUrl} alt="" width="48" height="48" loading="lazy" /><span><strong>{localName(entry, locale)}</strong>{entry.isMega && <small>Mega</small>}{selection.move && entry.types.includes(selection.move.type) && <em>{selection.move.type} match</em>}</span></div></td><td><div className="badge-row compact">{entry.types.map((type) => <TypeBadge key={type} type={type} locale={locale} />)}</div></td>{statKeys.map((key) => <td key={key} data-stat={key}>{entry.baseStats[key]}</td>)}<td><div className="ability-list">{entry.abilityIds.map((id) => <AbilityTooltip id={id} locale={locale} key={id} />)}</div></td><td><button className="scrapbook-add-button" onClick={() => onScrapbook(entry)} aria-label={`${locale === "zh-Hant" ? "加入畫本" : "Add to scrapbook"} ${localName(entry, locale)}`}>▣＋</button></td></tr>)}</tbody></table></div> : <p className="reverse-empty">{copy.empty}</p>}</section></div>;
}
