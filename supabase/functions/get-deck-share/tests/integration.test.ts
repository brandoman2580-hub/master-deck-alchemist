/**
 * Integration tests for get-deck-share edge function
 * Run with: deno test --allow-net --allow-env --allow-read tests/integration.test.ts
 * 
 * Note: These tests require:
 * - Supabase connection
 * - A valid share token (created via create-deck-share)
 */

import { assertEquals, assertExists } from "https://deno.land/std@0.208.0/assert/mod.ts";

// Load environment variables
const SUPABASE_URL = Deno.env.get("SUPABASE_URL") || Deno.env.get("NEXT_PUBLIC_SUPABASE_URL");
const SUPABASE_ANON_KEY = Deno.env.get("NEXT_PUBLIC_SUPABASE_ANON_KEY") || Deno.env.get("SUPABASE_ANON_KEY");

const hasRequiredEnv = SUPABASE_URL && SUPABASE_ANON_KEY;

Deno.test({
  name: "get-deck-share - invalid token format",
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

    // Test with invalid token (too short)
    const response = await fetch(`${SUPABASE_URL}/functions/v1/get-deck-share/invalid-token`, {
      method: "GET",
      headers,
    });

    assertEquals(response.status, 400);
    const error = await response.json();
    assertExists(error.error);
  },
});

Deno.test({
  name: "get-deck-share - missing token",
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

    // Test without token
    const response = await fetch(`${SUPABASE_URL}/functions/v1/get-deck-share`, {
      method: "GET",
      headers,
    });

    assertEquals(response.status, 400);
    const error = await response.json();
    assertExists(error.error);
    assertExists(error.details);
  },
});

Deno.test({
  name: "get-deck-share - non-existent token",
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

    // Test with valid format but non-existent token
    const fakeToken = "a".repeat(43); // Valid length but doesn't exist
    const response = await fetch(`${SUPABASE_URL}/functions/v1/get-deck-share/${fakeToken}`, {
      method: "GET",
      headers,
    });

    assertEquals(response.status, 404);
    const error = await response.json();
    assertExists(error.error);
  },
});

Deno.test({
  name: "get-deck-share - response structure validation",
  ignore: !hasRequiredEnv,
  async fn() {
    if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
      throw new Error("Missing environment variables");
    }

    // First create a share to get a valid token
    const testDeckMainCards = Array.from({ length: 40 }, (_, i) => ({
      cardId: 89631139 + (i % 3),
      deckInstanceId: crypto.randomUUID(),
      name: "Test Card",
      type: "Normal Monster",
      desc: "Test",
    }));

    const testDeck = {
      deck: {
        name: "Test Deck",
        mainDeck: testDeckMainCards,
        extraDeck: [],
        sideDeck: [],
        mode: "Master Duel" as const,
      },
    };

    const headers: HeadersInit = {
      "Content-Type": "application/json",
      "apikey": SUPABASE_ANON_KEY,
      "Authorization": `Bearer ${SUPABASE_ANON_KEY}`,
    };

    // Create share
    const createResponse = await fetch(`${SUPABASE_URL}/functions/v1/create-deck-share`, {
      method: "POST",
      headers,
      body: JSON.stringify(testDeck),
    });

    if (!createResponse.ok) {
      console.log("⚠️ Could not create test share, skipping get-deck-share test");
      return;
    }

    const createResult = await createResponse.json();
    const shareToken = createResult.shareToken;

    // Now test getting the share
    const getResponse = await fetch(`${SUPABASE_URL}/functions/v1/get-deck-share/${shareToken}`, {
      method: "GET",
      headers,
    });

    assertEquals(getResponse.ok, true);
    const result = await getResponse.json();
    
    // Validate response structure
    assertExists(result.success);
    assertExists(result.deck);
    assertExists(result.deck.name);
    assertExists(result.deck.mainDeck);
    assertExists(result.deck.extraDeck);
    assertExists(result.deck.sideDeck);
    assertExists(result.deck.mode);
    assertExists(result.metadata);
    assertExists(result.metadata.accessCount);
    assertExists(result.metadata.createdAt);
    
    assertEquals(result.deck.name, testDeck.deck.name);
    assertEquals(result.deck.mainDeck.length, testDeck.deck.mainDeck.length);
    assertEquals(result.deck.mode, testDeck.deck.mode);
  },
});

Deno.test({
  name: "get-deck-share - access count increment",
  ignore: !hasRequiredEnv,
  async fn() {
    if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
      throw new Error("Missing environment variables");
    }

    // Create a test share
    const testDeckMainCards = Array.from({ length: 40 }, (_, i) => ({
      cardId: 89631139 + (i % 3),
      deckInstanceId: crypto.randomUUID(),
      name: "Test Card",
      type: "Normal Monster",
      desc: "Test",
    }));

    const testDeck = {
      deck: {
        name: "Test Deck",
        mainDeck: testDeckMainCards,
        extraDeck: [],
        sideDeck: [],
        mode: "Master Duel" as const,
      },
    };

    const headers: HeadersInit = {
      "Content-Type": "application/json",
      "apikey": SUPABASE_ANON_KEY,
      "Authorization": `Bearer ${SUPABASE_ANON_KEY}`,
    };

    const createResponse = await fetch(`${SUPABASE_URL}/functions/v1/create-deck-share`, {
      method: "POST",
      headers,
      body: JSON.stringify(testDeck),
    });

    if (!createResponse.ok) {
      console.log("⚠️ Could not create test share, skipping access count test");
      return;
    }

    const createResult = await createResponse.json();
    const shareToken = createResult.shareToken;

    // Get initial access count
    const response1 = await fetch(`${SUPABASE_URL}/functions/v1/get-deck-share/${shareToken}`, {
      method: "GET",
      headers,
    });

    assertEquals(response1.ok, true);
    const result1 = await response1.json();
    const initialCount = result1.metadata.accessCount;

    // Access again
    const response2 = await fetch(`${SUPABASE_URL}/functions/v1/get-deck-share/${shareToken}`, {
      method: "GET",
      headers,
    });

    assertEquals(response2.ok, true);
    const result2 = await response2.json();
    const newCount = result2.metadata.accessCount;

    // Access count should increment
    assertEquals(newCount, initialCount + 1);
  },
});
