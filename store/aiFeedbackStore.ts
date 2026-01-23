import { create } from "zustand";
export type AIRecommendationFeedbackEvent = {
  cardId: string;
  accepted: boolean;
  reasons?: string[];
  note?: string;
  timestamp: string; // ISO
};

type AIFeedbackState = {
  events: AIRecommendationFeedbackEvent[];
  recordFeedback: (event: Omit<AIRecommendationFeedbackEvent, "timestamp"> & { timestamp?: string }) => void;
  clearFeedback: () => void;
};

const MAX_EVENTS = 50;

export const useAIFeedbackStore = create<AIFeedbackState>((set) => ({
  events: [],
  recordFeedback: (event) =>
    set((state) => {
      const timestamp = event.timestamp ?? new Date().toISOString();

      const nextEvent: AIRecommendationFeedbackEvent = {
        cardId: event.cardId,
        accepted: event.accepted,
        reasons: event.reasons,
        note: event.note,
        timestamp,
      };

      // Keep latest per cardId (move-to-end semantics).
      const remaining = state.events.filter((e) => e.cardId !== event.cardId);
      const next = [...remaining, nextEvent].slice(-MAX_EVENTS);

      return { events: next };
    }),
  clearFeedback: () => set({ events: [] }),
}));

