import "server-only";
import { z } from "zod";
import { connectDb } from "@/lib/db";
import { objectIdSchema } from "@/lib/data-schema";
import { requireRole } from "@/modules/auth/service";
import { getSettings } from "@/modules/settings/service";
import { GarageModel } from "./model";
import { garageInputSchema, garageSchema, type Garage } from "./schema";
import { garagesCopy } from "./copy";

function toGarage(document: unknown): Garage {
  const { _id, __v, createdAt, updatedAt, ...data } = JSON.parse(JSON.stringify(document));
  void __v; void createdAt; void updatedAt;
  return garageSchema.parse({ ...data, id: _id });
}

/** Every staff member may read garages: inventory rows show where a car is being repaired. */
export async function listGarages(): Promise<Garage[]> {
  await requireRole();
  await connectDb();
  const documents = await GarageModel.find().sort({ name: 1 }).lean().exec();
  return documents.map(toGarage);
}

export async function getGarage(id: string): Promise<Garage | null> {
  await requireRole();
  if (!objectIdSchema.safeParse(id).success) return null;
  await connectDb();
  const document = await GarageModel.findById(id).lean().exec();
  return document ? toGarage(document) : null;
}

/** Internal event/reminder context, including inactive garages; never invokes a staff session. */
export async function getGarageForAutomation(id: string) {
  await connectDb();
  const document = await GarageModel.findById(objectIdSchema.parse(id)).lean().exec();
  if (!document) throw new Error("Automation garage missing.");
  return toGarage(document);
}

/** Destructive internal CLI import only; never expose through a server action. */
export async function replaceGaragesForSeed(input: unknown) {
  const records = z.array(garageSchema).parse(input);
  const settings = await getSettings();
  const keys = new Set(settings.repairTypes.map((entry) => entry.key));
  if (records.some((record) => record.specialties.some((key) => !keys.has(key)))) {
    throw new Error("Record references an unknown settings key.");
  }
  await connectDb();
  await GarageModel.init();
  const documents = records.map(({ id, ...data }) => new GarageModel({ _id: id, ...data }));
  // Validate all documents before clearing this collection.
  for (const document of documents) await document.validate();
  await GarageModel.deleteMany({}).exec();
  if (documents.length) await GarageModel.insertMany(documents);
  return documents.length;
}

export class GarageError extends Error {}
async function checkedGarage(input: unknown) {
  const data = garageInputSchema.parse(input);
  const settings = await getSettings();
  const keys = new Set(settings.repairTypes.map((entry) => entry.key));
  if (data.specialties.some((key) => !keys.has(key))) throw new GarageError(garagesCopy.admin.unknownSpecialty);
  return data;
}

/** Owner: adds a partner garage. */
export async function createGarage(input: unknown) {
  await requireRole("owner");
  const data = await checkedGarage(input);
  await connectDb();
  const document = await GarageModel.create(data);
  return toGarage(document.toObject());
}

/** Owner: edits a garage. Deactivating keeps its repair history; it just stops being offered for new repairs. */
export async function updateGarage(input: unknown) {
  await requireRole("owner");
  const { id, ...rest } = z.object({ id: objectIdSchema }).passthrough().parse(input);
  const data = await checkedGarage(rest);
  await connectDb();
  const document = await GarageModel.findByIdAndUpdate(id, { $set: data }, { returnDocument: "after", runValidators: true }).lean().exec();
  if (!document) throw new GarageError(garagesCopy.admin.notFound);
  return toGarage(document);
}

/** Owner settings screen: which of these repair type keys are still listed as a garage specialty. */
export async function findGarageSpecialtiesInUse(keys: string[]) {
  await requireRole("owner");
  const wanted = z.array(z.string().max(80)).parse(keys);
  if (!wanted.length) return [];
  await connectDb();
  return (await GarageModel.distinct("specialties", { specialties: { $in: wanted } }).exec()).map(String).filter((key) => wanted.includes(key));
}
