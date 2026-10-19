import { z } from "zod";

export const searchQuerySchema = z.string().trim().max(120);

export type SearchHit = {
  id: string;
  kind: "vehicle" | "lead" | "staff";
  title: string;
  detail: string;
  href: string;
  /** Settings status or stage, shown as a coloured dot plus label. */
  status?: { label: string; color: string };
};
export type SearchResults = { vehicles: SearchHit[]; leads: SearchHit[]; staff: SearchHit[] };
export const emptyResults: SearchResults = { vehicles: [], leads: [], staff: [] };
