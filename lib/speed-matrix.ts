import { calculateFinalStats } from "./domain";
import type { Pokemon, TeamMember } from "./types";

export type SpeedCondition = { stage: number; status: "none" | "paralysis" | "other"; abilityEnabled: boolean; itemEnabled: boolean; unburden: boolean };
export type SpeedScenario = { ownTailwind: boolean; enemyTailwind: boolean; trickRoom: boolean; weather: "none" | "sun" | "rain" | "sand" | "snow"; electricTerrain: boolean; attackingMoves: boolean };
export const DEFAULT_CONDITION: SpeedCondition = { stage: 0, status: "none", abilityEnabled: true, itemEnabled: true, unburden: false };
export const DEFAULT_SCENARIO: SpeedScenario = { ownTailwind: false, enemyTailwind: false, trickRoom: false, weather: "none", electricTerrain: false, attackingMoves: true };
export type SpeedResult = { base: number; staged: number; speed: number; factors: string[]; randomOrder: boolean; stall: boolean };
export type SpeedOrder = "first" | "last" | "tie" | "conditional";

/** Champions rules pinned to Showdown 4f3615ac: stage floor, chained modifiers,
 * half-down rounding, then paralysis. Champions removes Trick Room underflow. */
export function effectiveSpeed(pokemon: Pokemon, member: TeamMember, condition: SpeedCondition, scenario: SpeedScenario, side: "own" | "enemy"): SpeedResult {
  const base = calculateFinalStats(pokemon.baseStats, member.ap, member.nature).speed;
  const stage = Math.max(-6, Math.min(6, Math.trunc(condition.stage)));
  const staged = Math.floor(base * (stage >= 0 ? (2 + stage) / 2 : 2 / (2 - stage)));
  const ability = condition.abilityEnabled ? member.abilityId : null;
  const item = condition.itemEnabled ? member.itemId : null;
  const factors: string[] = [];
  let modifier = 4096;
  const apply = (factor: number, reason: string) => { modifier = Math.floor((modifier * factor * 4096 + 2048) / 4096); factors.push(reason); };
  const weatherBoost = (ability === "swift-swim" && scenario.weather === "rain" && item !== "utility-umbrella") || (ability === "chlorophyll" && scenario.weather === "sun" && item !== "utility-umbrella") || (ability === "sand-rush" && scenario.weather === "sand") || (ability === "slush-rush" && scenario.weather === "snow");
  if (weatherBoost || (ability === "surge-surfer" && scenario.electricTerrain)) apply(2, `${ability} ×2`);
  if (ability === "unburden" && condition.unburden && !member.itemId) apply(2, "unburden ×2");
  if (ability === "quick-feet" && condition.status !== "none") apply(1.5, "quick-feet ×1.5");
  if (item === "choice-scarf") apply(1.5, "choice-scarf ×1.5");
  if (item === "iron-ball") apply(0.5, "iron-ball ×0.5");
  if (side === "own" ? scenario.ownTailwind : scenario.enemyTailwind) apply(2, "tailwind ×2");
  let speed = Math.floor((staged * modifier + 2047) / 4096);
  if (condition.status === "paralysis" && ability !== "quick-feet") { speed = Math.floor(speed / 2); factors.push("paralysis ×0.5"); }
  speed = Math.max(1, Math.min(10000, speed));
  return { base, staged, speed, factors, randomOrder: item === "quick-claw" || (ability === "quick-draw" && scenario.attackingMoves), stall: ability === "stall" };
}

export function compareSpeed(own: SpeedResult, enemy: SpeedResult, trickRoom: boolean): SpeedOrder {
  // Random fractional-priority activation is unknown before the turn resolves.
  if (own.randomOrder || enemy.randomOrder) return "conditional";
  if (own.stall !== enemy.stall) return own.stall ? "last" : "first";
  if (own.speed === enemy.speed) return "tie";
  return (own.speed > enemy.speed) !== trickRoom ? "first" : "last";
}
