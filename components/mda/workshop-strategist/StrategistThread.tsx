"use client";

import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { useCardStore } from "@/store/cardStore";
import { useDeck } from "@/context/deck-context";
import { getRemainingCopies, isExtraDeckCard } from "@/lib/deck/copy-limits";
import { RecommendationCard } from "./RecommendationCard";
import { TuningActionRow } from "./TuningActionRow";
import { WorkshopTabCta } from "./WorkshopTabCta";
import type { StrategistMessage } from "./types";
import type { Card } from "@/types/card";
import type { DeckSection } from "@/types/deck";
import type { WorkshopTab } from "@/components/mda/workshop-deck-chrome";

const MAX_TUNING_VISIBLE = 3;
const MAX_SYNERGY_VISIBLE = 5;

interface StrategistThreadProps {
  messages: StrategistMessage[];
  isLoading?: boolean;
  onApplyTuning: (cardId: string, toCopies: number) => void;
  onAddSynergy: (card: Card, section: DeckSection) => void;
  onOpenWorkshopTab?: (tab: Extract<WorkshopTab, "matchups" | "combos">) => void;
  welcome?: ReactNode;
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

function formatStamp(date: Date): string {
  return date.toLocaleTimeString("en-GB", { hour12: false });
}

/**
 * Strategist thread — dark user pods, light plates, Apply / Add rows, tab keycaps.
 */
export function StrategistThread({
  messages,
  isLoading = false,
  onApplyTuning,
  onAddSynergy,
  onOpenWorkshopTab,
  welcome = null,
}: StrategistThreadProps) {
  const cardList = useCardStore((state) => state.cardList);
  const { currentDeck, banlist } = useDeck();
  const [appliedKeys, setAppliedKeys] = useState<Set<string>>(new Set());
  const [showAllTuning, setShowAllTuning] = useState<Record<string, boolean>>({});
  const [showAllSynergy, setShowAllSynergy] = useState<Record<string, boolean>>({});
  const bottomRef = useRef<HTMLDivElement | null>(null);
  const lastMessageId = messages[messages.length - 1]?.id;
  const showRarity = currentDeck.deckFormat !== "TCG";

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

  const resolveCard = (cardId: string, title?: string): Card | undefined => {
    const idNum = Number(cardId);
    let card = Number.isFinite(idNum) ? cardById.get(idNum) : undefined;
    if (!card && title) {
      const needle = title.trim().toLowerCase();
      card = cardList.find((entry) => entry.name.trim().toLowerCase() === needle);
    }
    return card;
  };

  return (
    <div
      className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto p-3.5"
      data-testid="strategist-thread-scroll"
      aria-label="Strategist conversation"
    >
      {messages.length === 0 && !isLoading ? welcome : null}
      {messages.map((message) => {
        if (message.role === "user") {
          return (
            <div key={message.id} className="flex flex-col items-end">
              <div className="max-w-[90%] border border-[#28303b] bg-[#14181f] p-3 text-[13px] leading-relaxed text-[#e2e2e8]">
                {message.content}
              </div>
              <span className="mt-1 pr-1 text-[10px] text-[#5b6369]">
                {formatStamp(message.timestamp)}
              </span>
            </div>
          );
        }

        const tuning = message.tuning?.recommendation ?? [];
        const synergies = message.synergies ?? [];
        const recommendationCards =
          message.recommendations ?? message.coach?.recommendations ?? [];
        const showTuningAll = showAllTuning[message.id] === true;
        const showSynergyAll = showAllSynergy[message.id] === true;
        const visibleTuning = showTuningAll ? tuning : tuning.slice(0, MAX_TUNING_VISIBLE);
        const visibleSynergies = showSynergyAll
          ? synergies
          : synergies.slice(0, MAX_SYNERGY_VISIBLE);
        const useStructuredCards = recommendationCards.length > 0;

        const tuningRows = visibleTuning.map((rec, index) => {
          const card = resolveCard(rec.cardId);
          const applyKey = `${message.id}:${rec.cardId}:${rec.fromCopies}->${rec.toCopies}:${index}`;
          return { rec, card, applyKey, index };
        });

        const addRows = useStructuredCards
          ? recommendationCards.map((rec, index) => {
              const card = resolveCard(rec.cardId, rec.title);
              const remaining = card ? getRemainingCopies(card, currentDeck, banlist) : 0;
              const section: DeckSection =
                card && isExtraDeckCard(card) ? "extraDeck" : "mainDeck";
              return {
                key: `${message.id}-rec-${rec.cardId}-${index}`,
                title: rec.title,
                roleTag: rec.roleTag,
                effectLines: rec.effectLines ?? [],
                card,
                section,
                disabled: !card || remaining <= 0,
                disabledReason: !card
                  ? "Card not in library"
                  : remaining <= 0
                    ? "Copy limit or banlist"
                    : undefined,
              };
            })
          : visibleSynergies.map((synergy, index) => {
              const card = resolveCard(synergy.cardId, synergy.title);
              const remaining = card ? getRemainingCopies(card, currentDeck, banlist) : 0;
              const section: DeckSection =
                card && isExtraDeckCard(card) ? "extraDeck" : "mainDeck";
              const effectSource =
                synergy.fitSummary?.trim() || synergy.genericCondition?.trim() || "";
              const effectLines = effectSource
                .split(/[.;]\s+/)
                .map((line) => line.trim())
                .filter(Boolean);
              return {
                key: `${message.id}-${synergy.cardId}-${index}`,
                title: synergy.title,
                roleTag: inferRoleTag(`${synergy.title} ${effectSource}`),
                effectLines: effectLines.length ? effectLines : ["Mechanical synergy candidate"],
                card,
                section,
                disabled: !card || remaining <= 0,
                disabledReason: !card
                  ? "Card not in library"
                  : remaining <= 0
                    ? "Copy limit or banlist"
                    : undefined,
              };
            });

        const pendingTuning = tuningRows.filter((row) => !appliedKeys.has(row.applyKey));
        const batchActions: Array<() => void> = [];
        const canApplyAll =
          tuningRows.every((row) => Boolean(row.card)) &&
          addRows.every((row) => !row.disabled) &&
          (pendingTuning.length > 0 || addRows.length > 0);

        if (canApplyAll) {
          for (const row of pendingTuning) {
            batchActions.push(() => {
              onApplyTuning(row.rec.cardId, row.rec.toCopies);
            });
          }
          for (const row of addRows) {
            if (!row.card) continue;
            const card = row.card;
            batchActions.push(() => onAddSynergy(card, row.section));
          }
        }

        return (
          <div key={message.id} className="flex flex-col items-start">
            <div className="w-full max-w-[95%] border-y border-r border-[#c1ccd4] border-l-[3px] border-l-[#bfe5f3] bg-white p-3">
              <p className="whitespace-pre-wrap text-[13px] leading-relaxed text-[#0c0e12]">
                {message.content}
              </p>

              {tuningRows.length > 0 || addRows.length > 0 ? (
                <div className="mt-3 flex flex-col gap-2 border-t border-[#dce5eb] pt-3">
                  {tuningRows.map(({ rec, card, applyKey }) => (
                    <TuningActionRow
                      key={applyKey}
                      recommendation={rec}
                      cardName={card?.name ?? `Card ${rec.cardId}`}
                      card={card}
                      showRarity={showRarity}
                      applied={appliedKeys.has(applyKey)}
                      disabled={!card}
                      onApply={() => {
                        onApplyTuning(rec.cardId, rec.toCopies);
                        setAppliedKeys((prev) => new Set(prev).add(applyKey));
                      }}
                    />
                  ))}
                  {tuning.length > MAX_TUNING_VISIBLE ? (
                    <button
                      type="button"
                      className="text-left text-[11px] font-semibold uppercase tracking-[0.12em] text-[#5b6369] hover:text-[#0c0e12]"
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

                  {addRows.map((row) => (
                    <RecommendationCard
                      key={row.key}
                      title={row.title}
                      roleTag={row.roleTag}
                      effectLines={row.effectLines}
                      card={row.card}
                      showRarity={showRarity}
                      deltaLabel={`${row.section === "extraDeck" ? "Extra" : "Main"} +1`}
                      disabled={row.disabled}
                      disabledReason={row.disabledReason}
                      onAdd={() => {
                        if (!row.card) return;
                        onAddSynergy(row.card, row.section);
                      }}
                    />
                  ))}
                  {!useStructuredCards && synergies.length > MAX_SYNERGY_VISIBLE ? (
                    <button
                      type="button"
                      className="text-left text-[11px] font-semibold uppercase tracking-[0.12em] text-[#5b6369] hover:text-[#0c0e12]"
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

                  {canApplyAll ? (
                    <button
                      type="button"
                      className="mt-1 flex h-8 w-full items-center justify-center gap-2 border border-[#28303b] bg-[#14181f] text-[11px] font-semibold uppercase tracking-[0.12em] text-[#e2e2e8] transition-colors hover:border-[#bfe5f3]"
                      onClick={() => {
                        for (const run of batchActions) run();
                        setAppliedKeys((prev) => {
                          const next = new Set(prev);
                          for (const row of tuningRows) next.add(row.applyKey);
                          return next;
                        });
                      }}
                    >
                      Apply all
                      <span aria-hidden="true" className="inline-block h-2 w-[2px] bg-[#bfe5f3]" />
                    </button>
                  ) : null}
                </div>
              ) : null}

              <WorkshopTabCta
                redirectHint={message.redirectHint ?? message.coach?.redirectHint}
                onOpenWorkshopTab={onOpenWorkshopTab}
              />
            </div>
          </div>
        );
      })}

      {isLoading ? (
        <div className="max-w-[95%] border-y border-r border-[#c1ccd4] border-l-[3px] border-l-[#bfe5f3] bg-white p-3 text-[13px] text-[#5b6369]">
          Reviewing your current list…
        </div>
      ) : null}
      <div ref={bottomRef} aria-hidden className="h-px w-full shrink-0" />
    </div>
  );
}
