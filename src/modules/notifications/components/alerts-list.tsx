"use client";
import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { AlarmClock, BadgeDollarSign, Bell, CalendarClock, CarFront, Hourglass, PhoneMissed, UserPlus, Wrench } from "lucide-react";
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
  return <>
    {summary && <div className="flex min-h-11 flex-wrap items-center justify-between gap-2">
      <p className="text-sm text-muted-foreground">{copy.unreadCount(unread)}</p>
      {unread > 0 && <Button variant="outline" className="min-h-11" disabled={pending} onClick={markAll}>{pending ? copy.marking : copy.markAll}</Button>}
    </div>}
    <ul className="divide-y rounded-xl border bg-card">{notifications.map((entry) => {
      const Icon = icons[entry.event] ?? Bell;
      return <li key={entry.id}>
        <button type="button" onClick={() => open(entry)} data-notification={entry.id} data-unread={entry.readAt ? undefined : "true"}
          className={`flex min-h-16 w-full items-start gap-3 p-4 text-left transition-colors hover:bg-muted/40 focus-visible:outline-2 focus-visible:outline-ring ${entry.readAt ? "" : "bg-primary/5"}`}>
          <span className={`flex size-10 shrink-0 items-center justify-center rounded-xl ${entry.readAt ? "bg-muted text-muted-foreground" : "bg-primary text-primary-foreground"}`}><Icon aria-hidden className="size-5" /></span>
          <span className="min-w-0 flex-1">
            <span className={`block break-words text-sm ${entry.readAt ? "" : "font-semibold"}`}>{entry.message}</span>
            <span className="mt-1 block text-xs text-muted-foreground">{entry.readAt ? copy.read : copy.unread} · {times[entry.id]}</span>
          </span>
          {!entry.readAt && <span aria-hidden className="mt-1.5 size-2.5 shrink-0 rounded-full bg-primary" />}
        </button>
      </li>;
    })}</ul>
  </>;
}
