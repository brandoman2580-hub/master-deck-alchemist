"use client";

import { useEffect, useMemo, useState, type ReactNode } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { WorkshopBuildPane } from "@/components/mda/workshop-build-pane";
import { WorkshopMatchupsPane } from "@/components/mda/workshop-matchups-pane";
import { WorkshopCombosPane } from "@/components/mda/workshop-combos-pane";
import { useDeck } from "@/context/deck-context";
import { useFormatStore } from "@/store/modeStore";
import { useWorkshopFacts } from "@/hooks/useWorkshopFacts";
import { workshopGradeFromAxes } from "@/lib/workshop/grade";
import { deckHasBanlistFault } from "@/lib/workshop/banlist-fault";
import type { DeckFormat } from "@/types/deck";
import { WorkshopShell, type WorkshopShellTab } from "./workshop-shell";

const PILLARS = ["Consistency", "Power", "Resilience", "Disruption"] as const;

export default function WorkshopPage(): ReactNode {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { currentDeck, updateDeckFormat, renameDeck, banlist } = useDeck();
  const deckFormat = useFormatStore((state) => state.deckFormat);
  const setDeckFormat = useFormatStore((state) => state.setDeckFormat);
  const [tab, setTab] = useState<WorkshopShellTab>("build");
  const { facts, loading: factsLoading, error: factsError } = useWorkshopFacts();

  const grade = useMemo(
    () => (facts ? workshopGradeFromAxes(facts.grade) : null),
    [facts],
  );

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

  const pillars = PILLARS.map((label) => ({
    label,
    value: grade?.scores.find((score) => score.label === label)?.value ?? null,
  }));

  return (
    <WorkshopShell
      deckName={currentDeck.name}
      deckFormat={currentDeck.deckFormat}
      mainCount={currentDeck.mainDeck.length}
      extraCount={currentDeck.extraDeck.length}
      sideCount={currentDeck.sideDeck.length}
      coverCard={coverCard}
      gradeLetter={grade?.letter ?? null}
      pillars={pillars}
      gradeLoading={factsLoading}
      banlistFault={banlistFault}
      tab={tab}
      onTabChange={setTab}
      onBackToArchives={() => router.push("/deck-archives")}
      onRename={renameDeck}
    >
      {tab === "build" ? (
        <div className="h-full min-h-0 flex-1 overflow-hidden">
          <WorkshopBuildPane onOpenWorkshopTab={setTab} />
        </div>
      ) : null}
      {tab === "matchups" ? (
        <div className="h-full min-h-0 flex-1 overflow-hidden">
          <WorkshopMatchupsPane facts={facts} loading={factsLoading} error={factsError} />
        </div>
      ) : null}
      {tab === "combos" ? (
        <div className="h-full min-h-0 flex-1 overflow-hidden">
          <WorkshopCombosPane facts={facts} loading={factsLoading} error={factsError} />
        </div>
      ) : null}
    </WorkshopShell>
  );
}
