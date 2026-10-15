export type EmailTemplate = { subject: string; body: string };
export type TemplateValues = Record<string, string | number>;

function escapeHtml(value: string) {
  return value.replace(/[&<>"']/g, (character) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
  })[character]!);
}

/** Templates are trusted HTML; substituted customer values are escaped by default. */
export function renderTemplate(template: string, values: TemplateValues, html = true) {
  return template.replace(/{{\s*([a-zA-Z_][a-zA-Z0-9_]*)\s*}}/g, (_, key: string) => {
    if (!Object.hasOwn(values, key)) throw new Error(`Missing email placeholder: ${key}`);
    const value = String(values[key]);
    return html ? escapeHtml(value) : value;
  });
}

export function renderEmailTemplate(template: EmailTemplate, values: TemplateValues) {
  const subject = renderTemplate(template.subject, values, false);
  if (/[\r\n]/.test(subject)) throw new Error("Email subject must be a single line.");
  return { subject, html: renderTemplate(template.body, values) };
}
