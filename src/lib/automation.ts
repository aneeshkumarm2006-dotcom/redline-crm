import { EmailSetupError } from "@/lib/email/provider";
import "server-only";
import { on, type AppEvent, type EventName } from "@/lib/events";
import { eventNames, type DomainEvent } from "@/lib/event-contract";
import { getSettings } from "@/modules/settings/service";
import { recordAutomationRun } from "@/modules/automations/service";
import { isRecipeEnabled, type AutomationRecipeKey, type AutomationRun } from "@/modules/automations/schema";
import { runDetails } from "@/modules/automations/copy";
import { advanceLeadForBooking, assignCreatedLead, getLeadForAutomation } from "@/modules/leads/service";
import { registerLeadHandlers } from "@/modules/leads/events";
import { dispatchNotifications, type DispatchAudience, type DispatchSummary } from "@/modules/notifications/service";
import { registerNotificationHandlers } from "@/modules/notifications/events";
import { registerAssistantHandlers } from "@/modules/assistant/events";
import { findActiveUser } from "@/modules/users/service";

export type RecipeOutcome = { outcome: AutomationRun["outcome"]; detail: string };
const done = (detail: string): RecipeOutcome => ({ outcome: "success", detail });
const skipped = (detail: string): RecipeOutcome => ({ outcome: "skipped", detail });
const failed = (detail: string): RecipeOutcome => ({ outcome: "failed", detail });

const subjectOf = (event: DomainEvent) => "leadId" in event.payload
  ? { type: "lead" as const, id: event.payload.leadId }
  : { type: "vehicle" as const, id: event.payload.vehicleId };

/**
 * Keyed recipe handler: runs `handler` only while `settings.automations[recipeKey]` is on, and logs every
 * outcome (done, skipped, failed) to `automation_runs`, one run per (event, recipe). A thrown error is logged as
 * failed and re-thrown so the emitter still sees it; a logging failure never changes the outcome.
 */
export function onRecipe<K extends EventName>(name: K, recipeKey: AutomationRecipeKey, handler: (event: AppEvent<K>) => Promise<RecipeOutcome>) {
  return on(name, `recipe:${recipeKey}`, async (event) => {
    const record = async ({ outcome, detail }: RecipeOutcome) => {
      try {
        await recordAutomationRun({ eventId: event.id, recipeKey, name, subject: subjectOf(event as unknown as DomainEvent), outcome,
          detail: detail.slice(0, 1000), ranAt: new Date().toISOString() });
      } catch { console.error("Automation run log failed.", { eventId: event.id, recipeKey }); }
    };
    const settings = await getSettings();
    if (!isRecipeEnabled(settings.automations, recipeKey)) return record(skipped(runDetails.off));
    let result: RecipeOutcome;
    try { result = await handler(event); }
    catch (error) {
      // Email setup problems carry a safe explanation (which setting is wrong); show it with the failure.
      const errors = error instanceof AggregateError ? error.errors : [error];
      const reason = errors.find((entry): entry is EmailSetupError => entry instanceof EmailSetupError)?.message;
      await record(failed([runDetails.failed(errors.length), reason].filter(Boolean).join(" ")));
      throw error;
    }
    await record(result);
  });
}

/** Who a dispatch reached, as a run detail. */
function notified({ recipients }: DispatchSummary): RecipeOutcome {
  const reached = recipients.filter((entry) => entry.channels.length);
  if (!reached.length) return skipped(runDetails.nobody);
  const customers = reached.filter((entry) => entry.customer);
  const inApp = reached.filter((entry) => !entry.customer && entry.channels.includes("in_app"));
  const emailOnly = reached.filter((entry) => !entry.customer && !entry.channels.includes("in_app"));
  return done([
    customers.length ? runDetails.emailed(customers.map((entry) => entry.email)) : "",
    inApp.length ? runDetails.alerted(inApp.map((entry) => entry.name), inApp.some((entry) => entry.channels.includes("email"))) : "",
    emailOnly.length ? runDetails.emailedOnly(emailOnly.map((entry) => entry.name)) : "",
  ].filter(Boolean).join(" "));
}
const dispatchTo = (audience: DispatchAudience) => async (event: AppEvent<EventName>) =>
  notified(await dispatchNotifications(event as unknown as DomainEvent, undefined, audience));

async function assign(event: AppEvent<"lead.created">): Promise<RecipeOutcome> {
  const result = await assignCreatedLead(event);
  switch (result.kind) {
    case "assigned": return done(runDetails.assigned(result.salespersonName));
    case "manual": return skipped(runDetails.manual);
    case "already_assigned": return skipped(runDetails.alreadyAssigned((await findActiveUser(result.salespersonId))?.name ?? "a salesperson"));
    case "no_staff": return failed(runDetails.noStaff);
    case "taken": return skipped(runDetails.taken);
  }
}

/** A customer staff already spoke with (walk-in, phone) does not get the "thanks for your inquiry" email. */
async function followUp(event: AppEvent<"lead.created">): Promise<RecipeOutcome> {
  const lead = await getLeadForAutomation(event.payload.leadId);
  if (lead.firstContactedAt) return skipped(runDetails.contacted);
  return dispatchTo("customer")(event);
}

async function bookingStage(event: AppEvent<"appointment.booked">): Promise<RecipeOutcome> {
  const { booking } = await getSettings();
  const result = await advanceLeadForBooking(event.payload.leadId, booking.appointmentStageKey, event.payload.changedBy ?? null);
  if (!result.stageLabel) return failed(runDetails.stageMissing);
  return result.moved ? done(runDetails.stageMoved(result.stageLabel)) : skipped(runDetails.stageKept(result.stageLabel));
}

/**
 * Which recipe owns each event's notification rules, split by audience (the customer, or staff). A rule with no
 * recipe here (e.g. a lead stage change) is still delivered, just not listed on the Automations page.
 */
const alertRecipes: { [K in EventName]?: Partial<Record<DispatchAudience, AutomationRecipeKey>> } = {
  "lead.created": { customer: "lead_follow_up_email" },
  "lead.assigned": { staff: "lead_assigned_alert" },
  "appointment.booked": { customer: "appointment_confirmation", staff: "appointment_alert" },
  "vehicle.status_changed": { staff: "vehicle_status_alert" },
  "vehicle.price_changed": { staff: "vehicle_price_alert" },
  "vehicle.repair_started": { staff: "repair_alert" },
  "vehicle.repair_completed": { staff: "repair_alert" },
  "vehicle.sold": { staff: "sale_recorded" },
};
const audiences: DispatchAudience[] = ["customer", "staff"];

/** Called at Node server startup, or explicitly by trusted CLI checks. Keys are HMR-safe. */
export function registerAutomation() {
  const alerts = eventNames.flatMap((name) => audiences.map((audience) => {
    const recipe = alertRecipes[name]?.[audience];
    if (!recipe) return on(name, `notifications:${audience}`, (event) => dispatchNotifications(event as DomainEvent, undefined, audience).then(() => undefined));
    const handler = name === "lead.created" && audience === "customer" ? followUp : dispatchTo(audience);
    return onRecipe(name, recipe, handler as (event: AppEvent<EventName>) => Promise<RecipeOutcome>);
  }));
  const remove = [
    ...registerLeadHandlers(), ...registerNotificationHandlers(), ...registerAssistantHandlers(), ...alerts,
    onRecipe("lead.created", "lead_auto_assign", assign),
    onRecipe("appointment.booked", "appointment_stage_update", bookingStage),
  ];
  return () => remove.forEach((unsubscribe) => unsubscribe());
}
