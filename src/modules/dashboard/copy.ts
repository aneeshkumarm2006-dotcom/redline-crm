export const dashboardCopy = {
  greeting: (name: string) => `Hi ${name.split(/\s+/)[0]}.`,
  intro: "Here’s how the business is doing today.", introLocation: (location: string) => `Here’s how ${location} is doing today.`, introMine: "Here’s your day.",
  commandCenter: "Command Center",
  // Location filter
  locationFilter: "Location", allLocations: "All locations",
  // Owner KPIs
  kpis: "Key figures", inventoryValue: "Inventory value", inStock: (count: number) => `${count} car${count === 1 ? "" : "s"} in stock`,
  averageDays: "Avg days in stock", days: (count: number) => `${count} day${count === 1 ? "" : "s"}`,
  agingHint: (count: number, days: number) => count ? `${count} over ${days} days` : `None over ${days} days`,
  leadsThisMonth: "Leads this month", leadsToday: (count: number) => `${count} today`,
  conversion: "Conversion rate", conversionHint: "Won ÷ closed, last 6 months",
  salesThisMonth: "Sales this month", units: (count: number) => `${count} unit${count === 1 ? "" : "s"}`,
  unitsOfTarget: (units: number, target: number) => `${units} of ${target} units`,
  commissionPayable: "Commission payable", commissionHint: "Open the commission report",
  none: "—",
  // Stock
  unitsByStatus: "Units by status", unitsByStatusHint: "Sold counts this month. Tap a status to open the board.",
  soldThisMonth: "this month",
  // Charts
  salesByMonth: "Sales by month", salesByMonthHint: "Last 6 months. Tap a month for its commission report.", revenue: "Sales",
  funnel: "Lead funnel", funnelHint: (lost: number) => `Leads from the last 6 months by how far they’ve got${lost ? ` · ${lost} lost` : ""}. Tap a stage to see its leads.`,
  ofLeads: (percent: number) => `${percent}% of leads`, noLeads: "No leads in the last 6 months.",
  stockByLocation: "Inventory by location", stockByLocationHint: "Cars per status at each location. Tap a count to open those cars.",
  locationTotal: (count: number) => `${count} car${count === 1 ? "" : "s"}`,
  segment: (status: string, count: number, location: string) => `${location}: ${count} ${status}`,
  aging: "Aging", agingChartHint: (warn: number, critical: number) => `Unsold cars by days in stock (warning at ${warn}, critical at ${critical}). Tap a bar to open those cars.`,
  bucket: (min: number, max: number | null) => max === null ? `Over ${min - 1}` : `${min}–${max}`, cars: "Cars",
  // Leaderboard
  leaderboard: "Team leaderboard", leaderboardHint: "Units and commission this month.", noSalespeople: "No salespeople at this location yet.",
  progress: (units: number, target: number | null) => target === null ? `${units} sold` : `${units} of ${target} sold`,
  openTeam: "Open team board",
  // Agenda and activity
  todaysAppointments: "Today’s appointments", noAppointments: "No appointments today.", viewAppointments: "All appointments",
  recent: "Recent activity", noActivity: "No activity yet.",
  // Salesperson
  myKpis: "My figures", openLeads: "My open leads", carsWorking: (count: number) => `${count} car${count === 1 ? "" : "s"} you’re working on`,
  appointmentsToday: "Appointments today", mySales: "My sales this month", noTarget: "No monthly target set", toGo: (count: number) => count > 0 ? `${count} to go for your target` : "Target reached", myCommission: "My commission",
  commissionFrom: (revenue: string) => `From ${revenue} in sales`,
  reminders: "My reminders", remindersHint: "Your latest reminder alerts.", noReminders: "No reminders yet.", allReminders: "All reminders",
  loading: "Loading dashboard…", error: "The dashboard could not be loaded.", retry: "Try again",
  customer: "Customer", automatic: "Automatic", formerStaff: "Former staff member",
} as const;
