import type { EngineFormat, HashableDeck, HashableDeckCard } from "./types";

/**
 * Maps app deck mode labels onto the engine format enum.
 */
export function toEngineFormat(mode: string): EngineFormat {
  if (mode === "TCG") return "TCG";
  return "MASTER_DUEL";
}

/**
 * Stable multiset signature for a zone: sorted `cardIdxN` pairs.
 * Instance ids and card metadata are ignored so cosmetic edits do not bust cache.
 */
function zoneSignature(cards: HashableDeckCard[]): string {
  const counts = new Map<number, number>();
  for (const card of cards) {
    const id = Number(card.id);
    if (!Number.isFinite(id)) continue;
    counts.set(id, (counts.get(id) ?? 0) + 1);
  }
  return [...counts.entries()]
    .sort((a, b) => a[0] - b[0])
    .map(([id, n]) => `${id}x${n}`)
    .join(",");
}

/**
 * FNV-1a 32-bit hash → hex. Fast, deterministic, good enough for cache keys
 * (not cryptographic).
 */
function fnv1aHex(input: string): string {
  let hash = 0x811c9dc5;
  for (let i = 0; i < input.length; i += 1) {
    hash ^= input.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }
  return (hash >>> 0).toString(16).padStart(8, "0");
}

/**
 * Content hash of a deck list + format.
 * Same cards/copies/zones/format ⇒ same hash regardless of order or instance ids.
 *
 * @param deck - Hashable deck sections and format
 * @returns Opaque hex string suitable for `deck_analysis_cache.deck_hash`
 */
export function computeDeckHash(deck: HashableDeck): string {
  const format = toEngineFormat(deck.deckFormat);
  const payload = [
    format,
    `main:${zoneSignature(deck.mainDeck)}`,
    `extra:${zoneSignature(deck.extraDeck)}`,
    `side:${zoneSignature(deck.sideDeck)}`,
  ].join("|");
  return fnv1aHex(payload);
}
