import "server-only";
import type { z } from "zod";

/** Validate full documents on save/insertMany as well as at service boundaries.
 * ObjectIds and Dates become their JSON-safe DTO representations. Query updates
 * must be validated in their owning service (save hooks do not run on updates).
 */
export function validateRecord(document: { toObject(): unknown }, schema: z.ZodType) {
  const { _id, __v, createdAt, updatedAt, ...data } = JSON.parse(JSON.stringify(document.toObject()));
  void __v; void createdAt; void updatedAt;
  schema.parse({ ...data, id: _id });
}
