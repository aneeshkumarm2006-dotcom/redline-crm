import Link from "next/link";
import { requirePageUser } from "@/modules/auth/page-guards";
import { getSettings } from "@/modules/settings/service";
import { AccountMenu } from "./account-menu";
import { Brand } from "./brand";
import { BottomNavigation, SidebarNavigation } from "./navigation";
import { brandTheme } from "./theme";
import { shellCopy } from "./copy";
import { getUnreadSummary } from "@/modules/notifications/service";
import { NotificationBell } from "@/modules/notifications/components/notification-bell";
import { GlobalSearch } from "@/modules/search/components/global-search";

export async function AppShell({ children }: { children: React.ReactNode }) {
  const user = await requirePageUser();
  const [{ brand }, alerts] = await Promise.all([getSettings(), getUnreadSummary()]);
  return <div style={brandTheme(brand.primaryColor)} className="min-h-dvh bg-surface">
    <a href="#workspace" className="sr-only focus:not-sr-only focus:fixed focus:top-3 focus:left-3 focus:z-50 focus:flex focus:min-h-11 focus:items-center focus:rounded-lg focus:bg-primary focus:px-4 focus:text-primary-foreground">
      {shellCopy.skip}
    </a>
    <aside className="ink-glow fixed inset-y-0 left-0 hidden w-64 flex-col border-r border-sidebar-border bg-sidebar px-3 pt-5 pb-4 text-sidebar-foreground lg:flex">
      <Link href="/crm" className="mb-7 rounded-xl px-2 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-sidebar-ring"><Brand brand={brand} /></Link>
      <SidebarNavigation role={user.role} />
      <div className="mt-auto flex items-center gap-3 rounded-xl bg-sidebar-accent px-3 py-3">
        <span aria-hidden className="size-2 shrink-0 rounded-full bg-success shadow-[0_0_0_4px_rgb(21_128_61/0.18)]" />
        <span className="min-w-0">
          <span className="block truncate text-xs font-semibold text-sidebar-foreground">{shellCopy.workspace}</span>
          <span className="block truncate text-[0.6875rem] text-sidebar-muted">{brand.companyName}</span>
        </span>
      </div>
    </aside>
    <div className="min-w-0 lg:pl-64">
      <header className="sticky top-0 z-30 border-b bg-background/85 pt-[env(safe-area-inset-top)] backdrop-blur-xl backdrop-saturate-150">
        <div className="page-gutter flex min-h-16 items-center justify-between gap-3">
          <Link href="/crm" className="min-w-0 rounded-xl focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-ring lg:hidden"><Brand brand={brand} /></Link>
          <p className="eyebrow hidden lg:block">{shellCopy.workspace}</p>
          <div className="flex shrink-0 items-center gap-1">
            <GlobalSearch primaryColor={brand.primaryColor} />
            <NotificationBell key={`${alerts.unread}-${alerts.latest?.id}`} initialUnread={alerts.unread} initialLatestId={alerts.latest?.id ?? null} />
            <AccountMenu user={user} primaryColor={brand.primaryColor} />
          </div>
        </div>
      </header>
      <main id="workspace" tabIndex={-1} className="page-gutter w-full min-w-0 scroll-mt-24 space-y-8 pt-6 pb-[calc(6.5rem+env(safe-area-inset-bottom))] outline-none sm:pt-8 lg:pb-12">
        {children}
      </main>
    </div>
    <div className="fixed inset-x-0 bottom-0 z-40 border-t bg-background/90 px-2 pt-1.5 pb-[max(0.375rem,env(safe-area-inset-bottom))] shadow-[0_-8px_24px_-12px_rgb(11_13_18/0.12)] backdrop-blur-xl lg:hidden">
      <BottomNavigation role={user.role} primaryColor={brand.primaryColor} />
    </div>
  </div>;
}
