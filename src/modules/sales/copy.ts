export const salesCopy = {
  // Team board
  title: "Team", intro: "Your salespeople by location: pipeline, appointments, sales and commission.",
  kpis: "Team this month", unitsThisMonth: "Units sold this month", revenueThisMonth: "Sales this month", commissionThisMonth: "Commission payable",
  openLeads: "Open leads", targetHint: (target: number) => `Team target ${target}`, noTarget: "No targets set",
  board: "Salespeople by location", inactiveGroup: "Inactive", inactive: "Inactive",
  columns: {
    person: "Salesperson", phone: "Phone", openLeads: "Open leads", vehicles: "Cars working", appointments: "Appts this week",
    sales: "Sales vs target", commission: "Commission (month)", conversion: "Conversion",
  },
  progress: (units: number, target: number | null) => target === null ? `${units} sold · no target` : `${units} of ${target}`,
  chartsTitle: "Last 6 months", unitsChart: "Units sold by month", commissionChart: "Commission by month", revenueChart: "Sales by month",
  series: { units: "Units", commission: "Commission", revenue: "Sales" },
  commissionReport: "Commission report", addSalesperson: "Add salesperson",
  empty: "No salespeople yet", emptyHint: "Add your first salesperson to start assigning leads.",
  conversionHint: "Won ÷ closed (won + lost) leads, all time.",
  // Profile
  back: "Back to team", profile: "Salesperson profile", location: "Location", phone: "Phone", email: "Email", hired: "Hired", target: "Monthly target",
  units: (count: number) => `${count} unit${count === 1 ? "" : "s"}`, none: "—",
  profileKpis: "Performance", vehicles: "Cars working on", appointmentsWeek: "Appointments this week", soldThisMonth: "Sold this month",
  conversion: "Conversion", record: (won: number, lost: number) => `${won} won · ${lost} lost`, pipeline: "Lead pipeline", pipelineEmpty: "No leads assigned.",
  pipelineColumns: { customer: "Customer", vehicle: "Vehicle", source: "Source", created: "Received" },
  soldVehicles: "Sold vehicles", soldEmpty: "No sales recorded yet.", soldGroup: "Sales",
  soldColumns: { vehicle: "Vehicle", soldAt: "Sold", price: "Sale price", commission: "Commission" },
  upcoming: "Upcoming appointments", upcomingEmpty: "No upcoming appointments.", unknownCustomer: "Customer", unknownVehicle: "Vehicle",
  // Commission report
  report: { title: "Commission report", intro: "Commission earned per salesperson for the month, from recorded sales.", month: "Month", show: "Show",
    salesperson: "Salesperson", location: "Location", units: "Units", revenue: "Sales", commission: "Commission", total: "Total",
    empty: "No sales recorded this month.", exportSummary: "Download CSV", exportDetail: "Download sales detail (CSV)",
    sales: (count: number) => `${count} sale${count === 1 ? "" : "s"}`, back: "Back to team" },
  csv: {
    summary: ["Month", "Salesperson", "Location", "Units", "Sales (CAD)", "Commission (CAD)"],
    detail: ["Month", "Sold at", "Salesperson", "Location", "Stock #", "Vehicle", "Sale price (CAD)", "Commission (CAD)"],
    total: "Total",
  },
  unknownLocation: "Unknown location", formerStaff: "Former staff member",
  loading: "Loading team…",
} as const;

export const formatMonth = (start: number, timeZone: string, style: "short" | "long" = "short") =>
  new Intl.DateTimeFormat("en-CA", style === "short" ? { month: "short", timeZone } : { month: "long", year: "numeric", timeZone }).format(new Date(start));
export const formatPercent = (value: number | null) => value === null ? "—" : `${Math.round(value * 100)}%`;
