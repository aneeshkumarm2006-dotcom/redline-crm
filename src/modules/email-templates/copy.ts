export const templatesCopy = {
  title: "Email templates", hint: "Subjects and bodies of the emails the CRM sends. Placeholders in double braces are filled in when the email goes out.",
  template: "Template", subject: "Subject", body: "Body (HTML)", placeholders: "Placeholders you can use", preview: "Preview", previewMode: "Preview content", sampleData: "Sample data", rawPlaceholders: "Placeholders",
  previewHint: "Exactly as it lands in the inbox, with your branding.",
  insert: (name: string) => `Insert ${name}`, save: "Save template", saved: "Template saved.", empty: "No email templates yet. Run the seed to add them.",
  names: {
    follow_up: "Customer first contact (booking link)", follow_up_2: "Customer follow-up: day 2", follow_up_3: "Customer follow-up: final check-in", booking_confirmation: "Customer booking confirmation", appointment_reminder: "Customer appointment reminder",
    new_lead: "Staff: new lead", appointment_notice: "Staff: appointment booked", status_change: "Staff: status change", price_change: "Staff: price change", stage_change: "Staff: stage change",
  } as Record<string, string>,
  saving: "Saving…", failed: "The template could not be saved. Try again.",
} as const;
