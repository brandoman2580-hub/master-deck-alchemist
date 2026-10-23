"use client";

import { useMemo, useState } from "react";
import { useDeck } from "@/context/deck-context";
import { useUserStore } from "@/store/useUserStore";
import { useCardStore } from "@/store/cardStore";
import { evaluateAssistantEligibility } from "@/lib/engine/legality";
import { toEngineFormat } from "@/lib/engine/deck-hash";
import { buildLiveDeckSnapshot } from "@/lib/engine/deck-snapshot";
import {
  classifyOutOfBoundsHeuristic,
  buildOutOfBoundsCoachResponse,
} from "@/lib/engine";
import { openLoginModal } from "@/hooks/useOpenLoginModal";
import { useChatMessage } from "@/hooks/useChatMessage";
import { useConversationPersistence } from "@/hooks/useConversationPersistence";
import type { AssistantMode } from "@/lib/engine/assistant-contract";
import type { Card } from "@/types/card";
import type { DeckSection } from "@/types/deck";
import type { WorkshopTab } from "@/components/mda/workshop-deck-chrome";
import { useWorkshopFacts } from "@/hooks/useWorkshopFacts";
import { StrategistEmptyState } from "./StrategistEmptyState";
import { StrategistInputBar } from "./StrategistInputBar";
import { StrategistModeControl } from "./StrategistModeControl";
import { StrategistThread } from "./StrategistThread";
import { applyMainCopyTarget } from "./apply-tuning";
import type { WorkshopGradeAxes } from "@/lib/engine/types";
import type { StrategistMessage } from "./types";

function shortPillarLabel(grade: WorkshopGradeAxes | undefined): string | null {
  if (!grade) return null;
  const scores = [
    ["Consistency", grade.consistency],
    ["Power", grade.power],
    ["Resilience", grade.resilience],
    ["Disruption", grade.disruption],
  ] as const;
  const lowest = Math.min(...scores.map(([, value]) => value));
  const shorts = scores.filter(([, value]) => value === lowest);
  if (shorts.length !== 1) return null;
  return shorts[0][0];
}

/**
 * Workshop Build Strategist panel — Facts Brain coach with Figma DEFAULT/QUERY/REQUEST chrome.
 */
export function WorkshopStrategistPanel({
  onOpenWorkshopTab,
}: {
  onOpenWorkshopTab?: (tab: Extract<WorkshopTab, "matchups" | "combos">) => void;
} = {}) {
  const user = useUserStore((state) => state.user);
  const {
    currentDeck,
    banlist,
    savedDecks,
    addCardToDeck,
    removeCardFromDeck,
  } = useDeck();
  const cardList = useCardStore((state) => state.cardList);

  const [mode, setMode] = useState<AssistantMode>("auto");
  const [input, setInput] = useState("");
  const { facts } = useWorkshopFacts();
  const shortPillar = shortPillarLabel(facts?.grade);

  const savedDeckIds = useMemo(
    () => new Set(savedDecks.map((deck) => deck.id)),
    [savedDecks],
  );

  const eligibility = useMemo(
    () =>
      evaluateAssistantEligibility(currentDeck, {
        banlist,
        savedDeckIds,
      }),
    [banlist, currentDeck, savedDeckIds],
  );

  const isAuthenticated = !!user;
  const isReady = isAuthenticated && eligibility.ok;
  const format = toEngineFormat(currentDeck.deckFormat);

  const {
    messages,
    setMessages,
    conversationId,
    setConversationId,
    isLoadingHistory,
  } = useConversationPersistence({
    currentDeckId: currentDeck.id,
  });

  const { sendMessage, isLoading, error } = useChatMessage({
    currentDeckId: currentDeck.id,
    conversationId,
    onConversationChange: setConversationId,
    mode,
    format,
    getDeckSnapshot: () => buildLiveDeckSnapshot(currentDeck),
  });

  const handleSend = async () => {
    const question = input.trim();
    if (!question || !isReady) return;

    const userMessage: StrategistMessage = {
      id: Date.now().toString(),
      role: "user",
      content: question,
      timestamp: new Date(),
    };
    setMessages((prev) => [...prev, userMessage]);
    setInput("");

    const oob = classifyOutOfBoundsHeuristic(question);
    if (oob.isOutOfBounds && oob.reason) {
      const refused = buildOutOfBoundsCoachResponse({
        oob_reason: oob.reason,
        confidence: "high",
      });
      const refusalMessage: StrategistMessage = {
        id: (Date.now() + 1).toString(),
        role: "assistant",
        content: refused.answer,
        timestamp: new Date(),
        coach: refused,
        mode: refused.mode,
        confidence: refused.confidence,
        evidence: refused.evidence,
        limitations: refused.limitations,
        redirectHint: refused.redirectHint,
      };
      setMessages((prev) => [...prev, refusalMessage]);
      return;
    }

    await sendMessage(question, setMessages);
  };

  const handleStarter = async (prompt: string, starterMode: AssistantMode) => {
    if (!isReady || isLoading) return;
    setMode(starterMode);
    const userMessage: StrategistMessage = {
      id: Date.now().toString(),
      role: "user",
      content: prompt,
      timestamp: new Date(),
    };
    setMessages((prev) => [...prev, userMessage]);
    await sendMessage(prompt, setMessages, starterMode);
  };

  const handleApplyTuning = (cardId: string, toCopies: number) => {
    const idNum = Number(cardId);
    const card = cardList.find((c) => c.id === idNum);
    if (!card) return;
    applyMainCopyTarget({
      deck: currentDeck,
      card,
      toCopies,
      addCardToDeck: (c) => addCardToDeck(c, "mainDeck"),
      removeCardFromDeck: (instanceId) =>
        removeCardFromDeck(instanceId, "mainDeck"),
    });
  };

  const handleAddSynergy = (card: Card, section: DeckSection) => {
    addCardToDeck(card, section);
  };

  if (!isAuthenticated) {
    return (
      <div className="flex min-h-0 flex-1 flex-col items-center justify-center gap-3 bg-[#eef3f6] p-4 text-center">
        <p className="text-sm text-[#0c0e12]">Log in to review a legal deck with Strategist.</p>
        <button
          type="button"
          onClick={() => openLoginModal()}
          className="border border-[#28303b] bg-[#14181f] px-4 py-2 text-[11px] font-semibold uppercase tracking-[0.12em] text-[#e2e2e8]"
        >
          Log in
        </button>
      </div>
    );
  }

  if (!eligibility.ok) {
    return (
      <div className="flex min-h-0 flex-1 flex-col gap-3 bg-[#eef3f6] p-3">
        <p className="text-sm text-[#0c0e12]">Strategist needs a saved, renamed, legal deck.</p>
        <ul className="list-disc space-y-1 pl-4 text-xs text-[#5b6369]">
          {eligibility.errors.map((err) => (
            <li key={err}>{err}</li>
          ))}
        </ul>
      </div>
    );
  }

  return (
    <div className="flex h-full min-h-0 flex-1 flex-col bg-[#eef3f6]">
      <StrategistModeControl value={mode} onChange={setMode} />

      <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
        {isLoadingHistory ? (
          <p className="p-3.5 text-[13px] text-[#5b6369]">Loading history…</p>
        ) : (
          <StrategistThread
            messages={messages}
            isLoading={isLoading}
            onApplyTuning={handleApplyTuning}
            onAddSynergy={handleAddSynergy}
            onOpenWorkshopTab={onOpenWorkshopTab}
            welcome={
              <StrategistEmptyState
                deckName={currentDeck.name}
                shortPillar={shortPillar}
                onStarter={(prompt, starterMode) => {
                  void handleStarter(prompt, starterMode);
                }}
              />
            }
          />
        )}
      </div>

      {error ? (
        <p className="shrink-0 px-3 pb-2 text-xs text-red-700" role="alert">
          {error}
        </p>
      ) : null}

      <StrategistInputBar
        value={input}
        onChange={setInput}
        onSubmit={() => {
          void handleSend();
        }}
        isLoading={isLoading}
        disabled={!isReady}
      />
    </div>
  );
}
