"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { ThumbsDown, ThumbsUp } from "lucide-react";
import { useCardStore } from "@/store/cardStore";
import { useDeck } from "@/context/deck-context";
import { getRemainingCopies, isExtraDeckCard } from "@/lib/deck/copy-limits";
import { RecommendationCard } from "./RecommendationCard";
import { EvidenceDisclosure } from "./EvidenceDisclosure";
import { TuningActionRow } from "./TuningActionRow";
import { WorkshopTabCta } from "./WorkshopTabCta";
import type { StrategistMessage } from "./types";
import type { Card } from "@/types/card";
import type { DeckSection } from "@/types/deck";
import type { WorkshopTab } from "@/components/mda/workshop-deck-chrome";
import { cn } from "@/lib/utils";

const MAX_TUNING_VISIBLE = 3;
const MAX_SYNERGY_VISIBLE = 5;

interface StrategistThreadProps {
  messages: StrategistMessage[];
  isLoading?: boolean;
  onApplyTuning: (cardId: string, toCopies: number) => void;
  onAddSynergy: (card: Card, section: DeckSection) => void;
  onOpenWorkshopTab?: (tab: Extract<WorkshopTab, "matchups" | "combos">) => void;
}

function inferRoleTag(text: string): string | undefined {
  const lower = text.toLowerCase();
  if (/\bend\s*board|boss|wincon/.test(lower)) return "ENDBOARD";
  if (/\bhand\s*trap|ash|imperm|nibiru|veiler/.test(lower)) return "HAND TRAP";
  if (/\bextender|bridge/.test(lower)) return "EXTENDER";
  if (/\bstarter|searcher|tutor/.test(lower)) return "STARTER";
  if (/\bfloodgate|stun/.test(lower)) return "FLOODGATE";
  if (/\bboard\s*breaker|going\s*second/.test(lower)) return "BOARD BREAKER";
  return undefined;
}

/**
 * Strategist thread — INTERFACE chrome, DUELIST asks, Ai_RESP replies, recommendation cards.
 */
export function StrategistThread({
  messages,
  isLoading = false,
  onApplyTuning,
  onAddSynergy,
  onOpenWorkshopTab,
}: StrategistThreadProps) {
  const cardList = useCardStore((state) => state.cardList);
  const { currentDeck, banlist } = useDeck();
  const [appliedKeys, setAppliedKeys] = useState<Set<string>>(new Set());
  const [showAllTuning, setShowAllTuning] = useState<Record<string, boolean>>(
    {},
  );
  const [showAllSynergy, setShowAllSynergy] = useState<Record<string, boolean>>(
    {},
  );
  const [feedback, setFeedback] = useState<
    Record<string, "up" | "down" | undefined>
  >({});
  const bottomRef = useRef<HTMLDivElement | null>(null);
  const lastMessageId = messages[messages.length - 1]?.id;

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [lastMessageId, isLoading, messages.length]);

  const cardById = useMemo(() => {
    const map = new Map<number, Card>();
    for (const card of cardList) {
      map.set(card.id, card);
    }
    return map;
  }, [cardList]);

  return (
    <div
      className="min-h-0 flex-1 space-y-5 overflow-y-auto p-1"
      data-testid="strategist-thread-scroll"
      aria-label="Strategist conversation"
    >
      <p className="font-mda text-xs font-bold uppercase tracking-[0.18em] text-mda-ink-muted">
        Strategist
      </p>

      {messages.map((message) => {
        if (message.role === "user") {
          return (
            <div key={message.id} className="space-y-1.5">
              <p className="font-mda text-xs font-bold uppercase tracking-wider text-mda-ink-muted">
                You
              </p>
              <div className="bg-mda-chrome px-3 py-2.5 font-open-sans text-sm leading-relaxed text-mda-inverse-text">
                {message.content}
              </div>
            </div>
          );
        }

        const tuning = message.tuning?.recommendation ?? [];
        const synergies = message.synergies ?? [];
        const recommendationCards = message.recommendations ??
          message.coach?.recommendations ??
          [];
        const showTuningAll = showAllTuning[message.id] === true;
        const showSynergyAll = showAllSynergy[message.id] === true;
        const visibleTuning = showTuningAll
          ? tuning
          : tuning.slice(0, MAX_TUNING_VISIBLE);
        const visibleSynergies = showSynergyAll
          ? synergies
          : synergies.slice(0, MAX_SYNERGY_VISIBLE);
        const voted = feedback[message.id];

        const cardsFromRecommendations = recommendationCards.map((rec) => {
          const idNum = Number(rec.cardId);
          let card = Number.isFinite(idNum)
            ? cardById.get(idNum)
            : undefined;
          if (!card && rec.title) {
            const needle = rec.title.trim().toLowerCase();
            card = cardList.find(
              (c) => c.name.trim().toLowerCase() === needle,
            );
          }
          return { rec, card };
        });

        const useStructuredCards = cardsFromRecommendations.length > 0;

        return (
          <div key={message.id} className="space-y-2.5 text-mda-ink">
            <p className="font-mda text-xs font-bold uppercase tracking-wider text-mda-cyan">
              Strategist
            </p>
            <p className="whitespace-pre-wrap font-open-sans text-sm leading-relaxed text-mda-ink">
              {message.content}
            </p>

            {visibleTuning.length > 0 ? (
              <div className="space-y-1.5" aria-label="Copy tuning recommendations">
                {visibleTuning.map((rec, index) => {
                  const idNum = Number(rec.cardId);
                  const card = cardById.get(idNum);
                  const name = card?.name ?? `Card ${rec.cardId}`;
                  const applyKey = `${message.id}:${rec.cardId}:${rec.fromCopies}->${rec.toCopies}:${index}`;
                  return (
                    <TuningActionRow
                      key={applyKey}
                      recommendation={rec}
                      cardName={name}
                      applied={appliedKeys.has(applyKey)}
                      onApply={() => {
                        onApplyTuning(rec.cardId, rec.toCopies);
                        setAppliedKeys((prev) => new Set(prev).add(applyKey));
                      }}
                    />
                  );
                })}
                {tuning.length > MAX_TUNING_VISIBLE ? (
                  <button
                    type="button"
                    className="min-h-11 text-left font-mda text-xs uppercase tracking-wide text-mda-cyan underline underline-offset-2 hover:text-mda-sky-strong"
                    onClick={() =>
                      setShowAllTuning((prev) => ({
                        ...prev,
                        [message.id]: !showTuningAll,
                      }))
                    }
                  >
                    {showTuningAll
                      ? "Show fewer"
                      : `Show ${tuning.length - MAX_TUNING_VISIBLE} more`}
                  </button>
                ) : null}
                {message.tuning?.tradeoffs?.length ? (
                  <p className="font-open-sans text-sm text-mda-ink">
                    Tradeoffs: {message.tuning.tradeoffs.slice(0, 2).join(" · ")}
                  </p>
                ) : null}
              </div>
            ) : null}

            {useStructuredCards ? (
              <div className="space-y-2" aria-label="Strategist recommendations">
                {cardsFromRecommendations.map(({ rec, card }, index) => {
                  const remaining = card
                    ? getRemainingCopies(card, currentDeck, banlist)
                    : 0;
                  const section: DeckSection =
                    card && isExtraDeckCard(card)
                      ? "extraDeck"
                      : "mainDeck";
                  const disabled = !card || remaining <= 0;
                  return (
                    <RecommendationCard
                      key={`${message.id}-rec-${rec.cardId}-${index}`}
                      title={rec.title}
                      roleTag={rec.roleTag}
                      effectLines={rec.effectLines ?? []}
                      card={card}
                      disabled={disabled}
                      disabledReason={
                        !card
                          ? "Card not in library"
                          : remaining <= 0
                            ? "Copy limit or banlist"
                            : undefined
                      }
                      onAdd={() => {
                        if (!card) return;
                        onAddSynergy(card, section);
                      }}
                    />
                  );
                })}
              </div>
            ) : visibleSynergies.length > 0 ? (
              <div className="space-y-2" aria-label="Synergy recommendations">
                {visibleSynergies.map((synergy, index) => {
                  const idNum = Number(synergy.cardId);
                  let card = Number.isFinite(idNum)
                    ? cardById.get(idNum)
                    : undefined;
                  if (!card && synergy.title) {
                    const needle = synergy.title.trim().toLowerCase();
                    card = cardList.find(
                      (c) => c.name.trim().toLowerCase() === needle,
                    );
                  }
                  const remaining = card
                    ? getRemainingCopies(card, currentDeck, banlist)
                    : 0;
                  const section: DeckSection =
                    card && isExtraDeckCard(card)
                      ? "extraDeck"
                      : "mainDeck";
                  const disabled = !card || remaining <= 0;
                  const effectSource =
                    synergy.fitSummary?.trim() ||
                    synergy.genericCondition?.trim() ||
                    "";
                  const effectLines = effectSource
                    .split(/[.;]\s+/)
                    .map((s) => s.trim())
                    .filter(Boolean);
                  return (
                    <RecommendationCard
                      key={`${message.id}-${synergy.cardId}-${index}`}
                      title={synergy.title}
                      roleTag={inferRoleTag(
                        `${synergy.title} ${effectSource}`,
                      )}
                      effectLines={
                        effectLines.length
                          ? effectLines
                          : ["Mechanical synergy candidate"]
                      }
                      card={card}
                      disabled={disabled}
                      disabledReason={
                        !card
                          ? "Card not in library"
                          : remaining <= 0
                            ? "Copy limit or banlist"
                            : undefined
                      }
                      onAdd={() => {
                        if (!card) return;
                        onAddSynergy(card, section);
                      }}
                    />
                  );
                })}
                {synergies.length > MAX_SYNERGY_VISIBLE ? (
                  <button
                    type="button"
                    className="min-h-11 text-left font-mda text-xs uppercase tracking-wide text-mda-cyan underline underline-offset-2 hover:text-mda-sky-strong"
                    onClick={() =>
                      setShowAllSynergy((prev) => ({
                        ...prev,
                        [message.id]: !showSynergyAll,
                      }))
                    }
                  >
                    {showSynergyAll
                      ? "Show fewer"
                      : `Show ${synergies.length - MAX_SYNERGY_VISIBLE} more`}
                  </button>
                ) : null}
              </div>
            ) : null}

            <WorkshopTabCta
              redirectHint={
                message.redirectHint ?? message.coach?.redirectHint
              }
              onOpenWorkshopTab={onOpenWorkshopTab}
            />

            <div className="flex items-center gap-2 pt-0.5">
              <button
                type="button"
                aria-label="Mark response helpful"
                aria-pressed={voted === "up"}
                onClick={() =>
                  setFeedback((prev) => ({
                    ...prev,
                    [message.id]: prev[message.id] === "up" ? undefined : "up",
                  }))
                }
                className={cn(
                  "text-mda-ink-muted transition-colors hover:text-mda-success",
                  voted === "up" && "text-mda-success",
                )}
              >
                <ThumbsUp className="h-3.5 w-3.5" aria-hidden />
              </button>
              <button
                type="button"
                aria-label="Mark response unhelpful"
                aria-pressed={voted === "down"}
                onClick={() =>
                  setFeedback((prev) => ({
                    ...prev,
                    [message.id]:
                      prev[message.id] === "down" ? undefined : "down",
                  }))
                }
                className={cn(
                  "text-mda-ink-muted transition-colors hover:text-mda-danger",
                  voted === "down" && "text-mda-danger",
                )}
              >
                <ThumbsDown className="h-3.5 w-3.5" aria-hidden />
              </button>
            </div>

            <EvidenceDisclosure
              limitations={message.limitations}
              evidence={message.evidence}
            />
          </div>
        );
      })}

      {isLoading ? (
        <div className="space-y-1.5 text-mda-ink-muted">
          <p className="font-mda text-xs font-bold uppercase tracking-wider text-mda-cyan">
            Strategist
          </p>
          <p className="font-open-sans text-sm">Reviewing your current list…</p>
        </div>
      ) : null}
      <div ref={bottomRef} aria-hidden className="h-px w-full shrink-0" />
    </div>
  );
}
