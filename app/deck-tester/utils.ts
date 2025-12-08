import { DeckType, Deck } from "@/types/types";
import type { DeckTesterAgentResponse } from "@/types/ai-agents";

/**
 * Format deck data from Supabase format to DeckType
 * Handles both Deck format (with mainDeck/extraDeck/sideDeck) and Supabase format (with cards.main/extra/side)
 */
export function formatDeck(
  d: Deck | {
    id: string;
    name: string;
    cards?: { main?: unknown[]; extra?: unknown[]; side?: unknown[] };
    updated_at?: string;
    mode?: string;
    [key: string]: unknown;
  },
): DeckType {
  // Check if it's already in Deck format (has mainDeck)
  if ("mainDeck" in d && Array.isArray(d.mainDeck)) {
    const deck = d as Deck;
    return {
      id: deck.id,
      name: deck.name,
      mainDeck: deck.mainDeck as DeckType["mainDeck"],
      extraDeck: deck.extraDeck as DeckType["extraDeck"],
      sideDeck: deck.sideDeck as DeckType["sideDeck"],
      updated_at: deck.updated_at,
      mode: ((deck as { mode?: string }).mode || "Master Duel") as DeckType["mode"],
    };
  }

  // Otherwise, it's Supabase format with cards object
  const supabaseDeck = d as {
    id: string;
    name: string;
    cards?: { main?: unknown[]; extra?: unknown[]; side?: unknown[] };
    updated_at?: string;
    mode?: string;
  };
  const cards = supabaseDeck.cards || {};
  return {
    id: supabaseDeck.id,
    name: supabaseDeck.name,
    mainDeck: (cards.main || []) as DeckType["mainDeck"],
    extraDeck: (cards.extra || []) as DeckType["extraDeck"],
    sideDeck: (cards.side || []) as DeckType["sideDeck"],
    updated_at: supabaseDeck.updated_at,
    mode: (supabaseDeck.mode || "Master Duel") as DeckType["mode"],
  };
}

/**
 * Calculate token usage percentage
 */
export function calculateTokenUsagePercent(
  aiResult: DeckTesterAgentResponse | null,
  maxTokens: number = 100000,
): number {
  if (!aiResult?.estimated_cost?.tokens_used) return 0;
  return Math.min((aiResult.estimated_cost.tokens_used / maxTokens) * 100, 100);
}

/**
 * Get banlist format string from deck mode
 */
export function getBanlistFormat(
  deckMode: "TCG" | "Master Duel",
): "TCG" | "MASTER_DUEL" {
  return deckMode === "Master Duel" ? "MASTER_DUEL" : "TCG";
}

