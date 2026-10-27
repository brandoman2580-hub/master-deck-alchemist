"use client";

import { useEffect, useMemo, useState, type ReactNode } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { WorkshopBuildPane } from "@/components/mda/workshop-build-pane";
import { WorkshopMatchupsPane } from "@/components/mda/workshop-matchups-pane";
import { WorkshopCombosPane } from "@/components/mda/workshop-combos-pane";
import { useDeck } from "@/context/deck-context";
import { useFormatStore } from "@/store/modeStore";
import { useWorkshopFacts } from "@/hooks/useWorkshopFacts";
import { useMetaListBands } from "@/hooks/queries/useMetaListBands";
import type { EngineFormat } from "@/lib/engine/types";
import { scoreDeck } from "@/lib/meta/deck-score";
import { deckHasBanlistFault } from "@/lib/workshop/banlist-fault";
import type { DeckFormat } from "@/types/deck";
import { navigateWithViewTransition } from "@/lib/motion/view-transition";
import { WorkshopShell, type WorkshopShellTab } from "./workshop-shell";

const SCORE_PILLARS = [
  "Consistency",
  "Resilience",
  "Interaction",
  "Ceiling",
  "Outing",
] as const;

export default function WorkshopPage(): ReactNode {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { currentDeck, updateDeckFormat, renameDeck, banlist } = useDeck();
  const deckFormat = useFormatStore((state) => state.deckFormat);
  const setDeckFormat = useFormatStore((state) => state.setDeckFormat);
  const [tab, setTab] = useState<WorkshopShellTab>("build");
  const { facts, loading: factsLoading, error: factsError } = useWorkshopFacts();
  const engineFormat: EngineFormat =
    currentDeck.deckFormat === "TCG" ? "TCG" : "MASTER_DUEL";
  const {
    bands: referenceBands,
    lists: metaLists,
    loading: bandsLoading,
    error: bandsError,
  } = useMetaListBands(engineFormat, banlist);
  const userCards = useMemo(
    () => [
      ...currentDeck.mainDeck.map((card) => ({ name: card.name, zone: "main" as const })),
      ...currentDeck.extraDeck.map((card) => ({ name: card.name, zone: "extra" as const })),
      ...currentDeck.sideDeck.map((card) => ({ name: card.name, zone: "side" as const })),
    ],
    [currentDeck.extraDeck, currentDeck.mainDeck, currentDeck.sideDeck],
  );

  const deckScore = useMemo(() => {
    if (!facts || facts.consistency.n <= 0) return null;
    const mainSize = currentDeck.mainDeck.length;
    return scoreDeck({
      format: currentDeck.deckFormat === "TCG" ? "TCG" : "Master Duel",
      mainSize,
      starterAccess: facts.consistency.starterAccess,
      oneInterruptionSurvival: facts.consistency.oneInterruptionSurvival,
      endboardPieces: facts.diagnostics.roleCoverage.endboardPieces,
      cards: userCards,
    });
  }, [currentDeck.deckFormat, currentDeck.mainDeck.length, facts, userCards]);

  useEffect(() => {
    const modeParam = searchParams.get("mode");
    if (modeParam !== "TCG" && modeParam !== "Master Duel") return;

    const format = modeParam as DeckFormat;
    if (currentDeck.deckFormat !== format) {
      updateDeckFormat(format);
    }
    if (deckFormat !== format) {
      setDeckFormat(format);
    }
  }, [searchParams, currentDeck.deckFormat, deckFormat, setDeckFormat, updateDeckFormat]);

  const coverCard = currentDeck.mainDeck[0] ?? currentDeck.extraDeck[0] ?? null;
  const banlistFault = useMemo(
    () => deckHasBanlistFault(currentDeck, banlist),
    [banlist, currentDeck],
  );

  const pillars = SCORE_PILLARS.map((label) => ({
    label,
    value: deckScore
      ? {
          Consistency: deckScore.consistency,
          Resilience: deckScore.resilience,
          Interaction: deckScore.interaction,
          Ceiling: deckScore.ceiling,
          Outing: deckScore.outing,
        }[label]
      : null,
  }));

  return (
    <WorkshopShell
      deckName={currentDeck.name}
      deckFormat={currentDeck.deckFormat}
      mainCount={currentDeck.mainDeck.length}
      extraCount={currentDeck.extraDeck.length}
      sideCount={currentDeck.sideDeck.length}
      coverCard={coverCard}
      gradeLetter={deckScore?.letter ?? null}
      pillars={pillars}
      gradeLoading={factsLoading}
      banlistFault={banlistFault}
      tab={tab}
      onTabChange={setTab}
      onBackToArchives={() => navigateWithViewTransition(() => router.push("/deck-archives"))}
      onRename={renameDeck}
    >
      {tab === "build" ? (
        <div className="h-full min-h-0 flex-1 overflow-hidden">
          <WorkshopBuildPane onOpenWorkshopTab={setTab} />
        </div>
      ) : null}
      {tab === "matchups" ? (
        <div className="h-full min-h-0 flex-1 overflow-hidden">
          <WorkshopMatchupsPane
            facts={facts}
            loading={factsLoading}
            error={factsError}
            referenceBands={referenceBands}
            bandsLoading={bandsLoading}
            bandsError={bandsError}
            userCards={userCards}
            deckFormat={currentDeck.deckFormat === "TCG" ? "TCG" : "Master Duel"}
          />
        </div>
      ) : null}
      {tab === "combos" ? (
        <div className="h-full min-h-0 flex-1 overflow-hidden">
          <WorkshopCombosPane
            facts={facts}
            loading={factsLoading}
            error={factsError}
            metaLists={metaLists}
            userCards={userCards}
            deckFormat={currentDeck.deckFormat === "TCG" ? "TCG" : "Master Duel"}
          />
        </div>
      ) : null}
    </WorkshopShell>
  );
}
