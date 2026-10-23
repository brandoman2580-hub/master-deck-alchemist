"use client";

import { CardImage } from "@/components/ui/card-image";
import type { TuningRecommendation } from "@/lib/engine/assistant-contract";
import type { Card } from "@/types/card";
import { masterDuelRarityLabel } from "@/lib/workshop/deck-row-meta";

interface TuningActionRowProps {
  recommendation: TuningRecommendation;
  cardName: string;
  onApply: () => void;
  disabled?: boolean;
  applied?: boolean;
  card?: Card;
  showRarity?: boolean;
}

/**
 * Copy-change row: art, name, rarity, Main N → M, Apply.
 */
export function TuningActionRow({
  recommendation,
  cardName,
  onApply,
  disabled = false,
  applied = false,
  card,
  showRarity = false,
}: TuningActionRowProps) {
  const rarity = card && showRarity ? masterDuelRarityLabel(card) : null;

  return (
    <div className="flex items-center justify-between gap-2 border border-[#c1ccd4] bg-[#f4f7f9] p-2">
      <div className="flex min-w-0 items-center gap-2">
        <div className="relative h-8 w-6 shrink-0 overflow-hidden border border-[#28303b] bg-[#0c0e12]">
          {card ? (
            <CardImage card={card} preferSmall fill sizes="24px" alt="" />
          ) : null}
        </div>
        <div className="min-w-0">
          <div className="flex items-center gap-1">
            <p className="truncate text-xs font-semibold text-[#0c0e12]">{cardName}</p>
            {rarity ? (
              <span className="bg-[#0c0e12] px-1 text-[8px] font-bold uppercase text-[#f7fcff]">
                {rarity}
              </span>
            ) : null}
          </div>
          <p className="text-[11px] text-[#5b6369]">
            Main {recommendation.fromCopies} → {recommendation.toCopies}
          </p>
        </div>
      </div>
      <button
        type="button"
        onClick={onApply}
        disabled={disabled || applied}
        className="flex h-6 shrink-0 items-center border border-[#28303b] bg-[#14181f] px-2.5 text-[10px] font-semibold uppercase tracking-[0.12em] text-[#e2e2e8] transition-colors hover:border-[#bfe5f3] disabled:cursor-not-allowed disabled:opacity-40"
        aria-label={
          applied
            ? `Already applied ${cardName} copies`
            : `Apply ${cardName} ${recommendation.fromCopies} to ${recommendation.toCopies}`
        }
      >
        {applied ? "Applied" : "Apply"}
      </button>
    </div>
  );
}
