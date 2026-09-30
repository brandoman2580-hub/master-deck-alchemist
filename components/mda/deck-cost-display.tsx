"use client";

import { useMemo } from "react";
import { Gem } from "lucide-react";
import { getDeckCostSummary } from "@/lib/card/pricing";
import { getRarityBadge } from "@/lib/card/rarity";
import { RarityBadge } from "@/components/ui/rarity-badge";
import type { DeckType, DeckMode } from "@/types/deck";
import type { Card } from "@/types/card";

interface DeckCostDisplayProps {
  deck: DeckType;
  deckFormat: DeckMode;
  mdRarityMap?: Map<number, string>;
  /** Card pool lookup (id -> card) to enrich deck cards with prices when missing */
  cardLookup?: Map<number, Card>;
}

/**
 * Displays deck cost: TCG (TCGPlayer + Cardmarket) or Master Duel (per-rarity CP).
 */
export function DeckCostDisplay({
  deck,
  deckFormat,
  mdRarityMap,
  cardLookup,
}: DeckCostDisplayProps) {
  const summary = useMemo(
    () =>
      getDeckCostSummary(
        deck,
        deckFormat === "TCG" ? "TCG" : "Master Duel",
        mdRarityMap,
        cardLookup,
      ),
    [deck, deckFormat, mdRarityMap, cardLookup],
  );

  if (summary.format === "Master Duel" && summary.masterDuel?.totalCards === 0) {
    return null;
  }

  return (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-white/80">
      {summary.format === "TCG" && summary.tcg && (
        <>
          <span className="flex items-center gap-1">
            <span className="text-white/60">TCGPlayer</span>
            <span className="font-medium text-cyan-300">
              {summary.tcg.tcgplayer?.formatted ?? "ΓÇö"}
            </span>
          </span>
          <span className="text-white/40">ΓÇó</span>
          <span className="flex items-center gap-1">
            <span className="text-white/60">Cardmarket</span>
            <span className="font-medium text-cyan-300">
              {summary.tcg.cardmarket?.formatted ?? "ΓÇö"}
            </span>
          </span>
          <span className="text-white/40">ΓÇó</span>
          <span className="flex items-center gap-1">
            <span className="text-white/60">Amazon</span>
            <span className="font-medium text-cyan-300">
              {summary.tcg.amazon?.formatted ?? "ΓÇö"}
            </span>
          </span>
          <span className="text-white/40">ΓÇó</span>
          <span className="flex items-center gap-1">
            <span className="text-white/60">eBay</span>
            <span className="font-medium text-cyan-300">
              {summary.tcg.ebay?.formatted ?? "ΓÇö"}
            </span>
          </span>
        </>
      )}
      {summary.format === "Master Duel" && summary.masterDuel && (
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
          {(["UR", "SR", "R", "N"] as const).map((rarity) => {
            const data = summary.masterDuel![rarity];
            const rarityBadge = getRarityBadge(rarity);
            if (!rarityBadge) return null;
            return (
              <span
                key={rarity}
                className="flex items-center gap-1.5"
                title={`${rarity} ${data.count} card${data.count !== 1 ? "s" : ""} ├ù 30 CP`}
              >
                <Gem className="h-3.5 w-3.5 text-cyan-400/90 flex-shrink-0" aria-hidden />
                <RarityBadge result={rarityBadge} size="xs" />
                <span className="font-medium">{data.cp} CP</span>
              </span>
            );
          })}
          {summary.masterDuel.totalCards > 0 &&
            summary.masterDuel.UR.count === 0 &&
            summary.masterDuel.SR.count === 0 &&
            summary.masterDuel.R.count === 0 &&
            summary.masterDuel.N.count === 0 && (
              <span className="flex items-center gap-1">
                <Gem className="h-3.5 w-3.5 text-cyan-400/90" aria-hidden />
                <span className="font-medium">
                  Total {summary.masterDuel.totalCP} CP
                </span>
              </span>
            )}
        </div>
      )}
    </div>
  );
}
