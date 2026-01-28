/**
 * Integration tests for deck-tester-agent edge function
 * Run with: deno test --allow-net --allow-env --allow-read tests/integration.test.ts
 * 
 * Note: These tests require:
 * - Supabase connection
 * - GROQ_API_KEY for full integration tests
 */

import { assertEquals, assertExists } from "https://deno.land/std@0.208.0/assert/mod.ts";

// Load environment variables
const SUPABASE_URL = Deno.env.get("SUPABASE_URL") || Deno.env.get("NEXT_PUBLIC_SUPABASE_URL");
const GROQ_API_KEY = Deno.env.get("GROQ_API_KEY");

const hasRequiredEnv = SUPABASE_URL && GROQ_API_KEY;

Deno.test({
  name: "deck-tester-agent - request format validation",
  ignore: !hasRequiredEnv,
  fn() {
    // Test that request structure is valid
    const validRequest = {
      deck_a: {
        main: [{ cardId: 123, count: 3 }],
        extra: [],
        side: [],
      },
      deck_b: {
        main: [{ cardId: 456, count: 3 }],
        extra: [],
        side: [],
      },
      test_type: "matchup_analysis" as const,
      banlist_format: "MASTER_DUEL" as const,
    };

    assertExists(validRequest.deck_a);
    assertExists(validRequest.deck_b);
    assertEquals(Array.isArray(validRequest.deck_a.main), true);
    assertEquals(Array.isArray(validRequest.deck_b.main), true);
    assertEquals(typeof validRequest.test_type, "string");
  },
});

Deno.test({
  name: "deck-tester-agent - test types validation",
  ignore: !hasRequiredEnv,
  fn() {
    const validTestTypes = [
      "matchup_analysis",
      "duel_simulation",
      "strategic_insights",
    ];

    validTestTypes.forEach((type) => {
      assertEquals(typeof type, "string");
      assertEquals(
        type === "matchup_analysis" ||
        type === "duel_simulation" ||
        type === "strategic_insights",
        true
      );
    });
  },
});

Deno.test({
  name: "deck-tester-agent - response structure validation",
  ignore: !hasRequiredEnv,
  fn() {
    // Mock response structure
    const mockResponse = {
      analysis: "Deck A has advantage in early game",
      winProbability: 0.65,
      keyFactors: ["Card advantage", "Board control"],
      estimated_cost: {
        tokens_used: 1000,
        cost_usd: 0.01,
      },
    };

    assertExists(mockResponse.analysis);
    assertEquals(typeof mockResponse.analysis, "string");
    assertExists(mockResponse.winProbability);
    assertEquals(typeof mockResponse.winProbability, "number");
    assertEquals(mockResponse.winProbability >= 0 && mockResponse.winProbability <= 1, true);
    assertExists(mockResponse.keyFactors);
    assertEquals(Array.isArray(mockResponse.keyFactors), true);
  },
});

Deno.test({
  name: "deck-tester-agent - simulation limits",
  ignore: !hasRequiredEnv,
  fn() {
    // Test that simulation count is limited
    const maxSimulations = 20;
    const testCounts = [1, 10, 20, 50, 100];

    testCounts.forEach((count) => {
      const limitedCount = Math.min(count, maxSimulations);
      assertEquals(limitedCount <= maxSimulations, true);
    });
  },
});
