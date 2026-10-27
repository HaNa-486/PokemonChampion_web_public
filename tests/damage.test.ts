import { describe, expect, it } from "vitest";
import { calculateDamage, damageSchema } from "../lib/damage";
import { getDamageExample } from "../lib/damage-example";

const example = () => damageSchema.parse(getDamageExample());

describe("damage calculations", () => {
  it("matches the hand-calculated Dragon Claw example and defensive AP comparison", () => {
    // Attack = floor((134 + 32 + 20) * 1.1), Defense = 115, power = 80.
    const input = example();
    const result = calculateDamage(input);
    expect(result.baseline.attackerStats.attack).toBe(204);
    expect(result.baseline.defenderStats.hp).toBe(185);
    expect(result.baseline.range).toEqual([162, 192]);
    expect(result.baseline.rolls).toHaveLength(16);
    expect(result.baseline.conditionalOhkoChance).toBe(0.25);
    expect(result.alternatives[0].result.guaranteedSurvival).toBe(true);
    expect(result.inputs).toEqual(input);
  });

  it("uses explicit screens, burn, critical hits, and Protect", () => {
    const input = example();
    const baseline = calculateDamage(input).baseline;
    input.field.reflect = true;
    expect(calculateDamage(input).baseline.range[1]).toBeLessThan(baseline.range[0]);
    input.critical = true;
    expect(calculateDamage(input).baseline.range[0]).toBeGreaterThan(baseline.range[1]);
    input.critical = false;
    input.field.reflect = false;
    input.attackerCondition.status = "brn";
    expect(calculateDamage(input).baseline.range[1]).toBeLessThan(baseline.range[0]);
    input.attackerCondition.status = "par";
    input.field.attackerTailwind = true;
    expect(calculateDamage(input).baseline.effectiveSpeed.attacker).toBe(baseline.effectiveSpeed.attacker);
    input.field.protected = true;
    expect(calculateDamage(input).baseline.range).toEqual([0, 0]);
  });

  it("replaces both original defensive types when a single current type is entered", () => {
    const input = example();
    input.moveId = "earthquake";
    input.defender = { ...input.attacker, nature: "Serious" };
    input.defenderCondition.abilityEnabled = false;
    expect(calculateDamage(input).baseline.range).toEqual([0, 0]);
    input.defenderCondition.currentTypes = ["Normal"];
    expect(calculateDamage(input).baseline.range[0]).toBeGreaterThan(0);
  });

  it("activates Multiscale only at full HP and honors its disabled state", () => {
    const input = example();
    input.defender = { ...input.attacker, nature: "Serious" };
    const full = calculateDamage(input).baseline;
    input.defenderCondition.hpPercent = 99;
    const injured = calculateDamage(input).baseline;
    expect(injured.range[0]).toBeGreaterThan(full.range[1]);
    input.defenderCondition.hpPercent = 100;
    input.defenderCondition.abilityEnabled = false;
    expect(calculateDamage(input).baseline.range).toEqual(injured.range);
  });

  it("caps a full-HP Focus Sash target at one HP, without promising survival after damage", () => {
    const input = example();
    input.attackerCondition.boosts.attack = 6;
    input.defender.itemId = "focus-sash";
    expect(calculateDamage(input).baseline).toMatchObject({ range: [184, 184], conditionalOhkoChance: 0 });
    input.defenderCondition.hpPercent = 99;
    expect(calculateDamage(input).baseline.conditionalOhkoChance).toBe(1);
  });

  it("rejects stale versions, unknown inputs, illegal AP, and missing abilities", () => {
    const input = example();
    expect(() => calculateDamage({ ...input, dataVersion: "unavailable-version" })).toThrow("DATA_VERSION_CHANGED");
    expect(() => calculateDamage({ ...input, field: { unknown: true } })).toThrow();
    expect(() => calculateDamage({ ...input, attacker: { ...input.attacker, ap: { ...input.attacker.ap, hp: 32 } } })).toThrow();
    expect(() => calculateDamage({ ...input, attacker: { ...input.attacker, abilityId: null } })).toThrow("Choose an ability");
  });
});
