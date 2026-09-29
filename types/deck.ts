import type { Card } from "./card";

export type DeckMode = "TCG" | "Master Duel";

export interface DeckCard extends Card {
  deckInstanceId: string;
}

/** Persisted Supabase deck row (list / CRUD shapes). Formerly `Deck`. */
export type PersistedDeck = {
  id: string;
  name: string;
  mainDeck: Card[];
  extraDeck: Card[];
  sideDeck: Card[];
  created_at: string;
  updated_at: string;
  is_pinned?: boolean;
};

/** @deprecated Use `PersistedDeck` */
export type Deck = PersistedDeck;

export type DeckSection = "mainDeck" | "extraDeck" | "sideDeck";

/** Client workshop / builder deck with instance IDs. Formerly `DeckType`. */
export type ClientDeck = {
  id: string;
  name: string;
  mainDeck: DeckCard[];
  extraDeck: DeckCard[];
  sideDeck: DeckCard[];
  updated_at?: string;
  mode: DeckMode;
  isPinned?: boolean;
};

/** @deprecated Use `ClientDeck` */
export type DeckType = ClientDeck;

export type BanStatus =
  | "Forbidden"
  | "Limited"
  | "Semi-Limited"
  | "Unlimited"
  | undefined;
