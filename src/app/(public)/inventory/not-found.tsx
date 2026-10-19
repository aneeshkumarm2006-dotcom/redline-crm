import Link from "next/link";
import { CarFront } from "lucide-react";
import { publicInventoryCopy as copy } from "@/modules/inventory/public-copy";
export default function NotFound() {
  return <div className="page-gutter py-12 sm:py-20"><div className="mx-auto flex w-full max-w-xl flex-col items-center rounded-[1.75rem] bg-card p-8 text-center shadow-lg ring-1 ring-border">
    <span aria-hidden className="flex size-14 items-center justify-center rounded-2xl bg-muted text-muted-foreground"><CarFront className="size-6" /></span>
    <h1 className="font-display mt-5 text-2xl font-bold sm:text-3xl">{copy.missing}</h1>
    <p className="mt-2 leading-7 text-muted-foreground">{copy.missingHint}</p>
    <Link href="/inventory" className="mt-6 inline-flex min-h-11 items-center rounded-xl bg-primary px-5 text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary/90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring">{copy.back}</Link>
  </div></div>;
}
