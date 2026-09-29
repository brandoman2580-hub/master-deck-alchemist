"use client";

import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type DragEvent,
  type ReactNode,
} from "react";
import { useVirtualizer } from "@tanstack/react-virtual";
import { Search } from "lucide-react";
import { CardImage } from "@/components/ui/card-image";
import { MdaCardPreview } from "@/components/mda/mda-card-preview";
import {
  WORKSHOP_CARD_GAP_PX,
  WORKSHOP_CARD_SHELL,
  WORKSHOP_CARD_SIZES,
  WORKSHOP_CARD_TILE,
  workshopCardTileHeightPx,
  workshopCardTileWidthPx,
} from "@/components/mda/workshop-card-dims";
import type { BanStatus } from "@/types/deck";
import type { Card } from "@/types/card";
import { cn } from "@/lib/utils";

function banlistLimitLabel(status: BanStatus): string | null {
  if (status === "Limited") return "1";
  if (status === "Semi-Limited") return "2";
  if (status === "Forbidden") return "0";
  return null;
}

function BanlistCornerBadge({ status }: { status: BanStatus }): ReactNode {
  const label = banlistLimitLabel(status);
  if (!label) return null;
  return (
    <div
      className="absolute left-1 top-1 z-[3] flex h-6 w-6 items-center justify-center rounded-full border-2 border-red-500 bg-black text-sm font-bold leading-none text-yellow-400 drop-shadow-md"
      aria-label={`Ban status: ${status}`}
      title={status}
    >
      {label}
    </div>
  );
}

function measureColumnCount(containerWidth: number, tileWidth: number): number {
  if (containerWidth <= 0 || tileWidth <= 0) return 1;
  return Math.max(
    1,
    Math.floor(
      (containerWidth + WORKSHOP_CARD_GAP_PX) /
        (tileWidth + WORKSHOP_CARD_GAP_PX),
    ),
  );
}

export type WorkshopCardLibraryProps = {
  cards: Card[];
  cardPoolSize: number;
  banlist: Record<string, BanStatus>;
  getRemainingCopies: (card: Card) => number;
  onAdd: (card: Card) => void;
  onDragStart: (event: DragEvent<HTMLButtonElement>, card: Card) => void;
};

/**
 * Virtualized workshop card grid using the same tile dimensions as the
 * PersistedDeck-builder cards (`BuilderCardGridItem`).
 */
export function WorkshopCardLibrary({
  cards,
  cardPoolSize,
  banlist,
  getRemainingCopies,
  onAdd,
  onDragStart,
}: WorkshopCardLibraryProps): ReactNode {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [columnCount, setColumnCount] = useState(4);
  const [tileWidth, setTileWidth] = useState(104);

  const updateLayout = useCallback((): void => {
    const width = scrollRef.current?.clientWidth ?? 0;
    const nextTileWidth = workshopCardTileWidthPx(
      typeof window !== "undefined" ? window.innerWidth : 1024,
    );
    setTileWidth(nextTileWidth);
    setColumnCount(measureColumnCount(width, nextTileWidth));
  }, []);

  useEffect(() => {
    updateLayout();
    const node = scrollRef.current;
    if (!node || typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver(() => updateLayout());
    observer.observe(node);
    window.addEventListener("resize", updateLayout);
    return () => {
      observer.disconnect();
      window.removeEventListener("resize", updateLayout);
    };
  }, [updateLayout]);

  const rowCount = Math.ceil(cards.length / columnCount) || 0;
  const rowHeight =
    workshopCardTileHeightPx(tileWidth) + WORKSHOP_CARD_GAP_PX;

  const virtualizer = useVirtualizer({
    count: rowCount,
    getScrollElement: () => scrollRef.current,
    estimateSize: () => rowHeight,
    overscan: 4,
  });

  // Keep row size in sync when viewport/tile width changes.
  useEffect(() => {
    virtualizer.measure?.();
  }, [rowHeight, virtualizer]);

  const rows = virtualizer.getVirtualItems().map((virtualRow) => {
    const start = virtualRow.index * columnCount;
    const rowCards = cards.slice(start, start + columnCount);
    return { virtualRow, rowCards };
  });

  if (cardPoolSize === 0) {
    return (
      <div className="flex w-full flex-col items-center gap-2 py-10 text-mda-ink-muted">
        <Search className="h-8 w-8" aria-hidden />
        <p className="font-mda text-sm">Loading card library…</p>
      </div>
    );
  }

  if (cards.length === 0) {
    return (
      <div className="flex w-full flex-col items-center gap-2 py-10 text-mda-ink-muted">
        <Search className="h-8 w-8" aria-hidden />
        <p className="font-mda text-sm">No cards match</p>
      </div>
    );
  }

  return (
    <div className="flex h-full min-h-0 flex-col">
      <p
        className="mb-2 shrink-0 font-mda text-xs font-bold uppercase tracking-wide text-mda-ink-muted"
        aria-live="polite"
      >
        {cards.length.toLocaleString()}{" "}
        {cards.length === 1 ? "card" : "cards"}
        {cards.length !== cardPoolSize
          ? ` of ${cardPoolSize.toLocaleString()}`
          : null}
      </p>
      <div ref={scrollRef} className="min-h-0 flex-1 overflow-y-auto">
        <div
          className="relative w-full"
          style={{ height: `${virtualizer.getTotalSize()}px` }}
        >
          {rows.map(({ virtualRow, rowCards }) => (
            <div
              key={virtualRow.key}
              data-index={virtualRow.index}
              className="absolute left-0 top-0 flex w-full flex-wrap"
              style={{
                height: `${virtualRow.size}px`,
                transform: `translateY(${virtualRow.start}px)`,
                gap: `${WORKSHOP_CARD_GAP_PX}px`,
                paddingBottom: `${WORKSHOP_CARD_GAP_PX}px`,
              }}
            >
              {rowCards.map((card) => {
                const remaining = getRemainingCopies(card);
                const disabled = remaining <= 0;
                const banStatus = banlist[card.name] || "Unlimited";
                return (
                  <MdaCardPreview key={card.id} card={card}>
                    <div
                      data-magnetic={disabled ? undefined : true}
                      className={cn(
                        WORKSHOP_CARD_SHELL,
                        disabled && "opacity-40 shadow-none",
                      )}
                    >
                      <button
                        type="button"
                        draggable={!disabled}
                        onDragStart={(event) => onDragStart(event, card)}
                        onClick={() => onAdd(card)}
                        disabled={disabled}
                        className={cn(
                          WORKSHOP_CARD_TILE,
                          disabled && "cursor-not-allowed",
                        )}
                        title={
                          disabled
                            ? banStatus !== "Unlimited"
                              ? `${card.name} — ${banStatus}`
                              : `${card.name} — copy limit reached`
                            : `Add ${card.name}`
                        }
                        aria-label={
                          disabled
                            ? `${card.name} unavailable`
                            : `Add ${card.name}`
                        }
                      >
                        <CardImage
                          card={card}
                          preferSmall
                          fill
                          alt={card.name}
                          className="object-contain"
                          sizes={WORKSHOP_CARD_SIZES}
                        />
                        <BanlistCornerBadge status={banStatus} />
                      </button>
                    </div>
                  </MdaCardPreview>
                );
              })}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
