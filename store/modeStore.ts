import type { DeckMode } from "@/types/deck";
import { create } from "zustand";

type ModeStore = {
  deckMode: "TCG" | "Master Duel";
  setDeckMode: (deckMode: DeckMode) => void;
};

export const useModeStore = create<ModeStore>((set) => ({
  deckMode: "Master Duel",
  setDeckMode: (deckMode) => set({ deckMode }),
}));
