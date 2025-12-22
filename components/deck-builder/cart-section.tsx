"use client";

import { useMemo } from "react";
import { motion } from "framer-motion";
import { DeckDropZone } from "@/components/ui/deck-drop-zone";
import { Layers, Zap, Shield } from "lucide-react";
import { Card } from "@/types/card";
import { DeckSection } from "@/types/types";
import { UniqueIdentifier } from "@dnd-kit/core";
import { useDraggable } from "@dnd-kit/core";
import { CSS } from "@dnd-kit/utilities";
import { CardPreview } from "@/components/ui/card-preview";
import Image from "next/image";
import { X } from "lucide-react";
import {
  fadeInVariants,
  staggerContainer,
  SCALE,
  ANIMATION_DURATION,
  EASING,
} from "@/lib/animations";
import { AnimatePresence } from "framer-motion";

interface CartSectionProps {
  section: DeckSection;
  cards: Card[];
  activeDragId: UniqueIdentifier | null;
  onRemove: (deckInstanceId: string, section: DeckSection) => void;
  count?: number;
  maxCount?: number;
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
 * Shows one card instance with X button in upper right
 */
function DeckCardCopy({
  card,
  deckInstanceId,
  section,
  activeDragId,
  onRemove,
}: {
  card: Card;
  deckInstanceId: string;
  section: DeckSection;
  activeDragId: UniqueIdentifier | null;
  onRemove: (deckInstanceId: string, section: DeckSection) => void;
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

  const style = transform
    ? { transform: CSS.Transform.toString(transform) }
    : undefined;

  return (
    <motion.div
      ref={setNodeRef}
      style={style}
      className={`relative ${isBeingDragged ? "opacity-30 scale-95" : ""}`}
      initial={{ opacity: 0, scale: SCALE.initial }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: SCALE.initial }}
      layout
      transition={{
        duration: ANIMATION_DURATION.normal,
        ease: EASING.smooth,
      }}
    >
      {/* Card Thumbnail - Draggable */}
      <div
        {...listeners}
        {...attributes}
        className="relative w-14 h-20 cursor-grab active:cursor-grabbing"
      >
        <CardPreview card={card} banStatus="Unlimited">
          <div className="relative w-full h-full">
            <Image
              width={56}
              height={80}
              src={card.card_images[0]?.image_url_small || "/placeholder.svg"}
              alt={card.name}
              className="w-full h-full object-contain rounded shadow-sm"
              loading="lazy"
            />
            {/* X button in top-left corner of thumbnail */}
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onRemove(deckInstanceId, section);
              }}
              className="absolute -top-1.5 -left-1.5 h-5 w-5 rounded-full bg-white/10 border border-white/20 text-white hover:bg-white/20 hover:border-white/30 backdrop-blur-sm transition-colors flex items-center justify-center z-20 shadow-md"
              aria-label="Remove card"
            >
              <X className="h-3 w-3" />
            </button>
          </div>
        </CardPreview>
      </div>
    </motion.div>
  );
}

/**
 * Shows individual card copies in the deck
 * Each copy has an X button to remove it
 */
export function CartSection({
  section,
  cards,
  activeDragId,
  onRemove,
  count = 0,
  maxCount = section === "mainDeck" ? 60 : 15,
}: CartSectionProps) {
  // Sort cards by name for consistent display
  const sortedCards = useMemo(() => {
    return [...cards].sort((a, b) => a.name.localeCompare(b.name));
  }, [cards]);

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
              className="flex flex-col items-center justify-center text-muted-50 py-16 h-full min-h-[400px]"
              initial="hidden"
              animate="visible"
              variants={fadeInVariants}
            >
              <motion.div
                animate={{
                  scale: [1, 1.05, 1],
                  opacity: [0.4, 0.6, 0.4],
                }}
                transition={{
                  duration: 2,
                  repeat: Infinity,
                  ease: "easeInOut",
                }}
              >
                <Icon className="h-16 w-16 mb-4 text-white/40" />
              </motion.div>
              <span className="text-base font-semibold text-white/60 mb-2">
                {sectionHeadlines[section]}
              </span>
              <span className="text-sm text-white/60 font-medium">
                {count} / {maxCount}
              </span>
            </motion.div>
          ) : (
            <motion.div
              className="grid grid-cols-4 sm:grid-cols-5 lg:grid-cols-6 xl:grid-cols-4 gap-3 p-4"
              initial="hidden"
              animate="visible"
              variants={staggerContainer(0.05)}
            >
              <AnimatePresence>
                {sortedCards.map((card) => {
                  return (
                    <DeckCardCopy
                      key={card.deckInstanceId}
                      card={card}
                      deckInstanceId={card.deckInstanceId}
                      section={section}
                      activeDragId={activeDragId}
                      onRemove={onRemove}
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

