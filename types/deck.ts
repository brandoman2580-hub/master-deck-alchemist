import type { Card } from "./card";

/** Banlist / rules format for a deck (TCG vs Master Duel). */
export type DeckFormat = "TCG" | "Master Duel";

/** @deprecated Use `DeckFormat` */
export type DeckMode = DeckFormat;

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
  /** DB column remains `mode`; mapped at the data layer. */
  deckFormat?: DeckFormat;
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
  /** Rules format (TCG | Master Duel). Persisted as DB column `mode`. */
  deckFormat: DeckFormat;
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
