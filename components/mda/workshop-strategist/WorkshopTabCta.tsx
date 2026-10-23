"use client";

import type { RedirectHint } from "@/lib/engine/assistant-contract";
import type { WorkshopTab } from "@/components/mda/workshop-deck-chrome";

const HINT_TO_TAB: Partial<
  Record<RedirectHint, { tab: WorkshopTab; label: string; aria: string }>
> = {
  workshop_matchups: {
    tab: "matchups",
    label: "Matchups",
    aria: "Open Matchups tab",
  },
  workshop_combos: {
    tab: "combos",
    label: "Combos",
    aria: "Open Combos tab",
  },
};

export type WorkshopTabCtaProps = {
  redirectHint?: RedirectHint | null;
  onOpenWorkshopTab?: (tab: Extract<WorkshopTab, "matchups" | "combos">) => void;
};

/**
 * Steel keycap plus “Open tab” caption inside a Strategist reply.
 */
export function WorkshopTabCta({
  redirectHint,
  onOpenWorkshopTab,
}: WorkshopTabCtaProps) {
  if (!redirectHint || !onOpenWorkshopTab) return null;
  const mapped = HINT_TO_TAB[redirectHint];
  if (!mapped) return null;

  return (
    <div className="mt-3 flex items-center gap-2 border-t border-[#dce5eb] pt-2.5">
      <button
        type="button"
        data-testid="workshop-tab-cta"
        aria-label={mapped.aria}
        onClick={() => onOpenWorkshopTab(mapped.tab as "matchups" | "combos")}
        className="flex h-6 items-center border border-[#28303b] bg-[#14181f] px-2 text-[10px] font-semibold uppercase tracking-[0.12em] text-[#e2e2e8] transition-colors hover:border-[#bfe5f3]"
      >
        {mapped.label}
      </button>
      <span className="text-[11px] text-[#5b6369]">Open tab</span>
    </div>
  );
}
