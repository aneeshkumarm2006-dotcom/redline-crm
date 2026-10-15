import Link from "next/link";
import { connection } from "next/server";
import { Brand } from "@/components/shared/app-shell/brand";
import { brandTheme } from "@/components/shared/app-shell/theme";
import { getSettings } from "@/modules/settings/service";
import { publicInventoryCopy as copy } from "../public-copy";

export async function PublicShell({ children, skipLabel = copy.skip }: { children: React.ReactNode; skipLabel?: string }) {
  // Settings are a runtime database read (with a time-based cache); render at request time.
  await connection();
  const { brand } = await getSettings();
  return <div className="min-h-screen bg-background" style={brandTheme(brand.primaryColor)}>
    <a href="#public-content" className="sr-only focus:not-sr-only focus:absolute focus:z-50 focus:min-h-11 focus:bg-background focus:p-3">{skipLabel}</a>
    <header className="border-b">
      <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-3 px-4 py-4 sm:px-6">
        <Link href="/inventory" className="min-w-0 max-w-full"><Brand brand={brand} /></Link>
        <Link href="/login" className="inline-flex min-h-11 items-center rounded-lg px-3 text-sm text-muted-foreground hover:bg-muted">{copy.staff}</Link>
      </div>
    </header>
    <main id="public-content" className="mx-auto max-w-7xl px-4 py-8 sm:px-6 sm:py-12">{children}</main>
    <footer className="mt-8 border-t px-4 py-6 text-center text-sm text-muted-foreground">{brand.companyName}</footer>
  </div>;
}
