import { redirect } from "next/navigation";
import { Brand } from "@/components/shared/app-shell/brand";
import { brandTheme } from "@/components/shared/app-shell/theme";
import { getSettings } from "@/modules/settings/service";
import { Card, CardContent, CardDescription, CardHeader } from "@/components/ui/card";
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
    <main style={brandTheme(brand.primaryColor)} className="flex min-h-dvh items-center justify-center bg-muted/40 px-5 py-12">
      <div className="w-full max-w-sm space-y-7">
        <div className="flex items-center justify-center gap-3">
          <Brand brand={brand} />
        </div>
        <Card>
          <CardHeader>
            <h1 className="text-2xl font-semibold tracking-tight">{authCopy.title}</h1>
            <CardDescription>{authCopy.subtitle}</CardDescription>
          </CardHeader>
          <CardContent><LoginForm returnTo={returnTo} /></CardContent>
        </Card>
        <p className="text-center text-sm leading-6 text-muted-foreground">{authCopy.privateAccess}</p>
      </div>
    </main>
  );
}
