import assert from "node:assert/strict";
import { test } from "node:test";
import { buildSlotDays, zonedTimeToUtc } from "../src/modules/appointments/slots";
import { settingsSchema } from "../src/modules/settings/schema";
import { bookingInputSchema } from "../src/modules/appointments/schema";
import { demoSettings } from "../scripts/seed/settings";

const booking = demoSettings.booking; // America/Toronto, Mon–Fri 09–18, Sat 10–16, Sun closed, 30 min, 14 days
const monday = new Date("2026-10-19T12:00:00.000Z"); // 08:00 EDT

test("slots follow local business hours and slot length; closed days are omitted", () => {
  const days = buildSlotDays(booking, monday, []);
  assert.equal(days.length, 12); // 14 days minus two Sundays
  assert.equal(days[0].date, "2026-10-19");
  assert.equal(days[0].slots.length, 18);
  assert.deepEqual(days[0].slots[0], { startsAt: "2026-10-19T13:00:00.000Z", endsAt: "2026-10-19T13:30:00.000Z" });
  assert.equal(days[0].slots.at(-1)!.endsAt, "2026-10-19T22:00:00.000Z");
  assert.ok(!days.some((day) => day.date === "2026-10-25"));
  const saturday = days.find((day) => day.date === "2026-10-24")!;
  assert.equal(saturday.slots[0].startsAt, "2026-10-24T14:00:00.000Z");
  assert.equal(saturday.slots.length, 12);
});

test("started slots, booked intervals and misaligned bookings are excluded; full days disappear", () => {
  const now = new Date("2026-10-19T14:10:00.000Z"); // 10:10 EDT
  const days = buildSlotDays(booking, now, [
    { startsAt: "2026-10-19T15:00:00.000Z", endsAt: "2026-10-19T15:30:00.000Z" },
    { startsAt: "2026-10-19T16:15:00.000Z", endsAt: "2026-10-19T16:45:00.000Z" },
  ]);
  const starts = days[0].slots.map((slot) => slot.startsAt);
  assert.equal(starts[0], "2026-10-19T14:30:00.000Z");
  for (const taken of ["2026-10-19T15:00:00.000Z", "2026-10-19T16:00:00.000Z", "2026-10-19T16:30:00.000Z"]) assert.ok(!starts.includes(taken));
  assert.ok(starts.includes("2026-10-19T17:00:00.000Z"));
  const full = buildSlotDays({ ...booking, daysAhead: 1 }, monday, [{ startsAt: "2026-10-19T13:00:00.000Z", endsAt: "2026-10-19T22:00:00.000Z" }]);
  assert.deepEqual(full, []);
});

test("slot instants are correct across daylight-saving changes", () => {
  assert.equal(new Date(zonedTimeToUtc("2026-11-02", "09:00", "America/Toronto")).toISOString(), "2026-11-02T14:00:00.000Z");
  assert.equal(new Date(zonedTimeToUtc("2026-03-09", "09:00", "America/Toronto")).toISOString(), "2026-03-09T13:00:00.000Z");
  assert.equal(new Date(zonedTimeToUtc("2026-03-06", "09:00", "America/Toronto")).toISOString(), "2026-03-06T14:00:00.000Z");
  const days = buildSlotDays(booking, new Date("2026-10-30T12:00:00.000Z"), []);
  assert.equal(days.find((day) => day.date === "2026-10-30")!.slots[0].startsAt, "2026-10-30T13:00:00.000Z");
  assert.equal(days.find((day) => day.date === "2026-11-02")!.slots[0].startsAt, "2026-11-02T14:00:00.000Z");
});

test("the dealership's local date decides 'today', not UTC", () => {
  // 23:30 EDT Monday is already Tuesday in UTC; Monday has no slots left, so Tuesday comes first.
  const days = buildSlotDays({ ...booking, daysAhead: 2 }, new Date("2026-10-20T03:30:00.000Z"), []);
  assert.deepEqual(days.map((day) => day.date), ["2026-10-20"]);
});

test("existing settings default the booking stage; booking input rejects extra fields", () => {
  const { appointmentStageKey, ...legacyBooking } = demoSettings.booking; void appointmentStageKey;
  assert.equal(settingsSchema.parse({ ...demoSettings, booking: legacyBooking }).booking.appointmentStageKey, "appointment");
  assert.equal(bookingInputSchema.safeParse({ token: "t", startsAt: "2026-10-19T13:00:00.000Z" }).success, true);
  assert.equal(bookingInputSchema.safeParse({ token: "t", startsAt: "2026-10-19T13:00:00.000Z", salespersonId: "x" }).success, false);
  assert.equal(bookingInputSchema.safeParse({ token: "t", startsAt: "tomorrow" }).success, false);
});
