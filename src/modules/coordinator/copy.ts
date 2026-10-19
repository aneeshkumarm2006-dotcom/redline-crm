import type { JourneyState, JourneyStepKey } from "./journey";

export const coordinatorCopy = {
  title: "Lead Coordinator",
  intro: "Every inquiry from first contact to a booked visit: what the automations did, and what still needs a person.",
  loading: "Loading the lead coordinator…",
  periods: { week: "This week", month: "This month" }, periodLabel: "Period",
  // Journey
  journey: "Lead journey", journeyHint: "Each step is recorded automatically as the lead moves.",
  steps: {
    inquiry: "Inquiry received", email: "Follow-up email sent", assigned: "Assigned", booked: "Appointment booked", crm: "CRM updated",
  } satisfies Record<JourneyStepKey, string>,
  assignedTo: (name: string) => `Assigned to ${name}`,
  states: { done: "Done", pending: "Pending", failed: "Failed", skipped: "Skipped" } satisfies Record<JourneyState, string>,
  by: { customer: "Customer", system: "Automatic" },
  stepSummary: (label: string, state: string) => `${label}: ${state}`,
  // Flow diagram
  flow: "Lead flow", flowHint: (period: string) => `Inquiries received ${period.toLowerCase()} and how far each one got.`,
  ofInquiries: (percent: number) => `${percent}% of inquiries`, dropOff: (count: number) => `−${count} dropped`, noDropOff: "No drop-off",
  noInquiries: "No inquiries in this period yet.",
  // Timing
  timing: "Response times", firstContact: "Avg. time to first contact", toBooking: "Avg. time to booking",
  timingHint: (count: number) => `Over ${count} lead${count === 1 ? "" : "s"}`, noTiming: "Not enough data yet",
  // Queues
  queues: "Work queues",
  unassigned: "Unassigned", unassignedHint: "Open leads nobody owns yet. Assign each to a salesperson at its location.", unassignedEmpty: "Every open lead has a salesperson.",
  notContacted: (hours: number) => `Not contacted > ${hours}h`, notContactedHint: "Still in the first stage with no call or email logged.", notContactedEmpty: "Every lead has been contacted in time.",
  assign: "Assign", waiting: (age: string) => `Waiting ${age}`, call: "Call",
  // Live feed
  feed: "Live journeys", feedHint: "Latest lead activity. Refreshes every 20 seconds.", feedEmpty: "No lead activity yet.",
  updated: (time: string) => `Updated ${time}`, open: "Open lead",
  unknownVehicle: "Vehicle unavailable", unknownStaff: "Former staff member", unassignedLead: "Unassigned",
  // Send template email
  sendEmail: "Send email", sendEmailTitle: "Email the customer", sendEmailHint: "The email is logged on this lead and counts as contact.",
  templates: {
    follow_up: { label: "Follow-up with booking link", hint: "Thanks them and links to online booking." },
    appointment_reminder: { label: "Appointment reminder", hint: "Their booked time and the dealership address." },
  },
  needsAppointment: "Needs a booked appointment", send: "Send", sending: "Sending…", sent: "Email sent.",
  emailFailed: "The email could not be delivered. The attempt is in the Email log.",
  templateError: "This email template could not be prepared. Check the template and the APP_URL setting.",
  noAppointment: "This customer has no upcoming appointment to remind them about.",
  notFound: "This lead was not found or is no longer assigned to you.",
  error: "Unable to send the email. Please try again.", close: "Close",
} as const;

/** Compact duration: "45 min", "3.5 h", "2.1 days". */
export function formatDuration(ms: number) {
  const minutes = ms / 60_000;
  if (minutes < 60) return `${Math.max(1, Math.round(minutes))} min`;
  const hours = minutes / 60;
  if (hours < 48) return `${hours < 10 ? hours.toFixed(1) : Math.round(hours)} h`;
  return `${(hours / 24).toFixed(1)} days`;
}
