"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { Radio } from "lucide-react";
import { cn } from "@/lib/utils";
import type { FeedItem } from "../schema";
import { getCoordinatorFeedAction } from "../actions";
import { coordinatorCopy as copy } from "../copy";
import { JourneyDots } from "./journey-stepper";

const POLL_MS = 20_000;

/**
 * Recent lead journeys. Like the notification bell, it polls every 20 seconds while the tab is visible and
 * highlights rows whose latest event changed since the last poll.
 */
export function LiveFeed({ initial, initialAt, timeZone }: { initial: FeedItem[]; initialAt: string; timeZone: string }) {
  const [items, setItems] = useState(initial);
  const [at, setAt] = useState(initialAt);
  const [fresh, setFresh] = useState<Set<string>>(new Set());
  useEffect(() => {
    let active = true;
    let previous = new Map(initial.map((item) => [item.id, item.latest?.at ?? ""]));
    async function check() {
      if (document.visibilityState !== "visible") return;
      const result = await getCoordinatorFeedAction().catch(() => null);
      if (!active || !result) return;
      setFresh(new Set(result.items.filter((item) => previous.get(item.id) !== (item.latest?.at ?? "")).map((item) => item.id)));
      previous = new Map(result.items.map((item) => [item.id, item.latest?.at ?? ""]));
      setItems(result.items);
      setAt(result.at);
    }
    const timer = window.setInterval(check, POLL_MS);
    document.addEventListener("visibilitychange", check);
    return () => { active = false; window.clearInterval(timer); document.removeEventListener("visibilitychange", check); };
  }, [initial]);
  const time = new Intl.DateTimeFormat("en-CA", { hour: "numeric", minute: "2-digit", timeZone });
  const when = new Intl.DateTimeFormat("en-CA", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit", timeZone });
  return <section aria-labelledby="coordinator-feed" className="space-y-3">
    <div className="flex flex-wrap items-end justify-between gap-2">
      <div>
        <h2 id="coordinator-feed" className="flex items-center gap-2 text-lg font-semibold"><Radio aria-hidden className="size-4 text-primary" />{copy.feed}</h2>
        <p className="text-sm text-muted-foreground">{copy.feedHint}</p>
      </div>
      <p aria-live="polite" className="text-xs text-muted-foreground">{copy.updated(time.format(new Date(at)))}</p>
    </div>
    {!items.length ? <p className="rounded-xl border border-dashed bg-card p-4 text-sm text-muted-foreground">{copy.feedEmpty}</p>
      : <ul className="divide-y rounded-xl border bg-card">{items.map((item) => <li key={item.id}>
        <Link href={`/crm/leads/${item.id}`} className={cn("flex min-w-0 flex-col gap-2 p-4 transition-colors hover:bg-muted/40 focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-ring sm:flex-row sm:items-center sm:gap-4",
          fresh.has(item.id) && "bg-brand-soft")}>
          <span className="min-w-0 flex-1">
            <span className="block break-words text-sm font-semibold">{item.name}</span>
            <span className="block truncate text-xs text-muted-foreground">{item.vehicle} · {item.assignee ?? copy.unassignedLead}</span>
            {item.latest && <span className="mt-1 block break-words text-xs">
              {item.latest.message} <span className="text-muted-foreground">· {item.latest.by} · <time dateTime={item.latest.at}>{when.format(new Date(item.latest.at))}</time></span>
            </span>}
          </span>
          <JourneyDots steps={item.steps} className="sm:w-40" />
        </Link>
      </li>)}</ul>}
  </section>;
}
