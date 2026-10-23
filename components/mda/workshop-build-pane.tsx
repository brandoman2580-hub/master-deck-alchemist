"use client";

import {
  useMemo,
  useState,
  type ChangeEvent,
  type DragEvent,
  type ReactNode,
} from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { SlidersHorizontal } from "lucide-react";
import { WorkshopStrategistPanel } from "@/components/mda/workshop-strategist";
import { WorkshopCardLibrary } from "@/components/mda/workshop-card-library";
import { CardImage } from "@/components/ui/card-image";
import { FadeSwap } from "@/components/mda/fade-swap";
import { CardPreviewTooltipProvider, MdaCardPreview } from "@/components/mda/mda-card-preview";
import { RollingNumber } from "@/components/mda/rolling-number";
import { SlidingTabMark } from "@/components/mda/sliding-tab-mark";
import {
  EMPTY_WORKSHOP_FILTERS,
  WorkshopCardFilters,
  type WorkshopFilterState,
} from "@/components/mda/workshop-card-filters";
import type { BanStatus, DeckCard, DeckSection } from "@/types/deck";
import type { Card } from "@/types/card";
import type { WorkshopTab } from "@/components/mda/workshop-deck-chrome";
import { useDeck } from "@/context/deck-context";
import { useCardStore } from "@/store/cardStore";
import { selectFilteredCards } from "@/store/cardPoolSelectors";
import { getRemainingCopies, isExtraDeckCard } from "@/lib/deck/copy-limits";
import { deckRowTypeChips, masterDuelRarityLabel } from "@/lib/workshop/deck-row-meta";
import { CARD_S, EASE_OUT } from "@/lib/motion/tokens";
import { cn } from "@/lib/utils";

type BrowserTab = "library" | "strategist";

const SECTION_LIMITS: Record<DeckSection, number> = {
  mainDeck: 60,
  extraDeck: 15,
  sideDeck: 15,
};

const DRAG_MIME = "application/x-mda-card-id";

const ZONES: { title: string; section: DeckSection }[] = [
  { title: "Main", section: "mainDeck" },
  { title: "Extra", section: "extraDeck" },
  { title: "Side", section: "sideDeck" },
];

function cardFitsSection(card: Card, section: DeckSection): boolean {
  const extra = isExtraDeckCard(card);
  return section === "extraDeck" ? extra : !extra;
}

function groupCardsById(
  cards: DeckCard[],
): { card: DeckCard; quantity: number; instances: DeckCard[] }[] {
  const groups = new Map<
    number,
    { card: DeckCard; quantity: number; instances: DeckCard[] }
  >();
  for (const card of cards) {
    const existing = groups.get(card.id);
    if (existing) {
      existing.quantity += 1;
      existing.instances.push(card);
    } else {
      groups.set(card.id, { card, quantity: 1, instances: [card] });
    }
  }
  return Array.from(groups.values());
}

function browserTabClass(selected: boolean): string {
  const invert =
    "group transition-colors hover:border-[#14181f] hover:bg-[#e2e8f0] hover:text-[#14181f]";
  return selected
    ? `relative flex h-10 items-center border border-[#28303b] bg-[#14181f] px-5 text-xs font-semibold uppercase tracking-widest text-[#e2e8f0] ${invert}`
    : `relative flex h-10 items-center border border-[#28303b] bg-[#14181f] px-5 text-xs font-semibold uppercase tracking-widest text-[#8a96a6] ${invert}`;
}

const RARITY_TEXT: Record<string, string> = {
  N: "text-[#9aa3ad]",
  R: "text-[#4da3ff]",
  SR: "text-[#e6b325]",
};

function limitCount(status: BanStatus): string | null {
  if (status === "Limited") return "1";
  if (status === "Semi-Limited") return "2";
  if (status === "Forbidden") return "0";
  return null;
}

function RarityCornerBadge({ label }: { label: string }): ReactNode {
  return (
    <span className="absolute right-1 top-1 z-[2] bg-[#0c0e12] px-1.5 py-1 text-[11px] font-bold uppercase leading-none tracking-wide">
      {label === "UR" ? (
        <span className="bg-gradient-to-r from-[#ff4fd8] via-[#c084fc] to-[#5ce1ff] bg-clip-text text-transparent">
          UR
        </span>
      ) : (
        <span className={RARITY_TEXT[label] ?? "text-[#f7fcff]"}>{label}</span>
      )}
    </span>
  );
}

function LimitCornerBadge({ status }: { status: BanStatus }): ReactNode {
  const count = limitCount(status);
  if (!count || !status) return null;
  return (
    <span
      className="absolute left-1 top-1 z-[2] flex h-5 w-5 items-center justify-center rounded-full border border-[#ff2d2d] bg-[#0c0e12] text-[10px] font-bold leading-none text-[#f7fcff] ring-1 ring-[#0c0e12]"
      aria-label={`${status}, ${count}`}
      title={status}
    >
      {count}
    </span>
  );
}

function zoneTabClass(selected: boolean): string {
  return selected
    ? "group relative flex h-10 items-center gap-3 border border-[#28303b] bg-[#0c0e12] px-5 text-xs font-semibold uppercase tracking-widest text-[#f7fcff] transition-colors hover:border-[#0c0e12] hover:bg-[#f7fcff] hover:text-[#0c0e12]"
    : "group relative flex h-10 items-center gap-3 border border-[#c1ccd4] bg-white px-5 text-xs font-semibold uppercase tracking-widest text-[#5b6369] transition-colors hover:border-[#f7fcff] hover:bg-[#14181f] hover:text-[#f7fcff]";
}

function DeckGalleryTile({
  card,
  quantity,
  showRarity,
  banStatus,
  canAdd,
  onAdd,
  onRemove,
}: {
  card: DeckCard;
  quantity: number;
  showRarity: boolean;
  banStatus: BanStatus;
  canAdd: boolean;
  onAdd: () => void;
  onRemove: () => void;
}): ReactNode {
  const rarity = showRarity ? masterDuelRarityLabel(card) : null;
  const chips = deckRowTypeChips(card);

  return (
    <article className="flex h-full flex-col border border-[#c1ccd4] bg-white p-1.5">
      <MdaCardPreview card={card}>
        <div className="relative aspect-[3/4.4] w-full overflow-hidden border border-[#28303b] bg-[#0c0e12]">
          <CardImage card={card} preferSmall fill sizes="140px" alt="" className="object-cover" />
          <LimitCornerBadge status={banStatus} />
          {rarity ? <RarityCornerBadge label={rarity} /> : null}
        </div>
      </MdaCardPreview>
      <p className="mt-1.5 truncate text-[11px] font-semibold leading-tight text-[#0c0e12]">
        {card.name}
      </p>
      {chips.length > 0 ? (
        <div className="mt-1 flex flex-wrap gap-1">
          {chips.map((chip) => (
            <span
              key={chip}
              className="bg-[#e4ebf0] px-1 py-0.5 text-[9px] font-semibold uppercase tracking-wide text-[#333d4b]"
            >
              {chip}
            </span>
          ))}
        </div>
      ) : null}
      <div className="mt-auto pt-1.5">
        <div className="flex w-full items-center justify-between">
          <button
            type="button"
            onClick={onRemove}
            aria-label={`Remove one ${card.name}`}
            className="flex h-8 w-8 shrink-0 items-center justify-center border border-[#9ca7b0] text-[#0c0e12] hover:bg-[#d8e2e8] focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#0c0e12]"
          >
            −
          </button>
          <span className="flex h-8 min-w-8 flex-1 items-center justify-center text-sm font-bold tabular-nums text-[#0c0e12]">
            <RollingNumber value={quantity} />
          </span>
          <button
            type="button"
            onClick={onAdd}
            disabled={!canAdd}
            aria-label={canAdd ? `Add another ${card.name}` : `Cannot add more ${card.name}`}
            className="flex h-8 w-8 shrink-0 items-center justify-center border border-[#9ca7b0] text-[#0c0e12] hover:bg-[#d8e2e8] focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#0c0e12] disabled:cursor-not-allowed disabled:opacity-40"
          >
            +
          </button>
        </div>
      </div>
    </article>
  );
}

function DeckGallery({
  title,
  section,
  cards,
  showRarity,
  banlist,
  tabId,
  onAdd,
  onRemoveOne,
  canAddCard,
}: {
  title: string;
  section: DeckSection;
  cards: DeckCard[];
  showRarity: boolean;
  banlist: Record<string, BanStatus>;
  tabId: string;
  onAdd: (card: Card) => void;
  onRemoveOne: (deckInstanceId: string) => void;
  canAddCard: (card: Card) => boolean;
}): ReactNode {
  const reduceMotion = useReducedMotion();
  const [isDragOver, setIsDragOver] = useState(false);
  const grouped = groupCardsById(cards);
  const capacity = SECTION_LIMITS[section];
  const atSectionCap = cards.length >= capacity;

  const handleDragOver = (event: DragEvent<HTMLElement>): void => {
    if (![...event.dataTransfer.types].includes(DRAG_MIME)) return;
    event.preventDefault();
    event.dataTransfer.dropEffect = "copy";
    setIsDragOver(true);
  };

  const handleDragLeave = (event: DragEvent<HTMLElement>): void => {
    if (event.currentTarget.contains(event.relatedTarget as Node)) return;
    setIsDragOver(false);
  };

  const handleDrop = (event: DragEvent<HTMLElement>): void => {
    event.preventDefault();
    setIsDragOver(false);
    const raw = event.dataTransfer.getData(DRAG_MIME);
    if (!raw) return;
    try {
      const card = JSON.parse(raw) as Card;
      if (atSectionCap || !cardFitsSection(card, section) || !canAddCard(card)) return;
      onAdd(card);
    } catch {
      // Ignore malformed drag payloads
    }
  };

  return (
    <div
      role="tabpanel"
      id={`workshop-zone-${section}-panel`}
      aria-labelledby={tabId}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      className={cn(
        "min-h-0 flex-1 overflow-y-auto p-4",
        isDragOver && "ring-2 ring-inset ring-[#bfe5f3]",
      )}
    >
      {grouped.length === 0 ? (
        <p className="border border-[#c1ccd4] bg-white px-3 py-10 text-center text-sm text-[#5b6369]">
          No cards in {title}
        </p>
      ) : null}
      <div className="grid grid-cols-[repeat(auto-fill,minmax(132px,1fr))] gap-2.5">
          <AnimatePresence initial={false} mode="popLayout">
            {grouped.map(({ card, quantity, instances }) => (
              <motion.div
                key={card.id}
                className="h-full"
                initial={reduceMotion ? { opacity: 0 } : { opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
                transition={{ duration: CARD_S, ease: EASE_OUT }}
              >
                <DeckGalleryTile
                  card={card}
                  quantity={quantity}
                  showRarity={showRarity}
                  banStatus={banlist[card.name] || "Unlimited"}
                  canAdd={!atSectionCap && canAddCard(card)}
                  onAdd={() => onAdd(card)}
                  onRemove={() => {
                    const last = instances[instances.length - 1];
                    if (last) onRemoveOne(last.deckInstanceId);
                  }}
                />
              </motion.div>
            ))}
          </AnimatePresence>
        </div>
    </div>
  );
}

export function WorkshopBuildPane({
  onOpenWorkshopTab,
}: {
  onOpenWorkshopTab?: (tab: Extract<WorkshopTab, "matchups" | "combos">) => void;
} = {}): ReactNode {
  const { currentDeck, banlist, addCardToDeck, removeCardFromDeck } = useDeck();
  const cardList = useCardStore((state) => state.cardList);
  const [browserTab, setBrowserTab] = useState<BrowserTab>("library");
  const [zoneSection, setZoneSection] = useState<DeckSection>("mainDeck");
  const [query, setQuery] = useState("");
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [searchParams, setSearchParams] = useState<WorkshopFilterState>(
    EMPTY_WORKSHOP_FILTERS,
  );

  const activeFilterCount = useMemo(() => {
    let count = 0;
    (
      [
        "type",
        "race",
        "attribute",
        "level",
        "atkRange",
        "defRange",
        "rarity",
        "archetype",
        "banStatus",
      ] as const
    ).forEach((key) => {
      const value = searchParams[key];
      if (value.trim()) {
        count += value.split(",").filter((part) => part.trim()).length;
      }
    });
    if (searchParams.effect.trim()) count += 1;
    return count;
  }, [searchParams]);

  const library = useMemo(() => {
    if (cardList.length === 0) return [];
    let filtered = selectFilteredCards(cardList, query, {
      ...searchParams,
      sort: searchParams.sort || "name",
      sortDirection: searchParams.sortDirection || "asc",
    });
    if (searchParams.banStatus.trim() && Object.keys(banlist).length > 0) {
      const selectedStatuses = searchParams.banStatus
        .split(",")
        .map((status) => status.trim())
        .filter(Boolean);
      if (selectedStatuses.length > 0) {
        filtered = filtered.filter((card) => {
          const status = banlist[card.name] || "Unlimited";
          return selectedStatuses.includes(status);
        });
      }
    }
    return filtered;
  }, [banlist, cardList, query, searchParams]);

  const handleFilterSelectChange = (key: string, value: string): void => {
    setSearchParams((prev) => ({ ...prev, [key]: value }));
  };

  const handleEffectChange = (event: ChangeEvent<HTMLInputElement>): void => {
    setSearchParams((prev) => ({ ...prev, effect: event.target.value }));
  };

  const canAddCard = (card: Card): boolean =>
    getRemainingCopies(card, currentDeck, banlist) > 0;

  const handleAddToSection = (card: Card, section: DeckSection): void => {
    if (!cardFitsSection(card, section)) return;
    if (currentDeck[section].length >= SECTION_LIMITS[section]) return;
    if (!canAddCard(card)) return;
    addCardToDeck(card, section);
  };

  const handleLibraryAdd = (card: Card): void => {
    const section: DeckSection = isExtraDeckCard(card) ? "extraDeck" : "mainDeck";
    handleAddToSection(card, section);
  };

  const handleLibraryDragStart = (
    event: DragEvent<HTMLButtonElement>,
    card: Card,
  ): void => {
    event.dataTransfer.setData(DRAG_MIME, JSON.stringify(card));
    event.dataTransfer.effectAllowed = "copy";
  };

  const isTcg = currentDeck.deckFormat === "TCG";
  const zones = ZONES.filter((zone) => isTcg || zone.section !== "sideDeck");
  const activeZone = zones.find((zone) => zone.section === zoneSection) ?? zones[0];
  if (!activeZone) return null;

  return (
    <CardPreviewTooltipProvider>
    <div className="flex h-full min-h-0 flex-col gap-4 lg:flex-row">
      <div className="flex min-h-0 w-full flex-col border border-[#28303b] bg-[#f5f8fa] text-[#0c0e12] lg:w-[60%]">
        <div
          role="tablist"
          aria-label="Deck zones"
          className="flex shrink-0 flex-wrap items-center gap-2 border-b border-[#c1ccd4] px-4 py-3"
          onKeyDown={(event) => {
            if (event.key !== "ArrowRight" && event.key !== "ArrowLeft") return;
            event.preventDefault();
            const index = zones.findIndex((zone) => zone.section === activeZone.section);
            const delta = event.key === "ArrowRight" ? 1 : -1;
            const next = zones[(index + delta + zones.length) % zones.length];
            if (!next) return;
            setZoneSection(next.section);
            requestAnimationFrame(() => {
              document.getElementById(`workshop-zone-${next.section}`)?.focus();
            });
          }}
        >
          {zones.map((zone) => {
            const selected = zone.section === activeZone.section;
            const count = currentDeck[zone.section].length;
            const capacity = SECTION_LIMITS[zone.section];
            return (
              <button
                key={zone.section}
                type="button"
                role="tab"
                id={`workshop-zone-${zone.section}`}
                aria-selected={selected}
                aria-controls={`workshop-zone-${zone.section}-panel`}
                aria-label={`${zone.title}, ${count} of ${capacity}`}
                tabIndex={selected ? 0 : -1}
                onClick={() => setZoneSection(zone.section)}
                className={zoneTabClass(selected)}
              >
                {zone.title}
                <span
                  className={
                    selected
                      ? "inline-flex items-center bg-[#bfe5f3] px-1.5 py-0.5 text-[10px] font-bold normal-case tracking-normal text-[#0c0e12] tabular-nums group-hover:bg-[#0c0e12] group-hover:text-[#f7fcff]"
                      : "inline-flex items-center bg-[#e4ebf0] px-1.5 py-0.5 text-[10px] font-bold normal-case tracking-normal text-[#333d4b] tabular-nums group-hover:bg-[#bfe5f3] group-hover:text-[#0c0e12]"
                  }
                >
                  <RollingNumber value={count} />/{capacity}
                </span>
                {selected ? (
                  <SlidingTabMark
                    layoutId="workshop-zone-tab"
                    className="absolute inset-x-0 bottom-0 h-0.5 bg-[#bfe5f3] group-hover:bg-[#0c0e12]"
                  />
                ) : null}
              </button>
            );
          })}
        </div>
        <FadeSwap panelKey={activeZone.section}>
          <DeckGallery
            title={activeZone.title}
            section={activeZone.section}
            cards={currentDeck[activeZone.section]}
            showRarity={!isTcg}
            banlist={banlist}
            tabId={`workshop-zone-${activeZone.section}`}
            onAdd={(card) => handleAddToSection(card, activeZone.section)}
            onRemoveOne={(id) => removeCardFromDeck(id, activeZone.section)}
            canAddCard={canAddCard}
          />
        </FadeSwap>
      </div>

      <div className="flex min-h-0 w-full flex-col border border-[#28303b] bg-[#eef3f6] lg:w-[40%]">
        <div
          role="tablist"
          aria-label="Browser"
          className="flex h-14 shrink-0 items-center gap-2 border-b border-[#28303b] bg-[#111317] px-3"
          onKeyDown={(event) => {
            if (event.key !== "ArrowRight" && event.key !== "ArrowLeft") return;
            event.preventDefault();
            const next = browserTab === "library" ? "strategist" : "library";
            setBrowserTab(next);
            const nextId =
              next === "library" ? "workshop-browser-library" : "workshop-browser-strategist";
            requestAnimationFrame(() => {
              document.getElementById(nextId)?.focus();
            });
          }}
        >
          <button
            type="button"
            role="tab"
            id="workshop-browser-library"
            aria-selected={browserTab === "library"}
            aria-controls="workshop-browser-library-panel"
            tabIndex={browserTab === "library" ? 0 : -1}
            onClick={() => setBrowserTab("library")}
            className={browserTabClass(browserTab === "library")}
          >
            Library
            {browserTab === "library" ? (
              <SlidingTabMark
                layoutId="workshop-browser-tab"
                className="absolute inset-x-0 bottom-0 h-0.5 bg-[#bfe5f3] group-hover:bg-[#14181f]"
              />
            ) : null}
          </button>
          <button
            type="button"
            role="tab"
            id="workshop-browser-strategist"
            aria-selected={browserTab === "strategist"}
            aria-controls="workshop-browser-strategist-panel"
            tabIndex={browserTab === "strategist" ? 0 : -1}
            onClick={() => setBrowserTab("strategist")}
            className={browserTabClass(browserTab === "strategist")}
          >
            Strategist
            {browserTab === "strategist" ? (
              <SlidingTabMark
                layoutId="workshop-browser-tab"
                className="absolute inset-x-0 bottom-0 h-0.5 bg-[#bfe5f3] group-hover:bg-[#14181f]"
              />
            ) : null}
          </button>
        </div>

        <FadeSwap panelKey={browserTab}>
        {browserTab === "library" ? (
          <div
            id="workshop-browser-library-panel"
            role="tabpanel"
            aria-labelledby="workshop-browser-library"
            className="flex min-h-0 flex-1 flex-col"
          >
            <div className="border-b border-[#28303b] bg-[#e4ebf0] p-3">
              <div className="flex items-center border border-[#28303b] bg-[#0c0e12] px-2.5 py-1.5">
                <button
                  type="button"
                  onClick={() => setFiltersOpen((value) => !value)}
                  aria-label={filtersOpen ? "Hide filters" : "Show filters"}
                  aria-expanded={filtersOpen}
                  className={cn(
                    "mr-2 flex h-6 w-6 items-center justify-center text-[#8a96a6] transition-colors hover:bg-[#e2e8f0] hover:text-[#14181f]",
                    filtersOpen && "text-[#f7fcff]",
                  )}
                >
                  <SlidersHorizontal className="h-4 w-4" aria-hidden />
                  {activeFilterCount > 0 ? (
                    <span className="sr-only">{activeFilterCount} filters active</span>
                  ) : null}
                </button>
                <input
                  type="search"
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  placeholder="Search library..."
                  aria-label="Search card library"
                  className="w-full border-0 bg-transparent p-0 font-spaceGrotesk text-[13px] text-[#e2e2e8] placeholder:text-[#8a96a6] focus:outline-none focus:ring-0"
                />
              </div>
            </div>
            <WorkshopCardFilters
              open={filtersOpen}
              searchParams={searchParams}
              onSelectChange={handleFilterSelectChange}
              onEffectChange={handleEffectChange}
              onClear={() => setSearchParams(EMPTY_WORKSHOP_FILTERS)}
              activeCount={activeFilterCount}
              shownCount={library.length}
              totalCount={cardList.length}
            />
            <div className="min-h-0 flex-1 overflow-hidden">
              <WorkshopCardLibrary
                cards={library}
                cardPoolSize={cardList.length}
                banlist={banlist}
                getRemainingCopies={(card) =>
                  getRemainingCopies(card, currentDeck, banlist)
                }
                onAdd={handleLibraryAdd}
                onDragStart={handleLibraryDragStart}
              />
            </div>
          </div>
        ) : (
          <div
            id="workshop-browser-strategist-panel"
            role="tabpanel"
            aria-labelledby="workshop-browser-strategist"
            className="flex min-h-0 flex-1 flex-col overflow-hidden"
          >
            <WorkshopStrategistPanel onOpenWorkshopTab={onOpenWorkshopTab} />
          </div>
        )}
        </FadeSwap>
      </div>
    </div>
    </CardPreviewTooltipProvider>
  );
}
