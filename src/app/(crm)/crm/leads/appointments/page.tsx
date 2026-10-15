import { Suspense } from "react";
import { AppointmentsScreen } from "@/modules/appointments/components/appointments-screen";
import Loading from "../loading";
export default function Page() {
  return <Suspense fallback={<Loading />}><AppointmentsScreen /></Suspense>;
}
