"use client";

import { Card } from "@/types/card";
import { Badge } from "@/components/ui/badge";
import Image from "next/image";
import * as Tooltip from "@radix-ui/react-tooltip";

interface CardPreviewProps {
  card: Card;
  children: React.ReactNode;
  banStatus?: string;
}

export function CardPreview({ card, children, banStatus }: CardPreviewProps) {
  return (
    <Tooltip.Provider delayDuration={0}>
      <Tooltip.Root>
        <Tooltip.Trigger asChild>
          {children}
        </Tooltip.Trigger>
        <Tooltip.Portal>
          <Tooltip.Content
            className="z-50 bg-card border border-border rounded-lg shadow-xl p-6 w-[500px] max-w-[90vw]"
            side="right"
            sideOffset={15}
            align="center"
            collisionPadding={10}
          >
            <div className="flex gap-5">
              {/* Card Image */}
              <div className="flex-shrink-0">
                <Image
                  width={160}
                  height={235}
                  src={card.card_images[0].image_url || "/placeholder.svg"}
                  alt={card.name}
                  className="w-[160px] h-auto object-contain rounded"
                />
              </div>

              {/* Card Information */}
              <div className="flex-1 min-w-0 space-y-3">
                <div>
                  <h3 className="font-bold text-base leading-tight text-card-foreground">{card.name}</h3>
                  <div className="flex flex-wrap gap-1 mt-2">
                    <Badge variant="outline" className="text-xs">
                      {card.type}
                    </Badge>
                    {card.attribute && (
                      <Badge variant="outline" className="text-xs">
                        {card.attribute}
                      </Badge>
                    )}
                    {card.race && (
                      <Badge variant="outline" className="text-xs">
                        {card.race}
                      </Badge>
                    )}
                    {banStatus && banStatus !== "Unlimited" && (
                      <Badge 
                        className={`text-xs ${
                          banStatus === "Forbidden" ? "bg-red-500" :
                          banStatus === "Limited" ? "bg-yellow-500 text-black" :
                          banStatus === "Semi-Limited" ? "bg-orange-500" :
                          "bg-green-500"
                        }`}
                      >
                        {banStatus}
                      </Badge>
                    )}
                  </div>
                </div>

                {/* Stats */}
                {(card.atk !== undefined || card.def !== undefined || card.level !== undefined) && card.type !== "Spell Card" && card.type !== "Trap Card" && (
                  <div className="space-y-1">
                    {card.level !== undefined && (
                      <p className="text-sm text-card-foreground">
                        <span className="font-medium">Level:</span> {card.level}
                      </p>
                    )}
                    {card.atk !== undefined && (
                      <p className="text-sm text-card-foreground">
                        <span className="font-medium">ATK:</span> {card.atk} 
                        {card.def !== undefined && <span> / <span className="font-medium">DEF:</span> {card.def}</span>}
                      </p>
                    )}
                  </div>
                )}

                {/* Archetype */}
                {card.archetype && (
                  <p className="text-sm text-card-foreground">
                    <span className="font-medium">Archetype:</span> {card.archetype}
                  </p>
                )}

                {/* Description */}
                <div className="text-sm text-muted-foreground leading-relaxed">
                  {card.desc}
                </div>
              </div>
            </div>
            
            <Tooltip.Arrow className="fill-border" />
          </Tooltip.Content>
        </Tooltip.Portal>
      </Tooltip.Root>
    </Tooltip.Provider>
  );
}
