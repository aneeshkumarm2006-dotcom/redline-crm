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
    <aside className="fixed inset-y-0 left-0 hidden w-60 flex-col border-r border-sidebar-border bg-sidebar px-3 py-5 text-sidebar-foreground lg:flex">
      <Link href="/crm" className="mb-8 rounded-xl px-2 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-sidebar-ring"><Brand brand={brand} /></Link>
      <SidebarNavigation role={user.role} />
      <p className="mt-auto px-3 pt-8 text-xs text-sidebar-muted">{shellCopy.workspace}</p>
    </aside>
    <div className="min-w-0 lg:pl-60">
      <header className="sticky top-0 z-30 border-b bg-background/90 pt-[env(safe-area-inset-top)] backdrop-blur-md">
        <div className="mx-auto flex min-h-16 max-w-7xl items-center justify-between gap-3 px-4 sm:px-6 lg:px-8">
          <Link href="/crm" className="min-w-0 rounded-xl focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-ring lg:hidden"><Brand brand={brand} /></Link>
          <p className="hidden text-sm font-medium text-muted-foreground lg:block">{shellCopy.workspace}</p>
          <div className="flex shrink-0 items-center gap-1">
            <GlobalSearch primaryColor={brand.primaryColor} />
            <NotificationBell key={`${alerts.unread}-${alerts.latest?.id}`} initialUnread={alerts.unread} initialLatestId={alerts.latest?.id ?? null} />
            <AccountMenu user={user} primaryColor={brand.primaryColor} />
          </div>
        </div>
      </header>
      <main id="workspace" tabIndex={-1} className="mx-auto w-full min-w-0 max-w-7xl scroll-mt-24 space-y-6 px-4 pt-6 pb-[calc(6.5rem+env(safe-area-inset-bottom))] outline-none sm:px-6 sm:pt-8 lg:px-8 lg:pb-10">
        {children}
      </main>
    </div>
    <div className="fixed inset-x-0 bottom-0 z-40 border-t bg-background/95 px-2 pt-1.5 pb-[max(0.375rem,env(safe-area-inset-bottom))] backdrop-blur-md lg:hidden">
      <BottomNavigation role={user.role} primaryColor={brand.primaryColor} />
    </div>
  </div>;
}
