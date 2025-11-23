"use client";

import {
  createContext,
  useContext,
  useState,
  useEffect,
  type ReactNode,
  useCallback,
  useRef,
} from "react";
import { Card } from "@/types/card";
import { BanStatus, Deck, DeckMode, DeckType } from "@/types/types";
import { v4 as uuidv4 } from "uuid";
import { supabase } from "@/lib/supabaseClient";
import { getArchetypeName } from "@/lib/helpers";
import {
  saveDeck as saveDeckToSupabase,
  deleteDeck as deleteDeckFromSupabase,
  getUserDecks as getUserDecksFromSupabase,
  loadDeck as loadDeckFromSupabase,
} from "@/lib/supabaseDecks";

type DeckSection = "mainDeck" | "extraDeck" | "sideDeck";

interface DeckContextType {
  currentDeck: DeckType;
  setCurrentDeck: React.Dispatch<React.SetStateAction<DeckType>>;
  savedDecks: Deck[];
  addCardToDeck: (card: Card, deckType: DeckSection) => void;
  removeCardFromDeck: (cardId: string, deckType: DeckSection) => void;
  clearDeck: () => void;
  saveDeck: (deckData?: DeckType) => Promise<void>;
  loadDeck: (id: string) => Promise<void>;
  deleteDeck: (id: string) => Promise<void>;
  getUserDecks: () => Promise<void>;
  exportDeck: () => string;
  importDeck: (jsonData: string) => void;
  renameDeck: (name: string) => void;
  updateDeckMode: (mode: DeckMode) => void;
  getDeckStats: () => {
    mainCount: number;
    extraCount: number;
    sideCount: number;
    monsterCount: number;
    spellCount: number;
    trapCount: number;
  };
  getSynergyTips: () => string[];
  loading: boolean;
  error: string | null;
}

const DeckContext = createContext<DeckContextType | undefined>(undefined);

export function DeckProvider({ children }: { children: ReactNode }) {
  const [currentDeck, setCurrentDeck] = useState<DeckType>({
    id: uuidv4(),
    name: "New Deck",
    mainDeck: [],
    extraDeck: [],
    sideDeck: [],
    mode: 'Master Duel' as DeckMode,
  });
  const [savedDecks, setSavedDecks] = useState<Deck[]>([]);
  const [banlist, setBanlist] = useState<Record<string, BanStatus>>({});
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const saveTimeout = useRef<NodeJS.Timeout | null>(null);

  // Fetch banlist on mount from Supabase
  useEffect(() => {
    const loadBanlist = async () => {
      try {
        const { getMasterDuelBanlist } = await import("@/lib/api");
        const banlistData = await getMasterDuelBanlist();
        setBanlist(banlistData);
      } catch (error) {
        console.error("Error loading banlist:", error);
        setBanlist({});
      }
    };
    loadBanlist();
  }, []);

  // --- Deck Operations ---

  const addCardToDeck = useCallback(
    (card: Card, deckType: DeckSection) => {
      setCurrentDeck((prev) => {
        const currentSection = Array.isArray(prev[deckType])
          ? prev[deckType]
          : [];
        const banStatus = banlist[card.name] || "Unlimited";
        let maxCopies = 3;
        if (banStatus === "Limited") maxCopies = 1;
        if (banStatus === "Semi-Limited") maxCopies = 2;
        if (banStatus === "Forbidden") maxCopies = 0;

        const count = currentSection.filter((c) => c.id === card.id).length;
        if (count >= maxCopies) return prev;
        const cardWithInstanceId = { ...card, deckInstanceId: uuidv4() };
        return {
          ...prev,
          [deckType]: [...currentSection, cardWithInstanceId],
        };
      });
    },
    [banlist]
  );

  const removeCardFromDeck = useCallback(
    (deckInstanceId: string, deckType: DeckSection) => {
      setCurrentDeck((prev) => ({
        ...prev,
        [deckType]: prev[deckType].filter(
          (card) => card.deckInstanceId !== deckInstanceId
        ),
      }));
    },
    []
  );

  const clearDeck = useCallback(() => {
    setCurrentDeck({
      id: uuidv4(),
      name: "New Deck",
      mainDeck: [],
      extraDeck: [],
      sideDeck: [],
      mode: "Master Duel",
    });
  }, []);

  // --- Supabase CRUD ---

  const getUserDecks = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) {
        setSavedDecks([]);
        return;
      }

      // Use supabaseDecks function
      const decks = await getUserDecksFromSupabase(user.id);
      setSavedDecks(decks);
    } catch (err: any) {
      setError(err.message || "Failed to load decks");
    } finally {
      setLoading(false);
    }
  }, []);

  const saveDeck = useCallback(
    async (deckData?: DeckType) => {
      setLoading(true);
      setError(null);
      try {
        const {
          data: { user },
        } = await supabase.auth.getUser();
        if (!user) throw new Error("User not authenticated");

        const deckToSave = deckData || currentDeck;

        // Validate deck data before saving
        if (!deckToSave.id || !deckToSave.name) {
          throw new Error("Invalid deck data: missing id or name");
        }

        // Ensure arrays are properly initialized
        const validatedDeck = {
          ...deckToSave,
          mainDeck: deckToSave.mainDeck || [],
          extraDeck: deckToSave.extraDeck || [],
          sideDeck: deckToSave.sideDeck || [],
          mode: deckToSave.mode || "Master Duel",
        };

        // Use supabaseDecks function
        await saveDeckToSupabase(validatedDeck, user.id);

        await getUserDecks();
      } catch (err: any) {
        const errorMessage = err?.message || err?.error_description || err?.details || "Failed to save deck";
        setError(errorMessage);
        console.error("saveDeck error:", err);
      } finally {
        setLoading(false);
      }
    },
    [currentDeck, getUserDecks]
  );

  const loadDeck = useCallback(async (id: string) => {
    setLoading(true);
    setError(null);
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) throw new Error("User not authenticated");

      // Use supabaseDecks function
      const deck = await loadDeckFromSupabase(id, user.id);
      setCurrentDeck(deck);
    } catch (err: any) {
      setError(err.message || "Failed to load deck");
    } finally {
      setLoading(false);
    }
  }, []);

  const deleteDeck = useCallback(
    async (id: string) => {
      setLoading(true);
      setError(null);
      try {
        const {
          data: { user },
        } = await supabase.auth.getUser();
        if (!user) throw new Error("User not authenticated");

        // Use supabaseDecks function
        await deleteDeckFromSupabase(id, user.id);
        await getUserDecks();
      } catch (err: any) {
        setError(err.message || "Failed to delete deck");
      } finally {
        setLoading(false);
      }
    },
    [getUserDecks]
  );

  // Debounced auto-save effect
  useEffect(() => {
    if (saveTimeout.current) clearTimeout(saveTimeout.current);
    // Don't auto-save if the deck is empty and named "New Deck"
    if (
      currentDeck.name === "New Deck" &&
      currentDeck.mainDeck.length === 0 &&
      currentDeck.extraDeck.length === 0 &&
      currentDeck.sideDeck.length === 0
    ) {
      return;
    }
    
    // Check if user is authenticated before auto-saving
    const checkUserAndSave = async () => {
      try {
        const {
          data: { user },
        } = await supabase.auth.getUser();
        if (user) {
          saveDeck(currentDeck);
        }
      } catch (error) {
        // Silently fail if user check fails - don't auto-save
        console.log("Auto-save skipped: user not authenticated");
      }
    };
    
    saveTimeout.current = setTimeout(checkUserAndSave, 1000); // Increased delay to 1000ms to reduce interference with drag operations
    return () => {
      if (saveTimeout.current) clearTimeout(saveTimeout.current);
    };
  }, [currentDeck, saveDeck]); // Triggers on any deck change

  // --- Utility Functions ---

  const exportDeck = () => JSON.stringify(currentDeck);

  const importDeck = (jsonData: string) => {
    try {
      const importedDeck = JSON.parse(jsonData) as DeckType;
      // Ensure the imported deck has a mode property, default to "Master Duel" if missing
      const deckWithMode = {
        ...importedDeck,
        mode: importedDeck.mode || "Master Duel" as const,
      };
      setCurrentDeck(deckWithMode);
    } catch (error) {
      setError("Failed to import deck: Invalid JSON");
    }
  };

  const renameDeck = (name: string) => {
    setCurrentDeck((prev) => ({
      ...prev,
      name,
    }));
  };

  const updateDeckMode = (mode: DeckMode) => {
    setCurrentDeck((prev) => ({
      ...prev,
      mode,
    }));
  };

  const getDeckStats = () => {
    const { mainDeck, extraDeck, sideDeck } = currentDeck;
    const mainCount = mainDeck?.length ?? 0;
    const extraCount = extraDeck?.length ?? 0;
    const sideCount = sideDeck?.length ?? 0;

    const monsterCount = mainDeck.filter((card) =>
      card.type.includes("Monster")
    ).length;
    const spellCount = mainDeck.filter((card) =>
      card.type.includes("Spell")
    ).length;
    const trapCount = mainDeck.filter((card) =>
      card.type.includes("Trap")
    ).length;

    return {
      mainCount,
      extraCount,
      sideCount,
      monsterCount,
      spellCount,
      trapCount,
    };
  };

  const getSynergyTips = () => {
    const tips: string[] = [];
    const stats = getDeckStats();

    if (stats.monsterCount > 25) {
      tips.push(
        "Your deck has too many monsters. Consider adding more Spell cards for balance."
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
        archetypes.set(
          archetypeName,
          (archetypes.get(archetypeName) || 0) + 1
        );
      }
    });
    const hasDarkMagician = currentDeck.mainDeck.some(
      (card) => card.name === "Dark Magician"
    );
    const hasDarkMagicalCircle = currentDeck.mainDeck.some(
      (card) => card.name === "Dark Magical Circle"
    );
    if (hasDarkMagician && !hasDarkMagicalCircle) {
      tips.push(
        "Consider adding Dark Magical Circle to synergize with your Dark Magician."
      );
    }
    if (stats.mainCount < 40) {
      tips.push(
        `Your Main Deck has ${stats.mainCount} cards. The minimum required is 40.`
      );
    } else if (stats.mainCount > 50) {
      tips.push(
        "Your Main Deck exceeds 50 cards. Consider reducing it for better consistency."
      );
    }
    return tips;
  };

  // --- Initial Deck Load on Mount ---
  useEffect(() => {
    getUserDecks();
    // Optionally, load the most recent deck as currentDeck here
  }, [getUserDecks]);

  // --- Context Value ---
  const value: DeckContextType = {
    currentDeck,
    setCurrentDeck,
    savedDecks,
    addCardToDeck,
    removeCardFromDeck,
    clearDeck,
    saveDeck,
    loadDeck,
    deleteDeck,
    getUserDecks,
    exportDeck,
    importDeck,
    renameDeck,
    updateDeckMode,
    getDeckStats,
    getSynergyTips,
    loading,
    error,
  };

  return <DeckContext.Provider value={value}>{children}</DeckContext.Provider>;
}

export function useDeck() {
  const context = useContext(DeckContext);
  if (context === undefined) {
    throw new Error("useDeck must be used within a DeckProvider");
  }
  return context;
}
