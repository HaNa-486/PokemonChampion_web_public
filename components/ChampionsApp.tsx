"use client";
import { CatalogBackToTop } from "./CatalogNavigation";
import { MoveTarget } from "./MoveTarget";
import { ResourcePicker, type ResourcePickerOption } from "./ResourcePicker";
import { useBattleUsage } from "../lib/use-usage";
import { UsageFreshness } from "./UsageFreshness";

import { useCallback, useEffect, useId, useMemo, useRef, useState } from "react";
import { getCatalog } from "../lib/catalog";
import { rankedAbilityChoices, rankedApChoices, rankedItemChoices, rankedMoveChoices, rankedNatureChoices, recommendedAbilityId, recommendedAp, recommendedItemId, recommendedMoveIds, recommendedNature, type RankedChoice } from "../lib/battle-recommendations";
import { apTotal, calculateFinalStats, formatPriority, NATURES, NEUTRAL_NATURE, priorityMatches, validateTeam, validateTeamEdit, ZERO_STATS } from "../lib/domain";
import { TeamPlans } from "./TeamPlans";
import { useTeamStore } from "../lib/team-store";
import { useScrapbookStore, type ScrapbookEntry } from "../lib/scrapbook-store";
import { localizedTerm, localizedTerms } from "../lib/localization";
import { itemEffectCategories } from "../lib/filtering";
import { useDialogEscape } from "../lib/use-dialog-escape";
import type { BattleFormat, BattleUsage, Move, Nature, Pokemon, Stats, TeamMember } from "../lib/types";
import { MoveDatabaseV2, PokemonTableV2, ResourceDatabaseV2 } from "./DatabaseViews";
import { AddToScrapbookDialog } from "./AddToScrapbookDialog";
import { InfoTooltip } from "./InfoTooltip";
import { ItemDisplay, ItemTooltip } from "./ItemDisplay";
import { TypeBadge } from "./TypeBadge";
import { TypeChart } from "./TypeChartView";
import { TypeMatchups } from "./TypeMatchups";
import { ThemeToggle, useThemePreference } from "./ThemeToggle";
import { useSessionState } from "../lib/use-session-state";
import { SpeedChart } from "./SpeedChart";
import { DamageCalculator } from "./DamageCalculator";
import { ScrapbookView } from "./ScrapbookView";

type Locale = "en" | "zh-Hant";
import { SavedBuildIssues } from "./SavedBuildIssues";
import { getPublishedData } from "../lib/published-data";
type View = "pokemon" | "scrapbook" | "moves" | "abilities" | "items" | "types" | "speed" | "damage";
type PriorityClass = "positive" | "zero" | "negative";
type DisplayMode = "detailed" | "compact";
type BuilderDisplayModes = Record<"move" | "ability" | "item", DisplayMode>;

const BUILDER_DISPLAY_KEY = "champions-demo-builder-display-v1";
const LOCALE_STORAGE_KEY = "champions-demo-locale-v1";
const ITEM_GROUP_ORDER = ["Common", "Mega Stone", "HP Recovery", "Status Cure", "PP Recovery", "Damage Halving", "Other"];
const defaultDisplayModes: BuilderDisplayModes = { move: "detailed", ability: "detailed", item: "detailed" };

const getLabels = () => ({
  en: { pokemon: "Pokémon DB", scrapbook: "Scrapbooks", moves: "Move DB", abilities: "Ability DB", items: "Held Item DB", types: "Type Chart", speed: "Speed", damage: "Damage", search: "Search Pokémon or type…", current: "DEMO rules", add: "Build & add", save: "Save changes", edit: "Edit", team: "Selected team", empty: "Choose a Pokémon to start building.", data: "DEMO battle data", stale: "fixed sample", doubles: "Doubles", singles: "Singles" },
  "zh-Hant": { pokemon: "寶可夢資料庫", scrapbook: "畫本", moves: "招式資料庫", abilities: "特性資料庫", items: "持有物資料庫", types: "屬性相剋", speed: "速度線", damage: "傷害計算", search: "搜尋寶可夢或屬性…", current: "DEMO 示範規則", add: "配置並加入", save: "儲存變更", edit: "編輯", team: "已選隊伍", empty: "選擇一隻寶可夢開始配置。", data: "DEMO 對戰資料", stale: "固定範例", doubles: "雙打", singles: "單打" },
});

function DataFreshness({locale}:{locale:Locale}) {
  const zh=locale==='zh-Hant';
  return <details id="demo-data" className="data-freshness"><summary>{zh?'DEMO 資料說明':'DEMO data details'}</summary><dl>
    <dt>{zh?'示範版本':'Fixture version'}</dt><dd>{getPublishedData().publishedDataVersion}</dd>
    <dt>{zh?'內容':'Contents'}</dt><dd>{zh?'精簡且不完整的固定圖鑑與虛構使用率；未收錄命中率與 PP，不代表官方規則、當季排名或即時統計。':'A small, incomplete fixed catalog and fabricated usage. Accuracy and PP are not included. These do not represent official rules, current rankings or live statistics.'}</dd>
  </dl><p>{zh?'隊伍與畫本保存在此瀏覽器。計算工具用來展示互動與程式設計；請勿將示範輸出視為已驗證的遊戲結果。':'Teams and scrapbooks stay in this browser. Calculators demonstrate the interface and implementation; demo outputs are not verified game results.'}</p></details>;
}

const statLabels: Record<keyof Stats, string> = { hp: "HP", attack: "Atk", defense: "Def", specialAttack: "SpA", specialDefense: "SpD", speed: "Spe" };
const natureStatLabels = { en: statLabels, "zh-Hant": { hp: "HP", attack: "攻擊", defense: "防禦", specialAttack: "特攻", specialDefense: "特防", speed: "速度" } };

function localName(entry: { name: string; nameZh: string }, locale: Locale) { return locale === "zh-Hant" ? entry.nameZh : entry.name; }

function natureLabel(nature: Nature, locale: Locale) {
  const name = locale === "zh-Hant" ? nature.nameZh ?? nature.name : nature.name;
  if (!nature.up || !nature.down) return `${name} (${locale === "zh-Hant" ? "能力值不變" : "No stat change"})`;
  return `${name} (${natureStatLabels[locale][nature.up]} ↑ / ${natureStatLabels[locale][nature.down]} ↓)`;
}


function MoveTooltip({ move, locale }: { move: Move; locale: Locale }) {
  return <InfoTooltip label={localName(move, locale)}><strong>{localName(move, locale)}</strong><div className="tooltip-meta"><TypeBadge type={move.type} locale={locale} /><span>{localizedTerm(move.category, locale)}</span><span>{localizedTerm("Priority", locale)} {formatPriority(move.priority)}</span></div><div className="tooltip-stats"><span>{localizedTerm("Power", locale)} {move.power ?? "—"}</span><span>{localizedTerm("Acc.", locale)} {move.accuracy ?? "—"}</span><span>PP {move.pp || "—"}</span></div><p>{locale === "zh-Hant" ? move.descriptionZh : move.description}</p></InfoTooltip>;
}

function AbilityTooltip({ id, locale }: { id: string; locale: Locale }) {
  const ability = getCatalog().abilityById.get(id);
  if (!ability) return <span>—</span>;
  return <InfoTooltip label={localName(ability, locale)}><strong>{localName(ability, locale)}</strong><p>{locale === "zh-Hant" ? ability.descriptionZh : ability.description}</p></InfoTooltip>;
}

const builderMoveCategoryOrder: Record<Move["category"], number> = { Physical: 0, Special: 1, Status: 2 };

function MovePicker({ slot, value, legalMoveIds, selectedMoveIds, commonMoves, locale, detailed, onChange }: {
  slot: number;
  value: string | null;
  legalMoveIds: string[];
  selectedMoveIds: string[];
  commonMoves: RankedChoice[];
  locale: Locale;
  detailed: boolean;
  onChange: (moveId: string | null) => void;
}) {
  const listId = useId();
  const inputRef = useRef<HTMLInputElement>(null);
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [activeValue, setActiveValue] = useState<string>(value ?? "__clear__");
  const current = value ? getCatalog().moveById.get(value) ?? null : null;
  const commonRank = useMemo(() => new Map(commonMoves.map((choice) => [choice.id, choice.rank])), [commonMoves]);
  const availableMoves = useMemo(() => legalMoveIds
    .map((id) => getCatalog().moveById.get(id))
    .filter((move): move is Move => Boolean(move))
    .sort((a, b) => {
      const commonDifference = (commonRank.get(a.id) ?? 999) - (commonRank.get(b.id) ?? 999);
      if (commonDifference) return commonDifference;
      return builderMoveCategoryOrder[a.category] - builderMoveCategoryOrder[b.category]
        || a.type.localeCompare(b.type)
        || b.priority - a.priority
        || localName(a, locale).localeCompare(localName(b, locale));
    }), [commonRank, legalMoveIds, locale]);
  const normalizedQuery = query.trim().toLocaleLowerCase(locale);
  const filteredMoves = normalizedQuery ? availableMoves.filter((move) => `${move.name} ${move.nameZh} ${move.type} ${move.category} ${move.description} ${move.descriptionZh}`.toLocaleLowerCase(locale).includes(normalizedQuery)) : availableMoves;
  const navigableValues = ["__clear__", ...filteredMoves.filter((move) => !selectedMoveIds.includes(move.id) || move.id === value).map((move) => move.id)];
  const fieldLabel = locale === "zh-Hant" ? `招式 ${slot + 1}` : `Move ${slot + 1}`;
  useEffect(() => {
    if (!open) return;
    const activeOption = document.getElementById(`${listId}-option-${activeValue}`);
    if (activeOption && "scrollIntoView" in activeOption) activeOption.scrollIntoView({ block: "nearest" });
  }, [activeValue, listId, open]);
  const close = () => { setOpen(false); setQuery(""); };
  const openMenu = () => {
    setOpen(true);
    setActiveValue((value && navigableValues.includes(value)) ? value : navigableValues[0] ?? "__clear__");
  };
  const chooseActive = () => {
    if (activeValue === "__clear__") onChange(null);
    else if (navigableValues.includes(activeValue)) onChange(activeValue);
    close();
  };
  const moveActive = (direction: 1 | -1) => {
    const currentIndex = navigableValues.indexOf(activeValue);
    const startIndex = currentIndex < 0 ? (direction > 0 ? -1 : 0) : currentIndex;
    const nextIndex = (startIndex + direction + navigableValues.length) % navigableValues.length;
    setActiveValue(navigableValues[nextIndex] ?? "__clear__");
  };
  return <div className="move-picker-field" onBlur={(event) => { if (!event.currentTarget.contains(event.relatedTarget as Node | null)) close(); }}>
    <label htmlFor={`${listId}-input`}>{fieldLabel}</label>
    <div className={`move-combobox ${open ? "open" : ""}`}>
      {current && !open && <TypeBadge type={current.type} locale={locale} />}
      <input
        id={`${listId}-input`}
        role="combobox"
        aria-label={fieldLabel}
        aria-expanded={open}
        aria-controls={listId}
        aria-activedescendant={open ? `${listId}-option-${activeValue}` : undefined}
        aria-autocomplete="list"
        autoComplete="off"
        data-move-id={value ?? ""}
        value={open ? query : current ? localName(current, locale) : value ? `${locale === "zh-Hant" ? "待修正" : "Unavailable"}: ${value}` : ""}
        placeholder={locale === "zh-Hant" ? "輸入名稱或效果搜尋…" : "Search name or effect…"}
        ref={inputRef}
        onFocus={() => { openMenu(); setQuery(""); }}
        onChange={(event) => { setOpen(true); setQuery(event.target.value); setActiveValue("__clear__"); }}
        onKeyDown={(event) => {
          if (event.key === "Escape" && open) { event.preventDefault(); close(); }
          else if (event.key === "ArrowDown") { event.preventDefault(); if (open) moveActive(1); else openMenu(); }
          else if (event.key === "ArrowUp") { event.preventDefault(); if (open) moveActive(-1); else openMenu(); }
          else if (event.key === "Home" && open) { event.preventDefault(); setActiveValue(navigableValues[0] ?? "__clear__"); }
          else if (event.key === "End" && open) { event.preventDefault(); setActiveValue(navigableValues.at(-1) ?? "__clear__"); }
          else if (event.key === "Enter" && open) { event.preventDefault(); chooseActive(); }
        }}
      />
      <button type="button" className="move-picker-toggle" aria-label={locale === "zh-Hant" ? `開啟${fieldLabel}選單` : `Open ${fieldLabel} menu`} onClick={() => { if (open) close(); else openMenu(); inputRef.current?.focus(); }}>⌄</button>
    </div>
    {open && <div className="move-picker-popover">
      {detailed && <div className="move-picker-help">{locale === "zh-Hant" ? "DEMO 排名前列招式優先；可搜尋名稱或效果。" : "DEMO-ranked moves first. Search by name or effect."}</div>}
      <div id={listId} role="listbox" aria-label={`${fieldLabel} options`} className="move-picker-options">
        <button id={`${listId}-option-__clear__`} type="button" role="option" aria-selected={!value} className={`move-option clear-option ${activeValue === "__clear__" ? "active" : ""}`} onMouseEnter={() => setActiveValue("__clear__")} onMouseDown={(event) => event.preventDefault()} onClick={() => { onChange(null); close(); inputRef.current?.focus(); }}>
          {locale === "zh-Hant" ? "— 清除此欄" : "— Clear this slot"}
        </button>
        {filteredMoves.map((move) => {
          const selectedElsewhere = selectedMoveIds.includes(move.id) && move.id !== value;
          const rank = commonRank.get(move.id);
          return <button id={`${listId}-option-${move.id}`} type="button" role="option" aria-selected={move.id === value} disabled={selectedElsewhere} className={`move-option ${activeValue === move.id ? "active" : ""}`} key={move.id} onMouseEnter={() => { if (!selectedElsewhere) setActiveValue(move.id); }} onMouseDown={(event) => event.preventDefault()} onClick={() => { onChange(move.id); close(); inputRef.current?.focus(); }}>
            <span className="move-option-heading"><TypeBadge type={move.type} locale={locale} /><strong>{localName(move, locale)}</strong>{rank && <em>{locale === "zh-Hant" ? `DEMO #${rank}` : `DEMO #${rank}`}</em>}</span>
            {detailed && <><span className="move-option-meta">{localizedTerm(move.category, locale)} · {localizedTerm("Power", locale)} {move.power ?? "—"} · {localizedTerm("Acc.", locale)} {move.accuracy ?? "—"} · PP {move.pp || "—"} · {localizedTerm("Priority", locale)} {formatPriority(move.priority)}</span><span className="move-option-description">{locale === "zh-Hant" ? move.descriptionZh : move.description}</span></>}
            {selectedElsewhere && <span className="move-option-used">{locale === "zh-Hant" ? "已選在其他欄位" : "Already selected"}</span>}
          </button>;
        })}
        {!filteredMoves.length && <p className="move-picker-empty">{locale === "zh-Hant" ? "找不到符合的可學招式。" : "No learnable move matches."}</p>}
      </div>
    </div>}
  </div>;
}

export function MoveDatabase({ locale }: { locale: Locale }) {
  const [query, setQuery] = useState("");
  const [classes, setClasses] = useState<PriorityClass[]>([]);
  const toggle = (value: PriorityClass) => setClasses((current) => current.includes(value) ? current.filter((entry) => entry !== value) : [...current, value]);
  const allMatches = getCatalog().moves.filter((move) => `${move.name} ${move.nameZh}`.toLowerCase().includes(query.toLowerCase()) && priorityMatches(move, classes));
  const filtered = allMatches.slice(0, 100);
  return <section className="panel"><div className="panel-head moves-head"><div><p className="eyebrow">MOVE INTELLIGENCE</p><h1>{getLabels()[locale].moves}</h1><p>{filtered.length} / {getCatalog().moves.length} moves</p></div><input className="move-search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder={locale === "zh-Hant" ? "搜尋招式…" : "Search moves…"} /></div><div className="filter-bar" aria-label="Priority filters"><span>{localizedTerm("Priority", locale)}</span>{(["positive", "zero", "negative"] as const).map((value) => { const label = value === "positive" ? "+ Positive" : value === "zero" ? "0 Neutral" : "− Negative"; return <button key={value} onClick={() => toggle(value)} aria-pressed={classes.includes(value)} className={`filter-chip priority-${value}`}>{localizedTerm(label, locale)}</button>; })}</div><div className="table-scroll"><table><thead><tr>{["Move", "Type", "Class", "Power", "Acc.", "PP", "Priority", "Target", "Properties"].map((label) => <th key={label}>{localizedTerm(label, locale)}</th>)}</tr></thead><tbody>{filtered.map((move) => <tr key={move.id}><td><MoveTooltip move={move} locale={locale} /></td><td><TypeBadge type={move.type} locale={locale} /></td><td>{localizedTerm(move.category, locale)}</td><td>{move.power ?? "—"}</td><td>{move.accuracy ?? "—"}</td><td>{move.pp || "—"}</td><td><span className={`priority-value priority-${move.priority > 0 ? "positive" : move.priority < 0 ? "negative" : "zero"}`}>{formatPriority(move.priority)}</span></td><td><MoveTarget move={move} locale={locale} /></td><td>{move.flags.length ? localizedTerms(move.flags, locale) : "—"}</td></tr>)}</tbody></table></div></section>;
}

function ResourceDatabase({ kind, locale }: { kind: "abilities" | "items"; locale: Locale }) {
  const [query, setQuery] = useState("");
  const entries = kind === "abilities" ? getCatalog().abilities : getCatalog().items;
  const filtered = entries.filter((entry) => `${entry.name} ${entry.nameZh} ${"category" in entry && typeof entry.category === "string" ? entry.category : ""}`.toLowerCase().includes(query.toLowerCase()));
  return <section className="panel resource-panel"><div className="panel-head"><div><p className="eyebrow">REFERENCE LIBRARY</p><h1>{getLabels()[locale][kind]}</h1><p>{filtered.length} {kind}</p></div><input className="move-search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder={locale === "zh-Hant" ? `搜尋${kind === "abilities" ? "特性" : "持有物"}…` : `Search ${kind}…`} /></div><div className="resource-grid">{filtered.map((entry) => <article className="resource-card" key={entry.id}><div><span className="resource-kind">{"category" in entry && typeof entry.category === "string" ? entry.category : "Ability"}</span><h2>{kind === "abilities" ? <AbilityTooltip id={entry.id} locale={locale} /> : <ItemTooltip item={getCatalog().itemById.get(entry.id)} locale={locale} />}</h2></div><p>{locale === "zh-Hant" ? entry.descriptionZh : entry.description}</p></article>)}</div></section>;
}

function BuildEditor({ selected, editingMember, mode, locale, format, onFormatChange, onClose, onDraftChange }: { selected: Pokemon | null; editingMember: TeamMember | null; mode: "team" | "scrapbook"; locale: Locale; format: BattleFormat; onFormatChange: (format: BattleFormat) => void; onClose: () => void; onDraftChange?: (member: Omit<TeamMember, "id">) => void }) {
  return selected ? <BuildEditorContent key={`${mode}:${selected.id}:${editingMember?.id ?? "new"}`} selected={selected} editingMember={editingMember} mode={mode} locale={locale} format={format} onFormatChange={onFormatChange} onClose={onClose} onDraftChange={onDraftChange} /> : null;
}

type BattleApiResponse = { data: { singles: BattleUsage | null; doubles: BattleUsage | null } };

const sameAp = (left: Stats, right: Stats) => (Object.keys(left) as Array<keyof Stats>).every((stat) => left[stat] === right[stat]);
const apChoiceLabel = (choice: ReturnType<typeof rankedApChoices>[number], locale: Locale) => {
  const stats = locale === "zh-Hant"
    ? [["HP", choice.ap.hp], ["攻擊", choice.ap.attack], ["防禦", choice.ap.defense], ["特攻", choice.ap.specialAttack], ["特防", choice.ap.specialDefense], ["速度", choice.ap.speed]]
    : [["HP", choice.ap.hp], ["Atk", choice.ap.attack], ["Def", choice.ap.defense], ["SpA", choice.ap.specialAttack], ["SpD", choice.ap.specialDefense], ["Spe", choice.ap.speed]];
  return `${locale === "zh-Hant" ? "DEMO" : "DEMO"} #${choice.rank} · ${stats.map(([label, value]) => `${label} ${value}`).join(" / ")} · ${choice.percentage || "—"}`;
};

function BuildEditorContent({ selected, editingMember, mode, locale, format, onFormatChange: setAppFormat, onClose, onDraftChange }: { selected: Pokemon; editingMember: TeamMember | null; mode: "team" | "scrapbook"; locale: Locale; format: BattleFormat; onFormatChange: (format: BattleFormat) => void; onClose: () => void; onDraftChange?: (member: Omit<TeamMember, "id">) => void }) {
  useDialogEscape(onClose);
  const members = useTeamStore((state) => state.teams[format]);
  const add = useTeamStore((state) => state.add);
  const update = useTeamStore((state) => state.update);
  const isEditingTeam = mode === "team" && Boolean(editingMember);
  const [moveIds, setMoveIds] = useState<string[]>(editingMember ? editingMember.moveIds.slice(0, 4) : selected.moveIds.slice(0, 4));
  const [abilityId, setAbilityId] = useState<string | null>(editingMember ? editingMember.abilityId : selected.abilityIds[0] ?? null);
  const requiredMegaStoneId = getCatalog().megaStoneIdByPokemonId.get(selected.id) ?? null;
  const baseSelected = useMemo(() => {
    if (!selected.isMega || !requiredMegaStoneId) return selected;
    return getCatalog().pokemonById.get(getCatalog().megaBasePokemonIdByMegaId.get(selected.id) ?? "") ?? selected;
  }, [requiredMegaStoneId, selected]);
  const [itemId, rawSetItemId] = useState<string | null>(editingMember ? editingMember.itemId : requiredMegaStoneId ?? null);
  const [itemChanged,setItemChanged] = useState(false);
  const manualEditVersionRef = useRef(0);
  const formatRef = useRef(format);
  const [ap, setAp] = useState<Stats>(editingMember ? { ...editingMember.ap } : { ...ZERO_STATS });
  const [nature, setNature] = useState<Nature>(editingMember?.nature ?? NEUTRAL_NATURE);
  const [error, setError] = useState("");
  const [displayModes, setDisplayModes] = useState<BuilderDisplayModes>(defaultDisplayModes);
  useEffect(() => {
    try {
      const saved = JSON.parse(localStorage.getItem(BUILDER_DISPLAY_KEY) ?? "null") as Partial<BuilderDisplayModes> | null;
      // Browser-only preference hydration must run after the server-rendered default.
      // eslint-disable-next-line react-hooks/set-state-in-effect
      if (saved) setDisplayModes({
        move: saved.move === "compact" ? "compact" : "detailed",
        ability: saved.ability === "compact" ? "compact" : "detailed",
        item: saved.item === "compact" ? "compact" : "detailed",
      });
    } catch { /* Ignore malformed local preferences. */ }
  }, []);
  const changeDisplayMode = (kind: keyof BuilderDisplayModes, mode: DisplayMode) => setDisplayModes((current) => {
    const next = { ...current, [kind]: mode };
    localStorage.setItem(BUILDER_DISPLAY_KEY, JSON.stringify(next));
    return next;
  });
  const effectiveSelected = useMemo(() => {
    if (editingMember && !itemChanged) return selected;
    if (mode === "scrapbook" && selected.isMega && itemId === null) return selected;
    const mega = itemId ? getCatalog().megaPokemonForStone(itemId, baseSelected.id) : null;
    return mega && getCatalog().megaStoneMatchesPokemon(itemId!, baseSelected.id) ? mega : baseSelected;
  }, [baseSelected, itemId, mode, selected, editingMember, itemChanged]);
  const battleDataKey = getCatalog().battleDataKeyForPokemon(effectiveSelected);
  const battleState = useBattleUsage(effectiveSelected);
  const battleData = battleState.data;
  const recommendationsLoading = battleState.busy;
  const initialRecommendationAppliedRef = useRef(Boolean(editingMember));
  const pendingFormHydrationRef = useRef<{ key: string; pokemon: Pokemon; replaceAbility: boolean; editVersion: number } | null>(null);
  const usage = battleData?.[format] ?? null;
  const commonMoves = useMemo(() => rankedMoveChoices(usage, effectiveSelected, 10), [effectiveSelected, usage]);
  const commonAbilities = useMemo(() => rankedAbilityChoices(usage, effectiveSelected, 10), [effectiveSelected, usage]);
  const commonItems = useMemo(() => rankedItemChoices(usage, 10), [usage]);
  const commonNatures = useMemo(() => rankedNatureChoices(usage, 10), [usage]);
  const commonApChoices = useMemo(() => rankedApChoices(usage, 10), [usage]);
  const apPresetRank = commonApChoices.find((choice) => sameAp(choice.ap, ap))?.rank ?? null;
  const finalStats = calculateFinalStats(effectiveSelected.baseStats, ap, nature);
  const remaining = 66 - apTotal(ap);
  const applyRecommendations = (nextFormat: BattleFormat, data: BattleApiResponse["data"] | null, chosenItem?: string | null) => {
    setItemChanged(true);
    const nextUsage = data?.[nextFormat] ?? null;
    const nextItem = chosenItem === undefined ? requiredMegaStoneId ?? recommendedItemId(nextUsage) : chosenItem;
    const mega = nextItem ? getCatalog().megaPokemonForStone(nextItem, baseSelected.id) : null;
    const target = mega && getCatalog().megaStoneMatchesPokemon(nextItem!, baseSelected.id) ? mega : baseSelected;
    const suggestedMoves = recommendedMoveIds(nextUsage, target);
    rawSetItemId(nextItem);
    setMoveIds((suggestedMoves.length ? suggestedMoves : target.moveIds).slice(0, 4));
    setAbilityId(recommendedAbilityId(nextUsage, target) ?? target.abilityIds[0] ?? null);
    if (chosenItem === undefined) {
      setNature(recommendedNature(nextUsage) ?? NEUTRAL_NATURE);
      setAp(recommendedAp(nextUsage) ?? { ...ZERO_STATS });
    }
  };
  const changeFormat = (nextFormat: BattleFormat) => {
    setAppFormat(nextFormat);
    if (mode === "scrapbook" || manualEditVersionRef.current > 0) return;
    applyRecommendations(nextFormat, battleData);
  };
  const changeItem = (nextItem: string | null) => {
    setItemChanged(true);
    const nextMega = nextItem ? getCatalog().megaPokemonForStone(nextItem, baseSelected.id) : null;
    const nextSelected = nextMega && getCatalog().megaStoneMatchesPokemon(nextItem!, baseSelected.id) ? nextMega : baseSelected;
    rawSetItemId(nextItem);
    if (nextSelected.id === effectiveSelected.id) return;
    const nextUsage = battleData?.[format] ?? null;
    const legalMoves = new Set(nextSelected.moveIds);
    if (mode === "scrapbook") {
      setMoveIds((current) => current.map((id) => legalMoves.has(id) ? id : ""));
      if (abilityId && !nextSelected.abilityIds.includes(abilityId)) setAbilityId(null);
      pendingFormHydrationRef.current = null;
      return;
    }
    const retainedMoves = moveIds.filter((id) => legalMoves.has(id));
    const replaceAbility = !abilityId || !nextSelected.abilityIds.includes(abilityId);
    const nextBattleDataKey = getCatalog().battleDataKeyForPokemon(nextSelected);
    if (nextBattleDataKey !== battleDataKey) {
      pendingFormHydrationRef.current = { key: nextBattleDataKey, pokemon: nextSelected, replaceAbility, editVersion: manualEditVersionRef.current };
      setMoveIds(retainedMoves.slice(0, 4));
      if (replaceAbility) setAbilityId(nextSelected.abilityIds[0] ?? null);
      return;
    }
    const fallbackMoves = recommendedMoveIds(nextUsage, nextSelected).filter((id) => !retainedMoves.includes(id));
    setMoveIds([...retainedMoves, ...fallbackMoves].slice(0, 4));
    if (replaceAbility) {
      setAbilityId(recommendedAbilityId(nextUsage, nextSelected) ?? nextSelected.abilityIds[0] ?? null);
    }
  };
  const onFormatChange = changeFormat;
  const setItemId = changeItem;

  const familyStoneIds = useMemo(() => getCatalog().pokemon
    .filter((entry) => entry.speciesKey === selected.speciesKey && entry.isMega)
    .map((entry) => getCatalog().megaStoneIdByPokemonId.get(entry.id))
    .filter((id): id is string => Boolean(id)), [selected.speciesKey]);
  const commonItemRank = useMemo(() => new Map(commonItems.map((choice) => [choice.id, choice.rank])), [commonItems]);
  const selectableItems = useMemo(() => [...getCatalog().items].sort((left, right) => {
    const usageDifference = (commonItemRank.get(left.id) ?? 999) - (commonItemRank.get(right.id) ?? 999);
    if (usageDifference) return usageDifference;
    const leftGroup = left.category === "Mega Stone" ? "Mega Stone" : itemEffectCategories(left)[0] ?? "Other";
    const rightGroup = right.category === "Mega Stone" ? "Mega Stone" : itemEffectCategories(right)[0] ?? "Other";
    const leftDedicated = familyStoneIds.indexOf(left.id);
    const rightDedicated = familyStoneIds.indexOf(right.id);
    if (leftGroup === "Mega Stone" && rightGroup === "Mega Stone" && (leftDedicated >= 0 || rightDedicated >= 0)) {
      if (leftDedicated < 0) return 1;
      if (rightDedicated < 0) return -1;
      if (leftDedicated !== rightDedicated) return leftDedicated - rightDedicated;
    }
    return ITEM_GROUP_ORDER.indexOf(leftGroup) - ITEM_GROUP_ORDER.indexOf(rightGroup) || localName(left, locale).localeCompare(localName(right, locale));
  }), [commonItemRank, familyStoneIds, locale]);
  const commonAbilityRank = useMemo(() => new Map(commonAbilities.map((choice) => [choice.id, choice.rank])), [commonAbilities]);
  const abilityOptions = useMemo<ResourcePickerOption[]>(() => effectiveSelected.abilityIds
    .map((id) => getCatalog().abilityById.get(id)).filter((entry): entry is NonNullable<typeof entry> => Boolean(entry))
    .sort((left, right) => (commonAbilityRank.get(left.id) ?? 999) - (commonAbilityRank.get(right.id) ?? 999) || localName(left, locale).localeCompare(localName(right, locale)))
    .map((entry) => ({ id: entry.id, name: localName(entry, locale), searchText: `${entry.name} ${entry.nameZh} ${entry.description} ${entry.descriptionZh}`, description: locale === "zh-Hant" ? entry.descriptionZh : entry.description, rank: commonAbilityRank.get(entry.id) })), [commonAbilityRank, effectiveSelected.abilityIds, locale]);
  const itemOptions = useMemo<ResourcePickerOption[]>(() => selectableItems.map((item) => ({
    id: item.id,
    name: localName(item, locale),
    searchText: `${item.name} ${item.nameZh} ${item.description} ${item.descriptionZh}`,
    description: locale === "zh-Hant" ? item.descriptionZh : item.description,
    icon: item.imageUrl ? <img className="item-icon" src={item.imageUrl} alt="" width="24" height="24" /> : null,
    meta: localizedTerm(item.category, locale),
    group: commonItemRank.has(item.id) ? "Common" : item.category === "Mega Stone" ? "Mega Stone" : itemEffectCategories(item)[0] ?? "Other",
    rank: commonItemRank.get(item.id),
  })), [commonItemRank, locale, selectableItems]);
  const commonNatureRank = useMemo(() => new Map(commonNatures.map((choice) => [choice.nature.name, choice.rank])), [commonNatures]);
  const selectableNatures = useMemo(() => [...NATURES].sort((left, right) => (commonNatureRank.get(left.name) ?? 999) - (commonNatureRank.get(right.name) ?? 999) || natureLabel(left, locale).localeCompare(natureLabel(right, locale))), [commonNatureRank, locale]);

  useEffect(() => { formatRef.current = format; }, [format]);

  useEffect(() => {
    if (recommendationsLoading) return;
    const pending = pendingFormHydrationRef.current;
    if (pending?.key === battleDataKey) {
      pendingFormHydrationRef.current = null;
      if (pending.editVersion === manualEditVersionRef.current) {
        const nextUsage = battleData?.[formatRef.current] ?? null;
        setMoveIds(current => {
          const retained = current.filter(id => pending.pokemon.moveIds.includes(id));
          return [...retained, ...recommendedMoveIds(nextUsage,pending.pokemon).filter(id=>!retained.includes(id))].slice(0,4);
        });
        if (pending.replaceAbility) setAbilityId(recommendedAbilityId(nextUsage,pending.pokemon) ?? pending.pokemon.abilityIds[0] ?? null);
      }
    }
    if (!initialRecommendationAppliedRef.current && !editingMember) {
      initialRecommendationAppliedRef.current = true;
      if (manualEditVersionRef.current === 0) applyRecommendations(formatRef.current,battleData);
    }
    // A new snapshot enriches choices; initial defaults are one-shot and never overwrite intervening edits.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [battleData,battleDataKey,recommendationsLoading,editingMember]);
  useEffect(() => {
    if (mode === "scrapbook" && editingMember && onDraftChange) onDraftChange({ pokemonId: itemChanged ? effectiveSelected.id : editingMember.pokemonId, moveIds, abilityId, itemId, ap, nature });
  }, [abilityId, ap, editingMember, effectiveSelected.id, itemChanged, itemId, mode, moveIds, nature, onDraftChange]);
  const submitTeam = () => {
    if (!isEditingTeam && members.length >= 6) { setError(locale === "zh-Hant" ? "隊伍已滿，請先移除一名成員。" : "Team is full. Remove a member first."); return; }
    const candidate: TeamMember = { id: isEditingTeam ? editingMember!.id : crypto.randomUUID(), pokemonId: effectiveSelected.id, moveIds: mode === "scrapbook" ? moveIds.filter(Boolean) : moveIds, abilityId, itemId, ap, nature };
    const nextMembers = isEditingTeam ? members.map((member) => member.id === candidate.id ? candidate : member) : [...members, candidate];
    const issues = isEditingTeam ? validateTeamEdit(members,candidate,getCatalog().pokemonById,new Set(getCatalog().items.map(item=>item.id)),getCatalog().megaStoneIdByPokemonId) : validateTeam(nextMembers, getCatalog().pokemonById, new Set(getCatalog().items.map((item) => item.id)), getCatalog().megaStoneIdByPokemonId);
    const candidateIssue = issues[0];
    if (candidateIssue) { setError(candidateIssue.message); return; }
    if (isEditingTeam) update(format, candidate); else add(format, candidate);
    onClose();
  };
  const selectedItem = itemId ? getCatalog().itemById.get(itemId) ?? null : null;
  return <div className="editor-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}>
    <section className="build-editor" onClickCapture={(event) => { if (!(event.target as Element).closest("[data-usage-format-choice]")) manualEditVersionRef.current++; }} onKeyDownCapture={(event) => { if (event.key === "Enter" && !(event.target as Element).closest("[data-usage-format-choice]")) manualEditVersionRef.current++; }} onChangeCapture={() => { manualEditVersionRef.current++; }} role="dialog" aria-modal="true" aria-labelledby="builder-title">
      <button className="close-button" onClick={onClose} aria-label={locale === "zh-Hant" ? "關閉" : "Close"}>×</button>
      <div className="builder-identity"><img src={effectiveSelected.imageUrl} alt="" width="92" height="92" /><div><p className="eyebrow">BUILD WORKBENCH</p><h2 id="builder-title">{localName(effectiveSelected, locale)}</h2><div className="badge-row">{effectiveSelected.types.map((type) => <TypeBadge key={type} type={type} locale={locale} />)}</div></div></div>
      <div className="build-format-selector"><span>{locale === "zh-Hant" ? "隊伍模式" : "Team mode"}</span><div className="segmented" role="group" aria-label="Team mode"><button data-usage-format-choice disabled={isEditingTeam} className={format === "singles" ? "active" : ""} onClick={() => onFormatChange("singles")}>{getLabels()[locale].singles}</button><button data-usage-format-choice disabled={isEditingTeam} className={format === "doubles" ? "active" : ""} onClick={() => onFormatChange("doubles")}>{getLabels()[locale].doubles}</button></div><small>{mode === "scrapbook" ? (locale === "zh-Hant" ? "每次調整都會立即儲存到畫本；只有按下「加入已選隊伍」才會新增隊伍成員。" : "Every change is saved to the scrapbook; a team member is added only through “Add to selected team”.") : isEditingTeam ? (locale === "zh-Hant" ? "正在編輯隊伍中的既有配置；儲存後位置不會改變。" : "Editing this team member in place; its team position will be preserved.") : recommendationsLoading ? (locale === "zh-Hant" ? "正在讀取 DEMO 使用率…" : "Loading DEMO usage…") : usage ? (locale === "zh-Hant" ? "DEMO 使用率選項已載入；你的配置不會被自動覆寫" : "DEMO usage choices loaded; your edits stay unchanged") : (locale === "zh-Hant" ? "使用率暫時無法取得，已使用預設配置" : "Usage unavailable; catalog defaults applied")}</small></div>
      {usage && <p><UsageFreshness provenance={usage.provenance} locale={locale} missingCategories={usage.missingCategories}/></p>}
      {battleState.error && <button onClick={battleState.retry}>{locale === "zh-Hant" ? "重試使用率" : "Retry usage"}</button>}
      <div className="builder-display-preferences" aria-label={locale === "zh-Hant" ? "選單顯示方式" : "Picker display modes"}>{(["move", "ability", "item"] as const).map((kind) => <div key={kind}><span>{locale === "zh-Hant" ? kind === "move" ? "招式" : kind === "ability" ? "特性" : "持有物" : kind}</span><div className="segmented"><button className={displayModes[kind] === "detailed" ? "active" : ""} onClick={() => changeDisplayMode(kind, "detailed")}>{locale === "zh-Hant" ? "詳細" : "Detailed"}</button><button className={displayModes[kind] === "compact" ? "active" : ""} onClick={() => changeDisplayMode(kind, "compact")}>{locale === "zh-Hant" ? "精簡" : "Compact"}</button></div></div>)}</div>
      {effectiveSelected.id !== selected.id && <p className="mega-transform-note">{locale === "zh-Hant" ? <>{selectedItem ? <>選擇 <ItemDisplay item={selectedItem} locale={locale} size={22} /> 後</> : "移除專屬超級石後"}，目前型態為 {localName(effectiveSelected, locale)}。</> : <>{selectedItem ? <><ItemDisplay item={selectedItem} locale={locale} size={22} /> selected; </> : "Dedicated Mega Stone removed; "}current form is {localName(effectiveSelected, locale)}.</>}</p>}
      <div className="builder-grid">
        <label>{locale === "zh-Hant" ? "性格" : "Nature"}<select value={nature.name} onChange={(event) => setNature(NATURES.find((entry) => entry.name === event.target.value) ?? NEUTRAL_NATURE)}>{selectableNatures.map((entry) => <option value={entry.name} key={entry.name}>{commonNatureRank.has(entry.name) ? `${locale === "zh-Hant" ? "DEMO" : "DEMO"} #${commonNatureRank.get(entry.name)} · ` : ""}{natureLabel(entry, locale)}</option>)}</select></label>
        <ResourcePicker label={locale === "zh-Hant" ? "特性" : "Ability"} value={abilityId} options={abilityOptions} locale={locale} detailed={displayModes.ability === "detailed"} onChange={setAbilityId} />
        <ResourcePicker label={locale === "zh-Hant" ? "持有物" : "Held item"} value={itemId} options={itemOptions} locale={locale} detailed={displayModes.item === "detailed"} onChange={setItemId} />
      </div>
      <div className="move-slots">{[0,1,2,3].map((slot) => <MovePicker key={slot} slot={slot} value={moveIds[slot] ?? null} legalMoveIds={effectiveSelected.moveIds} selectedMoveIds={moveIds} commonMoves={commonMoves} locale={locale} detailed={displayModes.move === "detailed"} onChange={(moveId) => setMoveIds((current) => { if (mode === "scrapbook") return Array.from({ length: 4 }, (_, index) => index === slot ? moveId ?? "" : current[index] ?? ""); const next = [...current]; if (moveId) next[slot] = moveId; else next.splice(slot, 1); return next.filter(Boolean).slice(0, 4); })} />)}</div>
      <div className="ap-head"><h3>{locale === "zh-Hant" ? "能力值與 AP" : "Stats & AP"}</h3><label className="ap-preset-field"><span>{locale === "zh-Hant" ? "AP 配置" : "AP spread"}</span><select aria-label={locale === "zh-Hant" ? "AP 配置" : "AP spread"} value={apPresetRank === null ? "custom" : String(apPresetRank)} onChange={(event) => {
        if (event.target.value === "custom") return;
        const choice = commonApChoices.find((entry) => entry.rank === Number(event.target.value));
        if (choice) setAp({ ...choice.ap });
      }}><option value="custom">{locale === "zh-Hant" ? "客製化" : "Custom"}</option>{commonApChoices.map((choice) => <option key={choice.rank} value={choice.rank}>{apChoiceLabel(choice, locale)}</option>)}</select></label><span className={remaining < 0 ? "remaining bad" : "remaining"}>{remaining} / 66 {locale === "zh-Hant" ? "剩餘" : "remaining"}</span></div>
      <div className="stat-editor">{(Object.keys(statLabels) as Array<keyof Stats>).map((stat) => <label key={stat}><span>{statLabels[stat]}{nature.up === stat && <em className="nature-up" title="+10%">↑</em>}{nature.down === stat && <em className="nature-down" title="−10%">↓</em>} <b>{finalStats[stat]}</b></span><input type="range" min="0" max="32" value={ap[stat]} onChange={(event) => { const next = { ...ap, [stat]: Number(event.target.value) }; if (apTotal(next) <= 66) setAp(next); }} /><output>{ap[stat]}</output></label>)}</div>
      {error && <p className="form-error" role="alert">{error}</p>}{mode === "scrapbook" ? <div className="builder-submit-actions"><button className="primary-button" onClick={onClose}>{locale === "zh-Hant" ? "完成" : "Done"}</button><button className="secondary-button" onClick={submitTeam}>{locale === "zh-Hant" ? "加入已選隊伍" : "Add to selected team"}</button></div> : <button className="primary-button" onClick={submitTeam}>{isEditingTeam ? getLabels()[locale].save : getLabels()[locale].add}</button>}
    </section>
  </div>;
}

function TeamTray({ locale, format, onFormatChange, onEdit }: { locale: Locale; format: BattleFormat; onFormatChange: (format: BattleFormat) => void; onEdit: (member: TeamMember, format: BattleFormat) => void }) {
  const teams = useTeamStore((state) => state.teams);
  const members = teams[format];
  const remove = useTeamStore((state) => state.remove);
  const [open, setOpen] = useState(false);
  const [plansOpen, setPlansOpen] = useState(false);
  const [importedPlan, setImportedPlan] = useState<{id: string; format: BattleFormat} | null>(null);
  useEffect(() => {
    let cancelled = false;
    queueMicrotask(() => {
      if (cancelled) return;
      const params = new URLSearchParams(window.location.search);
      const id = params.get("teamPlan");
      const planFormat = params.get("teamFormat");
      if (id && /^import-[a-f0-9-]{36}$/.test(id) && (planFormat === "singles" || planFormat === "doubles")) {
        setImportedPlan({id, format: planFormat}); setOpen(true); setPlansOpen(true);
      }
    });
    return () => { cancelled = true; };
  }, []);
  useEffect(() => { if (importedPlan && format !== importedPlan.format) onFormatChange(importedPlan.format); }, [importedPlan, format, onFormatChange]);
  const closePlans = () => {
    setPlansOpen(false); setImportedPlan(null);
    const url = new URL(window.location.href);
    url.searchParams.delete("teamPlan"); url.searchParams.delete("teamFormat");
    window.history.replaceState(window.history.state, "", url);
  };
  return <aside className={`team-tray ${open ? "open" : "collapsed"}`} aria-label={getLabels()[locale].team}>
    <button className="tray-header" onClick={() => setOpen(!open)} aria-expanded={open}><span><b>{getLabels()[locale].team}</b><small>{getLabels()[locale][format]} · {members.length} / 6</small></span><span>{open ? "⌄" : "⌃"}</span></button>
    {plansOpen && <TeamPlans key={importedPlan?.format ?? format} format={importedPlan?.format ?? format} locale={locale} initialPlanId={importedPlan?.id} onClose={closePlans} />}{open && <><button className="team-plans-trigger" onClick={() => setPlansOpen(true)}>{locale === "zh-Hant" ? "儲存／載入隊伍方案" : "Save / load team plans"}</button><div className="team-format-tabs" role="group" aria-label="Selected team format"><button className={format === "singles" ? "active" : ""} onClick={() => onFormatChange("singles")}>{getLabels()[locale].singles} {teams.singles.length}/6</button><button className={format === "doubles" ? "active" : ""} onClick={() => onFormatChange("doubles")}>{getLabels()[locale].doubles} {teams.doubles.length}/6</button></div><div className="team-list">{members.length === 0 ? <p className="team-empty">{getLabels()[locale].empty}</p> : members.map((member) => {
      const entry = getCatalog().pokemonById.get(member.pokemonId);
      const repair = <SavedBuildIssues member={member} locale={locale} onReplace={pokemonId => useTeamStore.getState().update(format, { ...member, pokemonId })} />;
      if (!entry) return <article className="team-card" key={member.id}>{repair}<button onClick={() => remove(format, member.id)}>{locale === "zh-Hant" ? "移除" : "Remove"}</button></article>;
      const stats = calculateFinalStats(entry.baseStats, member.ap, member.nature);
      return <article className="team-card" key={member.id}>
        {repair}<div className="team-card-actions"><button className="edit-member" onClick={() => onEdit(member, format)} aria-label={`${getLabels()[locale].edit} ${localName(entry, locale)}`}>{getLabels()[locale].edit}</button><button className="remove-member" onClick={() => remove(format, member.id)} aria-label={`Remove ${entry.name}`}>×</button></div>
        <div className="team-card-title"><img src={entry.imageUrl} alt="" width="52" height="52" /><div><strong>{localName(entry, locale)}</strong><div className="badge-row compact">{entry.types.map((type) => <TypeBadge key={type} type={type} locale={locale} />)}</div></div></div>
        <TypeMatchups types={entry.types} locale={locale} compact />
        <div className="team-moves">{member.moveIds.map((id) => { const move = getCatalog().moveById.get(id); if (!move) return <span key={id}>{locale === "zh-Hant" ? "待修正招式" : "Unavailable move"}: {id}</span>; return <span key={id}><TypeBadge type={move.type} locale={locale} /> {localName(move, locale)}</span>; })}</div>
        <div className="team-meta"><span>{member.abilityId ? <AbilityTooltip id={member.abilityId} locale={locale} /> : "—"}</span><span>{member.itemId ? <ItemTooltip item={getCatalog().itemById.get(member.itemId)} locale={locale} size={22} /> : (locale === "zh-Hant" ? "無持有物" : "No item")}</span><span className="team-nature" title={natureLabel(member.nature, locale)}>{natureLabel(member.nature, locale)}</span></div>
        <div className="mini-stats">{(Object.keys(statLabels) as Array<keyof Stats>).map((stat) => <span key={stat}><small>{statLabels[stat]}{member.nature.up === stat && <i className="nature-up">↑</i>}{member.nature.down === stat && <i className="nature-down">↓</i>}</small><b>{stats[stat]}</b><em className={member.ap[stat] ? "has-ap" : ""}>+{member.ap[stat]}</em></span>)}</div>
      </article>;
    })}</div></>}
  </aside>;
}

export function ChampionsApp() {
  const { theme, setTheme } = useThemePreference();
  const [locale, setLocaleState] = useState<Locale>("en");
  const setLocale = (value: Locale | ((current: Locale) => Locale)) => setLocaleState((current) => {
    const next = typeof value === "function" ? value(current) : value;
    localStorage.setItem(LOCALE_STORAGE_KEY, next);
    return next;
  });
  const [view, setView] = useSessionState<View>("champions-view", "pokemon", value => ["pokemon", "scrapbook", "moves", "abilities", "items", "types", "speed", "damage"].includes(String(value)));
  const [format, setFormat] = useSessionState<BattleFormat>("champions-format", "doubles", value => value === "singles" || value === "doubles");
  useEffect(() => {
    // The speed workspace hides the tray. An explicit imported-plan entry must
    // reveal it even when that workspace was restored from this tab's session.
    const params = new URLSearchParams(window.location.search);
    const id = params.get("teamPlan");
    const mode = params.get("teamFormat");
    if ((view !== "speed" && view !== "damage") || !id || !/^import-[a-f0-9-]{36}$/.test(id) || (mode !== "singles" && mode !== "doubles")) return;
    let cancelled = false;
    queueMicrotask(() => { if (!cancelled) setView("pokemon"); });
    return () => { cancelled = true; };
  }, [view, setView]);
  useEffect(() => { const linkedView=new URLSearchParams(window.location.search).get("view"); if (linkedView === "damage" || linkedView === "speed") queueMicrotask(() => setView(linkedView)); }, [setView]);
  const [selected, setSelected] = useState<Pokemon | null>(null);
  const [collectionNotice, setCollectionNotice] = useState<{bookId: string; count: number} | null>(null);
  const [scrapbookCandidate, setScrapbookCandidate] = useState<Pokemon | null>(null);
  const [editingMember, setEditingMember] = useState<TeamMember | null>(null);
  const [editorMode, setEditorMode] = useState<"team" | "scrapbook">("team");
  const [scrapbookEditTarget, setScrapbookEditTarget] = useState<{ bookId: string; entryId: string } | null>(null);
  const scrapbookSaveStatus = useScrapbookStore((state) => state.saveStatus);
  const retryScrapbookSave = useScrapbookStore((state) => state.retrySave);
  const updateScrapbookEntry = useScrapbookStore((state) => state.updateEntry);
  const hydrate = useTeamStore((state) => state.hydrate);
  const hydrateScrapbooks = useScrapbookStore((state) => state.hydrate);
  useEffect(() => { void hydrate(); }, [hydrate]);
  useEffect(() => { void hydrateScrapbooks(); }, [hydrateScrapbooks]);
  useEffect(() => {
    const saved = localStorage.getItem(LOCALE_STORAGE_KEY);
    const preferred = saved === "en" || saved === "zh-Hant"
      ? saved
      : navigator.languages.some((language) => language.toLowerCase().startsWith("zh")) ? "zh-Hant" : "en";
    // Browser language and localStorage are unavailable during server rendering.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setLocale(preferred);
  }, []);
  useEffect(() => {
    const root = document.documentElement;
    if (root.hasAttribute("data-locale-pending") && root.dataset.locale !== locale) return;
    root.dataset.locale = locale;
    root.lang = locale;
    delete root.dataset.localePending;
  }, [locale]);
  const copy = getLabels()[locale];
  const closeEditor = useCallback(() => { setSelected(null); setEditingMember(null); setScrapbookEditTarget(null); }, []);
  const startNewBuild = (entry: Pokemon) => { setEditorMode("team"); setScrapbookEditTarget(null); setEditingMember(null); setSelected(entry); };
  const editTeamMember = (member: TeamMember, memberFormat: BattleFormat) => {
    const entry = getCatalog().pokemonById.get(member.pokemonId);
    if (!entry) return;
    setEditorMode("team");
    setScrapbookEditTarget(null);
    setFormat(memberFormat);
    setEditingMember(member);
    setSelected(entry);
  };
  const editScrapbookEntry = (bookId: string, saved: ScrapbookEntry) => {
    const entry = getCatalog().pokemonById.get(saved.pokemonId);
    if (!entry) return;
    setEditorMode("scrapbook");
    setScrapbookEditTarget({ bookId, entryId: saved.id });
    setEditingMember(saved);
    setSelected(entry);
  };
  const persistScrapbookDraft = useCallback((member: Omit<TeamMember, "id">) => {
    if (scrapbookEditTarget) updateScrapbookEntry(scrapbookEditTarget.bookId, scrapbookEditTarget.entryId, member);
  }, [scrapbookEditTarget, updateScrapbookEntry]);
  return <div className={`app-shell ${view === "types" ? "type-chart-active" : view === "speed" ? "speed-active" : view === "damage" ? "damage-active" : ""}`}><header className="topbar"><a className="brand" href="#top" aria-label="Champions Lab home"><span className="brand-mark">CL</span><span><b>CHAMPIONS LAB · DEMO</b><small>Interactive portfolio · 互動作品集</small></span></a><nav>{(["pokemon","moves","abilities","items","types","speed","damage","scrapbook"] as View[]).map((entry) => <button key={entry} className={view === entry ? "active" : ""} onClick={() => setView(entry)}>{copy[entry]}</button>)}</nav><div className="header-actions"><span className="regulation-dot">● {copy.current}</span><div className="segmented" role="group" aria-label="Team mode"><button className={format === "singles" ? "active" : ""} onClick={() => setFormat("singles")}>{copy.singles}</button><button className={format === "doubles" ? "active" : ""} onClick={() => setFormat("doubles")}>{copy.doubles}</button></div><ThemeToggle theme={theme} locale={locale} onChange={setTheme} /><button className="locale-button" onClick={() => setLocale(locale === "en" ? "zh-Hant" : "en")}>{locale === "en" ? "繁中" : "EN"}</button></div><aside className="demo-banner" aria-label="Demo data notice"><strong>DEMO</strong><span>Sample catalog · fabricated usage · no live data</span><span lang="zh-Hant">示範圖鑑・虛構使用率・非即時資料</span></aside></header><main id="top">{view === "scrapbook" && <p className="save-status" role="status">{scrapbookSaveStatus === "saved" ? (locale === "zh-Hant" ? "已儲存到此裝置" : "Saved on this device") : scrapbookSaveStatus === "saving" ? (locale === "zh-Hant" ? "儲存中…" : "Saving…") : <>{locale === "zh-Hant" ? "儲存失敗，請勿關閉此頁。" : "Save failed. Keep this page open."}<button onClick={retryScrapbookSave}>{locale === "zh-Hant" ? "重試" : "Retry"}</button></>}</p>}<PokemonTableV2 active={view === "pokemon"} locale={locale} format={format} onSelect={startNewBuild} onScrapbook={setScrapbookCandidate} />{view === "scrapbook" && <ScrapbookView locale={locale} format={format} onEditEntry={editScrapbookEntry} onAddToScrapbook={setScrapbookCandidate} />}<MoveDatabaseV2 active={view === "moves"} locale={locale} onScrapbook={setScrapbookCandidate} /><ResourceDatabaseV2 active={view === "abilities"} kind="abilities" locale={locale} onScrapbook={setScrapbookCandidate} /><ResourceDatabaseV2 active={view === "items"} kind="items" locale={locale} />{view === "types" && <TypeChart locale={locale} />}{view === "speed" && <SpeedChart key={format} locale={locale} format={format} onScrapbook={setScrapbookCandidate} />}{view === "damage" && <DamageCalculator key={format} locale={locale} format={format} />}</main><CatalogBackToTop locale={locale} active={["pokemon","moves","abilities","items"].includes(view)} /><footer><span>{locale === "zh-Hant" ? "非官方互動作品集 · 原創幾何示意圖 · MIT 程式碼" : "Unofficial interactive portfolio · original geometric placeholders · MIT code"}</span><span>{locale === "zh-Hant" ? "Pokémon 名稱與商標屬於其權利人；本作品未獲官方認可。" : "Pokémon names and trademarks belong to their respective owners; this demo is not endorsed."}</span><DataFreshness locale={locale} /></footer><TeamTray locale={locale} format={format} onFormatChange={setFormat} onEdit={editTeamMember} /><BuildEditor selected={selected} editingMember={editingMember} mode={editorMode} locale={locale} format={format} onFormatChange={setFormat} onClose={closeEditor} onDraftChange={editorMode === "scrapbook" ? persistScrapbookDraft : undefined} />{scrapbookCandidate && <AddToScrapbookDialog pokemon={scrapbookCandidate} locale={locale} onClose={() => setScrapbookCandidate(null)} onAdded={(bookId, count) => setCollectionNotice({bookId, count})} />}{collectionNotice && <div className="collection-status" role="status">{locale === "zh-Hant" ? `已加入 ${collectionNotice.count} 份配置` : `${collectionNotice.count} builds added`}<button onClick={() => { useScrapbookStore.getState().setActiveBook(collectionNotice.bookId); setView("scrapbook"); setCollectionNotice(null); }}>{locale === "zh-Hant" ? "前往畫本" : "View scrapbook"}</button><button aria-label={locale === "zh-Hant" ? "關閉提示" : "Dismiss notification"} onClick={() => setCollectionNotice(null)}>×</button></div>}</div>;
}
