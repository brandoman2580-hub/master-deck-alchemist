import { DECK_MODES } from "../lib/constants";
import { Card } from "./card";

export type AuthProvider = "google" | "facebook" | "discord" | "apple";
export type DeckMode = (typeof DECK_MODES)[number];

export interface DeckCard extends Card {
  deckInstanceId: string;
}

// Add to your types
export type Deck = {
  id: string; // Add this for Supabase IDs
  name: string;
  mainDeck: Card[];
  extraDeck: Card[];
  sideDeck: Card[];
  created_at: string;
  updated_at: string;
  is_pinned?: boolean;
};

export type NormalizedDeck = {
  mainDeck: string[];
  extraDeck: string[];
  sideDeck: string[];
};

export type DeckSection = "mainDeck" | "extraDeck" | "sideDeck";

export type DeckType = {
  id: string;
  name: string;
  mainDeck: DeckCard[];
  extraDeck: DeckCard[];
  sideDeck: DeckCard[];
  updated_at?: string;
  mode: DeckMode;
  isPinned?: boolean;
};

type DeckListByCategory = {
  Monster?: string[];
  Spell?: string[];
  Trap?: string[];
};

export type CountedCard = {
  name: string;
  count: number;
};

// Acceptable import formats
export type DeckFormat1 = {
  // { Monster, Spell, Trap, Extra, Side }
  Monster?: string[];
  Spell?: string[];
  Trap?: string[];
  Extra?: string[];
  Side?: string[];
};

export type DeckFormat2 = {
  // { mainDeck: { Monster, Spell, Trap }, extraDeck, sideDeck }
  mainDeck: DeckListByCategory;
  extraDeck?: string[];
  sideDeck?: string[];
};

export type DeckFormat3 = {
  // { mainDeck: string[] | CountedCard[], extraDeck, sideDeck }
  mainDeck?: (string | CountedCard)[];
  extraDeck?: (string | CountedCard)[];
  sideDeck?: (string | CountedCard)[];
};

export type DeckFormat4 = {
  // { main, extra, side }
  main?: string[];
  extra?: string[];
  side?: string[];
};

export type ImportedDeck =
  | DeckFormat1
  | DeckFormat2
  | DeckFormat3
  | DeckFormat4;

export type BanStatus =
  | "Forbidden"
  | "Limited"
  | "Semi-Limited"
  | "Unlimited"
  | undefined;

export type FilterConfig = {
  label: string;
  key: string;
  options: { value: string; label: string }[];
};

export type SearchParams = {
  type?: string;
  attribute?: string;
  level?: string;
  atk?: string;
  def?: string;
  archetype?: string;
  race?: string;
  rarity?: string;
  effect?: string;
  atkRange?: string;
  defRange?: string;
};

export type SignupFormState = {
  success: boolean;
  error?: string;
  email?: string;
};
