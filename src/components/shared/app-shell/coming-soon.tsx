import { Construction } from "lucide-react";
import { requirePageUser } from "@/modules/auth/page-guards";
import { EmptyState } from "../empty-state";
import { shellCopy } from "./copy";

/** Owner-only placeholder for navigation sections whose screens arrive in later stages. */
export async function ComingSoonScreen({ section }: { section: keyof typeof shellCopy.descriptions }) {
  await requirePageUser("owner");
  return <>
    <header><h1 className="text-3xl font-semibold">{shellCopy.sections[section].label}</h1><p className="mt-1 text-sm text-muted-foreground">{shellCopy.descriptions[section]}</p></header>
    <EmptyState icon={Construction} title={shellCopy.comingSoon} description={shellCopy.comingSoonHint} />
  </>;
}
