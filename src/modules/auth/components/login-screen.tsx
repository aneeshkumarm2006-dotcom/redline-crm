import { redirect } from "next/navigation";
import { Brand } from "@/components/shared/app-shell/brand";
import { brandTheme } from "@/components/shared/app-shell/theme";
import { getSettings } from "@/modules/settings/service";
import { getCurrentUser } from "../service";
import { safeReturnTo } from "../routes";
import { authCopy } from "../copy";
import { LoginForm } from "./login-form";

export async function LoginScreen({ searchParams }: { searchParams: Promise<{ returnTo?: string | string[] }> }) {
  const user = await getCurrentUser();
  const returnTo = safeReturnTo((await searchParams).returnTo);
  if (user) redirect(returnTo);
  const { brand } = await getSettings();
  return (
    <main style={brandTheme(brand.primaryColor)} className="flex min-h-dvh bg-surface">
      {/* Desktop brand panel; phones get the brand above the form instead. */}
      <div className="ink-glow relative hidden min-w-0 flex-col justify-between overflow-hidden bg-ink p-10 text-ink-foreground lg:flex lg:w-1/2 xl:w-[55%] xl:p-14">
        <Brand brand={brand} />
        <div className="max-w-xl">
          <p className="text-xs font-semibold tracking-[0.08em] text-ink-muted uppercase">{authCopy.title}</p>
          <p className="font-display mt-4 text-5xl font-bold text-white xl:text-6xl">{authCopy.panelTitle}</p>
          <p className="mt-5 max-w-md text-lg leading-8 text-ink-muted">{authCopy.panelIntro}</p>
        </div>
        <p className="text-sm text-ink-muted">{brand.companyName}</p>
      </div>
      <div className="flex min-w-0 flex-1 flex-col items-center justify-center px-5 py-12 sm:px-8">
        <div className="w-full max-w-md space-y-8">
          <div className="flex justify-center lg:hidden"><Brand brand={brand} /></div>
          <section aria-labelledby="login-title" className="rounded-[1.75rem] border bg-card p-6 shadow-lg sm:p-8">
            <h1 id="login-title" className="font-display text-3xl font-bold">{authCopy.title}</h1>
            <p className="mt-2 text-muted-foreground">{authCopy.subtitle}</p>
            <div className="mt-7"><LoginForm returnTo={returnTo} /></div>
          </section>
          <p className="text-center text-sm leading-6 text-muted-foreground">{authCopy.privateAccess}</p>
        </div>
      </div>
    </main>
  );
}
