import { clear, get, keys, set } from "idb-keyval";
import { waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it } from "vitest";
import { NEUTRAL_NATURE, ZERO_STATS } from "../lib/domain";
import { exportTeamTransfer, previewTeamTransfer, transferMembers } from "../lib/team-transfer";
import { parseTeamPlans, useTeamPlansStore } from "../lib/team-plans-store";
import { useTeamStore } from "../lib/team-store";
import type { TeamMember } from "../lib/types";

const member = (): TeamMember => ({
  id: "local-member", pokemonId: "garchomp", abilityId: "sand-veil", itemId: "choice-scarf",
  moveIds: ["protect", "", "earthquake", ""], nature: { ...NEUTRAL_NATURE },
  ap: { ...ZERO_STATS, hp: 2, attack: 32, speed: 32 },
});
const file = () => exportTeamTransfer("Demo team", "doubles", [member()]);

beforeEach(async () => {
  await clear();
  useTeamPlansStore.setState({ plans: [], hydrated: false, hydrationError: false, saveStatus: "saved" });
  useTeamStore.setState({ teams: { singles: [], doubles: [] }, hydrated: true, saveStatus: "saved" });
});

describe("team transfer", () => {
  it("round-trips empty move positions and configuration without device IDs", () => {
    const exported = file();
    expect(JSON.stringify(exported)).not.toContain("local-member");
    expect(exported.members[0].moveSlots).toEqual(["protect", null, "earthquake", null]);
    expect(previewTeamTransfer(exported)).toMatchObject({ legal: true, complete: false, versionChanged: false });
    expect(exportTeamTransfer(exported.name, exported.format, transferMembers(exported))).toEqual(exported);
  });

  it("reports validation failures and changed versions before saving", () => {
    const exported = file();
    expect(() => previewTeamTransfer({ ...exported, schemaVersion: 2 })).toThrow();
    expect(() => previewTeamTransfer({ ...exported, unexpected: true })).toThrow();
    expect(() => previewTeamTransfer({ ...exported, members: [{ ...exported.members[0], ap: { ...ZERO_STATS, speed: 33 } }] })).toThrow();
    expect(previewTeamTransfer({ ...exported, members: [exported.members[0], exported.members[0]] }).legal).toBe(false);
    expect(previewTeamTransfer({ ...exported, members: [{ ...exported.members[0], moveSlots: ["flamethrower", null, null, null] }] }).legal).toBe(false);
    expect(previewTeamTransfer({ ...exported, dataVersion: "earlier-demo" }).versionChanged).toBe(true);
  });

  it("merges concurrent imports and retries idempotently without overwriting unreadable data", async () => {
    const first = `import-${crypto.randomUUID()}`;
    const second = `import-${crypto.randomUUID()}`;
    const store = useTeamPlansStore.getState();
    await Promise.all([store.importNew(file(), first), store.importNew(file(), second)]);
    await store.importNew(file(), first);
    const [key] = await keys();
    expect(parseTeamPlans(await get(key))).toHaveLength(2);
    await expect(store.importNew({ ...file(), name: "Changed team" }, first)).rejects.toThrow("conflict");
    expect(parseTeamPlans(await get(key))).toHaveLength(2);
    const unreadable = { version: 999, plans: "unreadable" };
    await set(key, unreadable);
    await expect(store.importNew(file(), `import-${crypto.randomUUID()}`)).rejects.toThrow();
    expect(await get(key)).toEqual(unreadable);
  });
});

describe("device-local saved plans", () => {
  it("keeps a saved snapshot independent of a current team and restores it after reload", async () => {
    await useTeamPlansStore.getState().hydrate();
    const selected = member();
    const planId = useTeamPlansStore.getState().save("Original build", "doubles", [selected]);
    expect(planId).not.toBeNull();
    expect(useTeamStore.getState().replace("doubles", [selected])).toBe(true);
    useTeamStore.getState().update("doubles", { ...selected, ap: { ...ZERO_STATS, speed: 8 } });
    expect(useTeamPlansStore.getState().plans[0].members[0].ap.speed).toBe(32);
    expect(useTeamStore.getState().teams.doubles[0].ap.speed).toBe(8);
    expect(useTeamStore.getState().teams.singles).toEqual([]);
    await waitFor(() => expect(useTeamPlansStore.getState().saveStatus).toBe("saved"));
    await waitFor(() => expect(useTeamStore.getState().saveStatus).toBe("saved"));
    useTeamPlansStore.setState({ plans: [], hydrated: false });
    await useTeamPlansStore.getState().hydrate();
    expect(useTeamPlansStore.getState().plans[0]).toMatchObject({ id: planId, name: "Original build", format: "doubles" });
    expect(useTeamPlansStore.getState().plans[0].members[0].ap.speed).toBe(32);
  });

  it("rejects an invalid replacement while preserving the current team", async () => {
    expect(useTeamStore.getState().replace("doubles", [member()])).toBe(true);
    expect(useTeamStore.getState().replace("doubles", [member(), { ...member(), id: "duplicate" }])).toBe(false);
    expect(useTeamStore.getState().teams.doubles).toEqual([member()]);
    await waitFor(() => expect(useTeamStore.getState().saveStatus).toBe("saved"));
  });
});
