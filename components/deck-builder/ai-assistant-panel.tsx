"use client";

import { useState, useRef, useEffect, useCallback, useMemo } from "react";
import { ChevronLeft, ChevronRight, Bot, Sparkles, X, Check, XCircle, Loader2, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card as CardUI, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { DeckType, DeckMode } from "@/types/types";
import { getRecommendations } from "@/lib/api/recommendationAgent";
import type { RecommenderResponse, Recommendation } from "@/types/recommender";
import { useDeck } from "@/context/deck-context";
import { useModeStore } from "@/store/modeStore";
import { useRecommendedCardsStore } from "@/store/recommendedCardsStore";
import { useAnalytics } from "@/lib/hooks/useAnalytics";
import { useThrottledCallback } from "@/lib/hooks/useThrottledCallback";

interface AIAssistantPanelProps {
  currentDeck: DeckType;
  onActionConfirm?: (action: { type: string; cardName: string; cardId?: number; quantity?: number; reason?: string }) => void;
}

/**
 * Phase 4: Persistent AI Assistant Panel
 * - Always visible side panel (not modal)
 * - Collapsible to save space
 * - Shop clerk/advisor visual design
 * - Explicit actions with user confirmation
 * - Uses summaries, not raw card text
 * - Never sends full card pool
 * - Caps tokens aggressively
 */
export function AIAssistantPanel({
  currentDeck,
  onActionConfirm,
}: AIAssistantPanelProps) {
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [isMinimized, setIsMinimized] = useState(false);
  const [recommendations, setRecommendations] = useState<RecommenderResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [pendingActions, setPendingActions] = useState<Map<string, Recommendation>>(new Map());
  const deckMode = useModeStore((state) => state.deckMode);
  const { addCardToDeck, getDeckStats } = useDeck();
  const setRecommendedCardIds = useRecommendedCardsStore((state) => state.setRecommendedCardIds);
  const { track } = useAnalytics();

  const toggleCollapse = useCallback(() => {
    setIsCollapsed((prev) => !prev);
  }, []);

  const toggleMinimize = useCallback(() => {
    setIsMinimized((prev) => !prev);
  }, []);

  // Phase 6: Throttled fetch function to prevent excessive API calls
  const fetchRecommendations = useThrottledCallback(
    async (deck: DeckType, mode: DeckMode) => {
      const deckStats = getDeckStats();
      // Only fetch if deck has cards
      if (deckStats.mainCount === 0 && deckStats.extraCount === 0) {
        setRecommendations(null);
        setRecommendedCardIds([]);
        return;
      }

      setLoading(true);
      try {
        const response = await getRecommendations({
          current_deck: deck,
          format: mode === "TCG" ? "TCG" : "MASTER_DUEL",
          recommendation_type: "personalized",
          maxOutputTokens: 600, // Phase 4: Cap tokens aggressively
          explainTo: "intermediate",
          // Phase 5: Focus on discovery - prefer unknown cards over staples
          question: "Suggest cards that are less commonly known but synergize well with this deck. Focus on discovery, not staples.",
        });
        setRecommendations(response);
        // Phase 5: Update recommended cards store for badges/highlights
        if (response.recommendations) {
          const cardIds = response.recommendations
            .map((rec) => parseInt(rec.cardId))
            .filter((id) => !isNaN(id));
          setRecommendedCardIds(cardIds);
        }
      } catch (error) {
        console.error("Error fetching recommendations:", error);
      } finally {
        setLoading(false);
      }
    },
    2000, // Phase 6: Throttle to max once per 2 seconds
  );

  // Fetch recommendations when deck changes (debounced + throttled)
  useEffect(() => {
    const timeoutId = setTimeout(() => {
      fetchRecommendations(currentDeck, deckMode);
    }, 1000); // Debounce 1 second

    return () => clearTimeout(timeoutId);
  }, [currentDeck, deckMode, fetchRecommendations]);

  // Handle action confirmation
  const handleActionConfirm = useCallback((recommendation: Recommendation, approved: boolean) => {
    // Phase 6: Track analytics
    if (approved) {
      track({
        type: "ai_recommendation_accepted",
        cardId: parseInt(recommendation.cardId),
        cardName: recommendation.cardName || "",
        reason: recommendation.reason,
      });
    } else {
      track({
        type: "ai_recommendation_rejected",
        cardId: parseInt(recommendation.cardId),
        cardName: recommendation.cardName || "",
      });
    }

    if (approved && recommendation.action === "add") {
      // Find card by name or ID
      // For now, we'll need the card object - this will be enhanced
      if (onActionConfirm) {
        onActionConfirm({
          type: "add",
          cardName: recommendation.cardName || "",
          cardId: parseInt(recommendation.cardId),
          quantity: 1,
          reason: recommendation.reason,
        });
      }
    }
    // Remove from pending
    setPendingActions((prev) => {
      const next = new Map(prev);
      next.delete(recommendation.cardId);
      return next;
    });
  }, [onActionConfirm, track]);

  // Add recommendation to pending actions
  const handleRecommendationClick = useCallback((recommendation: Recommendation) => {
    setPendingActions((prev) => {
      const next = new Map(prev);
      next.set(recommendation.cardId, recommendation);
      return next;
    });
  }, []);

  // If minimized, show only a small button to expand
  if (isMinimized) {
    return (
      <div className="fixed right-0 top-1/2 -translate-y-1/2 z-40">
        <Button
          onClick={toggleMinimize}
          className="h-16 w-8 rounded-l-lg rounded-r-none bg-cyan-500/20 hover:bg-cyan-500/30 border border-cyan-500/50 border-r-0 shadow-lg"
          variant="ghost"
        >
          <Bot className="h-5 w-5 text-cyan-400" />
        </Button>
      </div>
    );
  }

  return (
    <div
      className={cn(
        "fixed right-0 top-0 h-full z-40 transition-all duration-300 ease-in-out",
        isCollapsed ? "w-16" : "w-96",
      )}
    >
      <div
        className="h-full bg-white/5 border border-white/10 backdrop-blur-xl shadow-lg rounded-xl hover:bg-white/10 hover:border-white/20 transition-all duration-300"
        style={{
          backdropFilter: "blur(6px) saturate(120%)",
          WebkitBackdropFilter: "blur(6px) saturate(120%)",
        }}
      >
        <CardUI className="bg-transparent h-full flex flex-col border-l-2 border-cyan-500/30">
          {/* Header */}
          <CardHeader className="pb-3 border-b border-cyan-500/10 flex-shrink-0">
            <div className="flex items-center justify-between">
              {!isCollapsed && (
                <div className="flex items-center gap-2">
                  <div className="h-8 w-8 rounded-full bg-gradient-to-br from-cyan-400/30 to-purple-500/30 flex items-center justify-center border border-cyan-500/30">
                    <Bot className="h-4 w-4 text-cyan-300" />
                  </div>
                  <div>
                    <CardTitle className="text-sm font-bold text-white">
                      AI Advisor
                    </CardTitle>
                    <p className="text-xs text-muted-50/70">Shop Assistant</p>
                  </div>
                </div>
              )}
              {isCollapsed && (
                <div className="flex items-center justify-center w-full">
                  <Bot className="h-5 w-5 text-cyan-300" />
                </div>
              )}
              <div className="flex items-center gap-1">
                {!isCollapsed && (
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={toggleMinimize}
                    className="h-6 w-6 text-muted-50 hover:text-white hover:bg-cyan-500/10"
                  >
                    <X className="h-3 w-3" />
                  </Button>
                )}
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={toggleCollapse}
                  className="h-6 w-6 text-muted-50 hover:text-white hover:bg-cyan-500/10"
                >
                  {isCollapsed ? (
                    <ChevronLeft className="h-4 w-4" />
                  ) : (
                    <ChevronRight className="h-4 w-4" />
                  )}
                </Button>
              </div>
            </div>
          </CardHeader>

          {/* Content */}
          {!isCollapsed && (
            <CardContent className="flex-1 overflow-hidden flex flex-col p-4">
              <div className="flex-1 overflow-y-auto space-y-4">
                {/* Welcome Message */}
                <div className="bg-cyan-500/10 border border-cyan-500/20 rounded-lg p-3">
                  <div className="flex items-start gap-2">
                    <Sparkles className="h-4 w-4 text-cyan-400 mt-0.5 flex-shrink-0" />
                    <div className="flex-1">
                      <p className="text-xs text-cyan-300/90 font-medium mb-1">
                        Welcome, Deck Builder!
                      </p>
                      <p className="text-xs text-muted-50/80 leading-relaxed">
                        I'm here to help you discover synergies and suggest improvements. 
                        All changes require your approval.
                      </p>
                    </div>
                  </div>
                </div>

                {/* Recommendations */}
                {loading && (
                  <div className="flex items-center justify-center py-8">
                    <Loader2 className="h-5 w-5 text-cyan-400 animate-spin" />
                    <span className="ml-2 text-xs text-muted-50">Analyzing deck...</span>
                  </div>
                )}

                {!loading && recommendations && (
                  <div className="space-y-2">
                    <p className="text-xs font-semibold text-muted-50 uppercase tracking-wider">
                      Recommendations
                    </p>
                    <div className="space-y-2">
                      {recommendations.recommendations.slice(0, 3).map((rec) => (
                        <div
                          key={rec.cardId}
                          className="bg-cyb-900/60 border border-cyan-500/10 rounded-lg p-3 hover:border-cyan-500/30 transition-colors cursor-pointer"
                          onClick={() => handleRecommendationClick(rec)}
                        >
                          <div className="flex items-start justify-between gap-2">
                            <div className="flex-1">
                              <div className="flex items-center gap-2 mb-1">
                                <span className="text-xs font-semibold text-cyan-300">
                                  {rec.cardName || `Card ${rec.cardId}`}
                                </span>
                                <Badge
                                  variant="outline"
                                  className={cn(
                                    "text-[10px] px-1.5 py-0",
                                    rec.action === "add" && "border-green-500/50 text-green-400",
                                    rec.action === "remove" && "border-red-500/50 text-red-400",
                                    rec.action === "replace" && "border-yellow-500/50 text-yellow-400",
                                  )}
                                >
                                  {rec.action}
                                </Badge>
                              </div>
                              {/* Phase 5: "Why this card?" - Prominent reason display */}
                              <div className="space-y-1.5">
                                <p className="text-xs font-semibold text-cyan-300/90 mb-1">
                                  Why this card?
                                </p>
                                <p className="text-xs text-muted-50/90 leading-relaxed">
                                  {rec.reason}
                                </p>
                                {rec.evidence && rec.evidence.length > 0 && (
                                  <div className="pt-1 border-t border-cyan-500/10">
                                    <p className="text-[10px] text-muted-50/70 font-medium mb-0.5">
                                      Evidence:
                                    </p>
                                    <ul className="text-[10px] text-muted-50/60 space-y-0.5">
                                      {rec.evidence.slice(0, 2).map((evidence, idx) => (
                                        <li key={idx} className="flex items-start gap-1">
                                          <span className="text-cyan-400/60 mt-0.5">•</span>
                                          <span>{evidence}</span>
                                        </li>
                                      ))}
                                    </ul>
                                  </div>
                                )}
                              </div>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {!loading && !recommendations && (
                  <div className="bg-cyb-900/60 border border-cyan-500/10 rounded p-3">
                    <p className="text-xs text-muted-50/70">
                      Add cards to your deck to get AI suggestions
                    </p>
                  </div>
                )}
              </div>

              {/* Action Confirmation Area */}
              {pendingActions.size > 0 && (
                <div className="mt-4 pt-4 border-t border-cyan-500/10 space-y-2">
                  <p className="text-xs font-semibold text-muted-50 uppercase tracking-wider mb-2">
                    Pending Actions
                  </p>
                  {Array.from(pendingActions.values()).map((rec) => (
                    <div
                      key={rec.cardId}
                      className="bg-yellow-500/10 border border-yellow-500/30 rounded-lg p-3"
                    >
                      <div className="flex items-start justify-between gap-2 mb-2">
                        <div className="flex-1">
                          <p className="text-xs font-semibold text-yellow-300 mb-1">
                            {rec.action === "add" && "Add"} {rec.cardName}
                          </p>
                          <p className="text-xs text-muted-50/80">{rec.reason}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2 mt-2">
                        <Button
                          size="sm"
                          variant="default"
                          className="flex-1 h-7 text-xs bg-green-500/20 hover:bg-green-500/30 border border-green-500/50 text-green-300"
                          onClick={() => handleActionConfirm(rec, true)}
                        >
                          <Check className="h-3 w-3 mr-1" />
                          Confirm
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-7 px-2 text-xs text-muted-50 hover:text-red-400 hover:bg-red-500/10"
                          onClick={() => handleActionConfirm(rec, false)}
                        >
                          <XCircle className="h-3 w-3" />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          )}
        </CardUI>
      </div>
    </div>
  );
}

