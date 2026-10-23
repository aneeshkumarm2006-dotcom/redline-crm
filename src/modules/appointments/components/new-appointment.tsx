"use client";
import { useEffect, useId, useState } from "react";
import { CalendarPlus, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Sheet, SheetClose, SheetContent, SheetDescription, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { brandTheme } from "@/components/shared/app-shell/theme";
import { searchLeadsForBookingAction } from "../actions";
import { appointmentActionCopy as copy, appointmentsCopy } from "../copy";
import { StaffBookingBody, useStaffBooking } from "./staff-booking";

type Match = Awaited<ReturnType<typeof searchLeadsForBookingAction>>[number];

/** Calendar "New appointment": find a visible lead, then book a free time with their salesperson. */
export function NewAppointmentButton({ primaryColor }: { primaryColor: string }) {
  const id = useId();
  const [open, setOpen] = useState(false);
  const [text, setText] = useState("");
  const [matches, setMatches] = useState<Match[] | "searching">([]);
  const [lead, setLead] = useState<Match | null>(null);
  const booking = useStaffBooking(() => setOpen(false));

  useEffect(() => {
    if (!open || lead || !text.trim()) return;
    let current = true;
    const timer = setTimeout(() => {
      setMatches("searching");
      searchLeadsForBookingAction(text).then((found) => { if (current) setMatches(found); }, () => { if (current) setMatches([]); });
    }, 250);
    return () => { current = false; clearTimeout(timer); };
  }, [open, lead, text]);

  function change(next: boolean) {
    if (booking.pending) return;
    setOpen(next);
    if (next) { setText(""); setMatches([]); setLead(null); }
  }
  function pick(match: Match) { setLead(match); booking.load(match.id); }

  return <Sheet open={open} onOpenChange={change}>
    <SheetTrigger asChild><Button className="min-h-11 gap-2"><CalendarPlus aria-hidden className="size-4" />{appointmentsCopy.newAppointment}</Button></SheetTrigger>
    <SheetContent side="bottom" showCloseButton={false} style={brandTheme(primaryColor)} className="max-h-[90dvh] gap-5 overflow-y-auto rounded-t-[1.25rem] p-5 pb-[max(1.25rem,env(safe-area-inset-bottom))] sm:mx-auto sm:max-w-lg sm:p-6">
      <SheetHeader className="p-0 pr-16">
        <SheetTitle className="text-lg font-semibold tracking-tight">{copy.newTitle}</SheetTitle>
        <SheetDescription>{lead ? lead.name : copy.newHint}</SheetDescription>
      </SheetHeader>
      <SheetClose asChild><Button variant="ghost" disabled={booking.pending} className="absolute right-2 top-2 min-h-11 min-w-11">{copy.close}</Button></SheetClose>
      {!lead ? <div className="space-y-3">
        <label htmlFor={`${id}-search`} className="text-sm font-medium">{copy.search}</label>
        <div className="relative">
          <Search aria-hidden className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input id={`${id}-search`} autoFocus value={text} onChange={(event) => setText(event.target.value)} placeholder={copy.searchPlaceholder} className="min-h-11 pl-9" autoComplete="off" />
        </div>
        {!text.trim() ? null : matches === "searching" ? <p role="status" className="text-sm text-muted-foreground">{copy.searching}</p>
          : !matches.length ? <p className="text-sm text-muted-foreground">{copy.noMatches}</p>
          : <ul className="divide-y overflow-clip rounded-xl border">{matches.map((match) => <li key={match.id}>
            <button type="button" onClick={() => pick(match)} className="flex min-h-14 w-full flex-col items-start justify-center px-4 py-2 text-left hover:bg-muted/50 focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-ring">
              <span className="text-sm font-medium">{match.name}</span>
              <span className="text-xs text-muted-foreground">{[match.email, match.phone].filter(Boolean).join(" · ")}</span>
            </button></li>)}</ul>}
      </div> : <div className="space-y-4">
        <Button variant="outline" className="min-h-10" disabled={booking.pending} onClick={() => setLead(null)}>{copy.change}</Button>
        <StaffBookingBody leadId={lead.id} booking={booking} />
      </div>}
    </SheetContent>
  </Sheet>;
}
