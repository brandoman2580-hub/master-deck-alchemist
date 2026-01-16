/**
 * Verification script for card embeddings
 * Checks total count, dimensionality, missing embeddings, and orphaned embeddings
 */

import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
  console.error("❌ Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY");
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY, {
  auth: {
    persistSession: false,
    autoRefreshToken: false,
  },
});

async function verifyEmbeddings() {
  console.log("🔍 Verifying card embeddings...\n");

  // 1. Check total count of cards vs embeddings
  const { data: cards, error: cardsError } = await supabase
    .from("cards")
    .select("id", { count: "exact" });

  if (cardsError) {
    console.error("❌ Error fetching cards:", cardsError);
    return;
  }

  const { data: embeddings, error: embeddingsError } = await supabase
    .from("card_embeddings")
    .select("card_id", { count: "exact" });

  if (embeddingsError) {
    console.error("❌ Error fetching embeddings:", embeddingsError);
    return;
  }

  const cardCount = cards?.length || 0;
  const embeddingCount = embeddings?.length || 0;

  console.log("📊 Counts:");
  console.log(`   Total cards: ${cardCount}`);
  console.log(`   Total embeddings: ${embeddingCount}`);
  console.log(`   Coverage: ${((embeddingCount / cardCount) * 100).toFixed(2)}%`);

  // 2. Sample 5 embeddings to verify dimensionality
  console.log("\n🔬 Sampling embeddings for dimensionality check...");
  const { data: sampleEmbeddings, error: sampleError } = await supabase
    .from("card_embeddings")
    .select("embedding")
    .limit(5);

  if (sampleError) {
    console.error("❌ Error sampling embeddings:", sampleError);
  } else if (sampleEmbeddings && sampleEmbeddings.length > 0) {
    sampleEmbeddings.forEach((row, idx) => {
      const embedding = row.embedding as number[];
      const dim = Array.isArray(embedding) ? embedding.length : 0;
      console.log(`   Sample ${idx + 1}: ${dim} dimensions`);
      
      if (dim !== 1536 && dim !== 0) {
        console.warn(`   ⚠️  Expected 1536 dimensions, got ${dim}`);
      }
    });
    
    const firstDim = Array.isArray(sampleEmbeddings[0].embedding) 
      ? sampleEmbeddings[0].embedding.length 
      : 0;
    console.log(`\n   ✅ Embedding dimensionality: ${firstDim} (expected: 1536 for gte-small)`);
  }

  // 3. Find cards missing embeddings (excluding Normal Monsters)
  console.log("\n🔍 Finding cards missing embeddings...");
  const { data: cardsWithoutEmbeddings, error: missingError } = await supabase
    .from("cards")
    .select("id, name, type")
    .not("id", "in", 
      supabase
        .from("card_embeddings")
        .select("card_id")
    )
    .not("type", "ilike", "%Normal Monster%")
    .limit(20);

  if (missingError) {
    console.error("❌ Error finding missing embeddings:", missingError);
  } else {
    const missingCount = cardsWithoutEmbeddings?.length || 0;
    console.log(`   Found ${missingCount} cards without embeddings (showing first 20):`);
    if (cardsWithoutEmbeddings && cardsWithoutEmbeddings.length > 0) {
      cardsWithoutEmbeddings.slice(0, 10).forEach((card) => {
        console.log(`   - ${card.name} (ID: ${card.id}, Type: ${card.type})`);
      });
      if (missingCount > 10) {
        console.log(`   ... and ${missingCount - 10} more`);
      }
    } else {
      console.log("   ✅ All non-Normal Monster cards have embeddings!");
    }
  }

  // 4. Find orphaned embeddings (embeddings without matching cards)
  console.log("\n🔍 Finding orphaned embeddings...");
  const { data: orphanedEmbeddings, error: orphanedError } = await supabase
    .from("card_embeddings")
    .select("card_id")
    .not("card_id", "in",
      supabase
        .from("cards")
        .select("id")
    )
    .limit(20);

  if (orphanedError) {
    console.error("❌ Error finding orphaned embeddings:", orphanedError);
  } else {
    const orphanedCount = orphanedEmbeddings?.length || 0;
    if (orphanedCount > 0) {
      console.log(`   ⚠️  Found ${orphanedCount} orphaned embeddings (showing first 20):`);
      orphanedEmbeddings?.slice(0, 10).forEach((row) => {
        console.log(`   - Card ID: ${row.card_id} (no matching card)`);
      });
      if (orphanedCount > 10) {
        console.log(`   ... and ${orphanedCount - 10} more`);
      }
    } else {
      console.log("   ✅ No orphaned embeddings found!");
    }
  }

  // 5. Summary
  console.log("\n📋 Summary:");
  console.log(`   Total cards: ${cardCount}`);
  console.log(`   Total embeddings: ${embeddingCount}`);
  console.log(`   Missing embeddings: ${cardsWithoutEmbeddings?.length || 0} (excluding Normal Monsters)`);
  console.log(`   Orphaned embeddings: ${orphanedEmbeddings?.length || 0}`);
  
  if (embeddingCount >= cardCount * 0.9) {
    console.log("\n   ✅ Embedding coverage is good (≥90%)");
  } else {
    console.log("\n   ⚠️  Embedding coverage is below 90% - consider running embed script");
  }
}

verifyEmbeddings().catch(console.error);
