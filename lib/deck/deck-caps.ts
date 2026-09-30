/**
 * Account-wide deck creation caps (Phase 1b).
 * Soft = warn in UI; hard = block create/copy/first-persist (client + server).
 */
export const DECK_CAP_SOFT = 60;
export const DECK_CAP_HARD = 75;

export const DECK_CAP_EXCEEDED_CODE = "DECK_CAP_EXCEEDED" as const;

export type DeckCapStatus = {
  count: number;
  softExceeded: boolean;
  hardExceeded: boolean;
  remainingUntilHard: number;
};

/**
 * Compute soft/hard status from persisted deck count.
 * Untitled drafts ("New Deck") are not persisted and must not be counted by callers.
 */
export function getDeckCapStatus(persistedCount: number): DeckCapStatus {
  const count = Math.max(0, Math.floor(persistedCount));
  return {
    count,
    softExceeded: count >= DECK_CAP_SOFT,
    hardExceeded: count >= DECK_CAP_HARD,
    remainingUntilHard: Math.max(0, DECK_CAP_HARD - count),
  };
}

/** True when creating a *new* deck id would exceed the hard cap. */
export function wouldExceedDeckHardCap(
  persistedCount: number,
  isNewDeckId: boolean,
): boolean {
  if (!isNewDeckId) return false;
  return persistedCount >= DECK_CAP_HARD;
}

export function deckCapExceededMessage(count: number): string {
  return `Deck limit reached (${count}/${DECK_CAP_HARD}). Delete a deck in Archives before creating another.`;
}

export function deckCapSoftWarningMessage(count: number): string {
  return `Approaching deck limit (${count}/${DECK_CAP_HARD}). Consider pruning unused lists.`;
}

export function isDeckCapExceededError(error: unknown): boolean {
  const message =
    error instanceof Error
      ? error.message
      : typeof error === "string"
        ? error
        : "";
  return message.includes(DECK_CAP_EXCEEDED_CODE) || message.includes("Maximum of 75 decks");
}
