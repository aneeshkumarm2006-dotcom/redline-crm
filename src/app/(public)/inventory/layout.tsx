import { Suspense } from "react";
import { PublicShell } from "@/modules/inventory/components/public-shell";
import { publicInventoryCopy as copy } from "@/modules/inventory/public-copy";

export default function Layout({ children }: { children: React.ReactNode }) {
  return <Suspense fallback={<p role="status" className="page-gutter py-10 text-muted-foreground">{copy.loading}</p>}><PublicShell>{children}</PublicShell></Suspense>;
}
