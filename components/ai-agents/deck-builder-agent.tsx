"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import {
  Loader2,
  Zap,
  Sparkles,
  CheckCircle2,
  AlertCircle,
  TrendingUp,
} from "lucide-react";
import { Button } from "../ui/button";
import {
  Card as CardUI,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
} from "../ui/card";
import { Badge } from "../ui/badge";
import { Progress } from "../ui/progress";
import { ScrollArea } from "../ui/scroll-area";
import { CardPreview } from "../ui/card-preview";
import { useDeck } from "../../context/deck-context";
import { Card } from "../../types/card";
import { BanStatus, DeckSection } from "../../types/types";
import { getDeckBuilderSuggestions } from "../../lib/api/deckBuilderAgent";
import { CardRecommendation, DeckAssessment } from "../../types/ai-agents";
import Image from "next/image";
import { getMasterDuelBanlist, getTCGBanlist } from "../../lib/api";
import { useModeStore } from "../../store/modeStore";

const MILESTONE_CARD_COUNTS = [10, 20, 30, 40, 50]; // Auto-suggest at these card counts

export default function DeckBuilderAgent() {
  const { currentDeck, addCardToDeck, getDeckStats } = useDeck();
  const deckMode = useModeStore((state) => state.deckMode);

  const [isLoading, setIsLoading] = useState(false);
  const [analysis, setAnalysis] = useState<string>("");
  const [suggestions, setSuggestions] = useState<CardRecommendation[]>([]);
  const [deckAssessment, setDeckAssessment] = useState<DeckAssessment | null>(
    null,
  );
  const [nextSteps, setNextSteps] = useState<string[]>([]);
  const [banlist, setBanlist] = useState<Record<string, BanStatus>>({});
  const [addingCardId, setAddingCardId] = useState<string | null>(null);
  const [addedCards, setAddedCards] = useState<Set<string>>(new Set());
  const [usage, setUsage] = useState<{
    tokens_used: number;
    cost_usd: number;
  } | null>(null);
  const [lastAnalyzedDeckId, setLastAnalyzedDeckId] = useState<string | null>(
    null,
  );
  const [lastMilestone, setLastMilestone] = useState<number>(0);

  const debounceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const analysisCacheRef = useRef<Map<string, any>>(new Map());

  // Load banlist on mount
  useEffect(() => {
    const loadBanlist = async () => {
      try {
        if (deckMode === "TCG") {
          const tcgBanlist = await getTCGBanlist();
          setBanlist(tcgBanlist);
        } else {
          const masterDuelBanlist = await getMasterDuelBanlist();
          setBanlist(masterDuelBanlist);
        }
      } catch (error) {
        console.error("Error loading banlist:", error);
        setBanlist({});
      }
    };
    loadBanlist();
  }, [deckMode]);

  // Determine context based on deck state
  const getDeckContext = useCallback(():
    | "initial_build"
    | "refining"
    | "completing" => {
    const stats = getDeckStats();
    if (stats.mainCount === 0) return "initial_build";
    if (stats.mainCount >= 50) return "completing";
    return "refining";
  }, [getDeckStats]);

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
      const context = getDeckContext();

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
      console.error("Error analyzing deck:", error);
      setAnalysis(`Error: ${error.message || "Failed to analyze deck"}`);
      setSuggestions([]);
      setDeckAssessment(null);
      setNextSteps([]);
    } finally {
      setIsLoading(false);
    }
  }, [currentDeck, deckMode, getDeckContext]);

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

  const canAddCardToDeck = (card: Card, deckType: DeckSection): boolean => {
    const banStatus = banlist[card.name] || "Unlimited";
    if (banStatus === "Forbidden") return false;

    let maxCopies = 3;
    if (banStatus === "Limited") maxCopies = 1;
    if (banStatus === "Semi-Limited") maxCopies = 2;

    const currentSection = currentDeck[deckType] || [];
    const currentCount = currentSection.filter((c) => c.id === card.id).length;

    if (currentCount >= maxCopies) return false;

    const deckStats = getDeckStats();
    if (deckType === "mainDeck" && deckStats.mainCount >= 60) return false;
    if (deckType === "extraDeck" && deckStats.extraCount >= 15) return false;
    if (deckType === "sideDeck" && deckStats.sideCount >= 15) return false;

    return true;
  };

  const getOptimalDeckType = (card: Card): DeckSection => {
    // Check for Extra Deck monster types (case-insensitive check for all variations)
    const type = card.type.toLowerCase();
    if (
      type.includes("fusion") ||
      type.includes("synchro") ||
      type.includes("xyz") ||
      type.includes("link")
    ) {
      return "extraDeck";
    }
    return "mainDeck";
  };

  const handleAddCardToDeck = async (
    card: Card,
    selectedDeckType?: DeckSection,
  ) => {
    const deckType = selectedDeckType || getOptimalDeckType(card);

    if (!canAddCardToDeck(card, deckType)) return;

    setAddingCardId(card.id.toString());
    await new Promise((resolve) => setTimeout(resolve, 300));

    addCardToDeck(card, deckType);
    setAddedCards((prev) => new Set([...prev, card.id.toString()]));

    setTimeout(() => {
      setAddedCards((prev) => {
        const newSet = new Set(prev);
        newSet.delete(card.id.toString());
        return newSet;
      });
    }, 2000);

    setAddingCardId(null);
  };

  const getPriorityColor = (priority: "high" | "medium" | "low") => {
    switch (priority) {
      case "high":
        return "bg-red-500/20 border-red-500/50 text-red-300";
      case "medium":
        return "bg-yellow-500/20 border-yellow-500/50 text-yellow-300";
      case "low":
        return "bg-blue-500/20 border-blue-500/50 text-blue-300";
    }
  };

  // Calculate token usage percentage (using 100k tokens as a reference max)
  const MAX_TOKENS_REFERENCE = 100000;
  const tokenUsagePercent = usage
    ? Math.min((usage.tokens_used / MAX_TOKENS_REFERENCE) * 100, 100)
    : 0;

  return (
    <CardUI className="bg-gradient-to-b from-cyan-400/20 via-cyan-500/15 to-cyan-600/5 backdrop-blur-md border border-cyan-500/30 rounded-2xl">
      <CardHeader className="pb-3 space-y-3">
        {/* Title and Button Row */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div className="flex items-center gap-2 min-w-0">
            <Sparkles className="h-5 w-5 text-cyan-400 flex-shrink-0" />
            <CardTitle
              className="text-slate-50 truncate"
              style={{ fontFamily: "var(--font-heading)" }}
            >
              AI Builder Assistant
            </CardTitle>
          </div>
          <Button
            size="sm"
            onClick={() => handleAnalyzeDeck("manual")}
            disabled={isLoading}
            className="text-xs h-7 flex-shrink-0 w-full sm:w-auto"
          >
            {isLoading ? (
              <>
                <Loader2 className="h-3 w-3 mr-1.5 animate-spin" />
                Analyzing...
              </>
            ) : (
              <>
                <Sparkles className="h-3 w-3 mr-1.5" />
                Quick Suggestions
              </>
            )}
          </Button>
        </div>

        {/* Description */}
        <CardDescription className="text-slate-300 text-sm">
          Get AI-powered suggestions as you build your deck
        </CardDescription>

        {/* Token Usage Progress Bar */}
        {usage && (
          <div className="space-y-1.5 pt-1 border-t border-cyan-500/20">
            <div className="flex items-center justify-between text-xs">
              <div className="flex items-center gap-2">
                <Zap className="h-3.5 w-3.5 text-cyan-400" />
                <span className="text-slate-300 font-medium">Token Usage</span>
              </div>
              <div className="flex items-center gap-2 text-slate-400">
                <span className="font-semibold text-cyan-400 tabular-nums">
                  {usage.tokens_used.toLocaleString()}
                </span>
                <span className="text-slate-400">/</span>
                <span className="tabular-nums">
                  {MAX_TOKENS_REFERENCE.toLocaleString()}
                </span>
                {usage.cost_usd > 0 && (
                  <>
                    <span className="text-slate-400">•</span>
                    <span className="text-slate-300">
                      ${usage.cost_usd.toFixed(4)}
                    </span>
                  </>
                )}
              </div>
            </div>
            <div className="relative">
              <Progress
                value={tokenUsagePercent}
                className="h-2 bg-slate-900/60"
              />
              <div
                className="absolute inset-0 flex items-center justify-center text-[10px] font-semibold text-slate-200 pointer-events-none"
                style={{
                  color:
                    tokenUsagePercent > 80
                      ? "#ef4444"
                      : tokenUsagePercent > 50
                        ? "#facc15"
                        : "#22c55e",
                }}
              >
                {tokenUsagePercent.toFixed(1)}%
              </div>
            </div>
          </div>
        )}
      </CardHeader>
      <CardContent>
        <ScrollArea className="h-[400px] pr-4">
          <div className="space-y-4">
            {/* Deck Assessment */}
            {deckAssessment && (
              <div className="space-y-3">
                <h3 className="text-sm font-semibold text-cyan-400 uppercase tracking-wide">
                  Deck Assessment
                </h3>
                <div className="grid grid-cols-3 gap-3">
                  <div className="bg-slate-900/60 rounded-lg p-3 border border-cyan-500/20">
                    <div className="text-xs text-slate-400 mb-1">
                      Completeness
                    </div>
                    <div className="flex items-center gap-2">
                      <Progress
                        value={deckAssessment.completeness_score}
                        className="flex-1 h-2"
                      />
                      <span className="text-sm font-semibold text-cyan-400">
                        {deckAssessment.completeness_score}%
                      </span>
                    </div>
                  </div>
                  <div className="bg-slate-900/60 rounded-lg p-3 border border-cyan-500/20">
                    <div className="text-xs text-slate-400 mb-1">
                      Archetype Coherence
                    </div>
                    <div className="flex items-center gap-2">
                      <Progress
                        value={deckAssessment.archetype_coherence}
                        className="flex-1 h-2"
                      />
                      <span className="text-sm font-semibold text-cyan-400">
                        {deckAssessment.archetype_coherence}%
                      </span>
                    </div>
                  </div>
                  <div className="bg-slate-900/60 rounded-lg p-3 border border-cyan-500/20">
                    <div className="text-xs text-slate-400 mb-1">Balance</div>
                    <div className="flex items-center gap-2">
                      <Progress
                        value={deckAssessment.balance_score}
                        className="flex-1 h-2"
                      />
                      <span className="text-sm font-semibold text-cyan-400">
                        {deckAssessment.balance_score}%
                      </span>
                    </div>
                  </div>
                </div>

                {deckAssessment.strengths.length > 0 && (
                  <div className="bg-green-500/10 border border-green-500/30 rounded-lg p-3">
                    <div className="flex items-center gap-2 mb-2">
                      <CheckCircle2 className="h-4 w-4 text-green-400" />
                      <span className="text-xs font-semibold text-green-400 uppercase">
                        Strengths
                      </span>
                    </div>
                    <ul className="list-disc list-inside text-xs text-slate-300 space-y-1">
                      {deckAssessment.strengths.map((strength, i) => (
                        <li key={i}>{strength}</li>
                      ))}
                    </ul>
                  </div>
                )}

                {deckAssessment.issues.length > 0 && (
                  <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-3">
                    <div className="flex items-center gap-2 mb-2">
                      <AlertCircle className="h-4 w-4 text-red-400" />
                      <span className="text-xs font-semibold text-red-400 uppercase">
                        Issues
                      </span>
                    </div>
                    <ul className="list-disc list-inside text-xs text-slate-300 space-y-1">
                      {deckAssessment.issues.map((issue, i) => (
                        <li key={i}>{issue}</li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            )}

            {/* Analysis Text */}
            {analysis && (
              <div className="bg-slate-900/60 rounded-lg p-4 border border-cyan-500/20">
                <h3 className="text-sm font-semibold text-cyan-400 uppercase tracking-wide mb-2">
                  Analysis
                </h3>
                <p className="text-sm text-slate-300 leading-relaxed whitespace-pre-wrap">
                  {analysis}
                </p>
              </div>
            )}

            {/* Card Suggestions */}
            {suggestions.length > 0 && (
              <div className="space-y-3">
                <h3 className="text-sm font-semibold text-cyan-400 uppercase tracking-wide">
                  Suggested Cards
                </h3>
                <div className="space-y-2">
                  {suggestions.slice(0, 5).map((suggestion, index) => {
                    const card = suggestion.card_data;
                    if (!card) return null;

                    const isAdding = addingCardId === card.id.toString();
                    const wasAdded = addedCards.has(card.id.toString());
                    const sectionMap: Record<
                      "main" | "extra" | "side",
                      DeckSection
                    > = {
                      main: "mainDeck",
                      extra: "extraDeck",
                      side: "sideDeck",
                    };
                    const section = suggestion.section
                      ? sectionMap[suggestion.section] ||
                        getOptimalDeckType(card)
                      : getOptimalDeckType(card);
                    const canAdd = canAddCardToDeck(card, section);

                    return (
                      <div
                        key={`${suggestion.candidate_id}-${index}`}
                        className="flex gap-3 rounded-lg border border-cyan-500/20 bg-slate-900/40 p-3"
                      >
                        {card.card_images?.[0]?.image_url_small && (
                          <CardPreview
                            card={card}
                            banStatus={banlist[card.name] || "Unlimited"}
                          >
                            <div className="flex-shrink-0 cursor-pointer">
                              <Image
                                width={60}
                                height={88}
                                src={card.card_images?.[0]?.image_url_small || "/placeholder.svg"}
                                alt={card.name}
                                className="w-12 h-auto object-contain rounded-md shadow-sm"
                              />
                            </div>
                          </CardPreview>
                        )}
                        <div className="flex-1 min-w-0">
                          <div className="flex items-start justify-between gap-2 mb-1">
                            <span className="font-semibold text-slate-50 text-sm truncate">
                              {card.name}
                            </span>
                            <div className="flex items-center gap-2 flex-shrink-0">
                              <Badge
                                className={`text-[10px] px-2 py-0.5 ${getPriorityColor(suggestion.priority)}`}
                              >
                                {suggestion.priority}
                              </Badge>
                            </div>
                          </div>
                          <p className="text-xs text-slate-400 mb-2 leading-relaxed">
                            {suggestion.reason}
                          </p>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => handleAddCardToDeck(card, section)}
                            disabled={!canAdd || isAdding}
                            className="text-xs h-7"
                          >
                            {isAdding ? (
                              <>
                                <Loader2 className="h-3 w-3 mr-1.5 animate-spin" />
                                Adding...
                              </>
                            ) : wasAdded ? (
                              <>
                                <CheckCircle2 className="h-3 w-3 mr-1.5 text-green-400" />
                                Added
                              </>
                            ) : (
                              <>
                                <TrendingUp className="h-3 w-3 mr-1.5" />
                                Add to{" "}
                                {section === "mainDeck"
                                  ? "Main"
                                  : section === "extraDeck"
                                    ? "Extra"
                                    : "Side"}
                              </>
                            )}
                          </Button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Next Steps */}
            {nextSteps.length > 0 && (
              <div className="bg-slate-900/60 rounded-lg p-4 border border-cyan-500/20">
                <h3 className="text-sm font-semibold text-cyan-400 uppercase tracking-wide mb-2">
                  Next Steps
                </h3>
                <ul className="list-disc list-inside text-sm text-slate-300 space-y-1">
                  {nextSteps.map((step, i) => (
                    <li key={i}>{step}</li>
                  ))}
                </ul>
              </div>
            )}

            {isLoading && (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="h-6 w-6 animate-spin text-cyan-400" />
                <span className="ml-2 text-sm text-slate-300">
                  Analyzing deck...
                </span>
              </div>
            )}

            {!isLoading &&
              !analysis &&
              !deckAssessment &&
              suggestions.length === 0 && (
                <div className="text-center py-8 text-slate-400 text-sm">
                  <Sparkles className="h-8 w-8 mx-auto mb-2 text-cyan-400/50" />
                  <p>Start building your deck to get AI-powered suggestions</p>
                </div>
              )}
          </div>
        </ScrollArea>
      </CardContent>
    </CardUI>
  );
}
