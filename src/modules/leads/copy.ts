export const inquiryCopy = {
  title: "Interested in this vehicle?", intro: "Send an inquiry to the dealership. Tell us what you’d like to know.",
  name: "Full name", email: "Email address", phone: "Phone number", message: "Message (optional)",
  submit: "Send inquiry", pending: "Sending…", thankYou: "Thank you for your inquiry",
  received: "Your inquiry has been received by the dealership.",
  privacy: "Your contact details will be shared with the dealership to respond to this inquiry.",
  invalid: "Please check your details and try again.", error: "Unable to send your inquiry. Please try again.",
  unavailable: "This vehicle is no longer available for inquiries. Please browse our current inventory.",
  reused: "Please reload the page before sending a different inquiry.",
  activity: "Customer submitted a vehicle inquiry.",
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
  details: "Lead details", source: "Source", sources: { public_inventory: "Website inquiry", website: "Website", phone: "Phone", walk_in: "Walk-in" } as Record<string, string>,
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
  results: (count: number) => `${count} lead${count === 1 ? "" : "s"}`,
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
