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
import type { DeckMode } from "@/types/types";
import { cn, toAbsoluteShareUrl } from "@/lib/utils";

const EDGE_PAD = 16;
const COPIED_TOOLTIP_MS = 1600;

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
  "rounded p-1 text-white/70 transition-[background-color,color,transform] duration-200 ease-in-out hover:bg-white hover:text-mda-inverse-deep active:scale-95";

const panelClass =
  "flex items-center gap-3 border border-mda-ink/15 bg-mda-surface p-3 text-mda-ink shadow-mda-lift";

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
  const [showQr, setShowQr] = useState(false);
  const [copiedTipOpen, setCopiedTipOpen] = useState(false);
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

  const handleShareOpenChange = useCallback(
    async (next: boolean): Promise<void> => {
      if (!canShare) {
        setShareOpen(false);
        return;
      }
      if (next) share.captureSide();
      setShareOpen(next);
      if (!next) {
        setShareUrl("");
        setShareError(null);
        setShowQr(false);
        setCopiedTipOpen(false);
        return;
      }
      setShareLoading(true);
      setShareError(null);
      setShareUrl("");
      setShowQr(false);
      try {
        const url = await onShareOpen();
        setShareUrl(toAbsoluteShareUrl(url));
      } catch (err) {
        setShareError(
          err instanceof Error ? err.message : "Failed to create share link",
        );
      } finally {
        setShareLoading(false);
      }
    },
    [canShare, onShareOpen, share],
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
          collisionPadding={EDGE_PAD}
          className="w-auto border-0 bg-transparent p-0 shadow-none"
        >
          <div className={panelClass}>
            <div className="flex overflow-hidden rounded border border-mda-ink/20">
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
        <Popover
          modal
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
            className="w-auto border-0 bg-transparent p-0 shadow-none"
          >
            <div className="flex flex-col gap-3 border border-mda-ink/15 bg-mda-surface p-3 text-mda-ink shadow-mda-lift">
              <div className="flex items-center gap-3">
                <div className="flex min-w-[260px] max-w-[320px] flex-col gap-2 bg-mda-chrome px-3 py-2 text-mda-inverse-text">
                  <div className="flex items-center gap-2">
                    <span className="flex-1 truncate font-mda text-sm text-mda-inverse-text/90">
                      {shareLoading
                        ? "Generating share link…"
                        : shareError
                          ? "Share failed"
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
                            disabled={!shareUrl}
                            aria-label="Copy share link"
                            className="rounded p-1 text-mda-inverse-text transition-colors duration-200 hover:bg-white/15 disabled:opacity-40"
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
                    <button
                      type="button"
                      data-magnetic
                      onClick={() => setShowQr((prev) => !prev)}
                      disabled={!shareUrl}
                      aria-label={showQr ? "Hide QR code" : "Show QR code"}
                      aria-pressed={showQr}
                      className={cn(
                        "rounded p-1 text-mda-inverse-text transition-colors duration-200 hover:bg-white/15 disabled:opacity-40",
                        showQr && "bg-white/15",
                      )}
                    >
                      <QrCode className="h-5 w-5" aria-hidden />
                    </button>
                  </div>
                  {shareError ? (
                    <p
                      role="alert"
                      className="font-mda text-xs leading-snug text-mda-danger"
                    >
                      {shareError}
                    </p>
                  ) : null}
                </div>
                <button
                  type="button"
                  data-magnetic
                  onClick={() => setShareOpen(false)}
                  aria-label="Close share"
                  className={cancelIconBtn}
                >
                  <X className="h-6 w-6" aria-hidden />
                </button>
              </div>
              {showQr && shareUrl ? (
                <div className="flex justify-center rounded bg-white p-3">
                  <QRCodeSVG value={shareUrl} size={160} />
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
          collisionPadding={EDGE_PAD}
          className="w-auto border-0 bg-transparent p-0 shadow-none"
        >
          <div className={cn(panelClass, "max-w-[360px] px-4 py-3")}>
            <p className="font-mda text-sm text-mda-ink">
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
