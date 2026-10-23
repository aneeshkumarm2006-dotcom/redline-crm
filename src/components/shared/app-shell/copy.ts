import type { Role } from "@/modules/users/schema";

// Shell navigation and presentation copy live together, outside the components.
export const shellCopy = {
  workspace: "Staff workspace",
  navigation: "Main navigation",
  account: "Account menu",
  closeAccount: "Close account menu",
  skip: "Skip to content",
  loading: "Loading workspace…",
  more: "More",
  moreTitle: "More tools",
  moreHint: "Everything else in the workspace.",
  close: "Close",
  comingSoon: "Coming soon",
  comingSoonHint: "This screen is being built for the next demo.",
  sections: {
    dashboard: { label: "Dashboard", href: "/crm" },
    inventory: { label: "Inventory", href: "/crm/inventory" },
    leads: { label: "Leads", href: "/crm/leads" },
    calendar: { label: "Calendar", href: "/crm/calendar" },
    team: { label: "Team", href: "/crm/team" },
    coordinator: { label: "Lead Coordinator", href: "/crm/coordinator" },
    automations: { label: "Automations", href: "/crm/automations" },
    garages: { label: "Garages", href: "/crm/garages" },
    alerts: { label: "Alerts", href: "/crm/alerts" },
    settings: { label: "Settings", href: "/crm/settings" },
  },
  descriptions: {
    coordinator: "Inquiry → follow-up email → assignment → booking → CRM update, for every lead.",
    automations: "When-this-then-that recipes, their run history and the email log.",
    garages: "Partner garages, the cars at each one and how long repairs are taking.",
    settings: "Statuses, stages, sources, repair types, garages, reminder thresholds, branding and email templates.",
  },
} as const;

export type ShellSection = keyof typeof shellCopy.sections;

/**
 * Role-aware navigation. The desktop sidebar lists `primary`, then `more` under a heading. On mobile the
 * first four `primary` links fill the bar and anything after them joins `more` in the "More" sheet.
 */
export const shellNavigation: Record<Role, { primary: ShellSection[]; more: ShellSection[] }> = {
  owner: { primary: ["dashboard", "inventory", "leads", "calendar", "team"], more: ["coordinator", "automations", "garages", "alerts", "settings"] },
  salesperson: { primary: ["dashboard", "leads", "calendar", "inventory", "alerts"], more: [] },
};
