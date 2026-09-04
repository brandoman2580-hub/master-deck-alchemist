"use client";

import type { KeyboardEvent, ReactNode } from "react";
import { motion, useReducedMotion } from "framer-motion";
import { Copy, Crown, Gamepad2, Pin, Share2, Trash2 } from "lucide-react";
import { CardImage } from "@/components/ui/card-image";
import { DeckCapBadge } from "@/components/mda/deck-cap-badge";
import type { DeckCard, DeckMode } from "@/types/types";
import { cn } from "@/lib/utils";

export type DeckArchiveCardProps = {
  name: string;
  mode: DeckMode;
  isPinned: boolean;
  mainCount: number;
  extraCount: number;
  sideCount: number;
  coverCard?: DeckCard | null;
  onOpen: () => void;
  onDetails: () => void;
  onCopy: () => void;
  onShare: () => void;
  onDelete: () => void;
  onTogglePin: () => void;
  className?: string;
  /** Slot for anchored copy / share / delete popovers next to control buttons. */
  actionControls?: ReactNode;
};

const controlBtnClass =
  "rounded p-1 text-white transition-[background-color,color,transform] duration-200 ease-in-out hover:bg-white/15 hover:text-mda-inverse-text active:scale-95";

export function DeckArchiveCard({
  name,
  mode,
  isPinned,
  mainCount,
  extraCount,
  sideCount,
  coverCard,
  onOpen,
  onDetails,
  onCopy,
  onShare,
  onDelete,
  onTogglePin,
  className,
  actionControls,
}: DeckArchiveCardProps): ReactNode {
  const isTcg = mode === "TCG";
  const reduceMotion = useReducedMotion();

  const handleOpenKeyDown = (event: KeyboardEvent<HTMLDivElement>): void => {
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      onOpen();
    }
  };

  return (
    <motion.article
      data-magnetic
      className={cn(
        "group flex w-full max-w-[287px] flex-col overflow-hidden rounded-md bg-mda-inverse shadow-mda-soft will-change-transform",
        className,
      )}
      whileHover={
        reduceMotion
          ? undefined
          : {
              y: -6,
              boxShadow: "0 14px 32px rgba(58, 79, 92, 0.28)",
            }
      }
      transition={{ duration: 0.2, ease: "easeOut" }}
    >
      <div className="flex items-center justify-between px-2.5 pt-1.5">
        <div className="flex items-center gap-2 text-xs font-mda uppercase tracking-wide text-white">
          {isTcg ? (
            <Crown className="h-5 w-5" aria-hidden />
          ) : (
            <Gamepad2 className="h-5 w-5" aria-hidden />
          )}
          <span>{isTcg ? "TCG" : "Master Duel"}</span>
        </div>
        <button
          type="button"
          onClick={onTogglePin}
          aria-label={isPinned ? "Unpin deck" : "Pin deck"}
          aria-pressed={isPinned}
          className={cn(
            "rounded p-1 transition-colors duration-200 ease-in-out hover:bg-white/10",
            isPinned ? "text-mda-cyan" : "text-white/50",
          )}
        >
          <Pin
            className={cn(
              "h-5 w-5",
              isPinned && "fill-mda-cyan text-mda-cyan",
            )}
            aria-hidden
            fill={isPinned ? "currentColor" : "none"}
            strokeWidth={isPinned ? 0 : 2}
          />
        </button>
      </div>

      <div
        role="button"
        tabIndex={0}
        onClick={onOpen}
        onKeyDown={handleOpenKeyDown}
        aria-label={`Open ${name} in Workshop`}
        className="relative mx-0 mt-2 h-36 w-full cursor-pointer overflow-hidden bg-mda-inverse-deep focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-mda-cyan"
      >
        {coverCard ? (
          <CardImage
            card={coverCard}
            preferSmall={false}
            fill
            alt=""
            className="object-cover object-center"
            sizes="287px"
          />
        ) : (
          <div className="flex h-full items-center justify-center font-mda text-sm text-white/30">
            No cover art
          </div>
        )}
        <div
          aria-hidden
          className="pointer-events-none absolute inset-x-0 bottom-0 h-1/2 bg-gradient-to-t from-mda-inverse via-mda-inverse/70 to-transparent"
        />
        <div
          aria-hidden
          className="pointer-events-none absolute inset-x-0 bottom-0 flex items-end justify-center bg-gradient-to-t from-black/50 to-transparent pb-2.5 pt-8 opacity-0 transition-opacity duration-200 group-hover:opacity-100 group-focus-within:opacity-100"
        >
          <span className="font-mda text-xs font-bold uppercase tracking-wider text-white/95">
            Open in Workshop
          </span>
        </div>
      </div>

      <div className="flex flex-col gap-1 px-2.5 pb-2.5 pt-2">
        <button
          type="button"
          onClick={onOpen}
          className="w-full truncate bg-[rgba(207,207,207,0.28)] px-2 py-1 text-left font-mda text-sm font-bold uppercase tracking-wide text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-mda-cyan"
        >
          {name}
        </button>
        <div className="flex flex-wrap items-center justify-center gap-2 py-1">
          <DeckCapBadge label="M" value={mainCount} />
          <DeckCapBadge label="E" value={extraCount} />
          {isTcg ? <DeckCapBadge label="S" value={sideCount} /> : null}
        </div>
        <div className="flex items-center justify-between gap-2 pt-1">
          <button
            type="button"
            onClick={onDetails}
            data-magnetic
            className="min-h-[31px] flex-1 bg-mda-sky px-3 font-mda text-sm font-bold uppercase tracking-wide text-white transition-[background-color,color] duration-200 ease-in-out hover:bg-mda-sky-strong"
          >
            Details
          </button>
          {actionControls ?? (
            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={onCopy}
                aria-label={`Copy ${name}`}
                className={controlBtnClass}
              >
                <Copy className="h-5 w-5" aria-hidden />
              </button>
              <button
                type="button"
                onClick={onShare}
                aria-label={`Share ${name}`}
                className={controlBtnClass}
              >
                <Share2 className="h-5 w-5" aria-hidden />
              </button>
              <button
                type="button"
                onClick={onDelete}
                aria-label={`Delete ${name}`}
                className={cn(controlBtnClass, "hover:text-mda-danger")}
              >
                <Trash2 className="h-5 w-5" aria-hidden />
              </button>
            </div>
          )}
        </div>
      </div>
    </motion.article>
  );
}
