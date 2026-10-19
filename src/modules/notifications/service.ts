import "server-only";
import { z } from "zod";
import { requireRole } from "@/modules/auth/service";
import { objectIdSchema } from "@/lib/data-schema";
import { connectDb } from "@/lib/db";
import { NotificationModel } from "./model";
import { alertCategory, alertFilterSchema, notificationKinds, notificationSchema, notificationInputSchema, type AlertCategory, type NotificationKind } from "./schema";
import type { DomainEvent } from "@/lib/event-contract";
import { getSettings } from "@/modules/settings/service";
import { getLeadForAutomation, appendLeadActivity } from "@/modules/leads/service";
import { getVehicleForAutomation, appendVehicleActivity } from "@/modules/inventory/service";
import { getDealershipForAutomation } from "@/modules/dealerships/service";
import { getGarageForAutomation } from "@/modules/garages/service";
import { listAutomationStaff, findActiveUser } from "@/modules/users/service";
import { getEmailTemplate } from "@/modules/email-templates/service";
import { getEmailProvider, senderAddress, type EmailProvider } from "@/lib/email/provider";
import { sendLoggedEmail } from "@/modules/automations/service";
import { renderEmailTemplate, type TemplateValues } from "@/lib/email/template";
import { emailUrl } from "@/lib/email/url";
import { activityMessage, sentence, type ActivityLabels } from "./content";

type Settings = Awaited<ReturnType<typeof getSettings>>;

/** Settings-driven display values shared by audit entries, alerts and emails. */
function displayLabels(settings: Settings): Omit<ActivityLabels, "staffName" | "garageName"> {
  return {
    repairTypeLabel: (key) => settings.repairTypes.find((entry) => entry.key === key)?.label ?? key,
    statusLabel: (key) => settings.vehicleStatuses.find((entry) => entry.key === key)?.label ?? key,
    stageLabel: (key) => settings.leadStages.find((entry) => entry.key === key)?.label ?? key,
    money: (amount) => new Intl.NumberFormat("en-CA", { style: "currency", currency: "CAD" }).format(amount),
    time: (iso) => new Intl.DateTimeFormat("en-CA", { dateStyle: "full", timeStyle: "short", timeZone: settings.booking.timeZone }).format(new Date(iso)),
  };
}

export async function recordEventActivity(event: DomainEvent) {
  // Intake writes creation activity atomically with the lead, before emission.
  if (event.name === "lead.created") return;
  const settings = await getSettings();
  const [staff, garage] = await Promise.all([
    event.name === "lead.assigned" || event.name === "vehicle.sold" ? findActiveUser(event.payload.salespersonId) : null,
    event.name === "vehicle.repair_started" || event.name === "vehicle.repair_completed" ? getGarageForAutomation(event.payload.garageId) : null,
  ]);
  const labels: ActivityLabels = { ...displayLabels(settings), staffName: () => staff?.name ?? "a staff member", garageName: () => garage?.name ?? "the garage" };
  const activity = { type: event.name, eventId: event.id, occurredAt: event.occurredAt,
    actorId: "changedBy" in event.payload ? event.payload.changedBy ?? null : null, message: activityMessage(event, labels) };
  if ("leadId" in event.payload) await appendLeadActivity(event.payload.leadId, activity);
  else await appendVehicleActivity(event.payload.vehicleId, activity);
}

/** Idempotent per (eventId, user); true when the alert is new. */
async function createNotification(input: unknown) {
  const data = notificationInputSchema.parse(input);
  await connectDb();
  await NotificationModel.init();
  try {
    const result = await NotificationModel.updateOne({ eventId: data.eventId, userId: data.userId }, { $setOnInsert: data }, { upsert: true }).exec();
    return result.upsertedCount > 0;
  } catch (error) {
    if (!(error instanceof Error && "code" in error && error.code === 11000)) throw error;
    return false;
  }
}

/** Internal: in-app alerts from scheduled reminders, deduplicated by (eventId, user). Returns how many were new. */
export async function notifyUsers(input: { userIds: string[]; event: NotificationKind; eventId: string; message: string; link: string }) {
  const { userIds, ...alert } = input;
  const created = await Promise.all([...new Set(userIds)].map((userId) => createNotification({ ...alert, userId })));
  return created.filter(Boolean).length;
}

type Recipient = { id: string | null; name: string; email: string; channels: Set<"email" | "in_app"> };
/** Which rule recipients one dispatch covers: the customer, staff, or (by default) everyone. */
export type DispatchAudience = "customer" | "staff";
export type DispatchSummary = { recipients: { name: string; email: string; customer: boolean; channels: ("email" | "in_app")[] }[] };

/** Trusted event dispatch, with channels isolated so a mail failure cannot suppress in-app alerts. */
export async function dispatchNotifications(event: DomainEvent, provider?: EmailProvider, audience?: DispatchAudience): Promise<DispatchSummary> {
  const settings = await getSettings();
  const rules = settings.notificationRules.filter((rule) => rule.event === event.name);
  const covered = (role: string) => !audience || (audience === "customer") === (role === "customer");
  if (!rules.some((rule) => rule.recipients.some(covered))) return { recipients: [] };
  const [vehicle, dealership, lead] = await Promise.all([
    getVehicleForAutomation(event.payload.vehicleId), getDealershipForAutomation(event.payload.dealershipId),
    "leadId" in event.payload ? getLeadForAutomation(event.payload.leadId) : null,
  ]);
  const assignedId = "salespersonId" in event.payload ? event.payload.salespersonId : lead?.assignedTo;
  const assigned = assignedId ? await findActiveUser(assignedId) : null;
  const recipients = new Map<string, Recipient>();
  for (const rule of rules) for (const role of rule.recipients.filter(covered)) {
    const users = role === "customer" ? (lead ? [{ id: null, name: lead.name, email: lead.email }] : [])
      : role === "assigned_salesperson" ? (assigned && assigned.role === "salesperson" && assigned.dealershipId === event.payload.dealershipId ? [assigned] : [])
      : await listAutomationStaff(event.payload.dealershipId, role === "owners");
    for (const user of users) {
      const key = user.id ?? `customer:${user.email}`;
      const recipient = recipients.get(key) ?? { id: user.id, name: user.name, email: user.email, channels: new Set() };
      for (const channel of rule.channels) if (channel !== "in_app" || recipient.id) recipient.channels.add(channel);
      recipients.set(key, recipient);
    }
  }
  const name = `${vehicle.year} ${vehicle.make} ${vehicle.model} ${vehicle.trim}`.trim();
  const { statusLabel, stageLabel, money, time, repairTypeLabel } = displayLabels(settings);
  const link = lead ? `/crm/leads/${lead.id}` : `/crm/inventory/${vehicle.id}`;
  let message = lead ? `${lead.name} — ${name}: ${event.name === "lead.assigned" ? "new lead assigned to you" : "customer inquiry received"}.` : name;
  const values: TemplateValues = { companyName: settings.brand.companyName, vehicleName: name, stockNo: vehicle.stockNo,
    dealershipName: dealership.name, dealershipAddress: dealership.address, dealershipPhone: dealership.phone,
    customerName: lead?.name ?? "", customerMessage: lead?.message ?? "" };
  let template = event.name === "lead.created" || event.name === "lead.assigned" ? "new_lead" : "";
  switch (event.name) {
    case "vehicle.status_changed":
      template = "status_change";
      values.statusLabel = statusLabel(event.payload.status); values.previousStatusLabel = statusLabel(event.payload.previousStatus);
      message = `${name} (${vehicle.stockNo}) changed from ${values.previousStatusLabel} to ${values.statusLabel}.`;
      break;
    case "vehicle.price_changed":
      template = "price_change";
      values.price = money(event.payload.price); values.previousPrice = money(event.payload.previousPrice);
      message = `${name} (${vehicle.stockNo}) price changed from ${values.previousPrice} to ${values.price}.`;
      break;
    case "vehicle.repair_started":
    case "vehicle.repair_completed": {
      // Workflow moves reuse the status-change email; the in-app alert names the garage.
      template = "status_change";
      values.statusLabel = statusLabel(event.payload.status); values.previousStatusLabel = statusLabel(event.payload.previousStatus);
      const garage = (await getGarageForAutomation(event.payload.garageId)).name;
      const type = repairTypeLabel(event.payload.repairTypeKey);
      message = event.name === "vehicle.repair_started" ? `${name} (${vehicle.stockNo}) went to ${garage} for ${type}.`
        : `${name} (${vehicle.stockNo}) is back from ${garage} and ${values.statusLabel}.`;
      break;
    }
    case "vehicle.sold":
      template = "status_change";
      values.statusLabel = statusLabel(event.payload.status); values.previousStatusLabel = statusLabel(event.payload.previousStatus);
      message = `${name} (${vehicle.stockNo}) sold by ${assigned?.name ?? "the team"} for ${money(event.payload.price)}. Commission ${money(event.payload.commission)}.`;
      break;
    case "lead.stage_changed":
      template = "stage_change";
      values.stageLabel = stageLabel(event.payload.stage); values.previousStageLabel = stageLabel(event.payload.previousStage);
      message = `${lead?.name} — ${name}: stage changed from ${values.previousStageLabel} to ${values.stageLabel}.`;
      break;
    case "appointment.booked":
      template = "appointment_notice";
      values.appointmentTime = time(event.payload.startsAt);
      message = sentence(`${lead?.name} — ${name}: appointment booked for ${values.appointmentTime}`);
      break;
  }
  const tasks: Promise<unknown>[] = [];
  for (const recipient of recipients.values()) {
    if (recipient.id && recipient.channels.has("in_app")) tasks.push(createNotification({ userId: recipient.id, event: event.name, eventId: event.id, message, link }));
    if (recipient.channels.has("email")) tasks.push((async () => {
      const customer = recipient.id === null;
      const key = customer && (event.name === "lead.created" || event.name === "lead.assigned") ? "follow_up"
        : customer && event.name === "appointment.booked" ? "booking_confirmation" : template;
      const emailValues: TemplateValues = { ...values, salespersonName: customer ? assigned?.name ?? settings.brand.companyName : recipient.name,
        leadUrl: emailUrl(lead ? `/crm/leads/${lead.id}` : "/crm/leads"), vehicleUrl: emailUrl(`/crm/inventory/${vehicle.id}`),
        ...(customer && lead ? { bookingUrl: emailUrl(`/book/${encodeURIComponent(lead.bookingToken)}`) } : {}) };
      if ("changedBy" in event.payload && event.payload.changedBy) emailValues.changedByName = (await findActiveUser(event.payload.changedBy))?.name ?? "Staff";
      const content = renderEmailTemplate(await getEmailTemplate(key), emailValues);
      // Every send attempt lands in the Email log, so the lead journey and the CRM show it without a real inbox.
      await sendLoggedEmail({ from: senderAddress(settings.emailFrom), to: [recipient.email], ...content },
        { templateKey: key, leadId: lead?.id ?? null, vehicleId: vehicle.id }, provider ?? getEmailProvider());
    })());
  }
  const results = await Promise.allSettled(tasks);
  const failed = results.filter((result) => result.status === "rejected");
  if (failed.length) {
    // Logs deliberately exclude customer data, rendered messages, tokens and provider diagnostics.
    console.error("Notification delivery failed.", { eventId: event.id, event: event.name, failures: failed.length });
    throw new AggregateError(failed.map((result) => result.reason), "Notification delivery failed.");
  }
  return { recipients: [...recipients.values()].map((recipient) => ({ name: recipient.name, email: recipient.email, customer: recipient.id === null, channels: [...recipient.channels] })) };
}

export type StaffNotification = { id: string; event: string; message: string; link: string; readAt: string | null; createdAt: string };
function toStaffNotification(document: { _id: unknown; event: string; message: string; link: string; readAt?: Date | null; createdAt: Date }): StaffNotification {
  return { id: String(document._id), event: document.event, message: document.message, link: document.link,
    readAt: document.readAt ? document.readAt.toISOString() : null, createdAt: document.createdAt.toISOString() };
}

/** The signed-in user's own alerts, newest first, optionally one category (Leads, Inventory, Repairs, Reminders). */
export async function listMyNotifications(limit = 50, category?: AlertCategory) {
  const user = await requireRole();
  const filter = alertFilterSchema.parse({ category });
  await connectDb();
  const kinds = filter.category ? notificationKinds.filter((kind) => alertCategory(kind) === filter.category) : null;
  const documents = await NotificationModel.find({ userId: user.id, ...(kinds ? { event: { $in: kinds } } : {}) }).sort({ createdAt: -1, _id: -1 }).limit(limit).lean().exec();
  return documents.map(toStaffNotification);
}

/** The signed-in user's unread alerts per category, for the Alerts page filter chips. */
export async function countUnreadByCategory(): Promise<Record<AlertCategory, number>> {
  const user = await requireRole();
  await connectDb();
  const rows = await NotificationModel.aggregate<{ _id: string; count: number }>([
    { $match: { userId: new NotificationModel.base.Types.ObjectId(user.id), readAt: null } }, { $group: { _id: "$event", count: { $sum: 1 } } },
  ]).exec();
  const counts: Record<AlertCategory, number> = { leads: 0, inventory: 0, repairs: 0, reminders: 0 };
  for (const row of rows) counts[alertCategory(row._id)] += row.count;
  return counts;
}

/** Unread count plus the newest unread alert, for the header bell. */
export async function getUnreadSummary() {
  const user = await requireRole();
  await connectDb();
  const [unread, latest] = await Promise.all([
    NotificationModel.countDocuments({ userId: user.id, readAt: null }).exec(),
    NotificationModel.findOne({ userId: user.id, readAt: null }).sort({ createdAt: -1, _id: -1 }).lean().exec(),
  ]);
  return { unread, latest: latest ? toStaffNotification(latest) : null };
}

export async function markNotificationRead(id: unknown) {
  const user = await requireRole();
  await connectDb();
  await NotificationModel.updateOne({ _id: objectIdSchema.parse(id), userId: user.id, readAt: null }, { $set: { readAt: new Date() } }).exec();
}

export async function markAllNotificationsRead() {
  const user = await requireRole();
  await connectDb();
  await NotificationModel.updateMany({ userId: user.id, readAt: null }, { $set: { readAt: new Date() } }).exec();
}

/** Destructive internal CLI import only; never expose through a server action. */
export async function replaceNotificationsForSeed(input: unknown) {
  // Seeded alerts may carry a historical `createdAt`; Mongoose keeps a value supplied on insert.
  const records = z.array(notificationSchema.extend({ createdAt: z.string().datetime({ offset: true }).optional() })).parse(input);
  await connectDb();
  await NotificationModel.init();
  const documents = records.map(({ id, ...data }) => new NotificationModel({ _id: id, ...data }));
  // Validate all documents before clearing this collection.
  for (const document of documents) await document.validate();
  await NotificationModel.deleteMany({}).exec();
  if (documents.length) await NotificationModel.insertMany(documents);
  return documents.length;
}
