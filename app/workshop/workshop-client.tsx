"use client";

import { useEffect, useState, type ReactNode } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { MdaAppHeader } from "@/components/mda/app-header";
import {
  WorkshopDeckChrome,
  type WorkshopTab,
} from "@/components/mda/workshop-deck-chrome";
import { WorkshopBuildPane } from "@/components/mda/workshop-build-pane";
import { WorkshopMatchupsPane } from "@/components/mda/workshop-matchups-pane";
import { WorkshopCombosPane } from "@/components/mda/workshop-combos-pane";
import { useDeck } from "@/context/deck-context";
import { useModeStore } from "@/store/modeStore";
import type { DeckMode } from "@/types/types";
import { cn } from "@/lib/utils";

const TAB_WATERMARK: Record<WorkshopTab, string> = {
  build: "Build",
  matchups: "Matchups",
  combos: "Combos",
};

export default function WorkshopPage(): ReactNode {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { currentDeck, updateDeckMode } = useDeck();
  const setDeckMode = useModeStore((state) => state.setDeckMode);
  const [tab, setTab] = useState<WorkshopTab>("build");

  useEffect(() => {
    const modeParam = searchParams.get("mode");
    if (modeParam === "TCG" || modeParam === "Master Duel") {
      updateDeckMode(modeParam as DeckMode);
      setDeckMode(modeParam as DeckMode);
    }
  }, [searchParams, setDeckMode, updateDeckMode]);

  return (
    <div className="flex h-full min-h-0 flex-col overflow-hidden bg-mda-bg text-mda-ink">
      <MdaAppHeader theme="light" onLoginClick={() => router.push("/")} />
      <WorkshopDeckChrome
        deckName={currentDeck.name}
        mode={currentDeck.mode}
        mainCount={currentDeck.mainDeck.length}
        extraCount={currentDeck.extraDeck.length}
        sideCount={currentDeck.sideDeck.length}
        coverCard={currentDeck.mainDeck[0] ?? currentDeck.extraDeck[0] ?? null}
        activeTab={tab}
        onTabChange={setTab}
        onBackToArchives={() => router.push("/deck-archives")}
      />
      <div className="relative flex min-h-0 flex-1 flex-col px-4 pb-4 pt-3 sm:px-6">
        <p
          className="pointer-events-none absolute inset-x-0 top-1/2 z-0 -translate-y-1/2 select-none text-center font-display text-[clamp(4rem,18vw,11rem)] font-bold uppercase leading-none text-mda-watermark"
          aria-hidden
        >
          {TAB_WATERMARK[tab]}
        </p>
        <div
          className={cn(
            "relative z-[1] min-h-0 flex-1 overflow-hidden",
            "border border-mda-ink/10 bg-mda-surface/80 shadow-mda-soft",
          )}
        >
          {tab === "build" ? <WorkshopBuildPane /> : null}
          {tab === "matchups" ? <WorkshopMatchupsPane /> : null}
          {tab === "combos" ? <WorkshopCombosPane /> : null}
        </div>
      </div>
    </div>
  );
}
