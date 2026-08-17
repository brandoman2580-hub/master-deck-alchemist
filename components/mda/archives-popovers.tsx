"use client";

import {
  useCallback,
  useRef,
  useState,
  type ReactNode,
  type RefObject,
} from "react";
import { Check, Copy, Gamepad2, Share2, Trash2, X } from "lucide-react";
import { Crown } from "lucide-react";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import type { DeckMode } from "@/types/types";
import { cn } from "@/lib/utils";

const EDGE_PAD = 16;

function preferSide(trigger: HTMLButtonElement | null): "left" | "right" {
  if (typeof window === "undefined" || !trigger) return "right";
  const spaceRight = window.innerWidth - trigger.getBoundingClientRect().right;
  return spaceRight < 280 + EDGE_PAD ? "left" : "right";
}

function usePreferLeft(): {
  side: "left" | "right";
  triggerRef: RefObject<HTMLButtonElement>;
  captureSide: () => void;
} {
  const triggerRef = useRef<HTMLButtonElement>(null!);
  const [side, setSide] = useState<"left" | "right">("right");

  const captureSide = useCallback((): void => {
    setSide(preferSide(triggerRef.current));
  }, []);

  return { side, triggerRef, captureSide };
}

const iconBtn =
  "rounded p-1 text-white/70 transition-[background-color,color,transform] duration-200 ease-in-out hover:bg-white hover:text-[color:var(--mda-bg-deep)] active:scale-95";

export type DeckArchiveActionPopoversProps = {
  deckName: string;
  mode: DeckMode;
  onCopyConfirm: (mode: DeckMode) => void;
  onDeleteConfirm: () => void;
  onShareOpen: () => Promise<string>;
};

/**
 * Copy / Share / Delete as edge-aware Popovers (no dim overlay).
 * Default: right of trigger; flips left near the viewport edge.
 */
export function DeckArchiveActionPopovers({
  deckName,
  mode: initialMode,
  onCopyConfirm,
  onDeleteConfirm,
  onShareOpen,
}: DeckArchiveActionPopoversProps): ReactNode {
  const [copyOpen, setCopyOpen] = useState(false);
  const [shareOpen, setShareOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [copyMode, setCopyMode] = useState<DeckMode>(initialMode);
  const [shareUrl, setShareUrl] = useState("");
  const [shareLoading, setShareLoading] = useState(false);

  const copy = usePreferLeft();
  const share = usePreferLeft();
  const del = usePreferLeft();

  const handleShareOpenChange = useCallback(
    async (next: boolean): Promise<void> => {
      if (next) share.captureSide();
      setShareOpen(next);
      if (!next) {
        setShareUrl("");
        return;
      }
      setShareLoading(true);
      try {
        const url = await onShareOpen();
        setShareUrl(url);
      } catch {
        setShareOpen(false);
      } finally {
        setShareLoading(false);
      }
    },
    [onShareOpen, share],
  );

  return (
    <div className="flex items-center gap-1.5">
      <Popover
        open={copyOpen}
        onOpenChange={(next) => {
          if (next) copy.captureSide();
          setCopyOpen(next);
          if (next) setCopyMode(initialMode);
        }}
      >
        <PopoverTrigger asChild>
          <button
            ref={copy.triggerRef}
            type="button"
            aria-label={`Copy ${deckName}`}
            className={iconBtn}
          >
            <Copy className="h-5 w-5" aria-hidden />
          </button>
        </PopoverTrigger>
        <PopoverContent
          side={copy.side}
          align="center"
          sideOffset={10}
          collisionPadding={EDGE_PAD}
          className="w-auto border-0 p-0"
        >
          <div className="flex items-center gap-3 bg-[color:var(--mda-surface)] p-3">
            <div className="flex overflow-hidden rounded">
              {(
                [
                  { key: "TCG" as const, icon: Crown, label: "TCG" },
                  {
                    key: "Master Duel" as const,
                    icon: Gamepad2,
                    label: "MD",
                  },
                ] as const
              ).map(({ key, icon: Icon, label }) => (
                <button
                  key={key}
                  type="button"
                  onClick={() => setCopyMode(key)}
                  className={cn(
                    "inline-flex items-center gap-1.5 px-3 py-2 font-mda text-sm font-bold uppercase transition-colors duration-200",
                    copyMode === key
                      ? "bg-white text-[color:var(--mda-bg-deep)]"
                      : "bg-white/15 text-white/70 hover:bg-white/25",
                  )}
                >
                  <Icon className="h-4 w-4" aria-hidden />
                  {label}
                </button>
              ))}
            </div>
            <button
              type="button"
              onClick={() => {
                onCopyConfirm(copyMode);
                setCopyOpen(false);
              }}
              aria-label="Confirm copy"
              className="rounded p-2 text-[color:var(--mda-success)] hover:bg-white/10"
            >
              <Check className="h-6 w-6" aria-hidden />
            </button>
            <button
              type="button"
              onClick={() => setCopyOpen(false)}
              aria-label="Cancel copy"
              className="rounded p-2 text-[color:var(--mda-danger)] hover:bg-white/10"
            >
              <X className="h-6 w-6" aria-hidden />
            </button>
          </div>
        </PopoverContent>
      </Popover>

      <Popover
        open={shareOpen}
        onOpenChange={(next) => {
          void handleShareOpenChange(next);
        }}
      >
        <PopoverTrigger asChild>
          <button
            ref={share.triggerRef}
            type="button"
            aria-label={`Share ${deckName}`}
            className={iconBtn}
          >
            <Share2 className="h-5 w-5" aria-hidden />
          </button>
        </PopoverTrigger>
        <PopoverContent
          side={share.side}
          align="center"
          sideOffset={10}
          collisionPadding={EDGE_PAD}
          className="w-auto border-0 p-0"
        >
          <div className="flex items-center gap-3 bg-[color:var(--mda-surface)] p-3">
            <div className="flex min-w-[260px] max-w-[320px] items-center gap-2 bg-[color:var(--mda-bg-deep)] px-3 py-2">
              <span className="flex-1 truncate font-mda text-sm text-white/80">
                {shareLoading
                  ? "Generating share link…"
                  : shareUrl || "Share link unavailable"}
              </span>
              <button
                type="button"
                onClick={() => {
                  if (shareUrl) void navigator.clipboard.writeText(shareUrl);
                }}
                disabled={!shareUrl}
                aria-label="Copy share link"
                className="rounded p-1 text-white/70 hover:bg-white/10 hover:text-white disabled:opacity-40"
              >
                <Copy className="h-5 w-5" aria-hidden />
              </button>
            </div>
            <button
              type="button"
              onClick={() => setShareOpen(false)}
              aria-label="Close share"
              className="rounded p-2 text-[color:var(--mda-danger)] hover:bg-white/10"
            >
              <X className="h-6 w-6" aria-hidden />
            </button>
          </div>
        </PopoverContent>
      </Popover>

      <Popover
        open={deleteOpen}
        onOpenChange={(next) => {
          if (next) del.captureSide();
          setDeleteOpen(next);
        }}
      >
        <PopoverTrigger asChild>
          <button
            ref={del.triggerRef}
            type="button"
            aria-label={`Delete ${deckName}`}
            className={cn(iconBtn, "hover:text-[color:var(--mda-danger)]")}
          >
            <Trash2 className="h-5 w-5" aria-hidden />
          </button>
        </PopoverTrigger>
        <PopoverContent
          side={del.side}
          align="center"
          sideOffset={10}
          collisionPadding={EDGE_PAD}
          className="w-auto border-0 p-0"
        >
          <div className="flex max-w-[360px] items-center gap-3 bg-[color:var(--mda-surface)] px-4 py-3">
            <p className="font-mda text-sm text-white">
              Delete <span className="font-bold">{deckName}</span>?
            </p>
            <button
              type="button"
              onClick={() => {
                onDeleteConfirm();
                setDeleteOpen(false);
              }}
              aria-label="Confirm delete"
              className="rounded p-2 text-[color:var(--mda-success)] hover:bg-white/10"
            >
              <Check className="h-6 w-6" aria-hidden />
            </button>
            <button
              type="button"
              onClick={() => setDeleteOpen(false)}
              aria-label="Cancel delete"
              className="rounded p-2 text-[color:var(--mda-danger)] hover:bg-white/10"
            >
              <X className="h-6 w-6" aria-hidden />
            </button>
          </div>
        </PopoverContent>
      </Popover>
    </div>
  );
}
