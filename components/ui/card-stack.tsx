"use client";

import { useMemo, useRef } from "react";
import { useDraggable } from "@dnd-kit/core";
import { CSS } from "@dnd-kit/utilities";
import { Badge } from "./badge";
import { Card } from "../../types/card";
import { BanStatus } from "../../types/types";
import { CardPreview } from "./card-preview";
import Image from "next/image";

export interface CardStackProps {
  card: Card;
  remainingCopies: number;
  maxCopies: number;
  banStatus: BanStatus;
  isBeingDragged: boolean;
  onStackClick?: () => void;
  onDoubleClick?: (card: Card) => void;
  currentCount?: number; // Optional: show how many copies are in deck
}

export function CardStack({
  card,
  remainingCopies,
  maxCopies,
  banStatus,
  isBeingDragged,
  onStackClick,
  onDoubleClick,
  currentCount = 0,
}: CardStackProps) {
  // Consistent drag id per card row
  const dragInstanceId = useMemo(() => `browser-${card.id}`, [card.id]);
  const disabled = remainingCopies === 0;

  const cardRef = useRef<HTMLDivElement>(null);

  const { attributes, listeners, setNodeRef, transform } = useDraggable({
    id: dragInstanceId,
    data: {
      type: "browser",
      cardId: card.id,
      card, // Can remove for perf if needed, but useful for drag overlay
    },
    disabled,
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

  const handleDoubleClick = () => {
    if (!disabled && onDoubleClick) {
      onDoubleClick(card);
    }
  };

  return (
    <CardPreview card={card} banStatus={banStatus}>
      <div
        className={`relative overflow-visible rounded-lg bg-white/5 border border-white/10 backdrop-blur-md p-2 transition-all ${
          isBeingDragged ? "opacity-50" : ""
        } ${!disabled ? "cursor-pointer hover:bg-white/10 hover:border-white/20" : ""}`}
      >
        <div ref={cardRef} onDoubleClick={handleDoubleClick}>
          <div className="flex gap-3 items-center p-1">
            {/* DRAGGABLE STACK IMAGE -- IMAGES ARE HIDDEN WHILE isBeingDragged */}
            <div
              ref={setNodeRef}
              style={{
                ...style,
                position: "relative",
                // Below: ensure pointer events remain (for future extensions)
              }}
              {...listeners}
              {...attributes}
              className={`relative w-12 h-[72px] flex-shrink-0 flex items-center justify-center transition-all
    ${
      disabled
        ? "cursor-not-allowed opacity-60"
        : "cursor-grab active:cursor-grabbing"
    }
    ${isBeingDragged ? "opacity-0 pointer-events-none" : ""}
  `}
              onClick={onStackClick}
            >
              {!isBeingDragged && (
                <>
                  {Array.from(
                    { length: Math.min(maxCopies, 3) },
                    (_, index) => (
                      <div
                        key={index}
                        className={`absolute shadow-sm ${
                          disabled ? "opacity-40" : ""
                        }`}
                        style={{
                          left: `${index * 2}px`,
                          top: `${index * 2}px`,
                          zIndex: maxCopies - index,
                        }}
                      >
                        <Image
                          width={80}
                          height={120}
                          src={
                            card.card_images[0].image_url_small ||
                            "/placeholder.svg"
                          }
                          alt={card.name}
                          className="w-full h-auto object-contain"
                          style={{
                            filter: index > 0 ? "brightness(0.8)" : "none",
                          }}
                        />
                      </div>
                    ),
                  )}
                </>
              )}
              {/* Available Count Badge */}
              {!isBeingDragged && remainingCopies > 0 && (
                <div className="absolute -top-1 -right-1 z-10">
                  <Badge
                    variant="secondary"
                    className="text-xs px-1.5 py-0.5 min-w-[20px] h-5 flex items-center justify-center border font-semibold bg-white/10 border-white/20 text-white backdrop-blur-sm"
                  >
                    {remainingCopies}
                  </Badge>
                </div>
              )}
              
              {/* In-deck count badge */}
              {!isBeingDragged && currentCount > 0 && (
                <div className="absolute -bottom-1 -left-1 z-10">
                  <Badge
                    variant="secondary"
                    className="bg-white/10 text-white text-[10px] px-1 py-0 min-w-[16px] h-4 flex items-center justify-center border border-white/20 font-semibold backdrop-blur-sm"
                  >
                    {currentCount}x
                  </Badge>
                </div>
              )}
            </div>

            {/* Card Info */}
            <div className="flex-1 min-w-0">
              <h4 className="font-medium text-sm truncate text-slate-50">
                {card.name}
              </h4>
              <div className="flex flex-wrap gap-1 mt-1.5">
                <Badge
                  variant="outline"
                  className="text-xs border-white/20 text-white/80"
                >
                  {card.type}
                </Badge>
                {card.attribute && (
                  <Badge
                    variant="outline"
                    className="text-xs border-white/20 text-white/80"
                  >
                    {card.attribute}
                  </Badge>
                )}
                <Badge className={`text-xs ${getBanStatusColor(banStatus)}`}>
                  {banStatus}
                </Badge>
              </div>
              <p className="text-xs text-slate-400 mt-1.5 line-clamp-2">
                {card.desc}
              </p>
            </div>
          </div>
        </div>
      </div>
    </CardPreview>
  );
}
