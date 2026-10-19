// Bodies use a small HTML vocabulary (p, strong, a, ul/li) that the branded email layout styles: a paragraph holding
// only bold text becomes a highlighted detail box, and a link becomes a button in the brand colour.
export const demoEmailTemplates = [
  {
    key: "price_change", subject: "Price updated: {{stockNo}} — {{price}}",
    body: '<p>Heads up — the price on <strong>{{vehicleName}}</strong> ({{stockNo}}) at {{dealershipName}} just changed.</p><p><strong>{{previousPrice}} → {{price}}</strong></p><p>Updated by {{changedByName}}. Let any customers who asked about it know.</p><p><a href="{{vehicleUrl}}">Open the vehicle</a></p>',
  },
  {
    key: "stage_change", subject: "Lead update: {{customerName}} — {{stageLabel}}",
    body: '<p>{{customerName}}, interested in {{vehicleName}}, moved along the pipeline.</p><p><strong>{{previousStageLabel}} → {{stageLabel}}</strong></p><p><a href="{{leadUrl}}">Open the lead</a></p>',
  },
  {
    key: "appointment_notice", subject: "New appointment: {{customerName}} — {{vehicleName}}",
    body: '<p>Hi {{salespersonName}},</p><p>{{customerName}} just booked a visit to see <strong>{{vehicleName}}</strong> at {{dealershipName}}.</p><p><strong>{{appointmentTime}}</strong></p><p>Have the car washed, fuelled and parked out front before they arrive.</p><p><a href="{{leadUrl}}">Open the lead</a></p>',
  },
  {
    key: "follow_up", subject: "Thanks for your interest in the {{vehicleName}}",
    body: '<p>Hi {{customerName}},</p><p>Thanks for reaching out about the <strong>{{vehicleName}}</strong> at {{dealershipName}}. It\'s ready to see, and {{salespersonName}} will take care of you personally.</p><p>Pick a time that suits you and we\'ll have it waiting:</p><p><a href="{{bookingUrl}}">Book a test drive</a></p><p>Prefer to talk first? Call us at {{dealershipPhone}}.</p><p>— The {{companyName}} team</p>',
  },
  {
    key: "follow_up_2", subject: "Still thinking about the {{vehicleName}}?",
    body: '<p>Hi {{customerName}},</p><p>Just checking in on the <strong>{{vehicleName}}</strong> you asked about. It\'s still available at {{dealershipName}}, and test drives take about 30 minutes.</p><p><a href="{{bookingUrl}}">Choose a time</a></p><p>Have questions about price, financing or a trade-in? Reply to this email or call {{dealershipPhone}} and {{salespersonName}} will help.</p><p>— The {{companyName}} team</p>',
  },
  {
    key: "follow_up_3", subject: "One last check-in about the {{vehicleName}}",
    body: '<p>Hi {{customerName}},</p><p>We don\'t want to fill your inbox, so this is our last note about the <strong>{{vehicleName}}</strong>. Popular cars like this one don\'t stay on the lot for long.</p><p><a href="{{bookingUrl}}">Book a visit</a></p><p>If you\'ve found something else, congratulations! We\'re always here at {{dealershipAddress}} when you need us.</p><p>— {{salespersonName}}, {{companyName}}</p>',
  },
  {
    key: "booking_confirmation", subject: "You're booked: {{vehicleName}} at {{dealershipName}}",
    body: '<p>Hi {{customerName}},</p><p>Your visit to see the <strong>{{vehicleName}}</strong> is confirmed.</p><p><strong>{{appointmentTime}}</strong></p><p>{{salespersonName}} will meet you at {{dealershipAddress}}. Bring your driver\'s licence for the test drive.</p><p>Plans changed? Call {{dealershipPhone}} and we\'ll find another time.</p><p>— The {{companyName}} team</p>',
  },
  {
    key: "appointment_reminder", subject: "See you tomorrow: {{vehicleName}}",
    body: '<p>Hi {{customerName}},</p><p>A quick reminder about your visit to see the <strong>{{vehicleName}}</strong>.</p><p><strong>{{appointmentTime}}</strong></p><p>We\'re at {{dealershipAddress}}. {{salespersonName}} will have the car ready. Need to reschedule? Call {{dealershipPhone}}.</p><p>— The {{companyName}} team</p>',
  },
  {
    key: "new_lead", subject: "New lead: {{customerName}} — {{vehicleName}}",
    body: '<p>Hi {{salespersonName}},</p><p><strong>{{customerName}}</strong> just asked about the {{vehicleName}} ({{stockNo}}) at {{dealershipName}}. They\'ve already received a thank-you email with a booking link.</p><p>{{customerMessage}}</p><p>Reach out within the hour — fast replies win the sale.</p><p><a href="{{leadUrl}}">Open the lead</a></p>',
  },
  {
    key: "status_change", subject: "{{stockNo}} is now {{statusLabel}}",
    body: '<p>The <strong>{{vehicleName}}</strong> ({{stockNo}}) at {{dealershipName}} changed status.</p><p><strong>{{previousStatusLabel}} → {{statusLabel}}</strong></p><p>Updated by {{changedByName}}.</p><p><a href="{{vehicleUrl}}">Open the vehicle</a></p>',
  },
];
