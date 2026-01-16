/**
 * Unified Meta Data Manager
 * Manages meta snapshots, calculates meta relevance, and handles data updates
 */

import { createClient } from "@supabase/supabase-js";
import { scrapeYGOProDeckMeta } from "./ygoprodeck-scraper";
import { scrapeMasterDuelMeta } from "./masterduelmeta-scraper";

interface MetaSnapshot {
  deck_name: string;
  date: Date;
  tier: number;
  key_cards: number[];
  play_rate?: number;
  format: "TCG" | "MASTER_DUEL";
}

interface UpdateSummary {
  decksAdded: number;
  cardsUpdated: number;
  errors: string[];
  snapshotsCreated: number;
}

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  throw new Error("Missing Supabase environment variables");
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

/**
 * Validate meta snapshot before insertion
 */
function validateMetaSnapshot(snapshot: MetaSnapshot): boolean {
  // Check required fields
  if (!snapshot.deck_name || snapshot.deck_name.trim().length === 0) {
    return false;
  }
  if (!snapshot.date || isNaN(snapshot.date.getTime())) {
    return false;
  }
  if (snapshot.tier < 1 || snapshot.tier > 3) {
    return false;
  }
  if (snapshot.format !== "TCG" && snapshot.format !== "MASTER_DUEL") {
    return false;
  }
  if (!Array.isArray(snapshot.key_cards)) {
    return false;
  }
  if (snapshot.play_rate !== undefined && (snapshot.play_rate < 0 || snapshot.play_rate > 100)) {
    return false;
  }
  return true;
}

/**
 * Update meta data by scraping and inserting snapshots
 */
export async function updateMetaData(
  format: "TCG" | "MASTER_DUEL" | "BOTH" = "BOTH"
): Promise<UpdateSummary> {
  const summary: UpdateSummary = {
    decksAdded: 0,
    cardsUpdated: 0,
    errors: [],
    snapshotsCreated: 0,
  };

  try {
    console.log(`🔄 Starting meta data update for format: ${format}`);

    const snapshots: MetaSnapshot[] = [];

    // Scrape based on format
    if (format === "TCG" || format === "BOTH") {
      try {
        console.log("📥 Scraping TCG meta from YGOProDeck...");
        const tcgSnapshots = await scrapeYGOProDeckMeta();
        tcgSnapshots.forEach((s) => {
          snapshots.push({ ...s, format: "TCG" });
        });
        console.log(`✅ Scraped ${tcgSnapshots.length} TCG snapshots`);
      } catch (error) {
        const errorMsg = `TCG scraping failed: ${error instanceof Error ? error.message : String(error)}`;
        console.error(`❌ ${errorMsg}`);
        summary.errors.push(errorMsg);
      }
    }

    if (format === "MASTER_DUEL" || format === "BOTH") {
      try {
        console.log("📥 Scraping Master Duel meta from MasterDuelMeta...");
        const mdSnapshots = await scrapeMasterDuelMeta();
        mdSnapshots.forEach((s) => {
          snapshots.push({ ...s, format: "MASTER_DUEL" });
        });
        console.log(`✅ Scraped ${mdSnapshots.length} Master Duel snapshots`);
      } catch (error) {
        const errorMsg = `Master Duel scraping failed: ${error instanceof Error ? error.message : String(error)}`;
        console.error(`❌ ${errorMsg}`);
        summary.errors.push(errorMsg);
      }
    }

    // Validate and insert snapshots
    const validSnapshots = snapshots.filter(validateMetaSnapshot);
    console.log(`📊 Valid snapshots: ${validSnapshots.length}/${snapshots.length}`);

    for (const snapshot of validSnapshots) {
      try {
        const { error } = await supabase.from("meta_snapshots").upsert(
          {
            snapshot_date: snapshot.date.toISOString().split("T")[0],
            format: snapshot.format,
            deck_name: snapshot.deck_name,
            tier: snapshot.tier,
            play_rate: snapshot.play_rate || null,
            key_cards: snapshot.key_cards,
          },
          {
            onConflict: "snapshot_date,format,deck_name",
          }
        );

        if (error) {
          throw error;
        }

        summary.snapshotsCreated++;
        summary.decksAdded++;
      } catch (error) {
        const errorMsg = `Failed to insert snapshot for ${snapshot.deck_name}: ${error instanceof Error ? error.message : String(error)}`;
        console.error(`❌ ${errorMsg}`);
        summary.errors.push(errorMsg);
      }
    }

    // Update meta relevance for all cards
    console.log("🔄 Calculating meta relevance scores...");
    const cardsUpdated = await updateMetaRelevance();
    summary.cardsUpdated = cardsUpdated;

    console.log(`✅ Meta update complete: ${summary.snapshotsCreated} snapshots, ${summary.cardsUpdated} cards updated`);

    return summary;
  } catch (error) {
    const errorMsg = `Meta update failed: ${error instanceof Error ? error.message : String(error)}`;
    console.error(`❌ ${errorMsg}`);
    summary.errors.push(errorMsg);
    return summary;
  }
}

/**
 * Calculate meta relevance score for a card
 */
export async function calculateMetaRelevance(
  cardId: number,
  format: "TCG" | "MASTER_DUEL"
): Promise<number> {
  // Fetch all meta snapshots for this format
  const { data: snapshots, error } = await supabase
    .from("meta_snapshots")
    .select("*")
    .eq("format", format)
    .order("snapshot_date", { ascending: false })
    .limit(30); // Last 30 snapshots

  if (error || !snapshots || snapshots.length === 0) {
    return 0.0;
  }

  const totalDecks = snapshots.length;
  let deckCount = 0;
  let tierSum = 0;
  let playRateSum = 0;
  let playRateCount = 0;

  for (const snapshot of snapshots) {
    const keyCards = (snapshot.key_cards as number[]) || [];
    if (keyCards.includes(cardId)) {
      deckCount++;

      // Tier score: Tier 1 = 1.0, Tier 2 = 0.6, Tier 3 = 0.3
      const tierScore = snapshot.tier === 1 ? 1.0 : snapshot.tier === 2 ? 0.6 : 0.3;
      tierSum += tierScore;

      if (snapshot.play_rate !== null && snapshot.play_rate !== undefined) {
        playRateSum += snapshot.play_rate;
        playRateCount++;
      }
    }
  }

  if (deckCount === 0) {
    return 0.0;
  }

  // Calculate components
  const deckCountComponent = deckCount / totalDecks * 0.4;
  const avgTierScore = tierSum / deckCount;
  const tierComponent = avgTierScore * 0.3;
  const avgPlayRate = playRateCount > 0 ? playRateSum / playRateCount : 0;
  const playRateComponent = (avgPlayRate / 100) * 0.3;

  // Final score
  let relevance = deckCountComponent + tierComponent + playRateComponent;

  // Cap at 1.0 for cards appearing in 3+ Tier 1 decks
  if (deckCount >= 3) {
    const tier1Count = snapshots.filter(
      (s) => s.tier === 1 && ((s.key_cards as number[]) || []).includes(cardId)
    ).length;
    if (tier1Count >= 3) {
      relevance = Math.min(relevance, 1.0);
    }
  }

  return Math.min(relevance, 1.0);
}

/**
 * Update meta relevance for all cards mentioned in meta snapshots
 */
async function updateMetaRelevance(): Promise<number> {
  // Get all unique card IDs from meta snapshots
  const { data: snapshots, error: snapshotsError } = await supabase
    .from("meta_snapshots")
    .select("key_cards, format");

  if (snapshotsError || !snapshots) {
    console.error("Failed to fetch snapshots for meta relevance update");
    return 0;
  }

  const cardIds = new Set<number>();
  const formats = new Set<"TCG" | "MASTER_DUEL">();

  for (const snapshot of snapshots) {
    formats.add(snapshot.format as "TCG" | "MASTER_DUEL");
    const keyCards = (snapshot.key_cards as number[]) || [];
    keyCards.forEach((id) => cardIds.add(id));
  }

  let updatedCount = 0;

  // Update relevance for each format
  for (const format of formats) {
    for (const cardId of cardIds) {
      try {
        const relevance = await calculateMetaRelevance(cardId, format);

        // Update or insert card_metadata
        const { error } = await supabase.from("card_metadata").upsert(
          {
            card_id: cardId,
            meta_relevance: relevance,
            last_meta_update: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          },
          {
            onConflict: "card_id",
          }
        );

        if (error) {
          console.warn(`Failed to update meta relevance for card ${cardId}:`, error);
        } else {
          updatedCount++;
        }
      } catch (error) {
        console.warn(`Error calculating meta relevance for card ${cardId}:`, error);
      }
    }
  }

  return updatedCount;
}

/**
 * Prune old meta snapshots (older than 90 days)
 * Keeps at least 5 most recent snapshots per format
 */
export async function pruneOldSnapshots(): Promise<number> {
  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - 90);

  // Get snapshots to keep (5 most recent per format)
  const { data: keepSnapshots, error: keepError } = await supabase
    .from("meta_snapshots")
    .select("id, format, snapshot_date")
    .order("snapshot_date", { ascending: false });

  if (keepError || !keepSnapshots) {
    console.error("Failed to fetch snapshots for pruning");
    return 0;
  }

  // Group by format and keep top 5
  const keepIds = new Set<number>();
  const formatCounts = new Map<"TCG" | "MASTER_DUEL", number>();

  for (const snapshot of keepSnapshots) {
    const format = snapshot.format as "TCG" | "MASTER_DUEL";
    const count = formatCounts.get(format) || 0;
    if (count < 5) {
      keepIds.add(snapshot.id);
      formatCounts.set(format, count + 1);
    }
  }

  // First, count how many will be deleted
  const { count, error: countError } = await supabase
    .from("meta_snapshots")
    .select("*", { count: "exact", head: true })
    .lt("snapshot_date", cutoffDate.toISOString().split("T")[0])
    .not("id", "in", `(${Array.from(keepIds).join(",")})`);

  if (countError) {
    console.error("Failed to count old snapshots:", countError);
    return 0;
  }

  // Then delete them
  const { error: deleteError } = await supabase
    .from("meta_snapshots")
    .delete()
    .lt("snapshot_date", cutoffDate.toISOString().split("T")[0])
    .not("id", "in", `(${Array.from(keepIds).join(",")})`);

  if (deleteError) {
    console.error("Failed to prune old snapshots:", deleteError);
    return 0;
  }

  const prunedCount = count || 0;
  console.log(`🗑️ Pruned ${prunedCount} old meta snapshots`);
  return prunedCount;
}
