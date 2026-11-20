import {
  FEEDBACK_RATE_LIMIT,
  normalizeDeckFormat,
  redactRoute,
  screenshotErrorMessage,
  validateFeedbackFields,
  isSha256Hex,
  type FeedbackCategory,
  type FeedbackFormState,
} from "@/lib/help/feedback";
import { ScreenshotReject, stripImageMetadata, type StrippedScreenshot } from "@/lib/help/strip-image";

export type FeedbackSubmission = {
  category: string;
  message: string;
  includeDiagnostics: boolean;
  route: string;
  deckFormat: string;
  deckIdHash: string;
  screenshot: Uint8Array | null;
};

export type FeedbackMail = {
  ticketId: string;
  category: FeedbackCategory;
  message: string;
  fromEmail: string | null;
  route: string | null;
  buildId: string | null;
  deckFormat: string | null;
  deckIdHash: string | null;
  screenshotUrl: string | null;
};

export type FeedbackPorts = {
  getUser: () => Promise<{ id: string; email: string | null } | null>;
  countRecent: (userId: string) => Promise<number>;
  insert: (row: {
    userId: string;
    category: FeedbackCategory;
    message: string;
    includeDiagnostics: boolean;
    route: string | null;
    buildId: string | null;
    deckFormat: "TCG" | "Master Duel" | null;
    deckIdHash: string | null;
  }) => Promise<{ id: string }>;
  upload: (path: string, file: StrippedScreenshot) => Promise<void>;
  attachScreenshot: (id: string, path: string) => Promise<void>;
  deleteReport: (id: string) => Promise<void>;
  signScreenshot: (path: string) => Promise<string | null>;
  notify: (mail: FeedbackMail) => Promise<void>;
  /** False when the private bucket cannot be written. Text reports still save. */
  screenshotStorageReady: boolean;
  buildId: string | null;
};

/**
 * Validate, store, then notify. The signed screenshot URL is only for the
 * operator email. A mail failure still leaves the ticket saved.
 */
export async function submitFeedback(
  input: FeedbackSubmission,
  ports: FeedbackPorts,
): Promise<FeedbackFormState> {
  const user = await ports.getUser();
  if (!user) {
    return { success: false, error: "Sign in to send a report." };
  }

  const fieldErrors = validateFeedbackFields(input);
  if (fieldErrors) return { success: false, fieldErrors };

  let screenshot: StrippedScreenshot | null = null;
  if (input.screenshot && input.screenshot.byteLength > 0) {
    try {
      screenshot = stripImageMetadata(input.screenshot);
    } catch (error) {
      const message =
        error instanceof ScreenshotReject
          ? error.messageText
          : screenshotErrorMessage("type");
      return { success: false, fieldErrors: { screenshot: message } };
    }
    if (!ports.screenshotStorageReady) {
      return {
        success: false,
        fieldErrors: { screenshot: screenshotErrorMessage("upload") },
      };
    }
  }

  const recent = await ports.countRecent(user.id);
  if (recent >= FEEDBACK_RATE_LIMIT) {
    return {
      success: false,
      error: "You can send 5 reports an hour. Try again later.",
    };
  }

  const diagnostics = input.includeDiagnostics
    ? {
        route: redactRoute(input.route) || null,
        buildId: ports.buildId,
        deckFormat: normalizeDeckFormat(input.deckFormat),
        deckIdHash: isSha256Hex(input.deckIdHash) ? input.deckIdHash : null,
      }
    : { route: null, buildId: null, deckFormat: null, deckIdHash: null };

  const category = input.category as FeedbackCategory;
  let created: { id: string };
  try {
    created = await ports.insert({
      userId: user.id,
      category,
      message: input.message.trim(),
      includeDiagnostics: input.includeDiagnostics,
      ...diagnostics,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "";
    if (message.includes("feedback_rate_limited")) {
      return {
        success: false,
        error: "You can send 5 reports an hour. Try again later.",
      };
    }
    return { success: false, error: "The report could not be sent. Try again." };
  }

  let screenshotUrl: string | null = null;
  if (screenshot) {
    const path = `${user.id}/${created.id}.${screenshot.extension}`;
    try {
      await ports.upload(path, screenshot);
      await ports.attachScreenshot(created.id, path);
      screenshotUrl = await ports.signScreenshot(path);
    } catch {
      await ports.deleteReport(created.id).catch(() => undefined);
      return {
        success: false,
        fieldErrors: { screenshot: screenshotErrorMessage("upload") },
      };
    }
  }

  try {
    await ports.notify({
      ticketId: created.id,
      category,
      message: input.message.trim(),
      fromEmail: user.email,
      route: diagnostics.route,
      buildId: diagnostics.buildId,
      deckFormat: diagnostics.deckFormat,
      deckIdHash: diagnostics.deckIdHash,
      screenshotUrl,
    });
  } catch (error) {
    console.error("Feedback ticket saved but the notification email failed.", error);
  }

  return { success: true, ticketId: created.id };
}
