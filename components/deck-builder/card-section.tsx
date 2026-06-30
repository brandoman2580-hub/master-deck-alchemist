"use client";

import { useMemo } from "react";
import { motion } from "framer-motion";
import { sortDeckCards } from "@/lib/utils/deckSort";
import { DeckDropZone } from "@/components/ui/deck-drop-zone";
import { Layers, Zap, Shield } from "lucide-react";
import { Card } from "@/types/card";
import { DeckSection } from "@/types/types";
import { UniqueIdentifier } from "@dnd-kit/core";
import { useDraggable } from "@dnd-kit/core";
import { CSS } from "@dnd-kit/utilities";
import { CardPreview } from "@/components/ui/card-preview";
import { CardImage } from "@/components/ui/card-image";
import {
  fadeInVariants,
  SCALE,
  ANIMATION_DURATION,
  EASING,
} from "@/lib/animations";
import { getAllowedCopies } from "@/lib/helpers";
import { Minus, Plus } from "lucide-react";
import { AnimatePresence } from "framer-motion";
import { getRarityBadge } from "@/lib/utils/rarityBadges";
import { RarityBadge } from "@/components/ui/rarity-badge";
import type { BanStatus, DeckMode } from "@/types/types";

export interface CardSectionProps {
  section: DeckSection;
  cards: Card[];
  activeDragId: UniqueIdentifier | null;
  removingDeckCardIds: Set<string>;
  onRemove: (deckInstanceId: string, section: DeckSection) => void;
  onAdd?: (card: Card, section: DeckSection) => void;
  count?: number;
  maxCount?: number;
  deckMode?: DeckMode;
  mdRarityMap?: Map<number, string>;
  banlist?: Record<string, BanStatus>;
  /** Card pool lookup to enrich deck cards with prices for TCG previews */
  cardLookup?: Map<number, Card>;
  sort?: string;
  sortDirection?: "asc" | "desc";
}

const sectionIcons = {
  mainDeck: Layers,
  extraDeck: Zap,
  sideDeck: Shield,
};

const sectionHeadlines = {
  mainDeck: "Main Deck",
  extraDeck: "Extra Deck",
  sideDeck: "Side Deck",
};

/**
 * Individual card copy component for deck builder
 * Shows one card instance with ban status badge (if limited) and plus/minus controls
 */
function DeckCardCopy({
  card,
  deckInstanceId,
  section,
  activeDragId,
  isBeingRemoved,
  onRemove,
  onAdd,
  canAddMore,
  deckMode,
  mdRarityOverride,
  banStatus = "Unlimited",
}: {
  card: Card;
  deckInstanceId: string;
  section: DeckSection;
  activeDragId: UniqueIdentifier | null;
  isBeingRemoved: boolean;
  onRemove: (deckInstanceId: string, section: DeckSection) => void;
  onAdd?: (card: Card, section: DeckSection) => void;
  canAddMore: boolean;
  deckMode?: DeckMode;
  mdRarityOverride?: string;
  banStatus?: string;
}) {
  const dragId = `deck-${section}-${deckInstanceId}`;
  const isBeingDragged = activeDragId === dragId;

  const { attributes, listeners, setNodeRef, transform } = useDraggable({
    id: dragId,
    data: {
      type: "deck",
      deckInstanceId,
      card,
      section,
    },
  });

  // Hide card only when being removed (dropped to Card Browser), not when being dragged normally
  // Don't apply transform if card is being removed - prevents "travel back" visual
  const style = transform && !isBeingRemoved
    ? { transform: CSS.Transform.toString(transform) }
    : isBeingRemoved
      ? { transform: "none" }
      : undefined;

  return (
    <motion.div
      ref={setNodeRef}
      style={{
        ...style,
        visibility: isBeingRemoved ? "hidden" : "visible",
        pointerEvents: isBeingRemoved ? "none" : undefined,
      }}
      initial={{ opacity: 0, scale: SCALE.initial }}
      animate={{
        opacity: isBeingRemoved ? 0 : (isBeingDragged ? 0.3 : 1),
        scale: isBeingRemoved ? SCALE.initial : 1
      }}
      exit={{ opacity: 0, scale: SCALE.initial }}
      layout
      transition={{
        duration: isBeingRemoved ? ANIMATION_DURATION.fast : ANIMATION_DURATION.normal,
        ease: EASING.smooth,
      }}
      // Force re-animation when card is added by using key prop
      key={deckInstanceId}
    >
      {/* Card Thumbnail - Draggable */}
      <div
        {...listeners}
        {...attributes}
        className="relative w-24 h-36 cursor-grab active:cursor-grabbing"
      >
        <CardPreview
          card={card}
          banStatus={banStatus}
          deckMode={deckMode}
          mdRarityOverride={mdRarityOverride}
        >
          <div className="relative w-full h-full">
            <CardImage
              card={card}
              width={120}
              height={180}
              alt={card.name}
              className="w-full h-full object-contain rounded shadow-sm"
              loading="lazy"
            />
            {/* Rarity Badge - Master Duel only; TCG focuses on price */}
            {deckMode !== "TCG" &&
              (() => {
                const rarity = mdRarityOverride ?? card.misc_info?.[0]?.md_rarity;
                const rarityBadge = getRarityBadge(rarity, mdRarityOverride);
                return rarityBadge ? (
                  <div className="absolute top-1 right-1.5 z-20 drop-shadow-lg">
                    <RarityBadge
                      result={rarityBadge}
                      size="sm"
                      className="border shadow-lg"
                    />
                  </div>
                ) : null;
              })()}
            {/* Ban status badge for non-unlimited cards */}
            {banStatus !== "Unlimited" && (
              <div
                className="absolute top-1.5 left-1.5 z-20 flex h-6 w-6 items-center justify-center rounded-full border-2 border-red-500 bg-black text-sm font-bold text-yellow-500 drop-shadow-lg"
                aria-label={`Ban status: ${banStatus}`}
              >
                {banStatus === "Limited"
                  ? "1"
                  : banStatus === "Semi-Limited"
                    ? "2"
                    : "0"}
              </div>
            )}
            {/* Plus/minus controls - 16px from bottom, inset from edges */}
            <div
              className="absolute left-1 right-1 flex items-center justify-center gap-1 z-20"
              style={{ bottom: 16 }}
              onClick={(e) => e.stopPropagation()}
            >
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  onRemove(deckInstanceId, section);
                }}
                className="h-6 w-6 rounded bg-slate-800 border border-slate-600 text-white hover:bg-slate-700 transition-colors flex items-center justify-center shadow-md"
                aria-label="Remove one copy"
              >
                <Minus className="h-3 w-3" />
              </button>
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  onAdd?.(card, section);
                }}
                disabled={!canAddMore || !onAdd}
                className="h-6 w-6 rounded bg-slate-800 border border-slate-600 text-white hover:bg-slate-700 transition-colors flex items-center justify-center shadow-md disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:bg-slate-800"
                aria-label="Add one copy"
              >
                <Plus className="h-3 w-3" />
              </button>
            </div>
          </div>
        </CardPreview>
      </div>
    </motion.div>
  );
}

/**
 * Card section component for displaying cards in a deck section
 * Shows individual card copies with remove functionality
 */
export function CardSection({
  section,
  cards,
  activeDragId,
  removingDeckCardIds,
  onRemove,
  onAdd,
  count = 0,
  maxCount = section === "mainDeck" ? 60 : 15,
  deckMode,
  mdRarityMap,
  banlist = {},
  cardLookup,
  sort = "name",
  sortDirection = "asc",
}: CardSectionProps) {
  const sortedCards = useMemo(() => {
    return sortDeckCards(cards, sort, sortDirection, mdRarityMap);
  }, [cards, sort, sortDirection, mdRarityMap]);

  const Icon = sectionIcons[section];

  return (
    <div>
      {/* Card Items */}
      <div
        id={section}
        className="w-full rounded-lg border border-white/10 min-h-[400px] transition-all duration-200"
      >
        <DeckDropZone id={section} isEmpty={cards.length === 0}>
          {cards.length === 0 ? (
            <motion.div
              className="flex flex-col items-center justify-center text-muted-50 py-16 h-full min-h-[400px] px-4"
              initial="hidden"
              animate="visible"
              variants={fadeInVariants}
            >
              <Icon className="h-16 w-16 mb-4 text-white/40" />
              <span className="text-base font-semibold text-white/60 mb-2">
                {sectionHeadlines[section]}
              </span>
              <span className="text-sm text-white/60 font-medium mb-2">
                {count} / {maxCount}
              </span>
              <p className="text-xs text-white/50 text-center max-w-xs mt-2">
                Drag and drop cards here, or click a card in the browser to add it to your deck.
              </p>
            </motion.div>
          ) : (
            <motion.div
              className="grid grid-cols-4 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-4 gap-6 p-4 justify-items-center"
            >
              <AnimatePresence mode="popLayout">
                {sortedCards.map((card) => {
                  const poolCard = cardLookup?.get(card.id);
                  const enrichedCard = poolCard
                    ? { ...card, card_prices: poolCard.card_prices ?? card.card_prices }
                    : card;
                  const countOfCard = cards.filter((c) => c.id === card.id).length;
                  const allowed = getAllowedCopies(card, banlist);
                  const canAddMore =
                    countOfCard < allowed && count < (maxCount ?? 0);
                  return (
                    <DeckCardCopy
                      key={card.deckInstanceId}
                      card={enrichedCard}
                      deckInstanceId={card.deckInstanceId}
                      section={section}
                      activeDragId={activeDragId}
                      isBeingRemoved={removingDeckCardIds.has(card.deckInstanceId)}
                      onRemove={onRemove}
                      onAdd={onAdd}
                      canAddMore={canAddMore}
                      deckMode={deckMode}
                      mdRarityOverride={mdRarityMap?.get(card.id)}
                      banStatus={banlist[card.name] || "Unlimited"}
                    />
                  );
                })}
              </AnimatePresence>
            </motion.div>
          )}
        </DeckDropZone>
      </div>
    </div>
  );
}
