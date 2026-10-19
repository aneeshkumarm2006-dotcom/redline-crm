import { Suspense } from "react";
import { LoginScreen } from "@/modules/auth/components/login-screen";
import { authCopy } from "@/modules/auth/copy";

export const metadata = { title: authCopy.title, robots: { index: false, follow: false } };
export default function LoginPage({ searchParams }: { searchParams: Promise<{ returnTo?: string | string[] }> }) {
  return <Suspense fallback={<p className="flex min-h-dvh items-center justify-center bg-surface p-6 text-muted-foreground" role="status">{authCopy.loading}</p>}>
    <LoginScreen searchParams={searchParams} />
  </Suspense>;
}
