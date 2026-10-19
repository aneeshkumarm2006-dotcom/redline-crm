import Link from "next/link";
import { CalendarClock, CarFront, CheckCircle2, ChevronRight, Phone, UserX, Wrench, type LucideIcon } from "lucide-react";
import type { NeedsAttention as Attention } from "@/modules/automations/reminders";
import { cn } from "@/lib/utils";
import { alertsCopy as copy } from "../copy";

type Item = { key: string; icon: LucideIcon; title: string; hint: string; href: string; tone: "danger" | "warning" };

/**
 * The short list of things waiting on this person, each linking to the screen where it gets fixed.
 * `dealershipId` (a location filter) carries over to the inventory links.
 */
export function NeedsAttention({ data, repairStatusKey, dealershipId, variant = "default" }: { data: Attention; repairStatusKey: string; dealershipId?: string; variant?: "default" | "ink" }) {
  const ink = variant === "ink";
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
  return <section aria-labelledby="needs-attention" className={cn("space-y-4", ink && "h-full rounded-[1.25rem] bg-ink p-5 text-ink-foreground sm:p-6")}>
    <div><h2 id="needs-attention" className="text-lg font-semibold tracking-tight">{copy.needsAttention}</h2><p className={cn("mt-0.5 text-sm", ink ? "text-ink-muted" : "text-muted-foreground")}>{copy.needsAttentionHint}</p></div>
    {!items.length
      ? <p className={cn("flex min-h-14 items-center gap-3 rounded-2xl p-5 text-sm", ink ? "bg-white/5" : "border bg-card shadow-xs")}><CheckCircle2 aria-hidden className="size-5 shrink-0 text-success" />{copy.allClear}</p>
      : <ul className={cn("grid gap-3 sm:grid-cols-2", !ink && "2xl:grid-cols-3")}>{items.map(({ key, icon: Icon, title, hint, href, tone }) => <li key={key}>
        <Link href={href} className={cn("group flex h-full min-h-[4.5rem] items-center gap-3.5 rounded-2xl p-4 transition-[background-color,border-color,box-shadow,transform] duration-200 ease-out hover:-translate-y-0.5 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring",
          ink ? "border border-white/[0.07] bg-white/[0.05] hover:bg-white/[0.09]" : "border bg-card shadow-xs hover:border-foreground/15 hover:shadow-md")}>
          <span className={cn("flex size-11 shrink-0 items-center justify-center rounded-xl",
            ink ? (tone === "danger" ? "bg-primary text-primary-foreground" : "bg-chart-4 text-[var(--foreground)] dark:text-ink") : (tone === "danger" ? "bg-danger/12 text-danger" : "bg-warning/12 text-warning"))}><Icon aria-hidden className="size-5" /></span>
          <span className="min-w-0 flex-1"><span className="block break-words text-sm font-semibold">{title}</span><span className={cn("block break-words text-xs", ink ? "text-ink-muted" : "text-muted-foreground")}>{hint}</span></span>
          <ChevronRight aria-hidden className={cn("size-4 shrink-0 transition-transform duration-200 group-hover:translate-x-0.5", ink ? "text-ink-muted" : "text-muted-foreground")} />
        </Link>
      </li>)}</ul>}
  </section>;
}
