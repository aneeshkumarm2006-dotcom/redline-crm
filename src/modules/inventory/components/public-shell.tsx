import Link from "next/link";
import { connection } from "next/server";
import { Brand } from "@/components/shared/app-shell/brand";
import { brandTheme } from "@/components/shared/app-shell/theme";
import { cn } from "@/lib/utils";
import { getSettings } from "@/modules/settings/service";
import { UtmCapture } from "@/modules/leads/components/utm-capture";
import { PublicHeader } from "./public-header";
import { publicInventoryCopy as copy } from "../public-copy";

/**
 * Showroom frame: header (light, or transparent over the hero on the inventory page), content and ink footer.
 */
export async function PublicShell({ children, skipLabel = copy.skip }: { children: React.ReactNode; skipLabel?: string }) {
  // Settings are a runtime database read (with a time-based cache); render at request time.
  await connection();
  const { brand } = await getSettings();
  const staffLink = "inline-flex min-h-11 items-center rounded-xl px-3.5 text-sm font-medium transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring";
  return <div className="flex min-h-dvh flex-col bg-surface text-foreground" style={brandTheme(brand.primaryColor)}>
    <UtmCapture />
    <a href="#public-content" className="sr-only focus:not-sr-only focus:absolute focus:top-3 focus:left-3 focus:z-50 focus:inline-flex focus:min-h-11 focus:items-center focus:rounded-xl focus:bg-card focus:px-4 focus:text-foreground focus:shadow-lg">{skipLabel}</a>
    <PublicHeader brand={brand} staffLabel={copy.staff} />
    <main id="public-content" className="min-w-0 flex-1">{children}</main>
    <footer className="bg-ink text-ink-foreground">
      <div className="page-gutter flex flex-wrap items-center justify-between gap-4 py-10">
        <Brand brand={brand} />
        <Link href="/login" className={cn(staffLink, "text-ink-muted hover:bg-white/10 hover:text-white")}>{copy.staff}</Link>
      </div>
    </footer>
  </div>;
}
