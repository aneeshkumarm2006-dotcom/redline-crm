export const bookingCopy = {
  title: "Book an appointment", skip: "Skip to booking",
  greeting: (name: string) => `Hi ${name}, choose a time to visit.`,
  meeting: (salesperson: string, dealership: string) => `You’ll meet ${salesperson} at ${dealership}.`,
  day: "Choose a day", time: "Choose a time", zone: (zone: string) => `Times are in ${zone}.`,
  selected: "Your selected time", confirm: "Confirm appointment", pending: "Booking…",
  bookedTitle: "You’re booked",
  emailed: "A confirmation has been sent to your email.",
  existingTitle: "Your appointment is booked",
  withSalesperson: (name: string) => `${name} will meet you.`,
  change: "Need to change it? Call the dealership.",
  invalidTitle: "This booking link isn’t valid",
  invalidBody: "It may be incomplete or copied incorrectly. Please use the link from your email or contact the dealership.",
  unavailableTitle: "Online booking isn’t available",
  unavailableBody: "Please call the dealership to arrange a visit.",
  noSlots: "There are no times available online right now. Please call the dealership.",
  taken: "Sorry, that time was just taken. Please choose another.",
  alreadyBooked: "You already have an appointment booked.",
  error: "We couldn’t book that time. Please try again.",
  loadError: "We couldn’t load available times. Please try again.", retry: "Try again", browse: "Browse inventory", call: (phone: string) => `Call ${phone}`, loading: "Loading available times…",
} as const;

/** Staff booking for a customer from the lead screen. */
export const staffBookingCopy = {
  book: "Book appointment", title: "Book an appointment", hint: (name: string) => `Pick a time with ${name}. The customer gets the confirmation email.`,
  loading: "Loading available times…", loadError: "Times could not be loaded. Try again.", retry: "Try again",
  day: "Day", time: "Time", zone: (zone: string) => `Times are in ${zone}.`, selected: "Selected time", confirm: "Book this time", pending: "Booking…",
  booked: (when: string) => `Booked for ${when}.`, existing: (when: string) => `This customer is already booked for ${when}.`,
  unassigned: "Assign a salesperson at this lead’s location before booking.", noSlots: "No free times in the booking window.",
  notFound: "This lead was not found or is no longer assigned to you.",
  taken: "That time was just taken. Choose another.", alreadyBooked: "This customer already has an appointment booked.",
  savedWithWarning: "Booked, but a follow-up step (stage update, email or alert) did not complete.",
  error: "Unable to book that time. Please try again.", close: "Close",
} as const;

export const appointmentsCopy = {
  intro: "Booked customer visits.", introMine: "Your booked customer visits.",
  today: "Today", upcoming: "Upcoming", noneToday: "No appointments today.", noneUpcoming: "No upcoming appointments.",
  empty: "No appointments booked", emptyHint: "When a customer books from their follow-up email, the visit appears here.",
  with: (name: string) => `With ${name}`, unknownLead: "Customer", unknownVehicle: "Vehicle unavailable", unknownStaff: "Former staff member",
  loading: "Loading appointments…",
  // Week calendar (owner filters by location and salesperson)
  views: { list: "List", day: "Day", week: "Week" }, viewLabel: "Appointments view",
  previousWeek: "Previous week", nextWeek: "Next week", thisWeek: "This week", weekNav: "Week",
  weekCount: (count: number) => `${count} appointment${count === 1 ? "" : "s"} this week`,
  closed: "Closed", noneDay: "No appointments",
  location: "Location", allLocations: "All locations", salesperson: "Salesperson", allSalespeople: "All salespeople", apply: "Apply", filters: "Filter the calendar",
  status: { booked: "Booked", completed: "Completed" } as Record<string, string>,
  // Day schedule: one column per salesperson
  previousDay: "Previous day", nextDay: "Next day", goToday: "Today", dayNav: "Day", openDay: (label: string) => `Open the ${label} schedule`,
  dayCount: (count: number, people: number) => `${count} appointment${count === 1 ? "" : "s"} · ${people} salesperson${people === 1 ? "" : "s"} booked`,
  closedDay: "The dealership is closed this day", closedDayHint: "No appointments are booked. Pick another day to see the team’s schedule.",
  noSalespeople: "No active salespeople", noSalespeopleHint: "Salespeople at this location appear here as columns.",
  visits: (count: number) => `${count} visit${count === 1 ? "" : "s"}`,
  open: (count: number) => `${count} open`, full: "Fully booked",
  hours: (opens: string, closes: string) => `Open ${opens}–${closes}`,
  scheduleFor: (name: string) => `${name}’s schedule`,
} as const;
