"use client";

import { useState, useRef, useEffect } from "react";
import { X, Send, Bot, User, Plus, Loader2, Badge, Zap } from "lucide-react";
import { Avatar, AvatarFallback, Image } from "@radix-ui/react-avatar";
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
import { DeckType } from "@/types/types";

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

    // Expect quota data in response: { answer, requests_left, max_requests }
    message.content = result.answer || "AI did not return an answer.";

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
  const { currentDeck, addCardToDeck } = useDeck();
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

  //@TODO: Add way to add cards to deck from AI response from chatbot message

  // Quota (requests left for user), default to unknown ("-")
  const [quota, setQuota] = useState<Quota>({
    requests_left: -1,
    max_requests: -1,
  });

  const allCards = useCardStore((state) => state.cardList);

  // --------- Utility/Helper Functions (unchanged) ---------

  const getDeckStats = (currentDeck: DeckType) => {
    const { mainDeck } = currentDeck;
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

  const determinePlayStyle = (currentDeck: DeckType) => {
    const { mainDeck } = currentDeck;
    const stats = getDeckStats(currentDeck);
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

  const evaluateDeckTier = (currentDeck: DeckType) => {
    const { mainDeck } = currentDeck;
    const stats = getDeckStats(currentDeck);
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

  const handleAddCardToDeck = (card: Card) => {
    const isExtraDeckCard =
      card.type.includes("Fusion") ||
      card.type.includes("Synchro") ||
      card.type.includes("Xyz") ||
      card.type.includes("Link");
    addCardToDeck(card, isExtraDeckCard ? "extraDeck" : "mainDeck");
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
          <CardDescription className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 p-0 min-h-[3.5rem]">
            {/* Instructions / tagline */}
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
                          <span className="whitespace-pre-line text-base">
                            {message.content}
                          </span>
                        </div>
                        {/* Suggested cards panel (unchanged) */}
                        {Array.isArray(message.suggestedCards) &&
                          message.suggestedCards.length > 0 && (
                            <div className="mt-2 grid grid-cols-2 gap-2">
                              {message.suggestedCards.map((card) => (
                                <div
                                  key={card.id}
                                  className="flex items-center gap-2 p-2 rounded-xl bg-card border border-accent shadow"
                                >
                                  <Image
                                    width={80}
                                    height={120}
                                    src={
                                      card.card_images[0].image_url_small ||
                                      "/placeholder.svg"
                                    }
                                    alt={card.name}
                                    className="w-10 h-auto object-contain rounded-md"
                                  />
                                  <div className="flex-1 min-w-0">
                                    <p className="text-xs font-medium truncate">
                                      {card.name}
                                    </p>
                                    <Badge className="text-[10px] mt-1">
                                      {card.type}
                                    </Badge>
                                  </div>
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    className="h-7 w-7 p-0"
                                    onClick={() => handleAddCardToDeck(card)}
                                  >
                                    <Plus className="h-3 w-3" />
                                  </Button>
                                </div>
                              ))}
                            </div>
                          )}
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
