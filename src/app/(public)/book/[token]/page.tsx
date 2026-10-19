import { Suspense } from "react";
import type { Metadata } from "next";
import { BookingScreen } from "@/modules/appointments/components/booking-screen";
import { bookingCopy as copy } from "@/modules/appointments/copy";

// The URL carries a bearer token: keep it out of search indexes and Referer headers.
export const metadata: Metadata = { title: copy.title, robots: { index: false, follow: false }, referrer: "no-referrer" };
export default function Page({ params }: { params: Promise<{ token: string }> }) {
  return <Suspense fallback={<p role="status" className="page-gutter py-10 text-muted-foreground">{copy.loading}</p>}><BookingScreen params={params} /></Suspense>;
}
