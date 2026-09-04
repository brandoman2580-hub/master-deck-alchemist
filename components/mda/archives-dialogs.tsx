"use client";

import type { ReactNode } from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import {
  Check,
  Crown,
  Gamepad2,
  X,
  type LucideIcon,
} from "lucide-react";
import { RemoveScroll } from "react-remove-scroll";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  ARCHIVE_POPOVER_CONTENT_CLASS,
  ARCHIVE_POPOVER_EDGE_PAD,
  ARCHIVE_POPOVER_PANEL_CLASS,
} from "@/components/mda/archives-popover-styles";
import type { DeckCard, DeckMode, DeckType } from "@/types/types";
import { CardImage } from "@/components/ui/card-image";
import { MdaCardPreview } from "@/components/mda/mda-card-preview";
import { cn } from "@/lib/utils";

/**
 * Full-viewport interaction lock without a visual backdrop.
 * Captures pointer events + scroll lock; Escape / click-outside still close.
 */
function Overlay({
  children,
  onClose,
}: {
  children: ReactNode;
  onClose: () => void;
}): ReactNode {
  const reduceMotion = useReducedMotion();
  return (
    <RemoveScroll>
      <motion.div
        className="fixed inset-0 z-50 flex items-center justify-center bg-transparent p-4"
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
    </RemoveScroll>
  );
}

const FORMAT_OPTIONS: { key: DeckMode; icon: LucideIcon; label: string }[] = [
  { key: "TCG", icon: Crown, label: "TCG" },
  { key: "Master Duel", icon: Gamepad2, label: "MD" },
];

function FormatPickerPanel({
  title,
  mode,
  onModeChange,
  onConfirm,
  onCancel,
}: {
  title: string;
  mode: DeckMode;
  onModeChange: (mode: DeckMode) => void;
  onConfirm: () => void;
  onCancel: () => void;
}): ReactNode {
  return (
    <div className={ARCHIVE_POPOVER_PANEL_CLASS}>
      <p className="sr-only">{title}</p>
      <div className="flex overflow-hidden rounded">
        {FORMAT_OPTIONS.map(({ key, icon: Icon, label }) => (
          <button
            key={key}
            type="button"
            onClick={() => onModeChange(key)}
            data-magnetic
            className={cn(
              "inline-flex items-center gap-1.5 px-3 py-2 font-mda text-sm font-bold uppercase transition-colors duration-200 ease-in-out",
              mode === key
                ? "bg-mda-chrome text-mda-inverse-text"
                : "bg-mda-panel text-mda-ink hover:bg-mda-chrome hover:text-mda-inverse-text",
            )}
          >
            <Icon className="h-4 w-4" aria-hidden />
            {label}
          </button>
        ))}
      </div>
      <button
        type="button"
        onClick={onConfirm}
        data-magnetic
        aria-label="Confirm"
        className="rounded p-2 text-mda-success transition-[background-color,color,transform] duration-200 ease-in-out hover:bg-mda-success/20 hover:scale-105 active:scale-95"
      >
        <Check className="h-6 w-6" aria-hidden />
      </button>
      <button
        type="button"
        onClick={onCancel}
        data-magnetic
        aria-label="Cancel"
        className="rounded p-2 text-mda-danger transition-[background-color,color,transform] duration-200 ease-in-out hover:bg-mda-danger/20 hover:scale-105 active:scale-95"
      >
        <X className="h-6 w-6" aria-hidden />
      </button>
    </div>
  );
}

/** Anchored format picker — matches copy deck popover styling. */
export function FormatPickerPopover({
  title,
  open,
  onOpenChange,
  trigger,
  mode,
  onModeChange,
  onConfirm,
  onCancel,
  side = "bottom",
  align = "end",
}: {
  title: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  trigger: ReactNode;
  mode: DeckMode;
  onModeChange: (mode: DeckMode) => void;
  onConfirm: () => void;
  onCancel: () => void;
  side?: "top" | "right" | "bottom" | "left";
  align?: "start" | "center" | "end";
}): ReactNode {
  return (
    <Popover open={open} onOpenChange={onOpenChange}>
      <PopoverTrigger asChild>{trigger}</PopoverTrigger>
      <PopoverContent
        side={side}
        align={align}
        sideOffset={10}
        collisionPadding={ARCHIVE_POPOVER_EDGE_PAD}
        className={ARCHIVE_POPOVER_CONTENT_CLASS}
        data-mda-action-popover
      >
        <FormatPickerPanel
          title={title}
          mode={mode}
          onModeChange={onModeChange}
          onConfirm={onConfirm}
          onCancel={onCancel}
        />
      </PopoverContent>
    </Popover>
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
          <div className="border border-mda-ink/15 bg-mda-surface shadow-mda-lift">
            <FormatPickerPanel
              title={title}
              mode={mode}
              onModeChange={onModeChange}
              onConfirm={onConfirm}
              onCancel={onCancel}
            />
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
        <div className="relative h-[99px] w-[72px] shrink-0 cursor-help overflow-hidden bg-mda-panel">
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
        <p className="truncate font-mda text-lg font-bold uppercase text-mda-ink">
          {card.name}
        </p>
        <div className="mt-1 flex flex-wrap gap-2">
          <span className="rounded bg-mda-chrome/15 px-2 py-1 font-mda text-xs text-mda-ink">
            {card.type?.split(" ")[0] ?? "Card"}
          </span>
          {race ? (
            <span className="rounded bg-mda-chrome/15 px-2 py-1 font-mda text-xs text-mda-ink">
              {race}
            </span>
          ) : null}
          {attribute ? (
            <span className="rounded bg-mda-chrome/15 px-2 py-1 font-mda text-xs text-mda-ink">
              {attribute}
            </span>
          ) : null}
        </div>
      </div>
      <span className="rounded bg-mda-chrome px-2 py-1 font-mda text-lg font-bold text-mda-inverse-text">
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
          <div className="flex w-full max-w-[523px] flex-col border border-mda-ink/15 bg-mda-surface shadow-mda-lift">
            <div className="bg-mda-chrome px-4 py-2 text-center font-mda text-2xl font-bold uppercase tracking-wide text-mda-inverse-text">
              Deck List
            </div>
            <p className="px-4 py-2 text-center font-mda text-xl font-bold uppercase text-mda-ink">
              {deck.name}
            </p>
            <div className="max-h-[70vh] space-y-3 overflow-y-auto px-2 pb-4">
              {sections.map((section) =>
                section.cards.length === 0 ? null : (
                  <div key={section.title}>
                    <p className="px-2.5 font-mda text-sm uppercase text-mda-ink-muted">
                      {section.title}
                    </p>
                    <div className="divide-y divide-mda-ink/10">
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
            <div className="flex gap-2 border-t border-mda-ink/15 p-3">
              <button
                type="button"
                onClick={onOpenWorkshop}
                data-magnetic
                className="flex-1 bg-mda-sky py-3 font-mda text-sm font-black uppercase text-white transition-colors duration-200 ease-in-out hover:bg-mda-sky-strong"
              >
                Open in Workshop
              </button>
              <button
                type="button"
                onClick={onClose}
                data-magnetic
                className="bg-mda-chrome px-4 py-3 font-mda text-sm font-bold uppercase text-mda-inverse-text transition-colors duration-200 ease-in-out hover:bg-mda-chrome-muted"
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
