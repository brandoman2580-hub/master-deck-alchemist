"use client";

import type { DeckCoachResponse } from "@/lib/engine/assistant-contract";

interface CoachAnswerBlockProps {
  answer: string;
  mode?: DeckCoachResponse["mode"];
  confidence?: DeckCoachResponse["confidence"];
}

const MODE_LABEL: Record<NonNullable<CoachAnswerBlockProps["mode"]>, string> = {
  qa: "Ask",
  tune_copies: "Routed as Tuning",
  discover_synergy: "Routed as Synergy",
  optimize: "Routed as Optimize",
};

/**
 * Primary coach answer with chrome mode/confidence label.
 */
export function CoachAnswerBlock({
  answer,
  mode,
  confidence,
}: CoachAnswerBlockProps) {
  return (
    <div className="space-y-1.5">
      {mode ? (
        <p className="font-mda text-xs font-semibold uppercase tracking-wide text-mda-ink-muted">
          {MODE_LABEL[mode]}
          {confidence ? ` · ${confidence}` : ""}
        </p>
      ) : null}
      <p className="whitespace-pre-wrap font-open-sans text-sm leading-relaxed text-mda-ink">
        {answer}
      </p>
    </div>
  );
}
