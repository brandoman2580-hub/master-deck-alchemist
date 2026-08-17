"use client";

import { useMemo, useState, type ReactNode } from "react";
import { Image as ImageIcon } from "lucide-react";
import { LayoutGroup, motion, useReducedMotion } from "framer-motion";
import { CardImage } from "@/components/ui/card-image";
import { useDeck } from "@/context/deck-context";
import type { DeckCard } from "@/types/types";
import { cn } from "@/lib/utils";

type ComboDoc = {
  id: string;
  title: string;
  subtitle: string;
  weaknesses: string[];
  comments: string;
  /** Offsets into deck lists so each tab yields a different card order. */
  handOffset: number;
  seqOffset: number;
};

const DEFAULT_COMBOS: ComboDoc[] = [
  {
    id: "1",
    title: "Combo 1",
    subtitle: "Synchro V1",
    weaknesses: ["Ash Blossom", "Nibiru"],
    comments:
      "Step 1: Search your primary starter. Why: Card advantage and tutor synergy prep.",
    handOffset: 0,
    seqOffset: 0,
  },
  {
    id: "2",
    title: "Combo 2",
    subtitle: "XYZ V1",
    weaknesses: ["Infinite Impermanence"],
    comments: "Open with extender into rank plays when going second.",
    handOffset: 2,
    seqOffset: 1,
  },
  {
    id: "3",
    title: "Combo 3",
    subtitle: "Link V1",
    weaknesses: ["Droll & Lock Bird"],
    comments: "Link climb into end-board pieces; keep one extender in hand.",
    handOffset: 4,
    seqOffset: 2,
  },
];

function CardSlot({ card }: { card?: DeckCard }): ReactNode {
  const reduceMotion = useReducedMotion();
  const body = card ? (
    <CardImage
      card={card}
      preferSmall
      fill
      alt={card.name}
      className="object-cover"
      sizes="72px"
    />
  ) : (
    <ImageIcon className="h-10 w-10 text-white/25" aria-hidden />
  );

  return (
    <motion.div
      layout={!reduceMotion}
      layoutId={
        card
          ? `combo-card-${card.deckInstanceId ?? card.id}`
          : undefined
      }
      transition={{ type: "spring", stiffness: 380, damping: 32 }}
      className="relative flex h-[99px] w-[72px] items-center justify-center overflow-hidden bg-[color:var(--mda-bg-deep)] transition-[box-shadow] duration-200 ease-in-out hover:shadow-[0_0_16px_2px_rgba(255,255,255,0.55)]"
    >
      {body}
    </motion.div>
  );
}

function rotateSlice<T>(items: T[], offset: number, count: number): T[] {
  if (items.length === 0) return [];
  const start = ((offset % items.length) + items.length) % items.length;
  const out: T[] = [];
  for (let i = 0; i < count; i += 1) {
    out.push(items[(start + i) % items.length]);
  }
  return out;
}

export function WorkshopCombosPane(): ReactNode {
  const { currentDeck } = useDeck();
  const [activeId, setActiveId] = useState(DEFAULT_COMBOS[0].id);
  const active =
    DEFAULT_COMBOS.find((combo) => combo.id === activeId) ?? DEFAULT_COMBOS[0];

  const hand = useMemo(
    () =>
      rotateSlice(currentDeck.mainDeck, active.handOffset, 5),
    [currentDeck.mainDeck, active.handOffset],
  );
  const sequenceA = useMemo(
    () =>
      rotateSlice(currentDeck.mainDeck, active.seqOffset + 5, 3),
    [currentDeck.mainDeck, active.seqOffset],
  );
  const sequenceB = useMemo(
    () =>
      rotateSlice(currentDeck.extraDeck, active.seqOffset, 3),
    [currentDeck.extraDeck, active.seqOffset],
  );
  const sequenceC = useMemo(
    () =>
      rotateSlice(currentDeck.extraDeck, active.seqOffset + 3, 2),
    [currentDeck.extraDeck, active.seqOffset],
  );
  const endBoard = useMemo(() => {
    const mixed = [
      ...rotateSlice(currentDeck.extraDeck, active.seqOffset, 3),
      ...rotateSlice(currentDeck.mainDeck, active.handOffset, 2),
    ];
    return mixed.slice(0, 5);
  }, [
    currentDeck.extraDeck,
    currentDeck.mainDeck,
    active.seqOffset,
    active.handOffset,
  ]);

  return (
    <LayoutGroup>
      <div className="grid h-full min-h-0 grid-cols-1 gap-3 p-2.5 lg:grid-cols-[253px_minmax(0,400px)_minmax(0,1fr)]">
        <div className="space-y-2 overflow-y-auto">
          {DEFAULT_COMBOS.map((combo) => {
            const selected = combo.id === activeId;
            return (
              <button
                key={combo.id}
                type="button"
                onClick={() => setActiveId(combo.id)}
                data-magnetic
                className={cn(
                  "flex w-full flex-col items-center rounded px-3 py-4 font-mda uppercase transition-colors duration-200 ease-in-out",
                  selected
                    ? "bg-white/20 text-white"
                    : "bg-[color:var(--mda-bg-deep)] text-white/55 hover:bg-white hover:text-[color:var(--mda-bg-deep)]",
                )}
              >
                <span className="text-2xl font-bold">{combo.title}</span>
                <span className="text-lg">{combo.subtitle}</span>
              </button>
            );
          })}
        </div>

        <div className="space-y-6 overflow-y-auto px-1">
          <div>
            <p className="mb-2 font-mda text-lg font-bold uppercase text-white">
              Starting Hand
            </p>
            <div className="flex flex-wrap gap-2">
              {Array.from({ length: 5 }).map((_, index) => (
                <CardSlot
                  key={
                    hand[index]?.deckInstanceId ??
                    `hand-empty-${activeId}-${index}`
                  }
                  card={hand[index]}
                />
              ))}
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            {Array.from({ length: 3 }).map((_, index) => (
              <CardSlot
                key={
                  sequenceA[index]?.deckInstanceId ??
                  `a-empty-${activeId}-${index}`
                }
                card={sequenceA[index]}
              />
            ))}
          </div>
          <div className="flex flex-wrap gap-2">
            {Array.from({ length: 3 }).map((_, index) => (
              <CardSlot
                key={
                  sequenceB[index]?.deckInstanceId ??
                  `b-empty-${activeId}-${index}`
                }
                card={sequenceB[index]}
              />
            ))}
          </div>
          <div className="flex flex-wrap gap-2">
            {Array.from({ length: 2 }).map((_, index) => (
              <CardSlot
                key={
                  sequenceC[index]?.deckInstanceId ??
                  `c-empty-${activeId}-${index}`
                }
                card={sequenceC[index]}
              />
            ))}
          </div>
          <div>
            <p className="mb-2 font-mda text-lg font-bold uppercase text-white">
              End Board
            </p>
            <div className="flex flex-wrap gap-2">
              {Array.from({ length: 5 }).map((_, index) => (
                <CardSlot
                  key={
                    endBoard[index]?.deckInstanceId ??
                    `end-empty-${activeId}-${index}`
                  }
                  card={endBoard[index]}
                />
              ))}
            </div>
          </div>
        </div>

        <div className="flex min-h-0 flex-col gap-4 overflow-y-auto">
          <section className="flex-1 bg-[color:var(--mda-surface)]/30 p-3">
            <h3 className="mb-3 font-mda text-xl font-bold uppercase text-white">
              Weaknesses
            </h3>
            <p className="mb-2 font-mda text-sm text-white/70">
              This combo dies to:
            </p>
            <ul className="list-disc space-y-1 pl-5 font-mda text-base text-white">
              {active.weaknesses.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
          </section>
          <section className="flex-1 bg-[color:var(--mda-surface)]/30 p-3">
            <h3 className="mb-3 font-mda text-xl font-bold uppercase text-white">
              Comments
            </h3>
            <p className="whitespace-pre-wrap font-mda text-base leading-relaxed text-white/85">
              {active.comments}
            </p>
          </section>
        </div>
      </div>
    </LayoutGroup>
  );
}
