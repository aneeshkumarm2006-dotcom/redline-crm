export const inquiryCopy = {
  title: "Interested in this vehicle?", intro: "Send an inquiry to the dealership. Tell us what you’d like to know.",
  name: "Full name", email: "Email address", phone: "Phone number", message: "Message (optional)",
  submit: "Send inquiry", pending: "Sending…", thankYou: "Thank you for your inquiry",
  received: "Your inquiry has been received by the dealership.",
  privacy: "Your contact details will be shared with the dealership to respond to this inquiry.",
  invalid: "Please check your details and try again.", error: "Unable to send your inquiry. Please try again.",
  unavailable: "This vehicle is no longer available for inquiries. Please browse our current inventory.",
  reused: "Please reload the page before sending a different inquiry.",
  activity: "Customer submitted a vehicle inquiry.", activityVia: (campaign: string) => `Customer submitted a vehicle inquiry (campaign: ${campaign}).`,
} as const;

export const leadsCopy = {
  title: "Leads", intro: "Keep every customer conversation moving.", introMine: "Your assigned customer conversations.",
  tabs: { leads: "Leads", appointments: "Appointments" },
  filters: "Search and filters", search: "Search leads", searchPlaceholder: "Name, email or phone", stage: "Stage", dealership: "Dealership", assignee: "Assigned to",
  allStages: "All stages", allDealerships: "All dealerships", allAssignees: "Everyone", unassigned: "Unassigned",
  apply: "Apply filters", clear: "Clear filters", empty: "No leads found", emptyHint: "Try another search or clear your filters.",
  emptyMine: "No leads assigned to you yet", emptyMineHint: "New inquiries assigned to you will appear here.",
  previous: "Previous", next: "Next", back: "Back to leads", open: "Open lead",
  vehicle: "Vehicle", customer: "Customer", received: "Received", age: "Age",
  loading: "Loading leads…", error: "Leads could not be loaded.", retry: "Try again",
  contact: "Customer", call: "Call", email: "Email", message: "Inquiry message", noMessage: "No message included.",
  vehicleCard: "Vehicle of interest", viewVehicle: "View vehicle", unknownVehicle: "Vehicle unavailable",
  details: "Lead details", source: "Source", sourceVia: (source: string, campaign: string) => `${source} · ${campaign}`,
  appointment: "Appointment", noAppointment: "No appointment booked yet.",
  changeStage: "Change stage", stageHint: "Tap a stage to save it immediately.", current: "Current",
  reassign: "Reassign", reassignHint: "Only active salespeople at this lead’s location are listed.", noSalespeople: "No active salespeople at this location.",
  addNote: "Add note", notePlaceholder: "Called the customer, left a voicemail…", saveNote: "Save note", noteSaved: "Note added.",
  stageSaved: "Stage updated.", assigneeSaved: "Lead reassigned.", saving: "Saving…", close: "Close",
  activity: "Activity", noActivity: "No activity yet.", customerActor: "Customer", systemActor: "Automatic",
  notFound: "This lead was not found or is no longer assigned to you.", stale: "This lead changed. Refresh and try again.",
  unknownStage: "Choose a configured lead stage.", invalidAssignee: "Choose an active salesperson at this lead’s location.",
  savedWithWarning: "Saved, but a follow-up notification could not be delivered.",
  networkError: "Unable to save. Check your connection and try again.", ownerOnly: "Owner access is required. Sign in again if your session expired.",
  genericError: "Unable to save the lead. Please try again.", unknownStaff: "Former staff member", unknownDealership: "Unknown dealership",
  // Board / list
  views: { board: "Board", list: "List" }, viewLabel: "View", allSources: "All sources",
  newLead: "New lead", pipeline: "Lead pipeline", jumpTo: "Jump to stage",
  emptyColumn: "No leads", moreInColumn: (count: number) => `+${count} more in the list`,
  truncated: (shown: number, total: number) => `Showing the newest ${shown} of ${total} leads. Narrow the filters to see the rest.`,
  nextAppointment: "Next appointment", noAssignee: "Unassigned", moveStage: "Move stage", moveHint: "Tap a stage to move this lead.", openLead: "Open lead",
  // Lead detail
  detailTabs: { overview: "Overview", emails: "Emails", activity: "Activity" }, tabsLabel: "Lead sections",
  quickActions: "Quick actions",
  logCall: "Log call", logCallHint: "Record a call with the customer. The first call or email marks the lead as contacted.",
  callNote: "What happened? (optional)", callNotePlaceholder: "Talked about financing, coming in Saturday…",
  advanceStage: (label: string) => `Move to ${label}`, saveCall: "Save call", callSaved: "Call logged.",
  callLogged: "Call logged.", callSavedStageStale: "Call logged, but the lead changed stage meanwhile, so it was not moved.",
  emailLogged: (subject: string) => `Email sent: ${subject}`,
  emailsTitle: "Emails to and about this customer", noEmails: "No emails logged for this lead yet.",
  emailTo: (to: string) => `To ${to}`, emailFailed: "Not delivered", emailSent: "Sent", preview: "Show email", previewTitle: (subject: string) => `Email preview: ${subject}`,
  // Staff-entered lead
  newLeadTitle: "New lead", newLeadIntro: "Log a phone call, walk-in or referral. It follows the same automations as a website inquiry.",
  customerSection: "Customer", leadSection: "Lead", name: "Full name", emailField: "Email", phone: "Phone", note: "Notes (optional)",
  vehicleField: "Vehicle of interest", chooseVehicle: "Choose a vehicle", sourceField: "Source", chooseSource: "Choose a source",
  assigneeField: "Salesperson", autoAssign: "Assign automatically (round-robin)", assigneeMine: "You (leads you enter stay with you)",
  contacted: "I’ve already spoken with this customer", contactedHint: "Marks the lead as contacted, so it stays out of the follow-up queue.",
  createLead: "Create lead", creating: "Creating…", created: "Lead created.", cancel: "Cancel",
  noVehicles: "There are no cars you can log a lead for right now.",
  staffCreated: (source: string) => `Lead entered by staff (${source}).`,
  assignedActivity: (name: string) => `Lead assigned to ${name}.`,
  unknownSource: "Choose a configured lead source.",
  vehicleUnavailable: "That vehicle is sold or no longer in inventory. Choose another.",
  otherLocation: "Choose a car at your location. Leads you enter are assigned to you.",
  results: (count: number) => `${count} lead${count === 1 ? "" : "s"}`,
  exportCsv: "Export CSV",
  dragHint: "Drag a card to another column to change its stage, or tap it for options.", movedTo: (name: string, stage: string) => `${name} moved to ${stage}.`,
  csv: { received: "Received", customer: "Customer", email: "Email", phone: "Phone", stage: "Stage", source: "Source", campaign: "Campaign",
    vehicle: "Vehicle", stockNo: "Stock #", location: "Location", salesperson: "Salesperson" },
  page: (page: number, total: number) => `Page ${page} of ${total}`,
} as const;

/** Compact "how long ago" label; `now` is passed in so server rendering stays deterministic per request. */
export function leadAge(createdAt: string, now: number) {
  const minutes = Math.max(0, Math.floor((now - Date.parse(createdAt)) / 60_000));
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes} min ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} h ago`;
  const days = Math.floor(hours / 24);
  return `${days} day${days === 1 ? "" : "s"} ago`;
}
