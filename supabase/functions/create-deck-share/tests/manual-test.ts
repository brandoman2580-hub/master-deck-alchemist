/**
 * Manual test script for create-deck-share function
 * 
 * Run with: deno run --allow-net --allow-env --allow-read tests/manual-test.ts
 */

import { createClient } from "@supabase/supabase-js";

// Load environment variables
const SUPABASE_URL = Deno.env.get("SUPABASE_URL") || "http://localhost:54321";
const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY") || "";
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";

// Test deck data
const testDeck = {
  deck: {
    name: "Test Deck - Blue-Eyes",
    mainDeck: [
      {
        cardId: 89631139,
        deckInstanceId: crypto.randomUUID(),
        name: "Blue-Eyes White Dragon",
        type: "Normal Monster",
        desc: "This legendary dragon is a powerful engine of destruction.",
      },
      {
        cardId: 89631139,
        deckInstanceId: crypto.randomUUID(),
        name: "Blue-Eyes White Dragon",
        type: "Normal Monster",
        desc: "This legendary dragon is a powerful engine of destruction.",
      },
      {
        cardId: 89631139,
        deckInstanceId: crypto.randomUUID(),
        name: "Blue-Eyes White Dragon",
        type: "Normal Monster",
        desc: "This legendary dragon is a powerful engine of destruction.",
      },
    ],
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

async function testCreateShare() {
  console.log("🧪 Testing create-deck-share function...\n");

  try {
    // Test 1: Create share without authentication (anonymous)
    console.log("Test 1: Creating share as anonymous user...");
    const response1 = await fetch(
      `${SUPABASE_URL}/functions/v1/create-deck-share`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(testDeck),
      },
    );

    const result1 = await response1.json();
    console.log("Status:", response1.status);
    console.log("Response:", JSON.stringify(result1, null, 2));

    if (response1.ok && result1.success) {
      console.log("✅ Test 1 PASSED: Anonymous share created successfully");
      console.log(`   Share URL: ${result1.shareUrl}`);
      console.log(`   Share Token: ${result1.shareToken.substring(0, 16)}...`);
      return result1.shareToken;
    } else {
      console.log("❌ Test 1 FAILED:", result1.error || "Unknown error");
      return null;
    }
  } catch (error) {
    console.error("❌ Test 1 ERROR:", error);
    return null;
  }
}

async function testCreateShareAuthenticated() {
  console.log("\n🧪 Testing create-deck-share with authentication...\n");

  if (!SUPABASE_ANON_KEY) {
    console.log("⚠️  Skipping authenticated test - SUPABASE_ANON_KEY not set");
    return null;
  }

  try {
    // Create a test user session (you'll need to replace this with actual auth)
    const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
    
    // For testing, you might want to use a test account
    // This is just a placeholder - in real testing, you'd authenticate first
    console.log("Test 2: Creating share as authenticated user...");
    console.log("⚠️  Note: This requires a valid auth token. Skipping for now.");
    
    return null;
  } catch (error) {
    console.error("❌ Test 2 ERROR:", error);
    return null;
  }
}

async function testValidationErrors() {
  console.log("\n🧪 Testing validation errors...\n");

  // Test empty deck
  console.log("Test 3: Testing empty deck rejection...");
  try {
    const response = await fetch(
      `${SUPABASE_URL}/functions/v1/create-deck-share`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          deck: {
            name: "Empty Deck",
            mainDeck: [],
            extraDeck: [],
            sideDeck: [],
            mode: "Master Duel",
          },
        }),
      },
    );

    const result = await response.json();
    if (!response.ok && result.error) {
      console.log("✅ Test 3 PASSED: Empty deck correctly rejected");
      console.log(`   Error: ${result.error}`);
    } else {
      console.log("❌ Test 3 FAILED: Empty deck was accepted");
    }
  } catch (error) {
    console.error("❌ Test 3 ERROR:", error);
  }

  // Test invalid deck mode
  console.log("\nTest 4: Testing invalid deck mode...");
  try {
    const response = await fetch(
      `${SUPABASE_URL}/functions/v1/create-deck-share`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          deck: {
            name: "Invalid Mode Deck",
            mainDeck: testDeck.deck.mainDeck,
            extraDeck: [],
            sideDeck: [],
            mode: "Invalid Mode",
          },
        }),
      },
    );

    const result = await response.json();
    if (!response.ok && result.error) {
      console.log("✅ Test 4 PASSED: Invalid mode correctly rejected");
      console.log(`   Error: ${result.error}`);
    } else {
      console.log("❌ Test 4 FAILED: Invalid mode was accepted");
    }
  } catch (error) {
    console.error("❌ Test 4 ERROR:", error);
  }
}

async function main() {
  console.log("=".repeat(60));
  console.log("CREATE-DECK-SHARE FUNCTION TESTS");
  console.log("=".repeat(60));
  console.log(`Supabase URL: ${SUPABASE_URL}\n`);

  const shareToken = await testCreateShare();
  await testCreateShareAuthenticated();
  await testValidationErrors();

  console.log("\n" + "=".repeat(60));
  if (shareToken) {
    console.log(`\n✅ Share token created: ${shareToken.substring(0, 16)}...`);
    console.log("   Use this token to test get-deck-share function");
  }
  console.log("=".repeat(60));
}

if (import.meta.main) {
  main().catch(console.error);
}
