import { Suspense } from "react";
import { AppointmentsScreen } from "@/modules/appointments/components/appointments-screen";
import Loading from "./loading";
export default function Page({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  return <Suspense fallback={<Loading />}><AppointmentsScreen searchParams={searchParams} /></Suspense>;
}
