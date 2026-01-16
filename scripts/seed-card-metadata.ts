/**
 * Seed script for populating card_metadata table with staple cards and calculated scores
 * Run this after the migration: npx tsx scripts/seed-card-metadata.ts
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

const STAPLE_SEED_LIST = [
  // Hand Traps
  "Ash Blossom & Joyous Spring",
  "Effect Veiler",
  "Infinite Impermanence",
  "Nibiru, the Primal Being",
  "Droll & Lock Bird",
  "Dimension Shifter",
  "Ghost Belle & Haunted Mansion",
  "Skull Meister",
  "Ghost Ogre & Snow Rabbit",
  "Fantastical Dragon Phantazmay",
  
  // Board Breakers
  "Dark Ruler No More",
  "Forbidden Droplet",
  "Lightning Storm",
  "Evenly Matched",
  "Harpie's Feather Duster",
  "Raigeki",
  "Triple Tactics Talent",
  "Triple Tactics Thrust",
  
  // Generic Negates
  "Solemn Judgment",
  "Solemn Strike",
  "Solemn Warning",
  "Red Reboot",
  
  // Consistency (Draw/Search)
  "Pot of Desires",
  "Pot of Extravagance",
  "Pot of Prosperity",
  "Pot of Avarice",
  "Upstart Goblin",
  "Chicken Game",
  "Into the Void",
  "Allure of Darkness",
  "Trade-In",
  "Called by the Grave",
  "Crossout Designator",
  
  // Generic Extra Deck Staples
  "Accesscode Talker",
  "Apollousa, Bow of the Goddess",
  "Knightmare Phoenix",
  "Knightmare Unicorn",
  "Underworld Goddess of the Closed World",
  "Divine Arsenal AA-ZEUS - Sky Thunder",
  "I:P Masquerena",
  "S:P Little Knight",
  "Dharc the Dark Charmer, Gloomy",
  "Selene, Queen of the Master Magicians",
  "Baronne de Fleur",
  "Borreload Savage Dragon",
  "Chaos Angel",
  
  // Floodgates
  "Skill Drain",
  "Rivalry of Warlords",
  "Gozen Match",
  "There Can Be Only One",
  "Summon Limit",
  "Anti-Spell Fragrance"
];

const STAPLE_CATEGORIES: Record<string, string[]> = {
  hand_trap: ["hand", "quick effect", "opponent activates", "negate", "during either player's turn"],
  board_breaker: ["destroy all", "banish all", "return all", "dark ruler", "unaffected by"],
  generic_negate: ["negate", "solemn", "cannot be activated"],
  consistency: ["draw", "add", "search", "excavate", "pot of", "reveal"],
  floodgate: ["cannot", "neither player", "skill drain", "rivalry", "gozen", "there can be only one", "summon limit", "anti-spell"]
};

// Scoring heuristics (matching requirements)
function calculateConsistencyScore(desc: string): number {
  const keywords = ["draw", "add", "search", "deck", "excavate", "reveal", "mill"];
  let score = 0;
  const lowerDesc = desc.toLowerCase();
  
  keywords.forEach(kw => {
    if (lowerDesc.includes(kw)) score += 0.15;
  });
  
  // Bonus for "add from deck to hand" pattern
  if (lowerDesc.includes("add") && lowerDesc.includes("deck") && lowerDesc.includes("hand")) {
    score += 0.2;
  }
  
  return Math.min(score, 1.0);
}

function calculateInteractionScore(desc: string): number {
  const keywords = ["negate", "destroy", "banish", "return", "send to", "quick effect", "during either player's turn"];
  let score = 0;
  const lowerDesc = desc.toLowerCase();
  
  keywords.forEach(kw => {
    if (lowerDesc.includes(kw)) score += 0.15;
  });
  
  // Bonus for disruption during opponent's turn
  if (lowerDesc.includes("opponent") && (lowerDesc.includes("negate") || lowerDesc.includes("destroy"))) {
    score += 0.2;
  }
  
  return Math.min(score, 1.0);
}

function calculatePowerCeiling(desc: string, type: string): number {
  const keywords = ["special summon", "cannot be", "unaffected", "twice per turn"];
  let score = 0.3; // base
  const lowerDesc = desc.toLowerCase();
  
  keywords.forEach(kw => {
    if (lowerDesc.includes(kw)) score += 0.15;
  });
  
  // Bonus for Extra Deck monsters
  if (type.includes("Link") || type.includes("Synchro") || type.includes("Xyz") || type.includes("Fusion")) {
    score += 0.1;
  }
  
  // Bonus for protection effects
  if (lowerDesc.includes("unaffected by") || lowerDesc.includes("cannot be destroyed")) {
    score += 0.2;
  }
  
  return Math.min(score, 1.0);
}

function detectStapleCategory(cardName: string, desc: string, type: string): string | null {
  const lowerDesc = desc.toLowerCase();
  const lowerName = cardName.toLowerCase();
  
  // Check each category
  for (const [category, keywords] of Object.entries(STAPLE_CATEGORIES)) {
    const matches = keywords.some(kw => 
      lowerDesc.includes(kw) || lowerName.includes(kw)
    );
    if (matches) {
      return category;
    }
  }
  
  // Extra deck staples
  if (type.includes("Link") || type.includes("Synchro") || type.includes("Xyz")) {
    return "generic_extra";
  }
  
  return null;
}

async function main() {
  console.log("🌱 Starting card metadata seed...");
  
  // Fetch all cards
  const { data: allCards, error: fetchError } = await supabase
    .from("cards")
    .select("id, name, type, desc");
  
  if (fetchError) {
    console.error("❌ Error fetching cards:", fetchError);
    process.exit(1);
  }
  
  if (!allCards || allCards.length === 0) {
    console.error("❌ No cards found in database");
    process.exit(1);
  }
  
  console.log(`📊 Found ${allCards.length} cards in database`);
  
  // Create a map for quick lookup
  const cardMap = new Map(allCards.map(c => [c.name.toLowerCase(), c]));
  
  // Process staples from seed list
  const metadataToInsert: Array<{
    card_id: number;
    is_staple: boolean;
    staple_category: string | null;
    consistency_score: number;
    interaction_score: number;
    power_ceiling: number;
    meta_relevance: number;
  }> = [];
  
  console.log(`\n🔍 Processing ${STAPLE_SEED_LIST.length} staple cards...`);
  let staplesFound = 0;
  
  for (const stapleName of STAPLE_SEED_LIST) {
    const card = cardMap.get(stapleName.toLowerCase());
    if (!card) {
      console.warn(`⚠️  Staple not found: ${stapleName}`);
      continue;
    }
    
    staplesFound++;
    const desc = card.desc || "";
    const category = detectStapleCategory(card.name, desc, card.type);
    
    metadataToInsert.push({
      card_id: card.id,
      is_staple: true,
      staple_category: category,
      consistency_score: calculateConsistencyScore(desc),
      interaction_score: calculateInteractionScore(desc),
      power_ceiling: calculatePowerCeiling(desc, card.type),
      meta_relevance: 0.5, // Default for staples
    });
  }
  
  console.log(`✅ Found ${staplesFound} staples in database`);
  
  // Also process all other cards to calculate scores (but not mark as staples)
  console.log(`\n📊 Calculating scores for all cards...`);
  let processed = 0;
  const batchSize = 1000;
  
  for (let i = 0; i < allCards.length; i += batchSize) {
    const batch = allCards.slice(i, i + batchSize);
    
    for (const card of batch) {
      // Skip if already in metadataToInsert (staple)
      if (metadataToInsert.some(m => m.card_id === card.id)) {
        continue;
      }
      
      const desc = card.desc || "";
      const consistencyScore = calculateConsistencyScore(desc);
      const interactionScore = calculateInteractionScore(desc);
      const powerCeiling = calculatePowerCeiling(desc, card.type);
      
      // Only insert if at least one score is > 0 (to avoid empty rows)
      if (consistencyScore > 0 || interactionScore > 0 || powerCeiling > 0) {
        metadataToInsert.push({
          card_id: card.id,
          is_staple: false,
          staple_category: null,
          consistency_score: consistencyScore,
          interaction_score: interactionScore,
          power_ceiling: powerCeiling,
          meta_relevance: 0.0,
        });
      }
      
      processed++;
      if (processed % 1000 === 0) {
        console.log(`   Processed ${processed}/${allCards.length} cards...`);
      }
    }
  }
  
  console.log(`✅ Calculated scores for ${processed} cards`);
  console.log(`📦 Total metadata records to insert: ${metadataToInsert.length}`);
  
  // Insert in batches
  console.log(`\n💾 Inserting metadata into database...`);
  const insertBatchSize = 500;
  let inserted = 0;
  
  for (let i = 0; i < metadataToInsert.length; i += insertBatchSize) {
    const batch = metadataToInsert.slice(i, i + insertBatchSize);
    
    const { error: insertError } = await supabase
      .from("card_metadata")
      .upsert(batch, {
        onConflict: "card_id",
        ignoreDuplicates: false,
      });
    
    if (insertError) {
      console.error(`❌ Error inserting batch ${i / insertBatchSize + 1}:`, insertError);
      continue;
    }
    
    inserted += batch.length;
    console.log(`   Inserted ${inserted}/${metadataToInsert.length} records...`);
  }
  
  // Calculate statistics
  const highConsistency = metadataToInsert.filter(m => m.consistency_score > 0.5).length;
  const highInteraction = metadataToInsert.filter(m => m.interaction_score > 0.5).length;
  
  console.log(`\n✅ Seed complete! Inserted ${inserted} metadata records`);
  console.log(`   - Staples identified: ${staplesFound}`);
  console.log(`   - Other cards with scores: ${metadataToInsert.length - staplesFound}`);
  console.log(`   - High consistency cards (>0.5): ${highConsistency}`);
  console.log(`   - High interaction cards (>0.5): ${highInteraction}`);
}

main().catch(console.error);
