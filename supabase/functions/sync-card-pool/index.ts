/**
 * Supabase Edge Function: Sync Yu-Gi-Oh! Card Pool from YGOPRODeck API
 *
 * Fetches all card data from YGOPRODeck (https://ygoprodeck.com/api-guide/) and
 * upserts it into the Supabase "cards" table. Uses paginated fetching to ensure
 * complete card_prices data (TCGPlayer, Cardmarket) is acquired.
 *
 * API: card_prices array contains cardmarket_price (€), tcgplayer_price ($),
 * coolstuffinc_price ($), ebay_price ($), amazon_price ($).
 * Rate limit: 20 requests/second.
 */

import { createClient } from "@supabase/supabase-js";
import { corsHeaders } from "../_shared/cors.ts";

// Configuration constants
const YGO_API = "https://db.ygoprodeck.com/api/v7/cardinfo.php";
const BATCH_SIZE = 1000;
const API_FETCH_SIZE = 500; // Cards per API request (pagination)
const API_DELAY_MS = 100; // Delay between API requests (respect 20 req/sec limit)

// Type definitions - per YGOPRODeck API v7 spec
interface YGOCardPrices {
  cardmarket_price?: string;
  tcgplayer_price?: string;
  coolstuffinc_price?: string;
  ebay_price?: string;
  amazon_price?: string;
}

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
  card_images?: Array<{ id: number; image_url: string; image_url_small?: string }>;
  card_sets?: Array<{ set_name: string; set_code: string; set_rarity: string; set_rarity_code?: string; set_price?: string }>;
  card_prices?: Array<YGOCardPrices>;
  misc_info?: Array<{ md_rarity?: string }>;
}

interface SyncStats {
  success: boolean;
  totalCardsFetched: number;
  cardsWithPrices: number;
  batchesProcessed: number;
  insertedOrUpdated: number;
  warnings: number;
  errors: number;
  errorDetails?: string[];
  timestamp: string;
}

/** Delay helper for rate limiting */
function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Fetches all card data from YGOPRODeck API using pagination.
 * Uses num/offset to fetch in chunks - ensures complete card_prices data.
 * @see https://ygoprodeck.com/api-guide/
 */
async function fetchYGOCards(): Promise<YGOCard[]> {
  const allCards: YGOCard[] = [];
  let offset = 0;
  let totalRows = 0;

  console.log(
    `Fetching card data from YGOPRODeck (paginated, misc=yes for prices/rarity)...`,
  );

  for (let page = 0; ; page++) {
    const url = `${YGO_API}?misc=yes&num=${API_FETCH_SIZE}&offset=${offset}`;
    const response = await fetch(url);

    if (!response.ok) {
      throw new Error(
        `YGOPRODeck API error: ${response.status} ${response.statusText}`,
      );
    }

    const json = await response.json();

    if (!json.data || !Array.isArray(json.data)) {
      throw new Error("Unexpected YGOPRODeck API response structure");
    }

    const batch = json.data as YGOCard[];
    allCards.push(...batch);

    if (json.meta) {
      totalRows = json.meta.total_rows ?? totalRows;
    }

    console.log(
      `Fetched page ${page + 1}: ${batch.length} cards (total: ${allCards.length})`,
    );

    if (batch.length < API_FETCH_SIZE) {
      break;
    }

    offset += API_FETCH_SIZE;
    await delay(API_DELAY_MS);
  }

  console.log(`Fetched ${allCards.length} cards total.`);

  return allCards;
}

/**
 * Normalizes card_prices from API for storage.
 * API returns array with one object containing vendor prices.
 * We preserve the full structure for TCGPlayer ($) and Cardmarket (€).
 */
function normalizeCardPrices(
  card_prices: YGOCardPrices[] | undefined,
): YGOCardPrices[] | null {
  if (!card_prices || card_prices.length === 0) {
    return null;
  }
  const first = card_prices[0];
  if (!first || (typeof first !== "object")) {
    return null;
  }
  return [first];
}

/**
 * YGOPRODeck temporary spoiler IDs live in 10xxxxxxx (100M–200M) before
 * official passcodes. Skill/token cards use other high ranges and keep S3 art.
 */
function isTemporarySpoilerId(cardId: number): boolean {
  return (
    Number.isFinite(cardId) && cardId >= 100_000_000 && cardId < 200_000_000
  );
}

/**
 * Prefer self-hosted S3 thumbs over YGOPRODeck CDN URLs so monthly sync
 * does not reintroduce hotlinks or Supabase Storage paths.
 * Set CARD_IMAGE_BASE_URL (or NEXT_PUBLIC_CARD_IMAGE_BASE_URL) on the function.
 *
 * Temporary spoiler IDs are skipped entirely by sync (see syncCardPool) — they
 * become renamed official passcodes with art already on S3.
 */
function mapCardImagesForStorage(
  cardId: number,
  cardImages: YGOCard["card_images"],
): YGOCard["card_images"] | null {
  const baseRaw =
    Deno.env.get("CARD_IMAGE_BASE_URL") ??
    Deno.env.get("NEXT_PUBLIC_CARD_IMAGE_BASE_URL");
  const base = baseRaw?.trim().replace(/\/$/, "");

  if (base) {
    // Only attach S3 URLs when YGO reported art for this card.
    if (!cardImages || cardImages.length === 0) {
      return null;
    }
    const url = `${base}/${cardId}.jpg`;
    return [{ id: cardId, image_url: url, image_url_small: url }];
  }

  return cardImages ?? null;
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
    card_images: mapCardImagesForStorage(card.id, card.card_images),
    card_sets: card.card_sets ?? null,
    card_prices: normalizeCardPrices(card.card_prices),
    misc_info: card.misc_info ?? null,
  };
}

/**
 * Upserts a batch of card records into Supabase
 */
async function upsertCardBatch(
  supabase: ReturnType<typeof createClient<any, "public">>,
  records: Record<string, unknown>[],
  batchIndex: number,
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

  console.log(
    `Processing ${totalCards} cards in ${batchesProcessed} batches...`,
  );

  let skippedTemporarySpoilers = 0;

  for (let i = 0; i < totalCards; i += BATCH_SIZE) {
    const batch = cards.slice(i, i + BATCH_SIZE);
    const batchIndex = Math.floor(i / BATCH_SIZE);

    // Temporary spoiler IDs (10xxxxxxx) are renamed into official passcodes.
    // Upserting them reintroduces artless duplicate stubs in the library.
    const syncable = batch.filter((card) => {
      if (isTemporarySpoilerId(card.id)) {
        skippedTemporarySpoilers += 1;
        return false;
      }
      return true;
    });

    if (syncable.length === 0) {
      console.log(
        `Batch ${batchIndex + 1}: skipped ${batch.length} temporary spoiler IDs`,
      );
      continue;
    }

    // Transform cards to records
    const records = syncable.map(transformCardToRecord);

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

  // Drop artless temporary spoiler stubs left over from earlier syncs.
  const { data: stubs, error: stubQueryError } = await supabase
    .from("cards")
    .select("id")
    .gte("id", 100_000_000)
    .lt("id", 200_000_000)
    .is("card_images", null);

  if (stubQueryError) {
    const msg = `Failed to list artless temporary spoiler stubs: ${stubQueryError.message}`;
    errors.push(msg);
    console.error(msg);
  } else {
    const stubIds = (stubs ?? []).map((row) => row.id as number);
    if (stubIds.length > 0) {
      const { error: factsErr } = await supabase
        .from("card_facts")
        .delete()
        .in("card_id", stubIds);
      const { error: embErr } = await supabase
        .from("card_embeddings")
        .delete()
        .in("card_id", stubIds);
      if (factsErr || embErr) {
        const msg = `Failed to clear FK rows for spoiler stubs: ${
          factsErr?.message ?? embErr?.message
        }`;
        errors.push(msg);
        console.error(msg);
      } else {
        const { data: purged, error: purgeError } = await supabase
          .from("cards")
          .delete()
          .in("id", stubIds)
          .select("id");
        if (purgeError) {
          const msg = `Failed to purge artless temporary spoiler stubs: ${purgeError.message}`;
          errors.push(msg);
          console.error(msg);
        } else {
          console.log(
            `Purged ${purged?.length ?? 0} artless temporary spoiler stubs; skipped ${skippedTemporarySpoilers} during upsert`,
          );
        }
      }
    } else {
      console.log(
        `No artless temporary spoiler stubs to purge; skipped ${skippedTemporarySpoilers} during upsert`,
      );
    }
  }

  const cardsWithPrices = cards.filter(
    (c) =>
      c.card_prices &&
      c.card_prices.length > 0 &&
      c.card_prices[0] &&
      (c.card_prices[0].tcgplayer_price || c.card_prices[0].cardmarket_price),
  ).length;

  console.log(
    `✅ Card pool sync complete! ${cardsWithPrices}/${totalCards} cards have price data.`,
  );

  return {
    success: errors.length === 0,
    totalCardsFetched: totalCards,
    cardsWithPrices,
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
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  try {
    const stats = await syncCardPool();

    return new Response(JSON.stringify(stats), {
      status: stats.success ? 200 : 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
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
      },
    );
  }
});
