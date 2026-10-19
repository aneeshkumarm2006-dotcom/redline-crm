import "server-only";
import { requireRole } from "@/modules/auth/service";
import { getSettings } from "@/modules/settings/service";
import { getLead, getLeadForAutomation, listLeadQueues, listLeadsCreatedBetween, listRecentlyActiveLeads, recordLeadEmailContact } from "@/modules/leads/service";
import type { StaffLead } from "@/modules/leads/schema";
import { listJourneyRecords, sendLoggedEmail, type JourneyEmailRecord, type JourneyRunRecord } from "@/modules/automations/service";
import { listLeadAppointments } from "@/modules/appointments/service";
import { localWeek, startOfLocalMonth } from "@/modules/appointments/slots";
import { getVehicleForAutomation, getVehicleSummaries } from "@/modules/inventory/service";
import { getDealershipForAutomation, listDealerships } from "@/modules/dealerships/service";
import { findActiveUser, getStaffNames, listSalespeople } from "@/modules/users/service";
import { getEmailTemplate } from "@/modules/email-templates/service";
import { renderEmailTemplate } from "@/lib/email/template";
import { senderAddress } from "@/lib/email/provider";
import { emailUrl } from "@/lib/email/url";
import { buildJourney, elapsedSince, journeyStepKeys, type JourneyStep } from "./journey";
import { coordinatorQuerySchema, leadEmailSchema, type FeedItem } from "./schema";
import { coordinatorCopy as copy } from "./copy";

export class CoordinatorError extends Error {}

type Settings = Awaited<ReturnType<typeof getSettings>>;
type Records = { emails: JourneyEmailRecord[]; runs: JourneyRunRecord[] };

function journeyOf(lead: StaffLead, records: Records, settings: Settings) {
  return buildJourney(lead, records.emails.filter((entry) => entry.leadId === lead.id), records.runs.filter((entry) => entry.leadId === lead.id), settings);
}
const unique = (values: (string | null | undefined)[]) => [...new Set(values.filter((value): value is string => Boolean(value)))];
const vehicleName = (vehicle: { year: number; make: string; model: string } | undefined) => vehicle ? `${vehicle.year} ${vehicle.make} ${vehicle.model}` : copy.unknownVehicle;
const average = (values: number[]) => values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : null;

/** Journey steps for one lead the user can see, with the names of the staff involved. Null when not visible. */
export async function getLeadJourney(leadId: string) {
  const lead = await getLead(leadId);
  if (!lead) return null;
  const [settings, records] = await Promise.all([getSettings(), listJourneyRecords([lead.id])]);
  const steps = journeyOf(lead, records, settings);
  const names = await getStaffNames(unique([...steps.map((entry) => entry.actorId), lead.assignedTo]));
  return { steps, names, assignee: lead.assignedTo ? names.find((entry) => entry.id === lead.assignedTo)?.name ?? copy.unknownStaff : null };
}

/** Feed rows for the newest lead activity: mini journey plus the latest event and who did it. */
async function buildFeed(leads: StaffLead[], records: Records, settings: Settings): Promise<FeedItem[]> {
  const latest = (lead: StaffLead) => lead.activity.toSorted((a, b) => b.occurredAt.localeCompare(a.occurredAt))[0];
  const [vehicles, names] = await Promise.all([
    getVehicleSummaries(unique(leads.map((lead) => lead.vehicleId))),
    getStaffNames(unique(leads.flatMap((lead) => [lead.assignedTo, latest(lead)?.actorId]))),
  ]);
  const name = (id: string) => names.find((entry) => entry.id === id)?.name ?? copy.unknownStaff;
  return leads.map((lead) => {
    const event = latest(lead);
    const steps = journeyOf(lead, records, settings);
    return {
      id: lead.id, name: lead.name, createdAt: lead.createdAt,
      vehicle: vehicleName(vehicles.find((entry) => entry.id === lead.vehicleId)),
      assignee: lead.assignedTo ? name(lead.assignedTo) : null,
      steps: steps.map(({ key, state }) => ({ key, state })),
      // Null actors are the customer (inquiry, booking) or an automation (assignment, CRM update).
      latest: event ? { message: event.message, at: event.occurredAt,
        by: event.actorId ? name(event.actorId) : event.type === "lead.created" || event.type === "appointment.booked" ? copy.by.customer : copy.by.system } : null,
    };
  });
}

/** Owner live feed, polled every 20 seconds by the coordinator screen. */
export async function getCoordinatorFeed() {
  await requireRole("owner");
  const [settings, leads] = await Promise.all([getSettings(), listRecentlyActiveLeads(8)]);
  return buildFeed(leads, await listJourneyRecords(leads.map((lead) => lead.id)), settings);
}

/**
 * Owner overview: the 5-step flow for leads received this week (or month) with drop-off, average response
 * times, the Unassigned and Not-contacted queues, and the live feed's first page.
 */
export async function getCoordinatorOverview(input: unknown = {}, now = Date.now()) {
  await requireRole("owner");
  const { period } = coordinatorQuerySchema.parse(input);
  const settings = await getSettings();
  const zone = settings.booking.timeZone;
  const start = period === "week" ? localWeek(now, zone).start : startOfLocalMonth(now, zone);
  const [leads, queues, recent, salespeople, dealerships] = await Promise.all([
    listLeadsCreatedBetween(new Date(start).toISOString(), new Date(now + 1).toISOString()),
    listLeadQueues(now), listRecentlyActiveLeads(8), listSalespeople(), listDealerships(),
  ]);
  const records = await listJourneyRecords(unique([...leads, ...recent].map((lead) => lead.id)));
  const journeys = leads.map((lead) => ({ lead, steps: journeyOf(lead, records, settings) }));
  const stepOf = (steps: JourneyStep[], key: JourneyStep["key"]) => steps.find((entry) => entry.key === key)!;
  const flow = journeyStepKeys.map((key) => ({
    key, done: journeys.filter((entry) => stepOf(entry.steps, key).state === "done").length,
    failed: journeys.filter((entry) => stepOf(entry.steps, key).state === "failed").length,
  }));
  const contactTimes = leads.flatMap((lead) => elapsedSince(lead.createdAt, lead.firstContactedAt) ?? []);
  const bookingTimes = journeys.flatMap(({ lead, steps }) => stepOf(steps, "booked").state === "done" ? elapsedSince(lead.createdAt, stepOf(steps, "booked").at) ?? [] : []);
  const queueLeads = [...queues.unassigned, ...queues.uncontacted];
  const [feed, vehicles, assignees] = await Promise.all([
    buildFeed(recent, records, settings),
    getVehicleSummaries(unique(queueLeads.map((lead) => lead.vehicleId))),
    getStaffNames(unique(queueLeads.map((lead) => lead.assignedTo))),
  ]);
  return {
    settings, period, total: leads.length, flow, feed, dealerships,
    timing: { firstContact: average(contactTimes), firstContactCount: contactTimes.length, booking: average(bookingTimes), bookingCount: bookingTimes.length },
    queues: { ...queues, vehicles, assignees },
    // Quick assign lists active salespeople at each lead's location.
    salespeople: salespeople.filter((person) => person.active).map(({ id, name, dealershipId }) => ({ id, name, dealershipId })),
  };
}

/** Staff email to the customer from a stored template; logged on the lead and in the Email log, and counted as contact. */
export async function sendLeadEmail(input: unknown) {
  await requireRole();
  const { id, templateKey } = leadEmailSchema.parse(input);
  const lead = await getLead(id);
  if (!lead) throw new CoordinatorError(copy.notFound);
  const [settings, full, vehicle, dealership, appointments, assigned] = await Promise.all([
    getSettings(), getLeadForAutomation(lead.id), getVehicleForAutomation(lead.vehicleId), getDealershipForAutomation(lead.dealershipId),
    listLeadAppointments(lead.id), lead.assignedTo ? findActiveUser(lead.assignedTo) : null,
  ]);
  const upcoming = appointments.filter((entry) => entry.status === "booked" && Date.parse(entry.endsAt) > Date.now()).at(-1);
  if (templateKey === "appointment_reminder" && !upcoming) throw new CoordinatorError(copy.noAppointment);
  let content;
  try {
    content = renderEmailTemplate(await getEmailTemplate(templateKey), {
      companyName: settings.brand.companyName, customerName: lead.name,
      vehicleName: `${vehicle.year} ${vehicle.make} ${vehicle.model} ${vehicle.trim}`.trim(), stockNo: vehicle.stockNo,
      dealershipName: dealership.name, dealershipAddress: dealership.address, dealershipPhone: dealership.phone,
      salespersonName: assigned?.name ?? settings.brand.companyName,
      appointmentTime: upcoming ? new Intl.DateTimeFormat("en-CA", { dateStyle: "full", timeStyle: "short", timeZone: settings.booking.timeZone }).format(new Date(upcoming.startsAt)) : "",
      bookingUrl: emailUrl(`/book/${encodeURIComponent(full.bookingToken)}`),
    });
  } catch { throw new CoordinatorError(copy.templateError); }
  try {
    await sendLoggedEmail({ from: senderAddress(settings.emailFrom), to: [lead.email], ...content }, { templateKey, leadId: lead.id, vehicleId: lead.vehicleId });
  } catch { throw new CoordinatorError(copy.emailFailed); }
  await recordLeadEmailContact(lead.id, content.subject);
  return {};
}
