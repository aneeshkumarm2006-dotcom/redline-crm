import "server-only";
import { connectDb } from "@/lib/db";
import { objectIdSchema } from "@/lib/data-schema";
import { requireRole } from "@/modules/auth/service";
import { SavedViewModel } from "./model";
import { normalizeViewQuery, saveViewSchema, savedViewSchema, viewBoardSchema, type SavedView } from "./schema";
import { viewsCopy } from "./copy";

/** Saved board filters are personal: every read and write is scoped to the signed-in user. */
export class ViewError extends Error {}
const MAX_VIEWS = 20;

function toView(document: unknown): SavedView {
  const { _id, __v, createdAt, updatedAt, ...data } = JSON.parse(JSON.stringify(document));
  void __v; void createdAt; void updatedAt;
  return savedViewSchema.parse({ ...data, id: _id });
}

export async function listMyViews(board: string) {
  const user = await requireRole();
  const key = viewBoardSchema.parse(board);
  await connectDb();
  const documents = await SavedViewModel.find({ userId: user.id, board: key }).sort({ name: 1 }).limit(MAX_VIEWS).lean().exec();
  return documents.map(toView);
}

/** Saves the board's filters under a name (replacing a view with the same name). */
export async function saveView(input: unknown) {
  const user = await requireRole();
  const data = saveViewSchema.parse(input);
  const query = normalizeViewQuery(data.board, data.query);
  if (!query) throw new ViewError(viewsCopy.nothingToSave);
  await connectDb();
  const existing = await SavedViewModel.exists({ userId: user.id, board: data.board, name: data.name }).exec();
  if (!existing && await SavedViewModel.countDocuments({ userId: user.id, board: data.board }).exec() >= MAX_VIEWS) throw new ViewError(viewsCopy.limit(MAX_VIEWS));
  const record = savedViewSchema.omit({ id: true }).parse({ userId: user.id, board: data.board, name: data.name, query });
  await SavedViewModel.updateOne({ userId: user.id, board: data.board, name: data.name }, { $set: record }, { upsert: true, runValidators: true }).exec();
}

export async function deleteView(id: unknown) {
  const user = await requireRole();
  const viewId = objectIdSchema.parse(id);
  await connectDb();
  const result = await SavedViewModel.deleteOne({ _id: viewId, userId: user.id }).exec();
  if (!result.deletedCount) throw new ViewError(viewsCopy.notFound);
}

/** Destructive internal CLI reset: a reseed issues new user IDs, so every saved view is cleared. */
export async function clearViewsForSeed() {
  await connectDb();
  await SavedViewModel.deleteMany({}).exec();
}
