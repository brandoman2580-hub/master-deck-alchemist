"use client";

import { CardImage } from "@/components/ui/card-image";
import { MdaCardPreview } from "@/components/mda/mda-card-preview";
import type { Card } from "@/types/card";

interface RecommendationCardProps {
  title: string;
  roleTag?: string;
  effectLines: string[];
  card: Card | undefined;
  onAdd: () => void;
  disabled?: boolean;
  disabledReason?: string;
  addLabel?: string;
}

/**
 * Figma QUERY/REQUEST recommendation card — art, uppercase name, role, bullets, ADD TO DECK.
 */
export function RecommendationCard({
  title,
  roleTag,
  effectLines,
  card,
  onAdd,
  disabled = false,
  disabledReason,
  addLabel = "Add to deck",
}: RecommendationCardProps) {
  const lines = effectLines.filter((line) => line.trim().length > 0).slice(0, 4);

  const thumb = (
    <div className="relative h-16 w-12 shrink-0 overflow-hidden bg-mda-chrome/30">
      {card ? (
        <CardImage
          card={card}
          preferSmall
          fill
          alt={title}
          className="object-contain"
          sizes="48px"
        />
      ) : (
        <div className="flex h-full items-center justify-center font-mda text-[9px] text-mda-ink-muted">
          N/A
        </div>
      )}
    </div>
  );

  return (
    <article
      className="border border-mda-chrome/40 bg-mda-surface-raised px-2.5 py-2"
      aria-label={`Recommendation: ${title}`}
    >
      <div className="flex gap-2.5">
        {card ? <MdaCardPreview card={card}>{thumb}</MdaCardPreview> : thumb}
        <div className="min-w-0 flex-1 space-y-1">
          <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
            <h3 className="truncate font-mda text-xs font-bold uppercase tracking-wide text-mda-ink-strong">
              {title}
            </h3>
            {roleTag ? (
              <span className="font-mda text-[9px] font-semibold uppercase tracking-wider text-mda-purple">
                {roleTag}
              </span>
            ) : null}
          </div>
          {lines.length > 0 ? (
            <ul className="space-y-0.5 font-open-sans text-[11px] leading-snug text-mda-ink-muted">
              {lines.map((line) => (
                <li key={line} className="flex gap-1.5">
                  <span aria-hidden className="text-mda-cyan">
                    •
                  </span>
                  <span className="line-clamp-2">{line}</span>
                </li>
              ))}
            </ul>
          ) : null}
        </div>
      </div>
      <div className="mt-2 flex justify-end">
        <button
          type="button"
          onClick={onAdd}
          disabled={disabled}
          title={disabledReason}
          data-magnetic={!disabled ? true : undefined}
          className="bg-transparent px-1 py-0.5 font-mda text-[10px] font-bold uppercase tracking-wide text-mda-cyan transition-colors hover:text-mda-cyan-soft disabled:cursor-not-allowed disabled:opacity-40"
          aria-label={
            disabled
              ? disabledReason || `Cannot add ${title}`
              : `Add ${title} to deck`
          }
        >
          {addLabel}
        </button>
      </div>
    </article>
  );
}
