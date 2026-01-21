/**
 * End-to-end test script for deck sharing functionality
 * 
 * This script tests both create-deck-share and get-deck-share functions
 * 
 * Usage:
 *   tsx scripts/test-deck-share.ts
 * 
 * Make sure you have:
 *   - SUPABASE_URL environment variable set
 *   - SUPABASE_ANON_KEY environment variable set (optional, for auth tests)
 *   - Supabase functions running locally or pointing to your project
 */

// Load environment variables BEFORE importing modules that depend on them
// Use require for synchronous loading
const dotenv = require("dotenv");
const path = require("path");

// Try to load .env.local first, then .env
const envPath = path.resolve(process.cwd(), ".env.local");
const envPathFallback = path.resolve(process.cwd(), ".env");

dotenv.config({ path: envPath });
dotenv.config({ path: envPathFallback });

// Set defaults if not in env files
if (!process.env.NEXT_PUBLIC_SUPABASE_URL && !process.env.SUPABASE_URL) {
  process.env.NEXT_PUBLIC_SUPABASE_URL = "http://localhost:54321";
  console.log("⚠️  Using default Supabase URL: http://localhost:54321");
  console.log("   Set NEXT_PUBLIC_SUPABASE_URL or SUPABASE_URL to use a different URL\n");
}

// Now import the API functions
import { createDeckShare, getDeckShare } from "../lib/api/deckShare";

// Test deck data - needs at least 40 cards for main deck to pass validation
const testDeckMainCards = Array.from({ length: 40 }, (_, i) => ({
  id: 89631139 + (i % 3), // Use 3 different card IDs
  cardId: 89631139 + (i % 3),
  deckInstanceId: crypto.randomUUID(),
  name: i % 3 === 0 ? "Blue-Eyes White Dragon" : i % 3 === 1 ? "Dark Magician" : "Red-Eyes Black Dragon",
  type: "Normal Monster",
  desc: "Test card description",
  race: "Dragon",
  misc_info: [{ md_rarity: "" }],
  card_sets: {
    set_name: "",
    set_code: "",
    set_rarity: "",
    set_rarity_code: "",
    set_price: "",
  },
  card_images: [],
  card_prices: [],
}));

const testDeck = {
  deck: {
    name: "Test Deck - Blue-Eyes White Dragon",
    mainDeck: testDeckMainCards,
    extraDeck: [
      {
        id: 23995346,
        cardId: 23995346,
        deckInstanceId: crypto.randomUUID(),
        name: "Blue-Eyes Ultimate Dragon",
        type: "Fusion Monster",
        desc: "\"Blue-Eyes White Dragon\" + \"Blue-Eyes White Dragon\" + \"Blue-Eyes White Dragon\"",
        race: "Dragon",
        misc_info: [{ md_rarity: "" }],
        card_sets: {
          set_name: "",
          set_code: "",
          set_rarity: "",
          set_rarity_code: "",
          set_price: "",
        },
        card_images: [],
        card_prices: [],
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
  const supabaseUrlEnv = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
  
  if (!supabaseUrlEnv) {
    console.error("❌ Error: NEXT_PUBLIC_SUPABASE_URL or SUPABASE_URL must be set");
    console.error("\nPlease set one of these environment variables:");
    console.error("  - NEXT_PUBLIC_SUPABASE_URL");
    console.error("  - SUPABASE_URL");
    console.error("\nOr create a .env.local file with:");
    console.error("  NEXT_PUBLIC_SUPABASE_URL=http://localhost:54321");
    process.exit(1);
  }

  console.log("=".repeat(70));
  console.log("DECK SHARING FUNCTIONALITY - END-TO-END TESTS");
  console.log("=".repeat(70));
  console.log(`Supabase URL: ${supabaseUrlEnv}\n`);

  // Test 1: Create share
  const shareToken = await testCreateShare();
  if (!shareToken) {
    console.log("\n❌ Cannot continue tests - share creation failed");
    return;
  }

  // Test 2: Get share
  const getSuccess = await testGetShare(shareToken);
  if (!getSuccess) {
    console.log("\n❌ Cannot continue tests - share retrieval failed");
    return;
  }

  // Test 3: Access count increment
  await testAccessCountIncrement(shareToken);

  // Test 4: Error handling
  await testErrorHandling();

  const baseUrl = supabaseUrlEnv.replace("/rest/v1", "").replace("/functions/v1", "");
  
  console.log("\n" + "=".repeat(70));
  console.log("✅ All tests completed!");
  console.log(`\nShare URL for manual testing: ${baseUrl}/share/${shareToken}`);
  console.log("=".repeat(70));
}

main().catch((error) => {
  console.error("Fatal error:", error);
  process.exit(1);
});
