import { useState, useRef, useCallback, useEffect } from "react";
import { getDeckBuilderSuggestions } from "@/lib/api/deckBuilderAgent";
import type { CardRecommendation, DeckAssessment } from "@/types/ai-agents";
import type { DeckType } from "@/types/types";
import { getDeckContext } from "@/lib/utils/deck-context";

const MILESTONE_CARD_COUNTS = [10, 20, 30, 40, 50];

interface UseDeckBuilderAnalysisOptions {
  currentDeck: DeckType;
  deckMode: "Master Duel" | "TCG";
  getDeckStats: () => {
    mainCount: number;
    extraCount: number;
    sideCount: number;
  };
}

export function useDeckBuilderAnalysis({
  currentDeck,
  deckMode,
  getDeckStats,
}: UseDeckBuilderAnalysisOptions) {
  const [isLoading, setIsLoading] = useState(false);
  const [analysis, setAnalysis] = useState<string>("");
  const [suggestions, setSuggestions] = useState<CardRecommendation[]>([]);
  const [deckAssessment, setDeckAssessment] = useState<DeckAssessment | null>(null);
  const [nextSteps, setNextSteps] = useState<string[]>([]);
  const [usage, setUsage] = useState<{
    tokens_used: number;
    cost_usd: number;
  } | null>(null);
  const [lastAnalyzedDeckId, setLastAnalyzedDeckId] = useState<string | null>(null);
  const [lastMilestone, setLastMilestone] = useState<number>(0);

  const debounceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const analysisCacheRef = useRef<Map<string, any>>(new Map());

  // Perform analysis function
  const performAnalysis = useCallback(async () => {
    const deckId = currentDeck.id;
    if (!deckId) return;

    // Check cache
    const cacheKey = `${deckId}-${currentDeck.mainDeck.length}-${currentDeck.extraDeck.length}`;
    const cached = analysisCacheRef.current.get(cacheKey);
    if (cached) {
      setAnalysis(cached.analysis);
      setSuggestions(cached.suggestions);
      setDeckAssessment(cached.deck_assessment);
      setNextSteps(cached.next_steps);
      setUsage(cached.estimated_cost);
      return;
    }

    setIsLoading(true);
    try {
      const banlistFormat = deckMode === "Master Duel" ? "MASTER_DUEL" : "TCG";
      const context = getDeckContext(getDeckStats);

      const response = await getDeckBuilderSuggestions({
        current_deck: currentDeck,
        context,
        banlist_format: banlistFormat,
      });

      setAnalysis(response.analysis);
      setSuggestions(response.suggestions || []);
      setDeckAssessment(response.deck_assessment);
      setNextSteps(response.next_steps || []);
      setUsage(response.estimated_cost || null);
      setLastAnalyzedDeckId(deckId);

      // Cache the result
      analysisCacheRef.current.set(cacheKey, {
        analysis: response.analysis,
        suggestions: response.suggestions,
        deck_assessment: response.deck_assessment,
        next_steps: response.next_steps,
        estimated_cost: response.estimated_cost,
      });

      // Limit cache size
      if (analysisCacheRef.current.size > 10) {
        const firstKey = analysisCacheRef.current.keys().next().value;
        if (firstKey) {
          analysisCacheRef.current.delete(firstKey);
        }
      }
    } catch (error: any) {
      // Error analyzing deck
      setAnalysis(`Error: ${error.message || "Failed to analyze deck"}`);
      setSuggestions([]);
      setDeckAssessment(null);
      setNextSteps([]);
    } finally {
      setIsLoading(false);
    }
  }, [currentDeck, deckMode, getDeckStats]);

  // Debounced analysis function
  const handleAnalyzeDeck = useCallback(
    async (trigger: "manual" | "auto" | "milestone" = "auto") => {
      // Clear existing timer
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }

      // For manual triggers, execute immediately
      if (trigger === "manual") {
        await performAnalysis();
        return;
      }

      // For auto/milestone, debounce
      debounceTimerRef.current = setTimeout(async () => {
        await performAnalysis();
      }, 2000);
    },
    [performAnalysis],
  );

  // Check if we should auto-suggest at milestone
  useEffect(() => {
    const stats = getDeckStats();
    const currentCount = stats.mainCount;

    // Check if we've crossed a milestone
    const crossedMilestone = MILESTONE_CARD_COUNTS.find(
      (milestone) => currentCount >= milestone && lastMilestone < milestone,
    );

    if (crossedMilestone) {
      setLastMilestone(crossedMilestone);
      // Auto-trigger analysis
      handleAnalyzeDeck("milestone");
    }
  }, [
    currentDeck.mainDeck.length,
    lastMilestone,
    getDeckStats,
    handleAnalyzeDeck,
  ]);

  // Auto-analyze when deck changes (debounced)
  useEffect(() => {
    const deckId = currentDeck.id;
    if (deckId && deckId !== lastAnalyzedDeckId) {
      handleAnalyzeDeck("auto");
    }
  }, [
    currentDeck.id,
    currentDeck.mainDeck.length,
    currentDeck.extraDeck.length,
    lastAnalyzedDeckId,
    handleAnalyzeDeck,
  ]);

  // Cleanup debounce timer
  useEffect(() => {
    return () => {
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }
    };
  }, []);

  return {
    isLoading,
    analysis,
    suggestions,
    deckAssessment,
    nextSteps,
    usage,
    handleAnalyzeDeck,
  };
}
