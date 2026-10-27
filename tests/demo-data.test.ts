import { afterEach, describe, expect, it, vi } from "vitest";
import { getCatalog } from "../lib/catalog";
import { getPublishedData } from "../lib/published-data";
import { bootstrapUsageRankings, clearUsageMemoryCache, loadBattleUsage, loadUsageRankings, peekBattleUsage, peekUsageRankings } from "../lib/usage-client";

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
  clearUsageMemoryCache();
});

describe("offline demonstration contract", () => {
  it("keeps a deliberately small catalog with local artwork and resolvable references", () => {
    const catalog = getCatalog();
    expect(catalog.pokemon).toHaveLength(8);
    for (const pokemon of catalog.pokemon) {
      expect(pokemon.imageUrl).toBe("./demo-token.svg");
      expect(pokemon.abilityIds.every(id => catalog.abilityById.has(id))).toBe(true);
      expect(pokemon.moveIds.every(id => catalog.moveById.has(id))).toBe(true);
    }
    expect(getPublishedData().publishedDataVersion).toBe("portfolio-demo-v1");
  });

  it("labels fabricated rankings and usage as demonstration data without claiming freshness", async () => {
    const rankings = bootstrapUsageRankings();
    expect(rankings.provenance).toMatchObject({ provider: "Portfolio demo", status: "demo", sourceDate: null, checkedAt: null });
    const usage = await loadBattleUsage(getCatalog().pokemonById.get("garchomp")!);
    for (const format of ["singles", "doubles"] as const) {
      expect(usage[format]?.provenance).toMatchObject({ provider: "Portfolio demo", status: "demo", sourceDate: null, checkedAt: null });
      expect(usage[format]?.rows.length).toBeGreaterThan(0);
    }
  });

  it("returns the same fixture across refreshes and dates without requests or background timers", async () => {
    const fetch = vi.fn(() => Promise.reject(new Error("The demo must not request external data")));
    vi.stubGlobal("fetch", fetch);
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2000-01-01T00:00:00Z"));
    const pokemon = getCatalog().pokemonById.get("dragonite")!;
    const first = await loadBattleUsage(pokemon);
    const rankings = await loadUsageRankings();
    vi.setSystemTime(new Date("2050-01-01T00:00:00Z"));
    expect(await loadBattleUsage(pokemon, true)).toEqual(first);
    expect(await loadUsageRankings(true)).toEqual(rankings);
    expect(peekBattleUsage(pokemon)).toEqual(first);
    expect(peekUsageRankings()).toEqual(rankings);
    expect(fetch).not.toHaveBeenCalled();
    expect(vi.getTimerCount()).toBe(0);
  });
});
