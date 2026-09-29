import type { Card } from "@/types/card";
import type { BanStatus, ClientDeck } from "@/types/deck";

/**
 * Check if a card belongs in the Extra Deck.
 */
export function isExtraDeckCard(card: Card): boolean {
  return (
    card.type.includes("Fusion") ||
    card.type.includes("Synchro") ||
    card.type.includes("XYZ") ||
    card.type.includes("Link")
  );
}

/**
 * Calculate remaining copies of a card that can be added to the deck
 * given banlist limits and current counts across all sections.
 */
export function getRemainingCopies(
  card: Card,
  currentDeck: ClientDeck,
  banlist: Record<string, BanStatus>,
): number {
  const banStatus = banlist[card.name] || "Unlimited";
  let maxCopies = 3;
  if (banStatus === "Limited") maxCopies = 1;
  if (banStatus === "Semi-Limited") maxCopies = 2;
  if (banStatus === "Forbidden") maxCopies = 0;

  const currentCopies = [
    ...currentDeck.mainDeck,
    ...currentDeck.extraDeck,
    ...currentDeck.sideDeck,
  ].filter((c) => c.id === card.id).length;

  return Math.max(0, maxCopies - currentCopies);
}
