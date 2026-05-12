import DOMPurify from "dompurify";

const RICH_TEXT_SANITIZE_CONFIG = {
  ALLOWED_TAGS: [
    "p",
    "br",
    "strong",
    "em",
    "u",
    "s",
    "span",
    "h1",
    "h2",
    "h3",
    "blockquote",
    "ul",
    "ol",
    "li",
    "a",
    "code",
    "pre",
  ],
  ALLOWED_ATTR: ["href", "target", "rel", "class", "style"],
  ALLOW_DATA_ATTR: false,
};

const HTML_TAG_PATTERN = /<[^>]+>/g;
const HTML_DETECTION_PATTERN = /<[a-z][\s\S]*>/i;

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;");
}

export function richTextToEditorValue(value) {
  const raw = String(value ?? "");
  if (!raw.trim()) return "";
  if (HTML_DETECTION_PATTERN.test(raw)) {
    return sanitizeRichText(raw);
  }
  const escaped = escapeHtml(raw).replace(/\r?\n/g, "<br>");
  return `<p>${escaped}</p>`;
}

export function sanitizeRichText(value) {
  const raw = String(value ?? "");
  if (!raw.trim()) return "";
  const sanitized = DOMPurify.sanitize(raw, RICH_TEXT_SANITIZE_CONFIG);
  return sanitized.trim();
}

export function richTextToPlainText(value) {
  const sanitized = sanitizeRichText(value);
  if (!sanitized) return "";

  if (typeof document !== "undefined") {
    const container = document.createElement("div");
    container.innerHTML = sanitized;
    return String(container.textContent || container.innerText || "")
      .replace(/\u00a0/g, " ")
      .trim();
  }

  return sanitized
    .replace(HTML_TAG_PATTERN, " ")
    .replace(/&nbsp;/gi, " ")
    .trim();
}

export function normalizeRichText(value) {
  const sanitized = sanitizeRichText(value);
  if (!richTextToPlainText(sanitized)) return "";
  return sanitized;
}
