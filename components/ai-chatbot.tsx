"use client"

import { useState, useRef, useEffect } from "react"
import { X, Send, Bot, User, Plus, Loader2, Badge } from "lucide-react"
import { useDeck } from "../context/deck-context.tsx";
import { Card } from "../types/card.ts";
import { Avatar, AvatarFallback } from "./ui/avatar.tsx";
import { Button } from "./ui/button.tsx";
import { Card as CardUI, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from "./ui/card.tsx";
import { Input } from "./ui/input.tsx";
import { ScrollArea } from "./ui/scroll-area.tsx";
import { getCardData } from "../lib/api.ts";
import { Image } from "@radix-ui/react-avatar";

interface Message {
  id: string
  role: "user" | "assistant"
  content: string
  timestamp: Date
  suggestedCards?: Card[]
}

interface AIChatbotProps {
  isOpen: boolean
  onClose: () => void
}

export default function AIChatbot({ isOpen, onClose }: AIChatbotProps) {
  const { currentDeck, addCardToDeck } = useDeck()
  const [messages, setMessages] = useState<Message[]>([
    {
      id: "welcome",
      role: "assistant",
      content:
        "Hello! I'm your Yu-Gi-Oh! deck assistant. Ask me about card synergies, deck improvements, or strategies!",
      timestamp: new Date(),
    },
  ])
  const [input, setInput] = useState("")
  const [isLoading, setIsLoading] = useState(false)
  const messagesEndRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    scrollToBottom()
  }, [messages])

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" })
  }

  const handleSendMessage = () => {
    if (input.trim() === "") return

    const userMessage: Message = {
      id: crypto.randomUUID(),
      role: "user",
      content: input,
      timestamp: new Date(),
    }

    setMessages((prev) => [...prev, userMessage])
    setInput("")
    setIsLoading(true)

    // Simulate AI processing
    setTimeout(async () => {
      const response = await generateAIResponse(userMessage.content)
      setMessages((prev) => [...prev, response])
      setIsLoading(false)
    }, 1500)
  }

  const generateAIResponse = async (userMessage: string): Promise<Message> => {
    const message: Message = {
      id: crypto.randomUUID(),
      role: "assistant",
      content: "",
      timestamp: new Date(),
    }

    const lowerCaseMessage = userMessage.toLowerCase()

    // Check for synergy-related questions
    if (
      lowerCaseMessage.includes("synergy") ||
      lowerCaseMessage.includes("work with") ||
      lowerCaseMessage.includes("combo")
    ) {
      // Extract card names or archetypes from the message
      let searchTerm = ""

      if (lowerCaseMessage.includes("dark magician")) {
        searchTerm = "Dark Magician"
        message.content =
          "Dark Magician decks benefit from cards that specifically support the archetype. Here are some great synergy cards for Dark Magician:"

        // Suggest specific cards
        const suggestedCards = await getCardData({ name: searchTerm, sort: "name" })
        message.suggestedCards = suggestedCards.slice(0, 5)
      } else if (lowerCaseMessage.includes("blue-eyes") || lowerCaseMessage.includes("blue eyes")) {
        searchTerm = "Blue-Eyes"
        message.content =
          "Blue-Eyes White Dragon decks focus on summoning powerful dragons and overwhelming your opponent. Here are some cards that synergize well with Blue-Eyes:"

        // Suggest specific cards
        const suggestedCards = await getCardData({ archetype: searchTerm, sort: "name" })
        message.suggestedCards = suggestedCards.slice(0, 5)
      } else if (lowerCaseMessage.includes("red-eyes") || lowerCaseMessage.includes("red eyes")) {
        searchTerm = "Red-Eyes"
        message.content =
          "Red-Eyes decks focus on fusion summoning and burn damage. Here are some cards that work well with Red-Eyes:"

        // Suggest specific cards
        const suggestedCards = await getCardData({ archetype: searchTerm, sort: "name" })
        message.suggestedCards = suggestedCards.slice(0, 5)
      } else {
        // Generic synergy advice
        message.content =
          "Based on your current deck composition, I recommend focusing on these synergies:\n\n" +
          "1. Balance your monster-to-spell/trap ratio (aim for roughly 20-24 monsters, 10-12 spells, and 6-8 traps)\n" +
          "2. Include cards that can search for your key combo pieces\n" +
          "3. Add protection cards to prevent your strategy from being disrupted\n\n" +
          "Would you like me to suggest specific cards for your deck?"
      }
    }
    // Check for improvement questions
    else if (
      lowerCaseMessage.includes("improve") ||
      lowerCaseMessage.includes("better") ||
      lowerCaseMessage.includes("strengthen")
    ) {
      const stats = getDeckStats()

      if (stats.mainCount < 40) {
        message.content =
          "Your deck currently has only " +
          stats.mainCount +
          " cards in the Main Deck. You should add at least " +
          (40 - stats.mainCount) +
          " more cards to reach the minimum of 40.\n\n" +
          "I recommend adding more of these card types:\n"

        if (stats.monsterCount < 20) {
          message.content += "- Monster cards (aim for 20-24 total)\n"
        }
        if (stats.spellCount < 10) {
          message.content += "- Spell cards (aim for 10-12 total)\n"
        }
        if (stats.trapCount < 6) {
          message.content += "- Trap cards (aim for 6-8 total)\n"
        }
      } else {
        message.content =
          "Here are some ways to improve your deck:\n\n" +
          "1. Focus on a clear win condition or strategy\n" +
          "2. Reduce the number of 'one-of' cards and include more copies of your key cards\n" +
          "3. Add more draw power and search effects\n" +
          "4. Include cards that can deal with your opponent's threats\n\n" +
          "Would you like specific recommendations based on your current deck?"
      }
    }
    // Check for meta questions
    else if (
      lowerCaseMessage.includes("meta") ||
      lowerCaseMessage.includes("competitive") ||
      lowerCaseMessage.includes("tournament")
    ) {
      message.content =
        "The current competitive Yu-Gi-Oh! meta features these top strategies:\n\n" +
        "Tier 1 (Most Competitive):\n" +
        "- Spright\n" +
        "- Tearlaments\n" +
        "- Floowandereeze\n\n" +
        "Tier 2 (Strong Contenders):\n" +
        "- Sky Striker\n" +
        "- Branded Despia\n" +
        "- Swordsoul Tenyi\n\n" +
        "These decks are considered strong due to their consistency, ability to play through disruption, and powerful end boards."
    }
    // Check for deck rating questions
    else if (
      lowerCaseMessage.includes("rate") ||
      lowerCaseMessage.includes("evaluate") ||
      lowerCaseMessage.includes("grade")
    ) {
      const tier = evaluateDeckTier()
      let tierDescription = ""

      switch (tier) {
        case 1:
          tierDescription = "Tier 1 - Meta Competitive"
          break
        case 2:
          tierDescription = "Tier 2 - Strong Contender"
          break
        case 3:
          tierDescription = "Tier 3 - Rogue Strategy"
          break
        default:
          tierDescription = "Tier 4 - Casual"
      }

      message.content = `Based on my analysis, your deck rates as: **${tierDescription}**\n\n`

      const stats = getDeckStats()
      const playStyle = determinePlayStyle()

      message.content +=
        `**Deck Composition:**\n` +
        `- ${stats.monsterCount} Monsters\n` +
        `- ${stats.spellCount} Spells\n` +
        `- ${stats.trapCount} Traps\n\n` +
        `**Play Style:** ${playStyle.join(", ")}\n\n`

      // Add strengths and weaknesses
      message.content += "**Strengths:**\n"
      if (stats.monsterCount >= 20) {
        message.content += "- Good monster count\n"
      }
      if (stats.spellCount >= 10) {
        message.content += "- Solid spell lineup\n"
      }
      if (stats.trapCount >= 6) {
        message.content += "- Decent trap protection\n"
      }

      message.content += "\n**Areas for Improvement:**\n"
      if (stats.mainCount < 40) {
        message.content += "- Add more cards to reach the 40 card minimum\n"
      }
      if (stats.monsterCount < 20) {
        message.content += "- Add more monsters for consistency\n"
      }
      if (stats.spellCount < 10) {
        message.content += "- Include more spells for utility\n"
      }
      if (stats.trapCount < 6) {
        message.content += "- Consider adding more traps for protection\n"
      }
    }
    // Default response
    else {
      message.content =
        "I'm here to help with your Yu-Gi-Oh! deck building! You can ask me about:\n\n" +
        "- Card synergies and combos\n" +
        "- Deck improvement suggestions\n" +
        "- Current meta strategies\n" +
        "- Evaluating your deck's competitive potential\n\n" +
        "What would you like to know about your deck?"
    }

    return message
  }

  const getDeckStats = () => {
    const { mainDeck } = currentDeck

    const monsterCount = mainDeck.filter((card) => card.type.includes("Monster")).length
    const spellCount = mainDeck.filter((card) => card.type.includes("Spell")).length
    const trapCount = mainDeck.filter((card) => card.type.includes("Trap")).length

    return {
      mainCount: mainDeck.length,
      monsterCount,
      spellCount,
      trapCount,
    }
  }

  const determinePlayStyle = () => {
    const { mainDeck } = currentDeck
    const stats = getDeckStats()
    const playStyles: string[] = []

    // Check for aggro style (high ATK monsters, low spell/trap count)
    if (stats.monsterCount > 25 && stats.monsterCount / stats.mainCount > 0.6) {
      playStyles.push("Aggro")
    }

    // Check for control style (high trap count)
    if (stats.trapCount > 10 && stats.trapCount / stats.mainCount > 0.2) {
      playStyles.push("Control")
    }

    // Check for combo style (cards with similar effects or archetypes)
    const archetypes = new Map<string, number>()
    mainDeck.forEach((card) => {
      if (card.archetype) {
        archetypes.set(card.archetype, (archetypes.get(card.archetype) || 0) + 1)
      }
    })

    // If any archetype has more than 8 cards, it's likely a combo deck
    for (const [, count] of Array.from(archetypes.entries())) {
      if (count >= 8) {
        playStyles.push("Combo")
        break
      }
    }

    // Check for midrange style (balanced monster/spell/trap ratio)
    if (
      stats.monsterCount / stats.mainCount > 0.4 &&
      stats.monsterCount / stats.mainCount < 0.6 &&
      stats.spellCount / stats.mainCount > 0.25
    ) {
      playStyles.push("Midrange")
    }

    // If no specific style is detected, mark as "Balanced"
    if (playStyles.length === 0 && stats.mainCount > 30) {
      playStyles.push("Balanced")
    }

    // Add "Incomplete" tag if deck is too small
    if (stats.mainCount < 40) {
      playStyles.push("Incomplete")
    }

    return playStyles
  }

  const evaluateDeckTier = () => {
    const { mainDeck } = currentDeck
    const stats = getDeckStats()

    if (stats.mainCount < 30) {
      return 4 // Casual - not enough cards
    }

    // Check for powerful archetypes (simplified example)
    const archetypes = new Map<string, number>()
    mainDeck.forEach((card) => {
      if (card.archetype) {
        archetypes.set(card.archetype, (archetypes.get(card.archetype) || 0) + 1)
      }
    })

    const hasPowerfulArchetype = Array.from(archetypes.keys()).some((archetype) =>
      ["Sky Striker", "Eldlich", "Drytron", "Tri-Brigade", "Swordsoul"].includes(archetype),
    )

    // Check for balanced composition
    const hasBalancedComposition = stats.monsterCount >= 16 && stats.spellCount >= 10 && stats.trapCount >= 5

    // Simplified tier evaluation
    if (hasPowerfulArchetype && hasBalancedComposition && stats.mainCount >= 40) {
      return 1 // Tier 1 - Meta
    } else if ((hasPowerfulArchetype || hasBalancedComposition) && stats.mainCount >= 40) {
      return 2 // Tier 2 - Competitive
    } else if (stats.mainCount >= 40) {
      return 3 // Tier 3 - Rogue
    } else {
      return 4 // Tier 4 - Casual
    }
  }

  const handleAddCardToDeck = (card: Card) => {
    const isExtraDeckCard =
      card.type.includes("Fusion") ||
      card.type.includes("Synchro") ||
      card.type.includes("Xyz") ||
      card.type.includes("Link")

    addCardToDeck(card, isExtraDeckCard ? "extraDeck" : "mainDeck")
  }

  if (!isOpen) return null

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
          <CardDescription>Ask about card synergies, deck improvements, or strategies</CardDescription>
        </CardHeader>

        <CardContent className="flex-1 overflow-hidden p-0">
          <ScrollArea className="h-full px-4">
            <div className="space-y-4 py-4">
              {messages.map((message) => (
                <div key={message.id} className={`flex ${message.role === "user" ? "justify-end" : "justify-start"}`}>
                  <div className={`flex gap-3 max-w-[80%] ${message.role === "user" ? "flex-row-reverse" : ""}`}>
                    <Avatar className={message.role === "user" ? "bg-primary" : "bg-muted"}>
                      <AvatarFallback>
                        {message.role === "user" ? <User className="h-4 w-4" /> : <Bot className="h-4 w-4" />}
                      </AvatarFallback>
                    </Avatar>

                    <div>
                      <div
                        className={`rounded-lg px-4 py-2 ${message.role === "user" ? "bg-primary text-primary-foreground" : "bg-muted"
                          }`}
                      >
                        <div className="whitespace-pre-line text-sm">{message.content}</div>
                      </div>

                      {message.suggestedCards && message.suggestedCards.length > 0 && (
                        <div className="mt-2 grid grid-cols-2 gap-2">
                          {message.suggestedCards.map((card) => (
                            <div key={card.id} className="flex items-center gap-2 p-2 rounded-md bg-card border">
                              <Image
                                width={80}
                                height={120}
                                src={card.card_images[0].image_url_small || "/placeholder.svg"}
                                alt={card.name}
                                className="w-10 h-auto object-contain"
                              />
                              <div className="flex-1 min-w-0">
                                <p className="text-xs font-medium truncate">{card.name}</p>
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
                        {message.timestamp.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
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
              e.preventDefault()
              handleSendMessage()
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
  )
}
