"use client";

import { useState, useRef, useEffect, useCallback, useMemo } from "react";
import { X, Send, Bot, User, Loader2, Sparkles, Info, ThumbsUp, ThumbsDown, Plus, Check } from "lucide-react";
import { Avatar, AvatarFallback } from "@radix-ui/react-avatar";
import { useDeck } from "../context/deck-context";
import { Card } from "../types/card";
import { ScrollArea } from "@radix-ui/react-scroll-area";
import { Button } from "./ui/button";
import Image from "next/image";
import {
  Card as CardUI,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
  CardFooter,
} from "./ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "./ui/dialog";
import { Input } from "./ui/input";
import { supabase } from "../lib/supabaseClient";
import { useCardStore } from "../store/cardStore";
import { BanStatus, DeckSection } from "../types/types";
import { AIResponseCard } from "./ui/ai-response-card";
import CutCornerWrapper from "./cut-corner-wrapper";
import { CardPreview } from "./ui/card-preview";
import { FormattedRecommendationResponse } from "./ui/formatted-recommendation-response";
import { getRecommendations } from "../lib/api/recommendationAgent";
import { submitFeedback } from "../lib/api/recommendationFeedback";

type DeckAnalysisStructured = {
  overview: string;
  strategic_identity: {
    playstyle: string;
    description: string;
  };
  power_level: {
    score: number;
    explanation: string;
    suggestions: string[];
  };
  consistency: {
    score: number;
    explanation: string;
    suggestions: string[];
  };
  resilience_and_grind: {
    score: number;
    explanation: string;
    suggestions: string[];
  };
  matchup_profile: {
    score: number;
    explanation: string;
    suggestions: string[];
  };
  complexity_and_skill: {
    score: number;
    explanation: string;
    skill_floor: string;
    skill_ceiling: string;
  };
  illegal_cards: {
    forbidden: string[];
    notes: string;
  };
};

type DeckStats = {
  mainCount: number;
  extraCount: number;
  sideCount: number;
  monsterCount: number;
  spellCount: number;
  trapCount: number;
  averageLevel?: number | null;
  archetypeCounts: Record<string, number>;
  typeCounts: Record<string, number>;
  attributeCounts: Record<string, number>;
};

interface CandidateCard {
  candidateId: number;
  name: string;
  type: string;
  race?: string;
  desc: string;
  archetype?: string | null;
}

interface CardSuggestionMeta {
  candidateId: number;
  reason: string;
  synergy_with_candidateIds?: number[];
}

interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
  timestamp: Date;
  suggestedCards?: Card[];
  cardSuggestionsMeta?: CardSuggestionMeta[]; // For card_suggestions analysis type
  candidateCards?: CandidateCard[]; // For card_suggestions analysis type
  recommendation_id?: string; // NEW: For feedback tracking
  response_version?: string; // NEW: Schema version
  recommendedCards?: Array<{
    id?: number;
    name: string;
    reason?: string;
    synergy_score?: number;
    risk_assessment?: "low" | "medium" | "high";
  }>; // NEW: Structured recommended cards from JSON response
  alternativeConsiderations?: Array<{
    name: string;
    why_not?: string;
  }>; // NEW: Alternative considerations from JSON response
  recommendationMeta?: {
    intent_classified?: string;
    confidence?: number;
    format_specific_notes?: string;
  }; // NEW: Meta information from JSON response
  type?: "quick-prompt" | "deck-analysis" | "error";
  meta?: {
    deckId?: string | number;
    banlistFormat?: string;
    analysisType?: AnalysisType;
    structuredAnalysis?: DeckAnalysisStructured | Record<string, unknown> | {
      suggested_cards?: {
        card_name: string;
        section: "main" | "side" | "extra";
        reason: string;
      }[];
      notes?: string;
    }; // mode-specific shape
    deckStats?: DeckStats | null;
  };
}

type AnalysisType =
  | "summary"
  | "power_level"
  | "consistency"
  | "resilience"
  | "matchup"
  | "complexity"
  | "card_suggestions"
  | "custom";

type QuickPrompt = {
  id: string;
  label: string;
  question: string;
  analysisType: AnalysisType;
  description?: string;
};

// Recommendation quick prompts
const RECOMMENDATION_PROMPTS: QuickPrompt[] = [
  {
    id: "recommend_archetype",
    label: "Archetype Cards",
    question: "Recommend essential cards for my deck's archetype.",
    analysisType: "custom",
    description: "Get archetype-specific card recommendations.",
  },
  {
    id: "recommend_engines",
    label: "Engine Suggestions",
    question: "What engines work well with my deck?",
    analysisType: "custom",
    description: "Find compatible engines for your deck.",
  },
  {
    id: "recommend_techs",
    label: "Tech Cards",
    question: "Recommend tech cards for my deck.",
    analysisType: "custom",
    description: "Get matchup-specific tech recommendations.",
  },
  {
    id: "recommend_personalized",
    label: "Personalized",
    question: "Give me personalized card recommendations based on my playstyle.",
    analysisType: "custom",
    description: "Get recommendations tailored to your preferences.",
  },
];

interface Quota {
  requests_left: number;
  max_requests: number;
}

interface AIChatbotProps {
  isOpen: boolean;
  onClose: () => void;
}

// Function to extract card names from AI response text and match to actual cards
const extractCardsFromText = (text: string, allCards: Card[]): Card[] => {
  const foundCards: Card[] = [];
  const cardNameSet = new Set<string>();

  // Create a map for faster card lookup
  const cardMap = new Map<string, Card>();
  allCards.forEach((card) => {
    cardMap.set(card.name.toLowerCase(), card);
  });

  // Look for card names in various patterns
  const patterns = [
    // **Card Name** pattern
    /\*\*([^*]+)\*\*/g,
    // "Card Name" pattern (quoted)
    /"([^"]+)"/g,
    // Card names that are likely Yu-Gi-Oh cards (contain common keywords)
    /\b([A-Z][a-zA-Z\s\-']+(?:Dragon|Monster|Spell|Trap|Blue-Eyes|Dark|Light|Magician|Warrior|Beast|Machine|Fiend|Spellcaster|Zombie|Plant|Insect|Rock|Pyro|Thunder|Aqua|Psychic|Divine|Winged|Elemental|Creator|HERO|Cyber|Blackwing|Gladiator|Six|Samurai|Archfiend|Ojama|Harpie|Amazoness|Toon|Spirit|Union|Gemini|Tuner|Synchro|Xyz|Pendulum|Link|Fusion|Ritual|Ruler|Cardcar))\b/g,
    // Common Yu-Gi-Oh card patterns
    /\b([A-Z][a-zA-Z\s\-']*(?:of|the|in|from|to|with|and|or)\s+[A-Z][a-zA-Z\s\-']*)\b/g,
    // Specific patterns for cards like "Cardcar D" or "Dragon Ruler of Tempests"
    /\b([A-Z][a-zA-Z]*(?:\s+[A-Z])?(?:\s+(?:of|the|in|from|to|with|and|or)\s+[A-Z][a-zA-Z\s]*)?)\b/g,
  ];

  patterns.forEach((pattern) => {
    let match;
    while ((match = pattern.exec(text)) !== null) {
      const cardName = match[1].trim();
      const lowerCardName = cardName.toLowerCase();

      // Skip if already found, too short/generic, or common words
      if (cardNameSet.has(lowerCardName) || cardName.length < 3) continue;

      // Skip common words that aren't card names
      const commonWords = [
        "card",
        "deck",
        "effect",
        "monster",
        "spell",
        "trap",
        "summon",
        "attack",
        "defense",
        "level",
        "rank",
        "link",
        "fusion",
        "synchro",
        "xyz",
        "pendulum",
      ];
      if (commonWords.includes(lowerCardName)) continue;

      // Direct match
      if (cardMap.has(lowerCardName)) {
        foundCards.push(cardMap.get(lowerCardName)!);
        cardNameSet.add(lowerCardName);
        continue;
      }

      // Fuzzy matching for slight variations
      for (const [mapCardName, card] of cardMap.entries()) {
        // More precise fuzzy matching
        const similarity = calculateSimilarity(lowerCardName, mapCardName);
        if (similarity > 0.8 && !cardNameSet.has(mapCardName)) {
          foundCards.push(card);
          cardNameSet.add(mapCardName);
          break;
        }
      }
    }
  });

  // Additional pass: look for exact card names that might be mentioned
  allCards.forEach((card) => {
    const cardName = card.name.toLowerCase();
    if (text.toLowerCase().includes(cardName) && !cardNameSet.has(cardName)) {
      foundCards.push(card);
      cardNameSet.add(cardName);
    }
  });

  // Limit to reasonable number of cards
  return foundCards.slice(0, 8);
};

// Helper function to calculate string similarity
const calculateSimilarity = (str1: string, str2: string): number => {
  const longer = str1.length > str2.length ? str1 : str2;
  const shorter = str1.length > str2.length ? str2 : str1;

  if (longer.length === 0) return 1.0;

  const editDistance = levenshteinDistance(longer, shorter);
  return (longer.length - editDistance) / longer.length;
};

// Helper function to calculate Levenshtein distance
const levenshteinDistance = (str1: string, str2: string): number => {
  const matrix: number[][] = [];

  for (let i = 0; i <= str2.length; i++) {
    matrix[i] = [i];
  }

  for (let j = 0; j <= str1.length; j++) {
    matrix[0][j] = j;
  }

  for (let i = 1; i <= str2.length; i++) {
    for (let j = 1; j <= str1.length; j++) {
      if (str2.charAt(i - 1) === str1.charAt(j - 1)) {
        matrix[i][j] = matrix[i - 1][j - 1];
      } else {
        matrix[i][j] = Math.min(
          matrix[i - 1][j - 1] + 1,
          matrix[i][j - 1] + 1,
          matrix[i - 1][j] + 1
        );
      }
    }
  }

  return matrix[str2.length][str1.length];
};

// Detect if a question is a recommendation request
// Now treats ALL user prompts as recommendation requests to use the hybrid search card pool
const isRecommendationRequest = (): boolean => {
  // Always use recommendation agent for all prompts - it has better card search capabilities
  // The recommendation agent can handle both recommendation and analysis questions
  return true;
};

const generateAIResponse = async (
  userMessage: string,
  currentDeck,
  allCards: Card[]
): Promise<{ message: Message; quota?: Quota }> => {
  const message: Message = {
    id: crypto.randomUUID(),
    role: "assistant",
    content: "",
    timestamp: new Date(),
  };

  const deckId = currentDeck?.id;
  if (!deckId) {
    message.content = "No deck selected. Please select a deck first.";
    return { message };
  }

  try {
    const { data } = await supabase.auth.getSession();
    const accessToken = data.session?.access_token;

    // Map deck mode to banlist_format for edge function
    const banlistFormat = currentDeck.mode === "Master Duel" ? "MASTER_DUEL" : "TCG";

    // Check if this is a recommendation request
    const isRecommendation = isRecommendationRequest();
    
    if (isRecommendation) {
      // Use recommendation agent
      try {
        const recommendationResult = await getRecommendations({
          question: userMessage,
          current_deck: currentDeck,
          format: banlistFormat,
          recommendation_type: "personalized",
        });

        message.content = recommendationResult.answer || "No recommendations available.";
        
        // Store recommendation_id and response_version for feedback tracking
        if (recommendationResult.recommendation_id) {
          message.recommendation_id = recommendationResult.recommendation_id;
        }
        message.response_version = recommendationResult.response_version || "1.0";
        
        // Store structured JSON response data if available
        if (recommendationResult.recommended_cards) {
          message.recommendedCards = recommendationResult.recommended_cards;
        }
        if (recommendationResult.alternative_considerations) {
          message.alternativeConsiderations = recommendationResult.alternative_considerations;
        }
        if (recommendationResult.meta) {
          message.recommendationMeta = recommendationResult.meta;
        }
        
        // Use validated cards from recommendation response
        if (recommendationResult.validated_cards && Array.isArray(recommendationResult.validated_cards)) {
          message.suggestedCards = recommendationResult.validated_cards.map((card: Card) => {
            const fullCard = allCards.find((c) => c.id === card.id);
            if (fullCard) {
              return fullCard;
            }
            return {
              ...card,
              deckInstanceId: `temp-${card.id}`,
              race: card.race || "",
              misc_info: card.misc_info || [],
              card_sets: card.card_sets || [],
              card_prices: card.card_prices || [],
            } as Card;
          }).filter((card: Card) => card != null);
        }

        return { message };
      } catch (recError: unknown) {
        // Fall back to deck-analysis if recommendation fails
        console.warn("Recommendation agent failed, falling back to deck-analysis:", recError);
      }
    }

    // Use deck-analysis for non-recommendation requests
    const response = await fetch(
      `https://izshwywgfaozmisedwxm.supabase.co/functions/v1/deck-analysis`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(accessToken && { Authorization: `Bearer ${accessToken}` }),
        },
        body: JSON.stringify({
          deck_id: deckId,
          banlist_format: banlistFormat,
          question: userMessage,
          analysis_type: "custom", // Custom user prompts use "custom" analysis type
        }),
      }
    );

    const result = await response.json();

    if (!response.ok) {
      message.content = result.error
        ? `AI error: ${result.error}`
        : "AI error: Unknown error.";
      return { message };
    }

    // Extract structured analysis and deck stats
    const structuredAnalysis = result.structured_analysis ?? null;
    const deckStats = result.deck_stats ?? null;
    const analysisType = (result.analysis_type ?? "custom") as AnalysisType;

    // For custom prompts, use raw_answer (plain text response)
    // For card_suggestions, use a summary or empty text (cards are rendered separately)
    // For other types, use overview
    let answerText: string;
    if (analysisType === "custom") {
      // Custom prompts: use raw_answer (plain text, not JSON)
      answerText = result.raw_answer ?? result.answer ?? "AI did not return an answer.";
    } else if (analysisType === "card_suggestions") {
      // Card suggestions: use empty or summary text since cards are rendered separately
      answerText = result.raw_answer ?? "";
    } else if (structuredAnalysis?.overview) {
      answerText = structuredAnalysis.overview;
    } else {
      answerText = result.raw_answer ?? result.answer ?? "AI did not return an answer.";
    }
    
    message.content = answerText;

    // Handle card suggestions: use recommendedCards from backend
    if (analysisType === "card_suggestions" && result.recommendedCards && Array.isArray(result.recommendedCards)) {
      // Use recommendedCards from backend - these are the primary_card recommendations
      message.suggestedCards = result.recommendedCards.map((card: Card) => {
        // Find the full card data from allCards to ensure we have all fields (like card_images, deckInstanceId)
        const fullCard = allCards.find((c) => c.id === card.id);
        if (fullCard) {
          return fullCard; // Use full card from store which has all required fields
        }
        // If not found in store, create a card object with required fields
        return {
          ...card,
          deckInstanceId: `temp-${card.id}`, // Generate a temporary instance ID
          race: card.race || "", // Ensure race is not undefined
          misc_info: card.misc_info || [],
          card_sets: card.card_sets || [],
          card_prices: card.card_prices || [],
        } as Card;
      }).filter((card: Card) => card != null);

      // Store card suggestions metadata (with candidateId)
      if (result.suggestions && Array.isArray(result.suggestions)) {
        message.cardSuggestionsMeta = result.suggestions;
      }

      // Store candidate cards for UI
      if (result.candidateCards && Array.isArray(result.candidateCards)) {
        message.candidateCards = result.candidateCards;
      }
    } else if (analysisType === "custom" && result.validated_cards && Array.isArray(result.validated_cards)) {
      // For custom responses, use validated cards from backend (more reliable)
      message.suggestedCards = result.validated_cards.map((card: Card) => {
        // Find the full card data from allCards to ensure we have all fields (like card_images, deckInstanceId)
        const fullCard = allCards.find((c) => c.id === card.id);
        if (fullCard) {
          return fullCard; // Use full card from store which has all required fields
        }
        // If not found in store, create a card object with required fields
        return {
          ...card,
          deckInstanceId: `temp-${card.id}`, // Generate a temporary instance ID
          race: card.race || "", // Ensure race is not undefined
          misc_info: card.misc_info || [],
          card_sets: card.card_sets || [],
          card_prices: card.card_prices || [],
        } as Card;
      }).filter((card: Card) => card != null);
    } else if (analysisType !== "card_suggestions") {
      // Fallback: parse suggested cards from the response text and match to actual cards
      // Skip this for card_suggestions mode
      const extractedCards = extractCardsFromText(answerText, allCards);
      if (extractedCards.length > 0) {
        message.suggestedCards = extractedCards;
      }
    }

    // Store structured analysis and deck stats in message metadata
    // Only store metadata for analysis types that have structured data (not "custom")
    if (structuredAnalysis && analysisType !== "custom") {
      message.type = "deck-analysis";
      message.meta = {
        deckId,
        banlistFormat,
        analysisType,
        structuredAnalysis,
        deckStats,
      };
    }

    const quota: Quota | undefined =
      result.requests_left != null && result.max_requests != null
        ? {
            requests_left: result.requests_left,
            max_requests: result.max_requests,
          }
        : undefined;

    return { message, quota };
  } catch (error: unknown) {
    message.content = `Error contacting AI: ${error instanceof Error ? error.message : "Unknown error"}`;
    return { message };
  }
};

// Helper to render a dimension block (used in deck analysis card)
function renderDimensionBlock(
  title: string,
  explanation: string,
  suggestions: string[]
) {
  return (
    <section className="space-y-1">
      <h4 className="text-sm font-semibold text-slate-50">{title}</h4>
      <p className="text-sm text-slate-300">{explanation}</p>
      {suggestions && suggestions.length > 0 && (
        <ul className="mt-1 list-disc pl-5 text-xs text-slate-400">
          {suggestions.map((s, i) => (
            <li key={i}>{s}</li>
          ))}
        </ul>
      )}
    </section>
  );
}

// Helper to render a compact power level card
function renderPowerLevelCard(
  analysis: { power_level?: { score: number; explanation: string; suggestions: string[] } }
): JSX.Element | null {
  const power = analysis?.power_level;
  if (!power) return null;

  return (
    <div className="w-full max-w-xl rounded-2xl border border-cyan-500/30 bg-slate-900/70 backdrop-blur-sm p-4 shadow-[0_2px_12px_rgba(0,0,0,0.2)] space-y-3">
      <h3 className="text-sm font-semibold tracking-wide uppercase text-cyan-400/80">
        Power Level Analysis
      </h3>
      <div className="inline-flex items-center gap-2 rounded-full border border-cyan-500/30 bg-cyan-500/10 px-3 py-1 text-xs">
        <span className="font-medium text-slate-300">Power Level</span>
        <span className="rounded-full bg-cyan-400/20 px-2 py-0.5 text-[11px] font-semibold text-cyan-300">
          {power.score}/10
        </span>
      </div>
      <p className="text-sm text-slate-300">{power.explanation}</p>
      {power.suggestions && power.suggestions.length > 0 && (
        <div className="space-y-1">
          <h4 className="text-xs font-semibold uppercase text-slate-400">
            Suggestions
          </h4>
          <ul className="list-disc pl-5 text-xs text-slate-400">
            {power.suggestions.map((s, i) => (
              <li key={i}>{s}</li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

// Helper to render card suggestions with "Add to Deck" actions
function renderCardSuggestionsCard(
  analysis: {
    suggested_cards?: {
      card_name: string;
      section: "main" | "side" | "extra";
      reason: string;
    }[];
    notes?: string;
  },
  allCards: Card[],
  addCardToDeck: (card: Card, deckType: DeckSection) => void,
  getOptimalDeckType: (card: Card) => DeckSection,
  getDeckStats: () => {
    mainCount: number;
    extraCount: number;
    sideCount: number;
  },
  banlist: Record<string, BanStatus>,
  deckId?: string | number
): JSX.Element | null {
  const suggestions = analysis?.suggested_cards ?? [];
  const deckStats = getDeckStats();

  const handleAddCard = (cardName: string, section: "main" | "side" | "extra") => {
    if (!deckId) return;

    // Find the card by name
    const card = allCards.find(
      (c) => c.name.toLowerCase() === cardName.toLowerCase()
    );

    if (!card) {
      console.warn(`Card not found: ${cardName}`);
      return;
    }

    // Map section to DeckSection
    const deckTypeMap: Record<"main" | "side" | "extra", DeckSection> = {
      main: "mainDeck",
      side: "sideDeck",
      extra: "extraDeck",
    };

    const deckType = deckTypeMap[section] || getOptimalDeckType(card);
    addCardToDeck(card, deckType);
  };

  const isDeckSectionFull = (section: "main" | "side" | "extra"): boolean => {
    switch (section) {
      case "main":
        return deckStats.mainCount >= 60;
      case "extra":
        return deckStats.extraCount >= 15;
      case "side":
        return deckStats.sideCount >= 15;
      default:
        return false;
    }
  };

  return (
    <div className="w-full max-w-xl rounded-2xl border border-cyan-500/30 bg-slate-900/70 backdrop-blur-sm p-4 shadow-[0_2px_12px_rgba(0,0,0,0.2)] space-y-3">
      <h3 className="text-sm font-semibold tracking-wide uppercase text-cyan-400/80">
        Card Suggestions
      </h3>
      {analysis?.notes && (
        <p className="text-xs text-slate-300">{analysis.notes}</p>
      )}
      <div className="space-y-2">
        {suggestions.length === 0 && (
          <p className="text-xs text-slate-400">
            No specific card suggestions were generated.
          </p>
        )}
        {suggestions.map((s, i) => {
          // Find the card to get its image
          const card = allCards.find(
            (c) => c.name.toLowerCase() === s.card_name.toLowerCase()
          );
          const cardImage = card?.card_images?.[0]?.image_url_small;
          const isFull = isDeckSectionFull(s.section);
          const banStatus = card ? banlist[card.name] || "Unlimited" : "Unlimited";

          return (
            <div
              key={`${s.card_name}-${i}`}
              className="flex gap-3 rounded-lg border border-cyan-500/20 bg-slate-900/40 p-3 text-xs"
            >
              {/* Card Image with Preview */}
              {card && cardImage ? (
                <CardPreview card={card} banStatus={banStatus}>
                  <div className="flex-shrink-0 cursor-pointer">
                    <Image
                      width={60}
                      height={88}
                      src={cardImage}
                      alt={s.card_name}
                      className="w-12 h-auto object-contain rounded-md shadow-sm"
                    />
                  </div>
                </CardPreview>
              ) : cardImage ? (
                <div className="flex-shrink-0">
                  <Image
                    width={60}
                    height={88}
                    src={cardImage}
                    alt={s.card_name}
                    className="w-12 h-auto object-contain rounded-md shadow-sm"
                  />
                </div>
              ) : null}
              {/* Card Info */}
              <div className="flex-1 flex flex-col gap-1 min-w-0">
                <div className="flex items-center justify-between gap-2">
                  <span className="font-semibold text-slate-50 truncate">{s.card_name}</span>
                  <span className="rounded-full border border-cyan-500/30 bg-cyan-500/10 px-2 py-0.5 text-[10px] uppercase text-cyan-300 flex-shrink-0">
                    {s.section} deck
                  </span>
                </div>
                <p className="text-slate-400 text-xs leading-relaxed">{s.reason}</p>
                {deckId && (
                  <div className="mt-2 flex justify-end">
                    <button
                      type="button"
                      disabled={isFull}
                      className={`text-[11px] rounded-full border px-2 py-0.5 transition-colors ${
                        isFull
                          ? "border-slate-600 bg-slate-800/50 text-slate-500 cursor-not-allowed"
                          : "border-cyan-500/30 bg-cyan-500/10 hover:bg-cyan-500/20 hover:text-cyan-300 text-slate-300"
                      }`}
                      onClick={() => handleAddCard(s.card_name, s.section)}
                      title={isFull ? `${s.section} deck is full` : `Add to ${s.section} deck`}
                    >
                      {isFull ? "Deck full" : "Add to deck"}
                    </button>
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// Helper to render a rich deck analysis card
function renderDeckAnalysisCard(
  analysis: DeckAnalysisStructured,
  deckStats?: DeckStats | null
): JSX.Element {
  const dims = analysis;

  return (
    <div className="w-full max-w-2xl rounded-2xl border border-cyan-500/30 bg-slate-900/70 backdrop-blur-sm p-4 shadow-[0_2px_12px_rgba(0,0,0,0.2)] space-y-4">
      {/* Header */}
      <div className="space-y-1">
        <h3 className="text-sm font-semibold tracking-wide uppercase text-cyan-400/80">
          Deck Analysis Summary
        </h3>
        <p className="text-sm leading-relaxed text-slate-50">{dims.overview}</p>
      </div>

      {/* Basic deck stats, if available */}
      {deckStats && (
        <div className="grid grid-cols-2 gap-3 text-xs sm:grid-cols-3">
          <div className="rounded-lg border border-cyan-500/20 bg-slate-900/40 px-3 py-2">
            <div className="font-medium text-slate-300">Main Deck</div>
            <div className="text-cyan-400 font-semibold">
              {deckStats.mainCount} cards
            </div>
          </div>
          <div className="rounded-lg border border-cyan-500/20 bg-slate-900/40 px-3 py-2">
            <div className="font-medium text-slate-300">Extra Deck</div>
            <div className="text-cyan-400 font-semibold">
              {deckStats.extraCount} cards
            </div>
          </div>
          <div className="rounded-lg border border-cyan-500/20 bg-slate-900/40 px-3 py-2">
            <div className="font-medium text-slate-300">Side Deck</div>
            <div className="text-cyan-400 font-semibold">
              {deckStats.sideCount} cards
            </div>
          </div>
          <div className="rounded-lg border border-cyan-500/20 bg-slate-900/40 px-3 py-2">
            <div className="font-medium text-slate-300">Monsters</div>
            <div className="text-cyan-400 font-semibold">
              {deckStats.monsterCount}
            </div>
          </div>
          <div className="rounded-lg border border-cyan-500/20 bg-slate-900/40 px-3 py-2">
            <div className="font-medium text-slate-300">Spells</div>
            <div className="text-cyan-400 font-semibold">
              {deckStats.spellCount}
            </div>
          </div>
          <div className="rounded-lg border border-cyan-500/20 bg-slate-900/40 px-3 py-2">
            <div className="font-medium text-slate-300">Traps</div>
            <div className="text-cyan-400 font-semibold">
              {deckStats.trapCount}
            </div>
          </div>
        </div>
      )}

      {/* Score chips row */}
      <div className="flex flex-wrap gap-2 text-xs">
        {[
          ["Power", dims.power_level.score],
          ["Consistency", dims.consistency.score],
          ["Resilience", dims.resilience_and_grind.score],
          ["Matchups", dims.matchup_profile.score],
          ["Complexity", dims.complexity_and_skill.score],
        ].map(([label, score]) => (
          <div
            key={label as string}
            className="inline-flex items-center gap-1 rounded-full border border-cyan-500/30 bg-cyan-500/10 px-3 py-1"
          >
            <span className="font-medium text-slate-300">{label}</span>
            <span className="rounded-full bg-cyan-400/20 px-2 py-0.5 text-[11px] font-semibold text-cyan-300">
              {score}/10
            </span>
          </div>
        ))}
      </div>

      {/* Strategic identity */}
      <section className="space-y-1">
        <h4 className="text-sm font-semibold text-slate-50">
          Strategic Identity: <span className="text-cyan-400">{dims.strategic_identity.playstyle}</span>
        </h4>
        <p className="text-sm text-slate-300">
          {dims.strategic_identity.description}
        </p>
      </section>

      {/* Detailed sections in a vertical stack */}
      <div className="space-y-3 text-sm">
        {renderDimensionBlock(
          "Power Level",
          dims.power_level.explanation,
          dims.power_level.suggestions
        )}
        {renderDimensionBlock(
          "Consistency",
          dims.consistency.explanation,
          dims.consistency.suggestions
        )}
        {renderDimensionBlock(
          "Resilience & Grind",
          dims.resilience_and_grind.explanation,
          dims.resilience_and_grind.suggestions
        )}
        {renderDimensionBlock(
          "Matchup Profile",
          dims.matchup_profile.explanation,
          dims.matchup_profile.suggestions
        )}
        <section className="space-y-1">
          <h4 className="text-sm font-semibold text-slate-50">Complexity & Skill</h4>
          <p className="text-sm text-slate-300">
            {dims.complexity_and_skill.explanation}
          </p>
          <div className="flex flex-wrap gap-2 text-xs text-slate-400">
            <span className="rounded-full border border-cyan-500/30 bg-slate-900/40 px-2 py-0.5">
              Skill floor: {dims.complexity_and_skill.skill_floor}
            </span>
            <span className="rounded-full border border-cyan-500/30 bg-slate-900/40 px-2 py-0.5">
              Skill ceiling: {dims.complexity_and_skill.skill_ceiling}
            </span>
          </div>
        </section>
      </div>

      {/* Banlist notes */}
      {dims.illegal_cards && (
        <section className="space-y-1 border-t border-cyan-500/20 pt-3">
          <h4 className="text-sm font-semibold text-slate-50">Banlist Notes</h4>
          <p className="text-xs text-slate-300">
            {dims.illegal_cards.forbidden.length === 0 
              ? "No banned cards were found in the deck."
              : dims.illegal_cards.notes}
          </p>
          {dims.illegal_cards.forbidden.length > 0 && (
            <ul className="mt-1 list-disc pl-5 text-xs text-red-400">
              {dims.illegal_cards.forbidden.map((name) => (
                <li key={name}>{name}</li>
              ))}
            </ul>
          )}
        </section>
      )}
    </div>
  );
}

export default function AIChatbot({ isOpen, onClose }: AIChatbotProps) {
  const { currentDeck, addCardToDeck, getDeckStats, saveDeck } = useDeck();
  const [messages, setMessages] = useState<Message[]>([
    {
      id: "welcome",
      role: "assistant",
      content:
        "👋 Welcome! I'm your Master Deck Alchemist AI Assistant. Ask me about synergies, upgrades, side options, or meta matchups.",
      timestamp: new Date(),
    },
  ]);
  const [input, setInput] = useState("");
  
  // Optimized input handler - useCallback to prevent unnecessary re-renders
  const handleInputChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    setInput(e.target.value);
  }, []);
  const [isLoading, setIsLoading] = useState(false);
  const [isQuickPromptLoading, setIsQuickPromptLoading] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const [banlist, setBanlist] = useState<Record<string, BanStatus>>({});
  const [addingCardId, setAddingCardId] = useState<string | null>(null);
  const [addedCards, setAddedCards] = useState<Set<string>>(new Set());
  const [isInfoDialogOpen, setIsInfoDialogOpen] = useState(false);
  const [feedbackStates, setFeedbackStates] = useState<Map<string, "approved" | "disapproved" | null>>(new Map());

  const allCards = useCardStore((state) => state.cardList);

  // Load banlist on mount from Supabase
  useEffect(() => {
    const loadBanlist = async () => {
      try {
        const { getMasterDuelBanlist } = await import("../lib/api");
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

  // Handler for quick prompt clicks (recommendations only) - Memoized
  const handleQuickPromptClick = useCallback(async (prompt: QuickPrompt) => {
    const deckId = currentDeck?.id;
    if (!deckId) return;

    try {
      setIsQuickPromptLoading(prompt.id);

      // Ensure deck is saved to Supabase before analysis
      try {
        await saveDeck(currentDeck);
      } catch (saveError) {
        console.warn("Failed to save deck before analysis:", saveError);
      }

      // Add user message representing the quick action
      const userMessage: Message = {
        id: crypto.randomUUID(),
        role: "user",
        content: prompt.question,
        timestamp: new Date(),
        type: "quick-prompt",
      };
      setMessages((prev) => [...prev, userMessage]);

      // Use recommendation agent for recommendation prompts
      const { message } = await generateAIResponse(
        prompt.question,
        currentDeck,
        allCards
      );
      setMessages((prev) => [...prev, message]);
    } catch (error: unknown) {
      console.error("Error in quick prompt:", error);
      const errorMessage: Message = {
        id: crypto.randomUUID(),
        role: "assistant",
        content: `Error: ${error instanceof Error ? error.message : "Failed to get recommendations."}`,
        timestamp: new Date(),
        type: "error",
      };
      setMessages((prev) => [...prev, errorMessage]);
    } finally {
      setIsQuickPromptLoading(null);
    }
  }, [currentDeck, allCards, saveDeck]);

  const handleSendMessage = useCallback(async () => {
    if (input.trim() === "") return;

    // Capture input content and clear immediately for better UX (non-blocking)
    const messageContent = input.trim();
    setInput(""); // Clear input immediately

    const userMessage: Message = {
      id: crypto.randomUUID(),
      role: "user",
      content: messageContent,
      timestamp: new Date(),
    };

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
        messageContent, // Use captured content
        currentDeck,
        allCards
      );
      setMessages((prev) => [...prev, message]);
    } catch (error) {
      console.error("Error in handleSendMessage:", error);
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
  }, [input, currentDeck, allCards, saveDeck]);

  // Enhanced card handling functions - memoized to prevent re-renders
  const canAddCardToDeck = useCallback((card: Card, deckType: DeckSection): boolean => {
    const banStatus = banlist[card.name] || "Unlimited";
    if (banStatus === "Forbidden") return false;

    let maxCopies = 3;
    if (banStatus === "Limited") maxCopies = 1;
    if (banStatus === "Semi-Limited") maxCopies = 2;

    const currentSection = currentDeck[deckType] || [];
    const currentCount = currentSection.filter((c) => c.id === card.id).length;

    if (currentCount >= maxCopies) return false;

    // Check deck limits
    const deckStats = getDeckStats();
    if (deckType === "mainDeck" && deckStats.mainCount >= 60) return false;
    if (deckType === "extraDeck" && deckStats.extraCount >= 15) return false;
    if (deckType === "sideDeck" && deckStats.sideCount >= 15) return false;

    return true;
  }, [currentDeck, banlist, getDeckStats]);

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

  const handleAddCardToDeck = useCallback(async (
    card: Card,
    selectedDeckType?: DeckSection
  ) => {
    const deckType = selectedDeckType || getOptimalDeckType(card);

    if (!canAddCardToDeck(card, deckType)) return;

    setAddingCardId(card.id.toString());

    // Simulate loading
    await new Promise((resolve) => setTimeout(resolve, 500));

    addCardToDeck(card, deckType);
    setAddedCards((prev) => new Set([...prev, card.id.toString()]));
    setAddingCardId(null);

    // Remove from added cards after 2 seconds
    setTimeout(() => {
      setAddedCards((prev) => {
        const newSet = new Set(prev);
        newSet.delete(card.id.toString());
        return newSet;
      });
    }, 2000);
  }, [addCardToDeck, canAddCardToDeck, getOptimalDeckType]);

  // Handle feedback for AI responses with optimistic UI and undo
  const handleFeedback = useCallback(async (messageId: string, feedback: "approved" | "disapproved") => {
    const message = messages.find(m => m.id === messageId);
    if (!message || !message.recommendation_id) {
      console.warn("Cannot submit feedback: message or recommendation_id not found");
      return;
    }

    // Optimistic update
    const previousFeedback = feedbackStates.get(messageId);
    setFeedbackStates((prev) => {
      const newMap = new Map(prev);
      newMap.set(messageId, feedback);
      return newMap;
    });

    try {
      await submitFeedback({
        recommendation_id: message.recommendation_id,
        feedback_type: feedback,
      });
      console.log("Feedback submitted successfully");
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
  }, [messages, feedbackStates]);

  // Memoize expensive renders to prevent re-renders on input changes
  const memoizedQuickPrompts = useMemo(() => (
    <div className="flex flex-wrap gap-2 items-center">
      <Sparkles className="h-4 w-4 text-cyan-400" />
      <span className="text-sm font-semibold text-slate-300">
        Quick Recommendations:
      </span>
      {RECOMMENDATION_PROMPTS.map((rp) => {
        const isThisPromptLoading = isQuickPromptLoading === rp.id;
        const isDisabled = !currentDeck?.id || isQuickPromptLoading !== null;
        
        return (
          <Button
            key={rp.id}
            type="button"
            variant="outline"
            size="sm"
            className="text-xs px-3 py-1.5 h-auto rounded-lg border-cyan-400/30 bg-cyan-500/5 text-cyan-300 hover:bg-cyan-500/15 hover:text-cyan-200 hover:border-cyan-400/50 transition-all disabled:opacity-40 disabled:cursor-not-allowed"
            disabled={isDisabled}
            onClick={() => handleQuickPromptClick(rp)}
            title={rp.description}
          >
            {isThisPromptLoading ? (
              <>
                <Loader2 className="h-3 w-3 mr-1.5 animate-spin" />
                Getting...
              </>
            ) : (
              rp.label
            )}
          </Button>
        );
      })}
    </div>
  ), [isQuickPromptLoading, currentDeck?.id, handleQuickPromptClick]);

  const memoizedMessages = useMemo(() => messages.map((message) => {
    const isAssistant = message.role === "assistant";
    const isDeckAnalysis =
      message.type === "deck-analysis" &&
      message.meta?.structuredAnalysis != null;

    // Render deck analysis card for structured analysis messages
    if (isAssistant && isDeckAnalysis) {
      const analysisType = message.meta?.analysisType ?? "summary";
      const meta = message.meta!;

      let analysisCard: JSX.Element | null = null;

      if (analysisType === "summary") {
        analysisCard = renderDeckAnalysisCard(
          meta.structuredAnalysis as DeckAnalysisStructured,
          meta.deckStats ?? null
        );
      } else if (analysisType === "power_level") {
        analysisCard = renderPowerLevelCard(meta.structuredAnalysis as { power_level?: { score: number; explanation: string; suggestions: string[] } });
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
          meta.deckId
        );
      } else if (analysisType === "consistency") {
        const consistency = (meta.structuredAnalysis as DeckAnalysisStructured)?.consistency;
        if (consistency) {
          analysisCard = (
            <div className="w-full max-w-xl rounded-2xl border border-cyan-500/30 bg-slate-900/70 backdrop-blur-sm p-4 shadow-[0_2px_12px_rgba(0,0,0,0.2)] space-y-3">
              <h3 className="text-sm font-semibold tracking-wide uppercase text-cyan-400/80">
                Consistency Analysis
              </h3>
              <div className="inline-flex items-center gap-2 rounded-full border border-cyan-500/30 bg-cyan-500/10 px-3 py-1 text-xs">
                <span className="font-medium text-slate-300">Consistency</span>
                <span className="rounded-full bg-cyan-400/20 px-2 py-0.5 text-[11px] font-semibold text-cyan-300">
                  {consistency.score}/10
                </span>
              </div>
              <p className="text-sm text-slate-300">{consistency.explanation}</p>
              {consistency.suggestions && consistency.suggestions.length > 0 && (
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
        const resilience = (meta.structuredAnalysis as DeckAnalysisStructured)?.resilience_and_grind;
        if (resilience) {
          analysisCard = (
            <div className="w-full max-w-xl rounded-2xl border border-cyan-500/30 bg-slate-900/70 backdrop-blur-sm p-4 shadow-[0_2px_12px_rgba(0,0,0,0.2)] space-y-3">
              <h3 className="text-sm font-semibold tracking-wide uppercase text-cyan-400/80">
                Resilience & Grind Analysis
              </h3>
              <div className="inline-flex items-center gap-2 rounded-full border border-cyan-500/30 bg-cyan-500/10 px-3 py-1 text-xs">
                <span className="font-medium text-slate-300">Resilience</span>
                <span className="rounded-full bg-cyan-400/20 px-2 py-0.5 text-[11px] font-semibold text-cyan-300">
                  {resilience.score}/10
                </span>
              </div>
              <p className="text-sm text-slate-300">{resilience.explanation}</p>
              {resilience.suggestions && resilience.suggestions.length > 0 && (
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
        const matchup = (meta.structuredAnalysis as DeckAnalysisStructured)?.matchup_profile;
        if (matchup) {
          analysisCard = (
            <div className="w-full max-w-xl rounded-2xl border border-cyan-500/30 bg-slate-900/70 backdrop-blur-sm p-4 shadow-[0_2px_12px_rgba(0,0,0,0.2)] space-y-3">
              <h3 className="text-sm font-semibold tracking-wide uppercase text-cyan-400/80">
                Matchup Profile Analysis
              </h3>
              <div className="inline-flex items-center gap-2 rounded-full border border-cyan-500/30 bg-cyan-500/10 px-3 py-1 text-xs">
                <span className="font-medium text-slate-300">Matchup Profile</span>
                <span className="rounded-full bg-cyan-400/20 px-2 py-0.5 text-[11px] font-semibold text-cyan-300">
                  {matchup.score}/10
                </span>
              </div>
              <p className="text-sm text-slate-300">{matchup.explanation}</p>
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
        const complexity = (meta.structuredAnalysis as DeckAnalysisStructured)?.complexity_and_skill;
        if (complexity) {
          analysisCard = (
            <div className="w-full max-w-xl rounded-2xl border border-cyan-500/30 bg-slate-900/70 backdrop-blur-sm p-4 shadow-[0_2px_12px_rgba(0,0,0,0.2)] space-y-3">
              <h3 className="text-sm font-semibold tracking-wide uppercase text-cyan-400/80">
                Complexity & Skill Analysis
              </h3>
              <div className="inline-flex items-center gap-2 rounded-full border border-cyan-500/30 bg-cyan-500/10 px-3 py-1 text-xs">
                <span className="font-medium text-slate-300">Complexity</span>
                <span className="rounded-full bg-cyan-400/20 px-2 py-0.5 text-[11px] font-semibold text-cyan-300">
                  {complexity.score}/10
                </span>
              </div>
              <p className="text-sm text-slate-300">{complexity.explanation}</p>
              <div className="flex flex-wrap gap-2 text-xs text-slate-400">
                <span className="rounded-full border border-cyan-500/30 bg-slate-900/40 px-2 py-0.5">
                  Skill floor: {complexity.skill_floor}
                </span>
                <span className="rounded-full border border-cyan-500/30 bg-slate-900/40 px-2 py-0.5">
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
          meta.deckStats ?? null
        );
      }

      return (
        <div
          key={message.id}
          className="flex justify-start"
        >
          <div className="flex gap-2 max-w-[90%]">
            {/* Clean, icon-only avatar with transparent bg */}
            <Avatar className="bg-transparent shadow-none">
              <AvatarFallback className="bg-transparent">
                <Bot className="h-6 w-6 text-cyan-400/70" />
              </AvatarFallback>
            </Avatar>
            {/* Mode-specific Analysis Card */}
            <div className="flex-1">
              {analysisCard}
              <div className="text-xs text-slate-500 mt-1 text-left">
                {message.timestamp.toLocaleTimeString([], {
                  hour: "2-digit",
                  minute: "2-digit",
                })}
              </div>
            </div>
          </div>
        </div>
      );
    }

    // Default rendering for all other messages
    return (
      <div
        key={message.id}
        className="space-y-3 overflow-x-hidden"
      >
        <div
          className={`flex ${
            message.role === "user" ? "justify-end" : "justify-start"
          }`}
        >
          <div
            className={`flex gap-2 max-w-[80%] ${
              message.role === "user" ? "flex-row-reverse" : ""
            }`}
          >
            {/* Clean, icon-only avatar with transparent bg */}
            <Avatar className="bg-transparent shadow-none">
              <AvatarFallback className="bg-transparent">
                {message.role === "user" ? (
                  <User className="h-6 w-6 text-cyan-400" />
                ) : (
                  <Bot className="h-6 w-6 text-cyan-400/70" />
                )}
              </AvatarFallback>
            </Avatar>
            {/* Bubble */}
            <div>
              <div
                className={`px-5 py-3 rounded-2xl ${
                  message.role === "user"
                    ? "bg-cyan-500/15 border border-cyan-400/60 text-slate-50 rounded-tr-sm"
                    : "bg-slate-900/70 border border-cyan-500/30 text-slate-50 backdrop-blur-sm shadow-[0_2px_12px_rgba(0,0,0,0.2)]"
                }`}
              >
                {/* Use formatted response if we have structured JSON data */}
                {message.recommendedCards || message.alternativeConsiderations ? (
                  <FormattedRecommendationResponse
                    answer={message.content}
                    recommendedCards={message.recommendedCards}
                    alternativeConsiderations={message.alternativeConsiderations}
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
                    isCardSuggestionMode={message.meta?.analysisType === "card_suggestions"}
                  />
                )}
              </div>
              <div className={`flex items-center gap-2 mt-1 ${message.role === "user" ? "justify-end" : "justify-start"}`}>
                <div className={`text-xs text-slate-500 ${message.role === "user" ? "text-right" : "text-left"}`}>
                  {message.timestamp.toLocaleTimeString([], {
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                </div>
                {message.role === "assistant" && message.type !== "error" && message.id !== "welcome" && message.recommendation_id && (
                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      onClick={() => handleFeedback(message.id, "approved")}
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
                      onClick={() => handleFeedback(message.id, "disapproved")}
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
         message.meta?.analysisType !== "card_suggestions" && 
         message.suggestedCards && 
         message.suggestedCards.length > 0 && (
          <div className="flex justify-start">
            <div className="flex gap-2 max-w-[80%]">
              {/* Spacer to align with avatar */}
              <div className="w-6 h-6 flex-shrink-0" />
              {/* Slideshow card */}
              <div className="flex-1 rounded-xl border border-cyan-500/30 bg-slate-900/70 backdrop-blur-sm p-4 shadow-[0_2px_12px_rgba(0,0,0,0.2)] min-w-0">
                <h4 className="text-sm font-semibold text-cyan-400 mb-3">
                  Recommended Cards
                </h4>
                <div className="overflow-x-auto overflow-y-hidden pb-2 -mx-2 px-2 [&::-webkit-scrollbar]:h-2 [&::-webkit-scrollbar-track]:bg-transparent [&::-webkit-scrollbar-thumb]:bg-cyan-500/30 [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:hover:bg-cyan-500/50">
                  <div className="flex gap-3 min-w-max">
                {message.suggestedCards
                  .filter((card) => {
                    const banStatus = banlist[card.name] || "Unlimited";
                    return banStatus !== "Forbidden";
                  })
                  .map((card) => {
                    const cardId = card.id.toString();
                    const banStatus = banlist[card.name] || "Unlimited";
                    const optimalDeckType = getOptimalDeckType(card);
                    const canAdd = canAddCardToDeck(card, optimalDeckType);
                    const isAdding = addingCardId === cardId;
                    const wasAdded = addedCards.has(cardId);

                    return (
                      <div
                        key={card.id}
                        className="flex-shrink-0 w-[200px] rounded-lg border border-cyan-500/20 bg-slate-900/50 backdrop-blur-sm p-3 hover:border-cyan-500/40 hover:bg-slate-900/70 transition-all group"
                      >
                        <div className="flex flex-col items-center gap-2">
                          {/* Card Image with Preview */}
                          <CardPreview card={card} banStatus={banStatus}>
                            <div className="relative w-full aspect-[5/7] flex items-center justify-center cursor-pointer">
                              <Image
                                width={120}
                                height={168}
                                src={
                                  card.card_images[0]?.image_url_small ||
                                  "/placeholder.svg"
                                }
                                alt={card.name}
                                className="w-full h-full object-contain rounded shadow-sm group-hover:shadow-lg transition-shadow"
                              />
                            </div>
                          </CardPreview>

                          {/* Card Name */}
                          <h4 className="font-medium text-xs text-center text-slate-50 line-clamp-2 min-h-[2.5rem]">
                            {card.name}
                          </h4>

                          {/* Add Button */}
                          <Button
                            variant={wasAdded ? "default" : "ghost"}
                            size="sm"
                            className="h-7 w-full text-xs"
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
                                <Check className="h-3 w-3 mr-1" />
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
          </div>
        )}
      </div>
    );
  }), [messages, allCards, banlist, addingCardId, addedCards, currentDeck, canAddCardToDeck, getOptimalDeckType, handleAddCardToDeck, addCardToDeck, getDeckStats, feedbackStates, handleFeedback]);

  const memoizedInputForm = useMemo(() => (
    <form
      className="flex w-full gap-3 items-end"
      onSubmit={(e) => {
        e.preventDefault();
        handleSendMessage();
      }}
    >
      <div className="flex-1 relative">
        <Input
          placeholder="Enter your prompt here..."
          value={input}
          autoFocus
          onChange={handleInputChange}
          onKeyDown={(e) => {
            // Prevent lag by handling Enter key directly
            if (e.key === "Enter" && !e.shiftKey && !isLoading && input.trim() !== "") {
              e.preventDefault();
              handleSendMessage();
            }
          }}
          className="w-full bg-slate-950/60 border border-cyan-500/20 rounded-xl px-4 py-3 pr-12 text-slate-50 placeholder:text-slate-500 focus:border-cyan-400 focus:shadow-[0_0_20px_rgba(56,189,248,0.2)] focus-visible:ring-1 focus-visible:ring-cyan-400/50 transition-colors transition-shadow"
        />
        <button
          type="button"
          className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-300 transition-colors"
          aria-label="Voice input (coming soon)"
          disabled
        >
          <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
          </svg>
        </button>
      </div>
      <Button
        type="submit"
        variant="default"
        disabled={isLoading || input.trim() === ""}
        className="px-6 bg-gradient-to-r from-cyan-500 to-purple-500 hover:from-cyan-400 hover:to-purple-400 text-white border-0 shadow-lg shadow-cyan-500/25"
        aria-label="Send message"
      >
        <Send className="h-5 w-5" aria-hidden="true" />
      </Button>
      <button
        type="button"
        onClick={() => setIsInfoDialogOpen(true)}
        className="text-slate-400 hover:text-slate-300 transition-colors p-2 rounded-lg hover:bg-slate-800/50"
        aria-label="How to use the AI Assistant"
      >
        <Info className="h-5 w-5" aria-hidden="true" />
      </button>
    </form>
  ), [input, isLoading, handleInputChange, handleSendMessage]);

  if (!isOpen) return null;

  // Modern, clean AI assistant UI inspired by the image
  return (
    <div className="fixed inset-0 bg-slate-950/90 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <CutCornerWrapper
        size="lg"
        hoverHighlight
        className="w-full max-w-4xl h-[90vh]"
        padding="0"
        style={{
          ["--cut-corner-stroke" as any]: "rgba(20,239,255,0.38)",
          ["--cut-corner-stroke-hover" as any]: "rgba(20,239,255,0.52)",
          ["--cut-corner-fill" as any]: "transparent",
        }}
      >
        <CardUI className="w-full h-full flex flex-col bg-gradient-to-b from-slate-900 via-slate-950 to-slate-900 border border-cyan-500/20 shadow-[0_0_30px_rgba(56,189,248,0.1)]">
        {/* Clean Header */}
        <CardHeader className="pb-4 border-b border-cyan-500/10">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-full bg-gradient-to-br from-cyan-400/30 to-purple-500/30 flex items-center justify-center border border-cyan-500/30">
                <Bot className="h-5 w-5 text-cyan-300" />
              </div>
              <div>
                <CardTitle className="text-xl font-bold text-slate-50" style={{ fontFamily: "var(--font-heading)" }}>
                  AI Assistant
                </CardTitle>
                <CardDescription className="text-slate-400 text-sm mt-0.5">
                  Get personalized recommendations and answers
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
          {/* Recommendations Section - Cleaner, more prominent - Memoized */}
          <div className="px-6 pt-4 pb-3 border-b border-cyan-500/10 bg-slate-900/30">
            {memoizedQuickPrompts}
          </div>
          {/* Modern scrollable area */}
          <div className="h-full flex-1 min-h-0 flex flex-col">
            <ScrollArea className="flex-1 h-full min-h-0 overflow-y-auto overflow-x-hidden px-4 pr-2">
              <div className="flex flex-col space-y-3 py-4 min-w-0">
                {memoizedMessages}
                {(isLoading || isQuickPromptLoading) && (
                  <div className="flex justify-start">
                    <div className="flex gap-2 max-w-[80%]">
                      <Avatar className="bg-transparent shadow-none">
                        <AvatarFallback>
                          <Bot className="h-6 w-6 text-cyan-400/70" />
                        </AvatarFallback>
                      </Avatar>
                      <div>
                        <div className="px-5 py-3 rounded-2xl bg-slate-900/70 border border-cyan-500/30 text-slate-50 backdrop-blur-sm flex items-center shadow-[0_2px_12px_rgba(0,0,0,0.2)]">
                          <Loader2 className="h-4 w-4 animate-spin mr-2 text-cyan-400" />
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
        </CardContent>

        {/* Recent History Section */}
        {messages.length > 1 && (
          <div className="px-6 py-3 border-t border-cyan-500/10 bg-slate-900/20">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
                Recent History
              </span>
              <button
                type="button"
                onClick={() => setMessages([messages[0]])}
                className="text-xs text-cyan-400 hover:text-cyan-300 transition-colors"
              >
                Clear
              </button>
            </div>
            <div className="space-y-1 max-h-24 overflow-y-auto">
              {messages.slice(1, 4).map((msg) => (
                <div
                  key={msg.id}
                  className="flex items-center gap-2 px-3 py-2 rounded-lg bg-slate-800/40 border border-cyan-500/10 hover:border-cyan-500/30 transition-colors cursor-pointer"
                  onClick={() => {
                    setInput(msg.content);
                  }}
                >
                  <div className="h-4 w-4 rounded-full bg-cyan-500/20 flex items-center justify-center flex-shrink-0">
                    {msg.role === "user" ? (
                      <User className="h-2.5 w-2.5 text-cyan-400" />
                    ) : (
                      <Bot className="h-2.5 w-2.5 text-cyan-400" />
                    )}
                  </div>
                  <span className="text-xs text-slate-300 truncate flex-1">
                    {msg.content.slice(0, 50)}{msg.content.length > 50 ? "..." : ""}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Clean Input Bar - Memoized to prevent re-renders */}
        <CardFooter className="pt-4 pb-6 px-6 border-t border-cyan-500/10 bg-slate-900/30">
          {memoizedInputForm}
        </CardFooter>
        </CardUI>
      </CutCornerWrapper>

      {/* Information Dialog */}
      <Dialog open={isInfoDialogOpen} onOpenChange={setIsInfoDialogOpen}>
        <DialogContent className="max-w-2xl bg-slate-900 border-cyan-500/30">
          <DialogHeader>
            <DialogTitle className="text-xl font-bold text-slate-50 flex items-center gap-2">
              <Info className="h-5 w-5 text-cyan-400" />
              How to Use the AI Assistant
            </DialogTitle>
            <DialogDescription className="text-slate-300 pt-2">
              Learn how to get the most out of your AI-powered deck building assistant.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 text-sm text-slate-200">
            <section className="space-y-2">
              <h3 className="font-semibold text-cyan-400 text-base">Getting Started</h3>
              <p className="leading-relaxed">
                The AI Assistant uses advanced hybrid search and expert-level analysis to help you build better decks. Simply type your question in the input field and press Enter or click Send. The AI considers your deck context, format, and playstyle to provide personalized recommendations.
              </p>
            </section>
            
            <section className="space-y-2">
              <h3 className="font-semibold text-cyan-400 text-base">Quick Recommendations</h3>
              <p className="leading-relaxed">
                Use the Quick Recommendation buttons at the top to get instant suggestions powered by hybrid RAG (Retrieval-Augmented Generation):
              </p>
              <ul className="list-disc pl-5 space-y-1 text-slate-300">
                <li><strong className="text-cyan-300">Archetype Cards:</strong> Get essential cards for your deck&apos;s archetype</li>
                <li><strong className="text-cyan-300">Engine Suggestions:</strong> Find compatible engines that work with your deck</li>
                <li><strong className="text-cyan-300">Tech Cards:</strong> Get matchup-specific tech recommendations</li>
                <li><strong className="text-cyan-300">Personalized:</strong> Receive recommendations tailored to your playstyle and deck history</li>
              </ul>
            </section>

            <section className="space-y-2">
              <h3 className="font-semibold text-cyan-400 text-base">Writing Effective Prompts</h3>
              <p className="leading-relaxed">
                The AI uses a hybrid prompt system that combines freeform analysis with structured output. To get the best results:
              </p>
              <ul className="list-disc pl-5 space-y-1 text-slate-300">
                <li><strong className="text-cyan-300">Be specific:</strong> Instead of &quot;improve my deck&quot;, try &quot;what cards can improve my deck&apos;s consistency?&quot;</li>
                <li><strong className="text-cyan-300">Ask targeted questions:</strong> &quot;What are good side deck options against control decks?&quot; or &quot;Find me 5 cards that synergize with this deck&quot;</li>
                <li><strong className="text-cyan-300">Request explanations:</strong> &quot;What is the purpose of Neo Space Connector in this deck?&quot;</li>
                <li><strong className="text-cyan-300">Format awareness:</strong> The AI automatically considers your deck&apos;s format (Master Duel or TCG) and banlist restrictions</li>
                <li><strong className="text-cyan-300">Request analysis:</strong> Ask for power level, consistency, or matchup analysis</li>
              </ul>
            </section>

            <section className="space-y-2">
              <h3 className="font-semibold text-cyan-400 text-base">Providing Feedback</h3>
              <p className="leading-relaxed">
                Help us improve the AI by providing feedback on recommendations:
              </p>
              <ul className="list-disc pl-5 space-y-1 text-slate-300">
                <li><strong className="text-cyan-300">Thumbs Up (👍):</strong> Click if a recommendation was helpful or accurate</li>
                <li><strong className="text-cyan-300">Thumbs Down (👎):</strong> Click if a recommendation was not helpful or inaccurate</li>
                <li>Feedback buttons appear below AI responses that include recommendations</li>
                <li>Your feedback helps improve future recommendations for you and other users</li>
              </ul>
            </section>

            <section className="space-y-2 pt-2 border-t border-cyan-500/20">
              <p className="text-xs text-slate-400">
                <strong className="text-cyan-300">Tip:</strong> Hover over card names in responses to see card details and add them directly to your deck! The AI uses hybrid search (vector + full-text) to find the most relevant cards from a database of 14,000+ cards.
              </p>
            </section>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

