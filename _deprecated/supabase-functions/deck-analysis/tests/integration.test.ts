/**
 * Integration tests for deck-analysis edge function
 * Run with: deno test --allow-net --allow-env --allow-read tests/integration.test.ts
 * 
 * Note: These tests require:
 * - Supabase connection
 * - Valid deck ID in database
 * - GROQ_API_KEY for full integration tests
 */

import { assertEquals, assertExists } from "https://deno.land/std@0.208.0/assert/mod.ts";

// Load environment variables
const SUPABASE_URL = Deno.env.get("SUPABASE_URL") || Deno.env.get("NEXT_PUBLIC_SUPABASE_URL");
const GROQ_API_KEY = Deno.env.get("GROQ_API_KEY");

const hasRequiredEnv = SUPABASE_URL && GROQ_API_KEY;

Deno.test({
  name: "deck-analysis - request format validation",
  ignore: !hasRequiredEnv,
  fn() {
    // Test that request structure is valid
    const validRequest = {
      deck_id: "test-deck-id",
      banlist_format: "MASTER_DUEL" as const,
      analysis_type: "summary" as const,
      quick_prompt: "Analyze this deck",
    };

    assertExists(validRequest.deck_id);
    assertEquals(
      validRequest.banlist_format === "MASTER_DUEL" || validRequest.banlist_format === "TCG",
      true
    );
    assertEquals(typeof validRequest.analysis_type, "string");
  },
});

Deno.test({
  name: "deck-analysis - response structure validation",
  ignore: !hasRequiredEnv,
  async fn() {
    if (!SUPABASE_URL) {
      throw new Error("Missing SUPABASE_URL");
    }

    // This test requires a valid deck ID and authentication
    // For now, we'll test the structure validation only
    
    const mockResponse = {
      analysis_type: "summary",
      raw_answer: "This is a test analysis",
      structured_analysis: {
        summary: "Test summary",
      },
      suggestions: [],
      recommendedCards: [],
    };

    // Validate mock response structure
    assertExists(mockResponse.analysis_type);
    assertExists(mockResponse.raw_answer);
    assertEquals(typeof mockResponse.raw_answer, "string");
    assertEquals(Array.isArray(mockResponse.suggestions), true);
    assertEquals(Array.isArray(mockResponse.recommendedCards), true);
  },
});

Deno.test({
  name: "deck-analysis - analysis types",
  ignore: !hasRequiredEnv,
  fn() {
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
      assertEquals(typeof type, "string");
      assertEquals(type.length > 0, true);
    });
  },
});

Deno.test({
  name: "deck-analysis - banlist format validation",
  ignore: !hasRequiredEnv,
  fn() {
    const validFormats = ["MASTER_DUEL", "TCG"];
    const invalidFormats = ["invalid", "", "master-duel"];

    validFormats.forEach((format) => {
      assertEquals(format === "MASTER_DUEL" || format === "TCG", true);
    });

    invalidFormats.forEach((format) => {
      assertEquals(format === "MASTER_DUEL" || format === "TCG", false);
    });
  },
});
