"use client";

import { useState } from "react";
import { motion, AnimatePresence, useMotionValue, useTransform, PanInfo } from "framer-motion";
import { X, Plus, Eye } from "lucide-react";
import { CardImage, hasDisplayableCardImage } from "@/components/ui/card-image";
import { Button } from "@/components/ui/button";
import { Card } from "@/types/card";

interface SwipeableCardStackProps {
  cards: Card[];
  onAdd: (card: Card) => void;
  onSkip: (card: Card) => void;
  onPreview?: (card: Card) => void;
}

const swipeConfidenceThreshold = 10000;
const swipePower = (offset: number, velocity: number) => {
  return Math.abs(offset) * velocity;
};

export function SwipeableCardStack({
  cards,
  onAdd,
  onSkip,
  onPreview,
}: SwipeableCardStackProps) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [direction, setDirection] = useState(0);
  
  const currentCard = cards[currentIndex];
  const nextCard = cards[currentIndex + 1];
  const hasMore = currentIndex < cards.length - 1;
  
  const x = useMotionValue(0);
  const rotate = useTransform(x, [-200, 200], [-25, 25]);
  const opacity = useTransform(x, [-200, -100, 0, 100, 200], [0.5, 1, 1, 1, 0.5]);
  
  // Calculate swipe progress for indicators
  const swipeProgress = useTransform(x, [-200, 200], [-1, 1]);
  
  const handleSwipe = (dir: number, card: Card) => {
    setDirection(dir);
    if (dir > 0) {
      onAdd(card);
    } else {
      onSkip(card);
    }
    
    if (hasMore) {
      setTimeout(() => {
        setCurrentIndex(prev => prev + 1);
        x.set(0);
      }, 300);
    }
  };
  
  const handleDragEnd = (_event: MouseEvent | TouchEvent | PointerEvent, info: PanInfo) => {
    const swipe = swipePower(info.offset.x, info.velocity.x);
    
    if (swipe < -swipeConfidenceThreshold) {
      handleSwipe(-1, currentCard);
    } else if (swipe > swipeConfidenceThreshold) {
      handleSwipe(1, currentCard);
    }
  };
  
  const swipeVariants = {
    enter: (direction: number) => ({
      x: direction > 0 ? 300 : -300,
      opacity: 0,
      scale: 0.8,
      rotate: direction > 0 ? 20 : -20,
    }),
    center: {
      x: 0,
      opacity: 1,
      scale: 1,
      rotate: 0,
      transition: {
        type: "spring" as const,
        stiffness: 300,
        damping: 30,
      },
    },
    exit: (direction: number) => ({
      x: direction > 0 ? 300 : -300,
      opacity: 0,
      scale: 0.8,
      rotate: direction > 0 ? 20 : -20,
      transition: {
        type: "spring" as const,
        stiffness: 300,
        damping: 30,
      },
    }),
  };
  
  if (cards.length === 0) {
    return (
      <div className="w-full h-[500px] flex items-center justify-center">
        <div className="text-center">
          <p className="text-white/60 mb-2">No cards to display</p>
          <p className="text-sm text-white/40">Try exploring a different improvement area</p>
        </div>
      </div>
    );
  }
  
  if (!currentCard) {
    return (
      <div className="w-full h-[500px] flex items-center justify-center">
        <div className="text-center">
          <p className="text-white/80 mb-2">🎉 All cards reviewed!</p>
          <p className="text-sm text-white/60">You've gone through all the suggestions</p>
        </div>
      </div>
    );
  }
  
  return (
    <div className="relative w-full h-[500px] flex items-center justify-center">
      {/* Next card preview (behind) */}
      {nextCard && (
        <motion.div
          className="absolute inset-0 flex items-center justify-center"
          initial={{ scale: 0.9, opacity: 0.3 }}
          animate={{ scale: 0.95, opacity: 0.5 }}
        >
          <div className="w-full max-w-sm h-[450px] rounded-2xl bg-white/5 border border-white/10 backdrop-blur-sm overflow-hidden">
            {hasDisplayableCardImage(nextCard, false) && (
              <div className="relative w-full h-64">
                <CardImage
                  card={nextCard}
                  preferSmall={false}
                  alt={nextCard.name}
                  fill
                  sizes="400px"
                  className="object-contain"
                />
              </div>
            )}
          </div>
        </motion.div>
      )}
      
      {/* Current card (front) */}
      <AnimatePresence mode="wait" custom={direction}>
        <motion.div
          key={currentCard.id}
          custom={direction}
          variants={swipeVariants}
          initial="enter"
          animate="center"
          exit="exit"
          drag="x"
          dragConstraints={{ left: 0, right: 0 }}
          dragElastic={0.7}
          onDragEnd={handleDragEnd}
          style={{ x, rotate, opacity }}
          className="absolute inset-0 flex items-center justify-center cursor-grab active:cursor-grabbing"
        >
          <div className="w-full max-w-sm h-[450px] rounded-2xl bg-white/10 border border-white/20 backdrop-blur-xl shadow-2xl overflow-hidden">
            {/* Card Image */}
            {hasDisplayableCardImage(currentCard, false) && (
              <div className="relative w-full h-64 bg-slate-900/50">
                <CardImage
                  card={currentCard}
                  preferSmall={false}
                  alt={currentCard.name}
                  fill
                  sizes="400px"
                  className="object-contain"
                  priority
                />
                
                {/* Swipe direction indicators */}
                <motion.div
                  className="absolute top-4 left-4 px-4 py-2 rounded-full bg-red-500/80 text-white font-bold text-lg"
                  style={{ opacity: useTransform(swipeProgress, [-1, 0], [1, 0]) }}
                >
                  ✕ SKIP
                </motion.div>
                <motion.div
                  className="absolute top-4 right-4 px-4 py-2 rounded-full bg-green-500/80 text-white font-bold text-lg"
                  style={{ opacity: useTransform(swipeProgress, [0, 1], [0, 1]) }}
                >
                  ✓ ADD
                </motion.div>
              </div>
            )}
            
            {/* Card Info */}
            <div className="p-6">
              <h3 className="text-xl font-bold text-white mb-2">{currentCard.name}</h3>
              <p className="text-sm text-white/60 mb-3">
                {currentCard.type}
                {currentCard.race && ` • ${currentCard.race}`}
                {currentCard.attribute && ` • ${currentCard.attribute}`}
              </p>
              <p className="text-sm text-white/80 line-clamp-3">
                {currentCard.desc}
              </p>
            </div>
          </div>
        </motion.div>
      </AnimatePresence>
      
      {/* Manual controls */}
      <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex gap-4 z-10">
        <Button
          variant="outline"
          size="icon"
          className="w-14 h-14 rounded-full bg-red-500/20 border-red-500/50 hover:bg-red-500/30 text-white"
          onClick={() => handleSwipe(-1, currentCard)}
          aria-label="Skip card"
        >
          <X className="h-6 w-6" />
        </Button>
        
        {onPreview && (
          <Button
            variant="outline"
            size="icon"
            className="w-12 h-12 rounded-full bg-white/10 border-white/20 hover:bg-white/20 text-white"
            onClick={() => onPreview(currentCard)}
            aria-label="Preview card details"
          >
            <Eye className="h-5 w-5" />
          </Button>
        )}
        
        <Button
          variant="outline"
          size="icon"
          className="w-14 h-14 rounded-full bg-green-500/20 border-green-500/50 hover:bg-green-500/30 text-white"
          onClick={() => handleSwipe(1, currentCard)}
          aria-label="Add card to deck"
        >
          <Plus className="h-6 w-6" />
        </Button>
      </div>
      
      {/* Progress indicator */}
      <div className="absolute top-4 left-1/2 -translate-x-1/2 text-sm text-white/60">
        {currentIndex + 1} / {cards.length}
      </div>
    </div>
  );
}
