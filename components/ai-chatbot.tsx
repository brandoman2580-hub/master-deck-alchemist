"use client";

import { useState, useRef, useEffect } from "react";
import { X, Send, Bot, User, Loader2, Zap } from "lucide-react";
import { Avatar, AvatarFallback } from "@radix-ui/react-avatar";
import { useDeck } from "@/context/deck-context";
import { Card } from "@/types/card";
import { ScrollArea } from "@radix-ui/react-scroll-area";
import { Button } from "./ui/button";
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
import { POWERFUL_ARCHETYPE_CARDS } from "@/lib/constants";
import { useCardStore } from "@/store/cardStore";
import { DeckType, BanStatus, DeckSection } from "@/types/types";
import { Badge } from "./ui/badge";
import { AIResponseCard } from "./ui/ai-response-card";

interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
  timestamp: Date;
  suggestedCards?: Card[];
}

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
  allCards: Card[],
  playStyles: string[],
  deckTier: number
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

    // Combine all cards in the deck into a single array
    const cardPool = [
      ...(currentDeck.mainDeck || []),
      ...(currentDeck.extraDeck || []),
      ...(currentDeck.sideDeck || []),
    ];

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
          question: userMessage,
          deck_cards: cardPool,
          card_pool: allCards,
          play_styles: playStyles,
          deck_tier: deckTier,
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

    // Expect quota data in response: { answer, requests_left, max_requests, suggested_cards }
    message.content = result.answer || "AI did not return an answer.";

    // Parse suggested cards from the response text and match to actual cards
    const extractedCards = extractCardsFromText(result.answer || "", allCards);
    if (extractedCards.length > 0) {
      message.suggestedCards = extractedCards;
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

export default function AIChatbot({ isOpen, onClose }: AIChatbotProps) {
  const { currentDeck, addCardToDeck, getDeckStats } = useDeck();
  const [messages, setMessages] = useState<Message[]>([
    {
      id: "welcome",
      role: "assistant",
      content:
        "👋 Welcome! I'm your Yu-Gi-Oh! deck AI. Ask me about synergies, upgrades, side options, or meta matchups.",
      timestamp: new Date(),
    },
  ]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
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

  // Load banlist on mount
  useEffect(() => {
    fetch("/data/master-duel-banlist.json")
      .then((res) => res.json())
      .then(setBanlist)
      .catch(() => setBanlist({}));
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

  const determinePlayStyle = (deck: DeckType) => {
    const { mainDeck } = deck;
    const stats = getLocalDeckStats(deck);
    const playStyles: string[] = [];
    if (stats.monsterCount > 25 && stats.monsterCount / stats.mainCount > 0.6) {
      playStyles.push("Aggro");
    }
    if (stats.trapCount > 10 && stats.trapCount / stats.mainCount > 0.2) {
      playStyles.push("Control");
    }
    const archetypes = new Map<string, number>();
    mainDeck.forEach((card) => {
      if (card.archetype) {
        archetypes.set(
          card.archetype,
          (archetypes.get(card.archetype) || 0) + 1
        );
      }
    });
    for (const [, count] of Array.from(archetypes.entries())) {
      if (count >= 8) {
        playStyles.push("Combo");
        break;
      }
    }
    if (
      stats.monsterCount / stats.mainCount > 0.4 &&
      stats.monsterCount / stats.mainCount < 0.6 &&
      stats.spellCount / stats.mainCount > 0.25
    ) {
      playStyles.push("Midrange");
    }
    if (playStyles.length === 0 && stats.mainCount > 30) {
      playStyles.push("Balanced");
    }
    if (stats.mainCount < 40) {
      playStyles.push("Incomplete");
    }
    return playStyles;
  };

  const evaluateDeckTier = (deck: DeckType) => {
    const { mainDeck } = deck;
    const stats = getLocalDeckStats(deck);
    if (stats.mainCount < 30) {
      return 4; // Casual - not enough cards
    }
    const archetypes = new Map<string, number>();
    mainDeck.forEach((card) => {
      if (card.archetype) {
        archetypes.set(
          card.archetype,
          (archetypes.get(card.archetype) || 0) + 1
        );
      }
    });
    const hasPowerfulArchetype = Array.from(archetypes.keys()).some(
      (archetype) => POWERFUL_ARCHETYPE_CARDS.includes(archetype)
    );
    const hasBalancedComposition =
      stats.monsterCount >= 16 &&
      stats.spellCount >= 10 &&
      stats.trapCount >= 5;
    if (
      hasPowerfulArchetype &&
      hasBalancedComposition &&
      stats.mainCount >= 40
    ) {
      return 1; // Tier 1 - Meta
    } else if (
      (hasPowerfulArchetype || hasBalancedComposition) &&
      stats.mainCount >= 40
    ) {
      return 2; // Tier 2 - Competitive
    } else if (stats.mainCount >= 40) {
      return 3; // Tier 3 - Rogue
    } else {
      return 4; // Tier 4 - Casual
    }
  };

  // ---------------------------------------------------------

  const playStyles = determinePlayStyle(currentDeck);
  const deckTier = evaluateDeckTier(currentDeck);

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  const handleSendMessage = () => {
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

    (async () => {
      const { message, quota: quotaFromAI } = await generateAIResponse(
        userMessage.content,
        currentDeck,
        allCards,
        playStyles,
        deckTier
      );
      setMessages((prev) => [...prev, message]);
      if (quotaFromAI) setQuota(quotaFromAI);
      setIsLoading(false);
    })();
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

  return (
    <div className="fixed inset-0 bg-background/80 backdrop-blur-sm z-50 flex items-center justify-center">
      <CardUI className="w-full max-w-2xl h-[88vh] flex flex-col shadow-2xl border-accent border-2 rounded-2xl">
        <CardHeader className="pb-2 relative">
          <div className="flex items-center justify-between">
            <div className="flex items-center">
              <Bot className="h-5 w-5 mr-2 text-primary" />
              <CardTitle className="font-bold tracking-tight">
                Yu-Gi-Oh! AI Assistant
              </CardTitle>
            </div>
            <Button variant="ghost" size="icon" onClick={onClose}>
              <X className="h-5 w-5" />
            </Button>
          </div>
          <CardDescription className="space-y-3 p-0">
            {/* Instructions / tagline and quota display */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 min-h-[3.5rem]">
              <span className="text-sm sm:text-base font-medium text-muted-foreground tracking-tight">
                Ask about{" "}
                <span className="font-semibold text-primary">
                  synergies&nbsp;·&nbsp;upgrades&nbsp;·&nbsp;meta&nbsp;·&nbsp;side
                  options
                </span>
              </span>

              {/* Modern quota display */}
              <div className="flex items-center gap-2 min-w-[160px] sm:justify-end">
                {/* Zap/bolt icon in colored circle */}
                <span className="h-6 w-6 rounded-full bg-yellow-200 flex items-center justify-center shadow-sm ring-1 ring-yellow-300">
                  <Zap className="w-4 h-4 text-yellow-500" />
                </span>
                {/* Quota numbers and pill */}
                <div className="flex flex-col items-end">
                  <span className="text-xs font-semibold text-gray-500 select-none">
                    AI Requests
                    <span className="ml-2 text-base text-primary font-bold tabular-nums">
                      {quota.requests_left !== -1 ? quota.requests_left : "-"}
                    </span>
                    <span className="mx-0.5 text-muted-foreground text-[13px]">
                      /
                    </span>
                    <span className="text-base">
                      {quota.max_requests !== -1 ? quota.max_requests : "-"}
                    </span>
                  </span>
                  {/* Progress bar as a thin pill */}
                  {quota.max_requests > 0 && (
                    <div className="relative mt-1 w-28 h-2 rounded-full bg-muted-foreground/10 border overflow-hidden">
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

            {/* Current Deck Display */}
            <div className="bg-muted/30 rounded-lg p-3 border border-border/50">
              <div className="flex items-center justify-between mb-2">
                <h4 className="text-sm font-semibold text-card-foreground">
                  Current Deck: {currentDeck.name}
                </h4>
                <Badge variant="outline" className="text-xs">
                  {currentDeck.mode}
                </Badge>
              </div>
              <div
                className={`grid gap-3 text-xs ${
                  currentDeck.mode === "Master Duel"
                    ? "grid-cols-2"
                    : "grid-cols-3"
                }`}
              >
                <div className="text-center">
                  <div className="font-medium text-card-foreground">Main</div>
                  <div
                    className={`text-sm ${
                      getDeckStats().mainCount < 40
                        ? "text-red-500"
                        : getDeckStats().mainCount > 60
                        ? "text-orange-500"
                        : "text-green-600"
                    }`}
                  >
                    {getDeckStats().mainCount}/60
                  </div>
                </div>
                <div className="text-center">
                  <div className="font-medium text-card-foreground">Extra</div>
                  <div
                    className={`text-sm ${
                      getDeckStats().extraCount > 15
                        ? "text-orange-500"
                        : "text-muted-foreground"
                    }`}
                  >
                    {getDeckStats().extraCount}/15
                  </div>
                </div>
                {currentDeck.mode === "TCG" && (
                  <div className="text-center">
                    <div className="font-medium text-card-foreground">Side</div>
                    <div
                      className={`text-sm ${
                        getDeckStats().sideCount > 15
                          ? "text-orange-500"
                          : "text-muted-foreground"
                      }`}
                    >
                      {getDeckStats().sideCount}/15
                    </div>
                  </div>
                )}
              </div>
              {/* Deck composition breakdown */}
              <div className="flex justify-center gap-4 mt-2 pt-2 border-t border-border/30">
                <span className="text-xs text-muted-foreground">
                  <span className="font-medium text-blue-600">
                    {getLocalDeckStats(currentDeck).monsterCount}
                  </span>{" "}
                  Monsters
                </span>
                <span className="text-xs text-muted-foreground">
                  <span className="font-medium text-green-600">
                    {getLocalDeckStats(currentDeck).spellCount}
                  </span>{" "}
                  Spells
                </span>
                <span className="text-xs text-muted-foreground">
                  <span className="font-medium text-purple-600">
                    {getLocalDeckStats(currentDeck).trapCount}
                  </span>{" "}
                  Traps
                </span>
              </div>
            </div>
          </CardDescription>
        </CardHeader>

        <CardContent className="flex-1 overflow-hidden px-0">
          {/* Modern scrollable area */}
          <div className="h-full flex-1 min-h-0 flex flex-col">
            <ScrollArea className="flex-1 h-full min-h-0 overflow-y-auto px-4">
              <div className="flex flex-col space-y-4 py-4">
                {messages.map((message) => (
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
                            <User className="h-6 w-6 text-primary" />
                          ) : (
                            <Bot className="h-6 w-6 text-gray-500" />
                          )}
                        </AvatarFallback>
                      </Avatar>
                      {/* Bubble */}
                      <div>
                        <div
                          className={`px-5 py-3 rounded-2xl shadow-sm ${
                            message.role === "user"
                              ? "bg-primary text-primary-foreground"
                              : "bg-card/90 text-card-foreground border border-border"
                          }`}
                          style={{
                            // optional glassmorphism & drop-shadow for assistant
                            ...(message.role === "assistant"
                              ? {
                                  backdropFilter: "blur(4px)",
                                  boxShadow: "0 2px 12px 0 rgba(0,0,0,0.04)",
                                }
                              : {}),
                          }}
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
                        <div className="text-xs text-muted-foreground mt-1 text-right">
                          {message.timestamp.toLocaleTimeString([], {
                            hour: "2-digit",
                            minute: "2-digit",
                          })}
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
                {isLoading && (
                  <div className="flex justify-start">
                    <div className="flex gap-2 max-w-[80%]">
                      <Avatar className="bg-transparent shadow-none">
                        <AvatarFallback>
                          <Bot className="h-6 w-6 text-gray-500" />
                        </AvatarFallback>
                      </Avatar>
                      <div>
                        <div className="px-5 py-3 rounded-2xl bg-card/80 text-card-foreground border border-border flex items-center">
                          <Loader2 className="h-4 w-4 animate-spin mr-2" />
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

        <CardFooter className="pt-4 border-t border-accent">
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
              className="flex-1 rounded-full shadow"
            />
            <Button
              type="submit"
              className="rounded-full px-4 py-2"
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
