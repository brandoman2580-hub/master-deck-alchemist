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
import { WorkshopGradeDisclaimer } from "@/components/mda/workshop-grade-disclaimer";
import { gradeFromCounts, type WorkshopGrade } from "@/lib/workshop/grade";
import type { DeckCard, DeckMode } from "@/types/deck";
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
  /** Facts Brain grade when available; falls back to size placeholder. */
  grade?: WorkshopGrade | null;
  gradeLoading?: boolean;
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
    <span className="inline-flex items-center gap-1.5">
      <span className="inline-flex h-8 w-8 shrink-0 items-center justify-center bg-mda-chrome font-mda text-2xl font-bold text-mda-inverse-text">
        {label}
      </span>
      <MdaAnimatedNumber
        value={value}
        className="font-mda text-2xl font-medium leading-none text-mda-chrome"
      />
    </span>
  );
}

function WorkshopTabButton({
  label,
  icon: Icon,
  active,
  onClick,
}: {
  label: string;
  icon: typeof Hammer;
  active: boolean;
  onClick: () => void;
}): ReactNode {
  return (
    <button
      type="button"
      onClick={onClick}
      data-magnetic
      aria-current={active ? "page" : undefined}
      className={cn(
        "relative flex min-h-[48px] min-w-[140px] items-center justify-center gap-2.5 px-6 font-mda text-2xl font-semibold uppercase tracking-wide transition-colors",
        active
          ? "bg-mda-chrome text-mda-inverse-text"
          : "bg-transparent text-mda-ink hover:text-mda-ink-strong",
      )}
    >
      <Icon className="h-6 w-6 shrink-0" aria-hidden />
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
  grade: gradeProp,
  gradeLoading = false,
}: WorkshopDeckChromeProps): ReactNode {
  const isTcg = mode === "TCG";
  const fallbackGrade = useMemo(
    () => gradeFromCounts(mainCount, extraCount),
    [mainCount, extraCount],
  );
  const grade = gradeProp ?? fallbackGrade;

  return (
    <div className="relative z-[1] shrink-0 bg-transparent px-6 pb-0 pt-1">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-stretch lg:justify-between">
        <div className="flex min-w-0 flex-1 items-start gap-4">
          <div className="relative h-[106px] w-[66px] shrink-0 bg-transparent shadow-mda-soft">
            <div className="relative h-full w-full overflow-hidden bg-mda-deep">
              {coverCard ? (
                <CardImage
                  card={coverCard}
                  preferSmall
                  fill
                  alt={coverCard.name ?? deckName}
                  className="object-cover"
                  sizes="66px"
                />
              ) : (
                <div className="flex h-full w-full items-center justify-center bg-mda-panel font-mda text-xs text-mda-ink-muted">
                  —
                </div>
              )}
            </div>
          </div>
          <div className="flex min-w-0 flex-col gap-2 pt-1">
            <p className="truncate font-mda text-xl font-bold uppercase tracking-wide text-mda-ink-strong">
              {deckName}
            </p>
            <span className="inline-flex items-center gap-1.5 font-mda text-md font-medium uppercase tracking-wide text-mda-ink">
              {isTcg ? (
                <Crown className="h-5 w-5" aria-hidden />
              ) : (
                <Gamepad2 className="h-5 w-5" aria-hidden />
              )}
              {isTcg ? "TCG" : "Master Duel"}
            </span>
            <div className="flex flex-wrap items-center gap-3">
              <CountBadge label="M" value={mainCount} />
              <CountBadge label="E" value={extraCount} />
              {isTcg ? <CountBadge label="S" value={sideCount} /> : null}
            </div>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-4 lg:justify-end lg:border-l-[6px] lg:border-mda-chrome lg:pl-4">
          <div className="flex items-center gap-2">
            <div className="flex h-full max-h-[74px] min-w-[72px] flex-col items-center justify-center bg-mda-chrome px-3 py-1.5 text-mda-inverse-text">
              <span className="font-mda text-[10px] font-bold uppercase tracking-widest">
                Grade
              </span>
              <span className="font-display text-3xl font-bold leading-none">
                {gradeLoading && !gradeProp ? "—" : grade.letter}
              </span>
            </div>
            <WorkshopGradeDisclaimer mode={mode} grade={grade} />
          </div>
          <div className="grid grid-cols-2 gap-x-6 gap-y-2 sm:grid-cols-4">
            {grade.scores.map((score) => (
              <div key={score.label} className="min-w-[72px] text-center lg:text-left">
                <p className="font-mda text-base font-medium uppercase tracking-wide text-mda-ink">
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

      <div className="mt-4 flex items-end justify-between gap-4 border-b-4 border-mda-chrome">
        <nav
          className="flex min-w-0 flex-1 max-w-2xl gap-1"
          aria-label="Workshop sections"
        >
          {TABS.map(({ key, label, icon }) => (
            <WorkshopTabButton
              key={key}
              label={label}
              icon={icon}
              active={activeTab === key}
              onClick={() => onTabChange(key)}
            />
          ))}
        </nav>
        <button
          type="button"
          onClick={onBackToArchives}
          data-magnetic
          className="mb-2 hidden items-center gap-2 border border-2 border-mda-chrome bg-transparent px-3 py-2 font-mda text-sm font-bold uppercase tracking-wide text-mda-ink transition-colors hover:bg-mda-chrome hover:text-mda-inverse-text sm:inline-flex"
        >
          <Archive className="h-4 w-4" aria-hidden />
          Archives
        </button>
      </div>
    </div>
  );
}
