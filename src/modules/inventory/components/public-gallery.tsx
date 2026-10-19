"use client";
import { useRef, useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { publicInventoryCopy as copy } from "../public-copy";
import { VehiclePhoto } from "./vehicle-photo";

/** Main photo with previous/next (buttons or a swipe) and a scrollable thumbnail strip. */
export function PublicGallery({ photos, title }: { photos: string[]; title: string }) {
  const [index, setIndex] = useState(0);
  const touchX = useRef<number | null>(null);
  const count = photos.length;
  const go = (next: number) => setIndex((next + count) % count);
  const arrow = "absolute top-1/2 flex size-11 -translate-y-1/2 items-center justify-center rounded-full bg-background/90 text-foreground shadow-md transition-colors hover:bg-background focus-visible:outline-2 focus-visible:outline-ring";
  return <section aria-label={copy.photos} className="space-y-3">
    <div className="relative" onTouchStart={(event) => { touchX.current = event.touches[0]?.clientX ?? null; }}
      onTouchEnd={(event) => {
        const start = touchX.current; touchX.current = null;
        const end = event.changedTouches[0]?.clientX;
        if (count > 1 && start !== null && end !== undefined && Math.abs(end - start) > 40) go(end < start ? index + 1 : index - 1);
      }}>
      <VehiclePhoto key={photos[index] ?? "none"} src={photos[index]} alt={copy.photo(title, index)} className="rounded-2xl" />
      {count > 1 && <>
        <button type="button" onClick={() => go(index - 1)} aria-label={copy.gallery.previous} className={cn(arrow, "left-3")}><ChevronLeft aria-hidden className="size-5" /></button>
        <button type="button" onClick={() => go(index + 1)} aria-label={copy.gallery.next} className={cn(arrow, "right-3")}><ChevronRight aria-hidden className="size-5" /></button>
        <span aria-live="polite" className="absolute bottom-3 right-3 rounded-full bg-black/60 px-2.5 py-1 text-xs font-medium tabular-nums text-white">{copy.gallery.count(index, count)}</span>
      </>}
    </div>
    {count > 1 && <ul className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1 sm:mx-0 sm:px-0">{photos.map((src, position) => <li key={`${src}-${position}`} className="shrink-0">
      <button type="button" onClick={() => setIndex(position)} aria-label={copy.gallery.show(position)} aria-current={position === index ? "true" : undefined}
        className={cn("block w-20 overflow-hidden rounded-lg ring-2 ring-offset-2 ring-offset-background transition focus-visible:outline-2 focus-visible:outline-ring sm:w-24", position === index ? "ring-primary" : "ring-transparent opacity-70 hover:opacity-100")}>
        <VehiclePhoto src={src} alt="" compact className="rounded-lg" />
      </button>
    </li>)}</ul>}
  </section>;
}
