/**
 * Test script to verify database storage for tier list data
 */

import "dotenv/config";
import { createClient } from "@supabase/supabase-js";
import { updateTierListData, getLatestTierList } from "./tier-list-manager";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error("❌ Missing Supabase environment variables");
  console.error("   Required: NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY");
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function testDatabaseStorage() {
  try {
    console.log("🔍 Checking if tier_list_snapshots table exists...\n");
    
    // Check if table exists by trying to query it
    const { error } = await supabase
      .from("tier_list_snapshots")
      .select("id")
      .limit(1);
    
    if (error) {
      if (error.code === "42P01" || error.message.includes("does not exist")) {
        console.error("❌ Table 'tier_list_snapshots' does not exist!");
        console.error("\n📋 Please apply the migration first:");
        console.error("   1. Go to Supabase Dashboard → SQL Editor");
        console.error("   2. Copy contents of: supabase/migrations/20260111200000_create_tier_list_meta.sql");
        console.error("   3. Paste and execute");
        console.error("\n   Or use Supabase CLI:");
        console.error("   supabase db push\n");
        process.exit(1);
      } else {
        throw error;
      }
    }
    
    console.log("✅ Table exists! Proceeding with data storage test...\n");
    
    // Test storing data
    console.log("🔄 Running tier list update (this will scrape and store data)...\n");
    const result = await updateTierListData("both");
    
    console.log("\n📊 Storage Results:");
    console.log(`   Entries Inserted: ${result.entriesInserted}`);
    console.log(`   Errors: ${result.errors.length}`);
    if (result.scrapeRunId) {
      console.log(`   Scrape Run ID: ${result.scrapeRunId}`);
    }
    
    if (result.errors.length > 0) {
      console.log("\n⚠️ Errors:");
      result.errors.forEach((err) => console.log(`   - ${err}`));
    }
    
    // Verify stored data
    console.log("\n🔍 Verifying stored data...\n");
    
    const tcgTierList = await getLatestTierList("tcg");
    const mdTierList = await getLatestTierList("master_duel");
    
    console.log(`📈 TCG Tier List (${tcgTierList.length} entries):`);
    const tcgByTier = tcgTierList.reduce((acc, entry) => {
      acc[entry.tier] = (acc[entry.tier] || 0) + 1;
      return acc;
    }, {} as Record<number, number>);
    Object.entries(tcgByTier).forEach(([tier, count]) => {
      console.log(`   Tier ${tier}: ${count} decks`);
    });
    if (tcgTierList.length > 0) {
      console.log(`   Sample: ${tcgTierList.slice(0, 3).map(e => `${e.deck_name} (T${e.tier})`).join(", ")}`);
    }
    
    console.log(`\n📈 Master Duel Tier List (${mdTierList.length} entries):`);
    const mdByTier = mdTierList.reduce((acc, entry) => {
      acc[entry.tier] = (acc[entry.tier] || 0) + 1;
      return acc;
    }, {} as Record<number, number>);
    Object.entries(mdByTier).forEach(([tier, count]) => {
      console.log(`   Tier ${tier}: ${count} decks`);
    });
    if (mdTierList.length > 0) {
      console.log(`   Sample: ${mdTierList.slice(0, 3).map(e => `${e.deck_name} (T${e.tier})`).join(", ")}`);
    }
    
    // Query database directly to show some sample rows
    console.log("\n📋 Sample database rows:");
    const { data: sampleData } = await supabase
      .from("tier_list_snapshots")
      .select("deck_name, tier, format, source, scraped_at")
      .order("scraped_at", { ascending: false })
      .limit(5);
    
    if (sampleData && sampleData.length > 0) {
      sampleData.forEach((row) => {
        console.log(`   - ${row.deck_name} | Tier ${row.tier} | ${row.format} | ${row.source}`);
      });
    }
    
    console.log("\n✅ Database storage test complete!");
  } catch (error) {
    console.error("❌ Test failed:", error);
    process.exit(1);
  }
}

testDatabaseStorage();
