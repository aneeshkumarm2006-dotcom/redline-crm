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

export const appointmentsCopy = {
  intro: "Booked customer visits.", introMine: "Your booked customer visits.",
  today: "Today", upcoming: "Upcoming", noneToday: "No appointments today.", noneUpcoming: "No upcoming appointments.",
  empty: "No appointments booked", emptyHint: "When a customer books from their follow-up email, the visit appears here.",
  with: (name: string) => `With ${name}`, unknownLead: "Customer", unknownVehicle: "Vehicle unavailable", unknownStaff: "Former staff member",
  loading: "Loading appointments…",
} as const;
