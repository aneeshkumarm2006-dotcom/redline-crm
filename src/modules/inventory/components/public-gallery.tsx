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
  const arrow = "absolute top-1/2 flex size-11 -translate-y-1/2 items-center justify-center rounded-full bg-background/95 text-foreground shadow-lg backdrop-blur transition-[background-color,transform] duration-150 ease-out hover:bg-background active:scale-95 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring";
  return <section aria-label={copy.photos} className="space-y-3">
    <div className="relative" onTouchStart={(event) => { touchX.current = event.touches[0]?.clientX ?? null; }}
      onTouchEnd={(event) => {
        const start = touchX.current; touchX.current = null;
        const end = event.changedTouches[0]?.clientX;
        if (count > 1 && start !== null && end !== undefined && Math.abs(end - start) > 40) go(end < start ? index + 1 : index - 1);
      }}>
      <VehiclePhoto key={photos[index] ?? "none"} src={photos[index]} alt={copy.photo(title, index)} className="aspect-[16/10] rounded-[1.75rem] shadow-md" />
      {count > 1 && <>
        <button type="button" onClick={() => go(index - 1)} aria-label={copy.gallery.previous} className={cn(arrow, "left-4")}><ChevronLeft aria-hidden className="size-5" /></button>
        <button type="button" onClick={() => go(index + 1)} aria-label={copy.gallery.next} className={cn(arrow, "right-4")}><ChevronRight aria-hidden className="size-5" /></button>
        <span aria-live="polite" className="absolute right-4 bottom-4 rounded-full bg-ink/80 px-3 py-1 text-xs font-semibold tabular-nums text-ink-foreground backdrop-blur">{copy.gallery.count(index, count)}</span>
      </>}
    </div>
    {count > 1 && <ul className="scrollbar-thin -mx-4 flex gap-3 overflow-x-auto px-4 py-1 sm:mx-0 sm:px-1">{photos.map((src, position) => <li key={`${src}-${position}`} className="shrink-0">
      <button type="button" onClick={() => setIndex(position)} aria-label={copy.gallery.show(position)} aria-current={position === index ? "true" : undefined}
        className={cn("block w-24 overflow-hidden rounded-xl ring-2 ring-offset-2 ring-offset-surface transition-[opacity,box-shadow] duration-150 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-ring sm:w-28", position === index ? "ring-primary" : "ring-transparent opacity-70 hover:opacity-100")}>
        <VehiclePhoto src={src} alt="" compact className="aspect-[16/10] rounded-xl" />
      </button>
    </li>)}</ul>}
  </section>;
}
