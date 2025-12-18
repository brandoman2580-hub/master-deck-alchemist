"use client";

import React from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { CardPreview } from "../ui/card-preview";
import { Badge } from "../ui/badge";
import { Button } from "../ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../ui/select";
import Image from "next/image";
import { Plus, Loader2, Check } from "lucide-react";
import type { AIResponseCardProps, CandidateCard, CardSuggestionMeta } from "./types";
import { cleanupLLMResponse, highlightKeywords } from "./utils";

function MarkdownWithCardPreviews({
  content,
  suggestedCards = [],
  allCards = [],
}: {
  content: string;
  suggestedCards?: import("../../types/card").Card[];
  allCards?: import("../../types/card").Card[];
}) {
  const nameToCardMap = React.useMemo(() => {
    const map = new Map<string, import("../../types/card").Card>();

    suggestedCards.forEach((card) => {
      const normalizedName = card.name.toLowerCase().trim();
      map.set(normalizedName, card);
      map.set(card.name, card);
      map.set(card.name.trim(), card);
    });

    allCards.forEach((card) => {
      const normalizedName = card.name.toLowerCase().trim();
      if (!map.has(normalizedName)) {
        map.set(normalizedName, card);
        if (!map.has(card.name)) {
          map.set(card.name, card);
        }
        const trimmedName = card.name.trim();
        if (!map.has(trimmedName)) {
          map.set(trimmedName, card);
        }
      }
    });

    return map;
  }, [suggestedCards, allCards]);

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
      try {
        return String(node);
      } catch {
        return "";
      }
    },
    []
  );

  return (
    <ReactMarkdown
      remarkPlugins={[remarkGfm]}
      components={{
        strong({ children }) {
          const text = extractTextContent(children);
          const trimmedText = text.trim();

          if (!trimmedText || nameToCardMap.size === 0) {
            return (
              <strong className="text-primary font-semibold">{children}</strong>
            );
          }

          const normalizedText = trimmedText.toLowerCase();

          let matchedCard = nameToCardMap.get(normalizedText);
          if (!matchedCard) {
            matchedCard = nameToCardMap.get(trimmedText);
          }

          if (matchedCard) {
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
        em({ children }) {
          const text = extractTextContent(children);
          return (
            <em className="text-cyan-400 font-medium border-b border-cyan-500/30 px-1">
              {text}
            </em>
          );
        },
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
        p({ children }) {
          return (
            <p className="mb-4 leading-relaxed text-white/90">{children}</p>
          );
        },
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
        ul({ children }) {
          return (
            <ul className="mb-4 space-y-2 pl-6 list-disc marker:text-white/60">
              {children}
            </ul>
          );
        },
        ol({ children }) {
          return (
            <ol className="mb-4 space-y-2 pl-6 list-decimal marker:text-white/60 marker:font-semibold">
              {children}
            </ol>
          );
        },
        li({ children }) {
          return (
            <li className="pl-2 leading-relaxed text-white/90">
              {children}
            </li>
          );
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
  const allowedSuggestedCards = suggestedCards.filter((card) => {
    const banStatus = banlist[card.name] || "Unlimited";
    return banStatus !== "Forbidden";
  });

  const cardMap = new Map<string, import("../../types/card").Card>();
  allowedSuggestedCards.forEach((card) => {
    cardMap.set(card.name.toLowerCase(), card);
  });

  if (!isCardSuggestionMode) {
    allCards.forEach((card) => {
      if (!cardMap.has(card.name.toLowerCase())) {
        cardMap.set(card.name.toLowerCase(), card);
      }
    });
  }

  // ============================================================================
  // APPLY NEW CLEANUP FUNCTION HERE
  // ============================================================================
  let processedContent = content;
  
  if (!isCardSuggestionMode && allowedSuggestedCards.length > 0) {
    processedContent = cleanupLLMResponse(content, allowedSuggestedCards);
  }

  // Apply keyword highlighting if allCards is provided
  if (allCards.length > 0 && !isCardSuggestionMode) {
    processedContent = highlightKeywords(processedContent, allCards);
  }

  const renderCardPreview = (card: import("../../types/card").Card) => {
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

    const getBanStatusColor = (status: import("../../types/types").BanStatus) => {
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

    return (
      <div
        className={`p-3 border-b border-cyan-500/20 hover:bg-slate-900/40 transition-colors ${
          !canAdd ? "opacity-60 cursor-not-allowed" : "cursor-pointer"
        }`}
      >
        <div className="flex gap-3 items-center">
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
                  onValueChange={(value: import("../../types/types").DeckSection) => {
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

  const suggestionMetaMap = new Map<number, CardSuggestionMeta>();
  cardSuggestionsMeta.forEach((meta) => {
    suggestionMetaMap.set(meta.candidateId, meta);
  });

  const candidateCardMap = new Map<string, CandidateCard>();
  candidateCards.forEach((candidate) => {
    candidateCardMap.set(candidate.name.toLowerCase(), candidate);
  });

  return (
    <div className="space-y-4">
      {isCardSuggestionMode && allowedSuggestedCards.length > 0 && (
        <div className="space-y-4">
          {allowedSuggestedCards.map((card) => {
            const candidate = candidateCards.find(
              (c) => c.name.toLowerCase() === card.name.toLowerCase()
            );
            const meta = candidate
              ? suggestionMetaMap.get(candidate.candidateId)
              : undefined;

            return (
              <div
                key={card.id}
                className="bg-white/5 border border-white/10 backdrop-blur-xl shadow-lg rounded-xl p-4 hover:bg-white/10 hover:border-white/20 transition-all duration-300"
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
                                (c) => c.candidateId === id
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
              </div>
            );
          })}
        </div>
      )}

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

