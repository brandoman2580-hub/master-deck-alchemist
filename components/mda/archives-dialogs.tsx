"use client";

import type { ReactNode } from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import {
  Check,
  Gamepad2,
  X,
  type LucideIcon,
} from "lucide-react";
import { Crown } from "lucide-react";
import type { DeckCard, DeckMode, DeckType } from "@/types/types";
import { CardImage } from "@/components/ui/card-image";
import { MdaCardPreview } from "@/components/mda/mda-card-preview";
import { cn } from "@/lib/utils";

function Overlay({
  children,
  onClose,
}: {
  children: ReactNode;
  onClose: () => void;
}): ReactNode {
  const reduceMotion = useReducedMotion();
  return (
    <motion.div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
      role="presentation"
      onClick={onClose}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.2, ease: "easeInOut" }}
    >
      <motion.div
        role="dialog"
        aria-modal="true"
        className="max-h-[90vh] overflow-auto"
        onClick={(event) => event.stopPropagation()}
        initial={
          reduceMotion ? { opacity: 0 } : { opacity: 0, scale: 0.92 }
        }
        animate={{ opacity: 1, scale: 1 }}
        exit={
          reduceMotion ? { opacity: 0 } : { opacity: 0, scale: 0.94 }
        }
        transition={{ type: "spring", stiffness: 420, damping: 32 }}
      >
        {children}
      </motion.div>
    </motion.div>
  );
}

export function FormatPickerDialog({
  title,
  open,
  mode,
  onModeChange,
  onConfirm,
  onCancel,
}: {
  title: string;
  open: boolean;
  mode: DeckMode;
  onModeChange: (mode: DeckMode) => void;
  onConfirm: () => void;
  onCancel: () => void;
}): ReactNode {
  return (
    <AnimatePresence>
      {open ? (
        <Overlay onClose={onCancel} key="format-picker">
          <div className="flex items-center gap-3 bg-[color:var(--mda-surface)] p-3 shadow-xl">
            <p className="sr-only">{title}</p>
            <div className="flex overflow-hidden rounded">
              {(
                [
                  { key: "TCG" as const, icon: Crown },
                  { key: "Master Duel" as const, icon: Gamepad2 },
                ] as { key: DeckMode; icon: LucideIcon }[]
              ).map(({ key, icon: Icon }) => (
                <button
                  key={key}
                  type="button"
                  onClick={() => onModeChange(key)}
                  data-magnetic
                  className={cn(
                    "inline-flex items-center gap-1.5 px-3 py-2 font-mda text-sm font-bold uppercase transition-colors duration-200 ease-in-out",
                    mode === key
                      ? "bg-white text-[color:var(--mda-bg-deep)]"
                      : "bg-white/15 text-white/70 hover:bg-white hover:text-[color:var(--mda-bg-deep)]",
                  )}
                >
                  <Icon className="h-4 w-4" aria-hidden />
                  {key === "Master Duel" ? "MD" : "TCG"}
                </button>
              ))}
            </div>
            <button
              type="button"
              onClick={onConfirm}
              aria-label="Confirm"
              className="rounded p-2 text-[color:var(--mda-success)] transition-colors duration-200 hover:bg-white/10"
            >
              <Check className="h-6 w-6" aria-hidden />
            </button>
            <button
              type="button"
              onClick={onCancel}
              aria-label="Cancel"
              className="rounded p-2 text-[color:var(--mda-danger)] transition-colors duration-200 hover:bg-white/10"
            >
              <X className="h-6 w-6" aria-hidden />
            </button>
          </div>
        </Overlay>
      ) : null}
    </AnimatePresence>
  );
}

function groupCardsById(cards: DeckCard[]): { card: DeckCard; quantity: number }[] {
  const groups = new Map<number | string, { card: DeckCard; quantity: number }>();
  for (const card of cards) {
    const key = card.id ?? card.name;
    const existing = groups.get(key);
    if (existing) {
      existing.quantity += 1;
    } else {
      groups.set(key, { card, quantity: 1 });
    }
  }
  return Array.from(groups.values());
}

function CardRow({
  card,
  quantity,
}: {
  card: DeckCard;
  quantity: number;
}): ReactNode {
  const race = "race" in card ? String((card as { race?: string }).race ?? "") : "";
  const attribute =
    "attribute" in card
      ? String((card as { attribute?: string }).attribute ?? "")
      : "";
  return (
    <div className="flex items-center gap-3 px-2.5 py-2">
      <MdaCardPreview card={card}>
        <div className="relative h-[99px] w-[72px] shrink-0 cursor-help overflow-hidden bg-[color:var(--mda-bg-deep)]">
          <CardImage
            card={card}
            preferSmall
            fill
            alt={card.name}
            className="object-cover"
            sizes="72px"
          />
        </div>
      </MdaCardPreview>
      <div className="min-w-0 flex-1">
        <p className="truncate font-mda text-lg font-bold uppercase text-white">
          {card.name}
        </p>
        <div className="mt-1 flex flex-wrap gap-2">
          <span className="rounded bg-white/15 px-2 py-1 font-mda text-xs text-white/90">
            {card.type?.split(" ")[0] ?? "Card"}
          </span>
          {race ? (
            <span className="rounded bg-white/15 px-2 py-1 font-mda text-xs text-white/90">
              {race}
            </span>
          ) : null}
          {attribute ? (
            <span className="rounded bg-white/15 px-2 py-1 font-mda text-xs text-white/90">
              {attribute}
            </span>
          ) : null}
        </div>
      </div>
      <span className="rounded bg-white/10 px-2 py-1 font-mda text-lg font-bold text-white">
        ×{quantity}
      </span>
    </div>
  );
}

export function DeckDetailsModal({
  open,
  deck,
  onClose,
  onOpenWorkshop,
}: {
  open: boolean;
  deck: DeckType | null;
  onClose: () => void;
  onOpenWorkshop: () => void;
}): ReactNode {
  const sections: { title: string; cards: DeckCard[] }[] = deck
    ? [
        { title: "Main Deck", cards: deck.mainDeck },
        { title: "Extra Deck", cards: deck.extraDeck },
        { title: "Side Deck", cards: deck.sideDeck },
      ]
    : [];

  return (
    <AnimatePresence>
      {open && deck ? (
        <Overlay onClose={onClose} key="deck-details">
          <div className="flex w-full max-w-[523px] flex-col bg-[color:var(--mda-bg-deep)] shadow-2xl">
            <div className="bg-[color:var(--mda-header-bar)] px-4 py-2 text-center font-mda text-2xl font-bold uppercase tracking-wide text-white">
              Deck List
            </div>
            <p className="px-4 py-2 text-center font-mda text-xl font-bold uppercase text-white">
              {deck.name}
            </p>
            <div className="max-h-[70vh] space-y-3 overflow-y-auto px-2 pb-4">
              {sections.map((section) =>
                section.cards.length === 0 ? null : (
                  <div key={section.title}>
                    <p className="px-2.5 font-mda text-sm uppercase text-white/60">
                      {section.title}
                    </p>
                    <div className="divide-y divide-white/5">
                      {groupCardsById(section.cards).map(({ card, quantity }) => (
                        <CardRow
                          key={`${section.title}-${card.id ?? card.name}`}
                          card={card}
                          quantity={quantity}
                        />
                      ))}
                    </div>
                  </div>
                ),
              )}
            </div>
            <div className="flex gap-2 border-t border-white/10 p-3">
              <button
                type="button"
                onClick={onOpenWorkshop}
                data-magnetic
                className="flex-1 bg-[color:var(--mda-cyan)] py-3 font-mda text-sm font-black uppercase text-[color:var(--mda-bg-deep)] transition-colors duration-200 ease-in-out hover:bg-[color:var(--mda-bg-deep)] hover:text-[color:var(--mda-cyan)]"
              >
                Open in Workshop
              </button>
              <button
                type="button"
                onClick={onClose}
                className="bg-white/10 px-4 py-3 font-mda text-sm font-bold uppercase text-white transition-colors duration-200 ease-in-out hover:bg-white hover:text-[color:var(--mda-bg-deep)]"
              >
                Close
              </button>
            </div>
          </div>
        </Overlay>
      ) : null}
    </AnimatePresence>
  );
}
