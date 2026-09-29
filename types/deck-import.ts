type DeckListByCategory = {
  Monster?: string[];
  Spell?: string[];
  Trap?: string[];
};

export type CountedCard = {
  name: string;
  count: number;
};

/** Acceptable import formats */
export type DeckFormat1 = {
  Monster?: string[];
  Spell?: string[];
  Trap?: string[];
  Extra?: string[];
  Side?: string[];
};

export type DeckFormat2 = {
  mainDeck: DeckListByCategory;
  extraDeck?: string[];
  sideDeck?: string[];
};

export type DeckFormat3 = {
  mainDeck?: (string | CountedCard)[];
  extraDeck?: (string | CountedCard)[];
  sideDeck?: (string | CountedCard)[];
};

export type DeckFormat4 = {
  main?: string[];
  extra?: string[];
  side?: string[];
};

export type ImportedDeck =
  | DeckFormat1
  | DeckFormat2
  | DeckFormat3
  | DeckFormat4;

export type NormalizedDeck = {
  mainDeck: string[];
  extraDeck: string[];
  sideDeck: string[];
};
