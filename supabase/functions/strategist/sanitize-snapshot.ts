/**
 * Sanitize a client Workshop snapshot against the trusted `cards` table.
 * Client may only supply id + count; names/type/desc come from the database.
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import type { Card, Deck, DeckCard } from "./types.ts";

export interface SnapshotEntry {
  id: number;
  count: number;
}

export interface DeckSnapshotPayload {
  main?: SnapshotEntry[];
  extra?: SnapshotEntry[];
  side?: SnapshotEntry[];
}

export type SanitizeSnapshotResult =
  | {
    ok: true;
    deck: Deck;
    allCards: Card[];
  }
  | {
    ok: false;
    unknownCardIds: number[];
  };

function normalizeEntries(raw: unknown): SnapshotEntry[] {
  if (!Array.isArray(raw)) return [];
  const counts = new Map<number, number>();
  for (const item of raw) {
    if (!item || typeof item !== "object") continue;
    const row = item as Record<string, unknown>;
    const id = Number(row.id ?? row.cardId);
    if (!Number.isFinite(id) || id <= 0) continue;
    const countRaw = Number(row.count ?? 1);
    const count = Number.isFinite(countRaw)
      ? Math.max(1, Math.min(3, Math.floor(countRaw)))
      : 1;
    counts.set(id, (counts.get(id) ?? 0) + count);
  }
  return Array.from(counts.entries()).map(([id, count]) => ({
    id,
    count: Math.min(3, count),
  }));
}

/**
 * Rebuild one zone from verified card IDs + client counts.
 */
export function rebuildZone(
  entries: SnapshotEntry[],
  verifiedById: Map<number, Card>,
): { zone: DeckCard[]; unknown: number[] } {
  const zone: DeckCard[] = [];
  const unknown: number[] = [];
  for (const entry of entries) {
    if (!verifiedById.has(entry.id)) {
      unknown.push(entry.id);
      continue;
    }
    zone.push({ cardId: entry.id, count: entry.count });
  }
  return { zone, unknown };
}

/**
 * Pure rebuild: unique IDs must exist in `verifiedById`.
 * Duplicate copies are represented via `count`, not repeated IDs.
 */
export function rebuildDeckFromVerifiedCards(
  snapshot: DeckSnapshotPayload,
  verifiedById: Map<number, Card>,
): SanitizeSnapshotResult {
  const mainEntries = normalizeEntries(snapshot.main);
  const extraEntries = normalizeEntries(snapshot.extra);
  const sideEntries = normalizeEntries(snapshot.side);

  const main = rebuildZone(mainEntries, verifiedById);
  const extra = rebuildZone(extraEntries, verifiedById);
  const side = rebuildZone(sideEntries, verifiedById);
  const unknownCardIds = [
    ...new Set([...main.unknown, ...extra.unknown, ...side.unknown]),
  ];

  if (unknownCardIds.length > 0) {
    return { ok: false, unknownCardIds };
  }

  return {
    ok: true,
    deck: {
      mainDeck: main.zone,
      extraDeck: extra.zone,
      sideDeck: side.zone,
    },
    allCards: Array.from(verifiedById.values()),
  };
}

/**
 * Load trusted card rows for unique snapshot IDs and rebuild the coaching deck.
 */
export async function sanitizeLiveDeckSnapshot(
  supabase: SupabaseClient,
  snapshot: DeckSnapshotPayload,
): Promise<SanitizeSnapshotResult> {
  const mainEntries = normalizeEntries(snapshot.main);
  const extraEntries = normalizeEntries(snapshot.extra);
  const sideEntries = normalizeEntries(snapshot.side);
  const uniqueIds = [
    ...new Set([
      ...mainEntries.map((e) => e.id),
      ...extraEntries.map((e) => e.id),
      ...sideEntries.map((e) => e.id),
    ]),
  ];

  if (uniqueIds.length === 0) {
    return {
      ok: true,
      deck: { mainDeck: [], extraDeck: [], sideDeck: [] },
      allCards: [],
    };
  }

  const { data, error } = await supabase
    .from("cards")
    .select("*")
    .in("id", uniqueIds);

  if (error) {
    throw new Error("Unable to verify cards in your deck against the card library.");
  }

  const verifiedById = new Map<number, Card>();
  for (const row of data ?? []) {
    verifiedById.set(Number(row.id), row as Card);
  }

  const missing = uniqueIds.filter((id) => !verifiedById.has(id));
  if (missing.length > 0) {
    return { ok: false, unknownCardIds: missing };
  }

  return rebuildDeckFromVerifiedCards(
    { main: mainEntries, extra: extraEntries, side: sideEntries },
    verifiedById,
  );
}

/**
 * User-facing rejection when snapshot IDs are not in the card library.
 */
export function formatUnknownCardsRejection(_unknownCardIds: number[]): string {
  return "Some cards in your current deck are not in the card library. Remove or replace them, then ask again.";
}
