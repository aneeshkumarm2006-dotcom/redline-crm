export const dashboardCopy = {
  greeting: (name: string) => `Hi ${name.split(/\s+/)[0]}.`,
  intro: "Here’s your dealership’s day.", introMine: "Here’s your day.",
  newLeads: "New leads today", appointmentsToday: "Appointments today", viewLeads: "View leads", viewAppointments: "View appointments",
  stock: "Stock by status", stockHint: "All locations. Tap a status to see those vehicles.",
  todaysAppointments: "Today’s appointments", noAppointments: "No appointments today.",
  recent: "Recent activity", noActivity: "No activity yet.", loading: "Loading dashboard…",
  error: "The dashboard could not be loaded.", retry: "Try again", customer: "Customer", automatic: "Automatic", formerStaff: "Former staff member",
} as const;
