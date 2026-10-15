import Link from "next/link";
import { connection } from "next/server";
import { CalendarCheck2, CalendarX2 } from "lucide-react";
import { getBookingPage } from "../service";
import { bookingCopy as copy } from "../copy";
import { BookingForm } from "./booking-form";

type Dealership = { name: string; address: string; phone: string };

function DealershipCard({ dealership }: { dealership: Dealership }) {
  return <section className="space-y-1 rounded-xl bg-muted/40 p-5">
    <p className="break-words font-medium">{dealership.name}</p>
    <p className="break-words text-sm text-muted-foreground">{dealership.address}</p>
    <a href={`tel:${dealership.phone.replace(/[^\d+]/g, "")}`} className="inline-flex min-h-11 items-center text-sm font-medium underline-offset-4 hover:underline">{copy.call(dealership.phone)}</a>
  </section>;
}

function Notice({ icon, title, children }: { icon: React.ReactNode; title: string; children: React.ReactNode }) {
  return <div className="mx-auto max-w-xl space-y-6 py-4">
    <div className="space-y-3">{icon}<h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">{title}</h1></div>
    {children}
  </div>;
}

export async function BookingScreen({ params }: { params: Promise<{ token: string }> }) {
  // Availability depends on the current time and live bookings.
  await connection();
  const { token } = await params;
  const view = await getBookingPage(token);
  const browse = <Link href="/inventory" className="inline-flex min-h-11 items-center rounded-md border px-4">{copy.browse}</Link>;
  switch (view.state) {
    case "invalid":
      return <Notice icon={<CalendarX2 className="size-9 text-muted-foreground" aria-hidden="true" />} title={copy.invalidTitle}>
        <p className="text-muted-foreground">{copy.invalidBody}</p>{browse}
      </Notice>;
    case "unavailable":
      return <Notice icon={<CalendarX2 className="size-9 text-muted-foreground" aria-hidden="true" />} title={copy.unavailableTitle}>
        <p className="text-muted-foreground">{copy.unavailableBody}</p><DealershipCard dealership={view.dealership} />
      </Notice>;
    case "booked":
      return <Notice icon={<CalendarCheck2 className="size-9 text-primary" aria-hidden="true" />} title={copy.existingTitle}>
        <div className="space-y-2"><p className="text-lg font-medium">{view.when}</p><p>{view.vehicleName}</p>
          {view.salespersonName && <p className="text-muted-foreground">{copy.withSalesperson(view.salespersonName)}</p>}
          <p className="text-sm text-muted-foreground">{copy.change}</p></div>
        <DealershipCard dealership={view.dealership} />
      </Notice>;
    case "open":
      return <div className="mx-auto max-w-2xl space-y-6">
        <div className="space-y-2">
          <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">{copy.title}</h1>
          <p className="break-words text-lg font-medium">{view.vehicleName}</p>
          <p className="text-muted-foreground">{copy.greeting(view.customerName)} {copy.meeting(view.salespersonName, view.dealership.name)}</p>
        </div>
        <BookingForm token={token} days={view.days} zone={view.zone} />
        <DealershipCard dealership={view.dealership} />
      </div>;
  }
}
