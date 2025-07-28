// api.ts
import { createClient } from "@supabase/supabase-js";
import { Card, CardSearchParams } from "@/types/card";
import { BanStatus } from "@/types/types";

// 1. Setup your Supabase client
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

// 2. Card data search, now from Supabase instead of YGOPRODeck
export async function getCardData(params: CardSearchParams): Promise<Card[]> {
  // Check if this is a filtered search or a request for all cards
  const hasFilters = params.name || params.type || params.race || params.attribute || 
                    params.level || params.atk || params.def || params.archetype || params.effect;

  if (hasFilters) {
    // For filtered searches, use single query (should return < 1000 results)
    return await fetchFilteredCards(params);
  } else {
    // For fetching all cards, use pagination to get complete dataset
    return await fetchAllCards(params);
  }
}

async function fetchFilteredCards(params: CardSearchParams): Promise<Card[]> {
  let query = supabase
    .from("cards")
    .select("*");

  // Apply filters
  if (params.name && params.name.trim()) query = query.ilike("name", `%${params.name}%`);
  if (params.type && params.type.trim()) query = query.eq("type", params.type);
  if (params.race && params.race.trim()) query = query.eq("race", params.race);
  if (params.attribute && params.attribute.trim()) query = query.eq("attribute", params.attribute);
  if (params.level && params.level.trim()) query = query.eq("level", params.level);
  if (params.atk && params.atk.trim()) query = query.eq("atk", params.atk);
  if (params.def && params.def.trim()) query = query.eq("def", params.def);
  if (params.archetype && params.archetype.trim()) query = query.ilike("archetype", `%${params.archetype}%`);

  console.log("Executing filtered Supabase query...");
  const { data, error } = await query;

  if (error) {
    console.error("Error fetching filtered cards from Supabase:", error);
    return [];
  }

  if (!data) return [];

  let cards = data.map(mapCardData) as Card[];
  console.log(`Fetched ${cards.length} filtered cards from Supabase`);

  // Apply effect filter
  if (params.effect && params.effect.trim() !== "") {
    const effectLower = params.effect.toLowerCase();
    cards = cards.filter((card) =>
      card.desc?.toLowerCase().includes(effectLower)
    );
  }

  // Sort results
  if (params.sort) {
    cards = sortCards(cards, params.sort, params.sortDirection || "asc");
  }

  return cards;
}

async function fetchAllCards(params: CardSearchParams): Promise<Card[]> {
  console.log("Fetching all cards using pagination...");
  const allCards: Card[] = [];
  const batchSize = 1000;
  let offset = 0;
  let hasMore = true;

  while (hasMore) {
    const { data, error } = await supabase
      .from("cards")
      .select("*")
      .range(offset, offset + batchSize - 1);

    if (error) {
      console.error("Error fetching cards batch:", error);
      break;
    }

    if (!data || data.length === 0) {
      hasMore = false;
      break;
    }

    const batchCards = data.map(mapCardData) as Card[];
    allCards.push(...batchCards);
    
    console.log(`Fetched batch: ${data.length} cards (total: ${allCards.length})`);
    
    // If we got less than the batch size, we've reached the end
    if (data.length < batchSize) {
      hasMore = false;
    } else {
      offset += batchSize;
    }
  }

  console.log(`Fetched all ${allCards.length} cards from Supabase`);

  // Sort results if needed
  if (params.sort) {
    return sortCards(allCards, params.sort, params.sortDirection || "asc");
  }

  return allCards;
}

function mapCardData(card: any) {
  return {
    ...card,
    deckInstanceId: "", // This will be set when added to deck
    // Add missing fields with default values to match Card interface
    card_images: card.card_images || [{ 
      id: card.id, 
      image_url: `https://images.ygoprodeck.com/images/cards/${card.id}.jpg`,
      image_url_small: `https://images.ygoprodeck.com/images/cards_small/${card.id}.jpg`
    }],
    card_sets: card.card_sets || [],
    card_prices: card.card_prices || [{ 
      cardmarket_price: "0", 
      tcgplayer_price: "0", 
      ebay_price: "0", 
      amazon_price: "0" 
    }],
    misc_info: card.misc_info || [{ md_rarity: "" }],
  };
}

function sortCards(
  cards: Card[],
  sortBy: string,
  direction: "asc" | "desc"
): Card[] {
  return [...cards].sort((a, b) => {
    let valueA;
    let valueB;

    switch (sortBy) {
      case "name":
        valueA = a.name;
        valueB = b.name;
        break;
      case "atk":
        valueA = a.atk || 0;
        valueB = b.atk || 0;
        break;
      case "def":
        valueA = a.def || 0;
        valueB = b.def || 0;
        break;
      case "level":
        valueA = a.level || 0;
        valueB = b.level || 0;
        break;
      default:
        return 0;
    }
    if (typeof valueA === "string" && typeof valueB === "string") {
      return direction === "asc"
        ? valueA.localeCompare(valueB)
        : valueB.localeCompare(valueA);
    } else {
      return direction === "asc"
        ? (valueA as number) - (valueB as number)
        : (valueB as number) - (valueA as number);
    }
  });
}

export interface BanlistEntry {
  id: number;
  name: string;
  banStatus: BanStatus;
}

// 3. Banlist fetch—for TCG, you should also use your Supabase cards table if you store ban info
export async function getTCGBanlist(): Promise<Record<string, BanStatus>> {
  // For now, return an empty banlist since the TCG ban status is not stored in the cards table
  // This can be updated later when TCG ban status data is available
  try {
    // Check if ban_status column exists and has data
    const { data, error } = await supabase
      .from("cards")
      .select("name, ban_status")
      .not("ban_status", "is", null)
      .limit(1);

    if (error) {
      console.warn("TCG banlist column not found, using empty banlist:", error.message);
      return {};
    }

    if (!data || data.length === 0) {
      console.warn("No TCG ban status data found, using empty banlist");
      return {};
    }

    // If we have data, fetch all ban status entries
    const { data: allData, error: allError } = await supabase
      .from("cards")
      .select("name, ban_status")
      .not("ban_status", "is", null);

    if (allError) throw allError;

    const banlist: Record<string, BanStatus> = {};
    for (const card of (allData ?? [])) {
      if (card.ban_status) {
        banlist[card.name] = card.ban_status as BanStatus;
      }
    }
    return banlist;
  } catch (error) {
    console.warn("Error fetching TCG banlist, using empty banlist:", error);
    return {};
  }
}
