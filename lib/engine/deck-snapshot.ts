/**
 * Build a lightweight live Workshop deck snapshot for Strategist chat.
 * Client sends id + count only; the edge resolves names/text from `cards`.
 */

import type { DeckCard, DeckType } from "@/types/deck";

export interface DeckSnapshotEntry {
  id: number;
  count: number;
}

export interface DeckSnapshot {
  main: DeckSnapshotEntry[];
  extra: DeckSnapshotEntry[];
  side: DeckSnapshotEntry[];
}

/**
 * Collapse Workshop card instances into `{ id, count }` rows per section.
 */
export function countSectionEntries(cards: DeckCard[]): DeckSnapshotEntry[] {
  const counts = new Map<number, number>();
  for (const card of cards) {
    if (!Number.isFinite(card.id) || card.id <= 0) continue;
    counts.set(card.id, (counts.get(card.id) ?? 0) + 1);
  }
  return Array.from(counts.entries()).map(([id, count]) => ({ id, count }));
}

/**
 * Snapshot the live Workshop deck for coaching (not the DB-saved row alone).
 */
export function buildLiveDeckSnapshot(deck: DeckType): DeckSnapshot {
  return {
    main: countSectionEntries(deck.mainDeck ?? []),
    extra: countSectionEntries(deck.extraDeck ?? []),
    side: countSectionEntries(deck.sideDeck ?? []),
  };
}
