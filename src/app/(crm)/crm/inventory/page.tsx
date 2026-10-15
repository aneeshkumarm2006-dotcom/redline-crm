import { Suspense } from "react";
import { InventoryScreen, type InventorySearch } from "@/modules/inventory/components/inventory-screen";
import Loading from "./loading";
export default function Page({ searchParams }: { searchParams: InventorySearch }) {
  return <Suspense fallback={<Loading />}><InventoryScreen searchParams={searchParams} /></Suspense>;
}
