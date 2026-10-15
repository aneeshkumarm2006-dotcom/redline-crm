import { randomBytes } from "node:crypto";
import { z } from "zod";
import { dealershipSchema } from "../../src/modules/dealerships/schema";
import { vehicleSchema } from "../../src/modules/inventory/schema";
import { leadSchema, type Lead } from "../../src/modules/leads/schema";
import { appointmentSchema } from "../../src/modules/appointments/schema";
import { notificationSchema } from "../../src/modules/notifications/schema";
import { emailTemplateSchema } from "../../src/modules/email-templates/schema";
import { initializeUserSchema, userIdSchema } from "../../src/modules/users/schema";
import { settingsSchema } from "../../src/modules/settings/schema";
import { demoSettings } from "./settings";
import { demoEmailTemplates } from "./templates";

const id = () => randomBytes(12).toString("hex");
const day = 86_400_000;
const userRecordSchema = initializeUserSchema.extend({ id: userIdSchema });
export const demoDataSchema = z.object({
  settings: settingsSchema, dealerships: z.array(dealershipSchema), users: z.array(userRecordSchema),
  vehicles: z.array(vehicleSchema), leads: z.array(leadSchema), appointments: z.array(appointmentSchema),
  notifications: z.array(notificationSchema), emailTemplates: z.array(emailTemplateSchema),
}).strict();
export type DemoData = z.infer<typeof demoDataSchema>;

export const demoStaff = [
  { name: "Demo Owner", email: "owner@clairmount.example", role: "owner" as const, location: null },
  { name: "Alex Morgan", email: "salesperson@clairmount.example", role: "salesperson" as const, location: 0 },
  { name: "Priya Shah", email: "priya@clairmount.example", role: "salesperson" as const, location: 0 },
  { name: "Daniel Chen", email: "daniel@clairmount.example", role: "salesperson" as const, location: 1 },
  { name: "Sofia Martin", email: "sofia@clairmount.example", role: "salesperson" as const, location: 1 },
  { name: "Marcus Reid", email: "marcus@clairmount.example", role: "salesperson" as const, location: 2 },
  { name: "Emma Wilson", email: "emma@clairmount.example", role: "salesperson" as const, location: 2 },
];

// Illustrative CAD prices and kilometre readings; these are not live listings.
const inventory: [number, string, string, string, number, number][] = [
  [2022, "Jeep", "Grand Cherokee", "Limited 4x4", 48200, 36995],
  [2021, "Toyota", "RAV4", "XLE AWD", 62400, 28995],
  [2020, "Honda", "Civic", "EX", 71300, 20995],
  [2023, "Ford", "F-150", "XLT SuperCrew 4x4", 39800, 42995],
  [2022, "Hyundai", "Tucson", "Preferred AWD", 53100, 26995],
  [2019, "Mazda", "CX-5", "GT AWD", 89400, 22995],
  [2021, "Chevrolet", "Equinox", "LT AWD", 65900, 21995],
  [2020, "Subaru", "Outback", "Touring", 81200, 24995],
  [2022, "Nissan", "Rogue", "SV AWD", 46700, 27995],
  [2021, "Jeep", "Wrangler", "Unlimited Sahara", 58200, 35995],
  [2020, "Toyota", "Corolla", "SE", 77400, 19995],
  [2022, "Honda", "CR-V", "Sport AWD", 49600, 30995],
  [2021, "Ram", "1500", "Big Horn 4x4", 68900, 34995],
  [2023, "Kia", "Sportage", "EX AWD", 28700, 31995],
  [2019, "Volkswagen", "Golf", "Highline", 93200, 17995],
  [2022, "Ford", "Escape", "SEL AWD", 55900, 25995],
  [2020, "GMC", "Sierra 1500", "SLE 4x4", 88400, 32995],
  [2021, "Hyundai", "Elantra", "Preferred", 61600, 18995],
  [2023, "Mazda", "CX-30", "GS AWD", 32400, 27995],
  [2020, "Nissan", "Sentra", "SV", 73900, 16995],
  [2022, "Subaru", "Forester", "Touring", 51700, 29995],
  [2021, "Chevrolet", "Silverado 1500", "Custom 4x4", 76200, 33995],
  [2023, "Toyota", "Camry", "SE", 35800, 28995],
  [2020, "Kia", "Sorento", "EX V6 AWD", 86700, 21995],
  [2022, "Volkswagen", "Tiguan", "Comfortline AWD", 56900, 27995],
  [2021, "Honda", "Accord", "Sport", 64200, 26995],
  [2019, "Ford", "Edge", "Titanium AWD", 98200, 20995],
];

export function buildDemoData(passwordHashes: Record<string, string>, now = new Date()): DemoData {
  const ago = (days: number) => new Date(now.getTime() - days * day).toISOString();
  const dealerships = ["North", "Central", "South"].map((location, i) => ({
    id: id(), name: `Clairmount Auto — ${location} (Demo)`,
    address: `${100 + i * 100} Demo Avenue, ${location} — placeholder address`,
    phone: `+1 416 555 010${i}`, active: true,
  }));
  const users = demoStaff.map(({ location, ...user }) => ({
    ...user, id: id(), passwordHash: passwordHashes[user.email], active: true,
    dealershipId: location === null ? null : dealerships[location].id,
  }));
  const vehicles = inventory.map(([year, make, model, trim, mileage, price], i) => {
    const status = i === 3 || i === 8 ? "sold" : [4, 11, 17, 23].includes(i) ? "hold" : "available";
    return {
      id: id(), stockNo: `CLA-${String(i + 1).padStart(3, "0")}`,
      // Deliberately synthetic VINs, valid format only; never represented as actual stock VINs.
      vin: `1DEM000A${String(i + 1).padStart(9, "0")}`,
      year, make, model, trim, mileage, price, status, dealershipId: dealerships[Math.floor(i / 9)].id,
      photos: [], dateInStock: ago(14 + i * 3),
      priceHistory: i % 4 === 0 ? [{ previousPrice: price + 1500, price, changedAt: ago(2), changedBy: users[0].id }] : [],
      statusHistory: status === "available" ? [] : [{ previousStatus: "available", status, changedAt: ago(1), changedBy: users[0].id }],
    };
  });
  const names = ["Jordan Taylor", "Casey Patel", "Sam Walker", "Jamie Lee", "Riley Brown", "Avery Thompson", "Cameron Singh", "Morgan Davis", "Quinn Harris", "Drew Clark"];
  const stages = ["new", "contacted", "appointment", "won", "lost"];
  const vehicleIndices = [0, 10, 20, 3, 4, 18, 6, 12, 8, 24];
  const leads: Lead[] = names.map((name, i) => {
    const vehicle = vehicles[vehicleIndices[i]];
    const staff = users.filter((user) => user.dealershipId === vehicle.dealershipId);
    const assignedTo = i === 0 ? null : staff[i % 2].id;
    const stage = stages[i % stages.length];
    return {
      id: id(), name, email: `${name.toLowerCase().replaceAll(" ", ".")}@example.com`,
      phone: `+1 416 555 01${String(i + 10).padStart(2, "0")}`,
      message: i === 0 ? "Is the Grand Cherokee still available? I would like to arrange a test drive." : `I am interested in the ${vehicle.year} ${vehicle.make} ${vehicle.model}. Please contact me about a viewing.`,
      vehicleId: vehicle.id, dealershipId: vehicle.dealershipId, assignedTo, stage,
      source: i % 3 === 0 ? "website" : i % 3 === 1 ? "phone" : "walk_in",
      bookingToken: randomBytes(32).toString("base64url"),
      activity: [
        { type: "lead.created" as const, message: "Demo inquiry received.", occurredAt: ago(6), actorId: null },
        ...(assignedTo ? [{ type: "lead.assigned" as const, message: "Assigned to the location's sales team.", occurredAt: ago(6), actorId: users[0].id }] : []),
        ...(stage !== "new" ? [{ type: "lead.stage_changed" as const, message: `Moved to ${stage}.`, occurredAt: ago(1), actorId: assignedTo }] : []),
      ],
    };
  });
  // 15:00 UTC is 10:00/11:00 Toronto year-round, within the seeded opening hours.
  const nextDay = new Date(now.getTime() + day);
  nextDay.setUTCHours(15, 0, 0, 0);
  while ([0, 6].includes(nextDay.getUTCDay())) nextDay.setUTCDate(nextDay.getUTCDate() + 1);
  const appointments = leads.filter((lead) => lead.stage === "appointment").map((lead, i) => {
    const startsAt = new Date(nextDay.getTime() + i * 3_600_000);
    const endsAt = new Date(startsAt.getTime() + demoSettings.booking.slotLengthMinutes * 60_000);
    lead.activity.push({ type: "appointment.booked", message: "Customer booked a demo test drive.", occurredAt: ago(1), actorId: null });
    return { id: id(), leadId: lead.id, vehicleId: lead.vehicleId, salespersonId: lead.assignedTo!, dealershipId: lead.dealershipId, startsAt: startsAt.toISOString(), endsAt: endsAt.toISOString(), status: "booked" };
  });
  const notifications = leads.filter((lead) => lead.assignedTo).map((lead, i) => ({
    id: id(), userId: lead.assignedTo!, event: "lead.assigned", message: `New inquiry from ${lead.name}.`,
    link: `/crm/leads/${lead.id}`, readAt: i % 3 === 0 ? ago(1) : null,
  }));
  return validateDemoData({ settings: demoSettings, dealerships, users, vehicles, leads, appointments, notifications,
    emailTemplates: demoEmailTemplates.map((template) => ({ ...template, id: id() })),
  });
}

/** Whole-plan preflight: refuse bad fixtures before any collection is cleared. */
export function validateDemoData(input: unknown): DemoData {
  const data = demoDataSchema.parse(input);
  const demand = (condition: unknown, message: string) => { if (!condition) throw new Error(message); };
  const unique = (values: string[]) => values.length === new Set(values).size;
  for (const records of [data.dealerships, data.users, data.vehicles, data.leads, data.appointments, data.notifications, data.emailTemplates]) {
    demand(unique(records.map((record) => record.id)), "Duplicate record ID.");
  }
  demand(unique(data.users.map((user) => user.email)), "Duplicate user email.");
  demand(unique(data.vehicles.map((vehicle) => vehicle.stockNo)), "Duplicate stock number.");
  demand(unique(data.vehicles.map((vehicle) => vehicle.vin)), "Duplicate VIN.");
  demand(unique(data.leads.map((lead) => lead.bookingToken)), "Duplicate booking token.");
  demand(unique(data.emailTemplates.map((template) => template.key)), "Duplicate email template key.");
  const locations = new Set(data.dealerships.map((record) => record.id));
  const staff = new Map(data.users.map((record) => [record.id, record]));
  const vehicles = new Map(data.vehicles.map((record) => [record.id, record]));
  const leads = new Map(data.leads.map((record) => [record.id, record]));
  const statuses = new Set(data.settings.vehicleStatuses.map((status) => status.key));
  const stages = new Set(data.settings.leadStages.map((stage) => stage.key));
  for (const user of data.users) {
    demand(user.dealershipId === null ? user.role === "owner" : locations.has(user.dealershipId), "Invalid staff location.");
  }
  for (const vehicle of data.vehicles) {
    demand(locations.has(vehicle.dealershipId) && statuses.has(vehicle.status), "Invalid vehicle location/status.");
    for (const entry of vehicle.statusHistory) demand(statuses.has(entry.status) && statuses.has(entry.previousStatus) && staff.has(entry.changedBy), "Invalid status history.");
    for (const entry of vehicle.priceHistory) demand(staff.has(entry.changedBy), "Invalid price history actor.");
  }
  for (const lead of data.leads) {
    demand(vehicles.get(lead.vehicleId)?.dealershipId === lead.dealershipId && stages.has(lead.stage), "Invalid lead vehicle/location/stage.");
    if (lead.assignedTo) {
      const user = staff.get(lead.assignedTo);
      demand(user?.role === "salesperson" && user.active && user.dealershipId === lead.dealershipId, "Invalid lead assignee.");
    }
    for (const entry of lead.activity) demand(entry.actorId === null || staff.has(entry.actorId), "Invalid activity actor.");
  }
  for (const appointment of data.appointments) {
    const lead = leads.get(appointment.leadId);
    const user = staff.get(appointment.salespersonId);
    demand(lead && lead.vehicleId === appointment.vehicleId && lead.dealershipId === appointment.dealershipId && lead.assignedTo === appointment.salespersonId, "Invalid appointment references.");
    demand(user?.role === "salesperson" && user.active && user.dealershipId === appointment.dealershipId, "Invalid appointment salesperson.");
    if (appointment.status === "booked") for (const other of data.appointments) {
      if (other.id === appointment.id || other.status !== "booked") continue;
      demand(other.leadId !== appointment.leadId, "Duplicate active lead booking.");
      demand(other.salespersonId !== appointment.salespersonId || Date.parse(other.endsAt) <= Date.parse(appointment.startsAt) || Date.parse(other.startsAt) >= Date.parse(appointment.endsAt), "Overlapping appointments.");
    }
  }
  for (const notification of data.notifications) demand(staff.has(notification.userId), "Invalid notification recipient.");
  return data;
}
