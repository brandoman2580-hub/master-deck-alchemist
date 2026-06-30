"use client";

import { useState, useMemo, useEffect } from "react";
import { motion, AnimatePresence, useMotionValue, useTransform, PanInfo } from "framer-motion";
import { ChevronLeft, ChevronRight, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { CardImage, hasDisplayableCardImage } from "@/components/ui/card-image";
import { useCardStore } from "@/store/cardStore";
import { useDeck } from "@/context/deck-context";
import { useModeStore } from "@/store/modeStore";
import { CardPreview } from "@/components/ui/card-preview";
import { getAllowedCopies } from "@/lib/helpers";
import { getMasterDuelBanlist, getTCGBanlist } from "@/lib/api";
import type { Recommendation } from "./chat-interface";
import type { Card } from "@/types/card";
import type { DeckSection, BanStatus } from "@/types/types";

const swipeConfidenceThreshold = 10000;
const swipePower = (offset: number, velocity: number) => {
  return Math.abs(offset) * velocity;
};

interface CardSlideshowProps {
  recommendations: Recommendation[];
  onAddCard?: (card: Card, section: DeckSection) => void;
}

/**
 * Card Slideshow Component
 * Displays card images and implements Add to Deck functionality
 */
export function CardSlideshow({ recommendations, onAddCard }: CardSlideshowProps) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isAdding, setIsAdding] = useState(false);
  const [direction, setDirection] = useState(0);
  const [banlist, setBanlist] = useState<Record<string, BanStatus>>({});
  const currentRec = recommendations[currentIndex];
  const cardList = useCardStore((state) => state.cardList);
  const { currentDeck, getDeckStats } = useDeck();
  const deckMode = useModeStore((state) => state.deckMode);

  // Load banlist based on deck mode
  useEffect(() => {
    const loadBanlist = async () => {
      try {
        const banlistData = deckMode === "TCG" 
          ? await getTCGBanlist()
          : await getMasterDuelBanlist();
        setBanlist(banlistData);
      } catch (error) {
        // Banlist loading failed - use empty banlist for graceful degradation
        setBanlist({});
      }
    };
    loadBanlist();
  }, [deckMode]);

  // Swipe gesture support
  const x = useMotionValue(0);
  const rotate = useTransform(x, [-200, 200], [-15, 15]);
  const opacity = useTransform(x, [-200, -50, 0, 50, 200], [0.3, 0.8, 1, 0.8, 0.3]);

  // Find the card object from cardList
  const card = useMemo(() => {
    return cardList.find((c) => c.id === currentRec.cardId);
  }, [cardList, currentRec.cardId]);

  // Recalculate canAdd based on actual deck state
  const canAddCard = useMemo(() => {
    if (!card) return false;

    // Determine which deck section this card should go to
    const section: DeckSection = card.type?.includes("Fusion") || 
                                 card.type?.includes("Synchro") || 
                                 card.type?.includes("XYZ") || 
                                 card.type?.includes("Link") || 
                                 card.type?.includes("Pendulum")
      ? "extraDeck"
      : "mainDeck";

    // Check deck limits first
    const deckStats = getDeckStats();
    if (section === "mainDeck" && deckStats.mainCount >= 60) return false;
    if (section === "extraDeck" && deckStats.extraCount >= 15) return false;
    // Note: sideDeck is not used in slideshow (cards go to main or extra based on type)

    // Check banlist restrictions
    const maxCopies = getAllowedCopies(card, banlist);
    if (maxCopies === 0) return false; // Forbidden

    // Count current copies across ALL deck sections (banlist applies to entire deck)
    const totalCount = [
      ...currentDeck.mainDeck,
      ...currentDeck.extraDeck,
      ...currentDeck.sideDeck,
    ].filter((c) => c.id === card.id).length;
    
    // Check if we can add more copies
    if (totalCount >= maxCopies) return false;

    return true;
  }, [card, currentDeck, getDeckStats, banlist]);


  const handleNext = () => {
    setDirection(1);
    setCurrentIndex((prev) => (prev < recommendations.length - 1 ? prev + 1 : 0));
    x.set(0);
  };

  const handlePrevious = () => {
    setDirection(-1);
    setCurrentIndex((prev) => (prev > 0 ? prev - 1 : recommendations.length - 1));
    x.set(0);
  };

  // Handle swipe gesture end
  const handleDragEnd = (_event: MouseEvent | TouchEvent | PointerEvent, info: PanInfo) => {
    const swipe = swipePower(info.offset.x, info.velocity.x);
    
    if (swipe < -swipeConfidenceThreshold) {
      // Swipe left - go to previous
      handlePrevious();
    } else if (swipe > swipeConfidenceThreshold) {
      // Swipe right - go to next
      handleNext();
    } else {
      // Not enough swipe - snap back
      x.set(0);
    }
  };

  // Keyboard shortcuts for slideshow navigation
  useEffect(() => {
    const handleKeyPress = (e: KeyboardEvent) => {
      // Only handle if slideshow is visible and user is not typing in an input
      if (document.activeElement?.tagName === "INPUT" || document.activeElement?.tagName === "TEXTAREA") {
        return;
      }

      if (e.key === "ArrowLeft") {
        e.preventDefault();
        handlePrevious();
      } else if (e.key === "ArrowRight") {
        e.preventDefault();
        handleNext();
      }
    };

    window.addEventListener("keydown", handleKeyPress);
    return () => window.removeEventListener("keydown", handleKeyPress);
  }, [currentIndex, recommendations.length]);

  const handleAdd = async () => {
    if (!card || !onAddCard) return;
    
    setIsAdding(true);
    try {
      // Determine deck section (default to mainDeck, but could be enhanced based on card type)
      const section: DeckSection = card.type?.includes("Fusion") || 
                                   card.type?.includes("Synchro") || 
                                   card.type?.includes("XYZ") || 
                                   card.type?.includes("Link") || 
                                   card.type?.includes("Pendulum")
        ? "extraDeck"
        : "mainDeck";
      
      onAddCard(card, section);
      
      // Auto-advance to next card after adding
      setTimeout(() => {
        handleNext();
        setIsAdding(false);
      }, 300);
    } catch (error) {
      // Error adding card
      setIsAdding(false);
    }
  };


  if (recommendations.length === 0) return null;

  return (
    <div className="bg-white/5 border border-white/10 backdrop-blur-xl rounded-xl p-3 sm:p-4">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Badge
            variant="outline"
            className={`${
              currentRec.priority === "high"
                ? "bg-red-500/20 border-red-500/50 text-red-200"
                : currentRec.priority === "medium"
                  ? "bg-yellow-500/20 border-yellow-500/50 text-yellow-200"
                  : "bg-blue-500/20 border-blue-500/50 text-blue-200"
            }`}
          >
            {currentRec.priority.toUpperCase()} PRIORITY
          </Badge>
          <span className="text-xs text-white/60">
            {currentIndex + 1} of {recommendations.length}
          </span>
        </div>
      </div>

      <AnimatePresence mode="wait" custom={direction}>
        <motion.div
          key={currentIndex}
          custom={direction}
          initial={{ opacity: 0, x: direction > 0 ? 50 : -50 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: direction > 0 ? -50 : 50 }}
          transition={{ duration: 0.3 }}
          className="space-y-4"
        >
          {/* Card Image with Navigation Buttons and Swipe Support */}
          <motion.div 
            className="relative w-full h-64 bg-slate-900/50 rounded-lg flex items-center justify-center overflow-hidden cursor-grab active:cursor-grabbing"
            drag="x"
            dragConstraints={{ left: 0, right: 0 }}
            dragElastic={0.2}
            onDragEnd={handleDragEnd}
            style={{ x, rotate, opacity }}
          >
            {/* Previous Button - Left side */}
            <Button
              variant="ghost"
              size="icon"
              onClick={handlePrevious}
              className="absolute left-2 h-9 w-9 text-white/80 hover:text-white hover:bg-white/20 bg-black/40 backdrop-blur-sm rounded-lg z-10 transition-all"
              aria-label="Previous card"
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>

            {/* Card Image */}
            {card && hasDisplayableCardImage(card) ? (
              <CardPreview card={card}>
                <div className="relative w-full h-full cursor-pointer">
                  <CardImage
                    card={card}
                    alt={card.name}
                    fill
                    sizes="(max-width: 768px) 100vw, 400px"
                    className="object-contain transition-transform duration-300"
                  />
                </div>
              </CardPreview>
            ) : (
              <p className="text-white/50 text-sm">Card image not available</p>
            )}

            {/* Next Button - Right side */}
            <Button
              variant="ghost"
              size="icon"
              onClick={handleNext}
              className="absolute right-2 h-9 w-9 text-white/80 hover:text-white hover:bg-white/20 bg-black/40 backdrop-blur-sm rounded-lg z-10 transition-all"
              aria-label="Next card"
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          </motion.div>

          {/* Card Name */}
          <h3 className="text-white font-semibold text-lg">{currentRec.cardName}</h3>

          {/* Reasoning */}
          <div className="bg-white/5 rounded-lg p-3">
            <p className="text-white/80 text-sm">{currentRec.reason}</p>
          </div>

          {/* Action Buttons */}
          <div className="flex items-center justify-center gap-2">
            <Button
              onClick={handleAdd}
              disabled={!canAddCard || !card || isAdding}
              className="h-9 px-4 bg-white/10 hover:bg-white/15 border border-white/20 text-white disabled:opacity-50 disabled:cursor-not-allowed rounded-lg"
            >
              <Plus className="h-4 w-4 mr-2" />
              {isAdding ? "Adding..." : canAddCard ? "Add to Deck" : "Deck Full"}
            </Button>
          </div>
        </motion.div>
      </AnimatePresence>
    </div>
  );
}
