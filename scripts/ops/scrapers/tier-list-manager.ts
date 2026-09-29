/**
 * Tier List Meta Manager
 * 
 * Manages tier list snapshots: ingestion, validation, storage
 * No card relationships, no decklists - tier information only
 */

import { createClient } from "@supabase/supabase-js";
import { scrapeYuGiOhMeta, validateTierEntry } from "./yugiohmeta-scraper";
import { scrapeMasterDuelMetaTierList, validateTierEntry as validateMDEntry } from "./masterduelmeta-tier-scraper";

interface TierListEntry {
  deck_name: string;
  tier: number;
  playstyle?: "combo" | "control" | "midrange" | "stun";
  notes?: string;
}

// ScrapeResult type is inferred from scraper function return types
// No need to redeclare here

interface UpdateSummary {
  entriesInserted: number;
  errors: string[];
  scrapeRunId?: string;
}

/**
 * Get Supabase client (lazy-loaded to allow dotenv to load first)
 */
function getSupabaseClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !supabaseServiceKey) {
    throw new Error("Missing Supabase environment variables");
  }

  return createClient(supabaseUrl, supabaseServiceKey);
}

/**
 * Store tier list snapshot in database
 */
async function storeTierSnapshot(
  entry: TierListEntry,
  format: "tcg" | "master_duel",
  source: "yugiohmeta" | "masterduelmeta",
  scrapeRunId: string,
  scrapedAt: Date
): Promise<boolean> {
  try {
    const supabase = getSupabaseClient();
    const { error } = await supabase.from("tier_list_snapshots").insert({
      deck_name: entry.deck_name.trim(),
      tier: entry.tier,
      format,
      source,
      scraped_at: scrapedAt.toISOString(),
      scrape_run_id: scrapeRunId,
      playstyle: entry.playstyle || null,
      notes: entry.notes ? entry.notes.substring(0, 500) : null, // Enforce max length
    });

    if (error) {
      // If duplicate (same scrape_run_id), that's okay - idempotent
      if (error.code === "23505") {
        console.log(`  ℹ️ Skipping duplicate: ${entry.deck_name} (tier ${entry.tier})`);
        return true;
      }
      throw error;
    }

    return true;
  } catch (error) {
    console.error(`  ❌ Failed to store ${entry.deck_name}:`, error);
    return false;
  }
}

/**
 * Update tier list data for a specific format
 */
export async function updateTierListData(
  format: "tcg" | "master_duel" | "both" = "both"
): Promise<UpdateSummary> {
  const summary: UpdateSummary = {
    entriesInserted: 0,
    errors: [],
  };

  try {
    console.log(`🔄 Starting tier list update for format: ${format}`);

    // Scrape TCG if requested
    if (format === "tcg" || format === "both") {
      try {
        console.log("📥 Scraping TCG tier list from YuGiOhMeta...");
        const tcgResult = await scrapeYuGiOhMeta();

        // Validate and store entries
        for (const entry of tcgResult.entries) {
          if (validateTierEntry(entry)) {
            const stored = await storeTierSnapshot(
              entry,
              "tcg",
              "yugiohmeta",
              tcgResult.scrapeRunId,
              tcgResult.scrapedAt
            );
            if (stored) {
              summary.entriesInserted++;
            }
          } else {
            summary.errors.push(`Invalid TCG entry: ${entry.deck_name}`);
          }
        }

        // Add scrape errors to summary
        summary.errors.push(...tcgResult.errors);
        if (tcgResult.entries.length > 0) {
          summary.scrapeRunId = tcgResult.scrapeRunId;
        }

        console.log(`✅ TCG: ${tcgResult.entries.length} entries scraped, ${summary.entriesInserted} stored`);
      } catch (error) {
        const errorMsg = `TCG scraping failed: ${error instanceof Error ? error.message : String(error)}`;
        console.error(`❌ ${errorMsg}`);
        summary.errors.push(errorMsg);
      }
    }

    // Scrape Master Duel if requested
    if (format === "master_duel" || format === "both") {
      try {
        console.log("📥 Scraping Master Duel tier list from MasterDuelMeta...");
        const mdResult = await scrapeMasterDuelMetaTierList();

        // Validate and store entries
        for (const entry of mdResult.entries) {
          if (validateMDEntry(entry)) {
            const stored = await storeTierSnapshot(
              entry,
              "master_duel",
              "masterduelmeta",
              mdResult.scrapeRunId,
              mdResult.scrapedAt
            );
            if (stored) {
              summary.entriesInserted++;
            }
          } else {
            summary.errors.push(`Invalid Master Duel entry: ${entry.deck_name}`);
          }
        }

        // Add scrape errors to summary
        summary.errors.push(...mdResult.errors);
        if (mdResult.entries.length > 0 && !summary.scrapeRunId) {
          summary.scrapeRunId = mdResult.scrapeRunId;
        }

        console.log(`✅ Master Duel: ${mdResult.entries.length} entries scraped, ${summary.entriesInserted} stored`);
      } catch (error) {
        const errorMsg = `Master Duel scraping failed: ${error instanceof Error ? error.message : String(error)}`;
        console.error(`❌ ${errorMsg}`);
        summary.errors.push(errorMsg);
      }
    }

    console.log(`✅ Tier list update complete: ${summary.entriesInserted} entries stored`);

    return summary;
  } catch (error) {
    const errorMsg = `Tier list update failed: ${error instanceof Error ? error.message : String(error)}`;
    console.error(`❌ ${errorMsg}`);
    summary.errors.push(errorMsg);
    return summary;
  }
}

/**
 * Get latest tier list snapshot for a format
 */
export async function getLatestTierList(
  format: "tcg" | "master_duel"
): Promise<Array<{ deck_name: string; tier: number; playstyle?: string | null; notes?: string | null }>> {
  try {
    const supabase = getSupabaseClient();
    // Get most recent scrape run for this format
    const { data: latestRun } = await supabase
      .from("tier_list_snapshots")
      .select("scrape_run_id, scraped_at")
      .eq("format", format)
      .order("scraped_at", { ascending: false })
      .limit(1)
      .single();

    if (!latestRun) {
      return [];
    }

    // Get all entries from that run
    const { data: entries } = await supabase
      .from("tier_list_snapshots")
      .select("deck_name, tier, playstyle, notes")
      .eq("format", format)
      .eq("scrape_run_id", latestRun.scrape_run_id)
      .order("tier, deck_name");

    return (entries || []) as Array<{ deck_name: string; tier: number; playstyle?: string | null; notes?: string | null }>;
  } catch (error) {
    console.error("Error fetching latest tier list:", error);
    return [];
  }
}

/**
 * Prune old tier list snapshots (keep last 90 days)
 */
export async function pruneOldSnapshots(): Promise<number> {
  const supabase = getSupabaseClient();
  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - 90);

  // First, count how many will be deleted
  const { count } = await supabase
    .from("tier_list_snapshots")
    .select("*", { count: "exact", head: true })
    .lt("scraped_at", cutoffDate.toISOString());

  // Then delete them
  const { error } = await supabase
    .from("tier_list_snapshots")
    .delete()
    .lt("scraped_at", cutoffDate.toISOString());

  if (error) {
    console.error("Failed to prune old snapshots:", error);
    return 0;
  }

  const prunedCount = count || 0;
  console.log(`🗑️ Pruned ${prunedCount} old tier list snapshots`);
  return prunedCount;
}
