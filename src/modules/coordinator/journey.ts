/**
 * The five-step lead journey (inquiry → follow-up email → assignment → booking → CRM update), derived from
 * the lead's activity log, its Email log entries and automation runs. Pure, so it runs on the server for
 * funnels and on the client for the live feed.
 */
export const journeyStepKeys = ["inquiry", "email", "assigned", "booked", "crm"] as const;
export type JourneyStepKey = (typeof journeyStepKeys)[number];
export type JourneyState = "done" | "pending" | "failed" | "skipped";
/** Who completed the step: the customer, an automation, or a staff member (`actorId`). */
export type JourneyActor = "customer" | "system" | "staff";
export type JourneyStep = { key: JourneyStepKey; state: JourneyState; at: string | null; by: JourneyActor | null; actorId: string | null; note: string | null };

export type JourneyLead = {
  createdAt: string; email: string; assignedTo: string | null; stage: string;
  activity: { type: string; occurredAt: string; actorId: string | null }[];
};
export type JourneyEmail = { to: string[]; status: "sent" | "failed"; sentAt: string; error: string | null };
export type JourneyRun = { recipeKey: string; outcome: "success" | "failed" | "skipped"; detail: string; ranAt: string };
export type JourneySettings = { leadStages: { key: string; order: number }[]; booking: { appointmentStageKey: string } };

const MINUTE = 60_000;
/** The CRM moves the lead within seconds of a booking; a later stage change is someone's manual edit. */
const CRM_UPDATE_WINDOW = 10 * MINUTE;

export function buildJourney(lead: JourneyLead, emails: JourneyEmail[], runs: JourneyRun[], settings: JourneySettings): JourneyStep[] {
  const activity = lead.activity.toSorted((a, b) => a.occurredAt.localeCompare(b.occurredAt));
  const first = (type: string) => activity.find((entry) => entry.type === type);
  const lastRun = (recipeKey: string) => runs.filter((entry) => entry.recipeKey === recipeKey).at(-1);
  const step = (key: JourneyStepKey, state: JourneyState, rest: Partial<JourneyStep> = {}): JourneyStep =>
    ({ key, state, at: null, by: null, actorId: null, note: null, ...rest });
  const actor = (actorId: string | null | undefined, fallback: JourneyActor) =>
    actorId ? { by: "staff" as const, actorId } : { by: fallback, actorId: null };

  // 1. Inquiry received: the customer online, or staff who typed it in.
  const created = first("lead.created");
  const inquiry = step("inquiry", "done", { at: created?.occurredAt ?? lead.createdAt, ...actor(created?.actorId, "customer") });

  // 2. Follow-up email: the first email delivered to the customer's address.
  const address = lead.email.toLowerCase();
  const toCustomer = emails.filter((entry) => entry.to.some((to) => to.toLowerCase() === address)).toSorted((a, b) => a.sentAt.localeCompare(b.sentAt));
  const sent = toCustomer.find((entry) => entry.status === "sent");
  const bounced = toCustomer.find((entry) => entry.status === "failed");
  const followUp = lastRun("lead_follow_up_email");
  let email: JourneyStep;
  if (sent) {
    // A staff "Send email" logs a matching contact entry; otherwise the automation sent it.
    const manual = activity.find((entry) => entry.type === "email" && Math.abs(Date.parse(entry.occurredAt) - Date.parse(sent.sentAt)) < MINUTE);
    email = step("email", "done", { at: sent.sentAt, ...actor(manual?.actorId, "system") });
  } else if (bounced) email = step("email", "failed", { at: bounced.sentAt, by: "system", note: bounced.error });
  else if (followUp) email = step("email", followUp.outcome === "success" ? "done" : followUp.outcome, { at: followUp.ranAt, by: "system", note: followUp.outcome === "success" ? null : followUp.detail });
  else email = step("email", "pending");

  // 3. Assignment: round-robin (system) or a staff member's choice.
  const assignedEntry = first("lead.assigned");
  const autoAssign = lastRun("lead_auto_assign");
  const assigned = assignedEntry ? step("assigned", "done", { at: assignedEntry.occurredAt, ...actor(assignedEntry.actorId, "system") })
    : lead.assignedTo ? step("assigned", "done", { by: "system" })
    : autoAssign?.outcome === "failed" ? step("assigned", "failed", { at: autoAssign.ranAt, by: "system", note: autoAssign.detail })
    : step("assigned", "pending");

  // 4. Appointment booked: by the customer from the emailed link, or by staff for them.
  const bookedEntry = first("appointment.booked");
  const booked = bookedEntry ? step("booked", "done", { at: bookedEntry.occurredAt, ...actor(bookedEntry.actorId, "customer") }) : step("booked", "pending");

  // 5. CRM updated: the lead moved to the appointment stage after the booking.
  let crm = step("crm", "pending");
  if (bookedEntry) {
    const bookedAt = Date.parse(bookedEntry.occurredAt);
    const move = activity.find((entry) => entry.type === "lead.stage_changed" && Date.parse(entry.occurredAt) >= bookedAt && Date.parse(entry.occurredAt) - bookedAt <= CRM_UPDATE_WINDOW);
    const stageRun = lastRun("appointment_stage_update");
    const order = (key: string) => settings.leadStages.find((entry) => entry.key === key)?.order;
    const target = order(settings.booking.appointmentStageKey);
    const current = order(lead.stage);
    if (move) crm = step("crm", "done", { at: move.occurredAt, ...actor(move.actorId, "system") });
    else if (stageRun?.outcome === "success") crm = step("crm", "done", { at: stageRun.ranAt, by: "system" });
    // Already at (or past) the appointment stage when the booking came in: nothing left to move.
    else if (target !== undefined && current !== undefined && current >= target) crm = step("crm", "done", { by: "system" });
    else if (stageRun) crm = step("crm", stageRun.outcome, { at: stageRun.ranAt, by: "system", note: stageRun.detail });
  }
  return [inquiry, email, assigned, booked, crm];
}

/** Milliseconds from the inquiry to an instant, or null when the instant is missing. */
export const elapsedSince = (from: string, to: string | null) => to ? Math.max(0, Date.parse(to) - Date.parse(from)) : null;
