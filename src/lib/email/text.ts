/** Pure text helpers for conversational email (inbound replies and the virtual assistant's answers). */

const entities: Record<string, string> = { amp: "&", lt: "<", gt: ">", quot: '"', "#39": "'", apos: "'", nbsp: " " };

/** Readable plain text from an HTML email: block tags become line breaks, scripts/styles and tags are dropped. */
export function htmlToText(html: string) {
  return html
    .replace(/<(script|style|head|title)[\s\S]*?<\/\1>/gi, "")
    .replace(/<!--[\s\S]*?-->/g, "")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/(p|div|li|tr|h[1-6]|table|blockquote)>/gi, "\n")
    .replace(/<li[^>]*>/gi, "• ")
    .replace(/<[^>]+>/g, "")
    .replace(/&(#\d+|#x[0-9a-f]+|[a-z]+\d*);/gi, (match, code: string) => {
      if (code.startsWith("#x")) return String.fromCodePoint(Number.parseInt(code.slice(2), 16));
      if (code.startsWith("#") && code !== "#39") return String.fromCodePoint(Number(code.slice(1)));
      return entities[code.toLowerCase()] ?? match;
    })
    .replace(/[ \t ]+/g, " ")
    .replace(/ *\n */g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

// Lines that start the quoted history in common mail clients (Gmail, Apple Mail, Outlook, mobile apps).
const quoteHeaders = [
  /^On .{4,200}(wrote|écrit|schrieb|escribió):?\s*$/i,
  /^Le .{4,200}a écrit\s*:?\s*$/i,
  /^-{2,}\s*(Original Message|Forwarded message|Message d'origine)\s*-{2,}/i,
  /^_{10,}\s*$/,
  /^From:\s.+/i,
  /^Sent from my (iPhone|iPad|Android|Samsung|mobile)/i,
  /^Get Outlook for /i,
];

/**
 * The new part of a reply: everything above the quoted history (">" lines, "On … wrote:", Outlook headers).
 * Falls back to the whole text when stripping would leave nothing (e.g. a reply typed below the quote).
 */
export function stripQuotedReply(text: string) {
  const lines = text.replace(/\r\n?/g, "\n").split("\n");
  const kept: string[] = [];
  for (let index = 0; index < lines.length; index++) {
    const line = lines[index].trim();
    // Gmail wraps long "On … wrote:" headers over two lines.
    const joined = index + 1 < lines.length ? `${line} ${lines[index + 1].trim()}` : line;
    if (quoteHeaders.some((pattern) => pattern.test(line)) || /^On .{4,200}wrote:?\s*$/i.test(joined) || line.startsWith(">")) break;
    kept.push(lines[index]);
  }
  const result = kept.join("\n").trim();
  return result || text.trim();
}

/** Headers that mark a machine-sent message: auto-replies, out-of-office, bounces, mailing lists. */
export function isAutomatedEmail(input: { from: string; subject: string; headers: Record<string, string> }) {
  const header = (name: string) => input.headers[name.toLowerCase()]?.toLowerCase() ?? "";
  const auto = header("auto-submitted");
  if (auto && auto !== "no") return "Automatic reply";
  if (header("x-autoreply") || header("x-autorespond") || header("x-auto-response-suppress").includes("all")) return "Automatic reply";
  if (/^(bulk|junk|list|auto_reply)$/.test(header("precedence"))) return "Bulk or automatic message";
  if (header("list-id") || header("list-unsubscribe")) return "Mailing list message";
  const local = input.from.split("@")[0]?.toLowerCase() ?? "";
  if (/^(mailer-daemon|postmaster|no-?reply|do-?not-?reply|bounce[s]?)$/.test(local)) return "Delivery notice or no-reply sender";
  if (/^(automatic reply|auto(matic)?[- ]?reply|out of (the )?office|ooo\b|absence|réponse automatique|abwesenheit|undeliver|delivery status notification|mail delivery failed)/i.test(input.subject.trim())) {
    return "Automatic reply";
  }
  return null;
}

/** "Re: <subject>", without stacking prefixes. */
export function replySubject(subject: string) {
  const base = subject.replace(/^\s*((re|fw|fwd|aw|tr)\s*:\s*)+/i, "").trim() || "Your inquiry";
  return `Re: ${base}`.replace(/[\r\n]+/g, " ").slice(0, 280);
}

/** Message-IDs as `<id@host>` tokens (from a header value or a list); malformed values are dropped. */
export function messageIds(value: string | string[] | null | undefined) {
  const text = Array.isArray(value) ? value.join(" ") : value ?? "";
  return [...new Set(text.match(/<[^<>\s]+>/g) ?? [])].slice(-30);
}

function escapeHtml(value: string) {
  return value.replace(/[&<>"']/g, (character) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[character]!);
}

/** Plain conversational text as escaped HTML paragraphs; bare https links become anchors. */
export function textToHtml(text: string) {
  return text.trim().split(/\n{2,}/).map((paragraph) => {
    const html = escapeHtml(paragraph).replace(/https:\/\/[^\s<>"']+[^\s<>"'.,;:!?)]/g, (url) => `<a href="${url}">${url}</a>`).replace(/\n/g, "<br>");
    return `<p>${html}</p>`;
  }).join("\n");
}
