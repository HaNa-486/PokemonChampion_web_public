"use client";

import { get, set as setValue } from "idb-keyval";
import { create } from "zustand";
import { teamMemberSchema } from "./team-schema";
import type { BattleFormat, TeamMember } from "./types";
import { copyMembers, structurallyValidPlanMembers, validPlanMembers } from "./team-plans-store";

const STORAGE_KEY = "champions-lab-demo-team-v1";

type TeamState = {
  teams: Record<BattleFormat, TeamMember[]>;
  hydrated: boolean;
  hydrate: () => Promise<void>;
  add: (format: BattleFormat, member: TeamMember) => void;
  update: (format: BattleFormat, member: TeamMember) => void;
  remove: (format: BattleFormat, memberId: string) => void;
  clear: (format: BattleFormat) => void;
  replace: (format: BattleFormat, members: TeamMember[], options?: { retainInvalid: boolean }) => boolean;
  saveStatus: "saved" | "saving" | "error";
  retrySave: () => void;
};

const emptyTeams = (): Record<BattleFormat, TeamMember[]> => ({ singles: [], doubles: [] });
const restoreMembers = (members: TeamMember[]) => members.filter(member => teamMemberSchema.safeParse(member).success);

export function migrateSavedTeams(saved: unknown): Record<BattleFormat, TeamMember[]> {
  if (!saved || typeof saved !== "object") return emptyTeams();
  const value = saved as { version?: number; members?: TeamMember[]; teams?: Partial<Record<BattleFormat, TeamMember[]>> };
  if (value.version === 2 && value.teams) return {
    singles: Array.isArray(value.teams.singles) ? restoreMembers(value.teams.singles) : [],
    doubles: Array.isArray(value.teams.doubles) ? restoreMembers(value.teams.doubles) : [],
  };
  if (value.version === 1 && Array.isArray(value.members)) return { singles: [], doubles: restoreMembers(value.members) };
  return emptyTeams();
}

let writeRevision = 0;
const persist = (teams: Record<BattleFormat, TeamMember[]>) => {
  const revision = ++writeRevision;
  useTeamStore.setState({ saveStatus: "saving" });
  void (async () => {
    try {
      if (typeof indexedDB === "undefined") throw new Error("Storage unavailable");
      await setValue(STORAGE_KEY, { version: 2, teams });
      if (revision === writeRevision) useTeamStore.setState({ saveStatus: "saved" });
    } catch { if (revision === writeRevision) useTeamStore.setState({ saveStatus: "error" }); }
  })();
};

export const useTeamStore = create<TeamState>((set, getState) => ({
  teams: emptyTeams(),
  hydrated: false,
  saveStatus: "saved",
  retrySave: () => { if (getState().hydrated) persist(getState().teams); },
  replace: (format, members, options) => {
    if (!getState().hydrated || !(options?.retainInvalid ? structurallyValidPlanMembers(members) : validPlanMembers(members))) return false;
    const teams = { ...getState().teams, [format]: copyMembers(members) };
    set({ teams });
    persist(teams);
    return true;
  },
  hydrate: async () => {
    if (getState().hydrated) return;
    try {
      const saved = await get<unknown>(STORAGE_KEY);
      set({ teams: migrateSavedTeams(saved), hydrated: true });
    } catch {
      set({ teams: emptyTeams(), hydrated: true });
    }
  },
  add: (format, member) => {
    const teams = getState().teams;
    if (teams[format].length >= 6) return;
    const next = { ...teams, [format]: [...teams[format], member] };
    set({ teams: next });
    persist(next);
  },
  update: (format, member) => {
    const teams = getState().teams;
    const nextMembers = teams[format].map((current) => current.id === member.id ? member : current);
    const next = { ...teams, [format]: nextMembers };
    set({ teams: next });
    persist(next);
  },
  remove: (format, memberId) => {
    const teams = getState().teams;
    const next = { ...teams, [format]: teams[format].filter((member) => member.id !== memberId) };
    set({ teams: next });
    persist(next);
  },
  clear: (format) => {
    const next = { ...getState().teams, [format]: [] };
    set({ teams: next });
    persist(next);
  },
}));
