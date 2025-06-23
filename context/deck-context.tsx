"use client";

import {
  createContext,
  useContext,
  useState,
  useEffect,
  type ReactNode,
} from "react";
import { Card } from "@/types/card";
import { BanStatus, DeckType } from "@/types/types";
import { v4 as uuidv4 } from "uuid";

type SavedDeck = {
  id: string;
  name: string;
  deck: DeckType;
  createdAt: string;
  updatedAt: string;
};

type DeckSection = "mainDeck" | "extraDeck" | "sideDeck";

interface DeckContextType {
  currentDeck: DeckType;
  savedDecks: SavedDeck[];
  addCardToDeck: (card: Card, deckType: DeckSection) => void;
  removeCardFromDeck: (cardId: string, deckType: DeckSection) => void;
  clearDeck: () => void;
  saveDeck: (name: string) => void;
  loadDeck: (id: string) => void;
  deleteDeck: (id: string) => void;
  exportDeck: () => string;
  importDeck: (jsonData: string) => void;
  renameDeck: (name: string) => void;
  getDeckStats: () => {
    mainCount: number;
    extraCount: number;
    sideCount: number;
    monsterCount: number;
    spellCount: number;
    trapCount: number;
  };
  getSynergyTips: () => string[];
}

const DeckContext = createContext<DeckContextType | undefined>(undefined);

export function DeckProvider({ children }: { children: ReactNode }) {
  const [currentDeck, setCurrentDeck] = useState<DeckType>({
    id: uuidv4(),
    name: "New Deck",
    mainDeck: [],
    extraDeck: [],
    sideDeck: [],
  });

  const [savedDecks, setSavedDecks] = useState<SavedDeck[]>([]);
  const [banlist, setBanlist] = useState<Record<string, BanStatus>>({});

  // Load saved decks from localStorage on initial render
  useEffect(() => {
    const savedDecksData = localStorage.getItem("savedDecks");
    if (savedDecksData) {
      setSavedDecks(JSON.parse(savedDecksData));
    }
  }, []);

  // Save decks to localStorage whenever they change
  useEffect(() => {
    localStorage.setItem("savedDecks", JSON.stringify(savedDecks));
  }, [savedDecks]);

  useEffect(() => {
    fetch("/data/master-duel-banlist.json")
      .then((res) => res.json())
      .then(setBanlist)
      .catch(() => setBanlist({}));
  }, []);

  const addCardToDeck = (card: Card, deckType: DeckSection) => {
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
    // Always add a new deckInstanceId for each deck card
    const cardWithInstanceId = { ...card, deckInstanceId: uuidv4() };
    return {
      ...prev,
      [deckType]: [...currentSection, cardWithInstanceId],
    };
  });
};


  const removeCardFromDeck = (deckInstanceId: string, deckType: DeckSection) => {
  setCurrentDeck((prev) => {
    const newDeck = prev[deckType].filter(
      (card) => card.deckInstanceId !== deckInstanceId
    );
    return {
      ...prev,
      [deckType]: newDeck,
    };
  });
};


  const clearDeck = () => {
    setCurrentDeck({
      id: uuidv4(),
      name: "New Deck",
      mainDeck: [],
      extraDeck: [],
      sideDeck: [],
    });
  };

  const saveDeck = (name: string) => {
    const now = new Date().toISOString();
    const newDeck: SavedDeck = {
      id: crypto.randomUUID(),
      name,
      deck: currentDeck,
      createdAt: now,
      updatedAt: now,
    };

    setSavedDecks((prev) => [...prev, newDeck]);
  };

  const loadDeck = (id: string) => {
    const deck = savedDecks.find((deck) => deck.id === id);
    if (deck) {
      setCurrentDeck(deck.deck);
    }
  };

  const deleteDeck = (id: string) => {
    setSavedDecks((prev) => prev.filter((deck) => deck.id !== id));
  };

  const exportDeck = () => {
    return JSON.stringify(currentDeck);
  };

  const importDeck = (jsonData: string) => {
    try {
      const importedDeck = JSON.parse(jsonData) as DeckType;
      setCurrentDeck(importedDeck);
    } catch (error) {
      console.error("Failed to import deck:", error);
    }
  };

  const renameDeck = (name: string) => {
    setCurrentDeck((prev) => ({
      ...prev,
      name,
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

    // Balance tips
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

    // Archetype synergies
    const archetypes = new Map<string, number>();
    currentDeck.mainDeck.forEach((card) => {
      if (card.archetype) {
        archetypes.set(
          card.archetype,
          (archetypes.get(card.archetype) || 0) + 1
        );
      }
    });

    // Check for specific card synergies
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

    // Deck size tips
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

  const value = {
    currentDeck,
    savedDecks,
    addCardToDeck,
    removeCardFromDeck,
    clearDeck,
    saveDeck,
    loadDeck,
    deleteDeck,
    exportDeck,
    importDeck,
    renameDeck,
    getDeckStats,
    getSynergyTips,
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
