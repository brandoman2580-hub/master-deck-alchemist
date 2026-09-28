"use client";

import { CardImage } from "@/components/ui/card-image";
import { MdaCardPreview } from "@/components/mda/mda-card-preview";
import type { SynergyCandidate } from "@/lib/engine/assistant-contract";
import type { Card } from "@/types/card";

interface SynergyActionRowProps {
  synergy: SynergyCandidate;
  card: Card | undefined;
  onAdd: () => void;
  disabled?: boolean;
  disabledReason?: string;
}

/**
 * Synergy candidate row with Add CTA and MDA hover preview.
 * Prefer card-specific fitSummary; never show bare shared genericCondition alone.
 */
export function SynergyActionRow({
  synergy,
  card,
  onAdd,
  disabled = false,
  disabledReason,
}: SynergyActionRowProps) {
  const blurb =
    synergy.fitSummary?.trim() ||
    synergy.genericCondition?.trim() ||
    "Mechanical synergy candidate";

  const thumb = (
    <div className="relative h-14 w-10 shrink-0 overflow-hidden bg-mda-chrome/30">
      {card ? (
        <CardImage
          card={card}
          preferSmall
          fill
          alt={synergy.title}
          className="object-contain"
          sizes="40px"
        />
      ) : (
        <div className="flex h-full items-center justify-center font-mda text-[9px] text-mda-ink-muted">
          N/A
        </div>
      )}
    </div>
  );

  return (
    <div className="flex items-center gap-2 border border-mda-chrome/50 bg-mda-chrome/10 px-2 py-1.5">
      {card ? <MdaCardPreview card={card}>{thumb}</MdaCardPreview> : thumb}
      <div className="min-w-0 flex-1">
        <p className="truncate font-mda text-xs font-semibold text-mda-ink">
          {synergy.title}
        </p>
        <p className="line-clamp-2 font-open-sans text-[11px] text-mda-ink-muted">
          {blurb}
        </p>
      </div>
      <button
        type="button"
        onClick={onAdd}
        disabled={disabled}
        title={disabledReason}
        data-magnetic={!disabled ? true : undefined}
        className="shrink-0 bg-mda-chrome px-2.5 py-1.5 font-mda text-[10px] font-bold uppercase tracking-wide text-mda-inverse-text transition-colors hover:bg-mda-chrome-deep disabled:cursor-not-allowed disabled:opacity-40"
        aria-label={
          disabled
            ? disabledReason || `Cannot add ${synergy.title}`
            : `Add ${synergy.title} to deck`
        }
      >
        Add
      </button>
    </div>
  );
}
