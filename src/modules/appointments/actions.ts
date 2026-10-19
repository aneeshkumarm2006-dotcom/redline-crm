"use server";
import { revalidatePath } from "next/cache";
import { book, bookForLead, getStaffBookingOptions, BookingError } from "./service";
import { bookingInputSchema, staffBookingSchema, type BookingResult, type StaffBookingResult } from "./schema";
import { bookingCopy, staffBookingCopy } from "./copy";
import { objectIdSchema } from "@/lib/data-schema";

export async function bookAppointment(input: unknown): Promise<BookingResult> {
  const parsed = bookingInputSchema.safeParse(input);
  if (!parsed.success) return { ok: false, message: bookingCopy.error };
  let result;
  try { result = await book(parsed.data); }
  catch (error) {
    if (error instanceof BookingError) return { ok: false, message: error.message };
    console.error("Booking failed.");
    return { ok: false, message: bookingCopy.error };
  }
  // No revalidation: staff pages render per request, and revalidating would re-render this
  // page into its "already booked" state, replacing the confirmation the customer is reading.
  return { ok: true, when: result.when };
}

/** Slots for the staff booking sheet, loaded when it opens. Null when the lead is not visible or the session ended. */
export async function getStaffBookingOptionsAction(leadId: unknown) {
  const id = objectIdSchema.safeParse(leadId);
  if (!id.success) return null;
  try { return await getStaffBookingOptions(id.data); }
  catch { return null; }
}

export async function bookForLeadAction(input: unknown): Promise<StaffBookingResult> {
  const parsed = staffBookingSchema.safeParse(input);
  if (!parsed.success) return { ok: false, message: staffBookingCopy.error };
  try {
    const result = await bookForLead(parsed.data);
    try { revalidatePath("/crm", "layout"); } catch { console.error("Appointment saved; staff cache revalidation failed."); }
    return { ok: true, when: result.when, warning: "warning" in result ? result.warning : undefined };
  } catch (error) {
    return { ok: false, message: error instanceof BookingError ? error.message : staffBookingCopy.error };
  }
}
