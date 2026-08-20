import { getUserDecks } from "@/lib/supabaseDecks";
import type { DeckMode, DeckType } from "@/types/types";

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
    main?: DeckType["mainDeck"];
    extra?: DeckType["extraDeck"];
    side?: DeckType["sideDeck"];
  };
  updated_at?: string;
  mode?: DeckMode;
  is_pinned?: boolean;
};

export function mapDeckRows(rows: unknown[]): DeckType[] {
  return rows.map((row) => {
    const deck = row as DeckRow;
    return {
      id: deck.id,
      name: deck.name,
      mainDeck: deck.cards?.main ?? [],
      extraDeck: deck.cards?.extra ?? [],
      sideDeck: deck.cards?.side ?? [],
      updated_at: deck.updated_at,
      mode: deck.mode ?? "Master Duel",
      isPinned: deck.is_pinned ?? false,
    };
  });
}

export async function fetchUserDecks(userId: string): Promise<DeckType[]> {
  const rows = await getUserDecks(userId);
  return mapDeckRows(rows as unknown[]);
}
