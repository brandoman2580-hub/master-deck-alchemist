"use client";

import { CardImage } from "@/components/ui/card-image";
import { MdaCardPreview } from "@/components/mda/mda-card-preview";
import type { Card } from "@/types/card";
import { masterDuelRarityLabel } from "@/lib/workshop/deck-row-meta";

interface RecommendationCardProps {
  title: string;
  roleTag?: string;
  effectLines: string[];
  card: Card | undefined;
  onAdd: () => void;
  disabled?: boolean;
  disabledReason?: string;
  addLabel?: string;
  deltaLabel?: string;
  showRarity?: boolean;
}

/**
 * Add row inside a Strategist plate: art, name, rarity, destination, role, bullets.
 */
export function RecommendationCard({
  title,
  roleTag,
  effectLines,
  card,
  onAdd,
  disabled = false,
  disabledReason,
  addLabel = "Add",
  deltaLabel = "Main +1",
  showRarity = false,
}: RecommendationCardProps) {
  const lines = effectLines.filter((line) => line.trim().length > 0).slice(0, 4);
  const rarity = card && showRarity ? masterDuelRarityLabel(card) : null;

  const thumb = (
    <div className="relative h-8 w-6 shrink-0 overflow-hidden border border-[#28303b] bg-[#0c0e12]">
      {card ? (
        <CardImage card={card} preferSmall fill alt="" className="object-cover" sizes="24px" />
      ) : null}
    </div>
  );

  return (
    <article
      className="border border-[#c1ccd4] bg-[#f4f7f9] p-2"
      aria-label={`Recommendation: ${title}`}
    >
      <div className="flex items-center justify-between gap-2">
        <div className="flex min-w-0 items-center gap-2">
          {card ? <MdaCardPreview card={card}>{thumb}</MdaCardPreview> : thumb}
          <div className="min-w-0">
            <div className="flex items-center gap-1">
              <h3 className="truncate text-xs font-semibold text-[#0c0e12]">{title}</h3>
              {rarity ? (
                <span className="bg-[#0c0e12] px-1 text-[8px] font-bold uppercase text-[#f7fcff]">
                  {rarity}
                </span>
              ) : null}
            </div>
            <div className="mt-0.5 flex flex-wrap items-center gap-1.5">
              <span className="text-[11px] text-[#5b6369]">{deltaLabel}</span>
              {roleTag ? (
                <span className="bg-[#e4ebf0] px-1 text-[8px] font-semibold uppercase tracking-wide text-[#333d4b]">
                  {roleTag}
                </span>
              ) : null}
            </div>
          </div>
        </div>
        <button
          type="button"
          onClick={onAdd}
          disabled={disabled}
          title={disabledReason}
          className="flex h-6 shrink-0 items-center border border-[#28303b] bg-[#14181f] px-2.5 text-[10px] font-semibold uppercase tracking-[0.12em] text-[#e2e2e8] transition-colors hover:border-[#bfe5f3] disabled:cursor-not-allowed disabled:opacity-40"
          aria-label={
            disabled ? disabledReason || `Cannot add ${title}` : `Add ${title} to deck`
          }
        >
          {addLabel}
        </button>
      </div>
      {lines.length > 0 ? (
        <ul className="mt-2 space-y-1 pl-1 text-[11px] leading-snug text-[#41484a]">
          {lines.map((line) => (
            <li key={line}>• {line}</li>
          ))}
        </ul>
      ) : null}
    </article>
  );
}
