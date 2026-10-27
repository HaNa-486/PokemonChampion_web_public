"use client";

import { useState } from "react";
import { getCatalog } from "../lib/catalog";
import { calculateFinalStats, NEUTRAL_NATURE, ZERO_STATS } from "../lib/domain";
import type { ScrapbookEntry } from "../lib/scrapbook-store";
import { ALL_TYPES, typeEffectiveness } from "../lib/type-chart";
import { localizedTerm } from "../lib/localization";
import type { PokemonType } from "../lib/types";

const typeMultiplier = (attacking: PokemonType, defending: PokemonType[]) => defending.reduce((value, type) => value * typeEffectiveness(attacking, type), 1);

export function BuildComparison({ entries, locale }: { entries: ScrapbookEntry[]; locale: "en" | "zh-Hant" }) {
  const [differencesOnly, setDifferencesOnly] = useState(false);
  const [neutral, setNeutral] = useState(false);
  const zh = locale === "zh-Hant";
  const name = (value: {name: string; nameZh: string} | undefined) => value ? zh ? value.nameZh : value.name : "—";
  const stats = entries.map((entry) => calculateFinalStats(getCatalog().pokemonById.get(entry.pokemonId)!.baseStats, neutral ? ZERO_STATS : entry.ap, neutral ? NEUTRAL_NATURE : entry.nature));
  const rows: {label: string; values: string[]}[] = [
    {label: zh ? "配置筆記" : "Build notes", values: entries.map((entry) => entry.notes || "—")},
    ...(["hp", "attack", "defense", "specialAttack", "specialDefense", "speed"] as const).map((key, index) => ({ label: (zh ? ["HP", "攻擊", "防禦", "特攻", "特防", "速度"] : ["HP", "Atk", "Def", "SpA", "SpD", "Spe"])[index], values: stats.map((value) => String(value[key])) })),
    {label: zh ? "AP" : "AP", values: entries.map((entry) => (["hp", "attack", "defense", "specialAttack", "specialDefense", "speed"] as const).map(key => (neutral ? ZERO_STATS : entry.ap)[key]).join(" / "))},
    {label: zh ? "性格" : "Nature", values: entries.map((entry) => neutral ? zh ? "認真" : "Serious" : zh ? entry.nature.nameZh ?? entry.nature.name : entry.nature.name)},
    {label: zh ? "特性" : "Ability", values: entries.map((entry) => name(getCatalog().abilityById.get(entry.abilityId ?? "")))},
    {label: zh ? "持有物" : "Held item", values: entries.map((entry) => name(getCatalog().itemById.get(entry.itemId ?? "")))},
    ...[0,1,2,3].map((slot) => ({label: `${zh ? "招式" : "Move"} ${slot+1}`, values: entries.map((entry) => name(getCatalog().moveById.get(entry.moveIds[slot])))})),
    ...ALL_TYPES.filter((type) => entries.some((entry) => typeMultiplier(type, getCatalog().pokemonById.get(entry.pokemonId)!.types) !== 1)).map((type) => ({label: localizedTerm(type, locale), values: entries.map((entry) => `${typeMultiplier(type, getCatalog().pokemonById.get(entry.pokemonId)!.types)}×`)})),
  ];
  const visibleRows = rows.filter((row) => !differencesOnly || new Set(row.values).size > 1);
  return <section className="build-comparison" aria-label={zh ? "配置差異比較" : "Build comparison"}>
    <header><h2>{zh ? "配置差異比較" : "Compare builds"}</h2><label><input type="checkbox" checked={differencesOnly} onChange={(event) => setDifferencesOnly(event.target.checked)} />{zh ? "只看差異" : "Differences only"}</label><label><input type="checkbox" checked={neutral} onChange={(event) => setNeutral(event.target.checked)} />{zh ? "零 AP／中性性格基準" : "Zero AP / neutral nature baseline"}</label></header>
    <p>{zh ? "相性僅依屬性計算。AP 順序：HP／攻擊／防禦／特攻／特防／速度。" : "Type-only matchups. AP order: HP / Atk / Def / SpA / SpD / Spe."}</p>
    <div className="table-scroll"><table><thead><tr><th>{zh ? "欄位" : "Field"}</th>{entries.map((entry) => <th key={entry.id}>{name(getCatalog().pokemonById.get(entry.pokemonId))}<small>{entry.customName || `${zh ? "配置" : "Config"} ${entry.ordinal}`}</small></th>)}</tr></thead><tbody>{visibleRows.map((row) => <tr key={row.label} className={new Set(row.values).size > 1 ? "comparison-difference" : ""}><th>{row.label}</th>{row.values.map((value,index) => <td key={entries[index].id}>{value}</td>)}</tr>)}</tbody></table></div>
    {!visibleRows.length && <p role="status">{zh ? "這些配置沒有差異。" : "These builds have no differences."}</p>}
  </section>;
}
