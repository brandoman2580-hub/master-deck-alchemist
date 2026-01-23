// NOTE: extracted from app/deck-builder/page.tsx
"use client";

import { DragOverlay } from "@dnd-kit/core";
import { TooltipProvider } from "@/components/ui/tooltip";
import Image from "next/image";
import { Card } from "@/types/card";

interface DragOverlayComponentProps {
  activeDragCard: Card | null;
}

export function DragOverlayComponent({
  activeDragCard,
}: DragOverlayComponentProps) {
  return (
    <TooltipProvider>
      <DragOverlay dropAnimation={null}>
        {activeDragCard && (
          <div className="w-[100px] h-[146px] opacity-80">
            <Image
              width={80}
              height={120}
              src={
                activeDragCard.card_images?.[0]?.image_url_small ||
                "/placeholder.svg"
              }
              alt={activeDragCard.name}
              className="w-full h-full object-contain rounded-lg"
            />
          </div>
        )}
      </DragOverlay>
    </TooltipProvider>
  );
}

