export const alertsCopy = {
  title: "Alerts", intro: "Lead, appointment and vehicle updates for you.",
  markAll: "Mark all as read", marking: "Marking…", allRead: "All alerts marked as read.", unread: "Unread", read: "Read",
  empty: "You’re all caught up", emptyHint: "New leads, appointments and vehicle changes will appear here.",
  bell: (count: number) => count ? `Alerts, ${count} unread` : "Alerts", newAlert: "New alert", view: "View",
  loading: "Loading alerts…", error: "Alerts could not be loaded.", retry: "Try again", failed: "Unable to update alerts. Please try again.",
  unreadCount: (count: number) => count ? `${count} unread` : "No unread alerts",
} as const;
