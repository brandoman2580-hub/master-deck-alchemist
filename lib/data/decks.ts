import type { ClientDeck, DeckFormat, PersistedDeck } from "@/types/deck";
import { supabase } from "../supabaseClient";
import {
  DECK_CAP_EXCEEDED_CODE,
  DECK_CAP_HARD,
  deckCapExceededMessage,
  wouldExceedDeckHardCap,
} from "@/lib/deck/deck-caps";

type DeckDbRow = {
  id: string;
  name: string;
  cards: {
    main: ClientDeck["mainDeck"];
    extra: ClientDeck["extraDeck"];
    side: ClientDeck["sideDeck"];
  };
  updated_at: string;
  created_at?: string;
  mode: DeckFormat;
  is_pinned?: boolean;
};

function rowToClientDeck(data: DeckDbRow): ClientDeck {
  return {
    id: data.id,
    name: data.name,
    mainDeck: data.cards.main,
    extraDeck: data.cards.extra,
    sideDeck: data.cards.side,
    deckFormat: data.mode ?? "Master Duel",
    updated_at: data.updated_at,
    isPinned: data.is_pinned ?? false,
  };
}

export type SaveDeckOptions = {
  /**
   * When true, skip the existence probe and run the hard-cap count check.
   * When false, skip both (known update). When omitted, probe once.
   */
  isNewDeckId?: boolean;
};

/**
 * Persist a deck. Enforces account hard-cap (75) on first insert of a new id.
 * DB trigger remains authoritative; this is a fast client-side gate.
 */
export async function saveDeck(
  deck: ClientDeck,
  userId: string,
  options?: SaveDeckOptions,
) {
  let isNewDeckId = options?.isNewDeckId;

  if (isNewDeckId === undefined) {
    const { data: existing, error: existingError } = await supabase
      .from("decks")
      .select("id")
      .eq("user_id", userId)
      .eq("id", deck.id)
      .maybeSingle();

    if (existingError) throw existingError;
    isNewDeckId = !existing;
  }

  if (isNewDeckId) {
    const { count, error: countError } = await supabase
      .from("decks")
      .select("id", { count: "exact", head: true })
      .eq("user_id", userId);

    if (countError) throw countError;

    const persistedCount = count ?? 0;
    if (wouldExceedDeckHardCap(persistedCount, true)) {
      throw new Error(
        `${DECK_CAP_EXCEEDED_CODE}: ${deckCapExceededMessage(persistedCount)}`,
      );
    }
  }

  const { data, error } = await supabase
    .from("decks")
    .upsert({
      id: deck.id,
      user_id: userId,
      name: deck.name,
      cards: {
        main: deck.mainDeck,
        extra: deck.extraDeck,
        side: deck.sideDeck,
      },
      updated_at: new Date().toISOString(),
      mode: deck.deckFormat,
      is_pinned: deck.isPinned ?? false,
    })
    .select()
    .single();

  if (error) {
    const message = error.message ?? "";
    if (message.includes(DECK_CAP_EXCEEDED_CODE) || message.includes("75 decks")) {
      throw new Error(
        `${DECK_CAP_EXCEEDED_CODE}: ${deckCapExceededMessage(DECK_CAP_HARD)}`,
      );
    }
    throw error;
  }
  return data;
}

export async function deleteDeck(deckId: string, userId: string) {
  const { error } = await supabase
    .from("decks")
    .delete()
    .eq("id", deckId)
    .eq("user_id", userId);

  if (error) throw error;
}

export async function getUserDecks(userId: string): Promise<PersistedDeck[]> {
  const { data, error } = await supabase
    .from("decks")
    .select("*")
    .eq("user_id", userId)
    .order("updated_at", { ascending: false });

  if (error) throw error;
  return (data || []).map((row) => {
    const r = row as DeckDbRow & { created_at: string };
    return {
      id: r.id,
      name: r.name,
      mainDeck: r.cards?.main ?? [],
      extraDeck: r.cards?.extra ?? [],
      sideDeck: r.cards?.side ?? [],
      created_at: r.created_at,
      updated_at: r.updated_at,
      is_pinned: r.is_pinned,
      deckFormat: r.mode ?? "Master Duel",
    };
  });
}

export async function countUserDecks(userId: string): Promise<number> {
  const { count, error } = await supabase
    .from("decks")
    .select("id", { count: "exact", head: true })
    .eq("user_id", userId);

  if (error) throw error;
  return count ?? 0;
}

export async function toggleDeckPin(
  deckId: string,
  userId: string,
  isPinned: boolean,
): Promise<void> {
  const { error } = await supabase
    .from("decks")
    .update({ is_pinned: isPinned })
    .eq("id", deckId)
    .eq("user_id", userId);

  if (error) throw error;
}

export async function loadDeck(
  deckId: string,
  userId: string,
): Promise<ClientDeck> {
  const { data, error } = await supabase
    .from("decks")
    .select("*")
    .eq("id", deckId)
    .eq("user_id", userId)
    .single();

  if (error) throw error;
  return rowToClientDeck(data as DeckDbRow);
}

export async function getMetaDecks(): Promise<PersistedDeck[]> {
  const { data, error } = await supabase
    .from("meta_decks")
    .select("*")
    .order("created_at", { ascending: false });

  if (error) throw error;
  return data || [];
}
