"use client";

import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type ReactNode,
  type RefObject,
} from "react";
import {
  Ban,
  Check,
  Copy,
  Gamepad2,
  Loader2,
  QrCode,
  Share2,
  Trash2,
  X,
} from "lucide-react";
import { Crown } from "lucide-react";
import { QRCodeSVG } from "qrcode.react";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  ARCHIVE_POPOVER_CONTENT_CLASS,
  ARCHIVE_POPOVER_EDGE_PAD,
  ARCHIVE_POPOVER_PANEL_CLASS,
} from "@/components/mda/archives-popover-styles";
import type { DeckMode } from "@/types/types";
import { cn, toAbsoluteShareUrl } from "@/lib/utils";

const COPIED_TOOLTIP_MS = 1600;

function preferSide(trigger: HTMLButtonElement | null): "left" | "right" {
  if (typeof window === "undefined" || !trigger) return "right";
  const spaceRight = window.innerWidth - trigger.getBoundingClientRect().right;
  return spaceRight < 280 + ARCHIVE_POPOVER_EDGE_PAD ? "left" : "right";
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
  "rounded p-1 text-white/70 transition-[background-color,color,transform] duration-200 ease-in-out hover:bg-white hover:text-mda-inverse-deep active:scale-95 disabled:pointer-events-none disabled:opacity-40";

const confirmIconBtn =
  "rounded p-2 text-mda-success transition-[background-color,color,transform] duration-200 ease-in-out hover:bg-mda-success/20 hover:scale-105 active:scale-95";

const cancelIconBtn =
  "rounded p-2 text-mda-danger transition-[background-color,color,transform] duration-200 ease-in-out hover:bg-mda-danger/20 hover:scale-105 active:scale-95";

export type DeckArchiveActionPopoversProps = {
  deckName: string;
  mode: DeckMode;
  /** False when deck fails legal share size/copy rules. */
  canShare?: boolean;
  onCopyConfirm: (mode: DeckMode) => void;
  onDeleteConfirm: () => void;
  onShareOpen: () => Promise<string>;
};

/**
 * Copy / Share / Delete as edge-aware modal Popovers (no dim overlay).
 * `modal` disables outside interaction without adding a backdrop.
 */
export function DeckArchiveActionPopovers({
  deckName,
  mode: initialMode,
  canShare = true,
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
  const [shareError, setShareError] = useState<string | null>(null);
  const [showShareQr, setShowShareQr] = useState(false);
  const [copiedTipOpen, setCopiedTipOpen] = useState(false);
  const shareRequestRef = useRef<Promise<string> | null>(null);
  const copiedTipTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const copy = usePreferLeft();
  const share = usePreferLeft();
  const del = usePreferLeft();

  useEffect(() => {
    return () => {
      if (copiedTipTimerRef.current) clearTimeout(copiedTipTimerRef.current);
    };
  }, []);

  const showCopiedTooltip = useCallback((): void => {
    setCopiedTipOpen(true);
    if (copiedTipTimerRef.current) clearTimeout(copiedTipTimerRef.current);
    copiedTipTimerRef.current = setTimeout(() => {
      setCopiedTipOpen(false);
      copiedTipTimerRef.current = null;
    }, COPIED_TOOLTIP_MS);
  }, []);

  const beginShareGeneration = useCallback(async (): Promise<void> => {
    if (shareRequestRef.current) return;

    setShareLoading(true);
    setShareError(null);
    setShareUrl("");

    const request = onShareOpen();
    shareRequestRef.current = request;

    try {
      const url = await request;
      setShareUrl(toAbsoluteShareUrl(url));
    } catch (err) {
      setShareError(
        err instanceof Error ? err.message : "Failed to generate share link",
      );
    } finally {
      shareRequestRef.current = null;
      setShareLoading(false);
    }
  }, [onShareOpen]);

  const handleShareOpenChange = useCallback(
    (next: boolean): void => {
      if (!canShare) {
        setShareOpen(false);
        return;
      }

      if (next) {
        if (shareLoading || shareRequestRef.current) return;
        share.captureSide();
        setShareOpen(true);
        void beginShareGeneration();
        return;
      }

      if (shareLoading || shareRequestRef.current) return;

      setShareOpen(false);
      setShareUrl("");
      setShareError(null);
      setShowShareQr(false);
      setCopiedTipOpen(false);
    },
    [beginShareGeneration, canShare, share, shareLoading],
  );

  return (
    <div className="flex items-center gap-1.5">
      <Popover
        modal
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
          collisionPadding={ARCHIVE_POPOVER_EDGE_PAD}
          className={ARCHIVE_POPOVER_CONTENT_CLASS}
          data-mda-action-popover
        >
          <div className={ARCHIVE_POPOVER_PANEL_CLASS}>
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
                  data-magnetic
                  className={cn(
                    "inline-flex items-center gap-1.5 px-3 py-2 font-mda text-sm font-bold uppercase transition-colors duration-200",
                    copyMode === key
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
              data-magnetic
              onClick={() => {
                onCopyConfirm(copyMode);
                setCopyOpen(false);
              }}
              aria-label="Confirm copy"
              className={confirmIconBtn}
            >
              <Check className="h-6 w-6" aria-hidden />
            </button>
            <button
              type="button"
              data-magnetic
              onClick={() => setCopyOpen(false)}
              aria-label="Cancel copy"
              className={cancelIconBtn}
            >
              <X className="h-6 w-6" aria-hidden />
            </button>
          </div>
        </PopoverContent>
      </Popover>

      {canShare ? (
        <Popover open={shareOpen} onOpenChange={handleShareOpenChange}>
          <PopoverTrigger asChild>
            <button
              ref={share.triggerRef}
              type="button"
              aria-label={`Share ${deckName}`}
              aria-busy={shareLoading}
              disabled={shareLoading}
              className={iconBtn}
            >
              <Share2 className="h-5 w-5" aria-hidden />
            </button>
          </PopoverTrigger>
          <PopoverContent
            side={share.side}
            align="center"
            sideOffset={10}
            collisionPadding={ARCHIVE_POPOVER_EDGE_PAD}
            className={ARCHIVE_POPOVER_CONTENT_CLASS}
            data-mda-action-popover
            onOpenAutoFocus={(event) => event.preventDefault()}
            onInteractOutside={(event) => {
              if (shareLoading || shareRequestRef.current) {
                event.preventDefault();
              }
            }}
            onEscapeKeyDown={(event) => {
              if (shareLoading || shareRequestRef.current) {
                event.preventDefault();
              }
            }}
          >
            <div className="flex flex-col bg-[color:var(--mda-surface-raised)]">
              <div className={ARCHIVE_POPOVER_PANEL_CLASS}>
                <div
                  className="flex min-w-[260px] max-w-[320px] items-center gap-2 rounded border border-white/10 bg-[color:var(--mda-bg-deep)] px-3 py-2"
                  aria-live="polite"
                >
                  {shareLoading ? (
                    <Loader2
                      className="h-4 w-4 shrink-0 animate-spin text-mda-cyan"
                      aria-hidden
                    />
                  ) : null}
                  <span className="flex-1 truncate font-mda text-sm text-white/80">
                    {shareLoading
                      ? "Generating share link…"
                      : shareError
                        ? shareError
                        : shareUrl || "Share link unavailable"}
                  </span>
                  <TooltipProvider delayDuration={0}>
                    <Tooltip open={copiedTipOpen}>
                      <TooltipTrigger asChild>
                        <button
                          type="button"
                          data-magnetic
                          onClick={() => {
                            if (!shareUrl) return;
                            void navigator.clipboard.writeText(shareUrl);
                            showCopiedTooltip();
                          }}
                          disabled={!shareUrl || shareLoading}
                          aria-label="Copy share link"
                          className="rounded p-1 text-white/70 hover:bg-white/10 hover:text-white disabled:opacity-40"
                        >
                          <Copy className="h-5 w-5" aria-hidden />
                        </button>
                      </TooltipTrigger>
                      <TooltipContent
                        side="top"
                        className="z-[110] border-mda-ink/15 bg-mda-surface font-mda text-xs font-bold text-mda-ink"
                      >
                        Copied!
                      </TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                </div>
                <button
                  type="button"
                  data-magnetic
                  onClick={() => handleShareOpenChange(false)}
                  disabled={shareLoading}
                  aria-label="Close share"
                  className={cn(cancelIconBtn, "disabled:opacity-40")}
                >
                  <X className="h-6 w-6" aria-hidden />
                </button>
              </div>
              {shareUrl && !shareLoading && !shareError ? (
                <div className="border-t border-white/10 px-3 pb-3 pt-2">
                  <button
                    type="button"
                    data-magnetic
                    onClick={() => setShowShareQr((prev) => !prev)}
                    className="inline-flex w-full items-center justify-center gap-2 rounded border border-white/15 bg-white/5 px-3 py-2 font-mda text-xs font-bold uppercase tracking-wide text-white/80 transition-colors hover:bg-white/10"
                  >
                    <QrCode className="h-4 w-4" aria-hidden />
                    {showShareQr ? "Hide QR Code" : "Show QR Code"}
                  </button>
                  {showShareQr ? (
                    <div className="mt-2 flex justify-center rounded bg-white p-3">
                      <QRCodeSVG value={shareUrl} size={160} />
                    </div>
                  ) : null}
                </div>
              ) : null}
            </div>
          </PopoverContent>
        </Popover>
      ) : (
        <button
          type="button"
          disabled
          aria-label={`Share unavailable — ${deckName} is incomplete`}
          title="Deck must meet legal size rules to share"
          className="cursor-not-allowed rounded p-1 text-white/30"
        >
          <Ban className="h-5 w-5" aria-hidden />
        </button>
      )}

      <Popover
        modal
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
            className={cn(iconBtn, "hover:text-mda-danger")}
          >
            <Trash2 className="h-5 w-5" aria-hidden />
          </button>
        </PopoverTrigger>
        <PopoverContent
          side={del.side}
          align="center"
          sideOffset={10}
          collisionPadding={ARCHIVE_POPOVER_EDGE_PAD}
          className={ARCHIVE_POPOVER_CONTENT_CLASS}
          data-mda-action-popover
        >
          <div
            className={cn(
              ARCHIVE_POPOVER_PANEL_CLASS,
              "max-w-[360px] px-4 py-3",
            )}
          >
            <p className="font-mda text-sm text-white">
              Delete <span className="font-bold">{deckName}</span>?
            </p>
            <button
              type="button"
              data-magnetic
              onClick={() => {
                onDeleteConfirm();
                setDeleteOpen(false);
              }}
              aria-label="Confirm delete"
              className={confirmIconBtn}
            >
              <Check className="h-6 w-6" aria-hidden />
            </button>
            <button
              type="button"
              data-magnetic
              onClick={() => setDeleteOpen(false)}
              aria-label="Cancel delete"
              className={cancelIconBtn}
            >
              <X className="h-6 w-6" aria-hidden />
            </button>
          </div>
        </PopoverContent>
      </Popover>
    </div>
  );
}
