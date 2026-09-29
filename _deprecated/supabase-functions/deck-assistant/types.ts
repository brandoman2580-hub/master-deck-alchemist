/**
 * Type definitions for Deck Assistant
 */

export interface Card {
  id: number;
  cardId?: number; // For deck cards
  name: string;
  type: string;
  desc: string;
  level?: number;
  race?: string;
  attribute?: string;
  archetype?: string | null;
  atk?: number | string;
  def?: number | string;
  card_images?: Array<{
    id: number;
    image_url: string;
    image_url_small: string;
  }>;
}

export interface DeckCard {
  cardId: number;
  count?: number;
}

export interface Deck {
  mainDeck: DeckCard[];
  extraDeck: DeckCard[];
  sideDeck: DeckCard[];
}

export interface DeckAnalysis {
  archetype: string | null;
  playstyle: "aggro" | "control" | "combo" | "stall" | "hybrid";
  cardRoles: {
    starters: number;
    extenders: number;
    interruptions: number;
    searchers: number;
    removals: number;
  };
  ratios: {
    monsters: number;
    spells: number;
    traps: number;
  };
  deckSize: {
    main: number;
    extra: number;
    side: number;
  };
  keyEffects: string[]; // Important card effects present
  weaknesses: string[]; // Identified weaknesses
}

export interface DeckStats {
  mainCount: number;
  extraCount: number;
  sideCount: number;
  monsterCount: number;
  spellCount: number;
  trapCount: number;
}
