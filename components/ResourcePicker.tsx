"use client";
import { useId, useRef, useState, useEffect, type ReactNode } from "react";
import { localizedTerm } from "../lib/localization";
type Locale = "en" | "zh-Hant";
export type ResourcePickerOption = {
  id: string;
  name: string;
  searchText: string;
  description: string;
  meta?: ReactNode;
  icon?: ReactNode;
  group?: string;
  rank?: number;
};

export function ResourcePicker({ label, value, options, locale, detailed, allowClear = true, startAtFirstOption = false, onChange }: {
  label: string;
  value: string | null;
  options: ResourcePickerOption[];
  locale: Locale;
  detailed: boolean;
  allowClear?: boolean;
  startAtFirstOption?: boolean;
  onChange: (value: string | null) => void;
}) {
  const listId = useId();
  const inputRef = useRef<HTMLInputElement>(null);
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [activeValue, setActiveValue] = useState(value ?? "__clear__");
  const current = options.find((option) => option.id === value) ?? null;
  const normalizedQuery = query.trim().toLocaleLowerCase(locale);
  const filtered = normalizedQuery ? options.filter((option) => option.searchText.toLocaleLowerCase(locale).includes(normalizedQuery)) : options;
  const navigableValues = [...(allowClear ? ["__clear__"] : []), ...filtered.map((option) => option.id)];
  const active = navigableValues.includes(activeValue) ? activeValue : normalizedQuery ? filtered[0]?.id : navigableValues[0];
  const close = () => { setOpen(false); setQuery(""); };
  const openMenu = () => { setOpen(true); setActiveValue(!startAtFirstOption && value && navigableValues.includes(value) ? value : navigableValues[0] ?? "__clear__"); };
  const choose = (nextValue: string | null) => { onChange(nextValue); close(); queueMicrotask(() => inputRef.current?.focus()); };
  const moveActive = (direction: 1 | -1) => {
    const currentIndex = navigableValues.indexOf(active ?? "");
    const startIndex = currentIndex < 0 ? (direction > 0 ? -1 : 0) : currentIndex;
    setActiveValue(navigableValues[(startIndex + direction + navigableValues.length) % navigableValues.length] ?? "__clear__");
  };
  useEffect(() => {
    if (!open) return;
    const activeOption = document.getElementById(`${listId}-option-${active}`);
    if (activeOption && typeof activeOption.scrollIntoView === "function") activeOption.scrollIntoView({ block: "nearest" });
  }, [active, listId, open]);
  return <div className="resource-picker-field" onBlur={(event) => { if (!event.currentTarget.contains(event.relatedTarget as Node | null)) close(); }}>
    <label htmlFor={`${listId}-input`}>{label}</label>
    <div className={`resource-combobox ${open ? "open" : ""}`}>
      {!open && current?.icon}
      <input id={`${listId}-input`} ref={inputRef} role="combobox" aria-label={label} aria-expanded={open} aria-controls={listId} aria-activedescendant={open && active ? `${listId}-option-${active}` : undefined} aria-autocomplete="list" autoComplete="off" value={open ? query : current?.name ?? (value ? `${locale === "zh-Hant" ? "待修正" : "Unavailable"}: ${value}` : "")} placeholder={locale === "zh-Hant" ? "輸入名稱或效果搜尋…" : "Search name or effect…"} onClick={() => { if (!open) { openMenu(); setQuery(""); } }} onFocus={() => { openMenu(); setQuery(""); }} onChange={(event) => { setOpen(true); setQuery(event.target.value); setActiveValue(""); }} onKeyDown={(event) => {
        if (event.key === "Escape" && open) { event.preventDefault(); close(); }
        else if (event.key === "ArrowDown") { event.preventDefault(); if (open) moveActive(1); else openMenu(); }
        else if (event.key === "ArrowUp") { event.preventDefault(); if (open) moveActive(-1); else openMenu(); }
        else if (event.key === "Home" && open) { event.preventDefault(); setActiveValue(navigableValues[0] ?? "__clear__"); }
        else if (event.key === "End" && open) { event.preventDefault(); setActiveValue(navigableValues.at(-1) ?? "__clear__"); }
        else if (event.key === "Enter" && open) { event.preventDefault(); if (active) choose(active === "__clear__" ? null : active); }
      }} />
      <button type="button" className="move-picker-toggle" aria-label={locale === "zh-Hant" ? `開啟${label}選單` : `Open ${label} menu`} onClick={() => { if (open) close(); else openMenu(); inputRef.current?.focus(); }}>⌄</button>
    </div>
    {open && <div className="resource-picker-popover"><div id={listId} role="listbox" aria-label={`${label} options`} className="resource-picker-options">
      {allowClear && <button id={`${listId}-option-__clear__`} type="button" role="option" aria-selected={!value} className={`resource-option clear-option ${active === "__clear__" ? "active" : ""}`} onMouseEnter={() => setActiveValue("__clear__")} onMouseDown={(event) => event.preventDefault()} onClick={() => choose(null)}>{locale === "zh-Hant" ? "— 不選擇" : "— None"}</button>}
      {filtered.map((option, index) => {
        const showGroup = Boolean(option.group && option.group !== filtered[index - 1]?.group);
        return <div className="resource-option-wrap" key={option.id}>{showGroup && <div className="resource-option-group">{option.group === "Common" ? (locale === "zh-Hant" ? "DEMO 範例前十" : "DEMO top 10") : localizedTerm(option.group!, locale)}</div>}<button id={`${listId}-option-${option.id}`} type="button" role="option" aria-selected={option.id === value} className={`resource-option ${active === option.id ? "active" : ""}`} onMouseEnter={() => setActiveValue(option.id)} onMouseDown={(event) => event.preventDefault()} onClick={() => choose(option.id)}><span className="resource-option-heading">{option.icon}<strong>{option.name}</strong>{option.rank && <em>{locale === "zh-Hant" ? `DEMO #${option.rank}` : `DEMO #${option.rank}`}</em>}</span>{option.meta && <span className="resource-option-meta">{option.meta}</span>}{detailed && <span className="resource-option-description">{option.description}</span>}</button></div>;
      })}
      {!filtered.length && <p className="move-picker-empty">{locale === "zh-Hant" ? "找不到符合的選項。" : "No matching option."}</p>}
    </div></div>}
  </div>;
}
