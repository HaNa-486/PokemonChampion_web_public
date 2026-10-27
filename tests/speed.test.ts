import { describe, expect, it } from "vitest";
import { studySpeeds } from "../lib/speed-research";

const study = (candidate: Record<string, unknown>, extra: Record<string, unknown> = {}) => studySpeeds({
  action: "speedStudy", candidates: [candidate], target: { speed: 213 }, ...extra,
}).results[0].variants[0];

describe("speed research", () => {
  it("finds the first winning Scarf AP and shows the immediately losing point", () => {
    const result = study({ pokemonId: "garchomp", variantIds: ["normal+scarf"] });
    expect(result.range).toEqual({ min: 163, max: 253 });
    expect(result.thresholds.find(threshold => threshold.nature === "positive")).toMatchObject({
      passingAp: { min: 8, max: 32 },
      boundary: { ap: 8, speed: 214, speedDelta: 1, adjacent: { ap: 7, speed: 211, order: "last" } },
    });
  });

  it("applies the subject's Tailwind and paralysis without changing the target", () => {
    const candidate = { pokemonId: "garchomp", mode: "fixed", nature: "positive", speedAp: 32 };
    expect(study(candidate).range.min).toBe(169);
    expect(study({ ...candidate, tailwind: true }).range.min).toBe(338);
    expect(study({ ...candidate, tailwind: true, condition: { status: "paralysis" } })).toMatchObject({
      range: { min: 169, max: 169 }, targetRange: { min: 213, max: 213 }, order: "last",
    });
  });

  it("reverses the AP boundary under Trick Room while preserving ties", () => {
    const result = study({ pokemonId: "garchomp" }, { target: { speed: 140 }, field: { trickRoom: true } });
    expect(result.thresholds.find(threshold => threshold.nature === "neutral")).toMatchObject({
      passingAp: { min: 0, max: 17 }, tieAps: [18],
      boundary: { ap: 17, speed: 139, adjacent: { ap: 18, speed: 140, order: "tie" } },
    });
  });

  it("shares weather between both subjects and respects ability suppression", () => {
    const candidate = { pokemonId: "venusaur", mode: "fixed", speedAp: 7, abilityId: "chlorophyll" };
    expect(study(candidate, { field: { weather: "sun" } }).range.min).toBe(214);
    expect(study({ ...candidate, condition: { abilityEnabled: false } }, { field: { weather: "sun" } }).range.min).toBe(107);
    expect(study({ pokemonId: "venusaur", variantIds: ["chlorophyll"] }, { target: candidate }).targetRange).toEqual({ min: 214, max: 214 });
  });

  it("rejects illegal abilities, overspent AP, and an ambiguous Mega stone", () => {
    for (const candidate of [
      { pokemonId: "garchomp", abilityId: "chlorophyll" },
      { pokemonId: "garchomp", speedAp: 33 },
      { pokemonId: "charizard", itemId: "charizardite-x" },
    ]) expect(() => study(candidate)).toThrow();
  });
});
