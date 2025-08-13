import React from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { CardPreview } from "./card-preview";
import { Badge } from "./badge";
import { Button } from "./button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "./select";
import Image from "next/image";
import { Card } from "@/types/card";
import { BanStatus, DeckSection } from "@/types/types";
import { Plus, Loader2, Check } from "lucide-react";

interface AIResponseCardProps {
  content: string;
  suggestedCards: Card[];
  banlist?: Record<string, BanStatus>;
  currentDeckMode?: string;
  addingCardId?: string | null;
  addedCards?: Set<string>;
  canAddCardToDeck?: (card: Card, deckType: DeckSection) => boolean;
  getOptimalDeckType?: (card: Card) => DeckSection;
  handleAddCardToDeck?: (card: Card, selectedDeckType?: DeckSection) => void;
}

// Helper to parse simple AI output by section titles
// const parseSections = (content: string) => {
//   const sections: Record<string, string> = {};
//   let current = "Summary";
//   sections[current] = "";

//   content.split("\n").forEach(line => {
//     const trimmed = line.trim();
//     if (/^(\*\*|##?)\s*(.+?):\s*\*\*$/.test(trimmed)) {
//       // E.g. "**Suggestions:**"
//       const [, , sectionName] = trimmed.match(/^(\*\*|##?)\s*(.+?):\s*\*\*$/) || [];
//       if (sectionName) {
//         current = sectionName;
//         sections[current] = "";
//         return;
//       }
//     }
//     else if (trimmed.startsWith("**") && trimmed.endsWith("**")) {
//       current = trimmed.replace(/\*/g, "");
//       sections[current] = "";
//       return;
//     }
//     sections[current] += line + "\n";
//   });
//   return sections;
// };

export function AIResponseCard({ 
  content, 
  suggestedCards = [],
  banlist = {},
  currentDeckMode = "Master Duel",
  addingCardId = null,
  addedCards = new Set(),
  canAddCardToDeck,
  getOptimalDeckType,
  handleAddCardToDeck
}: AIResponseCardProps) {
  // Create a map for quick card lookup by name
  const cardMap = new Map<string, Card>();
  suggestedCards.forEach(card => {
    cardMap.set(card.name.toLowerCase(), card);
  });

  // Pre-process content to remove colons after card names that will have previews
  const processedContent = content.replace(/\*\*([^*]+)\*\*:/g, (match, cardName) => {
    const lowerCardName = cardName.toLowerCase();
    if (cardMap.has(lowerCardName)) {
      return `**${cardName}**`; // Remove the colon
    }
    return match; // Keep the colon if it's not a card name
  });

  // Function to render card preview component
  const renderCardPreview = (card: Card) => {
    const cardId = card.id.toString();
    const banStatus = banlist[card.name] || "Unlimited";
    const optimalDeckType = getOptimalDeckType ? getOptimalDeckType(card) : "mainDeck";
    const canAdd = canAddCardToDeck ? canAddCardToDeck(card, optimalDeckType) : false;
    const isAdding = addingCardId === cardId;
    const wasAdded = addedCards.has(cardId);

    return (
      <CardPreview
        key={card.id}
        card={card}
        banStatus={banStatus}
      >
        <div
          className={`flex items-center gap-3 p-3 rounded-xl border transition-all duration-200 my-2 ${
            canAdd
              ? "bg-card border-border hover:border-accent hover:shadow-md cursor-pointer"
              : "bg-muted/50 border-muted opacity-60 cursor-not-allowed"
          }`}
        >
          <div className="flex-shrink-0">
            <Image
              width={60}
              height={88}
              src={
                card.card_images[0]?.image_url_small ||
                "/placeholder.svg"
              }
              alt={card.name}
              className="w-12 h-auto object-contain rounded-md shadow-sm"
            />
          </div>

          <div className="flex-1 min-w-0 space-y-1">
            <h4 className="text-sm font-medium truncate text-card-foreground">
              {card.name}
            </h4>
            <div className="flex flex-wrap gap-1">
              <Badge variant="outline" className="text-xs">
                {card.type}
              </Badge>
              {banStatus !== "Unlimited" && (
                <Badge
                  className={`text-xs ${
                    banStatus === "Forbidden"
                      ? "bg-red-500"
                      : banStatus === "Limited"
                      ? "bg-yellow-500 text-black"
                      : "bg-orange-500"
                  }`}
                >
                  {banStatus}
                </Badge>
              )}
            </div>
            <div className="flex items-center gap-2">
              {currentDeckMode === "TCG" ? (
                <Select
                  defaultValue={optimalDeckType}
                  disabled={!canAdd || isAdding}
                  onValueChange={(value: DeckSection) => {
                    if (canAddCardToDeck && canAddCardToDeck(card, value) && handleAddCardToDeck) {
                      handleAddCardToDeck(card, value);
                    }
                  }}
                >
                  <SelectTrigger className="h-7 w-24 text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="mainDeck">Main</SelectItem>
                    <SelectItem value="extraDeck">Extra</SelectItem>
                    <SelectItem value="sideDeck">Side</SelectItem>
                  </SelectContent>
                </Select>
              ) : (
                <span className="text-xs text-muted-foreground">
                  → {optimalDeckType === "mainDeck" ? "Main" : "Extra"} Deck
                </span>
              )}
              {!canAdd && (
                <span className="text-xs text-muted-foreground">
                  {banStatus === "Forbidden" ? "Forbidden" : "Limit reached"}
                </span>
              )}
            </div>
          </div>

          <div className="flex-shrink-0">
            <Button
              variant={wasAdded ? "default" : "ghost"}
              size="sm"
              className="h-8 w-8 p-0"
              disabled={!canAdd || isAdding}
              onClick={() => handleAddCardToDeck && handleAddCardToDeck(card)}
            >
              {isAdding ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : wasAdded ? (
                <Check className="h-4 w-4" />
              ) : (
                <Plus className="h-4 w-4" />
              )}
            </Button>
          </div>
        </div>
      </CardPreview>
    );
  };

  return (
    <div className="space-y-4">
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          strong({ children }) {
            const text = String(children);
            const lowerText = text.toLowerCase();
            
            // Check if this bold text matches a suggested card name
            const matchedCard = cardMap.get(lowerText);
            
            if (matchedCard) {
              return (
                <div className="inline-block w-full">
                  <strong className="text-primary font-semibold">{text}</strong>
                  {renderCardPreview(matchedCard)}
                </div>
              );
            }
            
            return <strong className="text-primary font-semibold">{text}</strong>;
          },
          // Add spacing between paragraphs and sections
          p({ children }) {
            return <p className="mb-3 leading-relaxed">{children}</p>;
          },
          // Add spacing for headings
          h1({ children }) {
            return <h1 className="text-xl font-bold mb-3 mt-6">{children}</h1>;
          },
          h2({ children }) {
            return <h2 className="text-lg font-semibold mb-3 mt-5">{children}</h2>;
          },
          h3({ children }) {
            return <h3 className="text-base font-medium mb-2 mt-4">{children}</h3>;
          },
          // Add spacing for lists
          ul({ children }) {
            return <ul className="mb-3 space-y-1 pl-4">{children}</ul>;
          },
          ol({ children }) {
            return <ol className="mb-3 space-y-1 pl-4">{children}</ol>;
          },
        }}
      >
        {processedContent}
      </ReactMarkdown>
    </div>
  );
}
