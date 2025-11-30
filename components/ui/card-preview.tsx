"use client";

import { Card } from "../../types/card.ts";
import { Badge } from "./badge.tsx";
import Image from "next/image";
import * as Tooltip from "@radix-ui/react-tooltip";
import { getArchetypeName } from "../../lib/helpers.ts";

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
            className="z-50 bg-slate-950/95 bg-gradient-to-b from-cyan-400/30 via-cyan-500/25 to-cyan-600/15 backdrop-blur-md border border-cyan-500/30 rounded-lg shadow-xl p-4 sm:p-6 w-[90vw] sm:w-[500px] max-w-[min(500px,calc(100vw-1rem))]"
            side="right"
            sideOffset={10}
            align="start"
            collisionPadding={24}
            alignOffset={-5}
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
                  <h3 className="font-bold text-base leading-tight text-slate-50" style={{ fontFamily: "var(--font-heading)" }}>{card.name}</h3>
                  <div className="flex flex-wrap gap-1 mt-2">
                    <Badge variant="outline" className="text-xs border-cyan-500/50 text-cyan-300">
                      {card.type}
                    </Badge>
                    {card.attribute && (
                      <Badge variant="outline" className="text-xs border-cyan-500/50 text-cyan-300">
                        {card.attribute}
                      </Badge>
                    )}
                    {card.race && (
                      <Badge variant="outline" className="text-xs border-cyan-500/50 text-cyan-300">
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
                      <p className="text-sm text-slate-200">
                        <span className="font-medium text-cyan-300">Level:</span> {card.level}
                      </p>
                    )}
                    {card.atk !== undefined && (
                      <p className="text-sm text-slate-200">
                        <span className="font-medium text-cyan-300">ATK:</span> {card.atk} 
                        {card.def !== undefined && <span> / <span className="font-medium text-cyan-300">DEF:</span> {card.def}</span>}
                      </p>
                    )}
                  </div>
                )}

                {/* Archetype */}
                {(() => {
                  const archetypeName = getArchetypeName(card);
                  return archetypeName ? (
                    <p className="text-sm text-slate-200">
                      <span className="font-medium text-cyan-300">Archetype:</span> {archetypeName}
                    </p>
                  ) : null;
                })()}

                {/* Description */}
                <div className="text-sm text-slate-300 leading-relaxed">
                  {card.desc}
                </div>
              </div>
            </div>
            
            <Tooltip.Arrow className="fill-cyan-500/30" />
          </Tooltip.Content>
        </Tooltip.Portal>
      </Tooltip.Root>
    </Tooltip.Provider>
  );
}
