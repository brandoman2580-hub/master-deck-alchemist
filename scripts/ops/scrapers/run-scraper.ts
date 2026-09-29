/**
 * Run tier list scraper
 * Usage: tsx scripts/scrapers/run-scraper.ts <scraper-name>
 * Scrapers: yugiohmeta | masterduelmeta
 * 
 * Requires: NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY (for 'both' option)
 */

import { scrapeYuGiOhMeta } from "./yugiohmeta-scraper";
import { scrapeMasterDuelMetaTierList } from "./masterduelmeta-tier-scraper";

const scraperName = process.argv[2];

if (!scraperName) {
  console.error("❌ Usage: tsx scripts/scrapers/run-scraper.ts <scraper-name>");
  console.error("   Scrapers: yugiohmeta | masterduelmeta | both");
  process.exit(1);
}

async function runScraper() {
  try {
    if (scraperName === "yugiohmeta") {
      console.log("🔍 Running YuGiOhMeta scraper...");
      const result = await scrapeYuGiOhMeta();
      console.log("\n📊 Results:");
      console.log(`   Entries: ${result.entries.length}`);
      console.log(`   Errors: ${result.errors.length}`);
      console.log(`   Scrape Run ID: ${result.scrapeRunId}`);
      if (result.errors.length > 0) {
        console.log("\n⚠️ Errors:");
        result.errors.forEach((err) => console.log(`   - ${err}`));
      }
      if (result.entries.length > 0) {
        console.log("\n✅ Sample entries:");
        result.entries.slice(0, 5).forEach((entry) => {
          console.log(`   - ${entry.deck_name} (Tier ${entry.tier})`);
        });
      }
    } else if (scraperName === "masterduelmeta") {
      console.log("🔍 Running MasterDuelMeta scraper...");
      const result = await scrapeMasterDuelMetaTierList();
      console.log("\n📊 Results:");
      console.log(`   Entries: ${result.entries.length}`);
      console.log(`   Errors: ${result.errors.length}`);
      console.log(`   Scrape Run ID: ${result.scrapeRunId}`);
      if (result.errors.length > 0) {
        console.log("\n⚠️ Errors:");
        result.errors.forEach((err) => console.log(`   - ${err}`));
      }
      if (result.entries.length > 0) {
        console.log("\n✅ Sample entries:");
        result.entries.slice(0, 5).forEach((entry) => {
          console.log(`   - ${entry.deck_name} (Tier ${entry.tier})`);
        });
      }
    } else if (scraperName === "both") {
      // Lazy load manager to check env vars
      const manager = await import("./tier-list-manager");
      console.log("🔍 Running both scrapers via tier-list-manager...");
      const result = await manager.updateTierListData("both");
      console.log("\n📊 Results:");
      console.log(`   Entries Inserted: ${result.entriesInserted}`);
      console.log(`   Errors: ${result.errors.length}`);
      if (result.scrapeRunId) {
        console.log(`   Scrape Run ID: ${result.scrapeRunId}`);
      }
      if (result.errors.length > 0) {
        console.log("\n⚠️ Errors:");
        result.errors.forEach((err) => console.log(`   - ${err}`));
      }
    } else {
      console.error(`❌ Unknown scraper: ${scraperName}`);
      console.error("   Valid options: yugiohmeta | masterduelmeta | both");
      process.exit(1);
    }
  } catch (error) {
    console.error("❌ Scraper failed:", error);
    process.exit(1);
  }
}

runScraper();
