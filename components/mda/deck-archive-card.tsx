"use client";

import {
  useEffect,
  useId,
  useRef,
  useState,
  type KeyboardEvent as ReactKeyboardEvent,
  type ReactNode,
} from "react";
import { motion, useReducedMotion } from "framer-motion";
import { Copy, Crown, Gamepad2, MoreVertical, Pin, Share2, Trash2 } from "lucide-react";
import { CardImage } from "@/components/ui/card-image";
import { DeckCapBadge } from "@/components/mda/deck-cap-badge";
import type { DeckCard, DeckMode } from "@/types/deck";
import { cn } from "@/lib/utils";

export type DeckArchiveCardProps = {
  name: string;
  deckFormat: DeckMode;
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
  /** Copy, rename, share, and delete controls shown in the thumbnail menu. */
  actionControls?: ReactNode;
};

const controlBtnClass =
  "inline-flex size-11 items-center justify-center rounded text-mda-ink-muted transition-[background-color,color,transform] duration-200 ease-in-out hover:bg-mda-ink/10 hover:text-mda-ink-strong active:scale-95";

/** Frosted chip. Art color stays visible; the blur keeps the icon readable. */
const glassSurface =
  "bg-[rgba(247,251,253,0.3)] text-mda-ink-strong shadow-mda-soft backdrop-blur-[12px] backdrop-saturate-[1.6]";

/**
 * Light-shell archive card (60% canvas). Cover art stays an inverse island;
 * sky Details + active pin are the ≤10% accent moments.
 */
export function DeckArchiveCard({
  name,
  deckFormat,
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
  const isTcg = deckFormat === "TCG";
  const reduceMotion = useReducedMotion();
  const menuId = useId();
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const menuTriggerRef = useRef<HTMLButtonElement>(null);
  const ignoreNextOpenRef = useRef(false);

  const handleOpenKeyDown = (event: ReactKeyboardEvent<HTMLDivElement>): void => {
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      onOpen();
    }
  };

  useEffect(() => {
    if (!menuOpen) return;

    const onPointerDown = (event: PointerEvent): void => {
      const target = event.target;
      if (!(target instanceof Node)) return;
      if (menuRef.current?.contains(target)) return;
      if (menuTriggerRef.current?.contains(target)) return;
      if (
        target instanceof Element &&
        target.closest(
          "[data-mda-action-popover], [data-radix-popper-content-wrapper]",
        )
      ) {
        return;
      }
      ignoreNextOpenRef.current = true;
      setMenuOpen(false);
    };

    const onKeyDown = (event: KeyboardEvent): void => {
      if (event.key !== "Escape") return;
      if (document.querySelector("[data-mda-action-popover]")) return;
      setMenuOpen(false);
      menuTriggerRef.current?.focus();
    };

    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [menuOpen]);

  useEffect(() => {
    if (!menuOpen) return;
    menuRef.current?.querySelector("button")?.focus();
  }, [menuOpen]);

  return (
    <motion.article
      data-magnetic
      className={cn(
        "group mx-auto flex aspect-[1/1.618] w-4/5 max-w-[287px] flex-col self-start overflow-hidden border border-mda-bezel bg-mda-surface-raised shadow-mda-soft will-change-transform",
        className,
      )}
      whileHover={
        reduceMotion
          ? undefined
          : {
              y: -6,
              boxShadow: "0 14px 32px rgba(58, 79, 92, 0.16)",
            }
      }
      transition={{ duration: 0.2, ease: "easeOut" }}
    >
      <div className="relative min-h-0 flex-1 overflow-hidden bg-mda-inverse-deep">
        <div
          role="button"
          tabIndex={0}
          onClick={() => {
            if (ignoreNextOpenRef.current) {
              ignoreNextOpenRef.current = false;
              return;
            }
            onOpen();
          }}
          onKeyDown={handleOpenKeyDown}
          aria-label={`Open ${name} in Workshop`}
          className="absolute inset-0 cursor-pointer focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-mda-focus"
        >
          {coverCard ? (
            <CardImage
              card={coverCard}
              preferSmall={false}
              fill
              alt=""
              className="object-cover object-center"
              sizes="(min-width: 1280px) 22vw, (min-width: 1024px) 30vw, (min-width: 640px) 45vw, 90vw"
            />
          ) : (
            <div className="flex h-full items-center justify-center font-mda text-sm text-mda-inverse-text/40">
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
            <span className="font-mda text-xs font-bold uppercase tracking-wider text-mda-inverse-text">
              Open in Workshop
            </span>
          </div>
        </div>

        <button
          type="button"
          onClick={onTogglePin}
          aria-label={isPinned ? "Unpin deck" : "Pin deck"}
          aria-pressed={isPinned}
          className={cn(
            "absolute left-2 top-2 z-10 inline-flex size-11 items-center justify-center rounded text-mda-ink-strong transition-[background-color,color,transform] duration-200 ease-in-out hover:bg-[rgba(247,251,253,1)] active:scale-95 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-mda-focus",
            glassSurface,
            isPinned && "text-mda-cyan",
          )}
        >
          <Pin
            className={cn("h-5 w-5", isPinned && "fill-mda-cyan text-mda-cyan")}
            aria-hidden
            fill={isPinned ? "currentColor" : "none"}
            strokeWidth={isPinned ? 0 : 2}
          />
        </button>

        <button
          ref={menuTriggerRef}
          type="button"
          aria-label={`More actions for ${name}`}
          aria-expanded={menuOpen}
          aria-controls={menuId}
          aria-haspopup="true"
          onClick={() => setMenuOpen((open) => !open)}
          className={cn(
            "absolute right-2 top-2 z-10 inline-flex size-11 items-center justify-center rounded text-mda-ink-strong transition-[background-color,color,transform] duration-200 ease-in-out hover:bg-[rgba(247,251,253,1)] active:scale-95 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-mda-focus",
            glassSurface,
          )}
        >
          <MoreVertical className="h-5 w-5" aria-hidden />
        </button>

        {menuOpen ? (
          <div
            ref={menuRef}
            id={menuId}
            role="group"
            aria-label={`${name} actions`}
            className={cn(
              "absolute right-2 top-14 z-20 flex flex-col items-center rounded p-1",
              glassSurface,
            )}
          >
            {actionControls ?? (
              <div className="flex flex-col items-center gap-1">
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
                  className={cn(controlBtnClass, "hover:text-mda-danger-text")}
                >
                  <Trash2 className="h-5 w-5" aria-hidden />
                </button>
              </div>
            )}
          </div>
        ) : null}
      </div>

      <div className="flex shrink-0 flex-col pt-2">
        <div className="flex flex-col gap-1">
          <div className="flex items-center gap-2 px-2.5 font-mda text-xs uppercase tracking-wide text-mda-ink-muted">
            {isTcg ? (
              <Crown className="h-5 w-5" aria-hidden />
            ) : (
              <Gamepad2 className="h-5 w-5" aria-hidden />
            )}
            <span>{isTcg ? "TCG" : "Master Duel"}</span>
          </div>
          <button
            type="button"
            onClick={onOpen}
            className="w-full truncate px-2.5 py-1 text-left font-mda text-sm font-bold uppercase tracking-wide text-mda-ink-strong focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-mda-focus"
          >
            {name}
          </button>
          <div className="flex flex-row flex-wrap items-start justify-start gap-2 px-2.5 py-1">
            <DeckCapBadge label="Main Deck" value={mainCount} tone="light" />
            <DeckCapBadge label="Extra Deck" value={extraCount} tone="light" />
            {isTcg ? (
              <DeckCapBadge label="Side Deck" value={sideCount} tone="light" />
            ) : null}
          </div>
        </div>
        <div className="p-1">
          <button
            type="button"
            onClick={onDetails}
            data-magnetic
            className="min-h-11 w-full border border-mda-bezel bg-transparent px-3 font-mda text-sm font-bold uppercase tracking-wide text-mda-ink-strong transition-[background-color,color] duration-200 ease-in-out hover:bg-mda-chrome hover:text-mda-inverse-text"
          >
            Details
          </button>
        </div>
      </div>
    </motion.article>
  );
}
