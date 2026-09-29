"use client";

import { useId, type ReactNode } from "react";
import { HelpCircle } from "lucide-react";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import type { WorkshopGrade } from "@/lib/workshop/grade";
import type { DeckMode } from "@/types/deck";
import { cn } from "@/lib/utils";

const AXIS_BLURBS: Record<string, string> = {
  Consistency:
    "Opening-hand Monte Carlo: starter access, brick rate, and surviving one interruption. Synergy can nudge this score internally.",
  Power:
    "Endboard / extender / boss role density. Synergy can nudge this score internally. Not a ceiling-win-rate claim.",
  Resilience:
    'Survive interruption + low brick + soft matchup readiness, plus a format rule pack (TCG interaction density or MD Maxx "C" outs).',
  Disruption:
    "Hand trap, board breaker, and lock role counts, with a light TCG pack nudge when applicable.",
};

export type WorkshopGradeDisclaimerProps = {
  mode: DeckMode;
  grade: WorkshopGrade;
  className?: string;
};

/**
 * Trust surface for Workshop C/P/R/D grades — explains axes, format banlist,
 * and optional Facts Brain breakdown without claiming tournament prediction.
 */
export function WorkshopGradeDisclaimer({
  mode,
  grade,
  className,
}: WorkshopGradeDisclaimerProps): ReactNode {
  const titleId = useId();
  const isTcg = mode === "TCG";
  const banlistLabel = isTcg
    ? "TCG tournament banlist (US / world tournament standard)"
    : "Master Duel banlist (sets and list updates typically lag TCG)";

  const packLabel =
    grade.formatRulePack === "tcgTournament"
      ? "TCG tournament pack"
      : grade.formatRulePack === "masterDuelMaxxC"
        ? 'Master Duel Maxx "C" pack'
        : grade.formatRulePack
          ? String(grade.formatRulePack)
          : "Not applied (placeholder grade)";

  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          type="button"
          className={cn(
            "inline-flex min-h-11 min-w-11 items-center justify-center border-2 border-mda-chrome bg-transparent text-mda-ink transition-colors hover:bg-mda-chrome hover:text-mda-inverse-text focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-mda-chrome",
            className,
          )}
          aria-label="How workshop grade scores work"
        >
          <HelpCircle className="h-5 w-5" aria-hidden />
        </button>
      </PopoverTrigger>
      <PopoverContent
        align="end"
        sideOffset={8}
        className="max-h-[min(70vh,520px)] w-[min(100vw-2rem,24rem)] overflow-y-auto border-2 border-mda-chrome bg-mda-panel p-4 text-mda-ink shadow-mda-soft"
        aria-labelledby={titleId}
      >
        <div className="space-y-4 font-mda text-sm text-mda-ink">
          <div>
            <h2
              id={titleId}
              className="font-mda text-lg font-bold uppercase tracking-wide text-mda-ink-strong"
            >
              How scores work
            </h2>
            <p className="mt-1 text-mda-ink">
              Grades are heuristic Facts Brain metrics for tuning — not a
              predicted win rate or tournament seeding.
            </p>
          </div>

          <section aria-labelledby={`${titleId}-format`}>
            <h3
              id={`${titleId}-format`}
              className="text-xs font-bold uppercase tracking-widest text-mda-ink-strong"
            >
              Active format
            </h3>
            <p className="mt-1">
              Banlist in use: <strong>{banlistLabel}</strong>. TCG and Master
              Duel lists are never merged — the same card can be Unlimited in one
              format and Forbidden in the other.
            </p>
            <p className="mt-1">
              Rule pack: <strong>{packLabel}</strong>
              {typeof grade.synergyFactor === "number"
                ? ` · Internal synergy factor ${grade.synergyFactor.toFixed(2)} (Consistency/Power only; not a fifth score).`
                : null}
            </p>
          </section>

          <section aria-labelledby={`${titleId}-axes`}>
            <h3
              id={`${titleId}-axes`}
              className="text-xs font-bold uppercase tracking-widest text-mda-ink-strong"
            >
              KPI definitions
            </h3>
            <ul className="mt-2 space-y-2">
              {grade.scores.map((score) => (
                <li key={score.label}>
                  <strong className="text-mda-ink-strong">
                    {score.label} ({score.value})
                  </strong>
                  <span className="block text-mda-ink">
                    {AXIS_BLURBS[score.label] ??
                      "Derived from Facts Brain diagnostics."}
                  </span>
                </li>
              ))}
            </ul>
          </section>

          {grade.formatPackNotes && grade.formatPackNotes.length > 0 ? (
            <section aria-labelledby={`${titleId}-pack`}>
              <h3
                id={`${titleId}-pack`}
                className="text-xs font-bold uppercase tracking-widest text-mda-ink-strong"
              >
                Format pack notes
              </h3>
              <ul className="mt-2 list-disc space-y-1 pl-5">
                {grade.formatPackNotes.map((note) => (
                  <li key={note}>{note}</li>
                ))}
              </ul>
            </section>
          ) : null}

          {grade.breakdown?.resilience &&
          grade.breakdown.resilience.length > 0 ? (
            <section aria-labelledby={`${titleId}-res`}>
              <h3
                id={`${titleId}-res`}
                className="text-xs font-bold uppercase tracking-widest text-mda-ink-strong"
              >
                Resilience breakdown
              </h3>
              <ul className="mt-2 space-y-1">
                {grade.breakdown.resilience.map((line) => (
                  <li key={line.key}>
                    {line.label}: {line.value}
                    {line.note ? ` — ${line.note}` : ""}
                  </li>
                ))}
              </ul>
            </section>
          ) : null}
        </div>
      </PopoverContent>
    </Popover>
  );
}
