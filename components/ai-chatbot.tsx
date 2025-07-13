"use client";

import { useState, useRef, useEffect } from "react";
import { X, Send, Bot, User, Plus, Loader2, Badge } from "lucide-react";
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

interface AIChatbotProps {
  isOpen: boolean;
  onClose: () => void;
}

const generateAIResponse = async (
  userMessage: string,
  currentDeck,
  allCards: Card[],
  playStyles: string[],
  deckTier: number,
): Promise<Message> => {
  const message: Message = {
    id: crypto.randomUUID(),
    role: "assistant",
    content: "",
    timestamp: new Date(),
  };

  const deckId = currentDeck?.id;
  if (!deckId) {
    message.content = "No deck selected. Please select a deck first.";
    return message;
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
      return message;
    }

    message.content = result.answer || "AI did not return an answer.";
    return message;
  } catch (error: any) {
    message.content = `Error contacting AI: ${error.message}`;
    return message;
  }
};

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

    // Check for aggro style (high ATK monsters, low spell/trap count)
    if (stats.monsterCount > 25 && stats.monsterCount / stats.mainCount > 0.6) {
      playStyles.push("Aggro");
    }

    // Check for control style (high trap count)
    if (stats.trapCount > 10 && stats.trapCount / stats.mainCount > 0.2) {
      playStyles.push("Control");
    }

    // Check for combo style (cards with similar effects or archetypes)
    const archetypes = new Map<string, number>();
    mainDeck.forEach((card) => {
      if (card.archetype) {
        archetypes.set(
          card.archetype,
          (archetypes.get(card.archetype) || 0) + 1
        );
      }
    });

    // If any archetype has more than 8 cards, it's likely a combo deck
    for (const [, count] of Array.from(archetypes.entries())) {
      if (count >= 8) {
        playStyles.push("Combo");
        break;
      }
    }

    // Check for midrange style (balanced monster/spell/trap ratio)
    if (
      stats.monsterCount / stats.mainCount > 0.4 &&
      stats.monsterCount / stats.mainCount < 0.6 &&
      stats.spellCount / stats.mainCount > 0.25
    ) {
      playStyles.push("Midrange");
    }

    // If no specific style is detected, mark as "Balanced"
    if (playStyles.length === 0 && stats.mainCount > 30) {
      playStyles.push("Balanced");
    }

    // Add "Incomplete" tag if deck is too small
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

    // Check for powerful archetypes (simplified example)
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

    // Check for balanced composition
    const hasBalancedComposition =
      stats.monsterCount >= 16 &&
      stats.spellCount >= 10 &&
      stats.trapCount >= 5;

    // Simplified tier evaluation
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

export default function AIChatbot({ isOpen, onClose }: AIChatbotProps) {
  const { currentDeck, addCardToDeck } = useDeck();
  const [messages, setMessages] = useState<Message[]>([
    {
      id: "welcome",
      role: "assistant",
      content:
        "Hello! I'm your Yu-Gi-Oh! deck assistant. Ask me about card synergies, deck improvements, or strategies!",
      timestamp: new Date(),
    },
  ]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  // If you want to include the full card pool from your API:
  const allCards = useCardStore((state) => state.cardList);
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

    // Simulate AI processing
    setTimeout(async () => {
      const response = await generateAIResponse(
        userMessage.content,
        currentDeck,
        allCards,
        playStyles,
        deckTier
      );
      setMessages((prev) => [...prev, response]);
      setIsLoading(false);
    }, 1500);
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

  return (
    <div className="fixed inset-0 bg-background/80 backdrop-blur-sm z-50 flex items-center justify-center">
      <CardUI className="w-full max-w-2xl h-[80vh] flex flex-col">
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center">
              <Bot className="h-5 w-5 mr-2 text-primary" />
              <CardTitle>Yu-Gi-Oh! AI Assistant</CardTitle>
            </div>
            <Button variant="ghost" size="icon" onClick={onClose}>
              <X className="h-4 w-4" />
            </Button>
          </div>
          <CardDescription>
            Ask about card synergies, deck improvements, or strategies
          </CardDescription>
        </CardHeader>

        <CardContent className="flex-1 overflow-hidden p-0">
          <ScrollArea className="h-full px-4">
            <div className="space-y-4 py-4">
              {messages.map((message) => (
                <div
                  key={message.id}
                  className={`flex ${
                    message.role === "user" ? "justify-end" : "justify-start"
                  }`}
                >
                  <div
                    className={`flex gap-3 max-w-[80%] ${
                      message.role === "user" ? "flex-row-reverse" : ""
                    }`}
                  >
                    <Avatar
                      className={
                        message.role === "user" ? "bg-primary" : "bg-muted"
                      }
                    >
                      <AvatarFallback>
                        {message.role === "user" ? (
                          <User className="h-4 w-4" />
                        ) : (
                          <Bot className="h-4 w-4" />
                        )}
                      </AvatarFallback>
                    </Avatar>

                    <div>
                      <div
                        className={`rounded-lg px-4 py-2 ${
                          message.role === "user"
                            ? "bg-primary text-primary-foreground"
                            : "bg-muted"
                        }`}
                      >
                        <div className="whitespace-pre-line text-sm">
                          {message.content}
                        </div>
                      </div>

                      {message.suggestedCards &&
                        message.suggestedCards.length > 0 && (
                          <div className="mt-2 grid grid-cols-2 gap-2">
                            {message.suggestedCards.map((card) => (
                              <div
                                key={card.id}
                                className="flex items-center gap-2 p-2 rounded-md bg-card border"
                              >
                                <Image
                                  width={80}
                                  height={120}
                                  src={
                                    card.card_images[0].image_url_small ||
                                    "/placeholder.svg"
                                  }
                                  alt={card.name}
                                  className="w-10 h-auto object-contain"
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

                      <div className="text-xs text-muted-foreground mt-1">
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
                  <div className="flex gap-3 max-w-[80%]">
                    <Avatar className="bg-muted">
                      <AvatarFallback>
                        <Bot className="h-4 w-4" />
                      </AvatarFallback>
                    </Avatar>

                    <div>
                      <div className="rounded-lg px-4 py-2 bg-muted">
                        <Loader2 className="h-4 w-4 animate-spin" />
                      </div>
                    </div>
                  </div>
                </div>
              )}

              <div ref={messagesEndRef} />
            </div>
          </ScrollArea>
        </CardContent>

        <CardFooter className="pt-4">
          <form
            className="flex w-full gap-2"
            onSubmit={(e) => {
              e.preventDefault();
              handleSendMessage();
            }}
          >
            <Input
              placeholder="Type your message..."
              value={input}
              onChange={(e) => setInput(e.target.value)}
              className="flex-1"
            />
            <Button type="submit" disabled={isLoading || input.trim() === ""}>
              <Send className="h-4 w-4" />
            </Button>
          </form>
        </CardFooter>
      </CardUI>
    </div>
  );
}
