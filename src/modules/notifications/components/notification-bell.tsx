"use client";
import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { toast } from "sonner";
import { Bell } from "lucide-react";
import { getUnreadSummaryAction } from "../actions";
import { alertsCopy as copy } from "../copy";

const POLL_MS = 20_000;

/**
 * Header bell with the unread count. It refreshes on navigation and every few seconds while the tab is
 * visible, and toasts when a new alert arrives so staff notice leads and status changes without reloading.
 */
export function NotificationBell({ initialUnread, initialLatestId }: { initialUnread: number; initialLatestId: string | null }) {
  const [unread, setUnread] = useState(initialUnread);
  const latestId = useRef(initialLatestId);
  const pathname = usePathname();
  const router = useRouter();
  useEffect(() => {
    let active = true;
    async function check() {
      if (document.visibilityState !== "visible") return;
      const summary = await getUnreadSummaryAction().catch(() => null);
      if (!active || !summary) return;
      setUnread(summary.unread);
      const latest = summary.latest;
      if (latest && latest.id !== latestId.current) {
        latestId.current = latest.id;
        toast(copy.newAlert, { description: latest.message, action: { label: copy.view, onClick: () => router.push(latest.link) } });
        router.refresh();
      }
    }
    void check();
    const timer = window.setInterval(check, POLL_MS);
    document.addEventListener("visibilitychange", check);
    return () => { active = false; window.clearInterval(timer); document.removeEventListener("visibilitychange", check); };
  }, [pathname, router]);
  return <Link href="/crm/alerts" aria-label={copy.bell(unread)} data-unread-count={unread}
    className="relative flex size-11 shrink-0 items-center justify-center rounded-xl text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring">
    <Bell aria-hidden className="size-5" />
    {unread > 0 && <span aria-hidden className="absolute top-1 right-1 flex min-w-5 items-center justify-center rounded-full bg-primary px-1 text-[11px] font-semibold leading-5 text-primary-foreground tabular-nums">
      {unread > 99 ? "99+" : unread}
    </span>}
  </Link>;
}
