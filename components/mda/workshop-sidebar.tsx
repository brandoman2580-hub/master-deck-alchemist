"use client";

import type { ReactNode } from "react";
import {
  Archive,
  FlaskConical,
  Gamepad2,
  Crown,
  Hammer,
  BarChart3,
} from "lucide-react";
import { CardImage } from "@/components/ui/card-image";
import { DeckCapBadge } from "@/components/mda/deck-cap-badge";
import type { DeckCard, DeckMode } from "@/types/types";
import { cn } from "@/lib/utils";

export type WorkshopTab = "build" | "matchups" | "combos";

export type WorkshopSidebarProps = {
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

export function WorkshopSidebar({
  deckName,
  mode,
  mainCount,
  extraCount,
  sideCount,
  coverCard,
  activeTab,
  onTabChange,
  onBackToArchives,
}: WorkshopSidebarProps): ReactNode {
  const isTcg = mode === "TCG";

  return (
    <aside className="flex h-full min-h-0 w-full max-w-[346px] shrink-0 flex-col bg-transparent px-[30px] py-2.5">
      <div className="relative mb-4 h-[164px] w-full shrink-0 overflow-hidden rounded-sm bg-[color:var(--mda-surface)]/40">
        {coverCard ? (
          <CardImage
            card={coverCard}
            preferSmall={false}
            fill
            alt={coverCard.name ?? deckName}
            className="object-cover object-center opacity-80"
            sizes="286px"
          />
        ) : null}
        <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/30 to-transparent" />
        <div className="absolute inset-x-0 bottom-0 space-y-2 p-3">
          <p className="font-mda text-lg font-bold uppercase leading-tight text-white">
            {deckName}
          </p>
          <div className="flex flex-wrap items-center gap-2">
            <span className="inline-flex items-center gap-1 font-mda text-xs uppercase text-white/80">
              {isTcg ? (
                <Crown className="h-4 w-4" aria-hidden />
              ) : (
                <Gamepad2 className="h-4 w-4" aria-hidden />
              )}
              {isTcg ? "TCG" : "Master Duel"}
            </span>
            <DeckCapBadge label="M" value={mainCount} />
            <DeckCapBadge label="E" value={extraCount} />
            {isTcg ? <DeckCapBadge label="S" value={sideCount} /> : null}
          </div>
        </div>
      </div>

      <div className="h-px w-full shrink-0 bg-white/20" aria-hidden />

      <nav
        className="mt-5 flex min-h-0 flex-1 flex-col gap-3"
        aria-label="Workshop sections"
      >
        {TABS.map(({ key, label, icon: Icon }) => {
          const active = activeTab === key;
          return (
            <button
              key={key}
              type="button"
              onClick={() => onTabChange(key)}
              aria-current={active ? "page" : undefined}
              className={cn(
                "flex h-12 items-center gap-3 rounded px-6 font-mda text-xl transition-colors",
                active
                  ? "bg-white/20 text-white"
                  : "bg-transparent text-white/55 hover:bg-white/10 hover:text-white",
              )}
            >
              <Icon className="h-6 w-6" aria-hidden />
              {label}
            </button>
          );
        })}
      </nav>

      <div className="mt-auto space-y-3 pb-4 pt-4">
        <div className="h-px w-full bg-white/20" aria-hidden />
        <button
          type="button"
          onClick={onBackToArchives}
          className="mx-auto flex items-center gap-2 px-4 py-2 font-mda text-xl text-white/70 hover:text-white"
        >
          <Archive className="h-6 w-6" aria-hidden />
          Archives
        </button>
      </div>
    </aside>
  );
}
