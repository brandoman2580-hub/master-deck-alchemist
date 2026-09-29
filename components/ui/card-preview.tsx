"use client";

import { Card } from "../../types/card";
import { Badge } from "./badge";
import { RarityBadge } from "./rarity-badge";
import { CardImage } from "./card-image";
import * as Tooltip from "@radix-ui/react-tooltip";
import { getArchetypeName } from "../../lib/deck/import";
import { getRarityBadge, getCardRarityForDisplay } from "@/lib/card/rarity";
import { getCardTCGPrices, MASTER_DUEL_CP_PER_CARD } from "@/lib/card/pricing";
import { Gem } from "lucide-react";
import type { DeckMode } from "@/types/deck";

interface CardPreviewProps {
  card: Card;
  children: React.ReactNode;
  banStatus?: string;
  deckMode?: DeckMode;
  mdRarityOverride?: string | null;
}

export function CardPreview({
  card,
  children,
  banStatus,
  deckMode,
  mdRarityOverride,
}: CardPreviewProps) {
  return (
    <Tooltip.Provider delayDuration={0} disableHoverableContent>
      <Tooltip.Root>
        <Tooltip.Trigger asChild>{children}</Tooltip.Trigger>
        <Tooltip.Portal>
          <Tooltip.Content
            className="z-50 w-[480px] max-w-[calc(100vw-3rem)] rounded-xl border border-white/20 bg-white/10 backdrop-blur-xl shadow-lg p-4 pointer-events-none"
            side="right"
            sideOffset={10}
            align="start"
            collisionPadding={32}
            alignOffset={-5}
            avoidCollisions
          >
            <div className="flex gap-3">
              {/* Card Image */}
              <div className="flex-shrink-0">
                <CardImage
                  card={card}
                  preferSmall={false}
                  width={160}
                  height={235}
                  alt={card.name}
                  className="w-[160px] h-auto object-contain rounded"
                />
              </div>

              {/* Card Information */}
              <div className="flex-1 min-w-0 space-y-3">
                <div>
                  <h3
                    className="font-bold text-base leading-tight text-slate-50"
                    style={{ fontFamily: "var(--font-heading)" }}
                  >
                    {card.name}
                  </h3>
                  <div className="flex flex-wrap gap-1 mt-2">
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
                    {card.race && (
                      <Badge
                        variant="outline"
                        className="text-xs border-white/20 text-white/80"
                      >
                        {card.race}
                      </Badge>
                    )}
                    {banStatus && banStatus !== "Unlimited" && (
                      <Badge
                        className={`text-xs ${
                          banStatus === "Forbidden"
                            ? "bg-red-500"
                            : banStatus === "Limited"
                              ? "bg-yellow-500 text-black"
                              : banStatus === "Semi-Limited"
                                ? "bg-orange-500"
                                : "bg-green-500"
                        }`}
                      >
                        {banStatus}
                      </Badge>
                    )}
                    {/* Rarity badge - Master Duel only; TCG focuses on price */}
                    {deckMode !== "TCG" &&
                      (() => {
                        const rarity = getCardRarityForDisplay(
                          card,
                          deckMode ?? "Master Duel",
                          mdRarityOverride,
                        );
                        const rarityBadge = getRarityBadge(rarity, mdRarityOverride ?? rarity);
                        return rarityBadge ? (
                          <RarityBadge result={rarityBadge} size="md" />
                        ) : null;
                      })()}
                  </div>
                </div>

                {/* Price / Craft Cost */}
                {deckMode === "TCG" && (() => {
                  const prices = getCardTCGPrices(card);
                  const hasAny =
                    prices.tcgplayer ||
                    prices.cardmarket ||
                    prices.amazon ||
                    prices.ebay;
                  if (!hasAny) return null;
                  return (
                    <div className="flex flex-wrap gap-x-3 gap-y-1 text-sm text-white/90">
                      {prices.tcgplayer && (
                        <span>
                          <span className="text-white/60">TCGPlayer</span>{" "}
                          <span className="font-medium text-cyan-300">
                            {prices.tcgplayer.formatted}
                          </span>
                        </span>
                      )}
                      {prices.cardmarket && (
                        <span>
                          <span className="text-white/60">Cardmarket</span>{" "}
                          <span className="font-medium text-cyan-300">
                            {prices.cardmarket.formatted}
                          </span>
                        </span>
                      )}
                      {prices.amazon && (
                        <span>
                          <span className="text-white/60">Amazon</span>{" "}
                          <span className="font-medium text-cyan-300">
                            {prices.amazon.formatted}
                          </span>
                        </span>
                      )}
                      {prices.ebay && (
                        <span>
                          <span className="text-white/60">eBay</span>{" "}
                          <span className="font-medium text-cyan-300">
                            {prices.ebay.formatted}
                          </span>
                        </span>
                      )}
                    </div>
                  );
                })()}
                {deckMode === "Master Duel" && (
                  <p className="text-sm text-white/90 flex items-center gap-1.5">
                    <Gem className="h-3.5 w-3.5 text-cyan-400/90" aria-hidden />
                    <span className="font-medium text-cyan-300">
                      {MASTER_DUEL_CP_PER_CARD} CP
                    </span>
                  </p>
                )}

                {/* Stats */}
                {(card.atk !== undefined ||
                  card.def !== undefined ||
                  card.level !== undefined) &&
                  card.type !== "Spell Card" &&
                  card.type !== "Trap Card" && (
                    <div className="space-y-1">
                      {card.level !== undefined && (
                        <p className="text-sm flex items-baseline gap-1.5">
                          <span className="text-xs uppercase tracking-wider text-white/50 font-medium">
                            Level
                          </span>
                          <span className="font-semibold text-white/95">
                            {card.level}
                          </span>
                        </p>
                      )}
                      {card.atk !== undefined && (
                        <p className="text-sm flex items-baseline gap-1.5 flex-wrap">
                          <span className="text-xs uppercase tracking-wider text-white/50 font-medium">
                            ATK
                          </span>
                          <span className="font-semibold text-white/95">
                            {card.atk}
                          </span>
                          {card.def !== undefined && (
                            <>
                              <span className="text-white/40">/</span>
                              <span className="text-xs uppercase tracking-wider text-white/50 font-medium">
                                DEF
                              </span>
                              <span className="font-semibold text-white/95">
                                {card.def}
                              </span>
                            </>
                          )}
                        </p>
                      )}
                    </div>
                  )}

                {/* Archetype */}
                {(() => {
                  const archetypeName = getArchetypeName(card);
                  return archetypeName ? (
                    <p className="text-sm flex items-baseline gap-1.5">
                      <span className="text-xs uppercase tracking-wider text-white/50 font-medium">
                        Archetype
                      </span>
                      <span className="font-semibold text-white/95">
                        {archetypeName}
                      </span>
                    </p>
                  ) : null;
                })()}

                {/* Description */}
                <div className="text-sm text-white/80 leading-relaxed">
                  {card.desc}
                </div>
              </div>
            </div>

            <Tooltip.Arrow className="fill-white/20" />
          </Tooltip.Content>
        </Tooltip.Portal>
      </Tooltip.Root>
    </Tooltip.Provider>
  );
}
