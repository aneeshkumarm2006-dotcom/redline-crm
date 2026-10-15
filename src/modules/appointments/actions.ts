"use server";
import { book, BookingError } from "./service";
import { bookingInputSchema, type BookingResult } from "./schema";
import { bookingCopy } from "./copy";

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
