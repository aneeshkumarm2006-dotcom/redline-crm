/** Virtual assistant: lead activity, alerts, run notes and UI strings. */
export const assistantActivity = {
  customerEmail: (subject: string) => `Customer replied by email${subject ? `: ${subject}` : "."}`,
  replied: (name: string, subject: string) => `${name} (assistant) replied by email: ${subject}`,
  drafted: (name: string) => `${name} (assistant) drafted a reply for review.`,
  booked: (when: string) => `Assistant booked the appointment by email for ${when}.`,
  handedOff: (reason: string) => `Assistant handed the conversation to staff: ${reason}`,
  optedOut: "Customer asked not to receive emails; automatic emails are stopped.",
  staffReplied: (subject: string) => `Reply sent from the conversation: ${subject}`,
} as const;

export const assistantAlerts = {
  handoff: (customer: string, reason: string, urgent: boolean) => `${urgent ? "Urgent — " : ""}${customer} needs a person: ${reason}`.slice(0, 1000),
  draft: (customer: string) => `${customer} replied. The assistant drafted an answer for you to review and send.`,
  customerReply: (customer: string, why: string) => `${customer} replied by email (${why}). Answer them from the Conversation tab.`,
  failed: (customer: string) => `${customer} replied, but the assistant could not answer. Please reply personally.`,
} as const;

export const assistantNotes = {
  off: "The assistant is turned off.",
  paused: (reason: string) => `The assistant is paused for this customer${reason ? ` (${reason})` : ""}.`,
  optedOut: "The customer asked not to receive emails.",
  closed: "The lead is closed (won or lost); staff should answer.",
  dailyLimit: (limit: number) => `Daily limit of ${limit} automatic replies reached for this customer.`,
  unmatched: "No lead matches the sender.",
  stale: "Older than the inbox start; not answered automatically.",
  answeredByStaff: (name: string) => `Answered by ${name}.`,
  noKey: "ANTHROPIC_API_KEY is not set, so the assistant cannot reply.",
  failed: "The assistant could not reply; staff were alerted.",
  retrying: "The assistant hit an error; it will try again shortly.",
  sendFailed: "The reply could not be emailed.",
  handoffWithReply: (reason: string) => `Replied, then handed to staff: ${reason}`,
  newer: "The customer wrote again after this draft.",
} as const;

export const assistantCopy = {
  // Lead Conversation tab
  tab: "Conversation", title: "Email conversation", hint: "Customer emails, the assistant's answers and staff replies, in order.",
  empty: "No emails in this conversation yet. When the customer replies to any email, it appears here.",
  customer: "Customer", assistant: (name: string) => `${name} · assistant`, staff: "Staff", automatic: "Automatic",
  inquiry: "Website inquiry", draft: "Draft for review", discarded: "Discarded", failed: "Not delivered",
  statuses: {
    pending: "Waiting for the assistant", processing: "Assistant is answering…", replied: "Answered", drafted: "Draft ready",
    handed_off: "Handed to staff", ignored: "No reply needed", skipped: "Not answered automatically", failed: "Assistant failed",
  } as Record<string, string>,
  paused: "Paused for this customer", active: "Answering this customer", off: "Assistant is off", optedOut: "Customer unsubscribed",
  pause: "Pause assistant", resume: "Resume assistant", pausedSaved: "Assistant paused for this customer.", resumedSaved: "Assistant resumed for this customer.",
  draftWithAi: "Draft a reply with the assistant", drafting: "Drafting…", drafted: "Draft ready below.", nothingToAnswer: "There is no customer message to answer yet.",
  replyLabel: "Write a reply", replyPlaceholder: "Hi Jordan, thanks for getting back to us…", send: "Send reply", sending: "Sending…", sent: "Reply sent.",
  replyHint: "Sends in the same email thread from the dealership's address. Sending a reply pauses the assistant for this customer.",
  approve: "Send draft", discard: "Discard", discardedSaved: "Draft discarded.", editDraft: "Edit before sending",
  error: "Something went wrong. Please try again.", notFound: "This lead was not found or is no longer assigned to you.",
  draftGone: "That draft was already sent or discarded.", noEmail: "This customer has no email address the dealership can write to.",
  // Owner page
  pageTitle: "Virtual assistant", pageIntro: "An AI assistant that answers customers by email, books visits and hands tricky conversations to your team.",
  status: "Status", model: "Model", apiKey: "Claude API key", inbox: "Reply inbox", lastPoll: "Last inbox check", never: "Never",
  configured: "Configured", missing: "Missing", inboxOff: "Not configured — customer email replies are not read",
  checkNow: "Check inbox now", checking: "Checking…", checked: (fetched: number) => `Inbox checked: ${fetched} new email${fetched === 1 ? "" : "s"}.`,
  checkFailed: "The inbox could not be checked.",
  settings: "Settings", enabled: "Assistant on", enabledHint: "Answers customer emails and new website inquiries.",
  mode: "Replies", modes: { auto: "Send automatically", draft: "Draft for staff approval" },
  modeHints: { auto: "The assistant emails customers itself and books visits.", draft: "Staff review every reply on the lead's Conversation tab; nothing is booked automatically." },
  name: "Assistant name", answerInquiries: "Answer website inquiry questions", answerInquiriesHint: "Replies to the message in a new inquiry, after the automatic thank-you email.",
  maxReplies: "Automatic replies per customer per day", maxRepliesHint: "Beyond this the conversation goes to staff (stops reply loops).",
  instructions: "Guidance for the assistant", instructionsHint: "Policies, tone, current promotions. Customers never see this text.",
  instructionsPlaceholder: "We offer free delivery within 50 km. Trade-ins are appraised in person. Never discuss financing rates.",
  save: "Save settings", saving: "Saving…", saved: "Assistant settings saved.",
  attention: "Needs attention", attentionEmpty: "Nothing needs attention.", drafts: "Drafts to review", handoffs: "Handed to staff", failures: "Could not answer",
  recent: "Recent conversation activity", recentEmpty: "No assistant activity yet.", unmatched: "Emails from unknown senders",
  unmatchedHint: "Replies the assistant could not match to a lead. Check the inbox and add a lead if needed.",
  openLead: "Open lead", weekStats: "Last 7 days", repliesSent: "Replies sent", customerEmails: "Customer emails", booked: "Booked by assistant", handedOff: "Handed off",
  setupTitle: "Setup", setup: [
    "Replies are read from the Gmail inbox in SMTP_USER (IMAP, same app password). Set ASSISTANT_IMAP_HOST/USER/PASS to read another mailbox.",
    "Leave EMAIL_REPLY_TO empty, or point it at that inbox, so customer replies reach the assistant.",
    "On Vercel, call /api/assistant/poll every few minutes with Authorization: Bearer CRON_SECRET (e.g. a free cron service). Locally it runs every minute.",
    "Other providers can push emails to /api/assistant/inbound with Authorization: Bearer ASSISTANT_INBOUND_SECRET.",
  ],
} as const;
