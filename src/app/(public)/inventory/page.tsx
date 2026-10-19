import { Suspense } from "react";
import { PublicInventoryScreen } from "@/modules/inventory/components/public-inventory-screen";
import { publicInventoryCopy as copy } from "@/modules/inventory/public-copy";

export const metadata = { title: copy.available, description: copy.intro };
export default function Page({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  return <Suspense fallback={<p role="status" className="page-gutter py-10 text-muted-foreground">{copy.loading}</p>}><PublicInventoryScreen searchParams={searchParams} /></Suspense>;
}
