"use server";
import { revalidatePath } from "next/cache";
import { ZodError } from "zod";
import { AuthorizationError } from "@/modules/auth/service";
import { saveSettingsSection } from "./admin-service";
import { SettingsError } from "./service";
import type { SettingsActionResult } from "./schema";
import { settingsCopy } from "./copy";

export async function saveSettingsSectionAction(input: unknown): Promise<SettingsActionResult> {
  try { await saveSettingsSection(input); }
  catch (error) {
    return { ok: false, message: error instanceof SettingsError ? error.message : error instanceof AuthorizationError ? settingsCopy.ownerOnly
      : error instanceof ZodError ? error.issues.map((issue) => issue.message).join(" ") : settingsCopy.failed };
  }
  // Labels, colours and branding appear on every screen, public pages included.
  revalidatePath("/", "layout");
  return { ok: true };
}
