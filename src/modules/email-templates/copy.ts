export const templatesCopy = {
  title: "Email templates", hint: "Subjects and bodies of the emails the CRM sends. Placeholders in double braces are filled in when the email goes out.",
  template: "Template", subject: "Subject", body: "Body (HTML)", placeholders: "Placeholders you can use", preview: "Preview (placeholders shown as written)",
  insert: (name: string) => `Insert ${name}`, save: "Save template", saved: "Template saved.", empty: "No email templates yet. Run the seed to add them.",
  names: {
    follow_up: "Customer follow-up (booking link)", booking_confirmation: "Customer booking confirmation", appointment_reminder: "Customer appointment reminder",
    new_lead: "Staff: new lead", appointment_notice: "Staff: appointment booked", status_change: "Staff: status change", price_change: "Staff: price change", stage_change: "Staff: stage change",
  } as Record<string, string>,
  saving: "Saving…", failed: "The template could not be saved. Try again.",
} as const;
