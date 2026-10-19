import { Construction } from "lucide-react";
import { requirePageUser } from "@/modules/auth/page-guards";
import { EmptyState } from "../empty-state";
import { PageHeader } from "../page-header";
import { shellCopy } from "./copy";

/** Owner-only placeholder for navigation sections whose screens arrive in later stages. */
export async function ComingSoonScreen({ section }: { section: keyof typeof shellCopy.descriptions }) {
  await requirePageUser("owner");
  return <>
    <PageHeader title={shellCopy.sections[section].label} description={shellCopy.descriptions[section]} />
    <EmptyState icon={Construction} title={shellCopy.comingSoon} description={shellCopy.comingSoonHint} />
  </>;
}
