import { getUserDecks } from "@/lib/data/decks";
import type { ClientDeck, DeckFormat } from "@/types/deck";

export const USER_DECKS_QUERY_KEY = "user-decks" as const;

export function userDecksQueryKey(
  userId: string,
): readonly [typeof USER_DECKS_QUERY_KEY, string] {
  return [USER_DECKS_QUERY_KEY, userId];
}

type DeckRow = {
  id: string;
  name: string;
  cards?: {
    main?: ClientDeck["mainDeck"];
    extra?: ClientDeck["extraDeck"];
    side?: ClientDeck["sideDeck"];
  };
  mainDeck?: ClientDeck["mainDeck"];
  extraDeck?: ClientDeck["extraDeck"];
  sideDeck?: ClientDeck["sideDeck"];
  updated_at?: string;
  mode?: DeckFormat;
  deckFormat?: DeckFormat;
  is_pinned?: boolean;
  isPinned?: boolean;
};

export function mapDeckRows(rows: unknown[]): ClientDeck[] {
  return rows.map((row) => {
    const deck = row as DeckRow;
    return {
      id: deck.id,
      name: deck.name,
      mainDeck: deck.mainDeck ?? deck.cards?.main ?? [],
      extraDeck: deck.extraDeck ?? deck.cards?.extra ?? [],
      sideDeck: deck.sideDeck ?? deck.cards?.side ?? [],
      updated_at: deck.updated_at,
      deckFormat: deck.deckFormat ?? deck.mode ?? "Master Duel",
      isPinned: deck.isPinned ?? deck.is_pinned ?? false,
    };
  });
}

export async function fetchUserDecks(userId: string): Promise<ClientDeck[]> {
  const rows = await getUserDecks(userId);
  return mapDeckRows(rows as unknown[]);
}
