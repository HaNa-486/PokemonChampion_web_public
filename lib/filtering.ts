import type { Ability, HeldItem } from "./types";

export type SortDirection = "asc" | "desc";

export function compareValues(left: unknown, right: unknown, direction: SortDirection) {
  const multiplier = direction === "asc" ? 1 : -1;
  if (typeof left === "number" && typeof right === "number") return (left - right) * multiplier;
  return String(left ?? "").localeCompare(String(right ?? ""), "en", { numeric: true, sensitivity: "base" }) * multiplier;
}

export function abilityCategories(ability: Ability) {
  const text = `${ability.name} ${ability.description}`.toLowerCase();
  const categories = new Set<string>();
  if (/weather|sun|rain|snow|sandstorm|hail/.test(text)) categories.add("Weather");
  if (/terrain/.test(text)) categories.add("Terrain");
  if (/speed|priority|go first|go last/.test(text)) categories.add("Speed");
  if (/raise|lower|stat|stage|boost/.test(text)) categories.add("Stat Changes");
  if (/status|burn|poison|paraly|sleep|freeze|confus|flinch|infatuat/.test(text)) categories.add("Status");
  if (/contact/.test(text)) categories.add("Contact");
  if (/switch|entry hazard|hazard/.test(text)) categories.add("Switch / Hazard");
  if (/item|berry/.test(text)) categories.add("Item / Berry");
  if (/ability|move/.test(text)) categories.add("Ability / Move");
  if (/type|fire-|water-|grass-|electric-|ice-|fighting-|psychic-|dark-|fairy-/.test(text)) categories.add("Type");
  if (/damage|defen|protect|prevent|immune|resist|takes/.test(text)) categories.add("Defense");
  if (/power|attack|damage dealt|critical hit/.test(text)) categories.add("Offense");
  if (categories.size === 0) categories.add("Other");
  return [...categories];
}

export function itemEffectCategories(item: HeldItem) {
  const text = item.description.toLowerCase();
  const categories: string[] = [];
  if (/restore|recover|regain|heal/.test(text) && /hp|health/.test(text)) categories.push("HP Recovery");
  if (/status condition|burn|poison|paraly|sleep|freeze|confus/.test(text) && /cure|heal|remove|recover/.test(text)) categories.push("Status Cure");
  if (/pp/.test(text) && /restore|recover/.test(text)) categories.push("PP Recovery");
  if (/halve|half the damage|reduces? the damage|damage taken/.test(text)) categories.push("Damage Halving");
  if (categories.length === 0) categories.push("Other");
  return categories;
}
