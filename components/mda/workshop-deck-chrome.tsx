"use client";

import { useMemo, type ReactNode } from "react";
import {
  Archive,
  BarChart3,
  Crown,
  FlaskConical,
  Gamepad2,
  Hammer,
} from "lucide-react";
import { CardImage } from "@/components/ui/card-image";
import { MdaAnimatedNumber } from "@/components/mda/deck-cap-badge";
import { gradeFromCounts } from "@/lib/workshop-grade";
import type { DeckCard, DeckMode } from "@/types/types";
import { cn } from "@/lib/utils";

export type WorkshopTab = "build" | "matchups" | "combos";

export type WorkshopDeckChromeProps = {
  deckName: string;
  mode: DeckMode;
  mainCount: number;
  extraCount: number;
  sideCount: number;
  coverCard?: DeckCard | null;
  activeTab: WorkshopTab;
  onTabChange: (tab: WorkshopTab) => void;
  onBackToArchives: () => void;
};

const TABS: {
  key: WorkshopTab;
  label: string;
  icon: typeof Hammer;
}[] = [
  { key: "build", label: "Build", icon: Hammer },
  { key: "matchups", label: "Matchups", icon: BarChart3 },
  { key: "combos", label: "Combos", icon: FlaskConical },
];

function CountBadge({ label, value }: { label: string; value: number }): ReactNode {
  return (
    <span className="inline-flex min-w-[52px] items-center justify-center gap-1 bg-mda-chrome px-2 py-1 font-mda text-sm font-bold text-mda-inverse-text">
      <span>{label}</span>
      <MdaAnimatedNumber value={value} />
    </span>
  );
}

function WorkshopTabButton({
  label,
  icon: Icon,
  active,
  onClick,
  position,
}: {
  label: string;
  icon: typeof Hammer;
  active: boolean;
  onClick: () => void;
  position: "first" | "middle" | "last";
}): ReactNode {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-current={active ? "page" : undefined}
      className={cn(
        "relative flex h-11 min-w-[140px] flex-1 items-center justify-center gap-2 border border-mda-chrome px-6 font-mda text-sm font-bold uppercase tracking-wide transition-colors",
        position === "first" && "mda-workshop-tab-first",
        position === "middle" && "mda-workshop-tab-middle -ml-2",
        position === "last" && "mda-workshop-tab-last -ml-2",
        active
          ? "z-10 bg-mda-chrome text-mda-inverse-text"
          : "bg-mda-bg text-mda-ink hover:bg-mda-surface",
      )}
    >
      <Icon className="h-4 w-4 shrink-0" aria-hidden />
      {label}
    </button>
  );
}

export function WorkshopDeckChrome({
  deckName,
  mode,
  mainCount,
  extraCount,
  sideCount,
  coverCard,
  activeTab,
  onTabChange,
  onBackToArchives,
}: WorkshopDeckChromeProps): ReactNode {
  const isTcg = mode === "TCG";
  const grade = useMemo(
    () => gradeFromCounts(mainCount, extraCount),
    [mainCount, extraCount],
  );

  return (
    <div className="shrink-0 border-b border-mda-ink/10 bg-mda-bg px-6 pb-0 pt-1">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-stretch lg:justify-between">
        <div className="flex min-w-0 flex-1 items-center gap-4">
          <div className="relative h-[72px] w-[52px] shrink-0 overflow-hidden bg-mda-deep shadow-mda-soft">
            {coverCard ? (
              <CardImage
                card={coverCard}
                preferSmall
                fill
                alt={coverCard.name ?? deckName}
                className="object-cover"
                sizes="52px"
              />
            ) : (
              <div className="flex h-full w-full items-center justify-center bg-mda-panel font-mda text-xs text-mda-ink-muted">
                —
              </div>
            )}
          </div>
          <div className="min-w-0 space-y-1.5">
            <p className="truncate font-mda text-xl font-bold uppercase tracking-wide text-mda-ink-strong">
              {deckName}
            </p>
            <div className="flex flex-wrap items-center gap-2">
              <span className="inline-flex items-center gap-1 font-mda text-xs uppercase text-mda-ink-muted">
                {isTcg ? (
                  <Crown className="h-3.5 w-3.5" aria-hidden />
                ) : (
                  <Gamepad2 className="h-3.5 w-3.5" aria-hidden />
                )}
                {isTcg ? "TCG" : "Master Duel"}
              </span>
              <CountBadge label="M" value={mainCount} />
              <CountBadge label="E" value={extraCount} />
              {isTcg ? <CountBadge label="S" value={sideCount} /> : null}
            </div>
          </div>
        </div>

        <div className="flex flex-wrap items-stretch gap-4 lg:justify-end">
          <div className="flex min-w-[88px] flex-col items-center justify-center bg-mda-chrome px-4 py-2 text-mda-inverse-text">
            <span className="font-mda text-[10px] font-bold uppercase tracking-widest">
              Grade
            </span>
            <span className="font-display text-4xl font-bold leading-none">
              {grade.letter}
            </span>
          </div>
          <div className="grid grid-cols-2 gap-x-6 gap-y-2 sm:grid-cols-4">
            {grade.scores.map((score) => (
              <div key={score.label} className="min-w-[72px] text-center lg:text-left">
                <p className="font-mda text-[10px] font-bold uppercase tracking-wide text-mda-ink-muted">
                  {score.label}
                </p>
                <p className="font-display text-3xl font-bold leading-tight text-mda-ink-strong">
                  <MdaAnimatedNumber value={score.value} />
                </p>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="mt-4 flex items-end justify-between gap-4">
        <nav
          className="flex min-w-0 flex-1 max-w-2xl"
          aria-label="Workshop sections"
        >
          {TABS.map(({ key, label, icon }, index) => (
            <WorkshopTabButton
              key={key}
              label={label}
              icon={icon}
              active={activeTab === key}
              onClick={() => onTabChange(key)}
              position={
                index === 0 ? "first" : index === TABS.length - 1 ? "last" : "middle"
              }
            />
          ))}
        </nav>
        <button
          type="button"
          onClick={onBackToArchives}
          className="mb-1 hidden items-center gap-2 px-2 py-1 font-mda text-sm uppercase text-mda-ink-muted transition-colors hover:text-mda-ink sm:inline-flex"
        >
          <Archive className="h-4 w-4" aria-hidden />
          Archives
        </button>
      </div>
    </div>
  );
}
