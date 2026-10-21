import "server-only";
import { senderAddress } from "@/lib/email/provider";
import { renderEmailTemplate } from "@/lib/email/template";
import { requireRole } from "@/modules/auth/service";
import { listAppointmentsBetween, listBookedAppointmentsForAutomation } from "@/modules/appointments/service";
import { localDate, startOfLocalDay } from "@/modules/appointments/slots";
import { getDealershipForAutomation } from "@/modules/dealerships/service";
import { getEmailTemplate } from "@/modules/email-templates/service";
import { getGarageForAutomation } from "@/modules/garages/service";
import { getInventoryAttention, getVehicleForAutomation, listReminderVehiclesForAutomation } from "@/modules/inventory/service";
import { getLeadForAutomation, listLeadQueues, listUncontactedLeadsForAutomation, listUnbookedLeadIdsForAutomation } from "@/modules/leads/service";
import { emailUrl } from "@/lib/email/url";
import { notifyUsers } from "@/modules/notifications/service";
import { getSettings } from "@/modules/settings/service";
import { findActiveUser, listAutomationStaff } from "@/modules/users/service";
import { getAssistantContactState } from "@/modules/assistant/service";
import { claimAutomationRun, finishAutomationRun, sendLoggedEmail } from "./service";
import { isRecipeEnabled, type AutomationRecipeKey, type AutomationRun, type ScheduledRunSummary } from "./schema";
import { reminderAlerts, runDetails } from "./copy";

const HOUR = 60 * 60_000;
const DAY = 24 * HOUR;
type Outcome = { outcome: AutomationRun["outcome"]; detail: string };
const vehicleName = (vehicle: { year: number; make: string; model: string; trim: string }) => `${vehicle.year} ${vehicle.make} ${vehicle.model} ${vehicle.trim}`.trim();
/** Local midnight of the next calendar day; 30 hours past midnight lands on the next day even across DST. */
const nextLocalDay = (dayStart: number, timeZone: string) => startOfLocalDay(dayStart + 30 * HOUR, timeZone);

/**
 * Every scheduled reminder in one idempotent pass: aging stock and overdue repairs (owner alerts), uncontacted
 * leads (salesperson reminder, owner escalation after twice the limit), tomorrow's appointments (customer email)
 * and today's appointments (salesperson morning alert).
 *
 * Each reminder is claimed in `automation_runs` under a deterministic key such as `aging:<vehicleId>:<yyyy-mm-dd>`
 * before it acts, and alerts reuse the unique (eventId, user) notification index, so the cron job and Run now can
 * overlap or repeat on the same day without sending anything twice. Internal: callers authorize first.
 */
export async function runScheduledAutomations(now = Date.now()): Promise<ScheduledRunSummary> {
  const settings = await getSettings();
  const zone = settings.booking.timeZone;
  const date = localDate(now, zone);
  const ranAt = new Date(now).toISOString();
  const todayStart = startOfLocalDay(now, zone);
  const tomorrowStart = nextLocalDay(todayStart, zone);
  const time = new Intl.DateTimeFormat("en-CA", { timeStyle: "short", timeZone: zone });
  const longTime = new Intl.DateTimeFormat("en-CA", { dateStyle: "full", timeStyle: "short", timeZone: zone });
  const tallies = new Map<AutomationRecipeKey, ScheduledRunSummary["recipes"][number]>();
  const tally = (key: AutomationRecipeKey) => {
    const entry = tallies.get(key) ?? { key, fired: 0, alreadyDone: 0, failed: 0, off: !isRecipeEnabled(settings.automations, key) };
    tallies.set(key, entry);
    return entry;
  };
  const on = (key: AutomationRecipeKey) => !tally(key).off;

  /** Claims one reminder, acts once, and records the outcome. A reminder already claimed today is left alone. */
  async function fire(recipeKey: AutomationRecipeKey, eventId: string, subject: AutomationRun["subject"], act: () => Promise<Outcome>) {
    const entry = tally(recipeKey);
    const claimed = await claimAutomationRun({ eventId, recipeKey, name: "schedule", subject, outcome: "skipped", detail: runDetails.running, ranAt });
    if (!claimed) { entry.alreadyDone++; return; }
    let result: Outcome;
    try { result = await act(); }
    catch { result = { outcome: "failed", detail: runDetails.failed(1) }; console.error("Scheduled reminder failed.", { eventId, recipeKey }); }
    await finishAutomationRun(eventId, recipeKey, result.outcome, result.detail.slice(0, 1000));
    if (result.outcome === "failed") entry.failed++; else entry.fired++;
  }
  let owners: string[] | null = null;
  const ownerIds = async (dealershipId: string) => (owners ??= (await listAutomationStaff(dealershipId, true)).map((user) => user.id));

  async function agingAndRepairs() {
    const { warnDays, criticalDays } = settings.inventoryAging;
    const limit = settings.repairOverdueDays;
    if (!on("aging_inventory_reminder") && !on("repair_overdue_reminder")) return;
    const { aging, overdue } = await listReminderVehiclesForAutomation(new Date(now - warnDays * DAY).toISOString(), new Date(now - limit * DAY).toISOString());
    const aged = aging.map((vehicle) => ({ vehicle, days: Math.floor((now - Date.parse(vehicle.dateInStock)) / DAY) })).filter((entry) => entry.days > warnDays);
    if (on("aging_inventory_reminder") && aged.length) {
      const recipients = await ownerIds(aged[0].vehicle.dealershipId);
      const critical = aged.filter((entry) => entry.days > criticalDays).length;
      // One digest alert per day for the owner; one run per car for the history.
      const alert = recipients.length ? notifyUsers({ userIds: recipients, event: "reminder.aging_inventory", eventId: `aging:${date}`,
        message: reminderAlerts.aging(aged.length, warnDays, critical, criticalDays), link: "/crm/inventory?aging=1" }) : null;
      const delivered = alert ? await alert.then(() => true, () => false) : false;
      for (const { vehicle, days } of aged) {
        await fire("aging_inventory_reminder", `aging:${vehicle.id}:${date}`, { type: "vehicle", id: vehicle.id }, async () => !recipients.length
          ? { outcome: "skipped", detail: runDetails.noRecipients }
          : delivered ? { outcome: "success", detail: runDetails.aging(vehicle.stockNo, vehicleName(vehicle), days, days > criticalDays ? criticalDays : warnDays) }
          : { outcome: "failed", detail: runDetails.failed(1) });
      }
    }
    if (on("repair_overdue_reminder")) for (const vehicle of overdue) {
      const days = Math.floor((now - Date.parse(vehicle.repair!.startedAt)) / DAY);
      if (days <= limit) continue;
      await fire("repair_overdue_reminder", `repair-overdue:${vehicle.id}:${date}`, { type: "vehicle", id: vehicle.id }, async () => {
        const recipients = await ownerIds(vehicle.dealershipId);
        if (!recipients.length) return { outcome: "skipped", detail: runDetails.noRecipients };
        const garage = (await getGarageForAutomation(vehicle.repair!.garageId)).name;
        await notifyUsers({ userIds: recipients, event: "reminder.repair_overdue", eventId: `repair-overdue:${vehicle.id}:${date}`,
          message: reminderAlerts.repairOverdue(vehicleName(vehicle), vehicle.stockNo, garage, days, limit), link: `/crm/inventory/${vehicle.id}?tab=repairs` });
        return { outcome: "success", detail: runDetails.repairOverdue(vehicle.stockNo, garage, days, limit) };
      });
    }
  }

  async function uncontacted() {
    if (!on("uncontacted_lead_reminder")) return;
    const limit = settings.uncontactedLeadHours;
    const leads = await listUncontactedLeadsForAutomation(new Date(now - limit * HOUR).toISOString());
    for (const lead of leads) {
      const hours = Math.floor((now - Date.parse(lead.createdAt)) / HOUR);
      if (hours <= limit) continue;
      await fire("uncontacted_lead_reminder", `uncontacted:${lead.id}:${date}`, { type: "lead", id: lead.id }, async () => {
        const [assigned, vehicle] = await Promise.all([lead.assignedTo ? findActiveUser(lead.assignedTo) : null, getVehicleForAutomation(lead.vehicleId)]);
        const salesperson = assigned?.role === "salesperson" ? assigned : null;
        const escalated = !salesperson || hours > 2 * limit;
        const link = `/crm/leads/${lead.id}`;
        if (salesperson) await notifyUsers({ userIds: [salesperson.id], event: "reminder.uncontacted_lead", eventId: `uncontacted:${lead.id}:${date}`,
          message: reminderAlerts.uncontacted(lead.name, vehicleName(vehicle), hours), link });
        const recipients = escalated ? await ownerIds(lead.dealershipId) : [];
        if (recipients.length) await notifyUsers({ userIds: recipients, event: "reminder.uncontacted_lead", eventId: `uncontacted-escalation:${lead.id}:${date}`,
          message: reminderAlerts.escalated(lead.name, vehicleName(vehicle), hours, salesperson?.name ?? null), link });
        if (!salesperson && !recipients.length) return { outcome: "skipped", detail: runDetails.noRecipients };
        return { outcome: "success", detail: runDetails.uncontacted(lead.name, hours, salesperson?.name ?? null, escalated && recipients.length > 0) };
      });
    }
  }

  async function customerReminders() {
    if (!on("appointment_customer_reminder")) return;
    const appointments = await listBookedAppointmentsForAutomation(new Date(tomorrowStart).toISOString(), new Date(nextLocalDay(tomorrowStart, zone)).toISOString());
    for (const appointment of appointments) {
      await fire("appointment_customer_reminder", `appt-reminder:${appointment.id}:${date}`, { type: "appointment", id: appointment.id }, async () => {
        const [lead, vehicle, dealership, template] = await Promise.all([getLeadForAutomation(appointment.leadId), getVehicleForAutomation(appointment.vehicleId),
          getDealershipForAutomation(appointment.dealershipId), getEmailTemplate("appointment_reminder")]);
        const salesperson = await findActiveUser(appointment.salespersonId);
        const content = renderEmailTemplate(template, { companyName: settings.brand.companyName, customerName: lead.name, vehicleName: vehicleName(vehicle),
          stockNo: vehicle.stockNo, dealershipName: dealership.name, dealershipAddress: dealership.address, dealershipPhone: dealership.phone,
          salespersonName: salesperson?.name ?? settings.brand.companyName, appointmentTime: longTime.format(new Date(appointment.startsAt)) });
        try {
          await sendLoggedEmail({ from: senderAddress(settings.emailFrom), to: [lead.email], ...content },
            { templateKey: "appointment_reminder", leadId: lead.id, vehicleId: vehicle.id });
        } catch { return { outcome: "failed", detail: runDetails.customerReminderFailed }; }
        return { outcome: "success", detail: runDetails.customerReminder(lead.email) };
      });
    }
  }

  /**
   * Customers who enquired but have not booked get follow-up emails on the configured days (e.g. day 2 and day 5).
   * Keys are per lead and step (`follow-up:<leadId>:<step>`), never per day, so each step goes out once. If a run was
   * missed and several steps are due, only the latest is sent and the earlier ones are recorded as skipped.
   */
  async function customerFollowUps() {
    if (!on("lead_customer_follow_up")) return;
    const days = settings.customerFollowUpDays;
    const leads = await listUnbookedLeadIdsForAutomation(new Date(now - days[0] * DAY).toISOString());
    for (const { id, createdAt } of leads) {
      const age = Math.floor((now - Date.parse(createdAt)) / DAY);
      const due = days.flatMap((day, index) => day <= age ? [index] : []);
      if (!due.length) continue;
      const latest = due.at(-1)!;
      for (const index of due.slice(0, -1)) {
        await claimAutomationRun({ eventId: `follow-up:${id}:${index + 1}`, recipeKey: "lead_customer_follow_up", name: "schedule",
          subject: { type: "lead", id }, outcome: "skipped", detail: runDetails.followUpSuperseded, ranAt });
      }
      await fire("lead_customer_follow_up", `follow-up:${id}:${latest + 1}`, { type: "lead", id }, async () => {
        // A customer who unsubscribed, or who is talking with the assistant or staff by email, gets no templated nudge.
        const contact = await getAssistantContactState(id, now);
        if (contact.optedOut) return { outcome: "skipped", detail: runDetails.optedOut };
        if (contact.inConversation) return { outcome: "skipped", detail: runDetails.inConversation };
        const lead = await getLeadForAutomation(id);
        const final = latest === days.length - 1;
        const [vehicle, dealership, template, assigned] = await Promise.all([getVehicleForAutomation(lead.vehicleId), getDealershipForAutomation(lead.dealershipId),
          getEmailTemplate(final ? "follow_up_3" : "follow_up_2"), lead.assignedTo ? findActiveUser(lead.assignedTo) : null]);
        const content = renderEmailTemplate(template, { companyName: settings.brand.companyName, customerName: lead.name, vehicleName: vehicleName(vehicle),
          stockNo: vehicle.stockNo, dealershipName: dealership.name, dealershipAddress: dealership.address, dealershipPhone: dealership.phone,
          salespersonName: assigned?.name ?? settings.brand.companyName, bookingUrl: emailUrl(`/book/${encodeURIComponent(lead.bookingToken)}`) });
        try {
          await sendLoggedEmail({ from: senderAddress(settings.emailFrom), to: [lead.email], ...content },
            { templateKey: final ? "follow_up_3" : "follow_up_2", leadId: lead.id, vehicleId: vehicle.id });
        } catch { return { outcome: "failed", detail: runDetails.followUpFailed }; }
        return { outcome: "success", detail: runDetails.followUp(latest + 1, days.length, lead.email, days[latest]) };
      });
    }
  }

  async function morningAlerts() {
    if (!on("appointment_morning_alert")) return;
    const appointments = await listBookedAppointmentsForAutomation(new Date(todayStart).toISOString(), new Date(tomorrowStart).toISOString());
    const bySalesperson = Map.groupBy(appointments, (appointment) => appointment.salespersonId);
    for (const [salespersonId, list] of bySalesperson) {
      await fire("appointment_morning_alert", `appt-today:${salespersonId}:${date}`, { type: "user", id: salespersonId }, async () => {
        const person = await findActiveUser(salespersonId);
        if (!person) return { outcome: "skipped", detail: runDetails.noRecipients };
        const first = list[0];
        const customer = (await getLeadForAutomation(first.leadId)).name;
        const at = time.format(new Date(first.startsAt));
        await notifyUsers({ userIds: [person.id], event: "reminder.appointment_today", eventId: `appt-today:${date}`,
          message: reminderAlerts.morning(list.length, at, customer), link: "/crm/leads/appointments" });
        return { outcome: "success", detail: runDetails.morning(person.name, list.length, at) };
      });
    }
  }

  // Independent recipes run side by side; each one's failure is contained to its own reminders.
  const results = await Promise.allSettled([agingAndRepairs(), uncontacted(), customerReminders(), customerFollowUps(), morningAlerts()]);
  if (results.some((result) => result.status === "rejected")) console.error("A scheduled recipe could not run.", { date });
  for (const key of ["aging_inventory_reminder", "repair_overdue_reminder", "uncontacted_lead_reminder", "appointment_customer_reminder", "lead_customer_follow_up", "appointment_morning_alert"] as const) tally(key);
  return { ranAt, recipes: [...tallies.values()] };
}

/** Owner's Run now button on the Automations page. */
export async function runScheduledAutomationsNow() {
  await requireRole("owner");
  return runScheduledAutomations(Date.now());
}

export type NeedsAttention = Awaited<ReturnType<typeof getNeedsAttention>>;
/**
 * What needs someone today, scoped like every staff read: aging stock and overdue repairs (at a salesperson's own
 * location), unassigned leads (owners), leads not contacted in time, and booked appointments today. Owners may
 * narrow it to one location (the dashboard filter).
 */
export async function getNeedsAttention(now: number, dealershipId?: string) {
  const user = await requireRole();
  const settings = await getSettings();
  const zone = settings.booking.timeZone;
  const todayStart = startOfLocalDay(now, zone);
  const location = user.role === "owner" ? dealershipId : undefined;
  const [inventory, queues, today] = await Promise.all([
    getInventoryAttention(now, location), listLeadQueues(now, location),
    listAppointmentsBetween(new Date(todayStart).toISOString(), new Date(nextLocalDay(todayStart, zone)).toISOString()),
  ]);
  return {
    role: user.role, ...inventory, unassigned: queues.unassigned.length, uncontacted: queues.uncontacted.length,
    appointmentsToday: today.filter((entry) => entry.status === "booked" && (!location || entry.dealershipId === location)).length,
    limits: { ...settings.inventoryAging, repairOverdueDays: settings.repairOverdueDays, uncontactedLeadHours: settings.uncontactedLeadHours },
  };
}
