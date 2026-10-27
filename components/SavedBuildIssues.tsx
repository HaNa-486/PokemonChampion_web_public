"use client";
import { getCatalog } from "../lib/catalog";
import { validateTeam } from "../lib/domain";
import type { TeamMember } from "../lib/types";

/** Stored choices remain visible until the owner explicitly repairs them. */
export function SavedBuildIssues({ member, locale, onReplace }: { member: TeamMember; locale: "en" | "zh-Hant"; onReplace: (pokemonId: string) => void }) {
  const issues = validateTeam([{ ...member, moveIds: member.moveIds.filter(Boolean) }], getCatalog().pokemonById, new Set(getCatalog().itemById.keys()), getCatalog().megaStoneIdByPokemonId);
  if (!issues.length) return null;
  const zh = locale === "zh-Hant";
  return <div className="saved-build-issues" role="alert"><strong>{zh ? "舊配置需要確認，原選擇已保留" : "Saved choices retained; review required"}</strong><ul>{issues.map((issue, index) => <li key={index}>{zh ? ({ POKEMON_UNAVAILABLE: "寶可夢不符合已發布賽制", ITEM_UNAVAILABLE: "持有物已不適用", MOVE_NOT_LEARNABLE: "包含目前無法學習的招式", ABILITY_UNAVAILABLE: "特性已不適用", MEGA_STONE_REQUIRED: "需要對應的超級石" } as Record<string,string>)[issue.code] ?? issue.message : issue.message}</li>)}</ul><small>{member.pokemonId} · {member.abilityId} · {member.itemId} · {member.moveIds.filter(Boolean).join(" / ")}</small>{issues.some(i => i.code === "POKEMON_UNAVAILABLE") && <label>{zh ? "選擇替代寶可夢（保留其他配置供修正）" : "Replace Pokémon; retain other choices for repair"}<select value="" onChange={e => { if (e.target.value) onReplace(e.target.value); }}><option value="">{zh ? "選擇…" : "Choose…"}</option>{getCatalog().pokemon.map(p => <option key={p.id} value={p.id}>{zh ? p.nameZh : p.name}</option>)}</select></label>}</div>;
}
