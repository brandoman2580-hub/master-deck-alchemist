import { create } from "zustand";
import { Card } from "@/types/card";
import { DeckType, DeckSection, DeckMode, BanStatus } from "@/types/types";
import { v4 as uuidv4 } from "uuid";

/**
 * Phase 1: Canonical deck state store with undo/redo support
 * This store will eventually replace the React Context for deck management.
 */

interface DeckState {
  // Core deck state
  currentDeck: DeckType;
  
  // History for undo/redo (capped at 50 states)
  history: DeckType[];
  historyIndex: number;
  maxHistorySize: number;
  
  // Actions
  setDeck: (deck: DeckType) => void;
  addCard: (card: Card, section: DeckSection, banlist: Record<string, BanStatus>) => void;
  removeCard: (deckInstanceId: string, section: DeckSection) => void;
  clearDeck: () => void;
  updateDeckName: (name: string) => void;
  updateDeckMode: (mode: DeckMode) => void;
  
  // History actions
  undo: () => boolean;
  redo: () => boolean;
  canUndo: () => boolean;
  canRedo: () => boolean;
  
  // Derived selectors (computed on access)
  getCardCountByName: (cardName: string) => number;
  getCardCountInSection: (cardName: string, section: DeckSection) => number;
  getTotalCardCount: () => number;
  getDeckStats: () => {
    mainCount: number;
    extraCount: number;
    sideCount: number;
    monsterCount: number;
    spellCount: number;
    trapCount: number;
  };
  getLegalityStatus: (cardName: string, banlist: Record<string, BanStatus>) => {
    banStatus: BanStatus;
    maxCopies: number;
    currentCopies: number;
    canAdd: boolean;
  };
}

const createInitialDeck = (): DeckType => ({
  id: uuidv4(),
  name: "New Deck",
  mainDeck: [],
  extraDeck: [],
  sideDeck: [],
  mode: "Master Duel",
});

export const useDeckStore = create<DeckState>((set, get) => ({
  // Initial state
  currentDeck: createInitialDeck(),
  history: [createInitialDeck()],
  historyIndex: 0,
  maxHistorySize: 50,

  // Set entire deck (used for loading/importing)
  setDeck: (deck: DeckType) => {
    set((state) => {
      const newHistory = [...state.history.slice(0, state.historyIndex + 1), deck];
      // Cap history size
      const cappedHistory = newHistory.slice(-state.maxHistorySize);
      return {
        currentDeck: deck,
        history: cappedHistory,
        historyIndex: cappedHistory.length - 1,
      };
    });
  },

  // Add card to deck section with banlist enforcement
  addCard: (card: Card, section: DeckSection, banlist: Record<string, BanStatus>) => {
    set((state) => {
      const currentSection = state.currentDeck[section];
      const banStatus = banlist[card.name] || "Unlimited";
      
      // Determine max copies based on banlist
      let maxCopies = 3;
      if (banStatus === "Limited") maxCopies = 1;
      if (banStatus === "Semi-Limited") maxCopies = 2;
      if (banStatus === "Forbidden") maxCopies = 0;

      // Count current copies in this section
      const currentCount = currentSection.filter((c) => c.id === card.id).length;
      
      // Check if we can add more
      if (currentCount >= maxCopies) {
        return state; // No change
      }

      // Create new deck state
      const cardWithInstanceId: Card & { deckInstanceId: string } = {
        ...card,
        deckInstanceId: uuidv4(),
      };

      const newDeck: DeckType = {
        ...state.currentDeck,
        [section]: [...currentSection, cardWithInstanceId],
      };

      // Add to history
      const newHistory = [...state.history.slice(0, state.historyIndex + 1), newDeck];
      const cappedHistory = newHistory.slice(-state.maxHistorySize);

      return {
        currentDeck: newDeck,
        history: cappedHistory,
        historyIndex: cappedHistory.length - 1,
      };
    });
  },

  // Remove card from deck section
  removeCard: (deckInstanceId: string, section: DeckSection) => {
    set((state) => {
      const newDeck: DeckType = {
        ...state.currentDeck,
        [section]: state.currentDeck[section].filter(
          (card) => card.deckInstanceId !== deckInstanceId,
        ),
      };

      // Add to history
      const newHistory = [...state.history.slice(0, state.historyIndex + 1), newDeck];
      const cappedHistory = newHistory.slice(-state.maxHistorySize);

      return {
        currentDeck: newDeck,
        history: cappedHistory,
        historyIndex: cappedHistory.length - 1,
      };
    });
  },

  // Clear deck
  clearDeck: () => {
    const newDeck = createInitialDeck();
    set((state) => {
      const newHistory = [...state.history.slice(0, state.historyIndex + 1), newDeck];
      const cappedHistory = newHistory.slice(-state.maxHistorySize);
      return {
        currentDeck: newDeck,
        history: cappedHistory,
        historyIndex: cappedHistory.length - 1,
      };
    });
  },

  // Update deck name
  updateDeckName: (name: string) => {
    set((state) => {
      const newDeck: DeckType = {
        ...state.currentDeck,
        name,
      };
      return { currentDeck: newDeck };
    });
  },

  // Update deck mode
  updateDeckMode: (mode: DeckMode) => {
    set((state) => {
      const newDeck: DeckType = {
        ...state.currentDeck,
        mode,
      };
      return { currentDeck: newDeck };
    });
  },

  // Undo: restore previous deck state
  undo: () => {
    const state = get();
    if (state.historyIndex > 0) {
      set({
        currentDeck: state.history[state.historyIndex - 1],
        historyIndex: state.historyIndex - 1,
      });
      return true;
    }
    return false;
  },

  // Redo: restore next deck state
  redo: () => {
    const state = get();
    if (state.historyIndex < state.history.length - 1) {
      set({
        currentDeck: state.history[state.historyIndex + 1],
        historyIndex: state.historyIndex + 1,
      });
      return true;
    }
    return false;
  },

  // Check if undo is possible
  canUndo: () => {
    return get().historyIndex > 0;
  },

  // Check if redo is possible
  canRedo: () => {
    const state = get();
    return state.historyIndex < state.history.length - 1;
  },

  // Derived selector: Get total count of a card by name across all sections
  getCardCountByName: (cardName: string) => {
    const state = get();
    const allCards = [
      ...state.currentDeck.mainDeck,
      ...state.currentDeck.extraDeck,
      ...state.currentDeck.sideDeck,
    ];
    return allCards.filter((card) => card.name === cardName).length;
  },

  // Derived selector: Get count of a card in a specific section
  getCardCountInSection: (cardName: string, section: DeckSection) => {
    const state = get();
    return state.currentDeck[section].filter((card) => card.name === cardName).length;
  },

  // Derived selector: Get total card count across all sections
  getTotalCardCount: () => {
    const state = get();
    return (
      state.currentDeck.mainDeck.length +
      state.currentDeck.extraDeck.length +
      state.currentDeck.sideDeck.length
    );
  },

  // Derived selector: Get deck statistics
  getDeckStats: () => {
    const state = get();
    const mainDeck = state.currentDeck.mainDeck;
    const mainCount = mainDeck.length;
    const extraCount = state.currentDeck.extraDeck.length;
    const sideCount = state.currentDeck.sideDeck.length;

    const monsterCount = mainDeck.filter((card) =>
      card.type.includes("Monster"),
    ).length;
    const spellCount = mainDeck.filter((card) =>
      card.type.includes("Spell"),
    ).length;
    const trapCount = mainDeck.filter((card) =>
      card.type.includes("Trap"),
    ).length;

    return {
      mainCount,
      extraCount,
      sideCount,
      monsterCount,
      spellCount,
      trapCount,
    };
  },

  // Derived selector: Get legality status for a card
  getLegalityStatus: (cardName: string, banlist: Record<string, BanStatus>) => {
    const state = get();
    const banStatus = banlist[cardName] || "Unlimited";
    
    let maxCopies = 3;
    if (banStatus === "Limited") maxCopies = 1;
    if (banStatus === "Semi-Limited") maxCopies = 2;
    if (banStatus === "Forbidden") maxCopies = 0;

    const currentCopies = state.getCardCountByName(cardName);
    const canAdd = currentCopies < maxCopies && banStatus !== "Forbidden";

    return {
      banStatus,
      maxCopies,
      currentCopies,
      canAdd,
    };
  },
}));

