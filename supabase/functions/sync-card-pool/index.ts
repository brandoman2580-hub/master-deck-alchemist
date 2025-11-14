/**
 * Supabase Edge Function: Sync Yu-Gi-Oh! Card Pool from YGOPRODeck API
 * 
 * This function fetches all card data from YGOPRODeck and upserts it into
 * the Supabase "cards" table in batches. Designed to be run via cron job
 * every 3 months to keep the card database up to date.
 */

import { createClient } from "@supabase/supabase-js";
import { corsHeaders } from "../_shared/cors.ts";

// Configuration constants
const YGO_API = "https://db.ygoprodeck.com/api/v7/cardinfo.php";
const BATCH_SIZE = 1000;

// Type definitions
interface YGOCard {
  id: number;
  name?: string;
  type?: string;
  race?: string;
  attribute?: string;
  level?: number;
  atk?: number;
  def?: number;
  desc?: string;
  archetype?: string;
  banlist_info?: {
    ban_tcg?: string;
  };
}

interface SyncStats {
  success: boolean;
  totalCardsFetched: number;
  batchesProcessed: number;
  insertedOrUpdated: number;
  warnings: number;
  errors: number;
  errorDetails?: string[];
  timestamp: string;
}

/**
 * Fetches all card data from YGOPRODeck API
 */
async function fetchYGOCards(): Promise<YGOCard[]> {
  console.log("Fetching card data from YGOPRODeck...");
  
  const response = await fetch(YGO_API);
  
  if (!response.ok) {
    throw new Error(
      `YGOPRODeck API error: ${response.status} ${response.statusText}`
    );
  }
  
  const json = await response.json();
  
  if (!json.data || !Array.isArray(json.data)) {
    throw new Error("Unexpected YGOPRODeck API response structure");
  }
  
  const cards = json.data as YGOCard[];
  console.log(`Fetched ${cards.length} cards.`);
  
  return cards;
}

/**
 * Transforms a YGO API card object into a database record
 */
function transformCardToRecord(card: YGOCard): Record<string, unknown> {
  const banlist = card.banlist_info || {};
  
  return {
    id: card.id,
    name: card.name,
    type: card.type,
    race: card.race,
    attribute: card.attribute,
    level: card.level,
    atk: card.atk,
    def: card.def,
    desc: card.desc,
    archetype: card.archetype,
    ban_tcg: banlist.ban_tcg,
  };
}

/**
 * Upserts a batch of card records into Supabase
 */
async function upsertCardBatch(
  supabase: ReturnType<typeof createClient<any, "public">>,
  records: Record<string, unknown>[],
  batchIndex: number
): Promise<{ success: boolean; count: number; warning?: string }> {
  const startIndex = batchIndex * BATCH_SIZE + 1;
  const endIndex = batchIndex * BATCH_SIZE + records.length;
  
  try {
    const { data, error } = await supabase
      .from("cards")
      .upsert(records)
      .select();
    
    if (error) {
      throw error;
    }
    
    const count = data?.length ?? records.length;
    console.log(`Upserted cards ${startIndex} to ${endIndex}`);
    
    if (!data || data.length === 0) {
      const warning = `Warning: No data returned for cards ${startIndex} to ${endIndex}`;
      console.warn(warning);
      return { success: true, count: 0, warning };
    }
    
    return { success: true, count };
  } catch (error) {
    const errorMsg = `Exception while upserting cards ${startIndex} to ${endIndex}: ${
      error instanceof Error ? error.message : String(error)
    }`;
    console.error(errorMsg);
    throw error;
  }
}

/**
 * Main sync function that orchestrates the entire card pool sync
 */
async function syncCardPool(): Promise<SyncStats> {
  const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
  const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  
  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
    throw new Error("Missing Supabase environment variables");
  }
  
  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
  
  // Fetch all cards from YGOPRODeck
  const cards = await fetchYGOCards();
  const totalCards = cards.length;
  
  // Process cards in batches
  const batchesProcessed = Math.ceil(totalCards / BATCH_SIZE);
  let insertedOrUpdated = 0;
  let warnings = 0;
  const errors: string[] = [];
  
  console.log(`Processing ${totalCards} cards in ${batchesProcessed} batches...`);
  
  for (let i = 0; i < totalCards; i += BATCH_SIZE) {
    const batch = cards.slice(i, i + BATCH_SIZE);
    const batchIndex = Math.floor(i / BATCH_SIZE);
    
    // Transform cards to records
    const records = batch.map(transformCardToRecord);
    
    try {
      const result = await upsertCardBatch(supabase, records, batchIndex);
      
      if (result.success) {
        insertedOrUpdated += result.count;
        if (result.warning) {
          warnings++;
          errors.push(result.warning);
        }
      }
    } catch (error) {
      const errorMsg = `Batch ${batchIndex + 1} failed: ${
        error instanceof Error ? error.message : String(error)
      }`;
      errors.push(errorMsg);
      console.error(errorMsg);
    }
  }
  
  console.log("✅ Card pool sync complete!");
  
  return {
    success: errors.length === 0,
    totalCardsFetched: totalCards,
    batchesProcessed,
    insertedOrUpdated,
    warnings,
    errors: errors.length,
    errorDetails: errors.length > 0 ? errors : undefined,
    timestamp: new Date().toISOString(),
  };
}

/**
 * Edge Function handler
 */
Deno.serve(async (req: Request) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }
  
  // Only allow POST requests (for cron job invocation)
  if (req.method !== "POST") {
    return new Response(
      JSON.stringify({ error: "Method not allowed" }),
      {
        status: 405,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
  
  try {
    const stats = await syncCardPool();
    
    return new Response(
      JSON.stringify(stats),
      {
        status: stats.success ? 200 : 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (error) {
    console.error("Error in sync-card-pool function:", error);
    
    const errorMessage = error instanceof Error ? error.message : String(error);
    
    return new Response(
      JSON.stringify({
        success: false,
        error: errorMessage,
        timestamp: new Date().toISOString(),
      }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});

