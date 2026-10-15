import Link from "next/link";
import { requirePageUser } from "@/modules/auth/page-guards";
import { getSettings } from "@/modules/settings/service";
import { AccountMenu } from "./account-menu";
import { Brand } from "./brand";
import { ShellNavigation } from "./navigation";
import { brandTheme } from "./theme";
import { shellCopy } from "./copy";
import { getUnreadSummary } from "@/modules/notifications/service";
import { NotificationBell } from "@/modules/notifications/components/notification-bell";

export async function AppShell({ children }: { children: React.ReactNode }) {
  const user = await requirePageUser();
  const [{ brand }, alerts] = await Promise.all([getSettings(), getUnreadSummary()]);
  return <div style={brandTheme(brand.primaryColor)} className="min-h-dvh bg-muted/35">
    <a href="#workspace" className="sr-only focus:not-sr-only focus:fixed focus:top-3 focus:left-3 focus:z-50 focus:flex focus:min-h-11 focus:items-center focus:rounded-lg focus:bg-primary focus:px-4 focus:text-primary-foreground">
      {shellCopy.skip}
    </a>
    <aside className="fixed inset-y-0 left-0 hidden w-64 flex-col border-r bg-background p-5 lg:flex">
      <Link href="/crm" className="mb-10 rounded-xl focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-ring"><Brand brand={brand} /></Link>
      <ShellNavigation />
      <p className="mt-auto px-4 pt-8 text-xs text-muted-foreground">{shellCopy.workspace}</p>
    </aside>
    <div className="min-w-0 lg:pl-64">
      <header className="sticky top-0 z-30 border-b bg-background/95 pt-[env(safe-area-inset-top)] backdrop-blur">
        <div className="mx-auto flex min-h-20 max-w-6xl items-center justify-between gap-3 px-4 sm:px-8">
          <Link href="/crm" className="min-w-0 rounded-xl focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-ring lg:hidden"><Brand brand={brand} /></Link>
          <p className="hidden text-sm font-medium text-muted-foreground lg:block">{shellCopy.workspace}</p>
          <div className="flex shrink-0 items-center gap-1">
            <NotificationBell key={`${alerts.unread}-${alerts.latest?.id}`} initialUnread={alerts.unread} initialLatestId={alerts.latest?.id ?? null} />
            <AccountMenu user={user} primaryColor={brand.primaryColor} />
          </div>
        </div>
      </header>
      <main id="workspace" tabIndex={-1} className="mx-auto w-full min-w-0 max-w-6xl scroll-mt-24 space-y-6 px-4 pt-7 pb-[calc(7rem+env(safe-area-inset-bottom))] outline-none sm:px-8 sm:pt-10 lg:pb-10">
        {children}
      </main>
    </div>
    <div className="fixed inset-x-0 bottom-0 z-40 border-t bg-background px-3 pt-2 pb-[max(0.5rem,env(safe-area-inset-bottom))] lg:hidden">
      <ShellNavigation mobile />
    </div>
  </div>;
}
