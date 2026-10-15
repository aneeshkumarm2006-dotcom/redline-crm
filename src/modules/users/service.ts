import "server-only";
import { z } from "zod";
import { connectDb } from "@/lib/db";
import { requireRole } from "@/modules/auth/service";
import { UserModel } from "./model";
import { emailSchema, initializeUserSchema, userIdSchema, userSchema, type User } from "./schema";

function toUser(document: { _id: { toString(): string }; dealershipId?: { toString(): string } | null }): User {
  return userSchema.parse({ ...document, id: document._id.toString(), dealershipId: document.dealershipId?.toString() ?? null });
}

/** Internal auth lookup. Never expose this result in an action or client component. */
export async function findCredentials(email: string) {
  const normalized = emailSchema.parse(email);
  await connectDb();
  const document = await UserModel.findOne({ email: normalized }).select("+passwordHash").lean().exec();
  return document ? { user: toUser(document), passwordHash: document.passwordHash } : null;
}

/** Internal session lookup: roles and active state always come from the database. */
export async function findActiveUser(id: string): Promise<User | null> {
  if (!userIdSchema.safeParse(id).success) return null;
  await connectDb();
  const document = await UserModel.findOne({ _id: id, active: true }).lean().exec();
  return document ? toUser(document) : null;
}

/** Internal automation recipients; never exposed by a public route/action. */
export async function listAutomationStaff(dealershipId: string, owners = false): Promise<User[]> {
  const id = userIdSchema.parse(dealershipId);
  await connectDb();
  const documents = await UserModel.find({ active: true, ...(owners ? { role: "owner" } : { role: "salesperson", dealershipId: id }) }).sort({ _id: 1 }).lean().exec();
  return documents.map(toUser);
}

export async function listTeam(): Promise<User[]> {
  await requireRole("owner");
  await connectDb();
  const documents = await UserModel.find().sort({ name: 1 }).lean().exec();
  return documents.map(toUser);
}

/** Minimal staff attribution for inventory audit history; never exposes credentials. */
export async function getStaffNames(ids: string[]) {
  await requireRole();
  const valid = z.array(userIdSchema).parse(ids);
  await connectDb();
  const documents = await UserModel.find({ _id: { $in: valid } }).select("name").lean().exec();
  return documents.map((document) => ({ id: document._id.toString(), name: document.name }));
}

/** Trusted CLI bootstrap only. No HTTP action calls this; existing accounts are preserved. */
export async function initializeUser(input: unknown): Promise<User> {
  const data = initializeUserSchema.parse(input);
  await connectDb();
  await UserModel.init();
  try {
    await UserModel.updateOne({ email: data.email }, { $setOnInsert: data }, { upsert: true, runValidators: true }).exec();
  } catch (error) {
    if (!(error instanceof Error && "code" in error && error.code === 11000)) throw error;
  }
  const document = await UserModel.findOne({ email: data.email }).lean().exec();
  if (!document) throw new Error("User initialization failed.");
  return toUser(document);
}

/** Destructive internal CLI reset. Fresh IDs invalidate sessions from earlier seeds. */
export async function replaceUsersForSeed(input: unknown) {
  const records = z.array(initializeUserSchema.extend({ id: userIdSchema })).parse(input);
  await connectDb();
  await UserModel.init();
  const documents = records.map(({ id, ...data }) => ({ _id: id, ...data }));
  for (const document of documents) await new UserModel(document).validate();
  await UserModel.deleteMany({}).exec();
  await UserModel.insertMany(documents);
}

/** Owner-only roster for lead filters and reassignment; never exposes credentials. */
export async function listSalespeople(): Promise<User[]> {
  await requireRole("owner");
  await connectDb();
  const documents = await UserModel.find({ role: "salesperson" }).sort({ name: 1 }).lean().exec();
  return documents.map(toUser);
}
