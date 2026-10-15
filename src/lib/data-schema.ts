import { z } from "zod";

/** JSON-safe primitives shared by forms, services and the demo importer. */
export const objectIdSchema = z.string().regex(/^[a-f0-9]{24}$/i);
export const keySchema = z.string().regex(/^[a-z][a-z0-9_]*$/).max(80);
export const dateTimeSchema = z.string().datetime({ offset: true });
export const moneySchema = z.number().finite().nonnegative().max(100_000_000)
  .refine((value) => Math.abs(value * 100 - Math.round(value * 100)) < 0.00001, "Use at most two decimal places.");
export const textSchema = z.string().trim().min(1).max(120);
export const photoSchema = z.string().max(2048).refine((value) =>
  /^https?:\/\//.test(value) ? URL.canParse(value) : /^\/(?!\/)[a-zA-Z0-9/_\-.]+$/.test(value),
"Use an HTTP(S) URL or a local asset path.");
