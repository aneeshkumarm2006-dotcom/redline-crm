export const demoEmailTemplates = [
  {
    key: "price_change", subject: "Price updated: {{stockNo}} — {{price}}",
    body: '<p>{{vehicleName}} ({{stockNo}}) at {{dealershipName}} changed from {{previousPrice}} to {{price}}.</p><p>Updated by {{changedByName}}.</p><p><a href="{{vehicleUrl}}">Open the vehicle</a></p>',
  },
  {
    key: "stage_change", subject: "Lead update: {{customerName}} — {{stageLabel}}",
    body: '<p>{{customerName}} — {{vehicleName}} changed from {{previousStageLabel}} to {{stageLabel}}.</p><p><a href="{{leadUrl}}">Open leads</a></p>',
  },
  {
    key: "appointment_notice", subject: "Appointment: {{customerName}} — {{vehicleName}}",
    body: '<p>Hi {{salespersonName}},</p><p>{{customerName}} booked an appointment to see {{vehicleName}} at {{dealershipName}}:</p><p><strong>{{appointmentTime}}</strong></p><p><a href="{{leadUrl}}">Open leads</a></p>',
  },
  {
    key: "follow_up", subject: "Your inquiry about {{vehicleName}} — {{companyName}}",
    body: '<p>Hi {{customerName}},</p><p>Thank you for your interest in {{vehicleName}}. Our team will be in touch shortly.</p><p><a href="{{bookingUrl}}">Book an appointment</a> to see it at {{dealershipName}}.</p><p>{{companyName}}</p>',
  },
  {
    key: "booking_confirmation", subject: "Your appointment at {{dealershipName}}",
    body: '<p>Hi {{customerName}},</p><p>Your appointment to see {{vehicleName}} is confirmed:</p><p><strong>{{appointmentTime}}</strong></p><p>{{salespersonName}} will meet you at {{dealershipAddress}}. Call {{dealershipPhone}} if your plans change.</p><p>{{companyName}}</p>',
  },
  {
    key: "appointment_reminder", subject: "Reminder: your appointment at {{dealershipName}}",
    body: '<p>Hi {{customerName}},</p><p>This is a reminder of your appointment to see {{vehicleName}}:</p><p><strong>{{appointmentTime}}</strong></p><p>We are at {{dealershipAddress}}. Call {{dealershipPhone}} if you need to reschedule.</p><p>{{companyName}}</p>',
  },
  {
    key: "new_lead", subject: "New lead: {{customerName}} — {{vehicleName}}",
    body: '<p>Hi {{salespersonName}},</p><p>{{customerName}} has asked about {{vehicleName}} at {{dealershipName}}.</p><p>{{customerMessage}}</p><p><a href="{{leadUrl}}">Open the lead</a></p>',
  },
  {
    key: "status_change", subject: "{{stockNo}} is now {{statusLabel}}",
    body: '<p>{{vehicleName}} ({{stockNo}}) at {{dealershipName}} changed from {{previousStatusLabel}} to {{statusLabel}}.</p><p>Updated by {{changedByName}}.</p><p><a href="{{vehicleUrl}}">Open the vehicle</a></p>',
  },
];
