import type { ClientDeck, DeckCard, DeckFormat } from "@/types/deck";
import { getCardRarityForDisplay, getRarityBadge } from "@/lib/card/rarity";
import { getMasterDuelCPBreakdown, MASTER_DUEL_CP_PER_CARD } from "@/lib/card/pricing";

export type EditorialRarity = "N" | "R" | "SR" | "UR";

export type GroupedCard = {
  card: DeckCard;
  quantity: number;
};

type ZoneDeck = Pick<ClientDeck, "deckFormat" | "mainDeck" | "extraDeck" | "sideDeck">;

export function deckZones(deck: ZoneDeck): Array<{ id: "MAIN" | "EXTRA" | "SIDE"; cards: DeckCard[] }> {
  const zones: Array<{ id: "MAIN" | "EXTRA" | "SIDE"; cards: DeckCard[] }> = [
    { id: "MAIN", cards: deck.mainDeck },
    { id: "EXTRA", cards: deck.extraDeck },
  ];
  if (deck.deckFormat !== "Master Duel") zones.push({ id: "SIDE", cards: deck.sideDeck });
  return zones;
}

export function pricedCopies(deck: ZoneDeck): DeckCard[] {
  return deckZones(deck).flatMap((zone) => zone.cards);
}

export function countsLabel(deck: ZoneDeck): string {
  const main = `MAIN ${deck.mainDeck.length} · EXTRA ${deck.extraDeck.length}`;
  if (deck.deckFormat === "Master Duel") return main;
  return `${main} · SIDE ${deck.sideDeck.length}`;
}

export function lineCraftPoints(quantity: number): number {
  return quantity * MASTER_DUEL_CP_PER_CARD;
}

export type EditorialDeckCost =
  | { format: "TCG"; usd: number | null; priced: number; copies: number }
  | { format: "Master Duel"; totalCP: number; lines: Array<{ rarity: EditorialRarity; count: number; cp: number }> };

export function editorialDeckCost(deck: ClientDeck): EditorialDeckCost {
  const cards = pricedCopies(deck);
  if (deck.deckFormat === "Master Duel") {
    const summary = getMasterDuelCPBreakdown(cards.map((card) => ({ card, count: 1 })));
    const lines = (["UR", "SR", "R", "N"] as const)
      .filter((rarity) => summary[rarity].count > 0)
      .map((rarity) => ({ rarity, count: summary[rarity].count, cp: summary[rarity].cp }));
    return { format: "Master Duel", totalCP: summary.totalCP, lines };
  }
  let usd = 0;
  let priced = 0;
  for (const card of cards) {
    const unit = tcgUnitPrice(card);
    if (unit === null) continue;
    usd += unit;
    priced += 1;
  }
  return { format: "TCG", usd: priced > 0 ? usd : null, priced, copies: cards.length };
}

export function modifiedLabel(updatedAt: string | undefined, now = Date.now()): string {
  const parsed = Date.parse(updatedAt ?? "");
  if (!Number.isFinite(parsed)) return "MODIFIED";
  const minutes = Math.floor((now - parsed) / 60000);
  if (minutes < 1) return "MODIFIED JUST NOW";
  if (minutes < 60) return `MODIFIED ${minutes}M AGO`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `MODIFIED ${hours}H AGO`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `MODIFIED ${days}D AGO`;
  return `MODIFIED ${Math.floor(days / 30)}MO AGO`;
}

function updatedAtMillis(updatedAt: string | undefined): number {
  const parsed = Date.parse(updatedAt ?? "");
  return Number.isFinite(parsed) ? parsed : 0;
}

export function mostRecentlyUpdated(decks: readonly ClientDeck[]): ClientDeck | null {
  if (decks.length === 0) return null;
  return [...decks].sort((a, b) => updatedAtMillis(b.updated_at) - updatedAtMillis(a.updated_at))[0];
}

export function groupCards(cards: readonly DeckCard[]): GroupedCard[] {
  const groups = new Map<number | string, GroupedCard>();
  for (const card of cards) {
    const key = card.id ?? card.name;
    const existing = groups.get(key);
    if (existing) existing.quantity += 1;
    else groups.set(key, { card, quantity: 1 });
  }
  return Array.from(groups.values());
}

export function cardLine(card: DeckCard): string {
  return [card.type, card.race, card.attribute].filter(Boolean).join(" / ");
}

export function tcgUnitPrice(card: DeckCard): number | null {
  const raw = card.card_prices?.[0]?.tcgplayer_price;
  const value = Number(raw);
  return Number.isFinite(value) && value > 0 ? value : null;
}

export function formatUsd(value: number): string {
  return `$${value.toFixed(2)}`;
}

export function editorialRarity(card: DeckCard, format: DeckFormat): EditorialRarity | null {
  if (format !== "Master Duel") return null;
  const text = getRarityBadge(getCardRarityForDisplay(card, format))?.displayText;
  if (text === "N" || text === "R" || text === "SR" || text === "UR") return text;
  return null;
}

/**
 * Size and 3-copy problems that block sharing. Banlist status is not included;
 * that check needs the banlist feed.
 */
export function shareBlockers(deck: ClientDeck): string[] {
  const issues: string[] = [];
  const main = deck.mainDeck.length;
  const extra = deck.extraDeck.length;
  const side = deck.sideDeck.length;
  if (main < 40 || main > 60) issues.push(`${deck.name}: main deck must be 40–60 (has ${main})`);
  if (extra > 15) issues.push(`${deck.name}: extra deck cannot exceed 15 (has ${extra})`);
  if (side > 15) issues.push(`${deck.name}: side deck cannot exceed 15 (has ${side})`);

  const counts = new Map<number, { name: string; count: number }>();
  let invalidId = false;
  for (const card of [...deck.mainDeck, ...deck.extraDeck, ...deck.sideDeck]) {
    if (typeof card.id !== "number" || !Number.isSafeInteger(card.id) || card.id <= 0) {
      invalidId = true;
      continue;
    }
    const existing = counts.get(card.id) ?? { name: card.name, count: 0 };
    existing.count += 1;
    counts.set(card.id, existing);
    if (existing.count === 4) issues.push(`${deck.name}: ${card.name}, copy limit exceeded`);
  }
  if (invalidId) issues.push(`${deck.name}: a card is missing a valid id`);
  return issues;
}
