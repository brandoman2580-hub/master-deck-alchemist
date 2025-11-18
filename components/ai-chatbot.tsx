"use client";

import { useState, useRef, useEffect } from "react";
import { X, Send, Bot, User, Loader2, Zap } from "lucide-react";
import { Avatar, AvatarFallback } from "@radix-ui/react-avatar";
import { useDeck } from "@/context/deck-context";
import { Card } from "@/types/card";
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
import { Input } from "./ui/input";
import { supabase } from "@/lib/supabaseClient";
import { useCardStore } from "@/store/cardStore";
import { DeckType, BanStatus, DeckSection } from "@/types/types";
import { Badge } from "./ui/badge";
import { AIResponseCard } from "./ui/ai-response-card";
import { CardPreview } from "./ui/card-preview";

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

interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
  timestamp: Date;
  suggestedCards?: Card[];
  type?: "quick-prompt" | "deck-analysis" | "error";
  meta?: {
    deckId?: string | number;
    banlistFormat?: string;
    analysisType?: AnalysisType;
    structuredAnalysis?: any; // mode-specific shape
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
  | "card_suggestions";

type QuickPrompt = {
  id: string;
  label: string;
  question: string;
  analysisType: AnalysisType;
  description?: string;
};

const QUICK_PROMPTS: QuickPrompt[] = [
  {
    id: "summary",
    label: "Summary Analysis",
    question: "Give me a full summary analysis of this deck.",
    analysisType: "summary",
  },
  {
    id: "power",
    label: "Power Level",
    question: "Analyze my deck's power level, both going first and going second.",
    analysisType: "power_level",
    description: "Looks at board strength and OTK potential.",
  },
  {
    id: "consistency",
    label: "Consistency",
    question: "Quick consistency check: rate and explain my deck's consistency.",
    analysisType: "consistency",
    description: "Rates brick risk, starter density, and redundancy.",
  },
  {
    id: "resilience",
    label: "Resilience & Grind",
    question: "Evaluate my deck's resilience to disruption and grind game.",
    analysisType: "resilience",
    description: "Focuses on follow-up, recursion, and disruption resistance.",
  },
  {
    id: "matchups",
    label: "Matchup Profile",
    question: "Give me a matchup snapshot versus combo, control, and trap decks.",
    analysisType: "matchup",
    description: "Summarizes strengths and weaknesses vs common archetypes.",
  },
  {
    id: "complexity",
    label: "Complexity & Skill",
    question: "Analyze how complex this deck is to pilot and how much it rewards mastery.",
    analysisType: "complexity",
    description: "Rates skill floor, skill ceiling, and punishability of misplays.",
  },
  {
    id: "card_suggestions",
    label: "Card Suggestions",
    question: "Suggest a small set of legal cards I can add that improve the most important weaknesses you see.",
    analysisType: "card_suggestions",
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
          analysis_type: "card_suggestions", // Custom prompts should be actionable/explorative
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
    const analysisType = (result.analysis_type ?? "card_suggestions") as AnalysisType;

    // For custom prompts (card_suggestions), use raw_answer or notes from structured analysis
    // For other types, use overview
    let answerText: string;
    if (analysisType === "card_suggestions" && structuredAnalysis) {
      // Custom prompts: use notes if available, otherwise raw_answer
      answerText = (structuredAnalysis as any)?.notes ?? result.raw_answer ?? result.answer ?? "AI did not return an answer.";
    } else if (structuredAnalysis?.overview) {
      answerText = structuredAnalysis.overview;
    } else {
      answerText = result.raw_answer ?? result.answer ?? "AI did not return an answer.";
    }
    
    message.content = answerText;

    // Parse suggested cards from the response text and match to actual cards
    const extractedCards = extractCardsFromText(answerText, allCards);
    if (extractedCards.length > 0) {
      message.suggestedCards = extractedCards;
    }

    // Store structured analysis and deck stats in message metadata
    // Custom prompts should be treated as deck-analysis if they have structured data
    if (structuredAnalysis) {
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
  } catch (error: any) {
    message.content = `Error contacting AI: ${error.message}`;
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
  const [isLoading, setIsLoading] = useState(false);
  const [isQuickPromptLoading, setIsQuickPromptLoading] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const [banlist, setBanlist] = useState<Record<string, BanStatus>>({});
  const [addingCardId, setAddingCardId] = useState<string | null>(null);
  const [addedCards, setAddedCards] = useState<Set<string>>(new Set());

  // Quota (requests left for user), default to unknown ("-")
  const [quota, setQuota] = useState<Quota>({
    requests_left: -1,
    max_requests: -1,
  });

  const allCards = useCardStore((state) => state.cardList);

  // Load banlist on mount from Supabase
  useEffect(() => {
    const loadBanlist = async () => {
      try {
        const { getMasterDuelBanlist } = await import("@/lib/api");
        const banlistData = await getMasterDuelBanlist();
        setBanlist(banlistData);
      } catch (error) {
        console.error("Error loading banlist:", error);
        setBanlist({});
      }
    };
    loadBanlist();
  }, []);

  // --------- Utility/Helper Functions ---------

  const getLocalDeckStats = (deck: DeckType) => {
    const { mainDeck } = deck;
    const monsterCount = mainDeck.filter((card) =>
      card.type.includes("Monster")
    ).length;
    const spellCount = mainDeck.filter((card) =>
      card.type.includes("Spell")
    ).length;
    const trapCount = mainDeck.filter((card) =>
      card.type.includes("Trap")
    ).length;
    return {
      mainCount: mainDeck.length,
      monsterCount,
      spellCount,
      trapCount,
    };
  };

  // ---------------------------------------------------------

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  // Map deck mode to banlist_format for edge function
  const getBanlistFormat = (mode: string): string => {
    return mode === "Master Duel" ? "MASTER_DUEL" : "TCG";
  };

  // Handler for quick prompt clicks
  const handleQuickPromptClick = async (prompt: QuickPrompt) => {
    const deckId = currentDeck?.id;
    if (!deckId) return; // Safeguard

    try {
      setIsQuickPromptLoading(prompt.id);

      // Ensure deck is saved to Supabase before analysis
      // This ensures the edge function can find the deck
      try {
        await saveDeck(currentDeck);
      } catch (saveError) {
        console.warn("Failed to save deck before analysis:", saveError);
        // Continue anyway - the deck might already be saved
      }

      // Add user message representing the quick action
      const userMessage: Message = {
        id: crypto.randomUUID(),
        role: "user",
        content: prompt.label,
        timestamp: new Date(),
        type: "quick-prompt",
      };
      setMessages((prev) => [...prev, userMessage]);

      // Get auth token
      const { data } = await supabase.auth.getSession();
      const accessToken = data.session?.access_token;

      // Call the deck analysis edge function
      const banlistFormat = getBanlistFormat(currentDeck.mode);
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
            question: prompt.question,
            analysis_type: prompt.analysisType,
          }),
        }
      );

      if (!response.ok) {
        const errorText = await response.text();
        console.error("Deck analysis error:", errorText);
        const errorMessage: Message = {
          id: crypto.randomUUID(),
          role: "assistant",
          content: "There was an error analyzing this deck. Please try again.",
          timestamp: new Date(),
          type: "error",
        };
        setMessages((prev) => [...prev, errorMessage]);
        // Don't return early - let finally block clear loading state
      } else {
        const json = await response.json();

        // Extract structured analysis and deck stats
        const structuredAnalysis = json.structured_analysis ?? null;
        const deckStats = json.deck_stats ?? null;
        const analysisType = (json.analysis_type ?? prompt.analysisType) as AnalysisType;

        // Use overview from structured_analysis as primary content, fallback to raw_answer or answer
        const overviewText =
          structuredAnalysis?.overview ??
          json.raw_answer ??
          json.answer ??
          "No response from analysis.";

        // Extract suggested cards from the response
        const extractedCards = extractCardsFromText(overviewText, allCards);

        // Append the AI's answer as an assistant message
        const assistantMessage: Message = {
          id: crypto.randomUUID(),
          role: "assistant",
          content: overviewText,
          timestamp: new Date(),
          type: "deck-analysis",
          suggestedCards: extractedCards.length > 0 ? extractedCards : undefined,
          meta: {
            deckId,
            banlistFormat,
            analysisType,
            structuredAnalysis,
            deckStats,
          },
        };
        setMessages((prev) => [...prev, assistantMessage]);

        // Update quota if available
        if (json.requests_left != null && json.max_requests != null) {
          setQuota({
            requests_left: json.requests_left,
            max_requests: json.max_requests,
          });
        }
      }
    } catch (error: any) {
      console.error("Error in quick prompt:", error);
      const errorMessage: Message = {
        id: crypto.randomUUID(),
        role: "assistant",
        content: `Error: ${error.message || "Failed to analyze deck."}`,
        timestamp: new Date(),
        type: "error",
      };
      setMessages((prev) => [...prev, errorMessage]);
    } finally {
      setIsQuickPromptLoading(null);
    }
  };

  const handleSendMessage = async () => {
    if (input.trim() === "") return;

    const userMessage: Message = {
      id: crypto.randomUUID(),
      role: "user",
      content: input,
      timestamp: new Date(),
    };

    setMessages((prev) => [...prev, userMessage]);
    setInput("");
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

      const { message, quota: quotaFromAI } = await generateAIResponse(
        userMessage.content,
        currentDeck,
        allCards
      );
      setMessages((prev) => [...prev, message]);
      if (quotaFromAI) setQuota(quotaFromAI);
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
  };

  // Enhanced card handling functions
  const canAddCardToDeck = (card: Card, deckType: DeckSection): boolean => {
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
  };

  const getOptimalDeckType = (card: Card): DeckSection => {
    if (
      card.type.includes("Fusion") ||
      card.type.includes("Synchro") ||
      card.type.includes("Xyz") ||
      card.type.includes("Link")
    ) {
      return "extraDeck";
    }
    return "mainDeck";
  };

  const handleAddCardToDeck = async (
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
  };

  if (!isOpen) return null;

  // Progress for the quota (0..1)
  const quotaValue =
    quota.max_requests > 0 && quota.requests_left >= 0
      ? Math.min(quota.requests_left / quota.max_requests, 1)
      : 0;

  // HUD-styled AI assistant: matches Deck Builder / navbar HUD theme with a futuristic, professional console look.
  return (
    <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <CardUI className="w-full max-w-2xl h-[88vh] flex flex-col bg-gradient-to-b from-cyan-400/20 via-cyan-500/15 to-cyan-600/5 backdrop-blur-md border border-cyan-500/30 rounded-2xl shadow-[0_0_20px_rgba(56,189,248,0.15)]">
        <CardHeader className="pb-2 relative bg-slate-950/60 border-b border-cyan-500/30 rounded-t-2xl">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Bot className="h-5 w-5 text-cyan-400" />
              <CardTitle className="font-bold tracking-tight text-slate-50" style={{ fontFamily: "var(--font-heading)" }}>
                <span className="border-b-2 border-cyan-400/60 pb-0.5">AI Assistant</span>
              </CardTitle>
            </div>
            <Button 
              variant="ghost" 
              size="icon" 
              onClick={onClose}
              className="text-cyan-400 hover:text-cyan-300 hover:bg-cyan-500/10 border border-cyan-500/30 hover:border-cyan-400/50 hover:shadow-[0_0_15px_rgba(56,189,248,0.2)]"
            >
              <X className="h-5 w-5" />
            </Button>
          </div>
          {/* HUD-styled CardDescription: modern, user-centric layout for AI chatbot card explanations. */}
          <CardDescription className="space-y-4 p-0 mt-3">
            {/* Instructions / tagline and quota display */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="flex-1">
                <p className="text-sm sm:text-base font-medium text-slate-300 tracking-tight leading-relaxed">
                  Ask about{" "}
                  <span className="font-semibold text-cyan-400">
                    synergies&nbsp;·&nbsp;upgrades&nbsp;·&nbsp;meta&nbsp;·&nbsp;side
                    options
                  </span>
                </p>
              </div>

              {/* Modern quota display - HUD styled */}
              <div className="flex items-center gap-3 min-w-[180px] sm:justify-end">
                {/* Zap/bolt icon in colored circle */}
                <div className="h-7 w-7 rounded-full bg-gradient-to-b from-cyan-400/30 to-cyan-500/20 flex items-center justify-center shadow-sm border border-cyan-400/40 flex-shrink-0">
                  <Zap className="w-4 h-4 text-cyan-300" />
                </div>
                {/* Quota numbers and pill */}
                <div className="flex flex-col items-end min-w-0">
                  <div className="flex items-baseline gap-1.5">
                    <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider select-none">
                      Requests
                    </span>
                    <span className="text-base text-cyan-400 font-bold tabular-nums">
                      {quota.requests_left !== -1 ? quota.requests_left : "-"}
                    </span>
                    <span className="text-xs text-slate-500">/</span>
                    <span className="text-base text-slate-300 font-medium tabular-nums">
                      {quota.max_requests !== -1 ? quota.max_requests : "-"}
                    </span>
                  </div>
                  {/* Progress bar as a thin pill */}
                  {quota.max_requests > 0 && (
                    <div className="relative mt-1.5 w-full max-w-[140px] h-1.5 rounded-full bg-slate-800/60 border border-cyan-500/20 overflow-hidden">
                      <div
                        className={`absolute inset-y-0 left-0 rounded-full transition-all duration-700 ease-out`}
                        style={{
                          width: `${quotaValue * 100}%`,
                          backgroundColor:
                            quotaValue < 0.25
                              ? "#ef4444" // red-500
                              : quotaValue < 0.5
                              ? "#facc15" // yellow-400
                              : "#22c55e", // green-500
                        }}
                      />
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Current Deck Display - HUD styled panel */}
            <div className="bg-slate-950/80 rounded-2xl px-4 py-4 border border-cyan-500/30 backdrop-blur-sm shadow-[0_0_24px_rgba(56,189,248,0.15)]">
              {/* Header */}
              <div className="flex items-center justify-between mb-4 pb-3 border-b border-cyan-500/20">
                <div className="flex items-center gap-2">
                  <h4 className="text-sm font-semibold text-slate-50 tracking-tight">
                    Current Deck
                  </h4>
                  <span className="text-xs text-slate-400 font-medium truncate max-w-[200px]">
                    {currentDeck.name}
                  </span>
                </div>
                <Badge 
                  variant="outline" 
                  className="text-[11px] border-cyan-400/40 bg-cyan-500/10 text-cyan-100 uppercase tracking-wide px-2 py-0.5"
                >
                  {currentDeck.mode}
                </Badge>
              </div>

              {/* Deck Stats Grid */}
              <div
                className={`grid gap-3 mb-4 ${
                  currentDeck.mode === "Master Duel"
                    ? "grid-cols-2"
                    : "grid-cols-3"
                }`}
              >
                <div className="bg-slate-900/40 rounded-lg p-2.5 border border-cyan-500/20 text-center">
                  <div className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider mb-1">
                    Main
                  </div>
                  <div
                    className={`text-base font-bold tabular-nums ${
                      getDeckStats().mainCount < 40
                        ? "text-red-400"
                        : getDeckStats().mainCount > 60
                        ? "text-orange-400"
                        : "text-cyan-400"
                    }`}
                  >
                    {getDeckStats().mainCount}
                    <span className="text-xs text-slate-500 font-normal ml-1">/ 60</span>
                  </div>
                </div>
                <div className="bg-slate-900/40 rounded-lg p-2.5 border border-cyan-500/20 text-center">
                  <div className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider mb-1">
                    Extra
                  </div>
                  <div
                    className={`text-base font-bold tabular-nums ${
                      getDeckStats().extraCount > 15
                        ? "text-orange-400"
                        : "text-cyan-400"
                    }`}
                  >
                    {getDeckStats().extraCount}
                    <span className="text-xs text-slate-500 font-normal ml-1">/ 15</span>
                  </div>
                </div>
                {currentDeck.mode === "TCG" && (
                  <div className="bg-slate-900/40 rounded-lg p-2.5 border border-cyan-500/20 text-center">
                    <div className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider mb-1">
                      Side
                    </div>
                    <div
                      className={`text-base font-bold tabular-nums ${
                        getDeckStats().sideCount > 15
                          ? "text-orange-400"
                          : "text-cyan-400"
                      }`}
                    >
                      {getDeckStats().sideCount}
                      <span className="text-xs text-slate-500 font-normal ml-1">/ 15</span>
                    </div>
                  </div>
                )}
              </div>

              {/* Deck composition breakdown */}
              <div className="flex justify-center gap-4 pt-3 border-t border-cyan-500/20">
                <div className="flex items-center gap-1.5">
                  <span className="text-xs font-semibold text-cyan-400 tabular-nums">
                    {getLocalDeckStats(currentDeck).monsterCount}
                  </span>
                  <span className="text-[11px] text-slate-400 uppercase tracking-wide">
                    Monsters
                  </span>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="text-xs font-semibold text-cyan-400 tabular-nums">
                    {getLocalDeckStats(currentDeck).spellCount}
                  </span>
                  <span className="text-[11px] text-slate-400 uppercase tracking-wide">
                    Spells
                  </span>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="text-xs font-semibold text-cyan-400 tabular-nums">
                    {getLocalDeckStats(currentDeck).trapCount}
                  </span>
                  <span className="text-[11px] text-slate-400 uppercase tracking-wide">
                    Traps
                  </span>
                </div>
              </div>
            </div>
          </CardDescription>
        </CardHeader>

        <CardContent className="flex-1 overflow-hidden px-0 flex flex-col">
          {/* Quick Prompts UI - Sticky at top */}
          <div className="px-4 pt-4 pb-2 border-b border-cyan-500/20 bg-slate-950/95 backdrop-blur-sm sticky top-0 z-10 flex-shrink-0">
            <div className="flex flex-wrap gap-2 items-center">
              <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider mr-1">
                Quick Analysis:
              </span>
              {QUICK_PROMPTS.map((qp) => {
                const isThisPromptLoading = isQuickPromptLoading === qp.id;
                // Disable all buttons when any quick prompt is loading
                const isDisabled = !currentDeck?.id || isQuickPromptLoading !== null;
                
                return (
                  <Button
                    key={qp.id}
                    type="button"
                    variant="outline"
                    size="sm"
                    className="text-xs px-3 py-1 h-auto rounded-full border-cyan-500/30 bg-slate-900/40 text-slate-300 hover:bg-cyan-500/10 hover:text-cyan-400 hover:border-cyan-400/50 transition-all disabled:opacity-40 disabled:cursor-not-allowed"
                    disabled={isDisabled}
                    onClick={() => handleQuickPromptClick(qp)}
                    title={!currentDeck?.id ? "Select a deck to use quick analysis" : qp.description}
                  >
                    {isThisPromptLoading ? (
                      <>
                        <Loader2 className="h-3 w-3 mr-1.5 animate-spin" />
                        Analyzing...
                      </>
                    ) : (
                      qp.label
                    )}
                  </Button>
                );
              })}
              {!currentDeck?.id && (
                <span className="text-xs text-slate-500 italic ml-2">
                  Select a deck to use quick analysis
                </span>
              )}
            </div>
          </div>
          {/* Modern scrollable area */}
          <div className="h-full flex-1 min-h-0 flex flex-col">
            <ScrollArea className="flex-1 h-full min-h-0 overflow-y-auto px-4 pr-2">
              <div className="flex flex-col space-y-3 py-4">
                {messages.map((message) => {
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
                        meta.structuredAnalysis!,
                        meta.deckStats ?? null
                      );
                    } else if (analysisType === "power_level") {
                      analysisCard = renderPowerLevelCard(meta.structuredAnalysis!);
                    } else if (analysisType === "card_suggestions") {
                      analysisCard = renderCardSuggestionsCard(
                        meta.structuredAnalysis!,
                        allCards,
                        addCardToDeck,
                        getOptimalDeckType,
                        getDeckStats,
                        banlist,
                        meta.deckId
                      );
                    } else if (analysisType === "consistency") {
                      const consistency = meta.structuredAnalysis?.consistency;
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
                      const resilience = meta.structuredAnalysis?.resilience_and_grind;
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
                      const matchup = meta.structuredAnalysis?.matchup_profile;
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
                      const complexity = meta.structuredAnalysis?.complexity_and_skill;
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
                        meta.structuredAnalysis,
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
                            <AIResponseCard 
                              content={message.content}
                              suggestedCards={message.suggestedCards || []}
                              banlist={banlist}
                              currentDeckMode={currentDeck.mode}
                              addingCardId={addingCardId}
                              addedCards={addedCards}
                              canAddCardToDeck={canAddCardToDeck}
                              getOptimalDeckType={getOptimalDeckType}
                              handleAddCardToDeck={handleAddCardToDeck}
                            />
                          </div>
                          <div className={`text-xs text-slate-500 mt-1 ${message.role === "user" ? "text-right" : "text-left"}`}>
                            {message.timestamp.toLocaleTimeString([], {
                              hour: "2-digit",
                              minute: "2-digit",
                            })}
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}
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

        <CardFooter className="pt-4 border-t border-cyan-500/30 mt-3">
          <form
            className="flex w-full gap-2"
            onSubmit={(e) => {
              e.preventDefault();
              handleSendMessage();
            }}
          >
            <Input
              placeholder="Type your message…"
              value={input}
              autoFocus
              onChange={(e) => setInput(e.target.value)}
              className="flex-1 bg-slate-950/80 border border-cyan-500/30 rounded-xl px-4 py-2 text-slate-50 placeholder:text-slate-500 focus:border-cyan-400 focus:shadow-[0_0_24px_rgba(56,189,248,0.35)] focus-visible:ring-2 focus-visible:ring-cyan-400/60 transition-all"
            />
            <Button
              type="submit"
              variant="default"
              disabled={isLoading || input.trim() === ""}
            >
              <Send className="h-5 w-5" />
              <span className="ml-2 hidden sm:inline">Send</span>
            </Button>
          </form>
        </CardFooter>
      </CardUI>
    </div>
  );
}

