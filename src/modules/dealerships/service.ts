import "server-only";
import { z } from "zod";
import { connectDb } from "@/lib/db";
import { DealershipModel } from "./model";
import { dealershipSchema } from "./schema";
import { requireRole } from "@/modules/auth/service";
import { objectIdSchema } from "@/lib/data-schema";

/** Internal event context, including historical/inactive locations. */
export async function getDealershipForAutomation(id: string) {
  await connectDb();
  const document = await DealershipModel.findById(objectIdSchema.parse(id)).lean().exec();
  if (!document) throw new Error("Automation dealership missing.");
  return { name: document.name, address: document.address, phone: document.phone };
}

/** Active locations and public contact details only. */
export async function listPublicDealerships() {
  await connectDb();
  const documents = await DealershipModel.find({ active: true }).select("name address phone").sort({ name: 1 }).lean().exec();
  return documents.map((document) => ({ id: document._id.toString(), name: document.name, address: document.address, phone: document.phone }));
}

export async function listDealerships() {
  await requireRole();
  await connectDb();
  const documents = await DealershipModel.find().sort({ name: 1 }).lean().exec();
  return documents.map((document) => dealershipSchema.parse({
    name: document.name, address: document.address, phone: document.phone, active: document.active, id: document._id.toString(),
  }));
}

/** Destructive internal CLI import only; never expose through a server action. */
export async function replaceDealershipsForSeed(input: unknown) {
  const records = z.array(dealershipSchema).parse(input);
  await connectDb();
  await DealershipModel.init();
  const documents = records.map(({ id, ...data }) => new DealershipModel({ _id: id, ...data }));
  // Validate all documents before clearing this collection.
  for (const document of documents) await document.validate();
  await DealershipModel.deleteMany({}).exec();
  if (documents.length) await DealershipModel.insertMany(documents);
  return documents.length;
}
