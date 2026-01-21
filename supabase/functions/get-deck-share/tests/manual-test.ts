/**
 * Manual test script for get-deck-share function
 * 
 * Run with: deno run --allow-net --allow-env --allow-read tests/manual-test.ts <share-token>
 */

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") || "http://localhost:54321";

async function testGetShare(token: string) {
  console.log("🧪 Testing get-deck-share function...\n");
  console.log(`Token: ${token.substring(0, 16)}...\n`);

  try {
    // Test 1: Get share with valid token
    console.log("Test 1: Retrieving deck share...");
    const response = await fetch(
      `${SUPABASE_URL}/functions/v1/get-deck-share/${token}`,
      {
        method: "GET",
        headers: {
          "Content-Type": "application/json",
        },
      },
    );

    const result = await response.json();
    console.log("Status:", response.status);
    console.log("Response:", JSON.stringify(result, null, 2));

    if (response.ok && result.success) {
      console.log("✅ Test 1 PASSED: Deck retrieved successfully");
      console.log(`   Deck Name: ${result.deck.name}`);
      console.log(`   Deck Mode: ${result.deck.mode}`);
      console.log(`   Main Deck Cards: ${result.deck.mainDeck.length}`);
      console.log(`   Extra Deck Cards: ${result.deck.extraDeck.length}`);
      console.log(`   Side Deck Cards: ${result.deck.sideDeck.length}`);
      if (result.metadata) {
        console.log(`   Access Count: ${result.metadata.accessCount}`);
        console.log(`   Created At: ${result.metadata.createdAt}`);
        if (result.metadata.expiresAt) {
          console.log(`   Expires At: ${result.metadata.expiresAt}`);
        }
      }
      return true;
    } else {
      console.log("❌ Test 1 FAILED:", result.error || "Unknown error");
      return false;
    }
  } catch (error) {
    console.error("❌ Test 1 ERROR:", error);
    return false;
  }
}

async function testInvalidToken() {
  console.log("\n🧪 Testing invalid token handling...\n");

  // Test with invalid token
  console.log("Test 2: Testing invalid token...");
  try {
    const response = await fetch(
      `${SUPABASE_URL}/functions/v1/get-deck-share/invalid-token-123`,
      {
        method: "GET",
        headers: {
          "Content-Type": "application/json",
        },
      },
    );

    const result = await response.json();
    if (!response.ok && result.error) {
      console.log("✅ Test 2 PASSED: Invalid token correctly rejected");
      console.log(`   Error: ${result.error}`);
    } else {
      console.log("❌ Test 2 FAILED: Invalid token was accepted");
    }
  } catch (error) {
    console.error("❌ Test 2 ERROR:", error);
  }

  // Test with non-existent token
  console.log("\nTest 3: Testing non-existent token...");
  try {
    const fakeToken = "a".repeat(43); // Valid length but doesn't exist
    const response = await fetch(
      `${SUPABASE_URL}/functions/v1/get-deck-share/${fakeToken}`,
      {
        method: "GET",
        headers: {
          "Content-Type": "application/json",
        },
      },
    );

    const result = await response.json();
    if (!response.ok && result.error) {
      console.log("✅ Test 3 PASSED: Non-existent token correctly rejected");
      console.log(`   Error: ${result.error}`);
    } else {
      console.log("❌ Test 3 FAILED: Non-existent token was accepted");
    }
  } catch (error) {
    console.error("❌ Test 3 ERROR:", error);
  }
}

async function testAccessCountIncrement(token: string) {
  console.log("\n🧪 Testing access count increment...\n");

  try {
    // Get initial access count
    console.log("Test 4: Checking access count increment...");
    const response1 = await fetch(
      `${SUPABASE_URL}/functions/v1/get-deck-share/${token}`,
      {
        method: "GET",
        headers: {
          "Content-Type": "application/json",
        },
      },
    );

    const result1 = await response1.json();
    const initialCount = result1.metadata?.accessCount || 0;
    console.log(`   Initial access count: ${initialCount}`);

    // Access again
    const response2 = await fetch(
      `${SUPABASE_URL}/functions/v1/get-deck-share/${token}`,
      {
        method: "GET",
        headers: {
          "Content-Type": "application/json",
        },
      },
    );

    const result2 = await response2.json();
    const newCount = result2.metadata?.accessCount || 0;
    console.log(`   New access count: ${newCount}`);

    if (newCount === initialCount + 1) {
      console.log("✅ Test 4 PASSED: Access count incremented correctly");
    } else {
      console.log("❌ Test 4 FAILED: Access count not incremented");
      console.log(`   Expected: ${initialCount + 1}, Got: ${newCount}`);
    }
  } catch (error) {
    console.error("❌ Test 4 ERROR:", error);
  }
}

async function main() {
  const token = Deno.args[0];

  if (!token) {
    console.error("❌ Error: Share token required");
    console.log("Usage: deno run --allow-net --allow-env tests/manual-test.ts <share-token>");
    Deno.exit(1);
  }

  console.log("=".repeat(60));
  console.log("GET-DECK-SHARE FUNCTION TESTS");
  console.log("=".repeat(60));
  console.log(`Supabase URL: ${SUPABASE_URL}\n`);

  const success = await testGetShare(token);
  await testInvalidToken();
  
  if (success) {
    await testAccessCountIncrement(token);
  }

  console.log("\n" + "=".repeat(60));
}

if (import.meta.main) {
  main().catch(console.error);
}
