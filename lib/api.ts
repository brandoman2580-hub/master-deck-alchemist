import { Card, CardSearchParams } from "../types/card";
import { BanStatus } from "../types/types";
import { supabase } from "./supabaseClient";

// 2. Card data search, now from Supabase instead of YGOPRODeck
export async function getCardData(params: CardSearchParams): Promise<Card[]> {
  // Check if this is a filtered search or a request for all cards
  const hasFilters =
    params.name ||
    params.type ||
    params.race ||
    params.attribute ||
    params.level ||
    params.atk ||
    params.def ||
    params.archetype ||
    params.effect;

  if (hasFilters) {
    // For filtered searches, use single query (should return < 1000 results)
    return await fetchFilteredCards(params);
  } else {
    // For fetching all cards, use pagination to get complete dataset
    return await fetchAllCards(params);
  }
}

async function fetchFilteredCards(params: CardSearchParams): Promise<Card[]> {
  let query = supabase.from("cards").select("*");

  // Apply filters
  if (params.name && params.name.trim())
    query = query.ilike("name", `%${params.name}%`);
  if (params.type && params.type.trim()) query = query.eq("type", params.type);
  if (params.race && params.race.trim()) query = query.eq("race", params.race);
  if (params.attribute && params.attribute.trim())
    query = query.eq("attribute", params.attribute);
  if (params.level && params.level.trim())
    query = query.eq("level", params.level);
  if (params.atk && params.atk.trim()) query = query.eq("atk", params.atk);
  if (params.def && params.def.trim()) query = query.eq("def", params.def);
  if (params.archetype && params.archetype.trim())
    query = query.ilike("archetype", `%${params.archetype}%`);

  const { data, error } = await query;

  if (error) {
    return [];
  }

  if (!data) return [];

  let cards = data.map(mapCardData) as Card[];

  // Apply effect filter
  if (params.effect && params.effect.trim() !== "") {
    const effectLower = params.effect.toLowerCase();
    cards = cards.filter((card) =>
      card.desc?.toLowerCase().includes(effectLower),
    );
  }

  // Sort results
  if (params.sort) {
    cards = sortCards(cards, params.sort, params.sortDirection || "asc");
  }

  return cards;
}

async function fetchAllCards(params: CardSearchParams): Promise<Card[]> {
  const allCards: Card[] = [];
  const batchSize = 1000;
  const maxIterations = 1000; // Safety limit to prevent infinite loops
  let offset = 0;

  for (let iteration = 0; iteration < maxIterations; iteration++) {
    const { data, error } = await supabase
      .from("cards")
      .select("*")
      .range(offset, offset + batchSize - 1);

    if (error) {
      break;
    }

    if (!data || data.length === 0) {
      break;
    }

    const batchCards = data.map(mapCardData) as Card[];
    allCards.push(...batchCards);

    // If we got less than the batch size, we've reached the end
    if (data.length < batchSize) {
      break;
    }
    
    offset += batchSize;
  }

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
    card_images: card.card_images || [
      {
        id: card.id,
        image_url: `https://images.ygoprodeck.com/images/cards/${card.id}.jpg`,
        image_url_small: `https://images.ygoprodeck.com/images/cards_small/${card.id}.jpg`,
      },
    ],
    card_sets: card.card_sets || [],
    card_prices: card.card_prices || [
      {
        cardmarket_price: "0",
        tcgplayer_price: "0",
        ebay_price: "0",
        amazon_price: "0",
      },
    ],
    misc_info: card.misc_info || [{ md_rarity: "" }],
  };
}

function sortCards(
  cards: Card[],
  sortBy: string,
  direction: "asc" | "desc",
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

/**
 * Master Duel banlist entry from Supabase
 */
export interface MasterDuelBanlistEntry {
  id: number;
  card_name: string;
  ban_status: string;
}

// 3. Banlist fetch—Master Duel from Supabase master_duel_banlist table
export async function getMasterDuelBanlist(): Promise<
  Record<string, BanStatus>
> {
  try {
    const { data, error } = await supabase
      .from("master_duel_banlist")
      .select("card_name, ban_status");

    if (error) {
      // Database error - throw to be caught by error boundary
      throw new Error(
        `Failed to fetch Master Duel banlist: ${error.message}`
      );
    }

    // Empty data is expected if banlist hasn't been populated yet
    if (!data || data.length === 0) {
      return {};
    }

    const banlist: Record<string, BanStatus> = {};
    for (const entry of data) {
      if (entry.card_name && entry.ban_status) {
        banlist[entry.card_name] = entry.ban_status as BanStatus;
      }
    }
    return banlist;
  } catch (error) {
    // Re-throw to bubble up to error boundary
    throw error instanceof Error
      ? error
      : new Error("Failed to fetch Master Duel banlist");
  }
}

/**
 * Normalize TCG ban status from YGOPRODeck API format to our BanStatus type
 * YGOPRODeck API returns: "Banned", "Limited", "Semi-Limited", or null/undefined
 * Database may store: "Banned", "Forbidden", "Limited", "Semi-Limited", or null
 * We standardize to: "Forbidden", "Limited", "Semi-Limited", "Unlimited"
 */
function normalizeTCGBanStatus(status: string | null | undefined): BanStatus {
  if (!status) return "Unlimited";
  
  const normalized = status.trim().toLowerCase();
  
  // Handle "Banned" or "Forbidden" (both mean the same thing)
  if (normalized === "banned" || normalized === "forbidden") {
    return "Forbidden";
  }
  
  // Handle "Limited" (case-insensitive)
  if (normalized === "limited") {
    return "Limited";
  }
  
  // Handle "Semi-Limited" variations (case-insensitive)
  if (normalized === "semi-limited" || normalized === "semi limited") {
    return "Semi-Limited";
  }
  
  // Default to Unlimited for unknown values
  return "Unlimited";
}

// 4. Banlist fetch—for TCG, fetch from cards table ban_tcg column
export async function getTCGBanlist(): Promise<Record<string, BanStatus>> {
  try {
    // Fetch all cards with TCG ban status (ban_tcg column)
    const { data, error } = await supabase
      .from("cards")
      .select("name, ban_tcg")
      .not("ban_tcg", "is", null);

    if (error) {
      // Database error - throw to be caught by error boundary
      throw new Error(`Failed to fetch TCG banlist: ${error.message}`);
    }

    // Empty data is expected if no cards have ban status set
    if (!data || data.length === 0) {
      return {};
    }

    const banlist: Record<string, BanStatus> = {};
    for (const card of data) {
      if (card.ban_tcg) {
        // Normalize the ban status value
        banlist[card.name] = normalizeTCGBanStatus(card.ban_tcg);
      }
    }

    return banlist;
  } catch (error) {
    // Re-throw to bubble up to error boundary
    throw error instanceof Error
      ? error
      : new Error("Failed to fetch TCG banlist");
  }
}
