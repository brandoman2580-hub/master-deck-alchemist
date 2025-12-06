import { Deck, DeckType } from "../types/types";
import { supabase } from "./supabaseClient";

export async function saveDeck(deck: DeckType, userId: string) {
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
      mode: deck.mode,
      is_pinned: deck.isPinned ?? false,
    })
    .select()
    .single();

  if (error) throw error;
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

export async function getUserDecks(userId: string): Promise<Deck[]> {
  const { data, error } = await supabase
    .from("decks")
    .select("*")
    .eq("user_id", userId)
    .order("updated_at", { ascending: false });

  if (error) throw error;
  return data || [];
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
): Promise<DeckType> {
  const { data, error } = await supabase
    .from("decks")
    .select("*")
    .eq("id", deckId)
    .eq("user_id", userId)
    .single();

  if (error) throw error;
  return {
    id: data.id,
    name: data.name,
    mainDeck: data.cards.main,
    extraDeck: data.cards.extra,
    sideDeck: data.cards.side,
    mode: data.mode,
    updated_at: data.updated_at,
    isPinned: data.is_pinned ?? false,
  };
}

export async function getMetaDecks(): Promise<Deck[]> {
  const { data, error } = await supabase
    .from("meta_decks")
    .select("*")
    .order("created_at", { ascending: false });

  if (error) throw error;
  return data || [];
}
