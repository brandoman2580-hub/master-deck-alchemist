// store/cardStore.ts
import { create } from "zustand";
import { Card } from "@/types/card";

interface CardStore {
  cardList: Card[];
  setCardList: (cards: Card[]) => void;
  loading: boolean;
  setLoading: (loading: boolean) => void;
}

export const useCardStore = create<CardStore>((set) => ({
  cardList: [],
  setCardList: (cards) => set({ cardList: cards }),
  loading: false,
  setLoading: (loading) => set({ loading }),
}));
