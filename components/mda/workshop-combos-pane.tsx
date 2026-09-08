"use client";

import { useEffect, useMemo, useState, type ReactNode } from "react";
import { Image as ImageIcon } from "lucide-react";
import { LayoutGroup, motion, useReducedMotion } from "framer-motion";
import { CardImage } from "@/components/ui/card-image";
import { useDeck } from "@/context/deck-context";
import { MdaLoadingScreen } from "@/components/mda/mda-loading-screen";
import { explainComboLine } from "@/lib/api/comboCompiler";
import {
  cardsForNode,
  type ComboLine,
  type DeckCardRef,
  type FactsEnvelope,
} from "@/lib/engine";
import type { DeckCard } from "@/types/types";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";

const CARD_SIZES = "(min-width: 576px) 104px, 20vw";
const CARD_TILE =
  "relative aspect-[59/86] w-[20vw] max-w-[104px] min-w-[72px] overflow-hidden bg-mda-deep sm:w-[104px]";

const SECTION_HEADING =
  "mb-2 font-mda text-2xl font-semibold uppercase tracking-wide text-mda-ink";
const SECTION_BODY = "font-mda text-2xl font-normal leading-snug text-mda-ink";

function toRefs(deck: {
  mainDeck: DeckCard[];
  extraDeck: DeckCard[];
  sideDeck: DeckCard[];
}): DeckCardRef[] {
  return [
    ...deck.mainDeck.map((c) => ({ id: c.id, name: c.name, zone: "main" as const })),
    ...deck.extraDeck.map((c) => ({
      id: c.id,
      name: c.name,
      zone: "extra" as const,
    })),
    ...deck.sideDeck.map((c) => ({ id: c.id, name: c.name, zone: "side" as const })),
  ];
}

function resolveDeckCards(
  refs: DeckCardRef[],
  deck: { mainDeck: DeckCard[]; extraDeck: DeckCard[]; sideDeck: DeckCard[] },
): DeckCard[] {
  const pool = [...deck.mainDeck, ...deck.extraDeck, ...deck.sideDeck];
  const out: DeckCard[] = [];
  for (const ref of refs) {
    const hit = pool.find((c) => c.id === ref.id);
    if (hit) out.push(hit);
  }
  return out;
}

function CardSlot({ card }: { card?: DeckCard }): ReactNode {
  const reduceMotion = useReducedMotion();
  const body = card ? (
    <CardImage
      card={card}
      preferSmall
      fill
      alt={card.name}
      className="object-contain"
      sizes={CARD_SIZES}
    />
  ) : (
    <ImageIcon className="h-8 w-8 text-mda-ink-muted/40" aria-hidden />
  );

  return (
    <motion.div
      layout={!reduceMotion}
      layoutId={
        card ? `combo-card-${card.deckInstanceId ?? card.id}` : undefined
      }
      transition={{ type: "spring", stiffness: 380, damping: 32 }}
      className={cn(
        CARD_TILE,
        "flex items-center justify-center shadow-[0_6px_16px_rgba(58,79,92,0.28)] transition-shadow hover:shadow-mda-soft",
      )}
    >
      {body}
    </motion.div>
  );
}

function nodeCards(
  line: ComboLine,
  kind: "hand" | "step" | "endboard",
  deckRefs: DeckCardRef[],
  deck: { mainDeck: DeckCard[]; extraDeck: DeckCard[]; sideDeck: DeckCard[] },
  slots: number,
): DeckCard[] {
  const nodes = line.nodes.filter((n) => n.kind === kind);
  const refs = nodes.flatMap((n) => cardsForNode(n, deckRefs));
  return resolveDeckCards(refs, deck).slice(0, slots);
}

export type WorkshopCombosPaneProps = {
  facts: FactsEnvelope | null;
  loading: boolean;
  error?: string | null;
};

export function WorkshopCombosPane({
  facts,
  loading,
  error = null,
}: WorkshopCombosPaneProps): ReactNode {
  const { currentDeck } = useDeck();
  const lines = facts?.combos.lines ?? [];
  const [activeId, setActiveId] = useState<string | null>(null);
  const [explanation, setExplanation] = useState<string | null>(null);
  const [explainLoading, setExplainLoading] = useState(false);
  const [explainError, setExplainError] = useState<string | null>(null);

  useEffect(() => {
    if (lines.length === 0) {
      setActiveId(null);
      return;
    }
    if (!activeId || !lines.some((l) => l.id === activeId)) {
      setActiveId(lines[0]!.id);
    }
  }, [activeId, lines]);

  useEffect(() => {
    setExplanation(null);
    setExplainError(null);
  }, [activeId]);

  const active = lines.find((l) => l.id === activeId) ?? lines[0] ?? null;
  const deckRefs = useMemo(() => toRefs(currentDeck), [currentDeck]);

  const hand = useMemo(
    () =>
      active
        ? nodeCards(active, "hand", deckRefs, currentDeck, 5)
        : [],
    [active, currentDeck, deckRefs],
  );
  const steps = useMemo(
    () =>
      active
        ? nodeCards(active, "step", deckRefs, currentDeck, 8)
        : [],
    [active, currentDeck, deckRefs],
  );
  const endBoard = useMemo(
    () =>
      active
        ? nodeCards(active, "endboard", deckRefs, currentDeck, 5)
        : [],
    [active, currentDeck, deckRefs],
  );

  const sequenceChunks = [
    steps.slice(0, 3),
    steps.slice(3, 6),
    steps.slice(6, 8),
  ];

  const needsDeck = !loading && !facts;
  const emptyCombos =
    !loading && facts && facts.combos.lines.length === 0;

  const handleExplain = async () => {
    if (!active || !currentDeck.updated_at) {
      setExplainError("Save the deck to explain a validated combo line.");
      return;
    }
    setExplainLoading(true);
    setExplainError(null);
    try {
      const result = await explainComboLine(currentDeck.id, active.id);
      setExplanation(result.explanation);
    } catch (err) {
      setExplainError(
        err instanceof Error ? err.message : "Failed to explain combo",
      );
    } finally {
      setExplainLoading(false);
    }
  };

  return (
    <LayoutGroup>
      <div className="relative grid h-full min-h-0 grid-cols-1 gap-4 bg-[#B9BEBE]/50 p-4 lg:grid-cols-[220px_minmax(0,1fr)_minmax(0,280px)]">
        <MdaLoadingScreen
          open={loading}
          scoped
          status="Compiling combo lines…"
        />

        {needsDeck ? (
          <div className="col-span-full flex flex-col items-center justify-center gap-2 p-8 text-center font-mda text-mda-ink">
            <p className="text-2xl font-semibold uppercase tracking-wide">
              Build a 40+ card main deck
            </p>
            <p className="max-w-md text-base text-mda-ink-muted">
              Combos compile from curated templates matched to your archetype and
              validated against cards in the list.
            </p>
            {error ? (
              <p className="text-sm text-red-700" role="alert">
                {error}
              </p>
            ) : null}
          </div>
        ) : emptyCombos ? (
          <div className="col-span-full flex flex-col items-center justify-center gap-2 p-8 text-center font-mda text-mda-ink">
            <p className="text-2xl font-semibold uppercase tracking-wide">
              No validated lines yet
            </p>
            <p className="max-w-md text-base text-mda-ink-muted">
              Add core archetype pieces so a template can match, or wait for more
              curated combo templates.
            </p>
            <p className="text-sm text-mda-ink-muted">
              Source: {facts?.combos.source ?? "empty"}
            </p>
          </div>
        ) : (
          <>
            <div className="space-y-2 overflow-y-auto" role="listbox" aria-label="Combo lines">
              {lines.map((combo, index) => {
                const selected = combo.id === active?.id;
                return (
                  <button
                    key={combo.id}
                    type="button"
                    role="option"
                    aria-selected={selected}
                    onClick={() => setActiveId(combo.id)}
                    data-magnetic
                    className={cn(
                      "flex w-full flex-col items-center px-3 py-4 font-mda uppercase transition-colors duration-200 ease-in-out",
                      selected
                        ? "bg-[#EAF7FF]/60 text-mda-ink"
                        : "bg-mda-chrome text-mda-inverse-text hover:bg-mda-chrome-deep",
                    )}
                  >
                    <span className="text-2xl font-semibold">
                      Combo {index + 1}
                    </span>
                    <span className="text-lg font-normal opacity-80">
                      {combo.name}
                    </span>
                  </button>
                );
              })}
            </div>

            <div className="space-y-6 overflow-y-auto px-1">
              <div>
                <p className={SECTION_HEADING}>Starting Hand</p>
                <div className="flex flex-wrap gap-2">
                  {Array.from({ length: 5 }).map((_, index) => (
                    <CardSlot
                      key={
                        hand[index]?.deckInstanceId ??
                        `hand-empty-${active?.id}-${index}`
                      }
                      card={hand[index]}
                    />
                  ))}
                </div>
              </div>
              {sequenceChunks.map((chunk, chunkIndex) =>
                chunk.length > 0 || chunkIndex === 0 ? (
                  <div key={`seq-${chunkIndex}`} className="flex flex-wrap gap-2">
                    {Array.from({
                      length: chunkIndex === 2 ? 2 : 3,
                    }).map((_, index) => (
                      <CardSlot
                        key={
                          chunk[index]?.deckInstanceId ??
                          `seq-${chunkIndex}-${active?.id}-${index}`
                        }
                        card={chunk[index]}
                      />
                    ))}
                  </div>
                ) : null,
              )}
              <div>
                <p className={SECTION_HEADING}>End Board</p>
                <p className="mb-2 font-mda text-base text-mda-ink-muted">
                  {active?.endboardSummary}
                </p>
                <div className="flex flex-wrap gap-2">
                  {Array.from({ length: 5 }).map((_, index) => (
                    <CardSlot
                      key={
                        endBoard[index]?.deckInstanceId ??
                        `end-empty-${active?.id}-${index}`
                      }
                      card={endBoard[index]}
                    />
                  ))}
                </div>
              </div>
            </div>

            <div className="flex min-h-0 flex-col gap-4 overflow-y-auto border-t border-mda-ink/10 pt-4 lg:border-l lg:border-t-0 lg:pl-4 lg:pt-0">
              <section className="flex-1">
                <h3 className={SECTION_HEADING}>Weaknesses</h3>
                <p className={cn(SECTION_BODY, "mb-2")}>This combo dies to:</p>
                <ul className={cn(SECTION_BODY, "list-disc space-y-1 pl-5")}>
                  {(active?.killers ?? []).map((item) => (
                    <li key={item}>{item}</li>
                  ))}
                </ul>
              </section>
              <section className="flex-1">
                <h3 className={SECTION_HEADING}>Comments</h3>
                <div className="mb-3">
                  <Button
                    type="button"
                    onClick={() => void handleExplain()}
                    disabled={explainLoading || !active}
                    className="bg-mda-chrome text-mda-inverse-text hover:bg-mda-chrome-deep"
                    aria-label="Explain selected combo line"
                  >
                    {explainLoading ? "Explaining…" : "Explain line"}
                  </Button>
                </div>
                {explainError ? (
                  <p className="mb-2 text-sm text-red-700" role="alert">
                    {explainError}
                  </p>
                ) : null}
                <p className={cn(SECTION_BODY, "whitespace-pre-wrap")}>
                  {explanation ??
                    "Select a validated line, then explain to get coaching grounded in that graph only."}
                </p>
              </section>
            </div>
          </>
        )}
      </div>
    </LayoutGroup>
  );
}
