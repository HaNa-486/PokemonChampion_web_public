import { describe, expect, it } from "vitest";
import { items, megaStoneIdByPokemonId, pokemonById } from "../lib/catalog";
import { calculateFinalStats, NEUTRAL_NATURE, sanitizeTeamMembers, validateAp, validateTeam, ZERO_STATS } from "../lib/domain";
import { defensiveMatchups, typeEffectiveness } from "../lib/type-chart";
import type { TeamMember } from "../lib/types";

const member = (id: string, pokemonId = "garchomp", itemId: string | null = null): TeamMember => ({
  id, pokemonId, itemId, abilityId: null, moveIds: [], ap: { ...ZERO_STATS }, nature: { ...NEUTRAL_NATURE },
});
const issues = (members: TeamMember[]) => validateTeam(members, pokemonById, new Set(items.map(item => item.id)), megaStoneIdByPokemonId).map(issue => issue.code);

describe("AP and stats", () => {
  it("matches hand-calculated level-50 stats with the demo AP rules", () => {
    expect(calculateFinalStats(pokemonById.get("garchomp")!.baseStats, ZERO_STATS, NEUTRAL_NATURE)).toEqual({
      hp: 183, attack: 150, defense: 115, specialAttack: 100, specialDefense: 105, speed: 122,
    });
    expect(calculateFinalStats(pokemonById.get("dragonite")!.baseStats,
      { ...ZERO_STATS, hp: 2, attack: 32, speed: 32 },
      { name: "Adamant", up: "attack", down: "specialAttack" },
    )).toEqual({ hp: 168, attack: 204, defense: 115, specialAttack: 108, specialDefense: 120, speed: 132 });
  });

  it("allows 66 AP and rejects overspending, fractions, and negative points", () => {
    expect(validateAp({ ...ZERO_STATS, hp: 2, attack: 32, speed: 32 })).toEqual([]);
    expect(validateAp({ ...ZERO_STATS, hp: 3, attack: 32, speed: 32 }).map(issue => issue.code)).toContain("AP_TOTAL_EXCEEDED");
    for (const speed of [-1, 0.5, 33]) {
      expect(validateAp({ ...ZERO_STATS, speed }).map(issue => issue.code)).toContain("AP_OUT_OF_RANGE");
    }
  });
});

describe("team validation", () => {
  it("rejects duplicate species and items, including base and Mega forms", () => {
    expect(issues([member("a", "garchomp", "choice-scarf"), member("b", "garchomp", "choice-scarf")]))
      .toEqual(expect.arrayContaining(["DUPLICATE_POKEMON", "DUPLICATE_ITEM"]));
    expect(issues([member("a", "charizard"), member("b", "mega-charizard-x", "charizardite-x")])).toContain("DUPLICATE_POKEMON");
  });

  it("requires a Mega form's matching stone", () => {
    expect(issues([member("a", "mega-charizard-x")])).toContain("MEGA_STONE_REQUIRED");
    expect(issues([member("a", "mega-charizard-x", "charizardite-x")])).toEqual([]);
  });

  it("rejects unavailable species and incompatible abilities and moves", () => {
    expect(issues([member("a", "unknown")])).toContain("POKEMON_UNAVAILABLE");
    expect(issues([{ ...member("a"), abilityId: "chlorophyll", moveIds: ["flamethrower"] }]))
      .toEqual(expect.arrayContaining(["ABILITY_UNAVAILABLE", "MOVE_NOT_LEARNABLE"]));
    expect(issues([{ ...member("a"), moveIds: ["protect", "protect"] }])).toContain("DUPLICATE_MOVE");
  });

  it("restores available species once without retaining conflicting forms", () => {
    const restored = sanitizeTeamMembers([
      member("first", "charizard"), member("mega", "mega-charizard-x", "charizardite-x"),
      member("unknown", "unknown"), member("second", "garchomp"),
    ], pokemonById);
    expect(restored.map(entry => entry.id)).toEqual(["first", "second"]);
  });
});

describe("type effectiveness", () => {
  it("combines dual-type weaknesses, resistances, and immunities", () => {
    const chart = defensiveMatchups(["Dragon", "Flying"]);
    expect(chart.weak).toContainEqual({ type: "Ice", multiplier: 4 });
    expect(chart.resistant).toContainEqual({ type: "Grass", multiplier: 0.25 });
    expect(chart.immune).toContainEqual({ type: "Ground", multiplier: 0 });
    expect(typeEffectiveness("Fire", "Grass")).toBe(2);
  });
});
