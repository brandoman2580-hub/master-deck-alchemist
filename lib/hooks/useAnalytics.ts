/**
 * Lightweight analytics hooks
 * Tracks user interactions for deck building and AI features
 */

export type AnalyticsEvent =
  | { type: "card_added"; cardId: number; cardName: string; section: "mainDeck" | "extraDeck" | "sideDeck" }
  | { type: "card_removed"; cardId: number; cardName: string; section: "mainDeck" | "extraDeck" | "sideDeck" }
  | { type: "ai_recommendation_accepted"; cardId: number; cardName: string; reason?: string }
  | { type: "ai_recommendation_rejected"; cardId: number; cardName: string }
  | { type: "deck_exported"; format: string }
  | { type: "deck_imported"; format: string }
  | { type: "filter_applied"; filterType: string; value: string }
  | { type: "search_performed"; query: string; resultCount: number };

/**
 * Lightweight analytics hook
 * Sends events to analytics endpoint (if configured) or logs locally
 */
export function useAnalytics() {
  const track = (_event: AnalyticsEvent) => {
    // Analytics tracking - in production, this would send to analytics service
    // No client-side logging to avoid exposing user data
    // Parameter prefixed with _ to indicate intentionally unused until analytics service is integrated
  };

  return { track };
}

