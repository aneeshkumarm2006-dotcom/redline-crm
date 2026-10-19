import Link from "next/link";
import { CalendarClock, CarFront, CheckCircle2, ChevronRight, Phone, UserX, Wrench, type LucideIcon } from "lucide-react";
import type { NeedsAttention as Attention } from "@/modules/automations/reminders";
import { alertsCopy as copy } from "../copy";

type Item = { key: string; icon: LucideIcon; title: string; hint: string; href: string; tone: "danger" | "warning" };

/**
 * The short list of things waiting on this person, each linking to the screen where it gets fixed.
 * `dealershipId` (a location filter) carries over to the inventory links.
 */
export function NeedsAttention({ data, repairStatusKey, dealershipId }: { data: Attention; repairStatusKey: string; dealershipId?: string }) {
  const owner = data.role === "owner";
  const location = dealershipId ? `&dealershipId=${encodeURIComponent(dealershipId)}` : "";
  const { warnDays, criticalDays, repairOverdueDays, uncontactedLeadHours } = data.limits;
  const items: Item[] = [
    { key: "uncontacted", icon: Phone, title: copy.attention.uncontacted(data.uncontacted), hint: copy.attention.uncontactedHint(uncontactedLeadHours),
      href: owner ? "/crm/coordinator#queue-uncontacted" : "/crm/leads", tone: "danger" as const, count: data.uncontacted },
    { key: "unassigned", icon: UserX, title: copy.attention.unassigned(data.unassigned), hint: copy.attention.unassignedHint,
      href: "/crm/coordinator#queue-unassigned", tone: "danger" as const, count: owner ? data.unassigned : 0 },
    { key: "appointments", icon: CalendarClock, title: copy.attention.appointments(data.appointmentsToday), hint: copy.attention.appointmentsHint,
      href: "/crm/leads/appointments", tone: "warning" as const, count: data.appointmentsToday },
    { key: "overdue", icon: Wrench, title: copy.attention.overdue(data.overdue), hint: copy.attention.overdueHint(repairOverdueDays),
      href: owner && !dealershipId ? "/crm/garages" : `/crm/inventory?status=${encodeURIComponent(repairStatusKey)}${location}`, tone: "danger" as const, count: data.overdue },
    { key: "aging", icon: CarFront, title: copy.attention.aging(data.aging, warnDays), hint: copy.attention.agingHint(data.critical, criticalDays),
      href: `/crm/inventory?aging=1${location}`, tone: data.critical ? "danger" as const : "warning" as const, count: data.aging },
  ].filter((entry) => entry.count > 0);
  return <section aria-labelledby="needs-attention" className="space-y-3">
    <div><h2 id="needs-attention" className="text-lg font-semibold">{copy.needsAttention}</h2><p className="text-sm text-muted-foreground">{copy.needsAttentionHint}</p></div>
    {!items.length
      ? <p className="flex min-h-14 items-center gap-3 rounded-xl border bg-card p-4 text-sm"><CheckCircle2 aria-hidden className="size-5 shrink-0 text-success" />{copy.allClear}</p>
      : <ul className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3">{items.map(({ key, icon: Icon, title, hint, href, tone }) => <li key={key}>
        <Link href={href} className="flex min-h-16 items-center gap-3 rounded-xl border bg-card p-4 transition-colors hover:bg-muted/40 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring">
          <span className={`flex size-10 shrink-0 items-center justify-center rounded-xl ${tone === "danger" ? "bg-danger/12 text-danger" : "bg-warning/12 text-warning"}`}><Icon aria-hidden className="size-5" /></span>
          <span className="min-w-0 flex-1"><span className="block break-words text-sm font-semibold">{title}</span><span className="block break-words text-xs text-muted-foreground">{hint}</span></span>
          <ChevronRight aria-hidden className="size-4 shrink-0 text-muted-foreground" />
        </Link>
      </li>)}</ul>}
  </section>;
}
