"use server";
import { revalidatePath } from "next/cache";
import { ZodError } from "zod";
import { deleteView, saveView, ViewError } from "./service";
import { viewBoards, type ViewActionResult } from "./schema";
import { viewsCopy } from "./copy";

function failure(error: unknown): ViewActionResult {
  return { ok: false, message: error instanceof ViewError ? error.message : error instanceof ZodError ? error.issues[0]?.message ?? viewsCopy.failed : viewsCopy.failed };
}
export async function saveViewAction(input: unknown): Promise<ViewActionResult> {
  try { await saveView(input); }
  catch (error) { return failure(error); }
  for (const board of Object.values(viewBoards)) revalidatePath(board.path);
  return { ok: true };
}
export async function deleteViewAction(id: unknown): Promise<ViewActionResult> {
  try { await deleteView(id); }
  catch (error) { return failure(error); }
  for (const board of Object.values(viewBoards)) revalidatePath(board.path);
  return { ok: true };
}
