import { webcrypto } from "node:crypto";
import { TextEncoder } from "node:util";
import {
  HELP_ANSWERS,
  hashDeckId,
  redactRoute,
  validateFeedbackFields,
} from "@/lib/help/feedback";
import { submitFeedback, type FeedbackPorts } from "@/lib/help/submit-feedback";

describe("help feedback rules", () => {
  beforeAll(() => {
    if (!globalThis.crypto?.subtle) {
      Object.defineProperty(globalThis, "crypto", { value: webcrypto });
    }
    if (typeof globalThis.TextEncoder === "undefined") {
      Object.defineProperty(globalThis, "TextEncoder", { value: TextEncoder });
    }
  });
  it("lists the six locked answers", () => {
    expect(HELP_ANSWERS.map((answer) => answer.title)).toEqual([
      "Where a deck opens",
      "How share import works",
      "Banlist and format",
      "What the Strategist will and will not do",
      "How to resume an unfinished deck",
      "How to send a report",
    ]);
  });

  it("redacts a share token and drops the query string", () => {
    expect(redactRoute("/share/secret-token?deck=1")).toBe("/share/[token]");
  });

  it("asks for a category and a description", () => {
    expect(validateFeedbackFields({ category: "", message: "   " })).toEqual({
      category: "Select a category.",
      message: "Describe what happened.",
    });
  });

  it("hashes a deck id without keeping the id", async () => {
    const hash = await hashDeckId("deck-1");
    expect(hash).toHaveLength(64);
    expect(hash).not.toContain("deck-1");
  });
});

describe("submitFeedback", () => {
  const jpeg = Uint8Array.from([0xff, 0xd8, 0xff, 0xd9]);

  function ports(overrides: Partial<FeedbackPorts> = {}): FeedbackPorts & {
    inserted: unknown[];
    mailed: unknown[];
    deleted: string[];
  } {
    const inserted: unknown[] = [];
    const mailed: unknown[] = [];
    const deleted: string[] = [];
    return {
      inserted,
      mailed,
      deleted,
      buildId: "abc123",
      screenshotStorageReady: true,
      getUser: async () => ({ id: "user-1", email: "duelist@example.com" }),
      countRecent: async () => 0,
      insert: async (row) => {
        inserted.push(row);
        return { id: "ticket-1" };
      },
      upload: async () => undefined,
      attachScreenshot: async () => undefined,
      deleteReport: async (id) => {
        deleted.push(id);
      },
      signScreenshot: async () => "https://example.test/signed",
      notify: async (mail) => {
        mailed.push(mail);
      },
      ...overrides,
    };
  }

  it("refuses a signed-out report", async () => {
    const result = await submitFeedback(draft(), ports({ getUser: async () => null }));
    expect(result).toEqual({ success: false, error: "Sign in to send a report." });
  });

  it("stops at five reports in the hour", async () => {
    const gate = ports({ countRecent: async () => 5 });
    const result = await submitFeedback(draft(), gate);
    expect(result.success).toBe(false);
    expect(gate.inserted).toHaveLength(0);
  });

  it("stores diagnostics and does not return the screenshot link", async () => {
    const gate = ports();
    const result = await submitFeedback(
      draft({
        route: "/share/secret-token",
        deckFormat: "Master Duel",
        deckIdHash: "a".repeat(64),
        screenshot: jpeg,
      }),
      gate,
    );
    expect(result).toEqual({ success: true, ticketId: "ticket-1" });
    expect(gate.inserted[0]).toMatchObject({
      route: "/share/[token]",
      buildId: "abc123",
      deckFormat: "Master Duel",
      deckIdHash: "a".repeat(64),
    });
    expect(JSON.stringify(result)).not.toContain("signed");
    expect(gate.mailed[0]).toMatchObject({ screenshotUrl: "https://example.test/signed" });
  });

  it("omits diagnostics when the switch is off", async () => {
    const gate = ports();
    await submitFeedback(
      draft({
        includeDiagnostics: false,
        route: "/workshop",
        deckFormat: "TCG",
        deckIdHash: "b".repeat(64),
      }),
      gate,
    );
    expect(gate.inserted[0]).toMatchObject({
      includeDiagnostics: false,
      route: null,
      buildId: null,
      deckFormat: null,
      deckIdHash: null,
    });
  });

  it("keeps the ticket when the notification email fails", async () => {
    const result = await submitFeedback(
      draft(),
      ports({
        notify: async () => {
          throw new Error("resend down");
        },
      }),
    );
    expect(result).toEqual({ success: true, ticketId: "ticket-1" });
  });

  it("deletes the ticket when the screenshot upload fails", async () => {
    const gate = ports({
      upload: async () => {
        throw new Error("storage down");
      },
    });
    const result = await submitFeedback(draft({ screenshot: jpeg }), gate);
    expect(result).toEqual({
      success: false,
      fieldErrors: { screenshot: "The selected file could not be uploaded – try again." },
    });
    expect(gate.deleted).toEqual(["ticket-1"]);
  });

  it("rejects a non-image before insert", async () => {
    const gate = ports();
    const result = await submitFeedback(draft({ screenshot: Uint8Array.from([1, 2, 3]) }), gate);
    expect(result.success).toBe(false);
    expect(gate.inserted).toHaveLength(0);
  });
});

function draft(overrides: Record<string, unknown> = {}) {
  return {
    category: "bug",
    message: "The grade plate overlaps the deck name.",
    includeDiagnostics: true,
    route: "/workshop",
    deckFormat: "Master Duel",
    deckIdHash: "a".repeat(64),
    screenshot: null,
    ...overrides,
  };
}
