"use client";
import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { AlarmClock, BadgeDollarSign, Bell, Bot, CalendarClock, CarFront, ChevronRight, Hand, Hourglass, Mail, PhoneMissed, UserPlus, Wrench } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import type { StaffNotification } from "../service";
import type { NotificationKind } from "../schema";
import { markAllNotificationsReadAction, markNotificationReadAction } from "../actions";
import { alertsCopy as copy } from "../copy";

const icons: Record<string, typeof Bell> = {
  "lead.created": UserPlus, "lead.assigned": UserPlus, "lead.stage_changed": UserPlus,
  "appointment.booked": CalendarClock, "vehicle.status_changed": CarFront, "vehicle.price_changed": CarFront,
  "vehicle.repair_started": Wrench, "vehicle.repair_completed": Wrench, "vehicle.sold": BadgeDollarSign,
  "reminder.aging_inventory": Hourglass, "reminder.repair_overdue": Wrench, "reminder.uncontacted_lead": PhoneMissed, "reminder.appointment_today": AlarmClock,
  "assistant.handoff": Hand, "assistant.draft": Bot, "assistant.customer_reply": Mail,
} satisfies Record<NotificationKind, typeof Bell>;

/** `summary: false` drops the unread count and Mark all read row (e.g. a short excerpt on the dashboard). */
export function AlertsList({ notifications, times, summary = true }: { notifications: StaffNotification[]; times: Record<string, string>; summary?: boolean }) {
  const [pending, startTransition] = useTransition();
  const router = useRouter();
  const unread = notifications.filter((entry) => !entry.readAt).length;
  function open(entry: StaffNotification) {
    // Navigate immediately; marking read happens alongside and refreshes the bell.
    if (!entry.readAt) void markNotificationReadAction(entry.id).then(() => router.refresh());
    router.push(entry.link);
  }
  function markAll() {
    startTransition(async () => {
      const result = await markAllNotificationsReadAction().catch(() => ({ ok: false as const }));
      if (result.ok) toast.success(copy.allRead); else toast.error(copy.failed);
      router.refresh();
    });
  }
  return <div className="overflow-clip rounded-2xl border bg-card shadow-xs">
    {summary && <div className="flex min-h-14 flex-wrap items-center justify-between gap-2 border-b px-4 py-2 sm:px-5">
      <p className="flex items-center gap-2 text-sm font-medium">
        <span aria-hidden className={cn("size-2 rounded-full", unread ? "bg-primary ring-4 ring-primary/15" : "bg-muted-foreground/40")} />
        <span className="tabular-nums">{copy.unreadCount(unread)}</span>
      </p>
      {unread > 0 && <Button variant="outline" className="min-h-11" disabled={pending} onClick={markAll}>{pending ? copy.marking : copy.markAll}</Button>}
    </div>}
    <ul className="divide-y">{notifications.map((entry) => {
      const Icon = icons[entry.event] ?? Bell;
      return <li key={entry.id}>
        <button type="button" onClick={() => open(entry)} data-notification={entry.id} data-unread={entry.readAt ? undefined : "true"}
          className={cn("group flex min-h-16 w-full items-start gap-3.5 p-4 text-left transition-colors duration-150 hover:bg-muted/50 focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-ring sm:px-5", !entry.readAt && "bg-brand-soft/40")}>
          <span className={cn("flex size-10 shrink-0 items-center justify-center rounded-xl", entry.readAt ? "bg-muted text-muted-foreground" : "bg-brand-soft text-primary")}><Icon aria-hidden className="size-5" /></span>
          <span className="min-w-0 flex-1">
            <span className={cn("block break-words text-sm", entry.readAt ? "text-foreground/90" : "font-semibold")}>{entry.message}</span>
            <span className="mt-1 flex flex-wrap items-center gap-x-2 text-xs text-muted-foreground">
              <span className={cn("font-medium", !entry.readAt && "text-primary")}>{entry.readAt ? copy.read : copy.unread}</span>
              <span aria-hidden>·</span><span className="tabular-nums">{times[entry.id]}</span>
            </span>
          </span>
          {!entry.readAt ? <span aria-hidden className="mt-2 size-2.5 shrink-0 rounded-full bg-primary ring-4 ring-primary/15" />
            : <ChevronRight aria-hidden className="mt-2.5 size-4 shrink-0 text-muted-foreground opacity-0 transition-[opacity,transform] duration-200 group-hover:translate-x-0.5 group-hover:opacity-100" />}
        </button>
      </li>;
    })}</ul>
  </div>;
}
