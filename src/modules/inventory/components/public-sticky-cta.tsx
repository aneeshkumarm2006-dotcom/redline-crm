"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { cn } from "@/lib/utils";
import { publicInventoryCopy as copy } from "../public-copy";

/**
 * Phone-only bar pinned to the bottom of a vehicle page: price plus Test drive / Inquire, both jumping to the
 * inquiry form. It hides while the form itself is on screen, so it never covers the fields being filled in.
 */
export function PublicStickyCta({ price, testDriveHref, inquireHref, targetId }: { price: string; testDriveHref: string; inquireHref: string; targetId: string }) {
  const [hidden, setHidden] = useState(false);
  useEffect(() => {
    const target = document.getElementById(targetId);
    if (!target || typeof IntersectionObserver === "undefined") return;
    const observer = new IntersectionObserver(([entry]) => setHidden(Boolean(entry?.isIntersecting)), { threshold: 0.15 });
    observer.observe(target);
    return () => observer.disconnect();
  }, [targetId]);
  const button = "inline-flex min-h-12 items-center justify-center rounded-xl px-4 text-sm font-semibold transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring";
  return <div aria-label={copy.cta.label} role="region" aria-hidden={hidden || undefined} inert={hidden}
    className={cn("fixed inset-x-0 bottom-0 z-40 border-t bg-white/90 px-4 pt-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] shadow-xl backdrop-blur-md transition-transform duration-200 ease-out lg:hidden dark:bg-card/90",
      hidden && "translate-y-full")}>
    <div className="flex items-center gap-2.5">
      <p className="font-display min-w-0 flex-1 truncate text-xl font-bold tabular-nums">{price}</p>
      <Link href={testDriveHref} className={cn(button, "bg-ink text-ink-foreground hover:bg-ink/90")}>{copy.cta.testDrive}</Link>
      <Link href={inquireHref} className={cn(button, "bg-primary text-primary-foreground shadow-[0_6px_16px_-6px_color-mix(in_oklab,var(--primary)_70%,transparent)] hover:bg-primary/90")}>{copy.cta.inquire}</Link>
    </div>
  </div>;
}
