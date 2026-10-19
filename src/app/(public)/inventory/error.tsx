"use client";
import { RotateCcw, TriangleAlert } from "lucide-react";
import { publicInventoryCopy as copy } from "@/modules/inventory/public-copy";
export default function ErrorPage({ reset }: { reset: () => void }) {
  return <div className="page-gutter py-12 sm:py-20"><div role="alert" className="mx-auto flex w-full max-w-xl flex-col items-center rounded-[1.75rem] bg-card p-8 text-center shadow-lg ring-1 ring-border">
    <span aria-hidden className="flex size-14 items-center justify-center rounded-2xl bg-brand-soft text-primary"><TriangleAlert className="size-6" /></span>
    <p className="font-display mt-5 text-xl font-semibold">{copy.error}</p>
    <button type="button" onClick={reset} className="mt-6 inline-flex min-h-11 items-center gap-2 rounded-xl bg-ink px-5 text-sm font-semibold text-ink-foreground transition-colors hover:bg-ink/90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"><RotateCcw aria-hidden className="size-4" />{copy.retry}</button>
  </div></div>;
}
