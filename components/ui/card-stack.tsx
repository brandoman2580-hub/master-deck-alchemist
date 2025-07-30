"use client";

import { useMemo } from "react";
import { useDraggable } from "@dnd-kit/core";
import { CSS } from "@dnd-kit/utilities";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/types/card";
import { BanStatus } from "@/types/types";
import Image from "next/image";

interface CardStackProps {
  card: Card;
  remainingCopies: number;
  maxCopies: number;
  banStatus: BanStatus;
  isBeingDragged: boolean;
  onStackClick?: () => void;
  onDoubleClick?: (card: Card) => void;
}

export function CardStack({
  card,
  remainingCopies,
  maxCopies,
  banStatus,
  isBeingDragged,
  onStackClick,
  onDoubleClick,
}: CardStackProps) {
  // Consistent drag id per card row
  const dragInstanceId = useMemo(() => `browser-${card.id}`, [card.id]);
  const disabled = remainingCopies === 0;

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
        return "bg-red-500 text-white";
      case "Limited":
        return "bg-yellow-500 text-black";
      case "Semi-Limited":
        return "bg-orange-500 text-white";
      default:
        return "bg-green-500 text-white";
    }
  };

  const handleDoubleClick = () => {
    if (!disabled && onDoubleClick) {
      onDoubleClick(card);
    }
  };

  return (
    <div
      className={`p-2 border-b hover:bg-accent/10 ${
        isBeingDragged ? "opacity-50" : ""
      } ${!disabled ? "cursor-pointer" : ""}`}
      onDoubleClick={handleDoubleClick}
    >
      <div className="flex gap-3">
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
          className={`relative w-12 h-18 flex-shrink-0 transition-all
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
              {Array.from({ length: Math.min(maxCopies, 3) }, (_, index) => (
                <div
                  key={index}
                  className={`absolute rounded shadow-sm ${
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
                      card.card_images[0].image_url_small || "/placeholder.svg"
                    }
                    alt={card.name}
                    className="w-full h-auto object-contain rounded"
                    style={{
                      filter: index > 0 ? "brightness(0.8)" : "none",
                    }}
                  />
                </div>
              ))}
            </>
          )}
          {/* Badge: can hide it too, or fade, if you wish */}
          {!isBeingDragged && (
            <div className="absolute -top-1 -right-1 z-10">
              <Badge
                variant="secondary"
                className={`text-xs px-1 py-0 min-w-[20px] h-5 flex items-center justify-center ${
                  remainingCopies === 0
                    ? "bg-gray-400"
                    : "bg-blue-500 text-white"
                }`}
              >
                {remainingCopies}
              </Badge>
            </div>
          )}
        </div>

        {/* Card Info */}
        <div className="flex-1 min-w-0">
          <h4 className="font-medium text-sm truncate">{card.name}</h4>
          <div className="flex flex-wrap gap-1 mt-1">
            <Badge variant="outline" className="text-xs">
              {card.type}
            </Badge>
            {card.attribute && (
              <Badge variant="outline" className="text-xs">
                {card.attribute}
              </Badge>
            )}
            <Badge className={`text-xs ${getBanStatusColor(banStatus)}`}>
              {banStatus}
            </Badge>
          </div>
          <p className="text-xs text-muted-foreground mt-1 line-clamp-2">
            {card.desc}
          </p>
        </div>
        {/* Stack Info */}
        <div className="flex flex-col items-end justify-center text-xs text-muted-foreground">
          <span>
            {remainingCopies}/{maxCopies}
          </span>
          <span>left</span>
        </div>
      </div>
    </div>
  );
}
