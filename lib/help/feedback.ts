/** Phase 2c help hub: copy, field rules, and route redaction. */

export const FEEDBACK_RATE_LIMIT = 5;
export const FEEDBACK_MESSAGE_MAX = 2000;
export const SCREENSHOT_MAX_BYTES = 2 * 1024 * 1024;

export const FEEDBACK_CATEGORIES = [
  { value: "bug", label: "Bug" },
  { value: "suggestion", label: "Suggestion" },
  { value: "other", label: "Something else" },
] as const;

export type FeedbackCategory = (typeof FEEDBACK_CATEGORIES)[number]["value"];

export const HELP_ANSWERS = [
  {
    id: "open",
    title: "Where a deck opens",
    body: "Archives is home. Choose a deck there. The Workshop opens on that deck's last board.",
  },
  {
    id: "share",
    title: "How share import works",
    body: "Open the share link to preview the list. Import copies it into the Workshop so you can edit your own copy.",
  },
  {
    id: "format",
    title: "Banlist and format",
    body: "Each deck uses one format, TCG or Master Duel. Copy limits and the banlist follow that format. On Master Duel, the list includes Maxx \"C\".",
  },
  {
    id: "strategist",
    title: "What the Strategist will and will not do",
    body: "The Strategist reads the deck you have open and can suggest cuts, adds, and ratio changes you apply yourself. It does not invent card names, and it is not a general chat.",
  },
  {
    id: "resume",
    title: "How to resume an unfinished deck",
    body: "Unfinished decks stay on Archives. Open one to continue the last board. The landing page does not resume a deck.",
  },
  {
    id: "report",
    title: "How to send a report",
    body: "Open Help from the avatar menu and choose Report. Pick Bug, Suggestion, or Something else, then describe what happened. A screenshot is optional.",
  },
] as const;

export type FeedbackField = "category" | "message" | "screenshot";

export type FeedbackFieldErrors = Partial<Record<FeedbackField, string>>;

export type FeedbackFormState = {
  success: boolean;
  ticketId?: string;
  error?: string;
  fieldErrors?: FeedbackFieldErrors;
};

export const FEEDBACK_INITIAL_STATE: FeedbackFormState = { success: false };

const SHA256_HEX = /^[0-9a-f]{64}$/;

/**
 * Drop query strings and share tokens so a report cannot carry a secret link.
 */
export function redactRoute(pathname: string): string {
  const path = pathname.split("?")[0]?.split("#")[0] ?? "";
  return path.replace(/\/share\/[^/]+/g, "/share/[token]").slice(0, 200);
}

export function isSha256Hex(value: string): boolean {
  return SHA256_HEX.test(value);
}

export function normalizeDeckFormat(value: string): "TCG" | "Master Duel" | null {
  if (value === "TCG" || value === "Master Duel") return value;
  return null;
}

/**
 * Closed-ended category first, then the message. Screenshot rules are separate.
 * Returns null when the text fields are acceptable.
 */
export function validateFeedbackFields(input: {
  category: string;
  message: string;
}): FeedbackFieldErrors | null {
  const fieldErrors: FeedbackFieldErrors = {};
  if (
    input.category !== "bug" &&
    input.category !== "suggestion" &&
    input.category !== "other"
  ) {
    fieldErrors.category = "Select a category.";
  }
  const message = input.message.trim();
  if (!message) {
    fieldErrors.message = "Describe what happened.";
  } else if (message.length > FEEDBACK_MESSAGE_MAX) {
    fieldErrors.message = "The message must be 2,000 characters or fewer.";
  }
  return Object.keys(fieldErrors).length > 0 ? fieldErrors : null;
}

export function screenshotErrorMessage(
  kind: "empty" | "type" | "too-big" | "upload",
): string {
  if (kind === "empty") return "The selected file is empty.";
  if (kind === "too-big") return "The selected file must be smaller than 2 MB.";
  if (kind === "upload") return "The selected file could not be uploaded – try again.";
  return "The selected file must be a PNG, JPEG, or WebP.";
}

export async function hashDeckId(id: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", utf8Bytes(id));
  return [...new Uint8Array(digest)]
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

function utf8Bytes(value: string): Uint8Array {
  const bytes: number[] = [];
  for (const char of value) {
    const code = char.codePointAt(0) ?? 0;
    if (code < 0x80) bytes.push(code);
    else if (code < 0x800) bytes.push(0xc0 | (code >> 6), 0x80 | (code & 0x3f));
    else if (code < 0x10000) {
      bytes.push(0xe0 | (code >> 12), 0x80 | ((code >> 6) & 0x3f), 0x80 | (code & 0x3f));
    } else {
      bytes.push(
        0xf0 | (code >> 18),
        0x80 | ((code >> 12) & 0x3f),
        0x80 | ((code >> 6) & 0x3f),
        0x80 | (code & 0x3f),
      );
    }
  }
  return Uint8Array.from(bytes);
}
