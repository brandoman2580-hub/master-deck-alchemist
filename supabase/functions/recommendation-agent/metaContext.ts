/**
 * Meta Context Builder
 * Builds meta context for inclusion in recommendation prompts
 */

import { createClient } from "@supabase/supabase-js";

const supabaseUrl = Deno.env.get("SUPABASE_URL") || Deno.env.get("NEXT_PUBLIC_SUPABASE_URL");
const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

if (!supabaseUrl || !supabaseServiceKey) {
  throw new Error("Missing Supabase environment variables");
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

interface MetaThreat {
  cardName: string;
  prevalence: number; // 0-1
  reasoning: string;
}

interface CounterCard {
  cardId: number;
  cardName: string;
  effectiveness: number; // 0-1
  explanation: string;
}

/**
 * Build meta context string for inclusion in prompts
 * Updated to use tier_list_snapshots table
 */
export async function buildMetaContext(
  format: "TCG" | "MASTER_DUEL"
): Promise<string> {
  try {
    // Map format to tier_list_snapshots format
    const tierListFormat = format === "TCG" ? "tcg" : "master_duel";
    
    // Get latest scrape run for this format
    const { data: latestRun, error: runError } = await supabase
      .from("tier_list_snapshots")
      .select("scrape_run_id, scraped_at")
      .eq("format", tierListFormat)
      .order("scraped_at", { ascending: false })
      .limit(1)
      .single();

    if (runError || !latestRun) {
      console.warn(`[META] No tier list data found for ${format}`);
      return `Current ${format} meta: No recent tier list data available.`;
    }

    // Get all entries from the latest scrape run
    const { data: tierList, error: listError } = await supabase
      .from("tier_list_snapshots")
      .select("deck_name, tier, scraped_at")
      .eq("format", tierListFormat)
      .eq("scrape_run_id", latestRun.scrape_run_id)
      .order("tier, deck_name");

    if (listError || !tierList || tierList.length === 0) {
      console.warn(`[META] No tier list entries found for ${format}`);
      return `Current ${format} meta: No tier list data available.`;
    }

    // Group by tier
    const tier1Decks: string[] = [];
    const tier2Decks: string[] = [];
    const tier3Decks: string[] = [];
    const tier4Decks: string[] = [];

    for (const entry of tierList) {
      if (entry.tier === 1) tier1Decks.push(entry.deck_name);
      else if (entry.tier === 2) tier2Decks.push(entry.deck_name);
      else if (entry.tier === 3) tier3Decks.push(entry.deck_name);
      else if (entry.tier === 4) tier4Decks.push(entry.deck_name);
    }

    // Get most recent scrape date
    const latestDate = latestRun.scraped_at ? new Date(latestRun.scraped_at).toLocaleDateString() : "unknown";

    // Build context string
    let context = `Current ${format} meta tier list (as of ${latestDate}):\n\n`;

    if (tier1Decks.length > 0) {
      context += "Tier 1 (Top Meta):\n";
      for (const deckName of tier1Decks) {
        context += `- ${deckName}\n`;
      }
      context += "\n";
    }

    if (tier2Decks.length > 0) {
      context += "Tier 2 (Competitive):\n";
      for (const deckName of tier2Decks.slice(0, 10)) { // Limit to top 10
        context += `- ${deckName}\n`;
      }
      if (tier2Decks.length > 10) {
        context += `... and ${tier2Decks.length - 10} more\n`;
      }
      context += "\n";
    }

    if (tier3Decks.length > 0) {
      context += "Tier 3 (Rogue):\n";
      for (const deckName of tier3Decks.slice(0, 5)) { // Limit to top 5
        context += `- ${deckName}\n`;
      }
      if (tier3Decks.length > 5) {
        context += `... and ${tier3Decks.length - 5} more\n`;
      }
      context += "\n";
    }

    return context;
  } catch (error) {
    console.error("[META] Error building meta context:", error);
    // Return empty context instead of error message to avoid breaking the prompt
    return "";
  }
}

/**
 * Identify meta threats (common disruption/interaction cards)
 * Simplified version - tier list snapshots don't have key_cards yet
 */
export async function identifyMetaThreats(
  format: "TCG" | "MASTER_DUEL"
): Promise<MetaThreat[]> {
  try {
    // For now, return empty array since tier_list_snapshots doesn't have key_cards
    // This can be enhanced later when we add card relationships
    return [];
  } catch (error) {
    console.error("[META] Error identifying meta threats:", error);
    return [];
  }
}

/**
 * Get counter cards for a specific meta deck
 * Enhanced version that uses deck name matching and strategy-based counters
 */
export async function getCounterCards(
  targetDeckName: string,
  format: "TCG" | "MASTER_DUEL"
): Promise<CounterCard[]> {
  try {
    // Map format to tier_list_snapshots format
    const tierListFormat = format === "TCG" ? "tcg" : "master_duel";
    
    // Check if target deck exists in tier list
    const { data: deckEntry } = await supabase
      .from("tier_list_snapshots")
      .select("deck_name, tier, playstyle")
      .eq("format", tierListFormat)
      .ilike("deck_name", `%${targetDeckName}%`)
      .order("scraped_at", { ascending: false })
      .limit(1)
      .single();

    if (!deckEntry) {
      console.warn(`[META] Target deck "${targetDeckName}" not found in tier list`);
      return [];
    }

    const counters: CounterCard[] = [];
    
    // Strategy-based counter selection
    if (deckEntry.playstyle) {
      const strategyCounters = await findCountersForStrategy(
        { strategy: deckEntry.playstyle, vulnerabilities: [] },
        format
      );
      counters.push(...strategyCounters);
    }
    
    // Tier-based generic counters (always include for high-tier decks)
    if (deckEntry.tier <= 2) {
      const commonCounters = [
        "Ash Blossom & Joyous Spring",
        "Infinite Impermanence",
        "Nibiru, the Primal Being",
        "Droll & Lock Bird",
        "D.D. Crow",
      ];

      const { data: cards } = await supabase
        .from("cards")
        .select("id, name")
        .in("name", commonCounters)
        .limit(5);

      if (cards) {
        for (const card of cards) {
          // Avoid duplicates
          if (!counters.find(c => c.cardId === card.id)) {
            counters.push({
              cardId: card.id,
              cardName: card.name,
              effectiveness: deckEntry.tier === 1 ? 0.8 : 0.7,
              explanation: `Universal meta counter effective against Tier ${deckEntry.tier} decks like ${deckEntry.deck_name}`,
            });
          }
        }
      }
    }

    // Sort by effectiveness (highest first)
    counters.sort((a, b) => b.effectiveness - a.effectiveness);

    return counters.slice(0, 10); // Return top 10 counters
  } catch (error) {
    console.error("[META] Error getting counter cards:", error);
    return [];
  }
}

/**
 * Analyze deck strategy from key cards
 */
function analyzeDeckStrategy(cards: Array<{ type: string; desc: string }>): {
  strategy: "combo" | "control" | "stun" | "midrange";
  vulnerabilities: string[];
} {
  const descs = cards.map((c) => c.desc?.toLowerCase() || "").join(" ");
  const types = cards.map((c) => c.type?.toLowerCase() || "").join(" ");

  const vulnerabilities: string[] = [];

  // Detect combo strategy
  if (
    descs.includes("special summon") ||
    descs.includes("summon") ||
    types.includes("xyz") ||
    types.includes("synchro") ||
    types.includes("link")
  ) {
    vulnerabilities.push("special_summon_reliant");
  }

  // Detect search-heavy strategy
  if (descs.includes("search") || descs.includes("add") || descs.includes("deck")) {
    vulnerabilities.push("search_reliant");
  }

  // Detect graveyard strategy
  if (descs.includes("graveyard") || descs.includes("banish")) {
    vulnerabilities.push("graveyard_reliant");
  }

  // Detect spell/trap reliance
  if (types.includes("spell") || types.includes("trap")) {
    vulnerabilities.push("spell_trap_reliant");
  }

  // Determine primary strategy
  let strategy: "combo" | "control" | "stun" | "midrange" = "midrange";
  if (vulnerabilities.includes("special_summon_reliant")) {
    strategy = "combo";
  } else if (descs.includes("negate") || descs.includes("destroy")) {
    strategy = "control";
  } else if (descs.includes("cannot") || descs.includes("prevent")) {
    strategy = "stun";
  }

  return { strategy, vulnerabilities };
}

/**
 * Find counter cards for a specific strategy
 */
async function findCountersForStrategy(
  deckStrategy: { strategy: string; vulnerabilities: string[] },
  format: "TCG" | "MASTER_DUEL"
): Promise<CounterCard[]> {
  const counters: CounterCard[] = [];

  // Map vulnerabilities to counter cards
  const counterMap: Record<string, string[]> = {
    special_summon_reliant: [
      "Nibiru, the Primal Being",
      "Summon Limit",
      "Vanity's Emptiness",
      "Gozen Match",
      "Rivalry of Warlords",
    ],
    search_reliant: [
      "Droll & Lock Bird",
      "Ash Blossom & Joyous Spring",
      "Artifact Lancea",
    ],
    graveyard_reliant: [
      "D.D. Crow",
      "Artifact Lancea",
      "Macro Cosmos",
      "Dimensional Fissure",
    ],
    spell_trap_reliant: [
      "Harpie's Feather Duster",
      "Heavy Storm",
      "Royal Decree",
      "Anti-Spell Fragrance",
    ],
  };

  // Find counter cards
  const counterNames: string[] = [];
  for (const vulnerability of deckStrategy.vulnerabilities) {
    const cards = counterMap[vulnerability] || [];
    counterNames.push(...cards);
  }

  // Fetch card IDs
  if (counterNames.length > 0) {
    const { data: cards } = await supabase
      .from("cards")
      .select("id, name")
      .in("name", counterNames);

    if (cards) {
      for (const card of cards) {
        counters.push({
          cardId: card.id,
          cardName: card.name,
          effectiveness: 0.8, // Default effectiveness
          explanation: `Counters ${deckStrategy.strategy} strategy`,
        });
      }
    }
  }

  return counters;
}

/**
 * Compare current snapshot to snapshot from 30 days ago to identify trends
 * Updated to use tier_list_snapshots
 */
export async function getMetaTrends(
  format: "TCG" | "MASTER_DUEL"
): Promise<{
  rising: string[];
  falling: string[];
  stable: string[];
}> {
  try {
    const tierListFormat = format === "TCG" ? "tcg" : "master_duel";
    const now = new Date();
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

    // Get current tier list (latest scrape)
    const { data: currentRun } = await supabase
      .from("tier_list_snapshots")
      .select("scrape_run_id, scraped_at")
      .eq("format", tierListFormat)
      .order("scraped_at", { ascending: false })
      .limit(1)
      .single();

    if (!currentRun) {
      return { rising: [], falling: [], stable: [] };
    }

    // Get current decks
    const { data: currentDecks } = await supabase
      .from("tier_list_snapshots")
      .select("deck_name, tier")
      .eq("format", tierListFormat)
      .eq("scrape_run_id", currentRun.scrape_run_id);

    // Get previous tier list (30+ days ago)
    const { data: oldRun } = await supabase
      .from("tier_list_snapshots")
      .select("scrape_run_id, scraped_at")
      .eq("format", tierListFormat)
      .lt("scraped_at", thirtyDaysAgo.toISOString())
      .order("scraped_at", { ascending: false })
      .limit(1)
      .single();

    if (!oldRun || !currentDecks) {
      return { rising: [], falling: [], stable: [] };
    }

    // Get old decks
    const { data: oldDecks } = await supabase
      .from("tier_list_snapshots")
      .select("deck_name, tier")
      .eq("format", tierListFormat)
      .eq("scrape_run_id", oldRun.scrape_run_id);

    if (!oldDecks) {
      return { rising: [], falling: [], stable: [] };
    }

    // Calculate tier changes (lower tier number = better)
    const currentTiers = new Map<string, number>();
    const oldTiers = new Map<string, number>();

    for (const deck of currentDecks) {
      currentTiers.set(deck.deck_name, deck.tier);
    }

    for (const deck of oldDecks) {
      oldTiers.set(deck.deck_name, deck.tier);
    }

    const rising: string[] = [];
    const falling: string[] = [];
    const stable: string[] = [];

    // Analyze trends based on tier changes
    const allDecks = new Set([...currentTiers.keys(), ...oldTiers.keys()]);
    for (const deckName of allDecks) {
      const currentTier = currentTiers.get(deckName);
      const oldTier = oldTiers.get(deckName);

      if (currentTier === undefined) {
        // Deck disappeared from meta
        falling.push(deckName);
      } else if (oldTier === undefined) {
        // New deck in meta
        if (currentTier <= 2) {
          rising.push(deckName);
        } else {
          stable.push(deckName);
        }
      } else {
        // Tier changed
        const tierChange = oldTier - currentTier; // Positive = improved (tier went down)
        if (tierChange > 0) {
          rising.push(deckName);
        } else if (tierChange < 0) {
          falling.push(deckName);
        } else {
          stable.push(deckName);
        }
      }
    }

    return { rising, falling, stable };
  } catch (error) {
    console.error("[META] Error getting meta trends:", error);
    return { rising: [], falling: [], stable: [] };
  }
}
