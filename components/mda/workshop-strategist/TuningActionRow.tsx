"use client";

import type { TuningRecommendation } from "@/lib/engine/assistant-contract";

interface TuningActionRowProps {
  recommendation: TuningRecommendation;
  cardName: string;
  onApply: () => void;
  disabled?: boolean;
  applied?: boolean;
}

/**
 * Single tuning row with Apply CTA (N→M copies).
 */
export function TuningActionRow({
  recommendation,
  cardName,
  onApply,
  disabled = false,
  applied = false,
}: TuningActionRowProps) {
  return (
    <div className="flex items-center gap-2 border border-mda-chrome/50 bg-mda-chrome/10 px-2 py-1.5">
      <div className="min-w-0 flex-1">
        <p className="truncate font-mda text-xs font-semibold text-mda-ink">
          {cardName}
        </p>
        <p className="font-open-sans text-sm text-mda-ink">
          {recommendation.fromCopies} → {recommendation.toCopies}
          {recommendation.changeReason ? (
            <span className="ml-1 text-mda-ink-muted/80">
              · {recommendation.changeReason.slice(0, 72)}
              {recommendation.changeReason.length > 72 ? "…" : ""}
            </span>
          ) : null}
        </p>
      </div>
      <button
        type="button"
        onClick={onApply}
        disabled={disabled || applied}
        data-magnetic={!disabled && !applied ? true : undefined}
        className="inline-flex min-h-11 shrink-0 items-center bg-mda-chrome px-3 font-mda text-xs font-bold uppercase tracking-wide text-mda-inverse-text transition-colors hover:bg-mda-chrome-deep disabled:cursor-not-allowed disabled:opacity-40"
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
