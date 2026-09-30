import { create } from "zustand";
import { v4 as uuidv4 } from "uuid";
import type { Card } from "@/types/card";
import type {
  BanStatus,
  ClientDeck,
  DeckFormat,
  DeckSection,
} from "@/types/deck";
import { getArchetypeName } from "@/lib/deck/import";
import { mergeDeckAfterSave } from "@/lib/deck/merge-deck-after-save";

export type LiveDeckStats = {
  mainCount: number;
  extraCount: number;
  sideCount: number;
  monsterCount: number;
  spellCount: number;
  trapCount: number;
};

type LiveDeckState = {
  currentDeck: ClientDeck;
  banlist: Record<string, BanStatus>;
  isDirty: boolean;
  /**
   * Increments on every user edit. Autosave captures this before persist and
   * only clears dirty when it still matches (edits mid-flight stay dirty).
   */
  editGeneration: number;
  loading: boolean;
  error: string | null;
  setCurrentDeck: (
    deck: ClientDeck | ((prev: ClientDeck) => ClientDeck),
  ) => void;
  /**
   * Session restore / load without treating as a fresh user edit
   * (unless `isDirty` is true).
   */
  hydrateDeck: (deck: ClientDeck, options?: { isDirty?: boolean }) => void;
  setBanlist: (banlist: Record<string, BanStatus>) => void;
  setLoading: (loading: boolean) => void;
  setError: (error: string | null) => void;
  markClean: () => void;
  addCardToDeck: (card: Card, deckType: DeckSection) => void;
  removeCardFromDeck: (deckInstanceId: string, deckType: DeckSection) => void;
  clearDeck: (deckFormat?: DeckFormat) => void;
  copyDeck: (
    sourceDeck: ClientDeck,
    options?: { targetFormat?: DeckFormat; name?: string },
  ) => void;
  renameDeck: (name: string) => void;
  updateDeckFormat: (deckFormat: DeckFormat) => void;
  applyMergeAfterSave: (
    saved: Pick<ClientDeck, "id" | "name" | "deckFormat"> & {
      updated_at?: string;
    },
    expectedGeneration?: number,
  ) => void;
  exportDeck: () => string;
  importDeck: (jsonData: string) => void;
  getDeckStats: () => LiveDeckStats;
  getSynergyTips: () => string[];
};

function createEmptyDeck(deckFormat: DeckFormat = "Master Duel"): ClientDeck {
  return {
    id: uuidv4(),
    name: "New Deck",
    mainDeck: [],
    extraDeck: [],
    sideDeck: [],
    deckFormat,
  };
}

/**
 * Live workshop deck SSoT (Phase 1b).
 * DeckProvider / useDeck are thin selectors over this store — no duplicated arrays.
 */
export const useLiveDeckStore = create<LiveDeckState>((set, get) => ({
  currentDeck: createEmptyDeck(),
  banlist: {},
  isDirty: false,
  editGeneration: 0,
  loading: false,
  error: null,

  setCurrentDeck: (deck) => {
    set((state) => ({
      currentDeck: typeof deck === "function" ? deck(state.currentDeck) : deck,
      isDirty: true,
      editGeneration: state.editGeneration + 1,
    }));
  },

  hydrateDeck: (deck, options) => {
    set({
      currentDeck: deck,
      isDirty: Boolean(options?.isDirty),
    });
  },

  setBanlist: (banlist) => set({ banlist }),

  setLoading: (loading) => set({ loading }),

  setError: (error) => set({ error }),

  markClean: () => set({ isDirty: false }),

  addCardToDeck: (card, deckType) => {
    const { banlist } = get();
    set((state) => {
      const prev = state.currentDeck;
      const currentSection = Array.isArray(prev[deckType])
        ? prev[deckType]
        : [];
      const banStatus = banlist[card.name] || "Unlimited";
      let maxCopies = 3;
      if (banStatus === "Limited") maxCopies = 1;
      if (banStatus === "Semi-Limited") maxCopies = 2;
      if (banStatus === "Forbidden") maxCopies = 0;

      const totalCount = [
        ...(prev.mainDeck || []),
        ...(prev.extraDeck || []),
        ...(prev.sideDeck || []),
      ].filter((c) => c.id === card.id).length;

      if (totalCount >= maxCopies) return state;

      const cardWithInstanceId = { ...card, deckInstanceId: uuidv4() };
      return {
        currentDeck: {
          ...prev,
          [deckType]: [...currentSection, cardWithInstanceId],
        },
        isDirty: true,
        editGeneration: state.editGeneration + 1,
      };
    });
  },

  removeCardFromDeck: (deckInstanceId, deckType) => {
    set((state) => ({
      currentDeck: {
        ...state.currentDeck,
        [deckType]: state.currentDeck[deckType].filter(
          (card) => card.deckInstanceId !== deckInstanceId,
        ),
      },
      isDirty: true,
      editGeneration: state.editGeneration + 1,
    }));
  },

  clearDeck: (deckFormat = "Master Duel") => {
    set({
      currentDeck: createEmptyDeck(deckFormat),
      isDirty: false,
      error: null,
    });
  },

  copyDeck: (sourceDeck, options) => {
    const targetFormat = options?.targetFormat ?? sourceDeck.deckFormat;
    const baseName = options?.name ?? `Copy of ${sourceDeck.name}`;
    set((state) => ({
      currentDeck: {
        id: uuidv4(),
        name: baseName,
        mainDeck: sourceDeck.mainDeck.map((c) => ({
          ...c,
          deckInstanceId: uuidv4(),
        })),
        extraDeck: sourceDeck.extraDeck.map((c) => ({
          ...c,
          deckInstanceId: uuidv4(),
        })),
        sideDeck: sourceDeck.sideDeck.map((c) => ({
          ...c,
          deckInstanceId: uuidv4(),
        })),
        deckFormat: targetFormat,
      },
      isDirty: true,
      editGeneration: state.editGeneration + 1,
    }));
  },

  renameDeck: (name) => {
    set((state) => {
      if (state.currentDeck.name === name) return state;
      return {
        currentDeck: { ...state.currentDeck, name },
        isDirty: true,
        editGeneration: state.editGeneration + 1,
      };
    });
  },

  updateDeckFormat: (deckFormat) => {
    set((state) => {
      if (state.currentDeck.deckFormat === deckFormat) return state;
      return {
        currentDeck: { ...state.currentDeck, deckFormat },
        isDirty: true,
        editGeneration: state.editGeneration + 1,
      };
    });
  },

  applyMergeAfterSave: (saved, expectedGeneration) => {
    set((state) => {
      const merged = mergeDeckAfterSave(state.currentDeck, saved);
      const generationMatches =
        expectedGeneration === undefined ||
        state.editGeneration === expectedGeneration;
      return {
        currentDeck: merged,
        // Keep dirty if the user edited while the save was in flight.
        isDirty: generationMatches ? false : state.isDirty,
      };
    });
  },

  exportDeck: () => JSON.stringify(get().currentDeck),

  importDeck: (jsonData) => {
    try {
      const imported = JSON.parse(jsonData) as ClientDeck & {
        /** Legacy persisted field */
        mode?: DeckFormat;
      };
      const deckFormat =
        imported.deckFormat ?? imported.mode ?? ("Master Duel" as const);
      set((state) => ({
        currentDeck: {
          ...imported,
          deckFormat,
        },
        isDirty: true,
        editGeneration: state.editGeneration + 1,
        error: null,
      }));
    } catch {
      set({ error: "Failed to import deck: Invalid JSON" });
    }
  },

  getDeckStats: () => {
    const { mainDeck, extraDeck, sideDeck } = get().currentDeck;
    const mainCount = mainDeck?.length ?? 0;
    const extraCount = extraDeck?.length ?? 0;
    const sideCount = sideDeck?.length ?? 0;

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

  getSynergyTips: () => {
    const tips: string[] = [];
    const stats = get().getDeckStats();
    const { currentDeck } = get();

    if (stats.monsterCount > 25) {
      tips.push(
        "Your deck has too many monsters. Consider adding more Spell cards for balance.",
      );
    }
    if (stats.spellCount < 8 && stats.mainCount > 30) {
      tips.push("Consider adding more Spell cards to support your monsters.");
    }
    if (stats.trapCount < 5 && stats.mainCount > 30) {
      tips.push("Your deck could benefit from more Trap cards for protection.");
    }
    const archetypes = new Map<string, number>();
    currentDeck.mainDeck.forEach((card) => {
      const archetypeName = getArchetypeName(card);
      if (archetypeName) {
        archetypes.set(archetypeName, (archetypes.get(archetypeName) || 0) + 1);
      }
    });
    const hasDarkMagician = currentDeck.mainDeck.some(
      (card) => card.name === "Dark Magician",
    );
    const hasDarkMagicalCircle = currentDeck.mainDeck.some(
      (card) => card.name === "Dark Magical Circle",
    );
    if (hasDarkMagician && !hasDarkMagicalCircle) {
      tips.push(
        "Consider adding Dark Magical Circle to synergize with your Dark Magician.",
      );
    }
    if (stats.mainCount < 40) {
      tips.push(
        `Your Main Deck has ${stats.mainCount} cards. The minimum required is 40.`,
      );
    } else if (stats.mainCount > 50) {
      tips.push(
        "Your Main Deck exceeds 50 cards. Consider reducing it for better consistency.",
      );
    }
    return tips;
  },
}));
