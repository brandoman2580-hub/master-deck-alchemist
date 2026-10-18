import { validateBanlistCompliance } from "@/lib/validation/deck-validator";
import type { BanStatus, DeckFormat } from "@/types/deck";

type NamedCard = {
  id: number;
  name: string;
};

export type BanlistFaultDeck = {
  deckFormat: DeckFormat;
  mainDeck: NamedCard[];
  extraDeck: NamedCard[];
  sideDeck: NamedCard[];
};

/**
 * True when the played list exceeds the active banlist.
 * Master Duel has no side deck, so leftover side cards are ignored.
 * An empty or still-loading banlist is not a fault.
 */
export function deckHasBanlistFault(
  deck: BanlistFaultDeck,
  banlist: Record<string, BanStatus>,
): boolean {
  const list: Record<string, string> = {};
  for (const [name, status] of Object.entries(banlist)) {
    if (status) list[name] = status;
  }
  if (Object.keys(list).length === 0) return false;

  const toSlots = (cards: NamedCard[]) =>
    cards.map((card) => ({ cardId: card.id, name: card.name }));

  return !validateBanlistCompliance(
    {
      mainDeck: toSlots(deck.mainDeck),
      extraDeck: toSlots(deck.extraDeck),
      sideDeck: deck.deckFormat === "TCG" ? toSlots(deck.sideDeck) : [],
    },
    list,
  ).valid;
}
