"use client";

import { useEffect, useState, type ReactNode } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { MdaAppHeader } from "@/components/mda/app-header";
import {
  WorkshopSidebar,
  type WorkshopTab,
} from "@/components/mda/workshop-sidebar";
import { WorkshopBuildPane } from "@/components/mda/workshop-build-pane";
import { WorkshopMatchupsPane } from "@/components/mda/workshop-matchups-pane";
import { WorkshopCombosPane } from "@/components/mda/workshop-combos-pane";
import { useDeck } from "@/context/deck-context";
import { useModeStore } from "@/store/modeStore";
import type { DeckMode } from "@/types/types";

const WORKSHOP_BG =
  "bg-[radial-gradient(circle_at_center,#A4A8B1_0%,#45474B_100%)]";

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
    <div className={`flex h-full min-h-0 flex-col overflow-hidden text-white ${WORKSHOP_BG}`}>
      <MdaAppHeader onLoginClick={() => router.push("/")} />
      <div className="flex min-h-0 flex-1 flex-col lg:flex-row">
        <WorkshopSidebar
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
        <div className="relative min-h-0 flex-1 overflow-hidden">
          {tab === "build" ? <WorkshopBuildPane /> : null}
          {tab === "matchups" ? <WorkshopMatchupsPane /> : null}
          {tab === "combos" ? <WorkshopCombosPane /> : null}
        </div>
      </div>
    </div>
  );
}
