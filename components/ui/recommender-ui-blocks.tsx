"use client";

import { useMemo } from "react";
import { UIBlock, Reasoning } from "../../types/recommender";
import { Card } from "../../types/card";
import { useDeck } from "@/context/deck-context";
import { BlockRenderer } from "./recommender-ui-blocks/block-renderer";
import { ReasoningTree } from "./recommender-ui-blocks/reasoning-tree";
import { PriorityGroupRenderer } from "./recommender-ui-blocks/priority-group-renderer";
import {
  groupRecommendationsByPriority,
  type Recommendation,
} from "./recommender-ui-blocks/priority-helpers";

export interface RecommenderUIBlocksProps {
  blocks: UIBlock[];
  recommendations?: Array<{
    cardId: string;
    cardName?: string;
    action: string;
    reason: string;
    impactEst: number;
    synergyScore?: number;
    banned?: boolean;
    priority?: "must-have" | "highly-recommended" | "good-option" | "situational";
  }>;
  reasoning?: Reasoning;
  allCards?: Card[];
  onApplySuggestion?: (suggestionId: string, cardId?: string) => void;
  onPreviewSuggestion?: (suggestionId: string, cardId?: string) => void;
  onAddCard?: (cardId: string) => void; // New: Direct add card handler
  onRemoveCard?: (cardId: string) => void; // New: Direct remove card handler
  addedCardIds?: Set<string>; // Track which cards have been added
  addingCardIds?: Set<string>; // Track which cards are currently being added
  deckCards?: {
    mainDeck: Card[];
    extraDeck: Card[];
    sideDeck: Card[];
  };
  onAskFollowUp?: (prompt: string) => void;
}

export function RecommenderUIBlocks({
  blocks,
  recommendations = [],
  reasoning,
  allCards = [],
  onApplySuggestion,
  onPreviewSuggestion,
  onAddCard,
  onRemoveCard,
  addedCardIds = new Set(),
  addingCardIds = new Set(),
  deckCards,
  onAskFollowUp,
}: RecommenderUIBlocksProps) {
  const { currentDeck } = useDeck();

  const deckCardsForUi =
    deckCards ||
    (currentDeck
      ? {
          mainDeck: currentDeck.mainDeck,
          extraDeck: currentDeck.extraDeck,
          sideDeck: currentDeck.sideDeck,
        }
      : undefined);

  // Create maps for quick card lookup
  const cardMap = useMemo(() => {
    const map = new Map<number, Card>();
    allCards.forEach((card) => {
      map.set(card.id, card);
    });
    return map;
  }, [allCards]);

  const cardNameMap = useMemo(() => {
    const map = new Map<string, Card>();
    allCards.forEach((card) => {
      map.set(card.name.toLowerCase(), card);
    });
    return map;
  }, [allCards]);

  // Create a map of recommendations by cardId for quick lookup
  const recMap = useMemo(
    () => new Map(recommendations.map((r) => [r.cardId, r])),
    [recommendations]
  );

  // Group recommendations by priority
  const priorityGroups = useMemo(
    () => groupRecommendationsByPriority(recommendations as Recommendation[]),
    [recommendations]
  );

  return (
    <div className="space-y-6">
      {/* Reasoning Tree */}
      <ReasoningTree reasoning={reasoning} priorityGroups={priorityGroups} />

      {/* Priority-Grouped Recommendations */}
      {recommendations.length > 0 && (
        <PriorityGroupRenderer
          priorityGroups={priorityGroups}
          cardMap={cardMap}
          deckCards={deckCardsForUi}
          addedCardIds={addedCardIds}
          addingCardIds={addingCardIds}
          onAddCard={onAddCard}
          onRemoveCard={onRemoveCard}
          onPreviewSuggestion={onPreviewSuggestion}
          onAskFollowUp={onAskFollowUp}
        />
      )}

      {/* Render standard UI blocks */}
      <div className="space-y-4">
        {blocks.map((block, index) => (
          <BlockRenderer
            key={block.id || index}
            block={block}
            index={index}
            cardMap={cardMap}
            cardNameMap={cardNameMap}
            recMap={recMap}
            onApplySuggestion={onApplySuggestion}
            onPreviewSuggestion={onPreviewSuggestion}
          />
        ))}
      </div>
    </div>
  );
}
