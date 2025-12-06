"use client";

import React from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { CardPreview } from "./card-preview";
import { Badge } from "./badge";
import { Button } from "./button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "./select";
import Image from "next/image";
import { Card } from "../../types/card";
import { BanStatus, DeckSection } from "../../types/types";
import { Plus, Loader2, Check } from "lucide-react";
import { getArchetypeName } from "../../lib/helpers";
import CutCornerWrapper from "../cut-corner-wrapper";

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

interface AIResponseCardProps {
  content: string;
  suggestedCards?: Card[]; // Recommended cards to render as stacks
  cardSuggestionsMeta?: CardSuggestionMeta[]; // Optional metadata for card suggestions
  candidateCards?: CandidateCard[]; // Candidate cards list for card suggestions
  banlist?: Record<string, BanStatus>;
  currentDeckMode?: string;
  addingCardId?: string | null;
  addedCards?: Set<string>;
  canAddCardToDeck?: (card: Card, deckType: DeckSection) => boolean;
  getOptimalDeckType?: (card: Card) => DeckSection;
  handleAddCardToDeck?: (card: Card, selectedDeckType?: DeckSection) => void;
  allCards?: Card[]; // All cards for keyword highlighting
  isCardSuggestionMode?: boolean; // Flag to indicate card suggestion mode
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

// Keywords to highlight in custom text responses
const KEYWORDS_TO_HIGHLIGHT = {
  // Effect words
  effects: [
    "banish",
    "negate",
    "destroy",
    "draw",
    "special summon",
    "tribute",
    "discard",
    "add",
    "send",
    "reveal",
    "target",
    "activate",
  ],
  // Extra deck types
  extraDeckTypes: ["fusion", "synchro", "xyz", "link", "ritual", "pendulum"],
  // Attributes
  attributes: ["dark", "light", "earth", "water", "fire", "wind", "divine"],
  // Card types
  cardTypes: [
    "monster",
    "spell",
    "trap",
    "normal",
    "effect",
    "ritual",
    "fusion",
    "synchro",
    "xyz",
    "pendulum",
    "link",
    "tuner",
    "union",
    "gemini",
    "spirit",
    "toon",
    "flip",
  ],
};

// Helper function to highlight keywords in text
function highlightKeywords(text: string, allCards: Card[]): string {
  // Create a map of all card names for matching
  const allCardNames = new Set<string>();
  allCards.forEach((card) => {
    allCardNames.add(card.name.toLowerCase());
    const archetypeName = getArchetypeName(card);
    if (archetypeName) {
      allCardNames.add(archetypeName.toLowerCase());
    }
  });

  let highlighted = text;

  // First, protect already bolded card names
  const boldedCardNames: string[] = [];
  highlighted = highlighted.replace(/\*\*([^*]+)\*\*/g, (_match, cardName) => {
    boldedCardNames.push(cardName);
    return `__BOLDED_${boldedCardNames.length - 1}__`;
  });

  // Highlight card names (not already bolded)
  allCardNames.forEach((cardName) => {
    const regex = new RegExp(
      `\\b${cardName.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`,
      "gi",
    );
    highlighted = highlighted.replace(regex, (match) => {
      // Check if this is already protected
      if (match.includes("__BOLDED_")) return match;
      return `**${match}**`;
    });
  });

  // Use shared helper from lib/helpers

  // Highlight archetype names
  allCards.forEach((card) => {
    const archetypeName = getArchetypeName(card);
    if (archetypeName) {
      const archetypeRegex = new RegExp(
        `\\b${archetypeName.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`,
        "gi",
      );
      highlighted = highlighted.replace(archetypeRegex, (match) => {
        if (match.includes("__BOLDED_") || match.startsWith("**")) return match;
        return `*${match}*`; // Italic for archetypes
      });
    }
  });

  // Highlight effect words
  KEYWORDS_TO_HIGHLIGHT.effects.forEach((effect) => {
    const regex = new RegExp(`\\b${effect}\\b`, "gi");
    highlighted = highlighted.replace(regex, (match) => {
      if (
        match.includes("__BOLDED_") ||
        match.startsWith("**") ||
        match.startsWith("*")
      )
        return match;
      return `\`${match}\``; // Code style for effect words
    });
  });

  // Highlight extra deck types
  KEYWORDS_TO_HIGHLIGHT.extraDeckTypes.forEach((type) => {
    const regex = new RegExp(`\\b${type}\\b`, "gi");
    highlighted = highlighted.replace(regex, (match) => {
      if (
        match.includes("__BOLDED_") ||
        match.startsWith("**") ||
        match.startsWith("*") ||
        match.startsWith("`")
      )
        return match;
      return `\`${match}\``;
    });
  });

  // Restore protected bolded card names
  boldedCardNames.forEach((cardName, index) => {
    highlighted = highlighted.replace(`__BOLDED_${index}__`, `**${cardName}**`);
  });

  return highlighted;
}

// Component to render markdown with highlighted card names (no previews)
function MarkdownWithCardPreviews({
  content,
  suggestedCards = [],
  allCards = [],
}: {
  content: string;
  suggestedCards?: Card[];
  allCards?: Card[];
}) {
  // Create a map of card names to cards for quick lookup
  // Prioritize suggestedCards, but also include allCards for comprehensive matching
  // This ensures cards mentioned in markdown can be matched even if not in suggestedCards
  const nameToCardMap = React.useMemo(() => {
    const map = new Map<string, Card>();

    // First, add suggestedCards (these are the recommended cards)
    suggestedCards.forEach((card) => {
      // Normalize card name: lowercase and trim whitespace
      const normalizedName = card.name.toLowerCase().trim();
      map.set(normalizedName, card);
      // Also add exact name for direct matches
      map.set(card.name, card);
      // Add trimmed version of original name
      map.set(card.name.trim(), card);
    });

    // Then, add allCards to supplement (only if not already in map)
    // This allows matching any card mentioned in bold, even if not in suggestedCards
    allCards.forEach((card) => {
      const normalizedName = card.name.toLowerCase().trim();
      // Only add if not already present (suggestedCards take priority)
      if (!map.has(normalizedName)) {
        map.set(normalizedName, card);
        // Also add exact name if not present
        if (!map.has(card.name)) {
          map.set(card.name, card);
        }
        // Add trimmed version if not present
        const trimmedName = card.name.trim();
        if (!map.has(trimmedName)) {
          map.set(trimmedName, card);
        }
      }
    });

    return map;
  }, [suggestedCards, allCards]);

  // Helper to extract text content from React nodes
  const extractTextContent = React.useCallback(
    (node: React.ReactNode): string => {
      if (node === null || node === undefined) {
        return "";
      }
      if (typeof node === "string") {
        return node;
      }
      if (typeof node === "number") {
        return String(node);
      }
      if (typeof node === "boolean") {
        return "";
      }
      if (React.isValidElement(node)) {
        if (node.props && node.props.children !== undefined) {
          return React.Children.toArray(node.props.children)
            .map(extractTextContent)
            .join("");
        }
        return "";
      }
      if (Array.isArray(node)) {
        return node.map(extractTextContent).join("");
      }
      // Fallback for objects - try to get a string representation
      try {
        return String(node);
      } catch {
        return "";
      }
    },
    [],
  );

  return (
    <ReactMarkdown
      remarkPlugins={[remarkGfm]}
      components={{
        strong({ children }) {
          // Extract text from children - handle all possible types
          const text = extractTextContent(children);
          const trimmedText = text.trim();

          if (!trimmedText || nameToCardMap.size === 0) {
            return (
              <strong className="text-primary font-semibold">{children}</strong>
            );
          }

          const normalizedText = trimmedText.toLowerCase();

          // Check if this bold text matches a recommended card name
          // Try normalized match first (most common case)
          let matchedCard = nameToCardMap.get(normalizedText);
          // Fallback to exact match
          if (!matchedCard) {
            matchedCard = nameToCardMap.get(trimmedText);
          }

          if (matchedCard) {
            // Just show as highlighted text, no card preview
            return (
              <strong className="text-cyan-400 font-semibold">
                {trimmedText}
              </strong>
            );
          }

          return (
            <strong className="text-primary font-semibold">{children}</strong>
          );
        },
        // Highlight italic text (archetypes, meta decks)
        em({ children }) {
          const text = extractTextContent(children);
          return (
            <em className="text-cyan-400 font-medium border-b border-cyan-500/30 px-1">
              {text}
            </em>
          );
        },
        // Highlight code text (effect words, extra deck types)
        code({ children, className }) {
          const text = extractTextContent(children);
          return (
            <code
              className={`${className || ""} bg-cyan-500/10 text-cyan-300 border border-cyan-500/30 px-1.5 py-0.5 rounded text-xs font-mono`}
            >
              {text}
            </code>
          );
        },
        // Add spacing between paragraphs
        p({ children }) {
          return (
            <p className="mb-3 leading-relaxed text-slate-200">{children}</p>
          );
        },
        // Add spacing for headings
        h1({ children }) {
          return <h1 className="text-xl font-bold mb-3 mt-6">{children}</h1>;
        },
        h2({ children }) {
          return (
            <h2 className="text-lg font-semibold mb-3 mt-5">{children}</h2>
          );
        },
        h3({ children }) {
          return (
            <h3 className="text-base font-medium mb-2 mt-4">{children}</h3>
          );
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
      {content}
    </ReactMarkdown>
  );
}

export function AIResponseCard({
  content,
  suggestedCards = [],
  cardSuggestionsMeta = [],
  candidateCards = [],
  banlist = {},
  currentDeckMode = "Master Duel",
  addingCardId = null,
  addedCards = new Set(),
  canAddCardToDeck,
  getOptimalDeckType,
  handleAddCardToDeck,
  allCards = [],
  isCardSuggestionMode = false,
}: AIResponseCardProps) {
  // In card suggestion mode, only render cards from suggestedCards
  // Don't scan markdown for card names to create stacks
  // DO NOT scan Markdown for card names in card_suggestions mode
  // ONLY use suggestedCards from the API response

  // Filter out forbidden cards from suggestedCards
  const allowedSuggestedCards = suggestedCards.filter((card) => {
    const banStatus = banlist[card.name] || "Unlimited";
    return banStatus !== "Forbidden";
  });

  // Create a map for quick card lookup by name
  const cardMap = new Map<string, Card>();
  allowedSuggestedCards.forEach((card) => {
    cardMap.set(card.name.toLowerCase(), card);
  });

  // Also add allCards to the map for comprehensive matching (for highlighting only)
  if (!isCardSuggestionMode) {
    allCards.forEach((card) => {
      if (!cardMap.has(card.name.toLowerCase())) {
        cardMap.set(card.name.toLowerCase(), card);
      }
    });
  }

  // Pre-process content to remove colons after card names that will have previews
  // Only do this if NOT in card suggestion mode (where we don't want to auto-detect cards from text)
  let processedContent = content;
  if (!isCardSuggestionMode) {
    // Remove common introductory phrases
    processedContent = processedContent.replace(
      /^(Based on your question,?\s*)?(I\s+)?(recommend|suggest|would\s+recommend|would\s+suggest)[:.]?\s*/gim,
      "",
    );
    processedContent = processedContent.replace(
      /^(Here\s+are\s+)?(some\s+)?(recommendations|suggestions)[:.]?\s*/gim,
      "",
    );

    processedContent = processedContent.replace(
      /\*\*([^*]+)\*\*:/g,
      (match, cardName) => {
        const lowerCardName = cardName.toLowerCase();
        if (cardMap.has(lowerCardName)) {
          return `**${cardName}**`; // Remove the colon
        }
        return match; // Keep the colon if it's not a card name
      },
    );
  }

  // Format recommendations as numbered list (1, 2, 3...)
  // This processes the content to show only one card title per recommendation
  if (!isCardSuggestionMode && allowedSuggestedCards.length > 0) {
    // Create a map of card names to their index in suggestedCards (ordered by appearance)
    const cardNameToIndex = new Map<string, number>();
    allowedSuggestedCards.forEach((card, index) => {
      cardNameToIndex.set(card.name.toLowerCase().trim(), index + 1);
    });

    // Track which cards we've already numbered to avoid duplicates
    const numberedCards = new Set<string>();

    // First, remove duplicate card names that appear with dashes and numbers (with or without bold)
    // Handle various patterns: "Card Name - X. Card Name", "**Card Name** - X. **Card Name**", etc.
    allowedSuggestedCards.forEach((card) => {
      const cardName = card.name;
      const escapedCardName = cardName.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      const lowerCardName = cardName.toLowerCase().trim();
      const correctIndex = cardNameToIndex.get(lowerCardName);
      if (!correctIndex) return;

      // Pattern 1: "**Card Name** - X. **Card Name**" (with bold, with dash)
      const boldPattern1 = new RegExp(
        `\\*\\*${escapedCardName}\\*\\*\\s*-\\s*\\d+\\.\\s*\\*\\*${escapedCardName}\\*\\*`,
        "gi",
      );
      processedContent = processedContent.replace(boldPattern1, (match) => {
        if (!numberedCards.has(lowerCardName)) {
          numberedCards.add(lowerCardName);
          return `${correctIndex}. **${cardName}**`;
        }
        return match;
      });

      // Pattern 2: "Card Name - X. Card Name" (without bold, with dash)
      const plainPattern1 = new RegExp(
        `${escapedCardName}\\s*-\\s*\\d+\\.\\s*${escapedCardName}`,
        "gi",
      );
      processedContent = processedContent.replace(plainPattern1, (match) => {
        if (!numberedCards.has(lowerCardName)) {
          numberedCards.add(lowerCardName);
          return `${correctIndex}. ${cardName}`;
        }
        return match;
      });

      // Pattern 3: "**Card Name** X. **Card Name**" (with bold, without dash)
      const boldPattern2 = new RegExp(
        `\\*\\*${escapedCardName}\\*\\*\\s+\\d+\\.\\s*\\*\\*${escapedCardName}\\*\\*`,
        "gi",
      );
      processedContent = processedContent.replace(boldPattern2, (match) => {
        if (!numberedCards.has(lowerCardName)) {
          numberedCards.add(lowerCardName);
          return `${correctIndex}. **${cardName}**`;
        }
        return match;
      });

      // Pattern 4: "Card Name X. Card Name" (without bold, without dash)
      const plainPattern2 = new RegExp(
        `${escapedCardName}\\s+\\d+\\.\\s*${escapedCardName}`,
        "gi",
      );
      processedContent = processedContent.replace(plainPattern2, (match) => {
        if (!numberedCards.has(lowerCardName)) {
          numberedCards.add(lowerCardName);
          return `${correctIndex}. ${cardName}`;
        }
        return match;
      });

      // Pattern 5: "Card Name - Card Name" (duplicate without number, with dash)
      const duplicatePattern1 = new RegExp(
        `${escapedCardName}\\s*-\\s*${escapedCardName}`,
        "gi",
      );
      processedContent = processedContent.replace(
        duplicatePattern1,
        (match) => {
          if (!numberedCards.has(lowerCardName)) {
            numberedCards.add(lowerCardName);
            return `${correctIndex}. ${cardName}`;
          }
          return match;
        },
      );

      // Pattern 6: "**Card Name** - **Card Name**" (duplicate with bold, with dash)
      const duplicatePattern2 = new RegExp(
        `\\*\\*${escapedCardName}\\*\\*\\s*-\\s*\\*\\*${escapedCardName}\\*\\*`,
        "gi",
      );
      processedContent = processedContent.replace(
        duplicatePattern2,
        (match) => {
          if (!numberedCards.has(lowerCardName)) {
            numberedCards.add(lowerCardName);
            return `${correctIndex}. **${cardName}**`;
          }
          return match;
        },
      );
    });

    // Now add numbers to card names that don't have them yet (in order of appearance in suggestedCards)
    // Process in order to maintain correct numbering
    const cardOrder = allowedSuggestedCards.map((card, idx) => ({
      name: card.name,
      lowerName: card.name.toLowerCase().trim(),
      index: idx + 1,
    }));

    cardOrder.forEach(({ name, lowerName, index }) => {
      if (numberedCards.has(lowerName)) return;

      // Pattern: "**Card Name** is/would/can..." -> "1. **Card Name** is/would/can..."
      const pattern1 = new RegExp(
        `\\*\\*${name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\*\\*\\s+(is|would|can|works|provides|offers|adds|helps|improves|enhances|gives|makes|allows|enables|creates|generates|brings|supports|synergizes|combines|pairs|works well|fits|matches|complements|would be|can be|is an|is a)`,
        "gi",
      );
      processedContent = processedContent.replace(pattern1, (match, verb) => {
        if (!numberedCards.has(lowerName)) {
          numberedCards.add(lowerName);
          return `${index}. **${name}** ${verb}`;
        }
        return match;
      });

      // Pattern: "**Card Name**: reason" -> "1. **Card Name**: reason"
      const pattern2 = new RegExp(
        `\\*\\*${name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\*\\*:\\s*`,
        "g",
      );
      processedContent = processedContent.replace(pattern2, (match) => {
        if (!numberedCards.has(lowerName)) {
          numberedCards.add(lowerName);
          return `${index}. **${name}**: `;
        }
        return match;
      });
    });
  }

  // Apply keyword highlighting if allCards is provided (for custom analysis)
  // Skip highlighting in card suggestion mode to avoid highlighting card names in text
  if (allCards.length > 0 && !isCardSuggestionMode) {
    processedContent = highlightKeywords(processedContent, allCards);
  }

  // Function to render card preview component (inspired by card-stack.tsx)
  const renderCardPreview = (card: Card) => {
    const cardId = card.id.toString();
    const banStatus = banlist[card.name] || "Unlimited";
    const optimalDeckType = getOptimalDeckType
      ? getOptimalDeckType(card)
      : "mainDeck";
    const canAdd = canAddCardToDeck
      ? canAddCardToDeck(card, optimalDeckType)
      : false;
    const isAdding = addingCardId === cardId;
    const wasAdded = addedCards.has(cardId);

    const getBanStatusColor = (status: BanStatus) => {
      switch (status) {
        case "Forbidden":
          return "bg-red-500 text-white";
        case "Limited":
          return "bg-yellow-500 text-black";
        case "Semi-Limited":
          return "bg-orange-500 text-white";
        default:
          return "bg-green-500 text-white";
      }
    };

    // Render card content directly - CardPreview wraps only the image for tooltip
    return (
      <div
        className={`p-3 border-b border-cyan-500/20 hover:bg-slate-900/40 transition-colors ${
          !canAdd ? "opacity-60 cursor-not-allowed" : "cursor-pointer"
        }`}
      >
        <div className="flex gap-3 items-center">
          {/* Card Image with Preview */}
          <CardPreview card={card} banStatus={banStatus}>
            <div className="relative w-12 h-[72px] flex-shrink-0 flex items-center justify-center cursor-pointer">
              <Image
                width={80}
                height={120}
                src={card.card_images[0]?.image_url || "/placeholder.svg"}
                alt={card.name}
                className="w-full h-auto object-contain rounded shadow-sm"
              />
            </div>
          </CardPreview>

          {/* Card Info */}
          <div className="flex-1 min-w-0">
            <h4 className="font-medium text-sm truncate text-slate-50">
              {card.name}
            </h4>
            <div className="flex flex-wrap gap-1 mt-1.5">
              <Badge
                variant="outline"
                className="text-xs border-cyan-500/50 text-cyan-300"
              >
                {card.type}
              </Badge>
              {card.attribute && (
                <Badge
                  variant="outline"
                  className="text-xs border-cyan-500/50 text-cyan-300"
                >
                  {card.attribute}
                </Badge>
              )}
              {banStatus !== "Unlimited" && (
                <Badge className={`text-xs ${getBanStatusColor(banStatus)}`}>
                  {banStatus}
                </Badge>
              )}
            </div>
            <p className="text-xs text-slate-400 mt-1.5 line-clamp-2">
              {card.desc}
            </p>
            <div className="flex items-center gap-2 mt-2">
              {currentDeckMode === "TCG" ? (
                <Select
                  defaultValue={optimalDeckType}
                  disabled={!canAdd || isAdding}
                  onValueChange={(value: DeckSection) => {
                    if (
                      canAddCardToDeck &&
                      canAddCardToDeck(card, value) &&
                      handleAddCardToDeck
                    ) {
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
                <span className="text-xs text-slate-400">
                  → {optimalDeckType === "mainDeck" ? "Main" : "Extra"} Deck
                </span>
              )}
              {!canAdd && (
                <span className="text-xs text-slate-400">
                  {banStatus === "Forbidden" ? "Forbidden" : "Limit reached"}
                </span>
              )}
            </div>
          </div>

          {/* Add Button */}
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
      </div>
    );
  };

  // Create a map of candidateId to suggestion metadata
  const suggestionMetaMap = new Map<number, CardSuggestionMeta>();
  cardSuggestionsMeta.forEach((meta) => {
    suggestionMetaMap.set(meta.candidateId, meta);
  });

  // Create a map of card name to candidate card for synergy lookups
  const candidateCardMap = new Map<string, CandidateCard>();
  candidateCards.forEach((candidate) => {
    candidateCardMap.set(candidate.name.toLowerCase(), candidate);
  });

  return (
    <div className="space-y-4">
      {/* In card suggestion mode, render recommended cards as stacks */}
      {isCardSuggestionMode && allowedSuggestedCards.length > 0 && (
        <div className="space-y-4">
          {allowedSuggestedCards.map((card) => {
            // Find suggestion by matching card name to candidate
            const candidate = candidateCards.find(
              (c) => c.name.toLowerCase() === card.name.toLowerCase(),
            );
            const meta = candidate
              ? suggestionMetaMap.get(candidate.candidateId)
              : undefined;

            return (
              <CutCornerWrapper
                key={card.id}
                size="md"
                hoverHighlight
                padding="1rem"
                style={{
                  ["--cut-corner-stroke" as any]: "rgba(20,239,255,0.38)",
                  ["--cut-corner-stroke-hover" as any]: "rgba(20,239,255,0.52)",
                  ["--cut-corner-fill" as any]: "transparent",
                }}
              >
                <div className="border border-cyan-500/30 bg-slate-900/70 backdrop-blur-sm space-y-2 shadow-[0_2px_12px_rgba(0,0,0,0.2)]">
                  <div className="flex flex-col gap-3 md:flex-row md:items-start">
                    <div className="shrink-0">{renderCardPreview(card)}</div>
                    <div className="flex-1 space-y-1">
                      <h3 className="font-semibold text-sm md:text-base text-slate-50">
                        {card.name}
                      </h3>
                      {meta?.reason && (
                        <p className="text-xs md:text-sm text-slate-300 leading-relaxed">
                          {meta.reason}
                        </p>
                      )}

                      {meta?.synergy_with_candidateIds &&
                        meta.synergy_with_candidateIds.length > 0 && (
                          <div className="flex flex-wrap gap-1 pt-1">
                            {meta.synergy_with_candidateIds.map((id) => {
                              const partner = candidateCards.find(
                                (c) => c.candidateId === id,
                              );
                              if (!partner) return null;
                              return (
                                <span
                                  key={id}
                                  className="rounded-full border border-cyan-500/30 bg-cyan-500/10 px-2 py-0.5 text-[10px] md:text-xs text-cyan-300"
                                >
                                  Synergy: {partner.name}
                                </span>
                              );
                            })}
                          </div>
                        )}
                    </div>
                  </div>
                </div>
              </CutCornerWrapper>
            );
          })}
        </div>
      )}

      {/* Render explanation text (hidden in card suggestion mode since cards are rendered separately) */}
      {!isCardSuggestionMode && (
        <>
          <MarkdownWithCardPreviews
            content={processedContent}
            suggestedCards={allowedSuggestedCards}
            allCards={allCards}
          />
        </>
      )}
    </div>
  );
}
