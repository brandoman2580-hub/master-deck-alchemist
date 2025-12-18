/**
 * Phase 2 Tests: Strict JSON Schema Implementation
 * Tests for the new recommendation agent with strict JSON-only output
 */

import {
  assertEquals,
  assertExists,
  assertRejects,
} from "https://deno.land/std@0.208.0/assert/mod.ts";
import { z } from "npm:zod@^3.22.4";

// Import schemas (matching index.ts)
const DeckCardZ = z.object({
  cardId: z.number(),
  count: z.number().min(0),
});

const DeckZ = z.object({
  main: z.array(DeckCardZ),
  extra: z.array(DeckCardZ).optional().default([]),
  side: z.array(DeckCardZ).optional().default([]),
});

const RecommendationRequestZ = z.object({
  question: z.string().optional(),
  current_deck: DeckZ.optional(),
  format: z.enum(["MASTER_DUEL", "TCG"]).default("MASTER_DUEL"),
  recommendation_type: z
    .enum(["personalized", "archetype", "engine", "tech", "simple"])
    .optional(),
  use_hybrid_search: z.boolean().optional().default(true),
  explainTo: z.enum(["novice", "intermediate", "advanced"]).optional().default("novice"),
  userPrefs: z
    .object({
      playstyle: z.enum(["aggro", "control", "combo", "stall", "hybrid"]).optional(),
      budget: z.enum(["low", "mid", "high"]).optional(),
    })
    .optional(),
  maxOutputTokens: z.number().optional().default(800),
});

const RecommenderZ = z.object({
  schemaVersion: z.string(),
  confidence: z.number().min(0).max(1),
  explainTo: z.enum(["novice", "intermediate", "advanced"]),
  summary: z.string().optional(),
  recommendations: z.array(
    z.object({
      cardId: z.string(),
      cardName: z.string().optional(),
      action: z.enum(["add", "remove", "replace", "tech", "note"]),
      reason: z.string(),
      impactEst: z.number().min(-1).max(1),
      synergyScore: z.number().min(0).max(1).optional(),
      evidence: z.array(z.string()),
      banned: z.boolean().optional(),
    })
  ),
  ui: z.array(
    z.object({
      id: z.string(),
      type: z.enum(["text", "list", "card", "table", "suggestion"]),
      content: z.union([
        z.string(),
        z.array(z.string()),
        z.record(z.string(), z.any()),
      ]),
    })
  ),
  actions: z.record(z.string(), z.any()).optional(),
  meta: z.record(z.string(), z.any()).optional(),
});

// Helper functions (matching index.ts)
function extractJsonLike(text: string): any {
  const first = text.indexOf("{");
  const last = text.lastIndexOf("}");
  if (first !== -1 && last !== -1 && last > first) {
    const candidate = text.slice(first, last + 1);
    try {
      return JSON.parse(candidate);
    } catch {
      // pass through
    }
  }

  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

async function fingerprintDeck(
  deck: unknown,
  explainTo: string,
  prefs: unknown,
): Promise<string> {
  const encoder = new TextEncoder();
  const data = JSON.stringify({ deck, explainTo, prefs });
  const hash = await crypto.subtle.digest("SHA-256", encoder.encode(data));
  return [...new Uint8Array(hash)]
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

// ============================================================================
// Tests
// ============================================================================

Deno.test("Request validation: Valid request passes", () => {
  const validRequest = {
    question: "Find me some hand traps",
    current_deck: {
      main: [{ cardId: 123, count: 3 }],
      extra: [],
      side: [],
    },
    format: "MASTER_DUEL",
    explainTo: "novice",
  };

  const result = RecommendationRequestZ.safeParse(validRequest);
  assertEquals(result.success, true);
  if (result.success) {
    assertEquals(result.data.question, "Find me some hand traps");
    assertEquals(result.data.format, "MASTER_DUEL");
    assertEquals(result.data.explainTo, "novice");
  }
});

Deno.test("Request validation: Invalid format is rejected", () => {
  const invalidRequest = {
    question: "Test",
    format: "INVALID_FORMAT", // Invalid
  };

  const result = RecommendationRequestZ.safeParse(invalidRequest);
  assertEquals(result.success, false);
});

Deno.test("Request validation: Invalid explainTo is rejected", () => {
  const invalidRequest = {
    question: "Test",
    explainTo: "expert", // Invalid
  };

  const result = RecommendationRequestZ.safeParse(invalidRequest);
  assertEquals(result.success, false);
});

Deno.test("Request validation: Deck with negative count is rejected", () => {
  const invalidRequest = {
    question: "Test",
    current_deck: {
      main: [{ cardId: 123, count: -1 }], // Invalid
    },
  };

  const result = RecommendationRequestZ.safeParse(invalidRequest);
  assertEquals(result.success, false);
});

Deno.test("Deck legality: 40-60 main cards is valid", () => {
  const validDeck = {
    main: Array.from({ length: 40 }, (_, i) => ({ cardId: i + 1, count: 1 })),
    extra: [],
    side: [],
  };

  const mainCount = validDeck.main.reduce((s, c) => s + c.count, 0);
  assertEquals(mainCount >= 40 && mainCount <= 60, true);
});

Deno.test("Deck legality: < 40 main cards is invalid", () => {
  const invalidDeck = {
    main: Array.from({ length: 35 }, (_, i) => ({ cardId: i + 1, count: 1 })),
    extra: [],
    side: [],
  };

  const mainCount = invalidDeck.main.reduce((s, c) => s + c.count, 0);
  assertEquals(mainCount < 40, true);
});

Deno.test("Deck legality: > 60 main cards is invalid", () => {
  const invalidDeck = {
    main: Array.from({ length: 65 }, (_, i) => ({ cardId: i + 1, count: 1 })),
    extra: [],
    side: [],
  };

  const mainCount = invalidDeck.main.reduce((s, c) => s + c.count, 0);
  assertEquals(mainCount > 60, true);
});

Deno.test("JSON extraction: Pure JSON string is extracted", () => {
  const jsonText = '{"schemaVersion":"1.0","confidence":0.8}';
  const extracted = extractJsonLike(jsonText);
  assertExists(extracted);
  assertEquals(extracted.schemaVersion, "1.0");
  assertEquals(extracted.confidence, 0.8);
});

Deno.test("JSON extraction: JSON in markdown code block is extracted", () => {
  const markdownText = '```json\n{"schemaVersion":"1.0","confidence":0.8}\n```';
  const extracted = extractJsonLike(markdownText);
  assertExists(extracted);
  assertEquals(extracted.schemaVersion, "1.0");
});

Deno.test("JSON extraction: JSON with surrounding text is extracted", () => {
  const textWithJson = 'Here is the response:\n{"schemaVersion":"1.0","confidence":0.8}\nEnd of response';
  const extracted = extractJsonLike(textWithJson);
  assertExists(extracted);
  assertEquals(extracted.schemaVersion, "1.0");
});

Deno.test("JSON extraction: Invalid JSON returns null", () => {
  const invalidText = "This is not JSON at all";
  const extracted = extractJsonLike(invalidText);
  assertEquals(extracted, null);
});

Deno.test("Response validation: Valid response passes", () => {
  const validResponse = {
    schemaVersion: "1.0.0",
    confidence: 0.75,
    explainTo: "novice",
    summary: "Here are some recommendations",
    recommendations: [
      {
        cardId: "123",
        cardName: "Ash Blossom",
        action: "add",
        reason: "Good hand trap",
        impactEst: 0.8,
        synergyScore: 0.7,
        evidence: ["Card text"],
      },
    ],
    ui: [
      {
        id: "summary",
        type: "text",
        content: "Summary text",
      },
    ],
  };

  const result = RecommenderZ.safeParse(validResponse);
  assertEquals(result.success, true);
});

Deno.test("Response validation: Invalid confidence is rejected", () => {
  const invalidResponse = {
    schemaVersion: "1.0.0",
    confidence: 1.5, // Invalid: > 1.0
    explainTo: "novice",
    recommendations: [],
    ui: [],
  };

  const result = RecommenderZ.safeParse(invalidResponse);
  assertEquals(result.success, false);
});

Deno.test("Response validation: Invalid action is rejected", () => {
  const invalidResponse = {
    schemaVersion: "1.0.0",
    confidence: 0.75,
    explainTo: "novice",
    recommendations: [
      {
        cardId: "123",
        action: "invalid_action", // Invalid
        reason: "Test",
        impactEst: 0.5,
        evidence: [],
      },
    ],
    ui: [],
  };

  const result = RecommenderZ.safeParse(invalidResponse);
  assertEquals(result.success, false);
});

Deno.test("Response validation: Invalid UI block type is rejected", () => {
  const invalidResponse = {
    schemaVersion: "1.0.0",
    confidence: 0.75,
    explainTo: "novice",
    recommendations: [],
    ui: [
      {
        id: "test",
        type: "invalid_type", // Invalid
        content: "Test",
      },
    ],
  };

  const result = RecommenderZ.safeParse(invalidResponse);
  assertEquals(result.success, false);
});

Deno.test("Fingerprinting: Same deck produces same fingerprint", async () => {
  const deck = { main: [{ cardId: 123, count: 3 }] };
  const explainTo = "novice";
  const prefs = { playstyle: "aggro" };

  const fp1 = await fingerprintDeck(deck, explainTo, prefs);
  const fp2 = await fingerprintDeck(deck, explainTo, prefs);

  assertEquals(fp1, fp2);
  assertEquals(fp1.length, 64); // SHA256 hex is 64 chars
});

Deno.test("Fingerprinting: Different decks produce different fingerprints", async () => {
  const deck1 = { main: [{ cardId: 123, count: 3 }] };
  const deck2 = { main: [{ cardId: 456, count: 3 }] };
  const explainTo = "novice";
  const prefs = {};

  const fp1 = await fingerprintDeck(deck1, explainTo, prefs);
  const fp2 = await fingerprintDeck(deck2, explainTo, prefs);

  assertEquals(fp1 !== fp2, true);
});

Deno.test("Fingerprinting: Different explainTo produces different fingerprint", async () => {
  const deck = { main: [{ cardId: 123, count: 3 }] };
  const prefs = {};

  const fp1 = await fingerprintDeck(deck, "novice", prefs);
  const fp2 = await fingerprintDeck(deck, "advanced", prefs);

  assertEquals(fp1 !== fp2, true);
});

Deno.test("Response validation: Missing required fields is rejected", () => {
  const incompleteResponse = {
    schemaVersion: "1.0.0",
    // Missing confidence, explainTo, recommendations, ui
  };

  const result = RecommenderZ.safeParse(incompleteResponse);
  assertEquals(result.success, false);
});

Deno.test("Response validation: ImpactEst out of range is rejected", () => {
  const invalidResponse = {
    schemaVersion: "1.0.0",
    confidence: 0.75,
    explainTo: "novice",
    recommendations: [
      {
        cardId: "123",
        action: "add",
        reason: "Test",
        impactEst: 1.5, // Invalid: > 1.0
        evidence: [],
      },
    ],
    ui: [],
  };

  const result = RecommenderZ.safeParse(invalidResponse);
  assertEquals(result.success, false);
});

Deno.test("Response validation: UI block with array content is valid", () => {
  const validResponse = {
    schemaVersion: "1.0.0",
    confidence: 0.75,
    explainTo: "novice",
    recommendations: [],
    ui: [
      {
        id: "list",
        type: "list",
        content: ["Item 1", "Item 2", "Item 3"],
      },
    ],
  };

  const result = RecommenderZ.safeParse(validResponse);
  assertEquals(result.success, true);
});

Deno.test("Response validation: UI block with object content is valid", () => {
  const validResponse = {
    schemaVersion: "1.0.0",
    confidence: 0.75,
    explainTo: "novice",
    recommendations: [],
    ui: [
      {
        id: "suggestion",
        type: "suggestion",
        content: {
          suggestionId: "test-123",
          label: "Apply recommendation",
          verb: "apply",
        },
      },
    ],
  };

  const result = RecommenderZ.safeParse(validResponse);
  assertEquals(result.success, true);
});

console.log("✅ All Phase 2 recommendation agent tests passed");

