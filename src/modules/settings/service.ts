import "server-only";

import { connectDb } from "@/lib/db";
import { SETTINGS_ID, SettingsModel } from "./model";
import { assistantSettingsSchema, settingsReferenceProblems, settingsSchema, type Settings } from "./schema";
import { requireRole } from "@/modules/auth/service";
import { recipeToggleSchema } from "@/modules/automations/schema";

const CACHE_MS = 60_000;
type SettingsCache = { value?: Settings; expiresAt: number; revision: number; pending?: Promise<Settings> };
const globalSettings = globalThis as typeof globalThis & { redlineSettings?: SettingsCache };
const cache = (globalSettings.redlineSettings ??= { expiresAt: 0, revision: 0 });

export function invalidateSettingsCache() {
  cache.value = undefined;
  cache.expiresAt = 0;
  cache.pending = undefined;
  cache.revision++;
}

/** Server-only: callers receive a plain defensive copy, never a Mongoose document. */
// The TTL uses the monotonic clock: unaffected by wall-clock changes, and Next does not treat it
// as a time-dependent render value (Date.now() during a prerender is reported as an error).
export async function getSettings(): Promise<Settings> {
  if (cache.value && cache.expiresAt > performance.now()) return structuredClone(cache.value);
  if (!cache.pending) {
    const revision = cache.revision;
    const pending = (async () => {
      await connectDb();
      const document = await SettingsModel.findById(SETTINGS_ID).lean().exec();
      if (!document) throw new Error("Settings are missing. Run npm run seed:settings.");
      const { _id, __v, createdAt, updatedAt, ...data } = document as typeof document & { __v?: number; createdAt?: Date; updatedAt?: Date };
      void _id; void __v; void createdAt; void updatedAt;
      const settings = settingsSchema.parse(data);
      if (cache.revision === revision) {
        cache.value = settings;
        cache.expiresAt = performance.now() + CACHE_MS;
      }
      return settings;
    })();
    cache.pending = pending;
  }
  const pending = cache.pending;
  try { return structuredClone(await pending); }
  finally { if (cache.pending === pending) cache.pending = undefined; }
}

/** Owner: turns one automation recipe on or off. Takes effect at once in this process; other instances within the cache TTL. */
export async function setAutomationEnabled(input: unknown) {
  await requireRole("owner");
  const { key, enabled } = recipeToggleSchema.parse(input);
  await connectDb();
  const result = await SettingsModel.updateOne({ _id: SETTINGS_ID }, { $set: { [`automations.${key}`]: enabled } }, { runValidators: true }).exec();
  if (!result.matchedCount) throw new Error("Settings are missing. Run npm run seed:settings.");
  invalidateSettingsCache();
}

/** Owner: saves the virtual assistant's configuration. Takes effect at once in this process; other instances within the cache TTL. */
export async function setAssistantSettings(input: unknown) {
  await requireRole("owner");
  const assistant = assistantSettingsSchema.parse(input);
  await connectDb();
  const result = await SettingsModel.updateOne({ _id: SETTINGS_ID }, { $set: { assistant } }, { runValidators: true }).exec();
  if (!result.matchedCount) throw new Error("Settings are missing. Run npm run seed:settings.");
  invalidateSettingsCache();
}

export class SettingsError extends Error {}

/**
 * Owner: replaces the whole configuration after validating it and its cross-references (status roles, won/lost/
 * appointment stages, public statuses and inquiry source). Callers check that removed keys are unused first.
 */
export async function replaceSettings(input: unknown) {
  await requireRole("owner");
  const settings = settingsSchema.parse(input);
  const problems = settingsReferenceProblems(settings);
  if (problems.length) throw new SettingsError(problems.join(" "));
  await connectDb();
  const result = await SettingsModel.updateOne({ _id: SETTINGS_ID }, { $set: settings }, { runValidators: true }).exec();
  if (!result.matchedCount) throw new Error("Settings are missing. Run npm run seed:settings.");
  invalidateSettingsCache();
}

/** CLI bootstrap only. Insert if absent; never overwrite existing client configuration. */
export async function initializeSettings(input: unknown): Promise<Settings> {
  const settings = settingsSchema.parse(input);
  await connectDb();
  try {
    await SettingsModel.updateOne({ _id: SETTINGS_ID }, { $setOnInsert: settings }, { upsert: true, runValidators: true }).exec();
  } catch (error) {
    // Two bootstraps racing on the singleton ID are harmless.
    if (!(error instanceof Error && "code" in error && error.code === 11000)) throw error;
  }
  invalidateSettingsCache();
  return getSettings();
}

/** Destructive internal CLI reset; replaces configuration with the demo defaults. */
export async function replaceSettingsForSeed(input: unknown) {
  const settings = settingsSchema.parse(input);
  await connectDb();
  await SettingsModel.deleteMany({}).exec();
  await SettingsModel.create({ _id: SETTINGS_ID, ...settings });
  invalidateSettingsCache();
}
