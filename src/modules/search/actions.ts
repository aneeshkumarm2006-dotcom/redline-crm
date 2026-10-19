"use server";
import { searchWorkspace } from "./service";
import type { SearchResults } from "./schema";

export async function searchWorkspaceAction(query: unknown): Promise<{ ok: true; results: SearchResults } | { ok: false }> {
  try { return { ok: true, results: await searchWorkspace(query) }; }
  catch { return { ok: false }; }
}
