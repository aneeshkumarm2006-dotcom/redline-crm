import "server-only";
import { z } from "zod";
import { connectDb } from "@/lib/db";
import { emit } from "@/lib/events";
import { objectIdSchema } from "@/lib/data-schema";
import { getSettings } from "@/modules/settings/service";
import { getLeadForBooking, advanceLeadForBooking, getLead } from "@/modules/leads/service";
import { requireRole } from "@/modules/auth/service";
import { getVehicleForAutomation } from "@/modules/inventory/service";
import { getDealershipForAutomation } from "@/modules/dealerships/service";
import { findActiveUser } from "@/modules/users/service";
import { AppointmentModel } from "./model";
import { appointmentSchema, bookingInputSchema } from "./schema";
import { buildSlotDays } from "./slots";
import { bookingCopy } from "./copy";

export class BookingError extends Error {}

const DAY = 24 * 60 * 60_000;

type Dealership = { name: string; address: string; phone: string };
export type BookingView =
  | { state: "invalid" }
  | { state: "unavailable"; dealership: Dealership }
  | { state: "booked"; dealership: Dealership; vehicleName: string; salespersonName: string | null; when: string }
  | { state: "open"; dealership: Dealership; vehicleName: string; customerName: string; salespersonName: string; zone: string;
      days: { date: string; label: string; slots: { startsAt: string; label: string; when: string }[] }[] };

function formatters(timeZone: string) {
  const day = new Intl.DateTimeFormat("en-CA", { weekday: "short", month: "short", day: "numeric", timeZone });
  const time = new Intl.DateTimeFormat("en-CA", { timeStyle: "short", timeZone });
  const when = new Intl.DateTimeFormat("en-CA", { dateStyle: "full", timeStyle: "short", timeZone });
  const zone = new Intl.DateTimeFormat("en-CA", { timeZoneName: "long", timeZone });
  return {
    day: (iso: string) => day.format(new Date(iso)), time: (iso: string) => time.format(new Date(iso)),
    when: (iso: string) => when.format(new Date(iso)),
    zone: (iso: string) => zone.formatToParts(new Date(iso)).find((part) => part.type === "timeZoneName")?.value ?? timeZone,
  };
}

function findBooked(leadId: string) {
  return AppointmentModel.findOne({ leadId, status: "booked" }).lean().exec();
}

/** Lead, location and the salesperson who can take the appointment (assigned, active, same location). */
async function loadBooking(token: string) {
  const lead = await getLeadForBooking(token);
  if (!lead) return null;
  const [settings, dealership, vehicle, existing, assigned] = await Promise.all([
    getSettings(), getDealershipForAutomation(lead.dealershipId), getVehicleForAutomation(lead.vehicleId),
    findBooked(lead.id), lead.assignedTo ? findActiveUser(lead.assignedTo) : null,
  ]);
  const salesperson = assigned?.role === "salesperson" && assigned.dealershipId === lead.dealershipId ? assigned : null;
  const vehicleName = `${vehicle.year} ${vehicle.make} ${vehicle.model} ${vehicle.trim}`.trim();
  return { lead, settings, dealership, vehicleName, existing, salesperson };
}

/** Free slots for one salesperson: settings business hours and slot length, minus their booked appointments. */
export async function getAvailableSlots(salespersonId: string, now = new Date()) {
  const id = objectIdSchema.parse(salespersonId);
  const { booking } = await getSettings();
  await connectDb();
  const horizon = new Date(now.getTime() + (booking.daysAhead + 1) * DAY);
  const booked = await AppointmentModel.find({ salespersonId: id, status: "booked", startsAt: { $lt: horizon }, endsAt: { $gt: now } })
    .select("startsAt endsAt").lean().exec();
  return buildSlotDays(booking, now, booked.map((entry) => ({ startsAt: entry.startsAt.toISOString(), endsAt: entry.endsAt.toISOString() })));
}

/** Public booking page state for a bearer token. Exposes no IDs, tokens or customer contact details. */
export async function getBookingPage(token: string): Promise<BookingView> {
  const context = await loadBooking(token);
  if (!context) return { state: "invalid" };
  const { lead, settings, dealership, vehicleName, existing, salesperson } = context;
  const format = formatters(settings.booking.timeZone);
  if (existing) {
    const host = await findActiveUser(existing.salespersonId.toString());
    return { state: "booked", dealership, vehicleName, salespersonName: host?.name ?? null, when: format.when(existing.startsAt.toISOString()) };
  }
  if (!salesperson) return { state: "unavailable", dealership };
  const days = await getAvailableSlots(salesperson.id);
  return {
    state: "open", dealership, vehicleName, customerName: lead.name.split(/\s+/)[0], salespersonName: salesperson.name,
    zone: format.zone(new Date().toISOString()),
    days: days.map((day) => ({ date: day.date, label: format.day(day.slots[0].startsAt),
      slots: day.slots.map((slot) => ({ startsAt: slot.startsAt, label: format.time(slot.startsAt), when: format.when(slot.startsAt) })) })),
  };
}

/**
 * Public booking. The requested start must be a currently free slot; unique indexes make concurrent
 * requests safe (one booked appointment per lead, one per salesperson start time). A repeated request
 * for the lead's existing time is treated as a replay and succeeds without side effects.
 */
export async function book(input: unknown) {
  const data = bookingInputSchema.parse(input);
  const context = await loadBooking(data.token);
  if (!context) throw new BookingError(bookingCopy.invalidTitle);
  const { lead, settings, existing, salesperson } = context;
  const format = formatters(settings.booking.timeZone);
  const requested = Date.parse(data.startsAt);
  if (existing) {
    if (existing.startsAt.getTime() === requested) return { when: format.when(existing.startsAt.toISOString()) };
    throw new BookingError(bookingCopy.alreadyBooked);
  }
  if (!salesperson) throw new BookingError(bookingCopy.unavailableBody);
  const slot = (await getAvailableSlots(salesperson.id)).flatMap((day) => day.slots).find((entry) => Date.parse(entry.startsAt) === requested);
  if (!slot) throw new BookingError(bookingCopy.taken);
  await AppointmentModel.init();
  let appointmentId: string;
  try {
    const created = await AppointmentModel.create({ leadId: lead.id, vehicleId: lead.vehicleId, salespersonId: salesperson.id,
      dealershipId: lead.dealershipId, startsAt: slot.startsAt, endsAt: slot.endsAt, status: "booked" });
    appointmentId = created._id.toString();
  } catch (error) {
    if (!(error instanceof Error && "code" in error && error.code === 11000)) throw error;
    const winner = await findBooked(lead.id);
    if (winner?.startsAt.getTime() === requested) return { when: format.when(slot.startsAt) };
    throw new BookingError(winner ? bookingCopy.alreadyBooked : bookingCopy.taken);
  }
  // The appointment is committed; later failures are logged rather than reported to the customer.
  try { await advanceLeadForBooking(lead.id, settings.booking.appointmentStageKey); }
  catch { console.error("Appointment saved; lead stage update failed.", { appointmentId }); }
  try {
    await emit("appointment.booked", { leadId: lead.id, vehicleId: lead.vehicleId, dealershipId: lead.dealershipId,
      appointmentId, salespersonId: salesperson.id, startsAt: slot.startsAt, endsAt: slot.endsAt });
  } catch { console.error("Appointment saved; appointment.booked handler failed.", { appointmentId }); }
  return { when: format.when(slot.startsAt) };
}


export type StaffAppointment = { id: string; leadId: string; vehicleId: string; salespersonId: string; dealershipId: string; startsAt: string; endsAt: string; status: string };
function toStaffAppointment(document: { _id: unknown; leadId: unknown; vehicleId: unknown; salespersonId: unknown; dealershipId: unknown; startsAt: Date; endsAt: Date; status: string }): StaffAppointment {
  return { id: String(document._id), leadId: String(document.leadId), vehicleId: String(document.vehicleId), salespersonId: String(document.salespersonId),
    dealershipId: String(document.dealershipId), startsAt: document.startsAt.toISOString(), endsAt: document.endsAt.toISOString(), status: document.status };
}

/** Booked appointments ending after `from`, soonest first. Salespeople see only their own calendar. */
export async function listStaffAppointments(from: string, limit = 100) {
  const user = await requireRole();
  const since = new Date(z.string().datetime({ offset: true }).parse(from));
  await connectDb();
  const documents = await AppointmentModel.find({ status: "booked", endsAt: { $gt: since }, ...(user.role === "owner" ? {} : { salespersonId: user.id }) })
    .sort({ startsAt: 1, _id: 1 }).limit(limit).lean().exec();
  return documents.map(toStaffAppointment);
}

/** Appointments for one lead the user can see (lead visibility is enforced by the leads service). */
export async function listLeadAppointments(leadId: string) {
  const lead = await getLead(leadId);
  if (!lead) return [];
  await connectDb();
  const documents = await AppointmentModel.find({ leadId: lead.id }).sort({ startsAt: -1 }).limit(20).lean().exec();
  return documents.map(toStaffAppointment);
}

/** Destructive internal CLI import only; never expose through a server action. */
export async function replaceAppointmentsForSeed(input: unknown) {
  const records = z.array(appointmentSchema).parse(input);
  await connectDb();
  await AppointmentModel.init();
  const documents = records.map(({ id, ...data }) => new AppointmentModel({ _id: id, ...data }));
  // Validate all documents before clearing this collection.
  for (const document of documents) await document.validate();
  await AppointmentModel.deleteMany({}).exec();
  if (documents.length) await AppointmentModel.insertMany(documents);
  return documents.length;
}
