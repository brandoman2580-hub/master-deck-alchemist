"use client";

import type { RedirectHint } from "@/lib/engine/assistant-contract";
import type { WorkshopTab } from "@/components/mda/workshop-deck-chrome";

const HINT_TO_TAB: Partial<
  Record<RedirectHint, { tab: WorkshopTab; label: string; aria: string }>
> = {
  workshop_matchups: {
    tab: "matchups",
    label: "View Matchups",
    aria: "Open the Workshop Matchups tab for the full readiness snapshot",
  },
  workshop_combos: {
    tab: "combos",
    label: "View Combos",
    aria: "Open the Workshop Combos tab for validated lines and endboards",
  },
};

export type WorkshopTabCtaProps = {
  redirectHint?: RedirectHint | null;
  onOpenWorkshopTab?: (tab: Extract<WorkshopTab, "matchups" | "combos">) => void;
};

/**
 * Soft CTA — opens Matchups/Combos without replacing the chat answer.
 */
export function WorkshopTabCta({
  redirectHint,
  onOpenWorkshopTab,
}: WorkshopTabCtaProps) {
  if (!redirectHint || !onOpenWorkshopTab) return null;
  const mapped = HINT_TO_TAB[redirectHint];
  if (!mapped) return null;

  return (
    <button
      type="button"
      data-testid="workshop-tab-cta"
      data-magnetic
      aria-label={mapped.aria}
      onClick={() => onOpenWorkshopTab(mapped.tab as "matchups" | "combos")}
      className="mt-1 bg-mda-chrome px-3 py-1.5 font-mda text-[10px] font-bold uppercase tracking-wide text-mda-inverse-text transition-colors hover:bg-mda-chrome-deep"
    >
      {mapped.label}
    </button>
  );
}
