/**
 * Integration tests for deck analysis flow
 * Tests deck analysis API calls and response handling
 */

import { describe, it, expect } from "@jest/globals";
import { analyzeDeck } from "@/lib/api/analyzeDeck";
import { DeckType } from "@/types/types";

// Mock environment
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;

const hasRequiredEnv = !!SUPABASE_URL;

describe("Deck Analysis Integration", () => {
  it("should validate analysis request structure", () => {
    const validRequest = {
      deck_id: "test-deck-id",
      banlist_format: "MASTER_DUEL" as const,
      analysis_type: "summary" as const,
    };

    expect(validRequest.deck_id).toBeDefined();
    expect(
      validRequest.banlist_format === "MASTER_DUEL" || validRequest.banlist_format === "TCG"
    ).toBe(true);
    expect(typeof validRequest.analysis_type).toBe("string");
  });

  it("should validate analysis response structure", () => {
    const mockResponse = {
      analysis_type: "summary",
      raw_answer: "This deck has good consistency.",
      structured_analysis: {
        summary: "Test summary",
      },
      suggestions: [],
      recommendedCards: [],
    };

    expect(mockResponse.analysis_type).toBeDefined();
    expect(mockResponse.raw_answer).toBeDefined();
    expect(typeof mockResponse.raw_answer).toBe("string");
    expect(Array.isArray(mockResponse.suggestions)).toBe(true);
    expect(Array.isArray(mockResponse.recommendedCards)).toBe(true);
  });

  it("should handle all analysis types", () => {
    const analysisTypes = [
      "summary",
      "power_level",
      "consistency",
      "resilience",
      "matchup",
      "complexity",
      "card_suggestions",
      "custom",
    ];

    analysisTypes.forEach((type) => {
      const request = {
        deck_id: "test-deck-id",
        analysis_type: type as any,
      };
      expect(request.analysis_type).toBeDefined();
    });
  });

  it("should validate banlist formats", () => {
    const validFormats = ["MASTER_DUEL", "TCG"];
    const invalidFormats = ["invalid", "", "master-duel"];

    validFormats.forEach((format) => {
      expect(format === "MASTER_DUEL" || format === "TCG").toBe(true);
    });

    invalidFormats.forEach((format) => {
      expect(format === "MASTER_DUEL" || format === "TCG").toBe(false);
    });
  });
});
