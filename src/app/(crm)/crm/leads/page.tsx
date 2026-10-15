import { Suspense } from "react";
import { LeadsScreen, type LeadsSearch } from "@/modules/leads/components/leads-screen";
import Loading from "./loading";
export default function Page({ searchParams }: { searchParams: LeadsSearch }) {
  return <Suspense fallback={<Loading />}><LeadsScreen searchParams={searchParams} /></Suspense>;
}
