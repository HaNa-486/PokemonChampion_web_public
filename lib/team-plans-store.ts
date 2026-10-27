"use client";

import { get, update as updateValue } from "idb-keyval";
import { create } from "zustand";
import { z } from "zod";
import { teamMemberSchema } from "./team-schema";
import { getCatalog } from "./catalog";
import { NATURES, validateTeam } from "./domain";
import type { BattleFormat, TeamMember } from "./types";
import { exportTeamTransfer, previewTeamTransfer, transferMembers } from "./team-transfer";

const KEY = "champions-lab-demo-team-plans-v1";
export type TeamPlan = { id: string; name: string; format: BattleFormat; members: TeamMember[] };
const schema = z.object({ version: z.literal(1), plans: z.array(z.object({ id: z.string().min(1), name: z.string().trim().min(1).max(60), format: z.enum(["singles", "doubles"]), members: z.array(teamMemberSchema).max(6) })) });
export function parseTeamPlans(value: unknown): TeamPlan[] {
  if (value === undefined) return [];
  const parsed = schema.parse(value);
  if (new Set(parsed.plans.map(plan => plan.id)).size !== parsed.plans.length) throw new Error("Duplicate plan IDs");
  return parsed.plans.map(plan => ({ ...plan, members: plan.members.map(member => ({ ...member, nature: NATURES.find(nature => nature.name === member.nature.name && nature.up === member.nature.up && nature.down === member.nature.down) ?? member.nature })) }));
}
export function validPlanMembers(members: TeamMember[]) {
  return structurallyValidPlanMembers(members) && validateTeam(members, getCatalog().pokemonById, new Set(getCatalog().itemById.keys()), getCatalog().megaStoneIdByPokemonId).length === 0;
}
export function structurallyValidPlanMembers(members: TeamMember[]) {
  const parsed = z.array(teamMemberSchema).max(6).safeParse(members);
  return parsed.success && new Set(members.map(member => member.id)).size === members.length && members.every(member => NATURES.some(nature => nature.name === member.nature.name && nature.up === member.nature.up && nature.down === member.nature.down));
}
export const copyMembers = (members: TeamMember[]) => members.map(member => ({ ...member, moveIds: [...member.moveIds], ap: { ...member.ap }, nature: { ...member.nature } }));
type Operation = { kind: "save"; plan: TeamPlan } | { kind: "rename"; id: string; name: string } | { kind: "remove"; id: string };
const applyOperations = (plans: TeamPlan[], operations: Operation[]) => operations.reduce((current, operation) => {
  if (operation.kind === "save") return current.some(plan => plan.id === operation.plan.id) ? current.map(plan => plan.id === operation.plan.id ? operation.plan : plan) : [...current, operation.plan];
  if (operation.kind === "rename") return current.map(plan => plan.id === operation.id ? { ...plan, name: operation.name } : plan);
  return current.filter(plan => plan.id !== operation.id);
}, plans);
type State = {
  plans: TeamPlan[]; hydrated: boolean; hydrationError: boolean; saveStatus: "saved" | "saving" | "error";
  hydrate: () => Promise<void>; retrySave: () => void;
  save: (name: string, format: BattleFormat, members: TeamMember[], id?: string) => string | null;
  rename: (id: string, name: string) => void; remove: (id: string) => void;
  importNew: (value: unknown, importId: string) => Promise<string>;
};
export const useTeamPlansStore = create<State>((set, state) => {
  let hydration: Promise<void> | null = null;
  const pending: Operation[] = [];
  let writing = false;
  const persist = () => {
    if (writing || !pending.length) return;
    writing = true;
    set({ saveStatus: "saving" });
    void (async () => {
      try {
        if (typeof indexedDB === "undefined") throw new Error("Storage unavailable");
        while (pending.length) {
          const batch = [...pending];
          let merged: TeamPlan[] = [];
          await updateValue(KEY, value => {
            merged = applyOperations(parseTeamPlans(value), batch);
            return { version: 1, plans: merged };
          });
          pending.splice(0, batch.length);
          set({ plans: applyOperations(merged, pending) });
        }
        set({ saveStatus: "saved" });
      } catch { set({ saveStatus: "error" }); }
      finally { writing = false; }
    })();
  };
  const update = (operation: Operation) => { pending.push(operation); set({ plans: applyOperations(state().plans, [operation]) }); persist(); };
  return {
    plans: [], hydrated: false, hydrationError: false, saveStatus: "saved",
    hydrate: () => {
      if (state().hydrated) return Promise.resolve();
      if (hydration) return hydration;
      set({ hydrationError: false });
      hydration = Promise.resolve().then(() => get(KEY)).then(value => set({ plans: parseTeamPlans(value), hydrated: true })).catch(() => set({ hydrationError: true })).finally(() => { hydration = null; });
      return hydration;
    },
    retrySave: () => { if (state().hydrated) persist(); },
    importNew: async (value, importId) => {
      if (!/^import-[a-f0-9-]{36}$/.test(importId)) throw new Error("Invalid import identity");
      const preview = previewTeamTransfer(value);
      if (!preview.legal) throw new Error("Repair the validation issues before importing.");
      const plan = { id: importId, name: preview.file.name, format: preview.file.format, members: transferMembers(preview.file).map((m,i) => ({...m,id:`${importId}-${i}`})) };
      let merged: TeamPlan[] = [];
      // One IndexedDB transaction: preserve other tabs and make retries idempotent.
      await updateValue(KEY, value => {
        const current = parseTeamPlans(value);
        const existing = current.find(p => p.id === importId);
        if (existing && JSON.stringify(exportTeamTransfer(existing.name,existing.format,existing.members)) !== JSON.stringify(exportTeamTransfer(plan.name,plan.format,plan.members))) throw new Error("Import identity conflict");
        merged = existing ? current : [...current,plan];
        return {version:1, plans:merged};
      });
      set({plans:applyOperations(merged,pending)});
      return plan.id;
    },
    save: (name, format, members, id) => {
      const clean = name.trim().slice(0, 60);
      if (!state().hydrated || !clean || !members.length || !validPlanMembers(members)) return null;
      if (id && !state().plans.some(plan => plan.id === id && plan.format === format)) return null;
      const plan = { id: id ?? crypto.randomUUID(), name: clean, format, members: copyMembers(members) };
      update({ kind: "save", plan });
      return plan.id;
    },
    rename: (id, name) => { const clean = name.trim().slice(0, 60); if (state().hydrated && clean) update({ kind: "rename", id, name: clean }); },
    remove: id => { if (state().hydrated) update({ kind: "remove", id }); },
  };
});
