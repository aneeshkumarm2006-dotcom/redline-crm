import assert from "node:assert/strict";
import { test } from "node:test";
import { buildDemoData, demoStaff, validateDemoData } from "../scripts/seed/data";
import { DealershipModel } from "../src/modules/dealerships/model";
import { VehicleModel } from "../src/modules/inventory/model";
import { LeadModel } from "../src/modules/leads/model";
import { AppointmentModel } from "../src/modules/appointments/model";
import { NotificationModel } from "../src/modules/notifications/model";
import { EmailTemplateModel } from "../src/modules/email-templates/model";
import { vehicleInputSchema } from "../src/modules/inventory/schema";
import { leadInputSchema } from "../src/modules/leads/schema";
import { appointmentInputSchema } from "../src/modules/appointments/schema";
import { notificationInputSchema } from "../src/modules/notifications/schema";
import { renderEmailTemplate } from "../src/lib/email/template";
import { demoEmailTemplates } from "../scripts/seed/templates";

const hashes = Object.fromEntries(demoStaff.map((user) => [user.email, "$2b$12$" + "a".repeat(53)]));
const fixture = () => buildDemoData(hashes, new Date("2026-10-16T12:00:00Z"));
const stored = ({ id, ...data }: { id: string }) => ({ _id: id, ...data });

test("demo fixtures form a complete linked database with a ready Jeep", () => {
  const data = fixture();
  assert.equal(data.dealerships.length, 3);
  assert.equal(data.users.filter((user) => user.role === "owner").length, 1);
  for (const location of data.dealerships) {
    assert.equal(data.users.filter((user) => user.dealershipId === location.id).length, 2);
    assert.equal(data.vehicles.filter((vehicle) => vehicle.dealershipId === location.id).length, 9);
  }
  assert.equal(data.vehicles.length, 27);
  assert.equal(new Set(data.leads.map((lead) => lead.stage)).size, 5);
  assert.equal(data.vehicles[0].make, "Jeep");
  assert.equal(data.vehicles[0].status, "available");
  assert.equal(data.vehicles[0].stockNo, "CLA-001");
  assert.equal(data.appointments.length, 2);
  assert.equal(new Date(data.appointments[0].startsAt).getUTCDay(), 1);
  assert.ok(data.notifications.some((notification) => notification.readAt === null));
  assert.ok(data.notifications.some((notification) => notification.readAt !== null));
  assert.notEqual(data.users[0].id, fixture().users[0].id);
  assert.notEqual(data.leads[0].bookingToken, fixture().leads[0].bookingToken);
});

test("every seed document passes the actual Mongoose model including nested histories", async () => {
  const data = fixture();
  for (const record of data.dealerships) await new DealershipModel(stored(record)).validate();
  for (const record of data.vehicles) await new VehicleModel(stored(record)).validate();
  for (const record of data.leads) await new LeadModel(stored(record)).validate();
  for (const record of data.appointments) await new AppointmentModel(stored(record)).validate();
  for (const record of data.notifications) await new NotificationModel(stored(record)).validate();
  for (const record of data.emailTemplates) await new EmailTemplateModel(stored(record)).validate();
});

test("vehicle validation rejects malformed identifiers, nonfinite/fractional values and unsafe images", async () => {
  const { id, ...vehicle } = fixture().vehicles[0];
  void id;
  for (const patch of [{ vin: "INVALID" }, { price: -1 }, { price: 1.234 }, { price: Infinity }, { mileage: 1.5 }, { year: 1 }, { dealershipId: "bad" }, { photos: ["javascript:alert(1)"] }, { photos: ["//evil.example/a.jpg"] }, { status: "Bad Key" }]) {
    assert.equal(vehicleInputSchema.safeParse({ ...vehicle, ...patch }).success, false);
    await assert.rejects(new VehicleModel({ ...vehicle, ...patch }).validate());
  }
  assert.equal(vehicleInputSchema.parse({ ...vehicle, vin: vehicle.vin.toLowerCase() }).vin, vehicle.vin);
  assert.throws(() => new VehicleModel({ ...vehicle, unexpected: true }));
});

test("lead and notification schemas protect secrets, event names and internal links", async () => {
  const { id, ...lead } = fixture().leads[0];
  void id;
  assert.equal(leadInputSchema.safeParse({ ...lead, bookingToken: "predictable" }).success, false);
  assert.equal(leadInputSchema.safeParse({ ...lead, email: { $ne: null } }).success, false);
  assert.equal(LeadModel.schema.path("bookingToken").options.select, false);
  const { id: notificationId, ...notification } = fixture().notifications[0];
  void notificationId;
  for (const patch of [{ link: "https://evil.example" }, { link: "/crm/../login" }, { event: "unknown" }, { readAt: "bad" }]) {
    assert.equal(notificationInputSchema.safeParse({ ...notification, ...patch }).success, false);
    await assert.rejects(new NotificationModel({ ...notification, ...patch }).validate());
  }
});

test("appointments require an increasing range and a supported lifecycle status", async () => {
  const { id, ...appointment } = fixture().appointments[0];
  void id;
  for (const patch of [{ endsAt: appointment.startsAt }, { endsAt: "2020-01-01T00:00:00Z" }, { status: "invalid" }]) {
    assert.equal(appointmentInputSchema.safeParse({ ...appointment, ...patch }).success, false);
    await assert.rejects(new AppointmentModel({ ...appointment, ...patch }).validate());
  }
});

test("preflight rejects broken references, duplicate unique keys and inconsistent assignments", () => {
  const mutations: ((data: ReturnType<typeof fixture>) => void)[] = [
    (data) => { data.leads[0].dealershipId = data.dealerships[1].id; },
    (data) => { data.leads[0].assignedTo = data.users[3].id; },
    (data) => { data.vehicles[0].status = "unknown"; },
    (data) => { data.leads[0].stage = "unknown"; },
    (data) => { data.vehicles[0].statusHistory.push({ previousStatus: "unknown", status: "available", changedAt: new Date().toISOString(), changedBy: data.users[0].id }); },
    (data) => { data.vehicles[1].vin = data.vehicles[0].vin; },
    (data) => { data.vehicles[1].stockNo = data.vehicles[0].stockNo; },
    (data) => { data.leads[1].bookingToken = data.leads[0].bookingToken; },
    (data) => { data.appointments[0].salespersonId = data.users[0].id; },
    (data) => { data.notifications[0].userId = "a".repeat(24); },
    (data) => { data.emailTemplates[1].key = data.emailTemplates[0].key; },
  ];
  for (const mutate of mutations) { const data = fixture(); mutate(data); assert.throws(() => validateDemoData(data)); }
});

test("configured custom status/stage keys are data, not enums", () => {
  const data = fixture();
  data.settings.vehicleStatuses.push({ key: "reconditioning", label: "In shop", color: "#112233" });
  data.settings.leadStages.push({ key: "qualified", label: "Qualified", color: "#112233", order: 5 });
  data.vehicles[0].status = "reconditioning";
  data.leads[0].stage = "qualified";
  assert.doesNotThrow(() => validateDemoData(data));
});

test("all stored email templates render safely with their documented placeholders", () => {
  const values = {
    price: "$29,000.00", previousPrice: "$30,000.00", stageLabel: "Contacted", previousStageLabel: "New",
    vehicleName: "2022 Jeep Grand Cherokee", companyName: "Clairmount Auto", customerName: "<Customer>",
    bookingUrl: "https://example.com/book/token", dealershipName: "North", appointmentTime: "Monday at 11 AM",
    salespersonName: "Alex", dealershipAddress: "Demo Avenue", dealershipPhone: "555-0100",
    customerMessage: "<script>bad</script>", leadUrl: "https://example.com/crm/leads/id", stockNo: "CLA-001",
    statusLabel: "HOLD", previousStatusLabel: "Available", changedByName: "Owner", vehicleUrl: "https://example.com/crm/inventory/id",
  };
  for (const template of demoEmailTemplates) {
    const rendered = renderEmailTemplate(template, values);
    assert.ok(!rendered.html.includes("{{"));
    assert.ok(!rendered.html.includes("<script>"));
    assert.throws(() => renderEmailTemplate(template, {}));
  }
});
