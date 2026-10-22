import type { AutomationRecipeKey, PlannedRecipeKey, RecipeGroup, ScheduledRunSummary } from "./schema";

/** Settings values the recipe sentences quote, so the page always matches the live configuration. */
export type RecipeSentenceValues = {
  appointmentStage: string; followUpDays: number[]; warnDays: number; criticalDays: number; repairOverdueDays: number; uncontactedHours: number; manualAssignment: boolean;
};

const plural = (count: number, one: string, many = `${one}s`) => `${count} ${count === 1 ? one : many}`;
/** "A", "A and B", "A, B and C". */
export function listNames(names: string[]) {
  return names.length <= 1 ? names.join("") : `${names.slice(0, -1).join(", ")} and ${names.at(-1)}`;
}

/** Recipe sentences use `**bold**` for the trigger and the actions, rendered as Monday-style chips. */
export const recipeSentences: Record<AutomationRecipeKey, (values: RecipeSentenceValues) => string> = {
  lead_auto_assign: (values) => values.manualAssignment
    ? "When **a lead comes in**, **leave it for the owner** to assign (assignment is set to manual)"
    : "When **a lead comes in**, **assign it round-robin** to a salesperson at that location",
  lead_follow_up_email: () => "When **a lead comes in**, **email the customer** a thank-you with a booking link",
  lead_assigned_alert: () => "When **a lead is assigned**, **alert the salesperson** in the app and by email",
  appointment_confirmation: () => "When **a customer books**, **email them a confirmation** with the time and address",
  appointment_alert: () => "When **a customer books**, **alert the salesperson** with the appointment time",
  appointment_stage_update: (values) => `When **a customer books**, **move the lead to ${values.appointmentStage}** on the pipeline`,
  vehicle_status_alert: () => "When **a car's status changes**, **alert the location's salespeople**",
  vehicle_price_alert: () => "When **a price changes**, **alert the location's salespeople**",
  repair_alert: () => "When **a car goes to or returns from a garage**, **alert the location's salespeople**",
  sale_recorded: () => "When **a car is marked sold**, **alert the seller, the location and the owner** with the commission",
  aging_inventory_reminder: (values) => `Every morning, **if a car is over ${values.warnDays} days in stock**, **alert the owner** (critical after ${values.criticalDays} days)`,
  repair_overdue_reminder: (values) => `Every morning, **if a repair runs past ${values.repairOverdueDays} days**, **alert the owner**`,
  uncontacted_lead_reminder: (values) => `Every morning, **if a new lead isn't contacted within ${values.uncontactedHours} hours**, **remind the salesperson**, then **escalate to the owner** after ${values.uncontactedHours * 2} hours`,
  appointment_customer_reminder: () => "Every morning, **for tomorrow's appointments**, **email the customer a reminder**",
  appointment_morning_alert: () => "Every morning, **for today's appointments**, **alert each salesperson** with their schedule",
  lead_customer_follow_up: (values) => `If **a customer hasn't booked**, **email a follow-up** with their booking link on ${listNames(values.followUpDays.map((day) => `day ${day}`))}, then **stop once they book**`,
};

export const recipeNames: Record<AutomationRecipeKey, string> = {
  lead_auto_assign: "Round-robin assignment", lead_follow_up_email: "Customer follow-up email", lead_assigned_alert: "New lead alert",
  appointment_confirmation: "Booking confirmation", appointment_alert: "Appointment alert", appointment_stage_update: "Pipeline update on booking",
  vehicle_status_alert: "Status change alert", vehicle_price_alert: "Price change alert", repair_alert: "Repair alert", sale_recorded: "Sale alert",
  aging_inventory_reminder: "Aging stock reminder", repair_overdue_reminder: "Overdue repair reminder", uncontacted_lead_reminder: "Uncontacted lead reminder",
  appointment_customer_reminder: "Appointment reminder email", appointment_morning_alert: "Morning appointment alert",
  lead_customer_follow_up: "Customer follow-up sequence",
};

export const plannedRecipes: Record<PlannedRecipeKey, { name: string; sentence: string }> = {
  sms_follow_up: { name: "SMS follow-up", sentence: "When **a lead comes in**, **text the customer** a booking link (Twilio)" },
  website_chatbot: { name: "Website chatbot", sentence: "When **a visitor chats on the website**, **an AI assistant answers** and **creates the lead**" },
  listing_feed_sync: { name: "Listing feed sync", sentence: "When **a car is added or changes**, **update AutoTrader and Facebook Marketplace**" },
  review_request: { name: "Google review request", sentence: "When **a car is sold**, **ask the customer for a Google review** a few days later" },
};

/** Stored in `automation_runs.detail`; shown to the owner on the Automations page. */
export const runDetails = {
  off: "Recipe is turned off; nothing was done.",
  running: "In progress…",
  failed: (count: number) => count > 1 ? `${count} steps failed. Nothing is retried automatically.` : "The step failed. Nothing is retried automatically.",
  assigned: (name: string) => `Assigned to ${name} (round-robin).`,
  manual: "Assignment is manual; the owner assigns new leads.",
  alreadyAssigned: (name: string) => `Already assigned to ${name}; kept.`,
  noStaff: "No active salesperson at this location; left in the Unassigned queue.",
  taken: "Someone assigned the lead first.",
  nobody: "No one to notify under the current alert rules.",
  contacted: "Staff already spoke with the customer; no follow-up email needed.",
  assistantConfirmed: "Booked by the virtual assistant; its email reply confirmed the time.",
  emailed: (addresses: string[]) => `Email sent to ${listNames(addresses)}.`,
  alerted: (names: string[], email: boolean) => `Alerted ${listNames(names)} in the app${email ? " and by email" : ""}.`,
  emailedOnly: (names: string[]) => `Emailed ${listNames(names)}.`,
  stageMoved: (stage: string) => `Lead moved to ${stage}.`,
  stageKept: (stage: string) => `Lead was already at or past ${stage}.`,
  stageMissing: "The appointment stage is not configured.",
  aging: (stockNo: string, name: string, days: number, limit: number) => `${stockNo} ${name} has been in stock ${days} days (over the ${limit}-day limit). Owner alerted.`,
  repairOverdue: (stockNo: string, garage: string, days: number, limit: number) => `${stockNo} has been at ${garage} for ${days} days (limit ${limit}). Owner alerted.`,
  uncontacted: (lead: string, hours: number, salesperson: string | null, escalated: boolean) => salesperson
    ? `${lead} not contacted after ${hours} hours. Reminder sent to ${salesperson}${escalated ? "; escalated to the owner" : ""}.`
    : `${lead} not contacted after ${hours} hours and nobody is assigned. Owner alerted.`,
  noRecipients: "No active staff to alert.",
  customerReminder: (email: string) => `Reminder email sent to ${email}.`,
  customerReminderFailed: "The reminder email could not be sent.",
  followUp: (step: number, total: number, email: string, days: number) => `Follow-up ${step} of ${total} (day ${days}) sent to ${email}.`,
  followUpFailed: "The follow-up email could not be sent.",
  followUpSuperseded: "Skipped: a later follow-up was already due, so only that one was sent.",
  optedOut: "Skipped: the customer asked not to receive emails.",
  inConversation: "Skipped: the customer is in an active email conversation, so no templated follow-up was sent.",
  morning: (name: string, count: number, first: string) => `${name} alerted: ${plural(count, "appointment")} today, first at ${first}.`,
};

/** In-app alerts written by the scheduled reminders. */
export const reminderAlerts = {
  aging: (count: number, warnDays: number, critical: number, criticalDays: number) =>
    `${plural(count, "car is", "cars are")} over ${warnDays} days in stock${critical ? ` (${critical} over ${criticalDays} days)` : ""}. Price or promote them.`,
  repairOverdue: (name: string, stockNo: string, garage: string, days: number, limit: number) => `${name} (${stockNo}) has been at ${garage} for ${days} days, past the ${limit}-day limit.`,
  uncontacted: (lead: string, vehicle: string, hours: number) => `${lead} — ${vehicle}: not contacted after ${hours} hours. Call or email them today.`,
  escalated: (lead: string, vehicle: string, hours: number, salesperson: string | null) => salesperson
    ? `${lead} — ${vehicle}: ${salesperson} hasn't made contact after ${hours} hours.`
    : `${lead} — ${vehicle}: nobody is assigned and no one has made contact after ${hours} hours.`,
  morning: (count: number, first: string, customer: string) => `You have ${plural(count, "appointment")} today. First: ${first} with ${customer}.`,
};

export const automationsCopy = {
  title: "Automations", intro: "When-this-then-that recipes that keep leads, stock and the team moving. Every run is logged.",
  loading: "Loading automations…", tabs: { recipes: "Recipes", emails: "Email log", assistant: "Assistant" }, tabsLabel: "Automation views",
  groups: { leads: "Lead Coordinator", inventory: "Inventory and repairs", reminders: "Scheduled reminders" } satisfies Record<RecipeGroup, string>,
  groupHints: {
    leads: "Inquiry → follow-up email → assignment → booking → pipeline update.",
    inventory: "Status, price, repair and sale changes reach the right people.",
    reminders: "Checked every morning by the scheduler, or right now with Run now.",
  } satisfies Record<RecipeGroup, string>,
  kpis: "Automation summary", activeRecipes: "Recipes on", runsThisMonth: "Runs this month", failedThisMonth: "Failed this month", emailsThisMonth: "Emails logged",
  activeHint: (total: number) => `of ${total}`, emailsHint: "Sent and failed",
  trigger: { event: "Instant", schedule: "Every morning" },
  on: "On", off: "Off", toggle: (name: string) => `${name}: turn on or off`,
  turnedOn: (name: string) => `${name} is on.`, turnedOff: (name: string) => `${name} is off. Runs are logged as skipped.`,
  toggleFailed: "Could not change the recipe. Please try again.",
  runs: (count: number) => plural(count, "run"), thisMonth: "this month",
  lastRan: (when: string) => `Last ran ${when}`, neverRan: "Not run yet",
  outcomes: { success: "Done", failed: "Failed", skipped: "Skipped" },
  breakdown: (success: number, skipped: number, failed: number) => [`${success} done`, skipped ? `${skipped} skipped` : "", failed ? `${failed} failed` : ""].filter(Boolean).join(" · "),
  history: "History", historyFor: (name: string) => `Recent runs: ${name}`,
  delivery: {
    title: "Email delivery",
    smtp: (from: string, host: string) => `Sending through ${host} as ${from}, with your company name as the sender name.`,
    resend: "Sending through Resend.", console: "Test mode: emails are written to the Email log only, not delivered.",
    replyTo: (address: string) => `Replies go to ${address}.`,
    ready: "Ready — customers receive emails.", notLive: "Not delivering to inboxes (test mode).",
    testLabel: "Send a test email to", send: "Send test", sending: "Sending…",
    sent: (to: string) => `Sent. Check ${to} (and the spam folder).`, logged: "Written to the Email log (test mode, not delivered).",
  },
  runNow: "Run now", running: "Running…", runNowHint: "Checks aging stock, overdue repairs, uncontacted leads, appointments and customer follow-ups now. Nothing is ever sent twice.",
  ranSummary: (summary: ScheduledRunSummary) => {
    const fired = summary.recipes.reduce((sum, entry) => sum + entry.fired, 0);
    const done = summary.recipes.reduce((sum, entry) => sum + entry.alreadyDone, 0);
    const failed = summary.recipes.reduce((sum, entry) => sum + entry.failed, 0);
    if (!fired && !failed) return done ? `Nothing new: ${plural(done, "reminder")} already went out today.` : "Nothing needs a reminder right now.";
    return [`${plural(fired, "reminder")} sent`, done ? `${done} already done today` : "", failed ? `${failed} failed` : ""].filter(Boolean).join(" · ") + ".";
  },
  runFailed: "The reminders could not run. Please try again.",
  recent: "Recent runs", recentHint: "Newest first, across every recipe.", allRecipes: "All recipes", recipeFilter: "Filter runs by recipe",
  noRuns: "No runs yet. They appear here as soon as a recipe fires.",
  subject: { lead: "Lead", vehicle: "Vehicle", appointment: "Appointment", user: "Staff member" },
  open: "Open", comingSoon: "Coming soon", comingSoonHint: "Explained in the demo; built after sign-off.",
  plannedLabel: "Planned recipes",
} as const;

export const emailLogCopy = {
  title: "Email log", intro: "Every email the system sent or tried to send, with a preview of exactly what the customer or staff member received.",
  search: "Search subject or recipient", searchLabel: "Search emails", apply: "Search", clear: "Clear",
  statusLabel: "Delivery", statuses: { all: "All", sent: "Sent", failed: "Failed" },
  total: (count: number) => plural(count, "email"), page: (page: number, count: number) => `Page ${page} of ${count}`,
  previous: "Previous", next: "Next", pagination: "Email log pages",
  empty: "No emails match.", emptyHint: "Follow-up, booking and reminder emails appear here as soon as they are sent.",
  openLead: "Open lead", template: (key: string) => `Template: ${key}`,
  list: {
    label: "Logged emails", empty: "No emails match.", sent: "Sent", failed: "Failed", preview: "Show preview",
    to: (to: string) => `To ${to}`, previewTitle: (subject: string) => `Email preview: ${subject}`,
  },
} as const;
