/**
 * Standalone end-to-end test script for deck sharing functionality
 * 
 * This script tests both create-deck-share and get-deck-share functions
 * without depending on the API wrapper to avoid import issues
 * 
 * Usage:
 *   tsx scripts/test-deck-share-standalone.ts
 * 
 * Environment variables:
 *   - NEXT_PUBLIC_SUPABASE_URL or SUPABASE_URL (defaults to http://localhost:54321)
 */

// Load environment variables
const dotenv = require("dotenv");
const path = require("path");

dotenv.config({ path: path.resolve(process.cwd(), ".env.local") });
dotenv.config({ path: path.resolve(process.cwd(), ".env") });

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL || "http://localhost:54321";
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY || "";

// Test deck data - needs at least 40 cards for main deck
const testDeckMainCards = Array.from({ length: 40 }, (_, i) => ({
  cardId: 89631139 + (i % 3), // Use 3 different card IDs
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

async function createDeckShare(deckData: typeof testDeck) {
  const headers: HeadersInit = {
    "Content-Type": "application/json",
  };

  // Supabase Edge Functions require apikey header for authentication
  if (SUPABASE_ANON_KEY) {
    headers["apikey"] = SUPABASE_ANON_KEY;
    headers["Authorization"] = `Bearer ${SUPABASE_ANON_KEY}`;
  }

  const response = await fetch(`${SUPABASE_URL}/functions/v1/create-deck-share`, {
    method: "POST",
    headers,
    body: JSON.stringify(deckData),
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: "Failed to create share" }));
    throw new Error(error.error || `HTTP ${response.status}`);
  }

  return response.json();
}

async function getDeckShare(token: string) {
  const headers: HeadersInit = {
    "Content-Type": "application/json",
  };

  // Supabase Edge Functions require apikey header for authentication
  if (SUPABASE_ANON_KEY) {
    headers["apikey"] = SUPABASE_ANON_KEY;
    headers["Authorization"] = `Bearer ${SUPABASE_ANON_KEY}`;
  }

  const response = await fetch(`${SUPABASE_URL}/functions/v1/get-deck-share/${token}`, {
    method: "GET",
    headers,
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: "Failed to retrieve share" }));
    throw new Error(error.error || `HTTP ${response.status}`);
  }

  return response.json();
}

async function testCreateShare() {
  console.log("🧪 Test 1: Creating deck share...\n");

  try {
    const result = await createDeckShare(testDeck);

    console.log("✅ Share created successfully!");
    console.log(`   Share Token: ${result.shareToken.substring(0, 16)}...`);
    console.log(`   Share URL: ${result.shareUrl}`);
    console.log(`   Expires At: ${result.expiresAt || "Never"}`);
    console.log(`   Max Access Count: ${result.maxAccessCount || "Unlimited"}`);
    console.log(`   Created At: ${result.createdAt}\n`);

    return result.shareToken;
  } catch (error) {
    console.error("❌ Failed to create share:", error);
    if (error instanceof Error) {
      console.error(`   Error: ${error.message}`);
    }
    return null;
  }
}

async function testGetShare(shareToken: string) {
  console.log("🧪 Test 2: Retrieving deck share...\n");

  try {
    const result = await getDeckShare(shareToken);

    console.log("✅ Deck retrieved successfully!");
    console.log(`   Deck Name: ${result.deck.name}`);
    console.log(`   Deck Mode: ${result.deck.mode}`);
    console.log(`   Main Deck: ${result.deck.mainDeck.length} cards`);
    console.log(`   Extra Deck: ${result.deck.extraDeck.length} cards`);
    console.log(`   Side Deck: ${result.deck.sideDeck.length} cards`);

    if (result.metadata) {
      console.log(`\n   Metadata:`);
      console.log(`   Access Count: ${result.metadata.accessCount}`);
      console.log(`   Created At: ${result.metadata.createdAt}`);
      if (result.metadata.expiresAt) {
        console.log(`   Expires At: ${result.metadata.expiresAt}`);
      }
      if (result.metadata.maxAccessCount) {
        console.log(`   Max Access Count: ${result.metadata.maxAccessCount}`);
      }
    }

    // Verify deck data matches
    if (
      result.deck.name === testDeck.deck.name &&
      result.deck.mode === testDeck.deck.mode &&
      result.deck.mainDeck.length === testDeck.deck.mainDeck.length &&
      result.deck.extraDeck.length === testDeck.deck.extraDeck.length
    ) {
      console.log("\n✅ Deck data matches original!");
      return true;
    } else {
      console.log("\n❌ Deck data mismatch!");
      return false;
    }
  } catch (error) {
    console.error("❌ Failed to retrieve share:", error);
    if (error instanceof Error) {
      console.error(`   Error: ${error.message}`);
    }
    return false;
  }
}

async function testAccessCountIncrement(shareToken: string) {
  console.log("\n🧪 Test 3: Testing access count increment...\n");

  try {
    // Get initial count
    const result1 = await getDeckShare(shareToken);
    const initialCount = result1.metadata?.accessCount || 0;
    console.log(`   Initial access count: ${initialCount}`);

    // Access again
    const result2 = await getDeckShare(shareToken);
    const newCount = result2.metadata?.accessCount || 0;
    console.log(`   New access count: ${newCount}`);

    if (newCount === initialCount + 1) {
      console.log("✅ Access count incremented correctly!");
      return true;
    } else {
      console.log(`❌ Access count mismatch! Expected ${initialCount + 1}, got ${newCount}`);
      return false;
    }
  } catch (error) {
    console.error("❌ Failed to test access count:", error);
    return false;
  }
}

async function testErrorHandling() {
  console.log("\n🧪 Test 4: Testing error handling...\n");

  // Test invalid token
  try {
    await getDeckShare("invalid-token-123");
    console.log("❌ Invalid token was accepted (should have failed)");
    return false;
  } catch (error) {
    console.log("✅ Invalid token correctly rejected");
    if (error instanceof Error) {
      console.log(`   Error: ${error.message}`);
    }
  }

  // Test non-existent token
  try {
    const fakeToken = "a".repeat(43); // Valid length but doesn't exist
    await getDeckShare(fakeToken);
    console.log("❌ Non-existent token was accepted (should have failed)");
    return false;
  } catch (error) {
    console.log("✅ Non-existent token correctly rejected");
    if (error instanceof Error) {
      console.log(`   Error: ${error.message}`);
    }
  }

  return true;
}

async function main() {
  console.log("=".repeat(70));
  console.log("DECK SHARING FUNCTIONALITY - END-TO-END TESTS");
  console.log("=".repeat(70));
  console.log(`Supabase URL: ${SUPABASE_URL}`);
  
  if (!SUPABASE_ANON_KEY) {
    console.log("❌ Error: SUPABASE_ANON_KEY is required for Edge Functions");
    console.log("   Set NEXT_PUBLIC_SUPABASE_ANON_KEY or SUPABASE_ANON_KEY in your .env file");
    console.log("   Example: NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key-here\n");
    process.exit(1);
  } else {
    console.log(`✅ API Key configured\n`);
  }

  // Test 1: Create share
  const shareToken = await testCreateShare();
  if (!shareToken) {
    console.log("\n❌ Cannot continue tests - share creation failed");
    console.log("\nTroubleshooting:");
    console.log("  1. Make sure Supabase is running (supabase start)");
    console.log("  2. Check that SUPABASE_URL is correct");
    console.log("  3. Verify the create-deck-share function is deployed");
    process.exit(1);
  }

  // Test 2: Get share
  const getSuccess = await testGetShare(shareToken);
  if (!getSuccess) {
    console.log("\n❌ Cannot continue tests - share retrieval failed");
    process.exit(1);
  }

  // Test 3: Access count increment
  await testAccessCountIncrement(shareToken);

  // Test 4: Error handling
  await testErrorHandling();

  const baseUrl = SUPABASE_URL.replace("/rest/v1", "").replace("/functions/v1", "");
  const shareUrl = `${baseUrl}/share/${shareToken}`;
  
  console.log("\n" + "=".repeat(70));
  console.log("✅ All tests completed!");
  console.log(`\nShare URL for manual testing: ${shareUrl}`);
  console.log("=".repeat(70));
}

main().catch((error) => {
  console.error("Fatal error:", error);
  process.exit(1);
});
