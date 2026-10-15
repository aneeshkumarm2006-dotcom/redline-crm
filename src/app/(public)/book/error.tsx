"use client";
import { bookingCopy as copy } from "@/modules/appointments/copy";
export default function ErrorPage({ reset }: { reset: () => void }) {
  return <div role="alert" className="space-y-4 p-6"><p>{copy.loadError}</p><button onClick={reset} className="min-h-11 rounded-md border px-4">{copy.retry}</button></div>;
}
