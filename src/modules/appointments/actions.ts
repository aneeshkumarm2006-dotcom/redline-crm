"use server";
import { revalidatePath } from "next/cache";
import { book, bookForLead, getStaffBookingOptions, getRescheduleOptions, rescheduleAppointment, setAppointmentStatus, BookingError } from "./service";
import { appointmentStatusInputSchema, bookingInputSchema, rescheduleInputSchema, staffBookingSchema, type AppointmentActionResult, type BookingResult, type StaffBookingResult } from "./schema";
import { appointmentActionCopy, bookingCopy, staffBookingCopy } from "./copy";
import { objectIdSchema } from "@/lib/data-schema";
import { searchLeads } from "@/modules/leads/service";

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

function revalidateStaff(what: string) {
  try { revalidatePath("/crm", "layout"); } catch { console.error(`${what} saved; staff cache revalidation failed.`); }
}

export async function bookForLeadAction(input: unknown): Promise<StaffBookingResult> {
  const parsed = staffBookingSchema.safeParse(input);
  if (!parsed.success) return { ok: false, message: staffBookingCopy.error };
  try {
    const result = await bookForLead(parsed.data);
    revalidateStaff("Appointment");
    return { ok: true, when: result.when, warning: "warning" in result ? result.warning : undefined };
  } catch (error) {
    return { ok: false, message: error instanceof BookingError ? error.message : staffBookingCopy.error };
  }
}

/** Lead quick-find for the calendar's "New appointment" sheet, within the caller's visible leads. */
export async function searchLeadsForBookingAction(text: unknown) {
  if (typeof text !== "string" || !text.trim() || text.length > 120) return [];
  try { return await searchLeads(text, 8); }
  catch { return []; }
}

export async function setAppointmentStatusAction(input: unknown): Promise<AppointmentActionResult> {
  const parsed = appointmentStatusInputSchema.safeParse(input);
  if (!parsed.success) return { ok: false, message: appointmentActionCopy.error };
  try {
    const result = await setAppointmentStatus(parsed.data);
    revalidateStaff("Appointment status");
    return { ok: true, message: result.message };
  } catch (error) {
    return { ok: false, message: error instanceof BookingError ? error.message : appointmentActionCopy.error };
  }
}

/** Free times for moving a visit, loaded when the reschedule step opens. Null on any failure. */
export async function getRescheduleOptionsAction(id: unknown) {
  const parsed = objectIdSchema.safeParse(id);
  if (!parsed.success) return null;
  try { return await getRescheduleOptions(parsed.data); }
  catch { return null; }
}

export async function rescheduleAppointmentAction(input: unknown): Promise<AppointmentActionResult> {
  const parsed = rescheduleInputSchema.safeParse(input);
  if (!parsed.success) return { ok: false, message: appointmentActionCopy.error };
  try {
    const result = await rescheduleAppointment(parsed.data);
    revalidateStaff("Reschedule");
    return { ok: true, message: appointmentActionCopy.moved(result.when) };
  } catch (error) {
    return { ok: false, message: error instanceof BookingError ? error.message : appointmentActionCopy.error };
  }
}
