import type { DeckFormat } from "@/types/deck";
import { create } from "zustand";

type FormatStore = {
  /** Global UI preference mirror — live deck SSoT is `useLiveDeckStore.currentDeck.deckFormat`. */
  deckFormat: DeckFormat;
  setDeckFormat: (deckFormat: DeckFormat) => void;
};

export const useFormatStore = create<FormatStore>((set) => ({
  deckFormat: "Master Duel",
  setDeckFormat: (deckFormat) => set({ deckFormat }),
}));

/** @deprecated Use `useFormatStore` */
export const useModeStore = useFormatStore;
