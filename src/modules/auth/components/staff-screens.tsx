import Link from "next/link";
import { ArrowLeft, ShieldAlert } from "lucide-react";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/shared/page-header";
import { requirePageUser } from "../page-guards";
import { authCopy } from "../copy";

export async function AccessDeniedScreen() {
  await requirePageUser();
  return <>
    <PageHeader title={authCopy.deniedTitle} />
    <section aria-label={authCopy.deniedTitle} className="flex flex-col items-start gap-5 rounded-2xl border bg-card p-5 shadow-xs sm:flex-row sm:items-center sm:p-6">
      <span aria-hidden className="flex size-12 shrink-0 items-center justify-center rounded-2xl bg-brand-soft text-primary"><ShieldAlert className="size-6" strokeWidth={1.75} /></span>
      <p className="min-w-0 max-w-3xl flex-1 text-[0.9375rem] leading-6">{authCopy.deniedDescription}</p>
      <Button asChild className="min-h-11 gap-2"><Link href="/crm"><ArrowLeft aria-hidden className="size-4" />{authCopy.back}</Link></Button>
    </section>
  </>;
}
