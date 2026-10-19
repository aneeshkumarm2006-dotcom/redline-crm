"use server";
import { revalidatePath } from "next/cache";
import { ZodError } from "zod";
import { AuthorizationError } from "@/modules/auth/service";
import { createGarage, GarageError, updateGarage } from "./service";
import { garagesCopy } from "./copy";

export type GarageActionResult = { ok: true } | { ok: false; message: string };
function failure(error: unknown): GarageActionResult {
  return { ok: false, message: error instanceof GarageError ? error.message : error instanceof AuthorizationError ? garagesCopy.admin.ownerOnly
    : error instanceof ZodError ? error.issues.map((issue) => `${issue.path.join(".")}: ${issue.message}`).join(" ") : garagesCopy.admin.failed };
}
export async function saveGarageAction(input: unknown): Promise<GarageActionResult> {
  try {
    if (input && typeof input === "object" && "id" in input && input.id) await updateGarage(input); else await createGarage(input);
  } catch (error) { return failure(error); }
  revalidatePath("/crm", "layout");
  return { ok: true };
}
