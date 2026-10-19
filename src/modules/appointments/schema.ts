import { z } from "zod";
import { dateTimeSchema, objectIdSchema } from "@/lib/data-schema";

export const appointmentStatuses = ["booked", "completed", "cancelled", "no_show"] as const;
const fields = z.object({
  leadId: objectIdSchema, vehicleId: objectIdSchema, salespersonId: objectIdSchema,
  dealershipId: objectIdSchema, startsAt: dateTimeSchema, endsAt: dateTimeSchema,
  status: z.enum(appointmentStatuses).default("booked"),
}).strict();
const validRange = (value: { startsAt: string; endsAt: string }) => Date.parse(value.endsAt) > Date.parse(value.startsAt);
export const appointmentInputSchema = fields.refine(validRange, "Appointment must end after it starts.");
export const appointmentSchema = fields.extend({ id: objectIdSchema }).refine(validRange, "Appointment must end after it starts.");
export type Appointment = z.infer<typeof appointmentSchema>;

// Public booking: the token identifies the lead; everything else is derived on the server.
export const bookingInputSchema = z.object({ token: z.string().max(100), startsAt: dateTimeSchema }).strict();
export type BookingInput = z.infer<typeof bookingInputSchema>;
export type BookingResult = { ok: true; when: string } | { ok: false; message: string };

// Staff booking on the customer's behalf: lead visibility and the salesperson are checked by the service.
export const staffBookingSchema = z.object({ leadId: objectIdSchema, startsAt: dateTimeSchema }).strict();
export type StaffBookingResult = { ok: true; when: string; warning?: string } | { ok: false; message: string };
