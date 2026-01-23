import { create } from "zustand";

/**
 * Store for tracking AI-recommended cards
 * Used to show "Recommended" badges and highlights in the card browser
 */
interface RecommendedCardsStore {
  recommendedCardIds: Set<number>;
  setRecommendedCardIds: (cardIds: number[]) => void;
  clearRecommendedCards: () => void;
  isRecommended: (cardId: number) => boolean;
}

export const useRecommendedCardsStore = create<RecommendedCardsStore>((set, get) => ({
  recommendedCardIds: new Set<number>(),
  
  setRecommendedCardIds: (cardIds: number[]) => {
    set({ recommendedCardIds: new Set(cardIds) });
  },
  
  clearRecommendedCards: () => {
    set({ recommendedCardIds: new Set<number>() });
  },
  
  isRecommended: (cardId: number) => {
    return get().recommendedCardIds.has(cardId);
  },
}));

