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
  const button = "inline-flex min-h-11 items-center justify-center rounded-lg px-4 text-sm font-semibold focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring";
  return <div aria-label={copy.cta.label} role="region" aria-hidden={hidden || undefined} inert={hidden}
    className={cn("fixed inset-x-0 bottom-0 z-40 border-t bg-background/95 px-4 pt-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] shadow-[0_-4px_16px_rgba(0,0,0,0.06)] backdrop-blur transition-transform lg:hidden",
      hidden && "translate-y-full")}>
    <div className="mx-auto flex max-w-7xl items-center gap-3">
      <p className="min-w-0 flex-1 truncate text-lg font-semibold tabular-nums">{price}</p>
      <Link href={testDriveHref} className={cn(button, "border bg-background")}>{copy.cta.testDrive}</Link>
      <Link href={inquireHref} className={cn(button, "bg-primary text-primary-foreground")}>{copy.cta.inquire}</Link>
    </div>
  </div>;
}
