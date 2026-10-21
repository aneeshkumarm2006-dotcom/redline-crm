import { randomBytes, randomUUID } from "node:crypto";
import { z } from "zod";
import { dealershipSchema } from "../../src/modules/dealerships/schema";
import { garageSchema } from "../../src/modules/garages/schema";
import { vehicleSchema, type Vehicle } from "../../src/modules/inventory/schema";
import { leadSchema, type Lead } from "../../src/modules/leads/schema";
import { appointmentSchema, type Appointment } from "../../src/modules/appointments/schema";
import { notificationSchema, type Notification } from "../../src/modules/notifications/schema";
import { sentence } from "../../src/modules/notifications/content";
import { emailTemplateSchema } from "../../src/modules/email-templates/schema";
import { automationRecipeKeys, automationRunSchema, emailLogSchema, type AutomationRecipeKey, type AutomationRun, type EmailLogEntry } from "../../src/modules/automations/schema";
import { initializeUserSchema, userIdSchema } from "../../src/modules/users/schema";
import { settingsSchema, weekdays } from "../../src/modules/settings/schema";
import { renderEmailTemplate } from "../../src/lib/email/template";
import type { EventName } from "../../src/lib/event-contract";
import { demoSettings } from "./settings";
import { demoEmailTemplates } from "./templates";
import { vehiclePhotos } from "./photos";
import {
  catalog, contactNotes, createdActivity, demoGarages, demoLocations, demoStaff, leadSpecs, lotAges, lotHolds, lotRepairs, lotSales,
  monthlySalesBaseline, sourceMessages,
} from "./fixtures";

export { demoStaff } from "./fixtures";

const id = () => randomBytes(12).toString("hex");
const MINUTE = 60_000;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;
const dated = { createdAt: z.string().datetime({ offset: true }).optional() };
const userRecordSchema = initializeUserSchema.extend({ id: userIdSchema });
export const demoDataSchema = z.object({
  settings: settingsSchema, dealerships: z.array(dealershipSchema), garages: z.array(garageSchema), users: z.array(userRecordSchema),
  vehicles: z.array(vehicleSchema), leads: z.array(leadSchema.extend(dated)), appointments: z.array(appointmentSchema),
  notifications: z.array(notificationSchema.extend(dated)), emailTemplates: z.array(emailTemplateSchema),
  automationRuns: z.array(automationRunSchema), emailLog: z.array(emailLogSchema),
}).strict();
export type DemoData = z.infer<typeof demoDataSchema>;

/** Deterministic variation: reseeding gives the same shape; only IDs, tokens and relative dates change. */
function mulberry32(seed: number) {
  return () => {
    seed = (seed + 0x6D2B79F5) | 0;
    let value = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    value = (value + Math.imul(value ^ (value >>> 7), 61 | value)) ^ value;
    return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
  };
}
const weekdayNames: Record<string, (typeof weekdays)[number]> = {
  Mon: "monday", Tue: "tuesday", Wed: "wednesday", Thu: "thursday", Fri: "friday", Sat: "saturday", Sun: "sunday",
};
function zonedParts(ms: number, zone: string) {
  const parts = Object.fromEntries(new Intl.DateTimeFormat("en-US", {
    timeZone: zone, hourCycle: "h23", year: "numeric", month: "numeric", day: "numeric", hour: "numeric", minute: "numeric", weekday: "short",
  }).formatToParts(new Date(ms)).map((part) => [part.type, part.value]));
  return { year: Number(parts.year), month: Number(parts.month) - 1, day: Number(parts.day), hour: Number(parts.hour), minute: Number(parts.minute), weekday: weekdayNames[parts.weekday] };
}
/** The instant of a local wall-clock time in `zone`. Month, day and minute may overflow, as with Date.UTC. */
function zonedTime(zone: string, year: number, month: number, day: number, hour = 0, minute = 0) {
  const guess = Date.UTC(year, month, day, hour, minute);
  const local = zonedParts(guess, zone);
  return guess - (Date.UTC(local.year, local.month, local.day, local.hour, local.minute) - guess);
}
const pad = (value: number, length: number) => String(value).padStart(length, "0");
const minutesOf = (time: string) => Number(time.slice(0, 2)) * 60 + Number(time.slice(3));

type DatedLead = Lead & { createdAt: string };
type DatedNotification = Notification & { createdAt: string };

export function buildDemoData(passwordHashes: Record<string, string>, now = new Date(), appUrl = process.env.APP_URL ?? "http://localhost:3000"): DemoData {
  const settings = demoSettings;
  const zone = settings.booking.timeZone;
  const { statusRoles } = settings;
  const t = now.getTime();
  const random = mulberry32(20261019);
  const between = (min: number, max: number) => min + random() * (max - min);
  const iso = (ms: number) => new Date(ms).toISOString();
  const link = (path: string) => new URL(path, appUrl).href;
  const money = (amount: number) => new Intl.NumberFormat("en-CA", { style: "currency", currency: "CAD" }).format(amount);
  const when = (ms: number) => new Intl.DateTimeFormat("en-CA", { dateStyle: "full", timeStyle: "short", timeZone: zone }).format(new Date(ms));
  const label = (list: { key: string; label: string }[], key: string) => list.find((entry) => entry.key === key)?.label ?? key;
  const localDate = (ms: number) => { const local = zonedParts(ms, zone); return `${local.year}-${pad(local.month + 1, 2)}-${pad(local.day, 2)}`; };
  const today = zonedParts(t, zone);
  const monthStart = (back: number) => zonedTime(zone, today.year, today.month - back, 1);
  // Emails and alerts are generated for the last 30 days; older events keep their audit trail and automation runs.
  const recent = (at: number) => at > t - 30 * DAY;

  const dealerships = demoLocations.map((location, i) => ({
    id: id(), name: `Clairmount Auto — ${location} (Demo)`,
    address: `${100 + i * 100} Demo Avenue, ${location} — placeholder address`,
    phone: `+1 416 555 010${i}`, active: true,
  }));
  const garages = demoGarages.map((garage) => ({ ...garage, id: id(), active: true }));
  const users = demoStaff.map(({ location, ...user }) => ({
    ...user, id: id(), passwordHash: passwordHashes[user.email], active: true,
    dealershipId: location === null ? null : dealerships[location].id,
  }));
  const owner = users.find((user) => user.role === "owner")!;
  const salespeople = users.filter((user) => user.role === "salesperson");
  const staff = (userId: string) => users.find((user) => user.id === userId)!;
  const team = (dealershipId: string) => salespeople.filter((user) => user.dealershipId === dealershipId);
  const location = (dealershipId: string) => dealerships.find((entry) => entry.id === dealershipId)!;

  const automationRuns: AutomationRun[] = [];
  const emailLog: EmailLogEntry[] = [];
  const notifications: DatedNotification[] = [];
  const run = (eventId: string, recipeKey: AutomationRecipeKey, name: string, subject: AutomationRun["subject"], at: number, detail: string, outcome: AutomationRun["outcome"] = "success") => {
    automationRuns.push({ id: id(), eventId, recipeKey, name, subject, outcome, detail, ranAt: iso(at) });
  };
  const email = (templateKey: string, to: string, values: Record<string, string>, at: number, refs: { leadId?: string; vehicleId?: string }, error?: string) => {
    const template = demoEmailTemplates.find((entry) => entry.key === templateKey)!;
    emailLog.push({ id: id(), to: [to], ...renderEmailTemplate(template, values), templateKey, leadId: refs.leadId ?? null, vehicleId: refs.vehicleId ?? null,
      provider: "console", status: error ? "failed" : "sent", error: error ?? null, messageId: null, sentAt: iso(at) });
  };
  const notify = (userId: string, event: EventName, message: string, path: string, at: number, eventId: string) => {
    // Older alerts have been read; the last two days stay unread so every bell has something new.
    const readAt = at < t - 2 * DAY ? iso(Math.min(at + between(1, 10) * HOUR, t - HOUR)) : null;
    notifications.push({ id: id(), eventId, userId, event, message, link: path, readAt, createdAt: iso(at) });
  };

  // ---- Vehicles ----------------------------------------------------------------------------------
  const vehicleName = (vehicle: Vehicle) => `${vehicle.year} ${vehicle.make} ${vehicle.model} ${vehicle.trim}`.trim();
  const commissionFor = (price: number) => price < 20_000 ? 300 : price < 27_000 ? 400 : price < 34_000 ? 500 : 650;
  function makeVehicle(stockNo: string, vin: string, spec: (typeof catalog)[number], repeat: boolean, dealershipId: string, acquiredAt: number): Vehicle {
    const [year, make, model, trim, altTrim, km, basePrice] = spec;
    const price = repeat ? basePrice + Math.round(between(-3, 3)) * 1000 : basePrice;
    return {
      id: id(), stockNo, vin, year, make, model, trim: repeat ? altTrim : trim,
      mileage: repeat ? Math.max(5000, Math.round((km + between(-15_000, 15_000)) / 100) * 100) : km,
      price, status: statusRoles.available, dealershipId, photos: vehiclePhotos({ year, make, model }), dateInStock: iso(acquiredAt),
      priceHistory: [], statusHistory: [], activity: [],
      acquisitionCost: Math.round(price * between(0.8, 0.87) / 50) * 50, commission: commissionFor(price),
      repair: null, repairHistory: [], sale: null,
    };
  }
  const statusLabel = (key: string) => label(settings.vehicleStatuses, key);
  /** Repair and sale moves are recorded as their workflow event (in-app alerts only), like the live app. */
  type Workflow = { event: "vehicle.repair_started" | "vehicle.repair_completed" | "vehicle.sold"; recipe: AutomationRecipeKey; activity: string; alert: string };
  function setStatus(vehicle: Vehicle, status: string, at: number, workflow?: Workflow) {
    const eventId = randomUUID();
    const previous = vehicle.status;
    const change = `Status changed from ${statusLabel(previous)} to ${statusLabel(status)}.`;
    vehicle.statusHistory.push({ previousStatus: previous, status, changedAt: iso(at), changedBy: owner.id });
    vehicle.activity.push({ type: workflow?.event ?? "vehicle.status_changed", message: workflow ? `${workflow.activity} ${change}` : change, occurredAt: iso(at), actorId: owner.id, eventId });
    vehicle.status = status;
    const people = team(vehicle.dealershipId);
    const names = people.map((person) => person.name).join(" and ");
    if (workflow) run(eventId, workflow.recipe, workflow.event, { type: "vehicle", id: vehicle.id }, at + 2000, `${workflow.activity} Alerted ${names} in the app.`);
    else run(eventId, "vehicle_status_alert", "vehicle.status_changed", { type: "vehicle", id: vehicle.id }, at + 2000, `Alerted ${names} in the app and by email.`);
    if (recent(at)) for (const person of people) {
      if (workflow) { notify(person.id, workflow.event, workflow.alert, `/crm/inventory/${vehicle.id}`, at + 2000, eventId); continue; }
      notify(person.id, "vehicle.status_changed", `${vehicleName(vehicle)} (${vehicle.stockNo}) changed from ${statusLabel(previous)} to ${statusLabel(status)}.`, `/crm/inventory/${vehicle.id}`, at + 2000, eventId);
      email("status_change", person.email, { vehicleName: vehicleName(vehicle), stockNo: vehicle.stockNo, dealershipName: location(vehicle.dealershipId).name,
        previousStatusLabel: statusLabel(previous), statusLabel: statusLabel(status), changedByName: owner.name, vehicleUrl: link(`/crm/inventory/${vehicle.id}`) }, at + 3000, { vehicleId: vehicle.id });
    }
    return eventId;
  }
  function setPrice(vehicle: Vehicle, price: number, at: number) {
    const eventId = randomUUID();
    const previous = vehicle.price;
    vehicle.priceHistory.push({ previousPrice: previous, price, changedAt: iso(at), changedBy: owner.id });
    vehicle.activity.push({ type: "vehicle.price_changed", message: `Price changed from ${money(previous)} to ${money(price)}.`, occurredAt: iso(at), actorId: owner.id, eventId });
    vehicle.price = price;
    const people = team(vehicle.dealershipId);
    run(eventId, "vehicle_price_alert", "vehicle.price_changed", { type: "vehicle", id: vehicle.id }, at + 2000, `Alerted ${people.map((person) => person.name).join(" and ")} in the app and by email.`);
    if (recent(at)) for (const person of people) {
      notify(person.id, "vehicle.price_changed", `${vehicleName(vehicle)} (${vehicle.stockNo}) price changed from ${money(previous)} to ${money(price)}.`, `/crm/inventory/${vehicle.id}`, at + 2000, eventId);
      email("price_change", person.email, { vehicleName: vehicleName(vehicle), stockNo: vehicle.stockNo, dealershipName: location(vehicle.dealershipId).name,
        previousPrice: money(previous), price: money(price), changedByName: owner.name, vehicleUrl: link(`/crm/inventory/${vehicle.id}`) }, at + 3000, { vehicleId: vehicle.id });
    }
  }
  const repairCost: Record<string, [number, number]> = {
    mechanical: [400, 1800], body_paint: [600, 2500], detailing: [150, 350], tires: [500, 1100], safety_inspection: [100, 250], electrical: [250, 900],
  };
  const garageFor = (typeKey: string) => {
    const options = garages.filter((garage) => garage.specialties.includes(typeKey));
    return options[Math.floor(random() * options.length)];
  };
  type SeedGarage = (typeof garages)[number];
  const repairLabel = (typeKey: string) => label(settings.repairTypes, typeKey);
  const repairStarted = (vehicle: Vehicle, typeKey: string, garage: SeedGarage): Workflow => ({
    event: "vehicle.repair_started", recipe: "repair_alert", activity: `Sent to ${garage.name} for ${repairLabel(typeKey)}.`,
    alert: `${vehicleName(vehicle)} (${vehicle.stockNo}) went to ${garage.name} for ${repairLabel(typeKey)}.`,
  });
  const repairCompleted = (vehicle: Vehicle, typeKey: string, garage: SeedGarage, cost: number): Workflow => ({
    event: "vehicle.repair_completed", recipe: "repair_alert", activity: `${repairLabel(typeKey)} at ${garage.name} completed for ${money(cost)}.`,
    alert: `${vehicleName(vehicle)} (${vehicle.stockNo}) is back from ${garage.name} and ${statusLabel(statusRoles.available)}.`,
  });
  /** A finished repair (e.g. intake inspection): In Repair and back, plus a history entry. Returns the completion time. */
  function completedRepair(vehicle: Vehicle, typeKey: string, startedAt: number, completedAt: number) {
    const garage = garageFor(typeKey);
    const [min, max] = repairCost[typeKey];
    const cost = Math.round(between(min, max) / 10) * 10;
    setStatus(vehicle, statusRoles.repair, startedAt, repairStarted(vehicle, typeKey, garage));
    setStatus(vehicle, statusRoles.available, completedAt, repairCompleted(vehicle, typeKey, garage, cost));
    vehicle.repairHistory.push({ typeKey, garageId: garage.id, startedAt: iso(startedAt), completedAt: iso(completedAt), cost, completedBy: owner.id });
    return completedAt;
  }
  const intakeTypes = ["safety_inspection", "detailing", "tires", "mechanical", "body_paint"];
  function sell(vehicle: Vehicle, sellerId: string, soldAt: number) {
    const price = vehicle.price - [0, 500, 1000, 1500][Math.floor(random() * 4)];
    const seller = staff(sellerId).name;
    setStatus(vehicle, statusRoles.sold, soldAt, { event: "vehicle.sold", recipe: "sale_recorded",
      activity: `Sold by ${seller} for ${money(price)}, commission ${money(vehicle.commission)}.`,
      alert: `${vehicleName(vehicle)} (${vehicle.stockNo}) sold by ${seller} for ${money(price)}. Commission ${money(vehicle.commission)}.` });
    vehicle.sale = { salespersonId: sellerId, leadId: null, price, commission: vehicle.commission, soldAt: iso(soldAt), recordedBy: owner.id };
  }

  // The lot this month: CLA-001…CLA-045 (the first 27 keep their v1 identities, including the demo Jeep).
  const lot = lotAges.map((age, i) => {
    const repeat = i >= catalog.length;
    const acquiredAt = t - age * DAY - between(1, 6) * HOUR;
    const vehicle = makeVehicle(`CLA-${pad(i + 1, 3)}`, `1DEM000A${pad(i + 1, 9)}`, catalog[repeat ? (i * 7) % catalog.length : i], repeat, dealerships[i % 3].id, acquiredAt);
    const repair = lotRepairs.find(([index]) => index === i);
    const sale = lotSales.find(([index]) => index === i);
    let last = acquiredAt;
    // Most cars go through an intake inspection or detail in their first days.
    if (!repair && (i % 3 === 0 || i % 5 === 0) && age >= 6) {
      const startedAt = acquiredAt + between(0.5, 1.5) * DAY;
      last = completedRepair(vehicle, intakeTypes[i % intakeTypes.length], startedAt, Math.min(startedAt + between(1, 3.5) * DAY, t - DAY / 2));
    }
    // Aging stock has been marked down once, or twice past 90 days.
    if (!sale && age > settings.inventoryAging.warnDays) {
      const final = vehicle.price;
      const critical = age > settings.inventoryAging.criticalDays;
      vehicle.price = final + (critical ? 2500 : 1500);
      setPrice(vehicle, critical ? final + 1000 : final, acquiredAt + 35 * DAY);
      if (critical) setPrice(vehicle, final, acquiredAt + 75 * DAY);
      last = acquiredAt + (critical ? 75 : 35) * DAY;
    } else if (!sale && !repair && i % 4 === 0 && i > 0) {
      const at = Math.max(last + HOUR, t - between(1, 5) * DAY);
      vehicle.price += 1000;
      setPrice(vehicle, vehicle.price - 1000, at);
      last = at;
    }
    if (lotHolds.includes(i)) setStatus(vehicle, "hold", Math.max(last + HOUR, t - between(0.2, 4) * DAY));
    if (repair) {
      const [, typeKey, garage, days, estimatedCost, notes] = repair;
      const startedAt = t - days * DAY - between(1, 5) * HOUR;
      setStatus(vehicle, statusRoles.repair, startedAt, repairStarted(vehicle, typeKey, garages[garage]));
      vehicle.repair = { typeKey, garageId: garages[garage].id, startedAt: iso(startedAt), estimatedCost, notes };
    }
    if (sale) {
      const lower = Math.min(Math.max(monthStart(0) + 6 * HOUR, last + DAY), t - 4 * HOUR);
      sell(vehicle, users.find((user) => user.email === sale[1])!.id, between(lower, t - 2 * HOUR));
    }
    return vehicle;
  });

  // Five earlier months of sales, varied per person so the leaderboard and charts look real.
  const history: Vehicle[] = [];
  let serial = 0;
  for (let back = 5; back >= 1; back--) {
    const [start, end] = [monthStart(back), monthStart(back - 1)];
    salespeople.forEach((person, p) => {
      const count = Math.max(0, monthlySalesBaseline[person.email] + [0, 1, -1, 0, 1, -1, 0][(back * 2 + p) % 7]);
      for (let n = 0; n < count; n++) {
        serial++;
        const soldAt = between(start + DAY, end - DAY);
        const inStock = between(8, 75) * DAY;
        const acquiredAt = soldAt - inStock;
        const vehicle = makeVehicle(`CLA-${100 + serial}`, `1DEM000B${pad(serial, 9)}`, catalog[(serial * 5 + 3) % catalog.length], serial % 2 === 0, person.dealershipId!, acquiredAt);
        if (serial % 3 !== 0) {
          const startedAt = acquiredAt + between(0.5, 1.5) * DAY;
          completedRepair(vehicle, intakeTypes[serial % intakeTypes.length], startedAt, startedAt + between(1, 3) * DAY);
        }
        if (inStock > 50 * DAY) { vehicle.price += 1500; setPrice(vehicle, vehicle.price - 1500, acquiredAt + 40 * DAY); }
        sell(vehicle, person.id, soldAt);
        history.push(vehicle);
      }
    });
  }
  history.sort((a, b) => Date.parse(b.sale!.soldAt) - Date.parse(a.sale!.soldAt));
  const vehicles = [...lot, ...history];

  // ---- Leads, appointments and their automation journey ----------------------------------------------
  const stageLabel = (key: string) => label(settings.leadStages, key);
  const firstStage = [...settings.leadStages].sort((a, b) => a.order - b.order)[0].key;
  const cursors = new Map<string, number>();
  const nextSalesperson = (dealershipId: string) => {
    const people = team(dealershipId);
    const next = cursors.get(dealershipId) ?? 0;
    cursors.set(dealershipId, next + 1);
    return people[next % people.length];
  };
  // Upcoming bookings fill open days from today: [open day, slot]. Today's slots are late in the day.
  const openDays: { year: number; month: number; day: number; opens: number; closes: number }[] = [];
  for (let offset = 0; openDays.length < 6; offset++) {
    const local = zonedParts(zonedTime(zone, today.year, today.month, today.day + offset, 12), zone);
    const hours = settings.booking.businessHours[local.weekday];
    if (hours) openDays.push({ ...local, opens: minutesOf(hours.opensAt), closes: minutesOf(hours.closesAt) });
  }
  const slotPlan = [[0, 0], [0, 1], [1, 0], [1, 2], [2, 1], [3, 0], [4, 2], [5, 1]];
  const slotLength = settings.booking.slotLengthMinutes * MINUTE;
  const upcomingSlot = (index: number) => {
    const [dayIndex, slot] = slotPlan[index % slotPlan.length];
    const day = openDays[dayIndex];
    const minutes = dayIndex === 0 ? day.closes - 120 + slot * 60 : day.opens + [90, 210, 330][slot];
    return zonedTime(zone, day.year, day.month, day.day, 0, minutes);
  };
  /** A past appointment at 1–3 p.m. local on the first open day after `after`, or the midpoint if none fits. */
  const pastSlot = (after: number, before: number) => {
    const local = zonedParts(after, zone);
    for (let offset = 1; offset < 8; offset++) {
      const candidate = zonedTime(zone, local.year, local.month, local.day + offset, 13 + Math.floor(random() * 3));
      if (candidate + slotLength >= before) break;
      if (settings.booking.businessHours[zonedParts(candidate, zone).weekday]) return candidate;
    }
    return after + (before - after) / 2;
  };

  const leads: DatedLead[] = [];
  const appointments: Appointment[] = [];
  let bookings = 0;
  leadSpecs.forEach((spec, i) => {
    const vehicle = spec.vehicle.startsWith("H") ? history[Number(spec.vehicle.slice(1))] : lot.find((entry) => entry.stockNo === spec.vehicle)!;
    const acquiredAt = Date.parse(vehicle.dateInStock);
    const soldAt = vehicle.sale ? Date.parse(vehicle.sale.soldAt) : null;
    const assignee = spec.unassigned ? null : spec.stage === "won" ? staff(vehicle.sale!.salespersonId) : nextSalesperson(vehicle.dealershipId);
    let createdAt = spec.hours !== undefined ? t - spec.hours * HOUR : soldAt! - between(5, 14) * DAY;
    createdAt = Math.max(createdAt, acquiredAt + 12 * HOUR);
    if (soldAt) createdAt = Math.min(createdAt, soldAt - 2 * DAY);
    const name = vehicleName(vehicle);
    const place = location(vehicle.dealershipId);
    const lead: DatedLead = {
      id: id(), name: spec.name, email: `${spec.name.toLowerCase().replace(/[^a-z ]/g, "").replaceAll(" ", ".")}@example.com`,
      phone: `+1 ${["416", "647", "905"][i % 3]} 555 01${pad(10 + i, 2)}`,
      message: spec.message ?? sourceMessages[spec.source](`${vehicle.year} ${vehicle.make} ${vehicle.model}`),
      vehicleId: vehicle.id, dealershipId: vehicle.dealershipId, assignedTo: assignee?.id ?? null, stage: firstStage, source: spec.source,
      bookingToken: randomBytes(32).toString("base64url"), activity: [], firstContactedAt: null, createdAt: iso(createdAt),
    };
    leads.push(lead);
    const subject = { type: "lead" as const, id: lead.id };
    const refs = { leadId: lead.id, vehicleId: vehicle.id };
    const leadPath = `/crm/leads/${lead.id}`;
    const setStage = (stage: string, at: number, actorId: string | null) => {
      lead.activity.push({ type: "lead.stage_changed", message: `Stage changed from ${stageLabel(lead.stage)} to ${stageLabel(stage)}.`, occurredAt: iso(at), actorId, eventId: randomUUID() });
      lead.stage = stage;
    };

    // 1. Inquiry received. Phone, walk-in and referral leads are typed in by staff.
    const staffEntered = ["phone", "walk_in", "referral"].includes(spec.source);
    const createdEvent = randomUUID();
    lead.activity.push({ type: "lead.created", message: createdActivity[spec.source], occurredAt: iso(createdAt), actorId: staffEntered ? (assignee ?? owner).id : null, eventId: createdEvent });
    if (createdAt > t - 3 * DAY || !assignee) notify(owner.id, "lead.created", `${lead.name} — ${name}: customer inquiry received.`, leadPath, createdAt + 5000, createdEvent);

    // 2. Assignment: round-robin for online inquiries; staff who log a lead keep it.
    let at = createdAt + 40_000;
    if (assignee) {
      const assignedEvent = randomUUID();
      lead.activity.push({ type: "lead.assigned", message: `Lead assigned to ${assignee.name}.`, occurredAt: iso(at), actorId: staffEntered ? assignee.id : null, eventId: assignedEvent });
      if (staffEntered) {
        run(createdEvent, "lead_auto_assign", "lead.created", subject, at, `Entered by ${assignee.name}, who kept the lead.`, "skipped");
        run(assignedEvent, "lead_assigned_alert", "lead.assigned", subject, at + 2000, `${assignee.name} assigned the lead to themselves; no alert needed.`, "skipped");
      } else {
        run(createdEvent, "lead_auto_assign", "lead.created", subject, at, `Assigned to ${assignee.name} (round-robin, ${place.name}).`);
        run(assignedEvent, "lead_assigned_alert", "lead.assigned", subject, at + 2000, `Alerted ${assignee.name} in the app and by email.`);
        notify(assignee.id, "lead.assigned", `${lead.name} — ${name}: new lead assigned to you.`, leadPath, at + 2000, assignedEvent);
        email("new_lead", assignee.email, { salespersonName: assignee.name, customerName: lead.name, vehicleName: name, stockNo: vehicle.stockNo, dealershipName: place.name,
          customerMessage: lead.message, leadUrl: link(leadPath) }, at + 3000, refs);
      }
    } else if (spec.unassigned === "failed") {
      run(createdEvent, "lead_auto_assign", "lead.created", subject, at, "No salesperson could be assigned automatically; left in the Unassigned queue.", "failed");
    } else {
      run(createdEvent, "lead_auto_assign", "lead.created", subject, at, `Entered by ${owner.name}; the owner assigns walk-ins.`, "skipped");
    }

    // 3. Automated follow-up email with the customer's booking link.
    at = createdAt + 75_000;
    if (spec.source === "walk_in") {
      run(createdEvent, "lead_follow_up_email", "lead.created", subject, at, "Walk-in customer: no follow-up email needed.", "skipped");
    } else {
      email("follow_up", lead.email, { customerName: lead.name, vehicleName: name, bookingUrl: link(`/book/${encodeURIComponent(lead.bookingToken)}`),
        dealershipName: place.name, dealershipPhone: place.phone, salespersonName: assignee?.name ?? settings.brand.companyName, companyName: settings.brand.companyName }, at, refs, spec.emailFails ? "Recipient mailbox unavailable." : undefined);
      run(createdEvent, "lead_follow_up_email", "lead.created", subject, at + 1000,
        spec.emailFails ? `Email to ${lead.email} failed: recipient mailbox unavailable.` : `Follow-up email with a booking link sent to ${lead.email}.`,
        spec.emailFails ? "failed" : "success");
    }
    if (spec.stage === "new" || !assignee) return;

    // 4. First contact by the salesperson.
    const end = soldAt ?? t;
    const contactAt = createdAt + Math.min(between(0.3, 5) * HOUR, (end - createdAt) * 0.2);
    lead.firstContactedAt = iso(contactAt);
    lead.activity.push({ ...contactNotes[i % contactNotes.length], occurredAt: iso(contactAt), actorId: assignee.id });
    setStage("contacted", contactAt + MINUTE, assignee.id);
    let last = contactAt + MINUTE;

    // 5. Appointment booked from the emailed link; the CRM moves the lead to Appointment.
    if (spec.stage === "appointment" || spec.stage === "won" || spec.appointment) {
      const bookedAt = contactAt + Math.min(between(2, 20) * HOUR, (end - contactAt) * 0.3);
      const startsAt = spec.stage === "appointment" ? upcomingSlot(bookings++) : pastSlot(bookedAt, spec.stage === "won" ? soldAt! - HOUR : t - HOUR);
      const time = when(startsAt);
      const bookedEvent = randomUUID();
      lead.activity.push({ type: "appointment.booked", message: sentence(`Appointment booked for ${time}`), occurredAt: iso(bookedAt), actorId: null, eventId: bookedEvent });
      appointments.push({ id: id(), leadId: lead.id, vehicleId: vehicle.id, salespersonId: assignee.id, dealershipId: vehicle.dealershipId,
        startsAt: iso(startsAt), endsAt: iso(startsAt + slotLength), status: spec.stage === "appointment" ? "booked" : spec.appointment ?? "completed" });
      email("booking_confirmation", lead.email, { customerName: lead.name, vehicleName: name, appointmentTime: time, salespersonName: assignee.name,
        dealershipName: place.name, dealershipAddress: place.address, dealershipPhone: place.phone, companyName: settings.brand.companyName }, bookedAt + 2000, refs);
      run(bookedEvent, "appointment_confirmation", "appointment.booked", subject, bookedAt + 2500, `Confirmation email sent to ${lead.email}.`);
      notify(assignee.id, "appointment.booked", sentence(`${lead.name} — ${name}: appointment booked for ${time}`), leadPath, bookedAt + 2000, bookedEvent);
      email("appointment_notice", assignee.email, { salespersonName: assignee.name, customerName: lead.name, vehicleName: name, dealershipName: place.name,
        appointmentTime: time, leadUrl: link(leadPath) }, bookedAt + 3000, refs);
      run(bookedEvent, "appointment_alert", "appointment.booked", subject, bookedAt + 3500, `Alerted ${assignee.name} in the app and by email.`);
      setStage(settings.booking.appointmentStageKey, bookedAt + 4000, null);
      run(bookedEvent, "appointment_stage_update", "appointment.booked", subject, bookedAt + 4500, `Lead moved to ${stageLabel(settings.booking.appointmentStageKey)}.`);
      last = Math.max(bookedAt + 4000, spec.stage === "appointment" ? 0 : startsAt + slotLength);
    }

    // 6. Outcome: the owner records the sale (lead → Won), or the salesperson closes it as lost.
    if (spec.stage === "won") {
      vehicle.sale!.leadId = lead.id;
      setStage(settings.wonStageKey, soldAt! + 5000, owner.id);
    } else if (spec.stage === "lost") {
      const from = Math.max(last, soldAt ?? 0);
      const lostAt = soldAt ? Math.min(soldAt + between(2, 20) * HOUR, t - HOUR) : from + Math.min(between(1, 5) * DAY, (t - from) * 0.5);
      lead.activity.push({ type: "note", message: spec.lostReason ?? "Customer went quiet.", occurredAt: iso(lostAt), actorId: assignee.id });
      setStage("lost", lostAt + MINUTE, assignee.id);
    }
  });

  // ---- Scheduled reminders from the last two mornings (today's run is left for the live "Run now") ----
  const { warnDays, criticalDays } = settings.inventoryAging;
  for (const back of [2, 1]) {
    const runAt = zonedTime(zone, today.year, today.month, today.day - back, 7);
    const date = localDate(runAt);
    const schedule = (eventId: string, recipeKey: AutomationRecipeKey, subject: AutomationRun["subject"], detail: string) =>
      run(eventId, recipeKey, "schedule", subject, runAt + random() * MINUTE, detail);
    for (const vehicle of lot) {
      if (vehicle.sale && Date.parse(vehicle.sale.soldAt) < runAt) continue;
      const age = Math.floor((runAt - Date.parse(vehicle.dateInStock)) / DAY);
      if (age > warnDays) {
        schedule(`aging:${vehicle.id}:${date}`, "aging_inventory_reminder", { type: "vehicle", id: vehicle.id },
          `${vehicle.stockNo} ${vehicleName(vehicle)} has been in stock ${age} days (over the ${age > criticalDays ? criticalDays : warnDays}-day limit). Owner alerted.`);
      }
      if (vehicle.repair && Date.parse(vehicle.repair.startedAt) < runAt) {
        const days = Math.floor((runAt - Date.parse(vehicle.repair.startedAt)) / DAY);
        const garage = garages.find((entry) => entry.id === vehicle.repair!.garageId)!;
        if (days > settings.repairOverdueDays) schedule(`repair-overdue:${vehicle.id}:${date}`, "repair_overdue_reminder", { type: "vehicle", id: vehicle.id },
          `${vehicle.stockNo} has been at ${garage.name} for ${days} days (limit ${settings.repairOverdueDays}). Owner alerted.`);
      }
    }
    for (const lead of leads) {
      const hours = Math.floor((runAt - Date.parse(lead.createdAt)) / HOUR);
      if (lead.stage !== firstStage || !lead.assignedTo || hours <= settings.uncontactedLeadHours) continue;
      const escalated = hours > 2 * settings.uncontactedLeadHours;
      schedule(`uncontacted:${lead.id}:${date}`, "uncontacted_lead_reminder", { type: "lead", id: lead.id },
        `${lead.name} not contacted after ${hours} hours. Reminder sent to ${staff(lead.assignedTo).name}${escalated ? "; escalated to the owner" : ""}.`);
    }
    for (const appointment of appointments) {
      if (appointment.status !== "booked" || localDate(Date.parse(appointment.startsAt)) !== localDate(runAt + DAY)) continue;
      const lead = leads.find((entry) => entry.id === appointment.leadId)!;
      const vehicle = vehicles.find((entry) => entry.id === appointment.vehicleId)!;
      const place = location(appointment.dealershipId);
      const at = runAt + 2 * HOUR;
      email("appointment_reminder", lead.email, { customerName: lead.name, vehicleName: vehicleName(vehicle), appointmentTime: when(Date.parse(appointment.startsAt)),
        dealershipName: place.name, dealershipAddress: place.address, dealershipPhone: place.phone, companyName: settings.brand.companyName,
        salespersonName: users.find((user) => user.id === appointment.salespersonId)?.name ?? settings.brand.companyName }, at, { leadId: lead.id, vehicleId: vehicle.id });
      run(`appt-reminder:${appointment.id}:${date}`, "appointment_customer_reminder", "schedule", { type: "appointment", id: appointment.id }, at, `Reminder email sent to ${lead.email}.`);
    }
  }

  return validateDemoData({
    settings, dealerships, garages, users, vehicles, leads, appointments, notifications,
    emailTemplates: demoEmailTemplates.map((template) => ({ ...template, id: id() })),
    automationRuns: automationRuns.sort((a, b) => Date.parse(a.ranAt) - Date.parse(b.ranAt)),
    emailLog: emailLog.sort((a, b) => Date.parse(a.sentAt) - Date.parse(b.sentAt)),
  });
}

/** Whole-plan preflight: refuse bad fixtures before any collection is cleared. */
export function validateDemoData(input: unknown): DemoData {
  const data = demoDataSchema.parse(input);
  const demand = (condition: unknown, message: string) => { if (!condition) throw new Error(message); };
  const unique = (values: string[]) => values.length === new Set(values).size;
  for (const records of [data.dealerships, data.garages, data.users, data.vehicles, data.leads, data.appointments, data.notifications, data.emailTemplates, data.automationRuns, data.emailLog]) {
    demand(unique(records.map((record) => record.id)), "Duplicate record ID.");
  }
  demand(unique(data.users.map((user) => user.email)), "Duplicate user email.");
  demand(unique(data.vehicles.map((vehicle) => vehicle.stockNo)), "Duplicate stock number.");
  demand(unique(data.vehicles.map((vehicle) => vehicle.vin)), "Duplicate VIN.");
  demand(unique(data.leads.map((lead) => lead.bookingToken)), "Duplicate booking token.");
  demand(unique(data.emailTemplates.map((template) => template.key)), "Duplicate email template key.");
  demand(unique(data.automationRuns.map((entry) => `${entry.eventId}|${entry.recipeKey}`)), "Duplicate automation run.");
  demand(unique(data.notifications.filter((entry) => entry.eventId).map((entry) => `${entry.eventId}|${entry.userId}`)), "Duplicate notification event.");

  const { settings } = data;
  const statuses = new Set(settings.vehicleStatuses.map((status) => status.key));
  const stages = new Set(settings.leadStages.map((stage) => stage.key));
  const sources = new Set(settings.leadSources.map((source) => source.key));
  const repairTypes = new Set(settings.repairTypes.map((type) => type.key));
  const recipes = new Set<string>(automationRecipeKeys);
  demand(Object.values(settings.statusRoles).every((key) => statuses.has(key)), "Status roles must reference configured statuses.");
  demand(settings.publicInventoryStatusKeys.every((key) => statuses.has(key)), "Public inventory statuses must be configured.");
  demand(stages.has(settings.wonStageKey) && stages.has(settings.lostStageKey) && stages.has(settings.booking.appointmentStageKey), "Won/lost/appointment stages must be configured.");
  demand(settings.wonStageKey !== settings.lostStageKey, "Won and lost stages must differ.");
  demand(sources.has(settings.publicInquirySourceKey), "The public inquiry source must be configured.");
  demand(Object.keys(settings.automations).every((key) => recipes.has(key)), "Unknown automation recipe toggle.");

  const locations = new Set(data.dealerships.map((record) => record.id));
  const garages = new Map(data.garages.map((record) => [record.id, record]));
  const staff = new Map(data.users.map((record) => [record.id, record]));
  const vehicles = new Map(data.vehicles.map((record) => [record.id, record]));
  const leads = new Map(data.leads.map((record) => [record.id, record]));
  const appointments = new Map(data.appointments.map((record) => [record.id, record]));
  const salesperson = (id: string, dealershipId: string) => {
    const user = staff.get(id);
    return user?.role === "salesperson" && user.active && user.dealershipId === dealershipId;
  };
  for (const garage of data.garages) demand(garage.specialties.every((key) => repairTypes.has(key)), "Invalid garage specialty.");
  for (const user of data.users) {
    demand(user.dealershipId === null ? user.role === "owner" : locations.has(user.dealershipId), "Invalid staff location.");
  }
  for (const vehicle of data.vehicles) {
    demand(locations.has(vehicle.dealershipId) && statuses.has(vehicle.status), "Invalid vehicle location/status.");
    for (const entry of vehicle.statusHistory) demand(statuses.has(entry.status) && statuses.has(entry.previousStatus) && staff.has(entry.changedBy), "Invalid status history.");
    for (const entry of vehicle.priceHistory) demand(staff.has(entry.changedBy), "Invalid price history actor.");
    for (const entry of vehicle.activity) demand(entry.actorId === null || staff.has(entry.actorId), "Invalid vehicle activity actor.");
    // A car is In Repair exactly when it has a current repair, and Sold exactly when it has a sale.
    demand((vehicle.status === settings.statusRoles.repair) === (vehicle.repair !== null), "Repair status and repair record disagree.");
    demand((vehicle.status === settings.statusRoles.sold) === (vehicle.sale !== null), "Sold status and sale record disagree.");
    if (vehicle.repair) {
      const garage = garages.get(vehicle.repair.garageId);
      demand(garage?.active && repairTypes.has(vehicle.repair.typeKey) && garage.specialties.includes(vehicle.repair.typeKey), "Invalid current repair.");
      demand(Date.parse(vehicle.repair.startedAt) >= Date.parse(vehicle.dateInStock), "Repair started before acquisition.");
    }
    for (const entry of vehicle.repairHistory) {
      demand(garages.has(entry.garageId) && repairTypes.has(entry.typeKey) && staff.has(entry.completedBy), "Invalid repair history.");
      demand(Date.parse(entry.startedAt) >= Date.parse(vehicle.dateInStock), "Repair started before acquisition.");
    }
    if (vehicle.sale) {
      const { sale } = vehicle;
      demand(salesperson(sale.salespersonId, vehicle.dealershipId) && staff.has(sale.recordedBy), "Invalid sale salesperson.");
      demand(Date.parse(sale.soldAt) >= Date.parse(vehicle.dateInStock), "Sold before acquisition.");
      if (sale.leadId) {
        const lead = leads.get(sale.leadId);
        demand(lead?.vehicleId === vehicle.id && lead.stage === settings.wonStageKey && lead.assignedTo === sale.salespersonId, "Invalid sale lead.");
      }
    }
  }
  for (const lead of data.leads) {
    demand(vehicles.get(lead.vehicleId)?.dealershipId === lead.dealershipId && stages.has(lead.stage) && sources.has(lead.source), "Invalid lead vehicle/location/stage/source.");
    if (lead.assignedTo) demand(salesperson(lead.assignedTo, lead.dealershipId), "Invalid lead assignee.");
    if (lead.firstContactedAt && lead.createdAt) demand(Date.parse(lead.firstContactedAt) >= Date.parse(lead.createdAt), "Lead contacted before it was created.");
    if (lead.stage === settings.wonStageKey) demand(data.vehicles.some((vehicle) => vehicle.sale?.leadId === lead.id), "Won lead without a sale.");
    for (const entry of lead.activity) demand(entry.actorId === null || staff.has(entry.actorId), "Invalid activity actor.");
  }
  for (const appointment of data.appointments) {
    const lead = leads.get(appointment.leadId);
    demand(lead && lead.vehicleId === appointment.vehicleId && lead.dealershipId === appointment.dealershipId && lead.assignedTo === appointment.salespersonId, "Invalid appointment references.");
    demand(salesperson(appointment.salespersonId, appointment.dealershipId), "Invalid appointment salesperson.");
    if (appointment.status === "booked") for (const other of data.appointments) {
      if (other.id === appointment.id || other.status !== "booked") continue;
      demand(other.leadId !== appointment.leadId, "Duplicate active lead booking.");
      demand(other.salespersonId !== appointment.salespersonId || Date.parse(other.endsAt) <= Date.parse(appointment.startsAt) || Date.parse(other.startsAt) >= Date.parse(appointment.endsAt), "Overlapping appointments.");
    }
  }
  for (const notification of data.notifications) demand(staff.has(notification.userId), "Invalid notification recipient.");
  const subjects = { lead: leads, vehicle: vehicles, appointment: appointments, user: staff } as Record<string, Map<string, unknown>>;
  for (const entry of data.automationRuns) {
    demand(recipes.has(entry.recipeKey) && subjects[entry.subject.type].has(entry.subject.id), "Invalid automation run.");
  }
  for (const entry of data.emailLog) {
    demand(entry.templateKey === null || data.emailTemplates.some((template) => template.key === entry.templateKey), "Email log references an unknown template.");
    demand((entry.leadId === null || leads.has(entry.leadId)) && (entry.vehicleId === null || vehicles.has(entry.vehicleId)), "Invalid email log reference.");
  }
  return data;
}
