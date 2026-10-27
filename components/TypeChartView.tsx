"use client";

import { useEffect, useState } from "react";
import Link from "../components/DocumentLink";
import { ALL_TYPES, typeEffectiveness } from "../lib/type-chart";
import type { PokemonType } from "../lib/types";
import { TypeBadge } from "./TypeBadge";
import { ThemeToggle, useThemePreference } from "./ThemeToggle";

type Locale = "en" | "zh-Hant";

const TYPE_NAMES_ZH: Record<PokemonType, string> = {
  Normal: "一般", Fire: "火", Water: "水", Electric: "電", Grass: "草", Ice: "冰",
  Fighting: "格鬥", Poison: "毒", Ground: "地面", Flying: "飛行", Psychic: "超能力",
  Bug: "蟲", Rock: "岩石", Ghost: "幽靈", Dragon: "龍", Dark: "惡", Steel: "鋼", Fairy: "妖精",
};

const TYPE_CODES: Record<PokemonType, string> = {
  Normal: "N", Fire: "F", Water: "W", Electric: "E", Grass: "Gr", Ice: "I",
  Fighting: "Ft", Poison: "P", Ground: "Gd", Flying: "Fl", Psychic: "Ps",
  Bug: "B", Rock: "R", Ghost: "Gh", Dragon: "Dr", Dark: "Dk", Steel: "S", Fairy: "Fa",
};

const TYPE_CODES_ZH: Record<PokemonType, string> = {
  Normal: "普", Fire: "火", Water: "水", Electric: "電", Grass: "草", Ice: "冰",
  Fighting: "鬥", Poison: "毒", Ground: "地", Flying: "飛", Psychic: "超",
  Bug: "蟲", Rock: "岩", Ghost: "靈", Dragon: "龍", Dark: "惡", Steel: "鋼", Fairy: "妖",
};

const cellText = (value: number) => value === 2 ? "2×" : value === .5 ? "½×" : value === 0 ? "0×" : "—";
const typeName = (type: PokemonType, locale: Locale) => locale === "zh-Hant" ? TYPE_NAMES_ZH[type] : type;
const typeCode = (type: PokemonType, locale: Locale) => locale === "zh-Hant" ? TYPE_CODES_ZH[type] : TYPE_CODES[type];

function ChartTypeLabel({ type, locale, direction }: { type: PokemonType; locale: Locale; direction: "attack" | "defend" }) {
  return <div className={`chart-${direction}er-label`} aria-label={typeName(type, locale)}>
    <span className="chart-type-full" aria-hidden="true"><TypeBadge type={type} /></span>
    <span className={`chart-type-short type-${type.toLowerCase()}`} aria-hidden="true">{typeCode(type, locale)}</span>
    {locale === "zh-Hant" && <span className="chart-type-localized" aria-hidden="true">{typeName(type, locale)}</span>}
  </div>;
}

export function TypeChart({ locale }: { locale: Locale }) {
  const copy = locale === "zh-Hant"
    ? { eyebrow: "屬性指南", title: "屬性相剋表", intro: "左側為攻擊招式屬性，上方為防守方屬性。雙屬性寶可夢需將兩個倍率相乘。", attack: "攻擊 ↓ / 防守 →", strong: "效果絕佳", resist: "效果不好", immune: "沒有效果", neutral: "一般傷害" }
    : { eyebrow: "TYPE GUIDE", title: "Type Matchup Chart", intro: "Attack types run down the left; defending types run across the top. Multiply both values for a dual-type Pokémon.", attack: "Attack ↓ / Defend →", strong: "Super effective", resist: "Not very effective", immune: "No effect", neutral: "Neutral damage" };

  return <section className="panel type-chart-page">
    <div className="type-chart-head">
      <div><p className="eyebrow">{copy.eyebrow}</p><h1>{copy.title}</h1><p>{copy.intro}</p></div>
    </div>
    <div className="type-chart-legend" aria-label="Effectiveness legend">
      <span className="chart-effect effect-super"><b>2×</b> {copy.strong}</span>
      <span className="chart-effect effect-resist"><b>½×</b> {copy.resist}</span>
      <span className="chart-effect effect-immune"><b>0×</b> {copy.immune}</span>
      <span className="chart-effect effect-neutral"><b>—</b> {copy.neutral}</span>
    </div>
    <div className="type-chart-scroll" tabIndex={0} aria-label={copy.title}>
      <table className="type-chart-table">
        <colgroup><col className="chart-axis-column" />{ALL_TYPES.map((type) => <col key={type} />)}</colgroup>
        <thead><tr><th className="chart-axis"><span className="chart-axis-full">{copy.attack}</span><span className="chart-axis-short" aria-hidden="true">{locale === "zh-Hant" ? "攻／防" : "A/D"}</span></th>{ALL_TYPES.map((type) => <th key={type} title={typeName(type, locale)}><ChartTypeLabel type={type} locale={locale} direction="defend" /></th>)}</tr></thead>
        <tbody>{ALL_TYPES.map((attacking) => <tr key={attacking}><th title={typeName(attacking, locale)}><ChartTypeLabel type={attacking} locale={locale} direction="attack" /></th>{ALL_TYPES.map((defending) => { const value = typeEffectiveness(attacking, defending); const className = value === 2 ? "effect-super" : value === .5 ? "effect-resist" : value === 0 ? "effect-immune" : "effect-neutral"; return <td className={className} key={defending} title={`${typeName(attacking, locale)} → ${typeName(defending, locale)}: ${value}×`}>{cellText(value)}</td>; })}</tr>)}</tbody>
      </table>
    </div>
  </section>;
}

export function TypeChartPageShell() {
  const { theme, setTheme } = useThemePreference();
  const [locale, setLocaleState] = useState<Locale>("en");
  const setLocale = (value: Locale | ((current: Locale) => Locale)) => setLocaleState((current) => {
    const next = typeof value === "function" ? value(current) : value;
    localStorage.setItem("champions-demo-locale-v1", next);
    return next;
  });
  useEffect(() => {
    const saved = localStorage.getItem("champions-demo-locale-v1");
    // Browser language and localStorage are unavailable during server rendering.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setLocale(saved === "en" || saved === "zh-Hant" ? saved : navigator.languages.some((language) => language.toLowerCase().startsWith("zh")) ? "zh-Hant" : "en");
  }, []);
  useEffect(() => {
    const root = document.documentElement;
    if (root.hasAttribute("data-locale-pending") && root.dataset.locale !== locale) return;
    root.dataset.locale = locale;
    root.lang = locale;
    delete root.dataset.localePending;
  }, [locale]);
  return <main className="standalone-type-chart"><div className="standalone-chart-actions"><Link className="back-to-app" href="./">← Champions Lab</Link><div className="standalone-preferences"><ThemeToggle theme={theme} locale={locale} onChange={setTheme} /><button className="locale-button" onClick={() => setLocale((value) => value === "en" ? "zh-Hant" : "en")}>{locale === "en" ? "繁中" : "EN"}</button></div></div><TypeChart locale={locale} /></main>;
}
