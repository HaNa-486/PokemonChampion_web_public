import { z } from "zod";

export class ResearchInputError extends Error {
  constructor(public code: string, message: string, public issues: Array<{path: (string | number)[]; code: string; message: string}> = []) { super(message); }
}
export function researchError(error: unknown) {
  if (error instanceof z.ZodError) return {code: "INVALID_REQUEST", message: "Check the indicated input fields.", issues: error.issues.map(i => ({path: i.path, code: i.code, message: i.message}))};
  if (error instanceof ResearchInputError) return {code: error.code, message: error.message, issues: error.issues};
  const message = error instanceof Error ? error.message : "Invalid request";
  return {code: message.startsWith("DATA_VERSION_CHANGED") ? "DATA_VERSION_CHANGED" : "INVALID_REQUEST", message, issues: []};
}
