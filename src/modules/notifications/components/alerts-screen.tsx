import Link from "next/link";
import { BellOff } from "lucide-react";
import { cn } from "@/lib/utils";
import { EmptyState } from "@/components/shared/empty-state";
import { requestNow } from "@/lib/clock";
import { requirePageUser } from "@/modules/auth/page-guards";
import { getNeedsAttention } from "@/modules/automations/reminders";
import { formatTimestamp } from "@/modules/inventory/copy";
import { getSettings } from "@/modules/settings/service";
import { countUnreadByCategory, listMyNotifications } from "../service";
import { alertCategories, type AlertCategory } from "../schema";
import { alertsCopy as copy } from "../copy";
import { AlertsList } from "./alerts-list";
import { categoryIcons } from "./category-icons";
import { NeedsAttention } from "./needs-attention";

export async function AlertsScreen({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  await requirePageUser();
  const query = await searchParams;
  const category = alertCategories.find((entry) => entry === query.category) as AlertCategory | undefined;
  const now = requestNow();
  const [notifications, unread, attention, settings] = await Promise.all([listMyNotifications(50, category), countUnreadByCategory(), getNeedsAttention(now), getSettings()]);
  // Times are formatted on the server in the dealership zone so the client cannot drift.
  const times = Object.fromEntries(notifications.map((entry) => [entry.id, formatTimestamp(entry.createdAt, settings.booking.timeZone)]));
  const chip = (active: boolean) => cn("inline-flex min-h-10 shrink-0 items-center gap-1.5 rounded-full border px-3 text-sm font-medium transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring",
    active ? "border-primary bg-primary text-primary-foreground" : "bg-card text-muted-foreground hover:bg-muted hover:text-foreground");
  return <>
    <header><h1 className="text-3xl font-semibold tracking-tight">{copy.title}</h1><p className="mt-2 text-sm text-muted-foreground">{copy.intro}</p></header>
    <NeedsAttention data={attention} repairStatusKey={settings.statusRoles.repair} />
    <section aria-label={copy.title} className="space-y-3">
      <nav aria-label={copy.filterLabel} className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1 sm:mx-0 sm:flex-wrap sm:px-0">
        <Link href="/crm/alerts" scroll={false} aria-current={!category ? "page" : undefined} className={chip(!category)}>{copy.all}</Link>
        {alertCategories.map((entry) => {
          const Icon = categoryIcons[entry];
          return <Link key={entry} href={`/crm/alerts?category=${entry}`} scroll={false} aria-current={category === entry ? "page" : undefined}
            aria-label={copy.categoryUnread(copy.categories[entry], unread[entry])} className={chip(category === entry)}>
            <Icon aria-hidden className="size-4" />{copy.categories[entry]}
            {unread[entry] > 0 && <span aria-hidden className={cn("min-w-5 rounded-full px-1.5 text-center text-xs font-semibold tabular-nums", category === entry ? "bg-primary-foreground text-primary" : "bg-primary text-primary-foreground")}>{unread[entry]}</span>}
          </Link>;
        })}
      </nav>
      {!notifications.length
        ? <EmptyState icon={BellOff} title={category ? copy.emptyCategory(copy.categories[category]) : copy.empty} description={category ? copy.emptyCategoryHint : copy.emptyHint} />
        : <AlertsList notifications={notifications} times={times} />}
    </section>
  </>;
}
