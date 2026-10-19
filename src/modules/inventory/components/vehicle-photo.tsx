"use client";
import { useState } from "react";
import { CarFront } from "lucide-react";
import { cn } from "@/lib/utils";
import { inventoryCopy as copy } from "../copy";

/** `compact` is for thumbnails: the fallback shows only a small icon. */
export function VehiclePhoto({ src, alt, compact = false, className }: { src?: string; alt: string; compact?: boolean; className?: string }) {
  const [failed, setFailed] = useState<string>();
  return <div className={cn("flex aspect-[16/9] w-full items-center justify-center overflow-hidden rounded-xl bg-muted", className)}>
    {src && failed !== src ? /* URLs are user supplied; no remote image allowlist is required. */
      // eslint-disable-next-line @next/next/no-img-element
      <img src={src} alt={alt} className="h-full w-full object-cover" loading="lazy" referrerPolicy="no-referrer"
        ref={(element) => {
          // A failed SSR image may finish before hydration attaches onError.
          if (element?.complete && element.naturalWidth === 0) setFailed(src);
        }} onError={() => setFailed(src)} />
      : compact ? <CarFront aria-hidden="true" className="size-5 text-muted-foreground" />
      : <div className="flex flex-col items-center gap-2 text-muted-foreground"><CarFront aria-hidden="true" className="size-10" /><span className="text-xs">{copy.noPhoto}</span></div>}
  </div>;
}
