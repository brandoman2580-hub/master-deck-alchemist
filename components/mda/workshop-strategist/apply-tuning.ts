/**
 * Apply copy-count tuning via DeckProvider add/remove (no setCopies API).
 */

import type { Card } from "@/types/card";
import type { DeckType } from "@/types/types";

export function countMainCopies(deck: DeckType, cardId: number): number {
  return deck.mainDeck.filter((c) => c.id === cardId).length;
}

/**
 * Mutate main-deck copies toward `toCopies` using add/remove callbacks.
 */
export function applyMainCopyTarget(args: {
  deck: DeckType;
  card: Card;
  toCopies: number;
  addCardToDeck: (card: Card, section: "mainDeck") => void;
  removeCardFromDeck: (deckInstanceId: string, section: "mainDeck") => void;
}): void {
  const { deck, card, toCopies, addCardToDeck, removeCardFromDeck } = args;
  const target = Math.max(0, Math.min(3, Math.floor(toCopies)));
  const instances = deck.mainDeck.filter((c) => c.id === card.id);
  const current = instances.length;

  if (target === current) return;

  if (target > current) {
    const delta = target - current;
    for (let i = 0; i < delta; i += 1) {
      addCardToDeck(card, "mainDeck");
    }
    return;
  }

  const removeCount = current - target;
  const toRemove = instances.slice(0, removeCount);
  for (const instance of toRemove) {
    if (instance.deckInstanceId) {
      removeCardFromDeck(instance.deckInstanceId, "mainDeck");
    }
  }
}
