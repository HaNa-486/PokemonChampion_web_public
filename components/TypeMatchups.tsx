"use client";

import { defensiveMatchups, formatMultiplier, type TypeMatchup } from "../lib/type-chart";
import type { PokemonType } from "../lib/types";
import { TypeBadge } from "./TypeBadge";

type Locale = "en" | "zh-Hant";

function MatchupValues({ values, locale }: { values: TypeMatchup[]; locale: Locale }) {
  return <div>{values.length ? values.map((entry) => <span className="matchup-badge" key={entry.type}><TypeBadge type={entry.type} locale={locale} /><b>{formatMultiplier(entry.multiplier)}</b></span>) : <span className="matchup-none">—</span>}</div>;
}

export function TypeMatchups({ types, locale, compact = false }: { types: PokemonType[]; locale: Locale; compact?: boolean }) {
  const matchups = defensiveMatchups(types);
  const labels = locale === "zh-Hant" ? { title: "防禦屬性相性", weak: "弱點", resist: "抗性", immune: "免疫", note: "僅依屬性計算；特性造成的免疫或倍率不包含在內。" } : { title: "Defensive type matchups", weak: "Weak", resist: "Resists", immune: "Immune", note: "Calculated from typing only; Ability-based immunities and modifiers are not included." };
  return <section className={compact ? "type-matchups compact-matchups" : "type-matchups"}>{!compact && <><h3>{labels.title}</h3><p>{labels.note}</p></>}<div className="matchup-group weak-matchups"><strong>{labels.weak}</strong><MatchupValues values={matchups.weak} locale={locale} /></div><div className="matchup-group resist-matchups"><strong>{labels.resist}</strong><MatchupValues values={matchups.resistant} locale={locale} /></div><div className="matchup-group immune-matchups"><strong>{labels.immune}</strong><MatchupValues values={matchups.immune} locale={locale} /></div></section>;
}
