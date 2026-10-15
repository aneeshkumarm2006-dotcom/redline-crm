import { Suspense } from "react";
import { LoginScreen } from "@/modules/auth/components/login-screen";
import { authCopy } from "@/modules/auth/copy";

export const metadata = { title: authCopy.title, robots: { index: false, follow: false } };
export default function LoginPage({ searchParams }: { searchParams: Promise<{ returnTo?: string | string[] }> }) {
  return <Suspense fallback={<p className="p-6" role="status">{authCopy.loading}</p>}>
    <LoginScreen searchParams={searchParams} />
  </Suspense>;
}
