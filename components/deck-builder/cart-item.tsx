"use client";

import { useMemo, memo } from "react";
import { useDraggable } from "@dnd-kit/core";
import { CSS } from "@dnd-kit/utilities";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/types/card";
import { BanStatus, DeckSection } from "@/types/types";
import { CardPreview } from "@/components/ui/card-preview";
import Image from "next/image";
import { X, Sparkles } from "lucide-react";
import { useRecommendedCardsStore } from "@/store/recommendedCardsStore";

interface CartItemProps {
  card: Card; // Representative card (all instances are the same card)
  quantity: number;
  maxCopies: number;
  banStatus: BanStatus;
  section: DeckSection;
  isBeingDragged: boolean;
  onIncrement: () => void;
  onDecrement: () => void;
  onRemove: () => void;
  canIncrement: boolean;
  canDecrement: boolean;
}

/**
 * Phase 3: Cart-style item showing grouped cards with quantity controls
 * Phase 6: Memoized for performance - only re-renders when props change
 * - Shows "2x Card Name" instead of individual instances
 * - +/- controls for quantity
 * - Quick remove button
 * - Live legality indicators
 */
export const CartItem = memo(function CartItem({
  card,
  quantity,
  maxCopies,
  banStatus,
  section,
  isBeingDragged,
  onIncrement: _onIncrement,
  onDecrement: _onDecrement,
  onRemove,
  canIncrement: _canIncrement,
  canDecrement: _canDecrement,
}: CartItemProps) {
  // Phase 5: Check if card is recommended by AI
  const isRecommended = useRecommendedCardsStore((state) => state.isRecommended(card.id));
  
  // Use first instance for drag (all instances are the same card)
  const dragInstanceId = useMemo(
    () => `cart-${section}-${card.id}`,
    [section, card.id],
  );

  const { attributes, listeners, setNodeRef, transform } = useDraggable({
    id: dragInstanceId,
    data: {
      type: "deck",
      deckInstanceId: dragInstanceId,
      card,
      section,
    },
  });

  const style = transform
    ? { transform: CSS.Transform.toString(transform) }
    : undefined;

  const getBanStatusColor = (status: BanStatus) => {
    switch (status) {
      case "Forbidden":
        return "bg-red-500/20 border-red-500/50 text-red-300";
      case "Limited":
        return "bg-yellow-500/20 border-yellow-500/50 text-yellow-300";
      case "Semi-Limited":
        return "bg-orange-500/20 border-orange-500/50 text-orange-300";
      default:
        return "bg-green-500/20 border-green-500/50 text-green-300";
    }
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`
        flex items-center gap-3 px-3 py-2.5
        border-b border-cyan-500/10
        transition-all duration-200
        hover:bg-cyan-500/10 hover:border-cyan-500/20
        ${isBeingDragged ? "opacity-30 scale-95" : "animate-in fade-in slide-in-from-left-2"}
      `}
    >
      {/* Card Thumbnail - Draggable */}
      <div
        {...listeners}
        {...attributes}
        className="relative w-12 h-18 flex-shrink-0 cursor-grab active:cursor-grabbing"
      >
        <CardPreview card={card} banStatus={banStatus}>
          <div className="relative">
            <Image
              width={80}
              height={120}
              src={card.card_images[0]?.image_url_small || "/placeholder.svg"}
              alt={card.name}
              className="w-full h-full object-contain rounded shadow-sm"
              loading="lazy"
            />
            <button
              type="button"
              onClick={onRemove}
              className="absolute -top-2 -right-2 h-6 w-6 rounded-full bg-slate-900/80 border border-cyan-500/50 text-cyan-200 hover:text-white hover:bg-red-500/70 hover:border-red-400 transition-colors flex items-center justify-center"
              aria-label="Remove card"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
        </CardPreview>
      </div>

      {/* Card Info */}
      <div className="flex-1 min-w-0">
        <div className="flex items-start justify-between gap-2">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <h4 className="font-semibold text-sm text-slate-50 truncate">
                {card.name}
              </h4>
              <Badge
                variant="secondary"
                className="bg-cyan-600/20 text-cyan-300 text-xs px-1.5 py-0.5 border border-cyan-500/30 font-semibold"
              >
                {quantity}x
              </Badge>
              {/* Phase 5: Recommended Badge */}
              {isRecommended && (
                <Badge
                  variant="outline"
                  className="text-[9px] px-1.5 py-0 border-cyan-400/50 text-cyan-300 bg-cyan-500/10 flex items-center gap-0.5"
                >
                  <Sparkles className="h-2.5 w-2.5" />
                  AI
                </Badge>
              )}
            </div>
            <div className="flex flex-wrap gap-1.5 mt-1.5">
              <Badge
                variant="outline"
                className="text-xs border-cyan-500/50 text-cyan-300 bg-cyan-500/10"
              >
                {card.type}
              </Badge>
              {card.attribute && (
                <Badge
                  variant="outline"
                  className="text-xs border-cyan-500/50 text-cyan-300 bg-cyan-500/10"
                >
                  {card.attribute}
                </Badge>
              )}
              <Badge className={`text-xs ${getBanStatusColor(banStatus)}`}>
                {banStatus}
              </Badge>
              {quantity >= maxCopies && (
                <Badge
                  variant="outline"
                  className="text-xs border-yellow-500/50 text-yellow-300 bg-yellow-500/10"
                >
                  Max: {maxCopies}
                </Badge>
              )}
            </div>
          </div>

          {/* Quantity display only */ }
          <div className="flex items-center gap-2 flex-shrink-0">
            <span className="text-sm font-semibold text-slate-50 min-w-[2ch] text-center">
              {quantity}x
            </span>
            {quantity >= maxCopies && (
              <Badge
                variant="outline"
                className="text-xs border-yellow-500/50 text-yellow-300 bg-yellow-500/10"
              >
                Max: {maxCopies}
              </Badge>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}, (prevProps, nextProps) => {
  // Phase 6: Custom comparison for memoization
  // Only re-render if these props change
  return (
    prevProps.card.id === nextProps.card.id &&
    prevProps.quantity === nextProps.quantity &&
    prevProps.maxCopies === nextProps.maxCopies &&
    prevProps.banStatus === nextProps.banStatus &&
    prevProps.section === nextProps.section &&
    prevProps.isBeingDragged === nextProps.isBeingDragged &&
    prevProps.canIncrement === nextProps.canIncrement &&
    prevProps.canDecrement === nextProps.canDecrement
  );
});

