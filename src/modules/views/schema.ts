import { z } from "zod";
import { objectIdSchema } from "@/lib/data-schema";

/** Boards that can save their filters, and the query keys each one keeps (pagination is never saved). */
export const viewBoards = {
  inventory: { path: "/crm/inventory", keys: ["q", "dealershipId", "status", "groupBy", "repairType", "garageId", "aging", "sold", "minDays", "maxDays", "soldBy"] },
  leads: { path: "/crm/leads", keys: ["view", "q", "stage", "dealershipId", "assignedTo", "source"] },
} as const;
export type ViewBoard = keyof typeof viewBoards;
export const viewBoardSchema = z.enum(Object.keys(viewBoards) as [ViewBoard, ...ViewBoard[]]);

/** Keeps only the board's own filter keys, in a stable order, so equal filters give equal strings. */
export function normalizeViewQuery(board: ViewBoard, query: string) {
  const source = new URLSearchParams(query);
  const kept = new URLSearchParams();
  for (const key of viewBoards[board].keys) {
    const value = source.get(key)?.trim();
    if (value) kept.set(key, value.slice(0, 200));
  }
  return kept.toString();
}

export const saveViewSchema = z.object({
  board: viewBoardSchema, name: z.string().trim().min(1, "Name the view.").max(60), query: z.string().max(2000),
}).strict();
export const savedViewSchema = z.object({
  id: objectIdSchema, userId: objectIdSchema, board: viewBoardSchema, name: z.string().trim().min(1).max(60), query: z.string().max(2000),
}).strict();
export type SavedView = z.infer<typeof savedViewSchema>;
export type ViewActionResult = { ok: true } | { ok: false; message: string };
