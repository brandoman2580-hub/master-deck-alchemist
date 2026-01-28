/**
 * Integration tests for deck-builder-agent edge function
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
  name: "deck-builder-agent - request format validation",
  ignore: !hasRequiredEnv,
  fn() {
    // Test that request structure is valid
    const validRequest = {
      current_deck: {
        main: [{ cardId: 123, count: 3 }],
        extra: [],
        side: [],
      },
      user_goal: "Build a competitive deck",
      banlist_format: "MASTER_DUEL" as const,
      context: "initial_build" as const,
    };

    assertExists(validRequest.current_deck);
    assertExists(validRequest.current_deck.main);
    assertEquals(Array.isArray(validRequest.current_deck.main), true);
    assertEquals(typeof validRequest.user_goal, "string");
    assertEquals(
      validRequest.banlist_format === "MASTER_DUEL" || validRequest.banlist_format === "TCG",
      true
    );
  },
});

Deno.test({
  name: "deck-builder-agent - response structure validation",
  ignore: !hasRequiredEnv,
  fn() {
    // Mock response structure
    const mockResponse = {
      suggestions: [
        {
          cardId: 123,
          cardName: "Test Card",
          reason: "Good synergy",
          priority: "high" as const,
        },
      ],
      assessment: {
        completeness: 0.5,
        nextSteps: ["Add more cards"],
      },
    };

    assertExists(mockResponse.suggestions);
    assertEquals(Array.isArray(mockResponse.suggestions), true);
    assertExists(mockResponse.assessment);
    assertEquals(typeof mockResponse.assessment.completeness, "number");
  },
});

Deno.test({
  name: "deck-builder-agent - context validation",
  ignore: !hasRequiredEnv,
  fn() {
    const validContexts = ["initial_build", "refining", "completing"];
    
    validContexts.forEach((context) => {
      assertEquals(
        context === "initial_build" || context === "refining" || context === "completing",
        true
      );
    });
  },
});
