import { create } from "zustand";

export type AIPlaystylePreference =
  | "aggro"
  | "control"
  | "combo"
  | "stall"
  | "hybrid";

export type AIExplainToPreference = "novice" | "intermediate" | "advanced";

type AIPrefsState = {
  playstyle: AIPlaystylePreference | null;
  explainTo: AIExplainToPreference;
  hasDismissedOnboarding: boolean;

  setPlaystyle: (playstyle: AIPlaystylePreference | null) => void;
  setExplainTo: (explainTo: AIExplainToPreference) => void;
  dismissOnboarding: () => void;
  resetAIPrefs: () => void;
};

export const useAIPrefsStore = create<AIPrefsState>((set) => ({
  playstyle: null,
  explainTo: "novice",
  hasDismissedOnboarding: false,

  setPlaystyle: (playstyle) => set({ playstyle }),
  setExplainTo: (explainTo) => set({ explainTo }),
  dismissOnboarding: () => set({ hasDismissedOnboarding: true }),
  resetAIPrefs: () =>
    set({
      playstyle: null,
      explainTo: "novice",
      hasDismissedOnboarding: false,
    }),
}));

