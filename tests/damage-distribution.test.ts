import { describe, expect, it } from "vitest";
import { combineDamageHits } from "../lib/damage-distribution";

describe("independent damage rolls", () => {
  it("counts independent combinations instead of treating equal rolls as one event", () => {
    const result = combineDamageHits([[1, 2], [1, 2]], 4, false);
    expect(result.distribution).toEqual([{ damage: 2, count: 1 }, { damage: 3, count: 2 }, { damage: 4, count: 1 }]);
    expect(result.combinations).toBe(4);
    expect(result.conditionalKoChance).toBe(0.25);
    expect(result.cumulative.map(hit => hit.conditionalKoChance)).toEqual([0, 0.25]);
  });

  it("survives the first hit only and allows a second hit to knock out", () => {
    const result = combineDamageHits([[100], [1]], 50, true);
    expect(result.survivalApplied).toBe(true);
    expect(result.rawRange).toEqual([101, 101]);
    expect(result.cumulative[0].range).toEqual([49, 49]);
    expect(result.cumulative[0].conditionalKoChance).toBe(0);
    expect(result.conditionalKoChance).toBe(1);
  });

  it("applies a berry once between hits and never revives a knocked-out target", () => {
    const healing = { threshold: 0.5, amount: 25, maxHp: 100 };
    const result = combineDamageHits([[60], [60]], 100, false, healing);
    expect(result.healingApplied).toBe(true);
    expect(result.remainingHpRange).toEqual([5, 5]);
    expect(result.conditionalKoChance).toBe(0);
    expect(combineDamageHits([[100]], 100, false, healing)).toMatchObject({ healingApplied: false, conditionalKoChance: 1 });
  });
});
