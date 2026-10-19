import { Suspense } from "react";
import { PublicShell } from "@/modules/inventory/components/public-shell";
import { bookingCopy as copy } from "@/modules/appointments/copy";

export default function Layout({ children }: { children: React.ReactNode }) {
  return <Suspense fallback={<p role="status" className="page-gutter py-10 text-muted-foreground">{copy.loading}</p>}><PublicShell skipLabel={copy.skip}>{children}</PublicShell></Suspense>;
}
