/**
 * Phase 6: Lightweight analytics hooks
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
  const track = (event: AnalyticsEvent) => {
    // Phase 6: Lightweight - just log for now
    // In production, this would send to analytics service
    if (process.env.NODE_ENV === "development") {
      console.log("[Analytics]", event);
    }

    // TODO: Send to analytics endpoint if configured
    // if (process.env.NEXT_PUBLIC_ANALYTICS_ENABLED === "true") {
    //   fetch("/api/analytics", {
    //     method: "POST",
    //     headers: { "Content-Type": "application/json" },
    //     body: JSON.stringify(event),
    //   }).catch(() => {
    //     // Silently fail - analytics should never break the app
    //   });
    // }
  };

  return { track };
}

