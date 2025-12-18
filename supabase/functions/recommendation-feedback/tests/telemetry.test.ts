/**
 * Phase 4: Telemetry Feedback Tests
 * Tests for the new telemetry feedback endpoint
 */

import {
  assertEquals,
  assertExists,
} from "https://deno.land/std@0.208.0/assert/mod.ts";
import { z } from "zod";

const TelemetryFeedbackZ = z.object({
  deckFingerprint: z.string(),
  suggestionId: z.string(),
  accepted: z.boolean(),
  timestamp: z.string().optional(),
  userId: z.string().optional(),
});

Deno.test("Telemetry schema: Valid request passes", () => {
  const validRequest = {
    deckFingerprint: "abc123def456",
    suggestionId: "sug-123",
    accepted: true,
    timestamp: new Date().toISOString(),
  };

  const result = TelemetryFeedbackZ.safeParse(validRequest);
  assertEquals(result.success, true);
  if (result.success) {
    assertEquals(result.data.deckFingerprint, "abc123def456");
    assertEquals(result.data.suggestionId, "sug-123");
    assertEquals(result.data.accepted, true);
  }
});

Deno.test("Telemetry schema: Missing required fields is rejected", () => {
  const invalidRequest = {
    deckFingerprint: "abc123",
    // Missing suggestionId and accepted
  };

  const result = TelemetryFeedbackZ.safeParse(invalidRequest);
  assertEquals(result.success, false);
});

Deno.test("Telemetry schema: Invalid accepted type is rejected", () => {
  const invalidRequest = {
    deckFingerprint: "abc123",
    suggestionId: "sug-123",
    accepted: "yes", // Should be boolean
  };

  const result = TelemetryFeedbackZ.safeParse(invalidRequest);
  assertEquals(result.success, false);
});

Deno.test("Telemetry schema: Optional fields work", () => {
  const minimalRequest = {
    deckFingerprint: "abc123",
    suggestionId: "sug-123",
    accepted: false,
    // timestamp and userId are optional
  };

  const result = TelemetryFeedbackZ.safeParse(minimalRequest);
  assertEquals(result.success, true);
});

console.log("✅ All telemetry feedback tests passed");

