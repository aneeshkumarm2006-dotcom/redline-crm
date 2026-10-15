import { Suspense } from "react";
import { PublicShell } from "@/modules/inventory/components/public-shell";
import { publicInventoryCopy as copy } from "@/modules/inventory/public-copy";

export default function Layout({ children }: { children: React.ReactNode }) {
  return <Suspense fallback={<p role="status" className="p-6">{copy.loading}</p>}><PublicShell>{children}</PublicShell></Suspense>;
}
