"use client";

import { get, set as setValue } from "idb-keyval";
import { create } from "zustand";
import { getCatalog } from "./catalog";
import { NATURES, NEUTRAL_NATURE, ZERO_STATS, apTotal } from "./domain";
import { ALL_TYPES } from "./type-chart";
import type { Nature, Stats, TeamMember } from "./types";

const STORAGE_KEY = "champions-lab-demo-scrapbooks-v1";
export const UNTAGGED_GROUP_ID = "__untagged__";
export const SCRAPBOOK_BATTLE_CATEGORIES = ["move", "held_item", "ability", "stat_alignment", "stat_points", "teammate"] as const;

export type ScrapbookTag = { id: string; name: string };
export type ScrapbookEntry = TeamMember & { customName: string | null; notes?: string; ordinal: number; tagIds: string[] };
export type Scrapbook = { id: string; name: string; tags: ScrapbookTag[]; entries: ScrapbookEntry[]; groupOrder: string[]; pokemonOrderByGroup: Record<string, string[]> };
export type ScrapbookFinderState = { query: string; selectedTypes: string[]; typeMode: "or" | "and"; form: "all" | "regular" | "mega"; abilityId: string; knownMoveIds: string[]; moveInput: string; minimums: Stats; totalMinimum: number };
export type ScrapbookBookUi = { filtersOpen: boolean; expandedGroupIds: string[]; openEntryIds: string[]; visibleBattleCategories: string[]; finder: ScrapbookFinderState };
type PersistedState = { books: Scrapbook[]; activeBookId: string; lastAddBookId: string; uiByBook: Record<string, ScrapbookBookUi> };
type ScrapbookState = PersistedState & {
  hydrated: boolean;
  hydrationError: boolean;
  saveStatus: "saved" | "saving" | "error";
  retrySave: () => void;
  hydrate: () => Promise<void>;
  createBook: (name: string) => string;
  duplicateBook: (bookId: string, name: string) => string | null;
  renameBook: (bookId: string, name: string) => void;
  deleteBook: (bookId: string) => void;
  setActiveBook: (bookId: string) => void;
  markLastAddBook: (bookId: string) => void;
  updateBookUi: (bookId: string, patch: Partial<ScrapbookBookUi>) => void;
  createTag: (bookId: string, name: string) => string | null;
  renameTag: (bookId: string, tagId: string, name: string) => void;
  deleteTag: (bookId: string, tagId: string) => void;
  addPokemon: (bookId: string, pokemonId: string, tagIds: string[]) => string | null;
  updateEntry: (bookId: string, entryId: string, member: Omit<TeamMember, "id">) => void;
  updateNotes: (bookId: string, entryId: string, notes: string) => void;
  renameEntry: (bookId: string, entryId: string, name: string) => void;
  removeEntry: (bookId: string, entryId: string) => void;
  addEntryToTag: (bookId: string, entryId: string, tagId: string) => void;
  moveEntryToTag: (bookId: string, entryId: string, sourceGroupId: string, targetGroupId: string) => void;
  duplicateEntry: (bookId: string, entryId: string, targetGroupId: string) => string | null;
  moveGroup: (bookId: string, groupId: string, direction: -1 | 1) => void;
  movePokemon: (bookId: string, groupId: string, entryId: string, direction: -1 | 1) => void;
};

const createId = () => globalThis.crypto?.randomUUID?.() ?? `local-${Date.now()}-${Math.random().toString(36).slice(2)}`;
const cleanName = (value: unknown) => typeof value === "string" ? value.trim().slice(0, 60) : "";
const unique = (values: string[]) => [...new Set(values)];
const statKeys = ["hp", "attack", "defense", "specialAttack", "specialDefense", "speed"] as const;
export const defaultFinderState = (): ScrapbookFinderState => ({ query: "", selectedTypes: [], typeMode: "or", form: "all", abilityId: "", knownMoveIds: [], moveInput: "", minimums: { ...ZERO_STATS }, totalMinimum: 0 });
export const defaultBookUi = (): ScrapbookBookUi => ({ filtersOpen: false, expandedGroupIds: [], openEntryIds: [], visibleBattleCategories: [...SCRAPBOOK_BATTLE_CATEGORIES], finder: defaultFinderState() });

function cleanStats(value: unknown): Stats {
  const source = value && typeof value === "object" ? value as Partial<Record<keyof Stats, unknown>> : {};
  const stats = Object.fromEntries(statKeys.map((key) => [key, Math.min(32, Math.max(0, Number.isInteger(Number(source[key])) ? Number(source[key]) : 0))])) as Stats;
  return apTotal(stats) <= 66 ? stats : { ...ZERO_STATS };
}
function cleanMinimums(value: unknown): Stats {
  const source = value && typeof value === "object" ? value as Partial<Record<keyof Stats, unknown>> : {};
  return Object.fromEntries(statKeys.map((key) => [key, Math.min(255, Math.max(0, Number.isFinite(Number(source[key])) ? Math.round(Number(source[key])) : 0))])) as Stats;
}
function cleanNature(value: unknown): Nature { return NATURES.find((entry) => entry.name === (value as Partial<Nature> | null)?.name) ?? NEUTRAL_NATURE; }
function nextOrdinal(entries: ScrapbookEntry[], pokemonId: string) { return Math.max(0, ...entries.filter((entry) => entry.pokemonId === pokemonId).map((entry) => entry.ordinal)) + 1; }

function cleanMoveSlots(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  const seen = new Set<string>();
  return Array.from({ length: Math.min(value.length, 4) }, (_, slot) => {
    const id = value[slot];
    if (typeof id !== "string" || seen.has(id)) return "";
    seen.add(id);
    return id;
  });
}

function cleanBook(value: unknown, legacy: boolean): Scrapbook | null {
  if (!value || typeof value !== "object") return null;
  const raw = value as Partial<Scrapbook>;
  const name = cleanName(raw.name);
  if (!raw.id || typeof raw.id !== "string" || !name) return null;
  const tags = Array.isArray(raw.tags) ? raw.tags.flatMap((tag) => tag && typeof tag.id === "string" && cleanName(tag.name) ? [{ id: tag.id, name: cleanName(tag.name) }] : []).filter((tag, index, all) => all.findIndex((other) => other.id === tag.id) === index) : [];
  const tagSet = new Set(tags.map((tag) => tag.id));
  const counts = new Map<string, number>();
  const entries = (Array.isArray(raw.entries) ? raw.entries : []).flatMap((candidate, index) => {
    if (!candidate || typeof candidate !== "object" || typeof candidate.pokemonId !== "string") return [];
    const pokemon = { id: candidate.pokemonId };
    const ordinal = (counts.get(pokemon.id) ?? 0) + 1;
    counts.set(pokemon.id, ordinal);
    return [{
      id: typeof candidate.id === "string" && candidate.id ? candidate.id : `migrated-${raw.id}-${pokemon.id}-${index}`,
      pokemonId: pokemon.id,
      customName: cleanName(candidate.customName) || null,
      notes: typeof candidate.notes === "string" ? candidate.notes.slice(0, 2000) : "",
      ordinal: Number.isInteger(candidate.ordinal) && Number(candidate.ordinal) > 0 ? Number(candidate.ordinal) : ordinal,
      tagIds: Array.isArray(candidate.tagIds) ? unique(candidate.tagIds.filter((id): id is string => typeof id === "string" && tagSet.has(id))) : [],
      moveIds: cleanMoveSlots(candidate.moveIds),
      abilityId: typeof candidate.abilityId === "string" ? candidate.abilityId : null,
      itemId: typeof candidate.itemId === "string" ? candidate.itemId : null,
      ap: cleanStats(candidate.ap), nature: cleanNature(candidate.nature),
    } satisfies ScrapbookEntry];
  }).filter((entry, index, all) => all.findIndex((other) => other.id === entry.id) === index);
  const groups = [UNTAGGED_GROUP_ID, ...tags.map((tag) => tag.id)];
  const groupOrder = unique([...(Array.isArray(raw.groupOrder) ? raw.groupOrder.filter((id): id is string => typeof id === "string" && groups.includes(id)) : []), ...groups]);
  const pokemonOrderByGroup = Object.fromEntries(groups.map((groupId) => {
    const members = entries.filter((entry) => groupId === UNTAGGED_GROUP_ID ? !entry.tagIds.length : entry.tagIds.includes(groupId));
    const requested = raw.pokemonOrderByGroup?.[groupId] ?? [];
    const mapped = requested.flatMap((id) => {
      if (!legacy) return members.some((entry) => entry.id === id) ? [id] : [];
      const match = members.find((entry) => entry.pokemonId === id);
      return match ? [match.id] : [];
    });
    return [groupId, unique([...mapped, ...members.map((entry) => entry.id)])];
  }));
  return { id: raw.id, name, tags, entries, groupOrder, pokemonOrderByGroup };
}

function cleanUi(value: unknown, book: Scrapbook): ScrapbookBookUi {
  const raw = value && typeof value === "object" ? value as Partial<ScrapbookBookUi> : {};
  const finder = raw.finder && typeof raw.finder === "object" ? raw.finder as Partial<ScrapbookFinderState> : {};
  return {
    filtersOpen: Boolean(raw.filtersOpen),
    expandedGroupIds: Array.isArray(raw.expandedGroupIds) ? unique(raw.expandedGroupIds.filter((id) => book.groupOrder.includes(id))) : [],
    openEntryIds: Array.isArray(raw.openEntryIds) ? unique(raw.openEntryIds.filter((id) => book.entries.some((entry) => entry.id === id))) : [],
    visibleBattleCategories: Array.isArray(raw.visibleBattleCategories) ? unique(raw.visibleBattleCategories.filter((id) => SCRAPBOOK_BATTLE_CATEGORIES.includes(id as typeof SCRAPBOOK_BATTLE_CATEGORIES[number]))) : [...SCRAPBOOK_BATTLE_CATEGORIES],
    finder: {
      query: typeof finder.query === "string" ? finder.query.slice(0, 120) : "",
      selectedTypes: Array.isArray(finder.selectedTypes) ? unique(finder.selectedTypes.filter((id): id is string => typeof id === "string" && ALL_TYPES.includes(id as typeof ALL_TYPES[number]))) : [],
      typeMode: finder.typeMode === "and" ? "and" : "or",
      form: finder.form === "regular" || finder.form === "mega" ? finder.form : "all",
      abilityId: typeof finder.abilityId === "string" && getCatalog().abilityById.has(finder.abilityId) ? finder.abilityId : "",
      knownMoveIds: Array.isArray(finder.knownMoveIds) ? unique(finder.knownMoveIds.filter((id): id is string => typeof id === "string" && getCatalog().moveById.has(id))) : [],
      moveInput: typeof finder.moveInput === "string" ? finder.moveInput.slice(0, 120) : "",
      minimums: cleanMinimums(finder.minimums),
      totalMinimum: Math.min(1530, Math.max(0, Number.isFinite(Number(finder.totalMinimum)) ? Math.round(Number(finder.totalMinimum)) : 0)),
    },
  };
}

export function migrateSavedScrapbookState(saved: unknown): PersistedState {
  if (!saved || typeof saved !== "object") return { books: [], activeBookId: "", lastAddBookId: "", uiByBook: {} };
  const raw = saved as { version?: number; books?: unknown[]; activeBookId?: unknown; lastAddBookId?: unknown; uiByBook?: Record<string, unknown> };
  if (raw.version !== 1 && raw.version !== 2) return { books: [], activeBookId: "", lastAddBookId: "", uiByBook: {} };
  const books = (raw.books ?? []).map((book) => cleanBook(book, raw.version === 1)).filter((book): book is Scrapbook => Boolean(book));
  const valid = new Set(books.map((book) => book.id));
  const activeBookId = typeof raw.activeBookId === "string" && valid.has(raw.activeBookId) ? raw.activeBookId : books[0]?.id ?? "";
  const lastAddBookId = typeof raw.lastAddBookId === "string" && valid.has(raw.lastAddBookId) ? raw.lastAddBookId : activeBookId;
  return { books, activeBookId, lastAddBookId, uiByBook: Object.fromEntries(books.map((book) => [book.id, cleanUi(raw.uiByBook?.[book.id], book)])) };
}
export function migrateSavedScrapbooks(saved: unknown) { return migrateSavedScrapbookState(saved).books; }

let writeRevision = 0;
const persist = (state: PersistedState) => {
  const revision = ++writeRevision;
  useScrapbookStore.setState({saveStatus: "saving"});
  void (async () => {
    try {
      if (typeof indexedDB === "undefined") throw new Error("Storage unavailable");
      await setValue(STORAGE_KEY, {version: 2, ...state});
      if (revision === writeRevision) useScrapbookStore.setState({saveStatus: "saved"});
    } catch {
      if (revision === writeRevision) useScrapbookStore.setState({saveStatus: "error"});
    }
  })();
};
const moved = <T,>(values: T[], index: number, direction: -1 | 1) => { const target = index + direction; if (index < 0 || target < 0 || target >= values.length) return values; const next = [...values]; [next[index], next[target]] = [next[target], next[index]]; return next; };

export const useScrapbookStore = create<ScrapbookState>((set, getState) => {
  let hydration: Promise<void> | null = null;
  const update = (fn: (state: PersistedState) => PersistedState) => { const state = getState(); if (!state.hydrated) return; const next = fn({ books: state.books, activeBookId: state.activeBookId, lastAddBookId: state.lastAddBookId, uiByBook: state.uiByBook }); set(next); persist(next); };
  const updateBook = (bookId: string, fn: (book: Scrapbook) => Scrapbook) => update((state) => ({ ...state, books: state.books.map((book) => book.id === bookId ? fn(book) : book) }));
  return {
    books: [], activeBookId: "", lastAddBookId: "", uiByBook: {}, hydrated: false, hydrationError: false, saveStatus: "saved",
    retrySave: () => { const state = getState(); if (state.hydrated) persist({books: state.books, activeBookId: state.activeBookId, lastAddBookId: state.lastAddBookId, uiByBook: state.uiByBook}); },
    hydrate: () => {
      if (getState().hydrated) return Promise.resolve();
      if (hydration) return hydration;
      set({ hydrationError: false });
      hydration = Promise.resolve().then(() => get(STORAGE_KEY)).then((saved) => {
        const next = migrateSavedScrapbookState(saved);
        set({ ...next, hydrated: true, hydrationError: false });
        persist(next);
      }).catch(() => { set({ hydrationError: true }); }).finally(() => { hydration = null; });
      return hydration;
    },
    createBook: (name) => { if (!getState().hydrated) return ""; const id = createId(); const book: Scrapbook = { id, name: cleanName(name) || "Untitled", tags: [], entries: [], groupOrder: [UNTAGGED_GROUP_ID], pokemonOrderByGroup: { [UNTAGGED_GROUP_ID]: [] } }; update((state) => ({ ...state, books: [...state.books, book], activeBookId: id, uiByBook: { ...state.uiByBook, [id]: defaultBookUi() } })); return id; },
    duplicateBook: (bookId, name) => {
      if (!getState().hydrated) return null;
      const source = getState().books.find((book) => book.id === bookId); const clean = cleanName(name); if (!source || !clean) return null;
      const id = createId(); const tagMap = new Map(source.tags.map((tag) => [tag.id, createId()])); const entryMap = new Map(source.entries.map((entry) => [entry.id, createId()]));
      const book: Scrapbook = { id, name: clean, tags: source.tags.map((tag) => ({ id: tagMap.get(tag.id)!, name: tag.name })), entries: source.entries.map((entry) => ({ ...entry, id: entryMap.get(entry.id)!, tagIds: entry.tagIds.map((tagId) => tagMap.get(tagId)!), moveIds: [...entry.moveIds], ap: { ...entry.ap }, nature: { ...entry.nature } })), groupOrder: source.groupOrder.map((groupId) => groupId === UNTAGGED_GROUP_ID ? groupId : tagMap.get(groupId)!), pokemonOrderByGroup: Object.fromEntries(source.groupOrder.map((groupId) => [groupId === UNTAGGED_GROUP_ID ? groupId : tagMap.get(groupId)!, (source.pokemonOrderByGroup[groupId] ?? []).map((entryId) => entryMap.get(entryId)!)])) };
      const sourceUi = getState().uiByBook[bookId] ?? defaultBookUi(); const ui = cleanUi({ ...sourceUi, expandedGroupIds: sourceUi.expandedGroupIds.map((groupId) => groupId === UNTAGGED_GROUP_ID ? groupId : tagMap.get(groupId)!), openEntryIds: sourceUi.openEntryIds.map((entryId) => entryMap.get(entryId)!) }, book);
      update((state) => ({ ...state, books: [...state.books, book], activeBookId: id, uiByBook: { ...state.uiByBook, [id]: ui } })); return id;
    },
    renameBook: (bookId, name) => { const clean = cleanName(name); if (clean) updateBook(bookId, (book) => ({ ...book, name: clean })); },
    deleteBook: (bookId) => update((state) => { const books = state.books.filter((book) => book.id !== bookId); const uiByBook = { ...state.uiByBook }; delete uiByBook[bookId]; return { books, uiByBook, activeBookId: state.activeBookId === bookId ? books[0]?.id ?? "" : state.activeBookId, lastAddBookId: state.lastAddBookId === bookId ? books[0]?.id ?? "" : state.lastAddBookId }; }),
    setActiveBook: (bookId) => { if (getState().books.some((book) => book.id === bookId)) update((state) => ({ ...state, activeBookId: bookId })); },
    markLastAddBook: (bookId) => update((state) => ({ ...state, lastAddBookId: state.books.some((book) => book.id === bookId) ? bookId : state.lastAddBookId })),
    updateBookUi: (bookId, patch) => update((state) => { const book = state.books.find((entry) => entry.id === bookId); if (!book) return state; const previous = state.uiByBook[bookId] ?? defaultBookUi(); return { ...state, uiByBook: { ...state.uiByBook, [bookId]: cleanUi({ ...previous, ...patch, finder: patch.finder ? { ...previous.finder, ...patch.finder } : previous.finder }, book) } }; }),
    createTag: (bookId, name) => { if (!getState().hydrated) return null; const book = getState().books.find((entry) => entry.id === bookId); const clean = cleanName(name); if (!book || !clean) return null; const existing = book.tags.find((tag) => tag.name.toLocaleLowerCase() === clean.toLocaleLowerCase()); if (existing) return existing.id; const id = createId(); updateBook(bookId, (entry) => ({ ...entry, tags: [...entry.tags, { id, name: clean }], groupOrder: [...entry.groupOrder, id], pokemonOrderByGroup: { ...entry.pokemonOrderByGroup, [id]: [] } })); return id; },
    renameTag: (bookId, tagId, name) => { const clean = cleanName(name); if (clean) updateBook(bookId, (book) => ({ ...book, tags: book.tags.map((tag) => tag.id === tagId ? { ...tag, name: clean } : tag) })); },
    deleteTag: (bookId, tagId) => update((state) => ({ ...state, books: state.books.map((book) => { if (book.id !== bookId) return book; const entries = book.entries.map((entry) => ({ ...entry, tagIds: entry.tagIds.filter((id) => id !== tagId) })); const orders = { ...book.pokemonOrderByGroup }; delete orders[tagId]; orders[UNTAGGED_GROUP_ID] = unique([...(orders[UNTAGGED_GROUP_ID] ?? []), ...entries.filter((entry) => !entry.tagIds.length).map((entry) => entry.id)]); return { ...book, tags: book.tags.filter((tag) => tag.id !== tagId), entries, groupOrder: book.groupOrder.filter((id) => id !== tagId), pokemonOrderByGroup: orders }; }), uiByBook: { ...state.uiByBook, [bookId]: { ...(state.uiByBook[bookId] ?? defaultBookUi()), expandedGroupIds: (state.uiByBook[bookId]?.expandedGroupIds ?? []).filter((id) => id !== tagId) } } })),
    addPokemon: (bookId, pokemonId, tagIds) => { if (!getState().hydrated) return null; const book = getState().books.find((entry) => entry.id === bookId); if (!book || !getCatalog().pokemonById.has(pokemonId)) return null; const id = createId(); const valid = new Set(book.tags.map((tag) => tag.id)); const tags = unique(tagIds.filter((tagId) => valid.has(tagId))); const entry: ScrapbookEntry = { id, pokemonId, customName: null, ordinal: nextOrdinal(book.entries, pokemonId), tagIds: tags, moveIds: [], abilityId: null, itemId: null, ap: { ...ZERO_STATS }, nature: NEUTRAL_NATURE }; updateBook(bookId, (current) => { const orders = { ...current.pokemonOrderByGroup }; for (const groupId of tags.length ? tags : [UNTAGGED_GROUP_ID]) orders[groupId] = unique([...(orders[groupId] ?? []), id]); return { ...current, entries: [...current.entries, entry], pokemonOrderByGroup: orders }; }); return id; },
    updateEntry: (bookId, entryId, member) => updateBook(bookId, (book) => ({ ...book, entries: book.entries.map((entry) => entry.id === entryId ? { ...entry, ...member, id: entry.id, customName: entry.customName, notes: entry.notes, ordinal: entry.ordinal, tagIds: entry.tagIds, moveIds: [...member.moveIds], ap: { ...member.ap }, nature: { ...member.nature } } : entry) })),
    updateNotes: (bookId, entryId, notes) => updateBook(bookId, (book) => ({ ...book, entries: book.entries.map((entry) => entry.id === entryId ? { ...entry, notes: notes.slice(0, 2000) } : entry) })),
    renameEntry: (bookId, entryId, name) => updateBook(bookId, (book) => ({ ...book, entries: book.entries.map((entry) => entry.id === entryId ? { ...entry, customName: cleanName(name) || null } : entry) })),
    removeEntry: (bookId, entryId) => update((state) => ({ ...state, books: state.books.map((book) => book.id === bookId ? { ...book, entries: book.entries.filter((entry) => entry.id !== entryId), pokemonOrderByGroup: Object.fromEntries(Object.entries(book.pokemonOrderByGroup).map(([groupId, ids]) => [groupId, ids.filter((id) => id !== entryId)])) } : book), uiByBook: { ...state.uiByBook, [bookId]: { ...(state.uiByBook[bookId] ?? defaultBookUi()), openEntryIds: (state.uiByBook[bookId]?.openEntryIds ?? []).filter((id) => id !== entryId) } } })),
    addEntryToTag: (bookId, entryId, tagId) => updateBook(bookId, (book) => book.tags.some((tag) => tag.id === tagId) ? { ...book, entries: book.entries.map((entry) => entry.id === entryId ? { ...entry, tagIds: unique([...entry.tagIds, tagId]) } : entry), pokemonOrderByGroup: { ...book.pokemonOrderByGroup, [tagId]: unique([...(book.pokemonOrderByGroup[tagId] ?? []), entryId]), [UNTAGGED_GROUP_ID]: (book.pokemonOrderByGroup[UNTAGGED_GROUP_ID] ?? []).filter((id) => id !== entryId) } } : book),
    moveEntryToTag: (bookId, entryId, sourceGroupId, targetGroupId) => updateBook(bookId, (book) => { if (sourceGroupId === targetGroupId) return book; const entries = book.entries.map((entry) => entry.id !== entryId ? entry : { ...entry, tagIds: targetGroupId === UNTAGGED_GROUP_ID ? [] : unique([...(sourceGroupId === UNTAGGED_GROUP_ID ? entry.tagIds : entry.tagIds.filter((id) => id !== sourceGroupId)), targetGroupId]) }); const orders = { ...book.pokemonOrderByGroup, [sourceGroupId]: (book.pokemonOrderByGroup[sourceGroupId] ?? []).filter((id) => id !== entryId), [targetGroupId]: unique([...(book.pokemonOrderByGroup[targetGroupId] ?? []), entryId]) }; if (targetGroupId !== UNTAGGED_GROUP_ID) orders[UNTAGGED_GROUP_ID] = (orders[UNTAGGED_GROUP_ID] ?? []).filter((id) => id !== entryId); return { ...book, entries, pokemonOrderByGroup: orders }; }),
    duplicateEntry: (bookId, entryId, targetGroupId) => { if (!getState().hydrated) return null; const book = getState().books.find((entry) => entry.id === bookId); const source = book?.entries.find((entry) => entry.id === entryId); if (!book || !source || (targetGroupId !== UNTAGGED_GROUP_ID && !book.tags.some((tag) => tag.id === targetGroupId))) return null; const id = createId(); const clone: ScrapbookEntry = { ...source, id, customName: null, ordinal: nextOrdinal(book.entries, source.pokemonId), tagIds: targetGroupId === UNTAGGED_GROUP_ID ? [] : [targetGroupId], moveIds: [...source.moveIds], ap: { ...source.ap }, nature: { ...source.nature } }; updateBook(bookId, (current) => ({ ...current, entries: [...current.entries, clone], pokemonOrderByGroup: { ...current.pokemonOrderByGroup, [targetGroupId]: unique([...(current.pokemonOrderByGroup[targetGroupId] ?? []), id]) } })); return id; },
    moveGroup: (bookId, groupId, direction) => updateBook(bookId, (book) => ({ ...book, groupOrder: moved(book.groupOrder, book.groupOrder.indexOf(groupId), direction) })),
    movePokemon: (bookId, groupId, entryId, direction) => updateBook(bookId, (book) => ({ ...book, pokemonOrderByGroup: { ...book.pokemonOrderByGroup, [groupId]: moved(book.pokemonOrderByGroup[groupId] ?? [], (book.pokemonOrderByGroup[groupId] ?? []).indexOf(entryId), direction) } })),
  };
});
