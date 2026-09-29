/**
 * Card pricing utilities for TCG and Master Duel formats.
 * TCG: Real prices from TCGPlayer (USD) and Cardmarket (EUR) - both shown, labeled.
 * Master Duel: 30 CP per card; show per-rarity CP totals (UR/SR/R/N).
 */

import type { Card } from "@/types/card";
import type { DeckType } from "@/types/deck";

/** Crafting points per card in Master Duel (same for all rarities) */
export const MASTER_DUEL_CP_PER_CARD = 30;

/** Master Duel rarity codes for grouping */
export type MasterDuelRarity = "N" | "R" | "SR" | "UR";

/** Normalized rarity for counting */
export type NormalizedRarity = MasterDuelRarity | "UNKNOWN";

/** TCG price sources with labels */
export interface TCGPriceSummary {
  tcgplayer?: { value: number; label: string; formatted: string };
  cardmarket?: { value: number; label: string; formatted: string };
  amazon?: { value: number; label: string; formatted: string };
  ebay?: { value: number; label: string; formatted: string };
}

/** Master Duel crafting points breakdown by rarity */
export interface MasterDuelCPBreakdown {
  N: { count: number; cp: number };
  R: { count: number; cp: number };
  SR: { count: number; cp: number };
  UR: { count: number; cp: number };
  totalCards: number;
  totalCP: number;
}

/** Deck cost summary for display */
export interface DeckCostSummary {
  format: "TCG" | "Master Duel";
  tcg?: TCGPriceSummary & {
    totalTcgplayer: number;
    totalCardmarket: number;
    totalAmazon: number;
    totalEbay: number;
  };
  masterDuel?: MasterDuelCPBreakdown;
}

/**
 * Parse a price string from API (e.g. "1.23" or "0.00") to number.
 */
function parsePrice(value: string | undefined | null): number {
  if (value == null || value === "") return 0;
  const parsed = parseFloat(String(value).replace(/,/g, ""));
  return Number.isNaN(parsed) ? 0 : parsed;
}

/** Card prices type from API */
type CardPricesEntry = {
  tcgplayer_price?: string;
  cardmarket_price?: string;
  amazon_price?: string;
  ebay_price?: string;
};

/**
 * Get TCG prices for a single card (all vendors).
 */
export function getCardTCGPrices(
  card: Card | { card_prices?: Array<CardPricesEntry> },
): TCGPriceSummary {
  const prices = card.card_prices?.[0];
  if (!prices) return {};

  const tcgplayer = parsePrice(prices.tcgplayer_price);
  const cardmarket = parsePrice(prices.cardmarket_price);
  const amazon = parsePrice(prices.amazon_price);
  const ebay = parsePrice(prices.ebay_price);

  const result: TCGPriceSummary = {};

  if (tcgplayer > 0) {
    result.tcgplayer = {
      value: tcgplayer,
      label: "TCGPlayer",
      formatted: `$${tcgplayer.toFixed(2)}`,
    };
  }

  if (cardmarket > 0) {
    result.cardmarket = {
      value: cardmarket,
      label: "Cardmarket",
      formatted: `€${cardmarket.toFixed(2)}`,
    };
  }

  if (amazon > 0) {
    result.amazon = {
      value: amazon,
      label: "Amazon",
      formatted: `$${amazon.toFixed(2)}`,
    };
  }

  if (ebay > 0) {
    result.ebay = {
      value: ebay,
      label: "eBay",
      formatted: `$${ebay.toFixed(2)}`,
    };
  }

  return result;
}

/**
 * Normalize rarity string to N, R, SR, UR for grouping.
 * C/Common maps to N (Master Duel uses N for Normal).
 */
export function normalizeRarity(rarity: string | undefined | null): NormalizedRarity {
  if (!rarity || typeof rarity !== "string") return "UNKNOWN";
  const upper = rarity.toUpperCase().trim();

  if (upper === "N" || upper === "C" || upper.includes("NORMAL") || upper.includes("COMMON"))
    return "N";
  if (upper === "R" || (upper.includes("RARE") && !upper.includes("SUPER") && !upper.includes("ULTRA")))
    return "R";
  if (upper === "SR" || upper.includes("SUPER") || upper.includes("SUPERRARE")) return "SR";
  if (upper === "UR" || upper.includes("ULTRA") || upper.includes("ULTRARARE")) return "UR";

  return "UNKNOWN";
}

/**
 * Get Master Duel rarity from card (misc_info or passed md_rarity from master_duel_rarity table).
 */
export function getCardMdRarity(
  card: Card | { misc_info?: Array<{ md_rarity?: string }> },
  mdRarityOverride?: string | null,
): string | undefined {
  if (mdRarityOverride != null && mdRarityOverride.trim() !== "") {
    return mdRarityOverride.trim();
  }
  return card.misc_info?.[0]?.md_rarity?.trim() || undefined;
}

/**
 * Compute Master Duel CP breakdown for a deck.
 * Each card = 30 CP regardless of rarity; breakdown by rarity for planning.
 */
export function getMasterDuelCPBreakdown(
  cards: Array<{ card: Card; count: number; mdRarity?: string | null }>,
): MasterDuelCPBreakdown {
  const breakdown: MasterDuelCPBreakdown = {
    N: { count: 0, cp: 0 },
    R: { count: 0, cp: 0 },
    SR: { count: 0, cp: 0 },
    UR: { count: 0, cp: 0 },
    totalCards: 0,
    totalCP: 0,
  };

  for (const { card, count, mdRarity } of cards) {
    const rarity = normalizeRarity(getCardMdRarity(card, mdRarity));
    if (rarity !== "UNKNOWN" && rarity in breakdown) {
      breakdown[rarity as MasterDuelRarity].count += count;
      breakdown[rarity as MasterDuelRarity].cp += count * MASTER_DUEL_CP_PER_CARD;
    }
    breakdown.totalCards += count;
    breakdown.totalCP += count * MASTER_DUEL_CP_PER_CARD;
  }

  return breakdown;
}

/**
 * Compute TCG deck totals (sum of cheapest per card × quantity).
 * Returns totals for all vendors.
 */
export function getTCGDeckTotals(
  cards: Array<{ card: Card; count: number }>,
): {
  totalTcgplayer: number;
  totalCardmarket: number;
  totalAmazon: number;
  totalEbay: number;
} {
  let totalTcgplayer = 0;
  let totalCardmarket = 0;
  let totalAmazon = 0;
  let totalEbay = 0;

  for (const { card, count } of cards) {
    const prices = getCardTCGPrices(card);
    if (prices.tcgplayer) totalTcgplayer += prices.tcgplayer.value * count;
    if (prices.cardmarket) totalCardmarket += prices.cardmarket.value * count;
    if (prices.amazon) totalAmazon += prices.amazon.value * count;
    if (prices.ebay) totalEbay += prices.ebay.value * count;
  }

  return { totalTcgplayer, totalCardmarket, totalAmazon, totalEbay };
}

/**
 * Flatten deck into cards with counts for pricing.
 */
function flattenDeckWithCounts(
  deck: DeckType,
): Array<{ card: Card; count: number }> {
  const cardCounts = new Map<number, { card: Card; count: number }>();

  const addCard = (card: Card) => {
    const existing = cardCounts.get(card.id);
    if (existing) {
      existing.count += 1;
    } else {
      cardCounts.set(card.id, { card, count: 1 });
    }
  };

  deck.mainDeck.forEach(addCard);
  deck.extraDeck.forEach(addCard);
  deck.sideDeck.forEach(addCard);

  return Array.from(cardCounts.values());
}

/**
 * Check if a card has valid price data (non-zero from any vendor).
 */
function cardHasPriceData(card: Card): boolean {
  const prices = getCardTCGPrices(card);
  return !!(
    prices.tcgplayer ||
    prices.cardmarket ||
    prices.amazon ||
    prices.ebay
  );
}

/**
 * Get full deck cost summary for display.
 * @param cardLookup - Optional map of card id -> full card from pool. Used to enrich
 *   deck cards that lack card_prices (e.g. loaded from old save) so totals display correctly.
 */
export function getDeckCostSummary(
  deck: DeckType,
  format: "TCG" | "Master Duel",
  mdRarityMap?: Map<number, string>,
  cardLookup?: Map<number, Card>,
): DeckCostSummary {
  const flat = flattenDeckWithCounts(deck);

  // For TCG: enrich deck cards with prices from pool when deck card lacks them
  const flatForTCG =
    format === "TCG" && cardLookup
      ? flat.map(({ card, count }) => {
          const hasPrices = cardHasPriceData(card);
          if (!hasPrices) {
            const poolCard = cardLookup.get(card.id);
            if (poolCard && cardHasPriceData(poolCard)) {
              return { card: poolCard, count };
            }
          }
          return { card, count };
        })
      : flat;

  if (format === "TCG") {
    const { totalTcgplayer, totalCardmarket, totalAmazon, totalEbay } =
      getTCGDeckTotals(flatForTCG);
    return {
      format: "TCG",
      tcg: {
        totalTcgplayer,
        totalCardmarket,
        totalAmazon,
        totalEbay,
        tcgplayer:
          totalTcgplayer > 0
            ? { value: totalTcgplayer, label: "TCGPlayer", formatted: `$${totalTcgplayer.toFixed(2)}` }
            : undefined,
        cardmarket:
          totalCardmarket > 0
            ? {
                value: totalCardmarket,
                label: "Cardmarket",
                formatted: `€${totalCardmarket.toFixed(2)}`,
              }
            : undefined,
        amazon:
          totalAmazon > 0
            ? { value: totalAmazon, label: "Amazon", formatted: `$${totalAmazon.toFixed(2)}` }
            : undefined,
        ebay:
          totalEbay > 0
            ? { value: totalEbay, label: "eBay", formatted: `$${totalEbay.toFixed(2)}` }
            : undefined,
      },
    };
  }

  const withRarity = flat.map(({ card, count }) => ({
    card,
    count,
    mdRarity: mdRarityMap?.get(card.id),
  }));

  const masterDuel = getMasterDuelCPBreakdown(withRarity);

  return {
    format: "Master Duel",
    masterDuel,
  };
}
