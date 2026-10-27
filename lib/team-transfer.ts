import { z } from "zod";
import { NATURES, apTotal, validateTeam } from "./domain";
import { getCatalog } from "./catalog";
import { getPublishedData } from "./published-data";
import type { BattleFormat, TeamMember } from "./types";

const id = z.string().min(1).max(100).regex(/^[a-z0-9-]+$/);
const apValue = z.number().int().min(0).max(32);
const transferApSchema = z.object({hp:apValue,attack:apValue,defense:apValue,specialAttack:apValue,specialDefense:apValue,speed:apValue}).strict().refine(ap=>apTotal(ap)<=66,"Total AP cannot exceed 66");
export const transferMemberSchema = z.object({ pokemonId: id, abilityId: id.nullable(), itemId: id.nullable(), moveSlots: z.array(id.nullable()).length(4), nature: z.enum(NATURES.map(n=>n.name) as [string,...string[]]), ap: transferApSchema }).strict();
export const teamTransferSchema = z.object({ schemaVersion: z.literal(1), name: z.string().trim().min(1).max(60), format: z.enum(["singles", "doubles"]), ruleset: z.string().min(1).max(100), dataVersion: z.string().min(1).max(100), members: z.array(transferMemberSchema).min(1).max(6) }).strict();
export type TeamTransfer = z.infer<typeof teamTransferSchema>;
export const MAX_TRANSFER_BYTES = 32 * 1024;
export function transferMembers(file: TeamTransfer): TeamMember[] {
  return file.members.map((m,i) => ({ id: `import-${i+1}`, pokemonId: m.pokemonId, abilityId: m.abilityId, itemId: m.itemId, moveIds: m.moveSlots.map(id => id ?? ""), nature: {...NATURES.find(n => n.name === m.nature)!}, ap: {...m.ap} }));
}
export function previewTeamTransfer(value: unknown) {
  if (new TextEncoder().encode(JSON.stringify(value)).byteLength > MAX_TRANSFER_BYTES) throw new Error("Team file exceeds 32 KiB.");
  const file = teamTransferSchema.parse(value);
  const members = transferMembers(file);
  const issues = validateTeam(members, getCatalog().pokemonById, new Set(getCatalog().itemById.keys()), getCatalog().megaStoneIdByPokemonId).map(issue=>({...issue,memberIndex:issue.memberId?members.findIndex(m=>m.id===issue.memberId):null,field:issue.code.includes("AP")?"ap":issue.code.includes("MOVE")?"moveSlots":issue.code.includes("ABILITY")?"abilityId":issue.code.includes("ITEM")||issue.code.includes("STONE")?"itemId":"pokemonId"}));
  const incomplete = members.flatMap((m,i) => [!m.abilityId ? `Member ${i+1}: ability missing` : "", m.moveIds.some(id => !id) ? `Member ${i+1}: empty move slots` : "", apTotal(m.ap) < 66 ? `Member ${i+1}: AP below 66` : ""].filter(Boolean));
  const versionChanged = file.ruleset !== getPublishedData().publishedRulesetCode || file.dataVersion !== getPublishedData().publishedDataVersion;
  return { file, legal: issues.length === 0, complete: issues.length === 0 && incomplete.length === 0 && members.length === 6, issues, incomplete, versionChanged, validatedAgainst: { ruleset: getPublishedData().publishedRulesetCode, dataVersion: getPublishedData().publishedDataVersion }, action: "Save as a new device-local plan after confirming the preview. Current teams and scrapbooks are unchanged." };
}
export function exportTeamTransfer(name: string, format: BattleFormat, members: TeamMember[]): TeamTransfer {
  return teamTransferSchema.parse({ schemaVersion: 1, name, format, ruleset: getPublishedData().publishedRulesetCode, dataVersion: getPublishedData().publishedDataVersion, members: members.map(m => ({pokemonId: m.pokemonId, abilityId: m.abilityId, itemId: m.itemId, moveSlots: Array.from({length: 4}, (_,i) => m.moveIds[i] || null), nature: m.nature.name, ap: {...m.ap}})) });
}
