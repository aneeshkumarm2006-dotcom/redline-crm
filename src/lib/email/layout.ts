import { readableForeground } from "@/lib/color";

/** Settings-driven branding for every email (the same `Settings.brand` the app uses). */
export type EmailBrand = { companyName: string; primaryColor: string; logoUrl: string | null };
export type EmailFrame = { brand: EmailBrand; subject: string; preheader?: string; footer?: string };

// Marks a finished document so a second pass (e.g. an Email log preview) never wraps it twice.
const MARK = "<!-- redline-email -->";
export const isBrandedEmail = (html: string) => html.includes(MARK);

const FONT = "'Plus Jakarta Sans', 'Segoe UI', Helvetica, Arial, sans-serif";
const DISPLAY = "'Sora', 'Segoe UI', Helvetica, Arial, sans-serif";
const INK = "#0A0F1C";
const TEXT = "#2B3446";
const MUTED = "#5A6478";
const CANVAS = "#F4F6FA";

function escapeHtml(value: string) {
  return value.replace(/[&<>"']/g, (character) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[character]!);
}

/**
 * Inline styles for the small HTML vocabulary templates use (p, strong, a, ul/li), since many mail clients drop
 * <style>. A paragraph holding only bold text becomes a highlighted detail box (appointment times); links become
 * buttons in the brand colour. Templates are trusted HTML and substituted values are already escaped.
 */
function styleBody(html: string, accent: string) {
  const onAccent = readableForeground(accent);
  return html
    .replace(/<p>\s*<strong>([\s\S]*?)<\/strong>\s*<\/p>/g,
      `<p style="margin:0 0 18px;padding:16px 18px;border-radius:12px;background:${CANVAS};font-family:${DISPLAY};font-size:17px;line-height:24px;font-weight:700;color:${INK}">$1</p>`)
    .replace(/<p>/g, `<p style="margin:0 0 16px;font-size:15px;line-height:24px;color:${TEXT}">`)
    .replace(/<strong>/g, `<strong style="font-weight:700;color:${INK}">`)
    .replace(/<ul>/g, `<ul style="margin:0 0 16px;padding-left:20px;color:${TEXT}">`)
    .replace(/<li>/g, `<li style="margin:0 0 6px;font-size:15px;line-height:24px">`)
    .replace(/<a\s+href="/g, `<a style="display:inline-block;margin:4px 0;padding:12px 22px;border-radius:10px;background:${accent};color:${onAccent};font-weight:700;font-size:14px;line-height:20px;text-decoration:none" href="`);
}

/** Wraps a rendered template body in the branded, table-based email document. Idempotent. */
export function brandEmail(body: string, { brand, subject, preheader, footer }: EmailFrame) {
  if (isBrandedEmail(body)) return body;
  const accent = /^#[0-9a-f]{6}$/i.test(brand.primaryColor) ? brand.primaryColor : "#D21F3C";
  const name = escapeHtml(brand.companyName);
  const initial = escapeHtml(brand.companyName.trim().charAt(0).toUpperCase() || "•");
  const logo = brand.logoUrl && /^https:\/\//.test(brand.logoUrl)
    ? `<img src="${escapeHtml(brand.logoUrl)}" width="36" height="36" alt="" style="display:block;width:36px;height:36px;border-radius:10px;background:#ffffff;object-fit:contain">`
    : `<div style="width:36px;height:36px;border-radius:10px;background:${accent};color:${readableForeground(accent)};font-family:${DISPLAY};font-size:17px;font-weight:700;line-height:36px;text-align:center">${initial}</div>`;
  const hidden = preheader ? `<div style="display:none;max-height:0;overflow:hidden;opacity:0">${escapeHtml(preheader)}</div>` : "";
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="color-scheme" content="light"><title>${escapeHtml(subject)}</title>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;600;700&amp;family=Sora:wght@600;700&amp;display=swap"></head>
<body style="margin:0;padding:0;background:${CANVAS};-webkit-text-size-adjust:100%">${MARK}${hidden}
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:${CANVAS}"><tr><td align="center" style="padding:32px 16px">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width:600px;font-family:${FONT}">
<tr><td style="background:${INK};border-radius:18px 18px 0 0;padding:20px 28px">
<table role="presentation" cellpadding="0" cellspacing="0" border="0"><tr><td style="padding-right:12px">${logo}</td>
<td style="font-family:${DISPLAY};font-size:17px;font-weight:700;color:#ffffff;letter-spacing:-0.3px">${name}</td></tr></table>
</td></tr>
<tr><td style="background:#ffffff;border:1px solid #E3E7EF;border-top:0;border-radius:0 0 18px 18px;padding:32px 28px 20px">${styleBody(body, accent)}</td></tr>
<tr><td style="padding:20px 12px 0;text-align:center;font-size:12px;line-height:18px;color:${MUTED}">${footer ? `${escapeHtml(footer)}<br>` : ""}${name}</td></tr>
</table></td></tr></table></body></html>`;
}

/** Realistic stand-ins for every placeholder, so template previews read like a real email. */
export const sampleEmailValues: Record<string, string> = {
  companyName: "Clairmount Auto", customerName: "Jordan Taylor", vehicleName: "2022 Jeep Grand Cherokee Limited 4x4", stockNo: "CLA-001",
  dealershipName: "Clairmount Auto — North", dealershipAddress: "100 Demo Avenue, North", dealershipPhone: "+1 416 555 0100",
  salespersonName: "Priya Shah", appointmentTime: "Saturday, October 24, 2026 at 11:00 a.m.", customerMessage: "Is it still available? Could I test drive it on Saturday?",
  price: "$36,995.00", previousPrice: "$38,495.00", statusLabel: "HOLD", previousStatusLabel: "Available", stageLabel: "Appointment",
  previousStageLabel: "Contacted", changedByName: "Demo Owner", bookingUrl: "https://example.com/book/sample", leadUrl: "https://example.com/crm/leads",
  vehicleUrl: "https://example.com/crm/inventory",
};
