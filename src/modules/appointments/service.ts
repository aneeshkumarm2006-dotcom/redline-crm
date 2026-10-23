import "server-only";
import { z } from "zod";
import { connectDb } from "@/lib/db";
import { emit } from "@/lib/events";
import { objectIdSchema } from "@/lib/data-schema";
import { getSettings } from "@/modules/settings/service";
import { getLeadForBooking, getLead, getLeadForAutomation, appendLeadActivity } from "@/modules/leads/service";
import { requireRole } from "@/modules/auth/service";
import { getVehicleForAutomation } from "@/modules/inventory/service";
import { getDealershipForAutomation } from "@/modules/dealerships/service";
import { findActiveUser } from "@/modules/users/service";
import { AppointmentModel } from "./model";
import { appointmentSchema, appointmentStatusInputSchema, appointmentStatuses, bookingInputSchema, rescheduleInputSchema, staffBookingSchema } from "./schema";
import { buildSlotDays } from "./slots";
import { appointmentActionCopy, bookingCopy, staffBookingCopy } from "./copy";

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

/** The salesperson who can take a lead's appointment: assigned, active and at the lead's location. */
async function bookingSalesperson(lead: { assignedTo: string | null; dealershipId: string }) {
  const assigned = lead.assignedTo ? await findActiveUser(lead.assignedTo) : null;
  return assigned?.role === "salesperson" && assigned.dealershipId === lead.dealershipId ? assigned : null;
}

/** Lead, location and the salesperson who can take the appointment (assigned, active, same location). */
async function loadBooking(token: string) {
  const lead = await getLeadForBooking(token);
  if (!lead) return null;
  const [settings, dealership, vehicle, existing, salesperson] = await Promise.all([
    getSettings(), getDealershipForAutomation(lead.dealershipId), getVehicleForAutomation(lead.vehicleId),
    findBooked(lead.id), bookingSalesperson(lead),
  ]);
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
  const result = await commitBooking({ lead, salesperson, requested, actorId: null, messages: bookingCopy });
  return { when: format.when(result.startsAt) };
}

type BookingLead = { id: string; vehicleId: string; dealershipId: string };
/**
 * Inserts a booking for a currently free slot, then emits `appointment.booked` (whose recipes move the lead
 * to the appointment stage, confirm with the customer and alert the salesperson). Unique indexes settle races; a repeat of the lead's own booked time is a replay.
 * After the insert, failures are logged (and reported as `failed`) rather than undoing the booking.
 */
async function commitBooking({ lead, salesperson, requested, actorId, messages, byAssistant = false }: {
  lead: BookingLead; salesperson: { id: string }; requested: number;
  actorId: string | null; messages: { taken: string; alreadyBooked: string }; byAssistant?: boolean;
}) {
  const slot = (await getAvailableSlots(salesperson.id)).flatMap((day) => day.slots).find((entry) => Date.parse(entry.startsAt) === requested);
  if (!slot) throw new BookingError(messages.taken);
  await AppointmentModel.init();
  let appointmentId: string;
  try {
    const created = await AppointmentModel.create({ leadId: lead.id, vehicleId: lead.vehicleId, salespersonId: salesperson.id,
      dealershipId: lead.dealershipId, startsAt: slot.startsAt, endsAt: slot.endsAt, status: "booked" });
    appointmentId = created._id.toString();
  } catch (error) {
    if (!(error instanceof Error && "code" in error && error.code === 11000)) throw error;
    const winner = await findBooked(lead.id);
    if (winner?.startsAt.getTime() === requested) return { startsAt: slot.startsAt, failed: false };
    throw new BookingError(winner ? messages.alreadyBooked : messages.taken);
  }
  let failed = false;
  // The appointment is committed; later failures are logged rather than reported as a failed booking.
  // The lead's stage move is the `appointment_stage_update` recipe, run by the `appointment.booked` handlers.
  try {
    await emit("appointment.booked", { leadId: lead.id, vehicleId: lead.vehicleId, dealershipId: lead.dealershipId,
      appointmentId, salespersonId: salesperson.id, startsAt: slot.startsAt, endsAt: slot.endsAt, ...(actorId ? { changedBy: actorId } : {}), ...(byAssistant ? { bookedBy: "assistant" as const } : {}) });
  } catch { failed = true; console.error("Appointment saved; appointment.booked handler failed.", { appointmentId }); }
  return { startsAt: slot.startsAt, failed };
}

export type StaffBookingOptions =
  | { state: "unassigned" }
  | { state: "booked"; when: string }
  | { state: "open"; salespersonName: string; zone: string; days: { date: string; label: string; slots: { startsAt: string; label: string; when: string }[] }[] };

/** Free slots for staff booking on a customer's behalf, with the lead's assigned salesperson. Null when the lead is not visible. */
export async function getStaffBookingOptions(leadId: string): Promise<StaffBookingOptions | null> {
  const lead = await getLead(leadId);
  if (!lead) return null;
  const [settings, existing, salesperson] = await Promise.all([getSettings(), findBooked(lead.id), bookingSalesperson(lead)]);
  const format = formatters(settings.booking.timeZone);
  if (existing) return { state: "booked", when: format.when(existing.startsAt.toISOString()) };
  if (!salesperson) return { state: "unassigned" };
  const days = await getAvailableSlots(salesperson.id);
  return {
    state: "open", salespersonName: salesperson.name, zone: format.zone(new Date().toISOString()),
    days: days.map((day) => ({ date: day.date, label: format.day(day.slots[0].startsAt),
      slots: day.slots.map((slot) => ({ startsAt: slot.startsAt, label: format.time(slot.startsAt), when: format.when(slot.startsAt) })) })),
  };
}

/**
 * Staff books for the customer (phone, walk-in): the same slot rules, stage move, emails and alerts as
 * online booking, with the staff member recorded as the actor.
 */
export async function bookForLead(input: unknown) {
  const user = await requireRole();
  const data = staffBookingSchema.parse(input);
  const lead = await getLead(data.leadId);
  if (!lead) throw new BookingError(staffBookingCopy.notFound);
  const [settings, existing, salesperson] = await Promise.all([getSettings(), findBooked(lead.id), bookingSalesperson(lead)]);
  const format = formatters(settings.booking.timeZone);
  const requested = Date.parse(data.startsAt);
  if (existing) {
    if (existing.startsAt.getTime() === requested) return { when: format.when(existing.startsAt.toISOString()) };
    throw new BookingError(staffBookingCopy.alreadyBooked);
  }
  if (!salesperson) throw new BookingError(staffBookingCopy.unassigned);
  const result = await commitBooking({ lead, salesperson, requested, actorId: user.id, messages: staffBookingCopy });
  return { when: format.when(result.startsAt), ...(result.failed ? { warning: staffBookingCopy.savedWithWarning } : {}) };
}


export type AssistantSlots =
  | { state: "unassigned" }
  | { state: "booked"; when: string; startsAt: string; salespersonName: string | null }
  | { state: "open"; salespersonName: string; zone: string; days: { date: string; label: string; slots: { startsAt: string; label: string }[] }[] };

/** Internal (virtual assistant): the lead's booking state and free slots with its assigned salesperson. */
export async function getAssistantSlots(leadId: string): Promise<AssistantSlots> {
  const lead = await getLeadForAutomation(leadId);
  const [settings, existing, salesperson] = await Promise.all([getSettings(), findBooked(lead.id), bookingSalesperson(lead)]);
  const format = formatters(settings.booking.timeZone);
  if (existing) {
    const host = await findActiveUser(existing.salespersonId.toString());
    return { state: "booked", when: format.when(existing.startsAt.toISOString()), startsAt: existing.startsAt.toISOString(), salespersonName: host?.name ?? null };
  }
  if (!salesperson) return { state: "unassigned" };
  const days = await getAvailableSlots(salesperson.id);
  return {
    state: "open", salespersonName: salesperson.name, zone: format.zone(new Date().toISOString()),
    days: days.map((day) => ({ date: day.date, label: format.day(day.slots[0].startsAt),
      slots: day.slots.map((slot) => ({ startsAt: slot.startsAt, label: format.time(slot.startsAt) })) })),
  };
}

/**
 * Internal (virtual assistant): books a free slot the customer agreed to by email, with the same rules, stage move
 * and salesperson alert as the customer's own online booking (no staff actor). No separate confirmation email: the
 * assistant's reply in the thread confirms it.
 */
export async function bookForAssistant(leadId: string, startsAt: string) {
  const requested = Date.parse(z.string().datetime({ offset: true }).parse(startsAt));
  const lead = await getLeadForAutomation(leadId);
  const [settings, existing, salesperson] = await Promise.all([getSettings(), findBooked(lead.id), bookingSalesperson(lead)]);
  const format = formatters(settings.booking.timeZone);
  if (existing) {
    if (existing.startsAt.getTime() === requested) return { when: format.when(existing.startsAt.toISOString()) };
    throw new BookingError(bookingCopy.alreadyBooked);
  }
  if (!salesperson) throw new BookingError(bookingCopy.unavailableBody);
  const result = await commitBooking({ lead, salesperson, requested, actorId: null, messages: bookingCopy, byAssistant: true });
  return { when: format.when(result.startsAt) };
}

export type StaffAppointment ={ id: string; leadId: string; vehicleId: string; salespersonId: string; dealershipId: string; startsAt: string; endsAt: string; status: string };
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

/**
 * Appointments starting in [from, to), soonest first: booked and completed by default (team and profile stats);
 * the calendar can ask for cancelled and no-show visits too. Owners may narrow to one salesperson; salespeople
 * always get only their own.
 */
export async function listAppointmentsBetween(from: string, to: string, salespersonId?: string, statuses: readonly string[] = ["booked", "completed"]) {
  const user = await requireRole();
  const range = z.object({ from: z.string().datetime({ offset: true }), to: z.string().datetime({ offset: true }), salespersonId: objectIdSchema.optional(),
    statuses: z.array(z.enum(appointmentStatuses)).min(1) }).parse({ from, to, salespersonId, statuses });
  const person = user.role === "owner" ? range.salespersonId : user.id;
  await connectDb();
  const documents = await AppointmentModel.find({ status: { $in: range.statuses }, startsAt: { $gte: new Date(range.from), $lt: new Date(range.to) }, ...(person ? { salespersonId: person } : {}) })
    .sort({ startsAt: 1, _id: 1 }).limit(1000).lean().exec();
  return documents.map(toStaffAppointment);
}

/** An appointment the caller may manage: owners any, salespeople only their own. */
async function manageableAppointment(id: string) {
  const user = await requireRole();
  await connectDb();
  const document = await AppointmentModel.findOne({ _id: objectIdSchema.parse(id), ...(user.role === "owner" ? {} : { salespersonId: user.id }) }).lean().exec();
  if (!document) throw new BookingError(appointmentActionCopy.notFound);
  return { user, appointment: toStaffAppointment(document) };
}

const isDuplicate = (error: unknown) => error instanceof Error && "code" in error && error.code === 11000;

/**
 * Calendar status change (completed, no-show, cancelled, or back to booked). Restoring re-checks the unique
 * indexes, so a lead that has since rebooked or a slot that was retaken refuses cleanly. The change is noted on the lead.
 */
export async function setAppointmentStatus(input: unknown) {
  const data = appointmentStatusInputSchema.parse(input);
  const { user, appointment } = await manageableAppointment(data.id);
  if (appointment.status === data.status) return { message: appointmentActionCopy.status[data.status] };
  try {
    await AppointmentModel.updateOne({ _id: appointment.id }, { $set: { status: data.status } }).exec();
  } catch (error) {
    if (isDuplicate(error)) throw new BookingError(appointmentActionCopy.restoreConflict);
    throw error;
  }
  const { timeZone } = (await getSettings()).booking;
  await appendLeadActivity(appointment.leadId, { type: "note", message: appointmentActionCopy.statusNote(data.status, formatters(timeZone).when(appointment.startsAt)),
    occurredAt: new Date().toISOString(), actorId: user.id }).catch(() => console.error("Appointment status saved; lead activity note failed.", { id: appointment.id }));
  return { message: appointmentActionCopy.status[data.status] };
}

/** Free times with the appointment's salesperson for moving a booked visit. */
export async function getRescheduleOptions(id: string) {
  const { appointment } = await manageableAppointment(id);
  if (appointment.status !== "booked") throw new BookingError(appointmentActionCopy.notBooked);
  const [settings, host] = await Promise.all([getSettings(), findActiveUser(appointment.salespersonId)]);
  const format = formatters(settings.booking.timeZone);
  const days = await getAvailableSlots(appointment.salespersonId);
  return {
    salespersonName: host?.name ?? null, zone: format.zone(new Date().toISOString()),
    days: days.map((day) => ({ date: day.date, label: format.day(day.slots[0].startsAt),
      slots: day.slots.map((slot) => ({ startsAt: slot.startsAt, label: format.time(slot.startsAt), when: format.when(slot.startsAt) })) })),
  };
}

/**
 * Moves a booked visit to another free slot with the same salesperson. The unique slot index settles races.
 * No customer email is sent; the calendar tells staff to let the customer know.
 */
export async function rescheduleAppointment(input: unknown) {
  const data = rescheduleInputSchema.parse(input);
  const { user, appointment } = await manageableAppointment(data.id);
  if (appointment.status !== "booked") throw new BookingError(appointmentActionCopy.notBooked);
  const requested = Date.parse(data.startsAt);
  const slot = (await getAvailableSlots(appointment.salespersonId)).flatMap((day) => day.slots).find((entry) => Date.parse(entry.startsAt) === requested);
  if (!slot) throw new BookingError(staffBookingCopy.taken);
  try {
    await AppointmentModel.updateOne({ _id: appointment.id, status: "booked" }, { $set: { startsAt: slot.startsAt, endsAt: slot.endsAt } }).exec();
  } catch (error) {
    if (isDuplicate(error)) throw new BookingError(staffBookingCopy.taken);
    throw error;
  }
  const format = formatters((await getSettings()).booking.timeZone);
  const when = format.when(slot.startsAt);
  await appendLeadActivity(appointment.leadId, { type: "note", message: appointmentActionCopy.movedNote(format.when(appointment.startsAt), when),
    occurredAt: new Date().toISOString(), actorId: user.id }).catch(() => console.error("Appointment moved; lead activity note failed.", { id: appointment.id }));
  return { when };
}

/** Internal reminder read: booked appointments starting in [from, to), soonest first. */
export async function listBookedAppointmentsForAutomation(from: string, to: string) {
  const range = z.object({ from: z.string().datetime({ offset: true }), to: z.string().datetime({ offset: true }) }).parse({ from, to });
  await connectDb();
  const documents = await AppointmentModel.find({ status: "booked", startsAt: { $gte: new Date(range.from), $lt: new Date(range.to) } })
    .sort({ startsAt: 1, _id: 1 }).limit(1000).lean().exec();
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
