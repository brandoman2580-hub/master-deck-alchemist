"use client";

import { useState, useRef, useEffect, useCallback, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  X,
  Send,
  Bot,
  User,
  Loader2,
  Info,
  Aperture,
  ThumbsUp,
  ThumbsDown,
  Plus,
  SlidersHorizontal,
} from "lucide-react";
import { Avatar, AvatarFallback } from "@radix-ui/react-avatar";
import { useDeck } from "../../context/deck-context";
import { Card } from "../../types/card";
import { ScrollArea } from "@radix-ui/react-scroll-area";
import { Button } from "../ui/button";
import Image from "next/image";
import {
  Card as CardUI,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
  CardFooter,
} from "../ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "../ui/dialog";
import { Input } from "../ui/input";
import { Badge } from "../ui/badge";
import { useCardStore } from "../../store/cardStore";
import { BanStatus, DeckSection } from "../../types/types";
import { AIResponseCard } from "./ai-response-card";
import { CardPreview } from "../ui/card-preview";
import { FormattedRecommendationResponse } from "../ui/formatted-recommendation-response";
import { RecommenderUIBlocks } from "@/components/ui/recommender-ui-blocks";
import { submitFeedback, submitTelemetryFeedback } from "../../lib/api/recommendationFeedback";
import { extractNumberConstraint, detectDuplicateCards, formatNumberConstraint } from "../../lib/utils/prompt-utils";
import type {
  Message,
  AnalysisCategoryType,
  AnalysisMode,
  DeckAnalysisStructured,
} from "./types";
import { ANALYSIS_MODES } from "./constants";
import { fetchCategoryRecommendations } from "./helpers";
import { generateAIResponse } from "./generate-ai-response";
import { SuggestedQuestions } from "./suggested-questions";
import { buildConversationContextFromMessages } from "@/components/ai-chatbot/conversation-context";
import { AIPreferencesDialog } from "./ai-preferences-dialog";
import { useAIPrefsStore } from "@/store/aiPrefsStore";
import { AnimatedCheckmark } from "@/components/ui/animated-checkmark";
import {
  renderCategoryRecommendationCard,
  renderDeckAnalysisCard,
  renderPowerLevelCard,
  renderCardSuggestionsCard,
} from "./helpers";
import {
  modalVariants,
  backdropVariants,
  fadeInVariants,
  staggerContainer,
  staggerItem,
  useHoverAnimation,
  slideInLeftVariants,
  slideInRightVariants,
} from "@/lib/animations";
import { useReducedMotion } from "@/hooks/useReducedMotion";

type AIChatbotComponentProps = {
  isOpen: boolean;
  onClose: () => void;
  initialQuestion?: string;
};

export default function AIChatbot({
  isOpen,
  onClose,
  initialQuestion,
}: AIChatbotComponentProps) {
  const { currentDeck, addCardToDeck, removeCardFromDeck, getDeckStats, saveDeck } = useDeck();
  const prefersReducedMotion = useReducedMotion();
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const lastAppliedInitialQuestionRef = useRef<string | null>(null);
  const [isPreferencesDialogOpen, setIsPreferencesDialogOpen] = useState(false);

  const playstyle = useAIPrefsStore((s) => s.playstyle);
  const explainTo = useAIPrefsStore((s) => s.explainTo);
  const hasDismissedOnboarding = useAIPrefsStore((s) => s.hasDismissedOnboarding);
  const setPlaystyle = useAIPrefsStore((s) => s.setPlaystyle);
  const setExplainTo = useAIPrefsStore((s) => s.setExplainTo);
  const dismissOnboarding = useAIPrefsStore((s) => s.dismissOnboarding);

  const playstyleLabel = useMemo(() => {
    if (!playstyle) return null;
    return playstyle.slice(0, 1).toUpperCase() + playstyle.slice(1);
  }, [playstyle]);

  // Optimized input handler - useCallback to prevent unnecessary re-renders
  const handleInputChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      setInput(e.target.value);
    },
    [],
  );
  const [isLoading, setIsLoading] = useState(false);
  const [isAnalysisModeLoading, setIsAnalysisModeLoading] = useState<string | null>(null);
  const [selectedAnalysisMode, setSelectedAnalysisMode] = useState<AnalysisCategoryType | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const [banlist, setBanlist] = useState<Record<string, BanStatus>>({});
  const [addingCardId, setAddingCardId] = useState<string | null>(null);
  const [addedCards, setAddedCards] = useState<Set<string>>(new Set());
  const [isInfoDialogOpen, setIsInfoDialogOpen] = useState(false);
  const [feedbackStates, setFeedbackStates] = useState<
    Map<string, "approved" | "disapproved" | null>
  >(new Map());

  const allCards = useCardStore((state) => state.cardList);

  // Load banlist on mount from Supabase
  useEffect(() => {
    const loadBanlist = async () => {
      try {
        const { getMasterDuelBanlist } = await import("../../lib/api");
        const banlistData = await getMasterDuelBanlist();
        setBanlist(banlistData);
      } catch (error) {
        console.error("Error loading banlist:", error);
        setBanlist({});
      }
    };
    loadBanlist();
  }, []);

  // Define scrollToBottom before useEffect that uses it
  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, []);

  useEffect(() => {
    scrollToBottom();
  }, [messages, scrollToBottom]);

  const handleAnalysisModeSelect = useCallback(
    async (mode: AnalysisMode) => {
      const deckId = currentDeck?.id;
      if (!deckId) {
        const errorMessage: Message = {
          id: crypto.randomUUID(),
          role: "assistant",
          content: "Select or save a deck before running an analysis.",
          timestamp: new Date(),
          type: "error",
        };
        setMessages((prev) => [...prev, errorMessage]);
        return;
      }

      try {
        setSelectedAnalysisMode(mode.id);
        setIsAnalysisModeLoading(mode.id);

        try {
          await saveDeck(currentDeck);
        } catch (saveError) {
          console.warn("Failed to save deck before category analysis:", saveError);
        }

        const userMessage: Message = {
          id: crypto.randomUUID(),
          role: "user",
          content: mode.prompt,
          timestamp: new Date(),
          type: "analysis-mode",
        };
        setMessages((prev) => [...prev, userMessage]);

        const response = await fetchCategoryRecommendations({
          deckId: String(deckId),
          category: mode.id,
          prompt: mode.prompt,
        });

        const assistantMessage: Message = {
          id: crypto.randomUUID(),
          role: "assistant",
          content:
            response.recommendations?.categoryAnalysis?.summary ||
            "Here's the targeted analysis for your deck.",
          timestamp: new Date(),
          type: "analysis-mode",
          analysisCategory: mode.id,
          categoryRecommendation: response,
        };

        setMessages((prev) => [...prev, assistantMessage]);
      } catch (error: unknown) {
        console.error("Category analysis error:", error);
        const errorMessage: Message = {
          id: crypto.randomUUID(),
          role: "assistant",
          content: `Unable to run ${mode.label}. ${
            error instanceof Error ? error.message : "Please try again."
          }`,
          timestamp: new Date(),
          type: "error",
        };
        setMessages((prev) => [...prev, errorMessage]);
      } finally {
        setIsAnalysisModeLoading(null);
      }
    },
    [currentDeck, saveDeck],
  );

  const sendUserMessage = useCallback(
    async (rawMessage: string) => {
      if (isLoading) return;

      const messageContent = rawMessage.trim();
      if (messageContent === "") return;

      // Clear input immediately for better UX
      setInput("");

      const userMessage: Message = {
        id: crypto.randomUUID(),
        role: "user",
        content: messageContent,
        timestamp: new Date(),
      };

      // Compute deck stats + conversation context before we append the assistant reply
      const deckStats = getDeckStats();
      const conversationContext = buildConversationContextFromMessages({
        messages,
        feedbackStates,
        deckStats,
        pendingUserMessage: messageContent,
      });

      setMessages((prev) => [...prev, userMessage]);
      setIsLoading(true);

      try {
        // Ensure deck is saved to Supabase before analysis
        // This ensures the edge function can find the deck
        try {
          await saveDeck(currentDeck);
        } catch (saveError) {
          console.warn("Failed to save deck before analysis:", saveError);
          // Continue anyway - the deck might already be saved
        }

        const { message } = await generateAIResponse(
          messageContent,
          currentDeck,
          allCards,
          {
            deckStats,
            conversationContext,
            explainTo,
            userPrefs: playstyle ? { playstyle } : undefined,
          },
        );
        setMessages((prev) => [...prev, message]);
      } catch (error) {
        console.error("Error in sendUserMessage:", error);
        const errorMessage: Message = {
          id: crypto.randomUUID(),
          role: "assistant",
          content: `Error: ${error instanceof Error ? error.message : "Failed to send message."}`,
          timestamp: new Date(),
          type: "error",
        };
        setMessages((prev) => [...prev, errorMessage]);
      } finally {
        setIsLoading(false);
      }
    },
    [
      allCards,
      currentDeck,
      explainTo,
      feedbackStates,
      getDeckStats,
      isLoading,
      messages,
      playstyle,
      saveDeck,
    ],
  );

  const handleSendMessage = useCallback(() => {
    void sendUserMessage(input);
  }, [input, sendUserMessage]);

  // Enhanced card handling functions - memoized to prevent re-renders
  const canAddCardToDeck = useCallback(
    (card: Card, deckType: DeckSection): boolean => {
      const banStatus = banlist[card.name] || "Unlimited";
      if (banStatus === "Forbidden") return false;

      let maxCopies = 3;
      if (banStatus === "Limited") maxCopies = 1;
      if (banStatus === "Semi-Limited") maxCopies = 2;

      const currentSection = currentDeck[deckType] || [];
      const currentCount = currentSection.filter(
        (c) => c.id === card.id,
      ).length;

      if (currentCount >= maxCopies) return false;

      // Check deck limits
      const deckStats = getDeckStats();
      if (deckType === "mainDeck" && deckStats.mainCount >= 60) return false;
      if (deckType === "extraDeck" && deckStats.extraCount >= 15) return false;
      if (deckType === "sideDeck" && deckStats.sideCount >= 15) return false;

      return true;
    },
    [currentDeck, banlist, getDeckStats],
  );

  const getOptimalDeckType = useCallback((card: Card): DeckSection => {
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
  }, []);

  const handleAddCardToDeck = useCallback(
    async (card: Card, selectedDeckType?: DeckSection) => {
      const deckType = selectedDeckType || getOptimalDeckType(card);

      if (!canAddCardToDeck(card, deckType)) return;

      const cardId = card.id.toString();
      setAddingCardId(cardId);

      try {
        addCardToDeck(card, deckType);
        setAddedCards((prev) => new Set([...prev, cardId]));
      } finally {
        setAddingCardId(null);
      }
    },
    [addCardToDeck, canAddCardToDeck, getOptimalDeckType],
  );

  // Handle feedback for AI responses with optimistic UI and undo
  const handleFeedback = useCallback(
    async (messageId: string, feedback: "approved" | "disapproved") => {
      const message = messages.find((m) => m.id === messageId);
      if (!message) {
        console.warn("Cannot submit feedback: message not found");
        return;
      }

      // Phase 4: Try new telemetry format first, fallback to legacy
      const hasTelemetry = message.recommenderResponse?.meta?.deckFingerprint;
      const hasLegacyId = message.recommendation_id;

      if (!hasTelemetry && !hasLegacyId) {
        console.warn(
          "Cannot submit feedback: missing recommendation_id or deckFingerprint",
        );
        return;
      }

      // Find the user message that triggered this response to get the original question
      const messageIndex = messages.findIndex((m) => m.id === messageId);
      const userMessage = messageIndex > 0 ? messages[messageIndex - 1] : null;
      const originalQuestion = userMessage?.content || message.content;

      // Extract number constraint from original question
      const numberConstraint = extractNumberConstraint(originalQuestion);

      // Analyze recommendations for duplicates and count
      const recommendations = message.recommenderResponse?.recommendations || [];
      const duplicateInfo = detectDuplicateCards(recommendations);
      const receivedCount = recommendations.length;

      // Build context for feedback
      const feedbackContext = {
        originalQuestion,
        requestedCount: numberConstraint?.exact || numberConstraint || undefined,
        receivedCount,
        hasDuplicates: duplicateInfo.hasDuplicates,
        duplicateCount: duplicateInfo.duplicateCount,
      };

      // Optimistic update
      const previousFeedback = feedbackStates.get(messageId);
      setFeedbackStates((prev) => {
        const newMap = new Map(prev);
        newMap.set(messageId, feedback);
        return newMap;
      });

      try {
        if (hasTelemetry && message.recommenderResponse?.meta?.deckFingerprint) {
          // Phase 4: Submit telemetry feedback for new format with enhanced context
          // Use the first recommendation's suggestionId if available
          const firstSuggestion = message.recommenderResponse.recommendations?.[0];
          const suggestionId = firstSuggestion
            ? `rec-${message.recommendation_id || messageId}-${firstSuggestion.cardId}`
            : `rec-${message.recommendation_id || messageId}`;

          await submitTelemetryFeedback({
            deckFingerprint: message.recommenderResponse.meta.deckFingerprint as string,
            suggestionId,
            accepted: feedback === "approved",
            deck: currentDeck,
            explainTo: message.recommenderResponse.explainTo,
            context: feedbackContext,
          } as Parameters<typeof submitTelemetryFeedback>[0]);
          console.log("Telemetry feedback submitted successfully with context:", {
            requested: formatNumberConstraint(numberConstraint),
            received: receivedCount,
            hasDuplicates: duplicateInfo.hasDuplicates,
          });
        } else if (hasLegacyId) {
          // Legacy format
          await submitFeedback({
            recommendation_id: message.recommendation_id!,
            feedback_type: feedback,
          });
          console.log("Legacy feedback submitted successfully");
        }
      } catch (error) {
        // Revert on error
        setFeedbackStates((prev) => {
          const newMap = new Map(prev);
          if (previousFeedback) {
            newMap.set(messageId, previousFeedback);
          } else {
            newMap.delete(messageId);
          }
          return newMap;
        });
        console.error("Error sending feedback:", error);
        // Optionally show error toast
      }
    },
    [messages, feedbackStates, currentDeck],
  );

  // Hover animation for analysis modes
  const analysisModeHover = useHoverAnimation(1.02, -2);

  // Memoize expensive renders to prevent re-renders on input changes
  const memoizedAnalysisModes = useMemo(
    () => (
      <motion.div
        className="grid gap-3 sm:grid-cols-2"
        initial="hidden"
        animate="visible"
        variants={staggerContainer(0.1)}
      >
        {ANALYSIS_MODES.map((mode) => {
          const Icon = mode.icon;
          const isBusy = isAnalysisModeLoading === mode.id;
          const disabled = !currentDeck?.id || isAnalysisModeLoading !== null;
          return (
            <motion.button
              key={mode.id}
              type="button"
              onClick={() => handleAnalysisModeSelect(mode)}
              disabled={disabled}
              className={`group relative overflow-hidden rounded-2xl p-4 text-left bg-slate-900/70 ring-1 ring-slate-800 transition-colors duration-300 hover:ring-slate-600 ${disabled ? "opacity-60 cursor-not-allowed" : "cursor-pointer"}`}
              style={{
                background:
                  "linear-gradient(135deg, rgba(15,23,42,0.95), rgba(15,23,42,0.75))",
              }}
              variants={staggerItem}
              {...(disabled ? {} : analysisModeHover)}
            >
              <div className={`absolute inset-0 opacity-35 bg-gradient-to-br ${mode.accent}`} />
              <div className="relative flex items-start gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-white/10 border border-white/20 text-white/80">
                  <Icon className="h-5 w-5" />
                </div>
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-semibold text-white">
                      {mode.label}
                    </p>
                    <span className="text-[11px] uppercase text-white/60 tracking-[0.2em]">
                      {mode.id}
                    </span>
                  </div>
                  <p className="text-xs text-white/80 leading-relaxed">
                    {mode.description}
                  </p>
                  <p className="text-[11px] text-white/70">
                    Focus: {mode.prompt}
                  </p>
                </div>
              </div>
              <div className="relative mt-3 flex items-center gap-2 text-xs text-white/80">
                {isBusy ? (
                  <>
                    <Loader2 className="h-3 w-3 animate-spin" />
                    Calibrating…
                  </>
                ) : (
                  <>
                    <Aperture className="h-3 w-3" />
                    Run focused analysis
                  </>
                )}
              </div>
            </motion.button>
          );
        })}
      </motion.div>
    ),
    [isAnalysisModeLoading, currentDeck?.id, handleAnalysisModeSelect, analysisModeHover],
  );

  const memoizedCompactModes = useMemo(
    () => (
      <div className="flex flex-wrap gap-2">
        {ANALYSIS_MODES.map((mode) => {
          const isActive = selectedAnalysisMode === mode.id;
          const Icon = mode.icon;
          return (
            <button
              key={`compact-${mode.id}`}
              type="button"
              onClick={() => handleAnalysisModeSelect(mode)}
              className={`flex items-center gap-2 rounded-full px-3 py-1.5 text-xs transition-colors ${
                isActive
                  ? "bg-slate-800 text-slate-50"
                  : "bg-slate-900/60 text-slate-200 hover:bg-slate-800/80"
              }`}
            >
              <Icon className="h-3.5 w-3.5" />
              <span>{mode.label}</span>
            </button>
          );
        })}
      </div>
    ),
    [handleAnalysisModeSelect, selectedAnalysisMode],
  );

  const memoizedMessages = useMemo(
    () =>
      messages.map((message) => {
        const isAssistant = message.role === "assistant";
        const isDeckAnalysis =
          message.type === "deck-analysis" &&
          message.meta?.structuredAnalysis != null;
        const isCategoryAnalysis =
          message.type === "analysis-mode" &&
          message.categoryRecommendation != null;

        if (isAssistant && isCategoryAnalysis && message.categoryRecommendation) {
          return (
            <motion.div
              key={message.id}
              className="flex justify-start"
              initial="hidden"
              animate="visible"
              variants={fadeInVariants}
            >
              <div className="flex gap-4 max-w-[90%]">
                <Avatar className="bg-transparent shadow-none mt-1">
                  <AvatarFallback className="bg-transparent">
                    <div className="h-8 w-8 rounded-full bg-cyan-950/30 flex items-center justify-center border border-cyan-500/20 shadow-[0_0_10px_rgba(6,182,212,0.1)]">
                      <Bot className="h-4 w-4 text-cyan-400" />
                    </div>
                  </AvatarFallback>
                </Avatar>
                <div className="flex-1 space-y-2">
                  <div className="rounded-2xl rounded-tl-sm bg-slate-900/40 border border-white/5 backdrop-blur-sm p-1 shadow-sm">
                    {renderCategoryRecommendationCard(
                      message.categoryRecommendation,
                      allCards,
                      banlist,
                      canAddCardToDeck,
                      getOptimalDeckType,
                      handleAddCardToDeck,
                      addingCardId,
                      addedCards,
                    )}
                  </div>
                  <div className="text-[10px] text-slate-500 mt-1 text-left flex items-center gap-1.5 pl-1">
                    {message.timestamp.toLocaleTimeString([], {
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </div>
                </div>
              </div>
            </motion.div>
          );
        }

        // Render deck analysis card for structured analysis messages
        if (isAssistant && isDeckAnalysis) {
          const analysisType = message.meta?.analysisType ?? "summary";
          const meta = message.meta!;

          let analysisCard: JSX.Element | null = null;

          if (analysisType === "summary") {
            analysisCard = renderDeckAnalysisCard(
              meta.structuredAnalysis as DeckAnalysisStructured,
              meta.deckStats ?? null,
            );
          } else if (analysisType === "power_level") {
            analysisCard = renderPowerLevelCard(
              meta.structuredAnalysis as {
                power_level?: {
                  score: number;
                  explanation: string;
                  suggestions: string[];
                };
              },
            );
          } else if (analysisType === "card_suggestions") {
            analysisCard = renderCardSuggestionsCard(
              meta.structuredAnalysis as {
                suggested_cards?: {
                  card_name: string;
                  section: "main" | "side" | "extra";
                  reason: string;
                }[];
                notes?: string;
              },
              allCards,
              addCardToDeck,
              getOptimalDeckType,
              getDeckStats,
              banlist,
              meta.deckId,
            );
          } else if (analysisType === "consistency") {
            const consistency = (
              meta.structuredAnalysis as DeckAnalysisStructured
            )?.consistency;
            if (consistency) {
              analysisCard = (
                <div className="w-full max-w-xl rounded-2xl border border-white/20 bg-white/10 backdrop-blur-xl p-4 space-y-3">
                  <h3 className="text-sm font-semibold tracking-wide uppercase text-white/90">
                    Consistency Analysis
                  </h3>
                  <div className="inline-flex items-center gap-2 rounded-full border border-white/20 bg-white/10 px-3 py-1 text-xs">
                    <span className="font-medium text-white/80">
                      Consistency
                    </span>
                    <span className="rounded-full bg-white/10 px-2 py-0.5 text-[11px] font-semibold text-white">
                      {consistency.score}/10
                    </span>
                  </div>
                  <p className="text-sm text-slate-300">
                    {consistency.explanation}
                  </p>
                  {consistency.suggestions &&
                    consistency.suggestions.length > 0 && (
                      <div className="space-y-1">
                        <h4 className="text-xs font-semibold uppercase text-slate-400">
                          Suggestions
                        </h4>
                        <ul className="list-disc pl-5 text-xs text-slate-400">
                          {consistency.suggestions.map((s, i) => (
                            <li key={i}>{s}</li>
                          ))}
                        </ul>
                      </div>
                    )}
                </div>
              );
            }
          } else if (analysisType === "resilience") {
            const resilience = (
              meta.structuredAnalysis as DeckAnalysisStructured
            )?.resilience_and_grind;
            if (resilience) {
              analysisCard = (
                <div className="w-full max-w-xl rounded-2xl border border-white/20 bg-white/10 backdrop-blur-xl p-4 space-y-3">
                  <h3 className="text-sm font-semibold tracking-wide uppercase text-white/90">
                    Resilience & Grind Analysis
                  </h3>
                  <div className="inline-flex items-center gap-2 rounded-full border border-white/20 bg-white/10 px-3 py-1 text-xs">
                    <span className="font-medium text-white/80">
                      Resilience
                    </span>
                    <span className="rounded-full bg-white/10 px-2 py-0.5 text-[11px] font-semibold text-white">
                      {resilience.score}/10
                    </span>
                  </div>
                  <p className="text-sm text-slate-300">
                    {resilience.explanation}
                  </p>
                  {resilience.suggestions &&
                    resilience.suggestions.length > 0 && (
                      <div className="space-y-1">
                        <h4 className="text-xs font-semibold uppercase text-slate-400">
                          Suggestions
                        </h4>
                        <ul className="list-disc pl-5 text-xs text-slate-400">
                          {resilience.suggestions.map((s, i) => (
                            <li key={i}>{s}</li>
                          ))}
                        </ul>
                      </div>
                    )}
                </div>
              );
            }
          } else if (analysisType === "matchup") {
            const matchup = (meta.structuredAnalysis as DeckAnalysisStructured)
              ?.matchup_profile;
            if (matchup) {
              analysisCard = (
                <div className="w-full max-w-xl rounded-2xl border border-white/20 bg-white/10 backdrop-blur-xl p-4 space-y-3">
                  <h3 className="text-sm font-semibold tracking-wide uppercase text-white/90">
                    Matchup Profile Analysis
                  </h3>
                  <div className="inline-flex items-center gap-2 rounded-full border border-white/20 bg-white/10 px-3 py-1 text-xs">
                    <span className="font-medium text-white/80">
                      Matchup Profile
                    </span>
                    <span className="rounded-full bg-white/10 px-2 py-0.5 text-[11px] font-semibold text-white">
                      {matchup.score}/10
                    </span>
                  </div>
                  <p className="text-sm text-slate-300">
                    {matchup.explanation}
                  </p>
                  {matchup.suggestions && matchup.suggestions.length > 0 && (
                    <div className="space-y-1">
                      <h4 className="text-xs font-semibold uppercase text-slate-400">
                        Suggestions
                      </h4>
                      <ul className="list-disc pl-5 text-xs text-slate-400">
                        {matchup.suggestions.map((s, i) => (
                          <li key={i}>{s}</li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              );
            }
          } else if (analysisType === "complexity") {
            const complexity = (
              meta.structuredAnalysis as DeckAnalysisStructured
            )?.complexity_and_skill;
            if (complexity) {
              analysisCard = (
                <div className="w-full max-w-xl rounded-2xl border border-white/20 bg-white/10 backdrop-blur-xl p-4 space-y-3">
                  <h3 className="text-sm font-semibold tracking-wide uppercase text-white/90">
                    Complexity & Skill Analysis
                  </h3>
                  <div className="inline-flex items-center gap-2 rounded-full border border-white/20 bg-white/10 px-3 py-1 text-xs">
                    <span className="font-medium text-white/80">
                      Complexity
                    </span>
                    <span className="rounded-full bg-white/10 px-2 py-0.5 text-[11px] font-semibold text-white">
                      {complexity.score}/10
                    </span>
                  </div>
                  <p className="text-sm text-white/80">
                    {complexity.explanation}
                  </p>
                  <div className="flex flex-wrap gap-2 text-xs text-white/70">
                    <span className="rounded-full border border-white/20 bg-white/5 px-2 py-0.5">
                      Skill floor: {complexity.skill_floor}
                    </span>
                    <span className="rounded-full border border-white/20 bg-white/5 px-2 py-0.5">
                      Skill ceiling: {complexity.skill_ceiling}
                    </span>
                  </div>
                </div>
              );
            }
          }

          // Fallback to summary if no specific card was rendered
          if (!analysisCard && meta.structuredAnalysis) {
            analysisCard = renderDeckAnalysisCard(
              meta.structuredAnalysis as DeckAnalysisStructured,
              meta.deckStats ?? null,
            );
          }

          return (
            <motion.div
              key={message.id}
              className="flex justify-start"
              initial="hidden"
              animate="visible"
              variants={fadeInVariants}
            >
              <div className="flex gap-4 max-w-[90%]">
                {/* Clean, icon-only avatar with transparent bg */}
                <Avatar className="bg-transparent shadow-none mt-1">
                  <AvatarFallback className="bg-transparent">
                    <div className="h-8 w-8 rounded-full bg-cyan-950/30 flex items-center justify-center border border-cyan-500/20 shadow-[0_0_10px_rgba(6,182,212,0.1)]">
                      <Bot className="h-4 w-4 text-cyan-400" />
                    </div>
                  </AvatarFallback>
                </Avatar>
                {/* Mode-specific Analysis Card */}
                <div className="flex-1">
                  <div className="rounded-2xl rounded-tl-sm overflow-hidden shadow-lg border border-white/5 bg-slate-900/40 backdrop-blur-md">
                    {analysisCard}
                  </div>
                  <div className="text-[10px] text-slate-500 mt-1 text-left flex items-center gap-1.5 pl-1">
                    {message.timestamp.toLocaleTimeString([], {
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </div>
                </div>
              </div>
            </motion.div>
          );
        }

        // Default rendering for all other messages
        return (
          <motion.div
            key={message.id}
            className="space-y-3 overflow-x-hidden"
            initial="hidden"
            animate="visible"
            variants={isAssistant ? slideInLeftVariants : slideInRightVariants}
          >
            <div
              className={`flex ${
                message.role === "user" ? "justify-end" : "justify-start"
              }`}
            >
              <div
                className={`flex gap-4 max-w-[85%] ${
                  message.role === "user" ? "flex-row-reverse" : ""
                }`}
              >
                {/* Clean, icon-only avatar with transparent bg */}
                <Avatar className="bg-transparent shadow-none mt-1">
                  <AvatarFallback className="bg-transparent">
                      {message.role === "user" ? (
                        <div className="h-8 w-8 rounded-full bg-indigo-500/20 flex items-center justify-center border border-indigo-400/30">
                          <User className="h-4 w-4 text-indigo-300" />
                        </div>
                      ) : (
                        <div className="h-8 w-8 rounded-full bg-cyan-950/30 flex items-center justify-center border border-cyan-500/20 shadow-[0_0_10px_rgba(6,182,212,0.1)]">
                          <Bot className="h-4 w-4 text-cyan-400" />
                        </div>
                      )}
                  </AvatarFallback>
                </Avatar>
                {/* Bubble */}
                <div className="flex-1 min-w-0">
                  <div
                    className={`px-6 py-4 rounded-2xl shadow-sm ${
                      message.role === "user"
                        ? "bg-indigo-600/20 border border-indigo-500/30 text-white rounded-tr-sm backdrop-blur-md"
                        : "bg-slate-900/60 border border-white/5 text-slate-100 rounded-tl-sm backdrop-blur-md"
                    }`}
                  >
                    {/* Phase 3: Render new strict schema response with UI blocks */}
                    {message.recommenderResponse ? (
                      <div className="space-y-4">
                        {/* Confidence indicator */}
                        {message.recommenderResponse.confidence !== undefined && (
                          <div className="flex items-center gap-2 text-sm">
                            <span className="text-slate-400">Confidence:</span>
                            <span
                              className={`font-semibold ${
                                message.recommenderResponse.confidence >= 0.6
                                  ? "text-green-400"
                                  : message.recommenderResponse.confidence >= 0.45
                                    ? "text-yellow-400"
                                    : "text-red-400"
                              }`}
                            >
                              {Math.round(message.recommenderResponse.confidence * 100)}%
                            </span>
                            {message.recommenderResponse.actions?.applyAllowed ? (
                              <span className="text-xs text-green-400 bg-green-400/10 px-2 py-0.5 rounded">
                                Apply Allowed
                              </span>
                            ) : null}
                            {message.recommenderResponse.actions?.investigateRecommended ? (
                              <span className="text-xs text-yellow-400 bg-yellow-400/10 px-2 py-0.5 rounded">
                                Review Recommended
                              </span>
                            ) : null}
                          </div>
                        )}
                        
                        {/* Render UI blocks */}
                        {message.recommenderResponse.ui && message.recommenderResponse.ui.length > 0 ? (
                          <>
                            {console.log("🔵 Rendering RecommenderUIBlocks:", {
                              blockCount: message.recommenderResponse.ui.length,
                              blockTypes: message.recommenderResponse.ui.map(b => b.type),
                              hasOnApplySuggestion: true,
                              recommendationCount: message.recommenderResponse.recommendations?.length || 0,
                            })}
                            <RecommenderUIBlocks
                              blocks={message.recommenderResponse.ui}
                              recommendations={message.recommenderResponse.recommendations}
                              reasoning={message.recommenderResponse.reasoning}
                              allCards={allCards}
                              onAddCard={async (cardId) => {
                                const card = allCards.find((c) => c.id === parseInt(cardId, 10));
                                if (card) {
                                  handleAddCardToDeck(card, getOptimalDeckType(card));
                                }
                              }}
                              onRemoveCard={async (cardId) => {
                                // Find card in deck and remove it
                                const cardIdNum = parseInt(cardId, 10);
                                const deckSections: DeckSection[] = ["mainDeck", "extraDeck", "sideDeck"];
                                for (const section of deckSections) {
                                  const cardInstance = currentDeck[section].find((c) => c.id === cardIdNum);
                                  if (cardInstance) {
                                    removeCardFromDeck(cardInstance.deckInstanceId, section);
                                    break;
                                  }
                                }
                              }}
                              addedCardIds={addedCards}
                              addingCardIds={new Set(addingCardId ? [addingCardId] : [])}
                            onApplySuggestion={async (suggestionId, cardId) => {
                              console.log("🔵 onApplySuggestion called:", { suggestionId, cardId });
                              if (cardId) {
                                const card = allCards.find((c) => c.id === parseInt(cardId, 10));
                                console.log("🔵 Card found:", card?.name || "NOT FOUND");
                                if (card) {
                                  handleAddCardToDeck(card, getOptimalDeckType(card));
                                  
                                  // Phase 4: Submit telemetry feedback when suggestion is applied
                                  // Find the user message that triggered this response
                                  const messageIndex = messages.findIndex((m) => m.id === message.id);
                                  const userMessage = messageIndex > 0 ? messages[messageIndex - 1] : null;
                                  const originalQuestion = userMessage?.content || "";
                                  const numberConstraint = extractNumberConstraint(originalQuestion);
                                  const recommendations = message.recommenderResponse?.recommendations || [];
                                  const duplicateInfo = detectDuplicateCards(recommendations);
                                  
                                  console.log("🔵 Submitting telemetry feedback...", {
                                    hasDeckFingerprint: !!message.recommenderResponse?.meta?.deckFingerprint,
                                    suggestionId,
                                    hasDeck: !!currentDeck,
                                    deckSize: currentDeck?.mainDeck?.length || 0,
                                    requestedCount: formatNumberConstraint(numberConstraint),
                                    receivedCount: recommendations.length,
                                  });
                                  try {
                                    const result = await submitTelemetryFeedback({
                                      deckFingerprint: message.recommenderResponse?.meta?.deckFingerprint as string || "", // Will be generated if empty
                                      suggestionId,
                                      accepted: true,
                                      deck: currentDeck, // Always provide deck so fingerprint can be generated
                                      explainTo: message.recommenderResponse?.explainTo || "novice",
                                      context: {
                                        originalQuestion,
                                        requestedCount: numberConstraint?.exact || numberConstraint || undefined,
                                        receivedCount: recommendations.length,
                                        hasDuplicates: duplicateInfo.hasDuplicates,
                                        duplicateCount: duplicateInfo.duplicateCount,
                                      },
                                    } as Parameters<typeof submitTelemetryFeedback>[0]);
                                    console.log("✅ Telemetry feedback submitted successfully:", result);
                                  } catch (error) {
                                    console.error("❌ Failed to submit telemetry feedback:", error);
                                    // Don't block the user action if telemetry fails
                                  }
                                } else {
                                  console.warn("⚠️ Card not found for cardId:", cardId);
                                }
                              } else {
                                console.warn("⚠️ No cardId provided to onApplySuggestion");
                              }
                            }}
                            onPreviewSuggestion={(_suggestionId, cardId) => {
                              if (cardId) {
                                const card = allCards.find((c) => c.id === parseInt(cardId, 10));
                                if (card) {
                                  // Open card preview modal or navigate to card detail
                                  console.log("Preview card:", card);
                                }
                              }
                            }}
                          />
                          </>
                        ) : (
                          // Fallback to summary if no UI blocks
                          <div className="prose prose-invert max-w-none text-slate-200">
                            {message.recommenderResponse.summary || message.content}
                          </div>
                        )}
                      </div>
                    ) : message.recommendedCards ||
                      message.alternativeConsiderations ? (
                      <FormattedRecommendationResponse
                        answer={message.content}
                        recommendedCards={message.recommendedCards}
                        alternativeConsiderations={
                          message.alternativeConsiderations
                        }
                        meta={message.recommendationMeta}
                        validatedCards={message.suggestedCards || []}
                        allCards={allCards}
                      />
                    ) : (
                      <AIResponseCard
                        content={message.content}
                        suggestedCards={message.suggestedCards || []}
                        cardSuggestionsMeta={message.cardSuggestionsMeta}
                        candidateCards={message.candidateCards}
                        banlist={banlist}
                        currentDeckMode={currentDeck.mode}
                        addingCardId={addingCardId}
                        addedCards={addedCards}
                        canAddCardToDeck={canAddCardToDeck}
                        getOptimalDeckType={getOptimalDeckType}
                        handleAddCardToDeck={handleAddCardToDeck}
                        allCards={allCards}
                        isCardSuggestionMode={
                          message.meta?.analysisType === "card_suggestions"
                        }
                      />
                    )}
                  </div>
                  <div
                    className={`flex items-center gap-2 mt-1 ${message.role === "user" ? "justify-end" : "justify-start"}`}
                  >
                    <div className="text-[10px] text-slate-500">
                      {message.timestamp.toLocaleTimeString([], {
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </div>
                    {message.role === "assistant" &&
                      message.type !== "error" &&
                      message.id !== "welcome" &&
                      message.recommendation_id && (
                        <div className="flex items-center gap-1">
                          <button
                            type="button"
                            onClick={() =>
                              handleFeedback(message.id, "approved")
                            }
                            className={`p-1 rounded transition-colors ${
                              feedbackStates.get(message.id) === "approved"
                                ? "text-green-400 bg-green-500/20"
                                : "text-slate-400 hover:text-green-400 hover:bg-green-500/10"
                            }`}
                            title="This response was helpful"
                          >
                            <ThumbsUp className="h-3.5 w-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={() =>
                              handleFeedback(message.id, "disapproved")
                            }
                            className={`p-1 rounded transition-colors ${
                              feedbackStates.get(message.id) === "disapproved"
                                ? "text-red-400 bg-red-500/20"
                                : "text-slate-400 hover:text-red-400 hover:bg-red-500/10"
                            }`}
                            title="This response was not helpful"
                          >
                            <ThumbsDown className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      )}
                  </div>
                </div>
              </div>
            </div>

            {/* Horizontal slideshow for recommended cards (separate from response bubble, below entire message) */}
            {message.role === "assistant" &&
              message.suggestedCards &&
              message.suggestedCards.length > 0 &&
              !message.recommenderResponse && (
                <motion.div
                  className="flex justify-start"
                  initial="hidden"
                  animate="visible"
                  variants={fadeInVariants}
                >
                  <div className="flex gap-2 max-w-[80%]">
                    {/* Spacer to align with avatar */}
                    <div className="w-6 h-6 flex-shrink-0" />
                    {/* Slideshow card */}
                    <div className="flex-1 rounded-xl bg-white/10 border border-white/20 backdrop-blur-xl p-4 min-w-0">
                      <h4 className="text-sm font-semibold text-white/90 mb-3">
                        Suggested Cards
                      </h4>
                      <div className="overflow-x-auto overflow-y-hidden pb-2 -mx-2 px-2 [&::-webkit-scrollbar]:h-2 [&::-webkit-scrollbar-track]:bg-transparent [&::-webkit-scrollbar-thumb]:bg-white/20 [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:hover:bg-white/30">
                        <div className="flex gap-3 min-w-max">
                          {message.suggestedCards
                            .filter((card) => {
                              const banStatus =
                                banlist[card.name] || "Unlimited";
                              return banStatus !== "Forbidden";
                            })
                            .map((card) => {
                              const cardId = card.id.toString();
                              const banStatus =
                                banlist[card.name] || "Unlimited";
                              const optimalDeckType = getOptimalDeckType(card);
                              const canAdd = canAddCardToDeck(
                                card,
                                optimalDeckType,
                              );
                              const isAdding = addingCardId === cardId;
                              const wasAdded = addedCards.has(cardId);

                              return (
                                <div
                                  key={card.id}
                                  className="flex-shrink-0 w-[200px] rounded-lg bg-white/5 border border-white/10 backdrop-blur-sm p-3 transition-all group hover:border-white/20 hover:bg-white/10"
                                >
                                  <div className="flex flex-col items-center gap-2">
                                    {/* Card Image with Preview */}
                                    <CardPreview
                                      card={card}
                                      banStatus={banStatus}
                                    >
                                      <div className="relative w-full aspect-[5/7] flex items-center justify-center cursor-pointer rounded overflow-hidden">
                                        <Image
                                          width={120}
                                          height={168}
                                          src={
                                            card.card_images?.[0]
                                              ?.image_url_small ||
                                            card.card_images?.[0]
                                              ?.image_url ||
                                            "/placeholder.svg"
                                          }
                                          alt={card.name}
                                          className="w-full h-full object-contain transition-transform group-hover:scale-[1.02]"
                                        />
                                      </div>
                                    </CardPreview>

                                    {/* Card Name */}
                                    <h4 className="font-medium text-xs text-center text-white/90 line-clamp-2 min-h-[2.5rem] leading-tight">
                                      {card.name}
                                    </h4>

                                    {/* Add Button */}
                                    <Button
                                      variant={wasAdded ? "default" : "outline"}
                                      size="sm"
                                      className={`h-7 w-full text-xs transition-all ${
                                        wasAdded
                                          ? "bg-white/20 border-white/30 text-white"
                                          : "bg-white/5 border-white/20 text-white/80 hover:bg-white/10 hover:text-white"
                                      }`}
                                      disabled={!canAdd || isAdding}
                                      onClick={() => handleAddCardToDeck(card)}
                                    >
                                      {isAdding ? (
                                        <>
                                          <Loader2 className="h-3 w-3 animate-spin mr-1" />
                                          Adding...
                                        </>
                                      ) : wasAdded ? (
                                        <>
                                          <AnimatedCheckmark className="h-3 w-3 mr-1" />
                                          Added
                                        </>
                                      ) : (
                                        <>
                                          <Plus className="h-3 w-3 mr-1" />
                                          Add to Deck
                                        </>
                                      )}
                                    </Button>
                                  </div>
                                </div>
                              );
                            })}
                        </div>
                      </div>
                    </div>
                  </div>
                </motion.div>
              )}
          </motion.div>
        );
      }),
    [
      messages,
      allCards,
      banlist,
      addingCardId,
      addedCards,
      currentDeck,
      canAddCardToDeck,
      getOptimalDeckType,
      handleAddCardToDeck,
      addCardToDeck,
      getDeckStats,
      feedbackStates,
      handleFeedback,
    ],
  );

  const refinementQuestions = useMemo(() => {
    if (isLoading) return [];

    const lastRecMessage = [...messages]
      .reverse()
      .find(
        (m) =>
          m.role === "assistant" &&
          m.recommenderResponse != null &&
          (m.recommenderResponse.recommendations?.length || 0) > 0,
      );

    if (!lastRecMessage?.recommenderResponse) return [];

    const topRec = lastRecMessage.recommenderResponse.recommendations?.[0];
    const topCardName = topRec?.cardName || "Card X";

    return [
      "Would you like alternatives that are easier to pilot?",
      `Should I explain why ${topCardName} synergizes with your deck?`,
      "Want to explore a different archetype with a similar gameplan?",
    ];
  }, [isLoading, messages]);

  // If the parent passes an initial question (e.g. from quick actions), prefill it once on open.
  useEffect(() => {
    if (!isOpen) return;
    const nextInitial = (initialQuestion || "").trim();
    if (!nextInitial) return;

    if (lastAppliedInitialQuestionRef.current === nextInitial) return;
    lastAppliedInitialQuestionRef.current = nextInitial;

    setInput(nextInitial);
  }, [initialQuestion, isOpen]);

  // Phase 4 (no budget): prompt once for playstyle + detail level to personalize recommendations.
  useEffect(() => {
    if (!isOpen) return;
    if (hasDismissedOnboarding) return;
    if (playstyle) return;
    setIsPreferencesDialogOpen(true);
  }, [hasDismissedOnboarding, isOpen, playstyle]);

  const memoizedInputForm = useMemo(
    () => (
      <form
        className="flex w-full gap-3 items-end"
        onSubmit={(e) => {
          e.preventDefault();
          handleSendMessage();
        }}
      >
        <div className="flex-1 relative group">
          <div className="absolute inset-0 bg-cyan-500/5 rounded-xl blur-sm group-focus-within:bg-cyan-500/10 transition-all duration-300" />
          <Input
            placeholder="Type your message..."
            value={input}
            autoFocus
            onChange={handleInputChange}
            onKeyDown={(e) => {
              // Prevent lag by handling Enter key directly
              if (
                e.key === "Enter" &&
                !e.shiftKey &&
                !isLoading &&
                input.trim() !== ""
              ) {
                e.preventDefault();
                handleSendMessage();
              }
            }}
            className="w-full h-12 bg-slate-900/60 border border-white/10 rounded-xl px-5 pr-12 text-slate-50 placeholder:text-slate-500 focus:border-cyan-500/50 focus-visible:ring-1 focus-visible:ring-cyan-500/30 transition-all shadow-inner relative z-10"
          />
          <button
            type="button"
            className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-cyan-400 transition-colors z-20 p-1.5 rounded-lg hover:bg-white/5"
            aria-label="Voice input (coming soon)"
            disabled
          >
            <svg
              className="h-5 w-5"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
              aria-hidden="true"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z"
              />
            </svg>
          </button>
        </div>
        <Button
          type="submit"
          variant="default"
          disabled={isLoading || input.trim() === ""}
          className="h-12 px-6 bg-cyan-500/10 border border-cyan-500/30 hover:bg-cyan-500/20 text-cyan-100 shadow-[0_0_15px_-3px_rgba(6,182,212,0.2)] hover:shadow-[0_0_20px_-3px_rgba(6,182,212,0.4)] transition-all rounded-xl"
          aria-label="Send message"
        >
          <Send className="h-5 w-5" aria-hidden="true" />
        </Button>
        <button
          type="button"
          onClick={() => setIsInfoDialogOpen(true)}
          className="text-slate-500 hover:text-cyan-400 transition-colors p-3 rounded-xl hover:bg-cyan-500/5 border border-transparent hover:border-cyan-500/20"
          aria-label="How to use the AI Assistant"
        >
          <Info className="h-5 w-5" aria-hidden="true" />
        </button>
      </form>
    ),
    [input, isLoading, handleInputChange, handleSendMessage],
  );

  // Modern, clean AI assistant UI inspired by futuristic HUDs
  return (
    <>
      {!prefersReducedMotion ? (
        <AnimatePresence mode="wait">
          {isOpen && (
            <motion.div
              key="ai-chatbot-modal"
              className="fixed inset-0 bg-slate-950/60 backdrop-blur-sm z-50 flex items-center justify-center p-4"
              variants={backdropVariants}
              initial="hidden"
              animate="visible"
              exit="exit"
            >
              <motion.div
                className="w-full max-w-5xl h-[85vh] rounded-3xl overflow-hidden relative shadow-2xl border border-white/10"
                style={{
                  background: "linear-gradient(165deg, rgba(2, 6, 23, 0.95) 0%, rgba(15, 23, 42, 0.9) 100%)",
                  boxShadow: "0 0 40px -10px rgba(20, 239, 255, 0.15), 0 0 15px -5px rgba(20, 239, 255, 0.1)",
                }}
                variants={modalVariants}
                initial="hidden"
                animate="visible"
                exit="exit"
              >
                {/* Decorative background elements */}
                <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-transparent via-cyan-500/50 to-transparent opacity-50" />
                <div className="absolute bottom-0 right-0 w-64 h-64 bg-cyan-500/5 blur-[100px] rounded-full pointer-events-none" />
                <div className="absolute top-0 left-0 w-64 h-64 bg-blue-600/5 blur-[100px] rounded-full pointer-events-none" />

                <CardUI className="w-full h-full flex flex-col bg-transparent border-none shadow-none relative z-10">
                  {/* Glassmorphic Header */}
                  <CardHeader className="pb-4 pt-6 px-8 border-b border-white/5 bg-white/5 backdrop-blur-md">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-4">
                        <div className="relative group">
                          <div className="absolute inset-0 bg-cyan-500/20 rounded-full blur-md group-hover:bg-cyan-500/30 transition-all duration-500" />
                          <div className="h-12 w-12 rounded-full bg-slate-900/80 flex items-center justify-center border border-white/10 relative shadow-inner ring-1 ring-white/5 group-hover:ring-cyan-500/30 transition-all">
                            <Bot className="h-6 w-6 text-cyan-400" />
                          </div>
                        </div>
                        <div>
                          <CardTitle
                            className="text-2xl font-bold text-white tracking-wide"
                            style={{ fontFamily: "var(--font-heading)" }}
                          >
                            AI <span className="text-cyan-400">ARCHITECT</span>
                          </CardTitle>
                          <CardDescription className="text-slate-400 text-xs mt-1 uppercase tracking-widest font-medium">
                            Deck Optimization System
                          </CardDescription>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        {playstyleLabel ? (
                          <Badge
                            variant="outline"
                            className="hidden sm:inline-flex border-cyan-500/30 text-cyan-200 bg-cyan-500/10"
                          >
                            Playstyle: {playstyleLabel}
                          </Badge>
                        ) : null}
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          onClick={() => setIsPreferencesDialogOpen(true)}
                          className="text-slate-400 hover:text-white hover:bg-white/5 rounded-full h-10 w-10 transition-all duration-300"
                          aria-label="Personalize AI settings"
                        >
                          <SlidersHorizontal className="h-5 w-5" aria-hidden="true" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={onClose}
                          className="text-slate-400 hover:text-white hover:bg-white/5 rounded-full h-10 w-10 transition-all duration-300 hover:rotate-90"
                          aria-label="Close AI Assistant"
                        >
                          <X className="h-5 w-5" aria-hidden="true" />
                        </Button>
                      </div>
                    </div>
                  </CardHeader>

                  <CardContent className="flex-1 overflow-hidden px-0 flex flex-col relative">
                    {/* Analysis modes - Animated Grid */}
                    <div
                      className={`px-8 pt-6 pb-4 space-y-6 transition-[max-height,opacity,transform] duration-500 ease-spring ${
                        selectedAnalysisMode
                          ? "max-h-0 opacity-0 -translate-y-4 pointer-events-none"
                          : "max-h-[600px] opacity-100 translate-y-0"
                      }`}
                    >
                      <div className="flex items-center justify-between gap-3">
                        <div>
                          <p className="text-[10px] uppercase tracking-[0.3em] text-cyan-400/80 font-bold mb-2">
                            Select Module
                          </p>
                          <h3 className="text-xl font-medium text-slate-100">
                            Initialize analysis protocol
                          </h3>
                        </div>
                      </div>
                      {memoizedAnalysisModes}
                    </div>

                    {/* Chat Area */}
                    {selectedAnalysisMode ? (
                      <div className="h-full flex-1 min-h-0 flex flex-col">
                        {/* Compact Mode Selector */}
                        <div className="px-8 pt-4 pb-2 flex items-center justify-between bg-gradient-to-b from-slate-950/20 to-transparent z-10">
                          <div className="text-xs font-medium text-slate-400 uppercase tracking-wider">Session Active</div>
                          {memoizedCompactModes}
                        </div>
                        
                        <ScrollArea className="flex-1 h-full min-h-0 overflow-y-auto overflow-x-hidden px-4 sm:px-8 pr-4 custom-scrollbar">
                          <div className="flex flex-col space-y-6 py-6 min-w-0">
                            {memoizedMessages}
                            {isLoading && (
                              <motion.div 
                                initial={{ opacity: 0, y: 10 }}
                                animate={{ opacity: 1, y: 0 }}
                                className="flex justify-start"
                              >
                                <div className="flex gap-4 max-w-[80%]">
                                  <div className="h-8 w-8 rounded-full bg-cyan-500/10 flex items-center justify-center border border-cyan-500/20 mt-1">
                                    <Bot className="h-4 w-4 text-cyan-400" />
                                  </div>
                                  <div className="px-6 py-4 rounded-2xl rounded-tl-sm bg-slate-900/50 border border-white/5 backdrop-blur-sm">
                                    <div className="flex gap-1 items-center">
                                      <span className="w-1.5 h-1.5 bg-cyan-400 rounded-full animate-bounce [animation-delay:-0.3s]" />
                                      <span className="w-1.5 h-1.5 bg-cyan-400 rounded-full animate-bounce [animation-delay:-0.15s]" />
                                      <span className="w-1.5 h-1.5 bg-cyan-400 rounded-full animate-bounce" />
                                    </div>
                                    <span className="text-xs text-cyan-500/70 mt-2 block font-medium">Processing Request...</span>
                                  </div>
                                </div>
                              </motion.div>
                            )}
                            <div ref={messagesEndRef} />
                          </div>
                        </ScrollArea>
                      </div>
                    ) : (
                      <div className="flex-1 flex flex-col items-center justify-center px-6 py-8 text-slate-400">
                        <div className="w-24 h-24 rounded-full bg-white/5 flex items-center justify-center mb-6 border border-white/10 shadow-[0_0_30px_-10px_rgba(255,255,255,0.1)]">
                          <Aperture className="h-10 w-10 text-white/20" />
                        </div>
                        <p className="text-center max-w-sm text-sm leading-relaxed">
                          Select a specialized analysis module above to begin optimizing your deck strategy.
                        </p>
                      </div>
                    )}
                  </CardContent>

                  {/* Input Area */}
                  {selectedAnalysisMode && (
                    <div className="p-6 pt-2 bg-gradient-to-t from-slate-950/90 via-slate-950/50 to-transparent">
                      
                      {refinementQuestions.length > 0 ? (
                        <SuggestedQuestions
                          questions={refinementQuestions}
                          onSelect={(question) => {
                            void sendUserMessage(question);
                          }}
                        />
                      ) : null}

                      {memoizedInputForm}
                    </div>
                  )}
                </CardUI>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>
      ) : (
        isOpen && (
          <div className="fixed inset-0 bg-slate-950/90 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <div className="w-full max-w-4xl h-[90vh] rounded-2xl bg-white/10 border border-white/20 backdrop-blur-xl shadow-lg overflow-hidden">
              <CardUI className="w-full h-full flex flex-col bg-transparent">
                {/* Clean Header */}
                <CardHeader className="pb-4 bg-white/5 border-b border-white/10">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="h-10 w-10 rounded-full bg-white/10 flex items-center justify-center border border-white/20">
                        <Bot className="h-5 w-5 text-white/80" />
                      </div>
                      <div>
                        <CardTitle
                          className="text-xl font-bold text-slate-50"
                          style={{ fontFamily: "var(--font-heading)" }}
                        >
                          AI Assistant
                        </CardTitle>
                        <CardDescription className="text-slate-300 text-sm mt-0.5">
                          What do you need help with?
                        </CardDescription>
                      </div>
                    </div>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={onClose}
                      className="text-slate-400 hover:text-slate-200 hover:bg-slate-800/50 rounded-lg"
                    >
                      <X className="h-5 w-5" />
                    </Button>
                  </div>
                </CardHeader>

                <CardContent className="flex-1 overflow-hidden px-0 flex flex-col">
                  {/* Analysis modes */}
                  <div
                    className={`px-6 pt-5 pb-4 space-y-4 bg-slate-950/50 transition-[max-height,opacity,transform] duration-400 ease-in-out ${
                      selectedAnalysisMode
                        ? "max-h-0 opacity-0 -translate-y-2 pointer-events-none"
                        : "max-h-[480px] opacity-100 translate-y-0"
                    }`}
                  >
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <p className="text-[11px] uppercase tracking-[0.35em] text-slate-300/80">
                          Analysis Modes
                        </p>
                        <p className="text-lg font-semibold text-slate-50">
                          Choose a focus area to begin optimizing your deck
                        </p>
                      </div>
                    </div>
                    {memoizedAnalysisModes}
                  </div>
                  {/* Modern scrollable area */}
                  {selectedAnalysisMode ? (
                    <div className="h-full flex-1 min-h-0 flex flex-col">
                      <div className="px-6 pt-3 pb-2 flex items-center justify-between">
                        <div className="text-sm text-slate-200">Chat about your deck</div>
                        {memoizedCompactModes}
                      </div>
                      <ScrollArea className="flex-1 h-full min-h-0 overflow-y-auto overflow-x-hidden px-4 pr-2">
                        <div className="flex flex-col space-y-3 py-4 min-w-0">
                          {memoizedMessages}
                          {isLoading && (
                            <div className="flex justify-start">
                              <div className="flex gap-2 max-w-[80%]">
                                <Avatar className="bg-transparent shadow-none">
                                  <AvatarFallback>
                                    <Bot className="h-6 w-6 text-cyan-400/70" />
                                  </AvatarFallback>
                                </Avatar>
                                <div>
                                  <div className="px-5 py-3 rounded-2xl bg-gradient-to-br from-slate-900/80 via-slate-900/60 to-slate-900/35 text-slate-50 backdrop-blur-sm flex items-center">
                                    <Loader2 className="h-4 w-4 animate-spin mr-2 text-white/80" />
                                    <span className="text-xs">AI thinking…</span>
                                  </div>
                                </div>
                              </div>
                            </div>
                          )}
                          <div ref={messagesEndRef} />
                        </div>
                      </ScrollArea>
                    </div>
                  ) : (
                    <div className="flex-1 flex items-center justify-center px-6 py-8 text-slate-300">
                      Select a focus area above to start chatting about your deck.
                    </div>
                  )}
                </CardContent>

                {/* Recent History Section */}
                {messages.length > 1 && (
                  <div className="px-6 py-3 bg-gradient-to-r from-slate-900/40 via-slate-900/20 to-slate-900/40">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
                        Recent History
                      </span>
                      <button
                        type="button"
                        onClick={() => setMessages([messages[0]])}
                        className="text-xs text-white/80 hover:text-white transition-colors"
                      >
                        Clear
                      </button>
                    </div>
                    <div className="space-y-1 max-h-24 overflow-y-auto">
                      {messages.slice(1, 4).map((msg) => (
                        <div
                          key={msg.id}
                          className="flex items-center gap-2 px-3 py-2 rounded-lg bg-gradient-to-r from-slate-900/60 via-slate-900/45 to-slate-900/30 transition-colors cursor-pointer"
                          onClick={() => {
                            setInput(msg.content);
                          }}
                        >
                          <div className="h-4 w-4 rounded-full bg-white/10 border border-white/20 flex items-center justify-center flex-shrink-0">
                            {msg.role === "user" ? (
                              <User className="h-2.5 w-2.5 text-white/80" />
                            ) : (
                              <Bot className="h-2.5 w-2.5 text-white/80" />
                            )}
                          </div>
                          <span className="text-xs text-slate-300 truncate flex-1">
                            {msg.content.slice(0, 50)}
                            {msg.content.length > 50 ? "..." : ""}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Clean Input Bar - Memoized to prevent re-renders */}
                {selectedAnalysisMode && (
                  <CardFooter className="pt-4 pb-6 px-6 bg-gradient-to-r from-slate-950/70 via-slate-900/60 to-slate-900/50">
                    {refinementQuestions.length > 0 ? (
                      <SuggestedQuestions
                        questions={refinementQuestions}
                        onSelect={(question) => {
                          void sendUserMessage(question);
                        }}
                      />
                    ) : null}
                    {memoizedInputForm}
                  </CardFooter>
                )}
              </CardUI>
            </div>
          </div>
        )
      )}

      <AIPreferencesDialog
        open={isPreferencesDialogOpen}
        onOpenChange={(open) => {
          setIsPreferencesDialogOpen(open);
          if (!open && !playstyle) {
            dismissOnboarding();
          }
        }}
        playstyle={playstyle}
        explainTo={explainTo}
        onChangePlaystyle={(p) => setPlaystyle(p)}
        onChangeExplainTo={(lvl) => setExplainTo(lvl)}
        onSkip={() => dismissOnboarding()}
        onDone={() => dismissOnboarding()}
        mode={playstyle ? "edit" : "onboarding"}
      />

      {/* Information Dialog */}
      <Dialog open={isInfoDialogOpen} onOpenChange={setIsInfoDialogOpen}>
        <DialogContent className="max-w-2xl bg-white/10 border border-white/20 backdrop-blur-xl">
          <DialogHeader>
            <DialogTitle className="text-xl font-bold text-white flex items-center gap-2">
              <Info className="h-5 w-5 text-white/80" />
              How to Use the AI Assistant
            </DialogTitle>
            <DialogDescription className="text-white/80 pt-2">
              Learn how to get the most out of your AI-powered deck building
              assistant.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 text-sm text-white/90">
            <section className="space-y-2">
              <h3 className="font-semibold text-white/90 text-base">
                Getting Started
              </h3>
              <p className="leading-relaxed text-white/80">
                Pick an analysis focus above (Consistency, Power, Interaction, or Meta).
                The chat unlocks after you pick one, so you can ask follow-up questions with that focus in mind.
              </p>
            </section>

            <section className="space-y-2">
              <h3 className="font-semibold text-white/90 text-base">
                Asking Good Questions
              </h3>
              <ul className="list-disc pl-5 space-y-1 text-white/80">
                <li>Be specific: "How can I stop bricking on starters?"</li>
                <li>Call out matchups: "Side options vs Kashtira going second?"</li>
                <li>Ask for swaps: "What should I cut for 2 copies of Ash Blossom?"</li>
                <li>Formats matter: the assistant respects Master Duel vs TCG banlists.</li>
              </ul>
            </section>

            <section className="space-y-2">
              <h3 className="font-semibold text-white/90 text-base">
                Feedback
              </h3>
              <p className="leading-relaxed text-white/80">
                Use 👍 or 👎 on AI replies that include recommendations. It helps surface better picks next time.
              </p>
            </section>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
