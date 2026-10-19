import "server-only";
import { escapeRegex } from "@/lib/regex";
import { z } from "zod";
import { connectDb } from "@/lib/db";
import { randomBytes } from "node:crypto";
import { hashPassword, requireRole } from "@/modules/auth/service";
import { listDealerships } from "@/modules/dealerships/service";
import { UserModel } from "./model";
import { emailSchema, initializeUserSchema, staffFormSchema, staffUpdateSchema, userIdSchema, userSchema, type StaffForm, type User } from "./schema";
import { staffCopy } from "./copy";

export class StaffError extends Error {}

function toUser(document: { _id: { toString(): string }; dealershipId?: { toString(): string } | null; hiredAt?: Date | null }): User {
  return userSchema.parse({ ...document, id: document._id.toString(), dealershipId: document.dealershipId?.toString() ?? null,
    hiredAt: document.hiredAt ? new Date(document.hiredAt).toISOString() : null });
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

/** Owner quick-find over the team by name or email. */
export async function searchStaff(text: string, limit = 6): Promise<User[]> {
  await requireRole("owner");
  const search = escapeRegex(z.string().trim().min(1).max(120).parse(text));
  await connectDb();
  const documents = await UserModel.find({ $or: ["name", "email"].map((field) => ({ [field]: { $regex: search, $options: "i" } })) }).sort({ name: 1 }).limit(limit).lean().exec();
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

/** Owner view of one staff account (team profile). */
export async function getStaffMember(id: string): Promise<User | null> {
  await requireRole("owner");
  if (!userIdSchema.safeParse(id).success) return null;
  await connectDb();
  const document = await UserModel.findById(id).lean().exec();
  return document ? toUser(document) : null;
}

async function staffFields(data: StaffForm, previousDealershipId?: string | null) {
  const location = (await listDealerships()).find((entry) => entry.id === data.dealershipId);
  // An inactive location is kept only when it is the one already on the account.
  if (!location || (!location.active && location.id !== previousDealershipId)) throw new StaffError(staffCopy.errors.inactiveLocation);
  return { ...data, hiredAt: data.hiredAt ? new Date(data.hiredAt) : null };
}
function duplicateEmail(error: unknown): never {
  if (error instanceof Error && "code" in error && error.code === 11000) throw new StaffError(staffCopy.errors.duplicateEmail);
  throw error;
}
/** 16 URL-safe characters (96 bits); the hash is stored, the plain text is returned once. */
const temporaryPassword = () => randomBytes(12).toString("base64url");

/** Owner adds a salesperson with a generated temporary password, returned only from this call. */
export async function createSalesperson(input: unknown) {
  await requireRole("owner");
  const fields = await staffFields(staffFormSchema.parse(input));
  const password = temporaryPassword();
  const passwordHash = await hashPassword(password);
  await connectDb();
  await UserModel.init();
  try {
    const document = await UserModel.create({ ...fields, role: "salesperson", active: true, passwordHash });
    return { user: toUser(document.toObject()), temporaryPassword: password };
  } catch (error) { return duplicateEmail(error); }
}

/** Owner edits a salesperson's profile, location and target, or (de)activates the account. Owners are not editable here. */
export async function updateSalesperson(input: unknown) {
  await requireRole("owner");
  const { id, active, ...data } = staffUpdateSchema.parse(input);
  await connectDb();
  const previous = await UserModel.findOne({ _id: id, role: "salesperson" }).select("dealershipId").lean().exec();
  if (!previous) throw new StaffError(staffCopy.errors.notFound);
  const fields = await staffFields(data, previous.dealershipId?.toString() ?? null);
  try {
    const document = await UserModel.findOneAndUpdate({ _id: id, role: "salesperson" }, { $set: { ...fields, active } }, { returnDocument: "after", runValidators: true }).lean().exec();
    if (!document) throw new StaffError(staffCopy.errors.notFound);
    return toUser(document);
  } catch (error) { return duplicateEmail(error); }
}
