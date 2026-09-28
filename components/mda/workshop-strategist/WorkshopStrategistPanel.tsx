"use client";

import { useMemo, useState } from "react";
import { History, Info, Lock } from "lucide-react";
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
import { openLoginModal } from "@/lib/helpers";
import { useChatMessage } from "@/hooks/useChatMessage";
import { useConversationPersistence } from "@/hooks/useConversationPersistence";
import type { AssistantMode } from "@/lib/engine/assistant-contract";
import type { Card } from "@/types/card";
import type { DeckSection } from "@/types/types";
import type { WorkshopTab } from "@/components/mda/workshop-deck-chrome";
import { StrategistEmptyState } from "./StrategistEmptyState";
import { StrategistInputBar } from "./StrategistInputBar";
import { StrategistModeControl } from "./StrategistModeControl";
import { StrategistThread } from "./StrategistThread";
import { applyMainCopyTarget } from "./apply-tuning";
import type { StrategistMessage } from "./types";

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
  const format = toEngineFormat(currentDeck.mode);

  const {
    messages,
    setMessages,
    conversationId,
    setConversationId,
    isLoadingHistory,
    startNewConversation,
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

  const handleNewConversation = () => {
    startNewConversation();
  };

  if (!isAuthenticated) {
    return (
      <div className="flex min-h-0 flex-1 flex-col items-center justify-center gap-3 p-4 text-center">
        <Lock className="h-8 w-8 text-mda-ink-muted" aria-hidden />
        <p className="font-open-sans text-sm text-mda-ink">
          Log in to review a legal deck with Strategist.
        </p>
        <button
          type="button"
          onClick={() => openLoginModal()}
          data-magnetic
          className="bg-mda-chrome px-4 py-2 font-mda text-xs font-bold uppercase tracking-wide text-mda-inverse-text"
        >
          Log in
        </button>
      </div>
    );
  }

  if (!eligibility.ok) {
    return (
      <div className="flex min-h-0 flex-1 flex-col gap-3 p-3">
        <p className="font-open-sans text-sm text-mda-ink">
          Strategist needs a saved, renamed, legal deck.
        </p>
        <ul className="list-disc space-y-1 pl-4 font-open-sans text-xs text-mda-ink-muted">
          {eligibility.errors.map((err) => (
            <li key={err}>{err}</li>
          ))}
        </ul>
      </div>
    );
  }

  const showEmpty = !isLoadingHistory && messages.length === 0 && !isLoading;

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="mb-2 flex items-center gap-2">
        <StrategistModeControl value={mode} onChange={setMode} />
        <button
          type="button"
          onClick={handleNewConversation}
          aria-label="Start new conversation"
          data-magnetic
          className="shrink-0 bg-mda-chrome p-2 text-mda-inverse-text hover:bg-mda-chrome-deep"
          title="New conversation"
        >
          <History className="h-4 w-4" aria-hidden />
        </button>
      </div>

      <p className="mb-2 flex items-start gap-1.5 font-open-sans text-[11px] text-mda-ink-muted">
        <Info className="mt-0.5 h-3 w-3 shrink-0" aria-hidden />
        Reviews your current Workshop list. Apply and Add update the deck
        immediately.
      </p>

      {isLoadingHistory ? (
        <p className="font-open-sans text-sm text-mda-ink-muted">
          Loading history…
        </p>
      ) : showEmpty ? (
        <StrategistEmptyState />
      ) : (
        <StrategistThread
          messages={messages}
          isLoading={isLoading}
          onApplyTuning={handleApplyTuning}
          onAddSynergy={handleAddSynergy}
          onOpenWorkshopTab={onOpenWorkshopTab}
        />
      )}

      {error ? (
        <p className="mt-2 font-open-sans text-xs text-red-700" role="alert">
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
