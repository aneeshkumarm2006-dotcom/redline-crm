import Link from "next/link";
import { connection } from "next/server";
import { CalendarCheck2, CalendarX2, CarFront, MapPin, Phone } from "lucide-react";
import { cn } from "@/lib/utils";
import { getBookingPage } from "../service";
import { bookingCopy as copy } from "../copy";
import { BookingForm } from "./booking-form";

type Dealership = { name: string; address: string; phone: string };

const focus = "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring";
const card = "rounded-[1.75rem] bg-card p-5 shadow-lg ring-1 ring-border sm:p-8";

function DealershipCard({ dealership }: { dealership: Dealership }) {
  return <section className="flex flex-col gap-4 rounded-2xl bg-card p-5 shadow-xs ring-1 ring-border sm:flex-row sm:items-center">
    <span aria-hidden="true" className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-brand-soft text-primary"><MapPin className="size-5" /></span>
    <div className="min-w-0 flex-1">
      <p className="font-display break-words font-semibold">{dealership.name}</p>
      <p className="break-words text-sm text-muted-foreground">{dealership.address}</p>
    </div>
    <a href={`tel:${dealership.phone.replace(/[^\d+]/g, "")}`} className={cn("inline-flex min-h-11 shrink-0 items-center gap-2 rounded-xl bg-ink px-4 text-sm font-semibold text-ink-foreground transition-colors hover:bg-ink/90", focus)}>
      <Phone aria-hidden="true" className="size-4" />{copy.call(dealership.phone)}</a>
  </section>;
}

/** Focused task layout: one centred card on the canvas (the only centred column on the public site). */
function Frame({ children }: { children: React.ReactNode }) {
  return <div className="page-gutter py-8 sm:py-14"><div className="mx-auto w-full max-w-5xl space-y-4">{children}</div></div>;
}

function Notice({ icon, tone, title, children }: { icon: React.ReactNode; tone: "muted" | "success"; title: string; children: React.ReactNode }) {
  return <Frame><div className={cn(card, "space-y-6")}>
    <div className="space-y-4">
      <span aria-hidden="true" className={cn("flex size-14 items-center justify-center rounded-2xl", tone === "success" ? "bg-success/10 text-success" : "bg-muted text-muted-foreground")}>{icon}</span>
      <h1 className="font-display text-2xl font-bold sm:text-3xl">{title}</h1>
    </div>
    {children}
  </div></Frame>;
}

export async function BookingScreen({ params }: { params: Promise<{ token: string }> }) {
  // Availability depends on the current time and live bookings.
  await connection();
  const { token } = await params;
  const view = await getBookingPage(token);
  const browse = <Link href="/inventory" className={cn("inline-flex min-h-11 items-center rounded-xl bg-ink px-5 text-sm font-semibold text-ink-foreground transition-colors hover:bg-ink/90", focus)}>{copy.browse}</Link>;
  switch (view.state) {
    case "invalid":
      return <Notice tone="muted" icon={<CalendarX2 className="size-7" />} title={copy.invalidTitle}>
        <p className="leading-7 text-muted-foreground">{copy.invalidBody}</p>{browse}
      </Notice>;
    case "unavailable":
      return <Notice tone="muted" icon={<CalendarX2 className="size-7" />} title={copy.unavailableTitle}>
        <p className="leading-7 text-muted-foreground">{copy.unavailableBody}</p><DealershipCard dealership={view.dealership} />
      </Notice>;
    case "booked":
      return <Notice tone="success" icon={<CalendarCheck2 className="size-7" />} title={copy.existingTitle}>
        <div className="space-y-2 rounded-2xl bg-surface p-5"><p className="font-display text-xl font-semibold">{view.when}</p><p className="break-words font-medium">{view.vehicleName}</p>
          {view.salespersonName && <p className="text-muted-foreground">{copy.withSalesperson(view.salespersonName)}</p>}
          <p className="text-sm text-muted-foreground">{copy.change}</p></div>
        <DealershipCard dealership={view.dealership} />
      </Notice>;
    case "open":
      return <Frame>
        <div className={card}>
          <h1 className="font-display text-2xl font-bold sm:text-3xl">{copy.title}</h1>
          <div className="mt-5 flex items-center gap-3 rounded-2xl bg-surface p-3.5">
            <span aria-hidden="true" className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-brand-soft text-primary"><CarFront className="size-5" /></span>
            <p className="min-w-0 break-words font-display text-lg font-semibold">{view.vehicleName}</p>
          </div>
          <p className="mt-4 leading-7 text-muted-foreground">{copy.greeting(view.customerName)} {copy.meeting(view.salespersonName, view.dealership.name)}</p>
          <div className="mt-7 border-t pt-7"><BookingForm token={token} days={view.days} zone={view.zone} /></div>
        </div>
        <DealershipCard dealership={view.dealership} />
      </Frame>;
  }
}
