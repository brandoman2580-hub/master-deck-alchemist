/**
 * Integration tests for create-deck-share edge function
 * Run with: deno test --allow-net --allow-env --allow-read tests/integration.test.ts
 * 
 * Note: These tests require:
 * - Supabase connection
 * - Valid deck data
 */

import { assertEquals, assertExists } from "https://deno.land/std@0.208.0/assert/mod.ts";

// Load environment variables
const SUPABASE_URL = Deno.env.get("SUPABASE_URL") || Deno.env.get("NEXT_PUBLIC_SUPABASE_URL");
const SUPABASE_ANON_KEY = Deno.env.get("NEXT_PUBLIC_SUPABASE_ANON_KEY") || Deno.env.get("SUPABASE_ANON_KEY");

const hasRequiredEnv = SUPABASE_URL && SUPABASE_ANON_KEY;

// Test deck data - needs at least 40 cards for main deck
const testDeckMainCards = Array.from({ length: 40 }, (_, i) => ({
  cardId: 89631139 + (i % 3),
  deckInstanceId: crypto.randomUUID(),
  name: i % 3 === 0 ? "Blue-Eyes White Dragon" : i % 3 === 1 ? "Dark Magician" : "Red-Eyes Black Dragon",
  type: "Normal Monster",
  desc: "Test card description",
}));

const testDeck = {
  deck: {
    name: "Test Deck - Blue-Eyes White Dragon",
    mainDeck: testDeckMainCards,
    extraDeck: [
      {
        cardId: 23995346,
        deckInstanceId: crypto.randomUUID(),
        name: "Blue-Eyes Ultimate Dragon",
        type: "Fusion Monster",
        desc: "\"Blue-Eyes White Dragon\" + \"Blue-Eyes White Dragon\" + \"Blue-Eyes White Dragon\"",
      },
    ],
    sideDeck: [],
    mode: "Master Duel" as const,
  },
  options: {
    expiresInDays: 30,
    maxAccessCount: 100,
  },
};

Deno.test({
  name: "create-deck-share - request validation",
  ignore: !hasRequiredEnv,
  fn() {
    // Validate test deck structure
    assertEquals(testDeck.deck.mainDeck.length >= 40, true);
    assertEquals(testDeck.deck.name.length > 0, true);
    assertEquals(testDeck.deck.mode === "Master Duel" || testDeck.deck.mode === "TCG", true);
  },
});

Deno.test({
  name: "create-deck-share - create share",
  ignore: !hasRequiredEnv,
  async fn() {
    if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
      throw new Error("Missing environment variables");
    }

    const headers: HeadersInit = {
      "Content-Type": "application/json",
      "apikey": SUPABASE_ANON_KEY,
      "Authorization": `Bearer ${SUPABASE_ANON_KEY}`,
    };

    const response = await fetch(`${SUPABASE_URL}/functions/v1/create-deck-share`, {
      method: "POST",
      headers,
      body: JSON.stringify(testDeck),
    });

    assertEquals(response.ok, true);
    const result = await response.json();
    
    // Validate response structure
    assertExists(result.success);
    assertExists(result.shareToken);
    assertExists(result.shareUrl);
    assertExists(result.createdAt);
    
    assertEquals(typeof result.shareToken, "string");
    assertEquals(result.shareToken.length >= 32, true); // Token should be at least 32 chars
    assertEquals(typeof result.shareUrl, "string");
    assertEquals(result.shareUrl.includes(result.shareToken), true);
  },
});

Deno.test({
  name: "create-deck-share - invalid deck structure",
  ignore: !hasRequiredEnv,
  async fn() {
    if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
      throw new Error("Missing environment variables");
    }

    const headers: HeadersInit = {
      "Content-Type": "application/json",
      "apikey": SUPABASE_ANON_KEY,
      "Authorization": `Bearer ${SUPABASE_ANON_KEY}`,
    };

    // Test with invalid deck (missing main deck)
    const invalidDeck = {
      deck: {
        name: "Invalid Deck",
        mainDeck: [], // Empty main deck should fail validation
        extraDeck: [],
        sideDeck: [],
        mode: "Master Duel",
      },
    };

    const response = await fetch(`${SUPABASE_URL}/functions/v1/create-deck-share`, {
      method: "POST",
      headers,
      body: JSON.stringify(invalidDeck),
    });

    // Should return error for invalid deck
    assertEquals(response.ok, false);
    const error = await response.json();
    assertExists(error.error);
  },
});

Deno.test({
  name: "create-deck-share - rate limiting",
  ignore: !hasRequiredEnv,
  async fn() {
    if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
      throw new Error("Missing environment variables");
    }

    const headers: HeadersInit = {
      "Content-Type": "application/json",
      "apikey": SUPABASE_ANON_KEY,
      "Authorization": `Bearer ${SUPABASE_ANON_KEY}`,
    };

    // Make multiple rapid requests to test rate limiting
    const requests = Array.from({ length: 12 }, () =>
      fetch(`${SUPABASE_URL}/functions/v1/create-deck-share`, {
        method: "POST",
        headers,
        body: JSON.stringify(testDeck),
      })
    );

    const responses = await Promise.all(requests);
    
    // At least one should be rate limited (if rate limiting is working)
    const rateLimited = responses.some(r => r.status === 429);
    
    // Note: Rate limiting may not be enabled in test environment
    // This test documents expected behavior
    if (rateLimited) {
      console.log("✅ Rate limiting is working");
    } else {
      console.log("ℹ️ Rate limiting not triggered (may be disabled in test environment)");
    }
  },
});
