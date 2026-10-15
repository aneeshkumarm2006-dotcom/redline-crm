// Shell navigation and presentation copy live together, outside the components.
export const shellCopy = {
  workspace: "Staff workspace",
  navigation: "Main navigation",
  account: "Account menu",
  closeAccount: "Close account menu",
  skip: "Skip to content",
  loading: "Loading workspace…",
  sections: {
    dashboard: { label: "Dashboard", href: "/crm" },
    leads: { label: "Leads", href: "/crm/leads" },
    inventory: { label: "Inventory", href: "/crm/inventory" },
    alerts: { label: "Alerts", href: "/crm/alerts" },
  },
} as const;

export type ShellSection = keyof typeof shellCopy.sections;
