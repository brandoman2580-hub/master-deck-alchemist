/**
 * Snapshot zone helpers shared conceptually with scripts/strategist-eval.mjs.
 * Keeps copy-total vs unique-ID display correct for DeckType → id+count snapshots.
 */

export interface SnapshotEntry {
  id: number;
  count: number;
}

/**
 * Aggregate expanded DeckType rows (one entry per copy) or id+count rows
 * into Strategist snapshot entries (max 3 per id).
 */
export function countSectionEntries(
  cards: Array<{ id?: number; cardId?: number; count?: number } | null | undefined>,
): SnapshotEntry[] {
  const counts = new Map<number, number>();
  for (const card of cards || []) {
    const id = Number(card?.id ?? card?.cardId);
    if (!Number.isFinite(id) || id <= 0) continue;
    const rawCount = Number(card?.count);
    const incr =
      Number.isFinite(rawCount) && rawCount > 0
        ? Math.min(3, Math.floor(rawCount))
        : 1;
    counts.set(id, (counts.get(id) ?? 0) + incr);
  }
  return [...counts.entries()].map(([id, count]) => ({
    id,
    count: Math.min(3, count),
  }));
}

/** Total physical copies in an id+count snapshot zone. */
export function sumSnapshotCopies(
  entries: Array<{ count?: number } | null | undefined> | undefined,
): number {
  return (entries || []).reduce((acc, e) => acc + (Number(e?.count) || 0), 0);
}
