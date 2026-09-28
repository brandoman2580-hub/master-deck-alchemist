/**
 * Banlist + copy-cap eligibility for synergy / recommendation candidates.
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import type { Card, Deck } from "./types.ts";

export type BanStatusLike = string | undefined | null;

/**
 * Max legal copies for a ban status (Forbidden/Banned → 0).
 */
export function maxCopiesForBanStatus(status: BanStatusLike): number {
  if (!status) return 3;
  const normalized = String(status).trim().toLowerCase();
  if (normalized === "forbidden" || normalized === "banned") return 0;
  if (normalized === "limited") return 1;
  if (normalized === "semi-limited" || normalized === "semi limited") {
    return 2;
  }
  return 3;
}

export function countCardCopiesInDeck(deck: Deck, cardId: number): number {
  let total = 0;
  for (const entry of [...deck.mainDeck, ...deck.extraDeck, ...deck.sideDeck]) {
    if (entry.cardId === cardId) total += entry.count ?? 1;
  }
  return total;
}

/**
 * True when at least one more copy can be added under banlist + current counts.
 */
export function canAddCardToDeck(
  card: Pick<Card, "id" | "name">,
  deck: Deck,
  banlist: Record<string, string>,
): boolean {
  const max = maxCopiesForBanStatus(banlist[card.name]);
  if (max <= 0) return false;
  return countCardCopiesInDeck(deck, card.id) < max;
}

export function filterAddableCards<T extends { card: Card }>(
  items: T[],
  deck: Deck,
  banlist: Record<string, string>,
): T[] {
  return items.filter((item) => canAddCardToDeck(item.card, deck, banlist));
}

/**
 * Load format banlist map (card name → status).
 */
export async function loadFormatBanlist(
  supabase: SupabaseClient,
  format: "TCG" | "MASTER_DUEL",
): Promise<Record<string, string>> {
  if (format === "MASTER_DUEL") {
    const { data, error } = await supabase
      .from("master_duel_banlist")
      .select("card_name, ban_status");
    if (error) {
      console.warn("master_duel_banlist load failed:", error.message);
      return {};
    }
    const banlist: Record<string, string> = {};
    for (const row of data ?? []) {
      if (row.card_name && row.ban_status) {
        banlist[String(row.card_name)] = String(row.ban_status);
      }
    }
    return banlist;
  }

  const { data, error } = await supabase
    .from("cards")
    .select("name, ban_tcg")
    .not("ban_tcg", "is", null);
  if (error) {
    console.warn("TCG banlist load failed:", error.message);
    return {};
  }
  const banlist: Record<string, string> = {};
  for (const row of data ?? []) {
    if (!row.name || !row.ban_tcg) continue;
    const normalized = String(row.ban_tcg).trim().toLowerCase();
    if (normalized === "banned" || normalized === "forbidden") {
      banlist[String(row.name)] = "Forbidden";
    } else if (normalized === "limited") {
      banlist[String(row.name)] = "Limited";
    } else if (
      normalized === "semi-limited" ||
      normalized === "semi limited"
    ) {
      banlist[String(row.name)] = "Semi-Limited";
    }
  }
  return banlist;
}

/**
 * Banlist copy-cap legality against deck counts (card name keyed banlist).
 * Empty banlist → ok (no remote data to enforce).
 */
export function evaluateBanlistLegality(
  deck: Deck,
  allCards: Array<Pick<Card, "id" | "name">>,
  banlist: Record<string, string>,
): { ok: boolean; errors: string[] } {
  if (!banlist || Object.keys(banlist).length === 0) {
    return { ok: true, errors: [] };
  }

  const cardMap = new Map(allCards.map((c) => [c.id, c]));
  const countsByName = new Map<string, number>();
  for (const section of [deck.mainDeck, deck.extraDeck, deck.sideDeck]) {
    for (const entry of section) {
      const card = cardMap.get(entry.cardId);
      if (!card?.name) continue;
      const next = (countsByName.get(card.name) ?? 0) + (entry.count ?? 1);
      countsByName.set(card.name, next);
    }
  }

  const errors: string[] = [];
  for (const [cardName, banStatus] of Object.entries(banlist)) {
    const count = countsByName.get(cardName) ?? 0;
    if (count <= 0) continue;
    const max = maxCopiesForBanStatus(banStatus);
    if (count > max) {
      errors.push(
        `${cardName} is ${banStatus} (max ${max}), but deck contains ${count}`,
      );
    }
  }

  return { ok: errors.length === 0, errors };
}
