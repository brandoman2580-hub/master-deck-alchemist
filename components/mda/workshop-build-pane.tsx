"use client";

import {
  useMemo,
  useState,
  type ChangeEvent,
  type DragEvent,
  type PointerEvent,
  type ReactNode,
} from "react";
import {
  Bot,
  ChevronDown,
  Layers,
  Minus,
  Plus,
  SlidersHorizontal,
} from "lucide-react";
import { WorkshopStrategistPanel } from "@/components/mda/workshop-strategist";
import { WorkshopCardLibrary } from "@/components/mda/workshop-card-library";
import {
  WORKSHOP_CARD_SHELL,
  WORKSHOP_CARD_SIZES,
  WORKSHOP_CARD_TILE,
} from "@/components/mda/workshop-card-dims";
import { CardImage } from "@/components/ui/card-image";
import { MdaSearchField } from "@/components/mda/search-field";
import { MdaCardPreview } from "@/components/mda/mda-card-preview";
import { MdaFrameCorners } from "@/components/mda/frame-corners";
import {
  EMPTY_WORKSHOP_FILTERS,
  WorkshopCardFilters,
  type WorkshopFilterState,
} from "@/components/mda/workshop-card-filters";
import type { BanStatus, DeckCard, DeckSection } from "@/types/types";
import type { Card } from "@/types/card";
import type { WorkshopTab } from "@/components/mda/workshop-deck-chrome";
import { useDeck } from "@/context/deck-context";
import { useCardStore } from "@/store/cardStore";
import { selectFilteredCards } from "@/store/cardPoolSelectors";
import {
  getRemainingCopies,
  isExtraDeckCard,
} from "@/app/deck-builder/utils";
import { cn } from "@/lib/utils";

type RightPanel = "cards" | "strategist";

const SECTION_LIMITS: Record<DeckSection, number> = {
  mainDeck: 60,
  extraDeck: 15,
  sideDeck: 15,
};

const DRAG_MIME = "application/x-mda-card-id";

const COUNT_BADGE_CLASS =
  "inline-flex min-w-[28px] items-center justify-center whitespace-nowrap bg-mda-chrome px-1.5 py-0.5 font-mda text-xs font-bold leading-none text-mda-inverse-text";
const COUNT_BTN_CLASS =
  "flex h-6 w-6 shrink-0 items-center justify-center bg-mda-chrome-deep text-mda-inverse-text transition-opacity";

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

function BuilderCardGridItem({
  card,
  quantity,
  canAdd,
  banStatus,
  onAdd,
  onRemove,
}: {
  card: DeckCard;
  quantity: number;
  canAdd: boolean;
  banStatus: BanStatus;
  onAdd: () => void;
  onRemove: () => void;
}): ReactNode {
  /**
   * CSS `group-hover` + `group-focus-within` left +/- stuck visible after click
   * (button retained focus) and on some pointer leave paths. Drive visibility
   * from pointer enter/leave and blur after each click.
   */
  const [controlsVisible, setControlsVisible] = useState(false);

  const showControls = (event: PointerEvent<HTMLDivElement>): void => {
    if (event.pointerType === "touch") return;
    setControlsVisible(true);
  };

  const hideControls = (): void => {
    setControlsVisible(false);
  };

  return (
    <MdaCardPreview card={card}>
      <div
        data-magnetic
        className={WORKSHOP_CARD_SHELL}
        onPointerEnter={showControls}
        onPointerLeave={hideControls}
      >
        <div className={WORKSHOP_CARD_TILE}>
          <CardImage
            card={card}
            preferSmall
            fill
            alt={card.name}
            className="object-contain"
            sizes={WORKSHOP_CARD_SIZES}
          />
          <BanlistCornerBadge status={banStatus} />
        </div>
        <div className="absolute bottom-1 left-1/2 z-[2] flex -translate-x-1/2 flex-row items-center gap-0.5">
          <button
            type="button"
            tabIndex={controlsVisible ? 0 : -1}
            onClick={(event) => {
              event.preventDefault();
              event.stopPropagation();
              onRemove();
              event.currentTarget.blur();
            }}
            aria-label={`Remove one ${card.name}`}
            className={cn(
              COUNT_BTN_CLASS,
              controlsVisible
                ? "opacity-100"
                : "pointer-events-none opacity-0",
            )}
          >
            <Minus className="h-3.5 w-3.5" aria-hidden />
          </button>
          <span
            className={cn(
              COUNT_BADGE_CLASS,
              quantity <= 1 && "bg-transparent text-transparent",
            )}
          >
            {quantity > 1 ? `x${quantity}` : "x1"}
          </span>
          <button
            type="button"
            tabIndex={controlsVisible ? 0 : -1}
            onClick={(event) => {
              event.preventDefault();
              event.stopPropagation();
              onAdd();
              event.currentTarget.blur();
            }}
            disabled={!canAdd}
            aria-label={
              canAdd
                ? `Add another ${card.name}`
                : banStatus && banStatus !== "Unlimited"
                  ? `${card.name} is ${banStatus}`
                  : `Cannot add more ${card.name}`
            }
            title={
              !canAdd && banStatus && banStatus !== "Unlimited"
                ? `${banStatus} — max ${banlistLimitLabel(banStatus)}`
                : undefined
            }
            className={cn(
              COUNT_BTN_CLASS,
              controlsVisible
                ? canAdd
                  ? "opacity-100"
                  : "cursor-not-allowed opacity-40"
                : "pointer-events-none opacity-0",
            )}
          >
            <Plus className="h-3.5 w-3.5" aria-hidden />
          </button>
        </div>
      </div>
    </MdaCardPreview>
  );
}

function DeckSectionBlock({
  title,
  section,
  cards,
  open,
  banlist,
  onToggle,
  onAdd,
  onRemoveOne,
  canAddCard,
}: {
  title: string;
  section: DeckSection;
  cards: DeckCard[];
  open: boolean;
  banlist: Record<string, BanStatus>;
  onToggle: () => void;
  onAdd: (card: Card) => void;
  onRemoveOne: (deckInstanceId: string) => void;
  canAddCard: (card: Card) => boolean;
}): ReactNode {
  const [isDragOver, setIsDragOver] = useState(false);
  const grouped = groupCardsById(cards);
  const atSectionCap = cards.length >= SECTION_LIMITS[section];

  const handleDragOver = (event: DragEvent<HTMLDivElement>): void => {
    if (![...event.dataTransfer.types].includes(DRAG_MIME)) return;
    event.preventDefault();
    event.dataTransfer.dropEffect = "copy";
    setIsDragOver(true);
  };

  const handleDragLeave = (event: DragEvent<HTMLDivElement>): void => {
    if (event.currentTarget.contains(event.relatedTarget as Node)) return;
    setIsDragOver(false);
  };

  const handleDrop = (event: DragEvent<HTMLDivElement>): void => {
    event.preventDefault();
    setIsDragOver(false);
    const raw = event.dataTransfer.getData(DRAG_MIME);
    if (!raw) return;
    try {
      const card = JSON.parse(raw) as Card;
      if (atSectionCap || !canAddCard(card)) return;
      onAdd(card);
    } catch {
      // Ignore malformed drag payloads
    }
  };

  return (
    <section className="w-full">
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={open}
        data-magnetic
        className="flex w-full items-center gap-3 border-4 border-mda-chrome bg-[#B9BEBE] px-3 py-2.5 text-left transition-colors duration-200 hover:bg-[#B9BEBE]/80"
      >
        <span className="font-mda text-2xl font-semibold uppercase tracking-[0.06em] text-mda-ink-strong">
          {title}
        </span>
        <span className="font-mda text-sm text-mda-ink-muted">
          ({cards.length})
        </span>
        <span className="h-px flex-1 bg-mda-chrome/50" aria-hidden />
        <ChevronDown
          className={cn(
            "h-6 w-6 text-mda-ink transition-transform duration-300 ease-in-out",
            open && "rotate-180",
          )}
          aria-hidden
        />
      </button>
      {open ? (
        <div
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          className={cn(
            "min-h-[120px] px-3 py-3 transition-shadow",
            isDragOver && "ring-2 ring-inset ring-mda-cyan",
          )}
        >
          {grouped.length === 0 ? (
            <p className="py-8 text-center font-mda text-sm text-mda-ink-muted">
              Drop cards here or add from the library
            </p>
          ) : (
            <div className="flex flex-wrap gap-2">
              {grouped.map(({ card, quantity, instances }) => (
                <BuilderCardGridItem
                  key={card.id}
                  card={card}
                  quantity={quantity}
                  canAdd={!atSectionCap && canAddCard(card)}
                  banStatus={banlist[card.name] || "Unlimited"}
                  onAdd={() => onAdd(card)}
                  onRemove={() => {
                    const last = instances[instances.length - 1];
                    if (last) onRemoveOne(last.deckInstanceId);
                  }}
                />
              ))}
            </div>
          )}
        </div>
      ) : null}
    </section>
  );
}

export function WorkshopBuildPane({
  onOpenWorkshopTab,
}: {
  onOpenWorkshopTab?: (tab: Extract<WorkshopTab, "matchups" | "combos">) => void;
} = {}): ReactNode {
  const { currentDeck, banlist, addCardToDeck, removeCardFromDeck } = useDeck();
  const cardList = useCardStore((state) => state.cardList);
  const [rightPanel, setRightPanel] = useState<RightPanel>("cards");
  const [query, setQuery] = useState("");
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [searchParams, setSearchParams] = useState<WorkshopFilterState>(
    EMPTY_WORKSHOP_FILTERS,
  );
  const [mainOpen, setMainOpen] = useState(true);
  const [extraOpen, setExtraOpen] = useState(true);
  const [sideOpen, setSideOpen] = useState(true);
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

  const isTcg = currentDeck.mode === "TCG";

  return (
    <div className="grid h-full min-h-0 grid-cols-1 gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(280px,420px)]">
      <div className="relative h-full min-h-0 bg-transparent">
        {/*
          Brackets sit on the outer frame. The filled panel is inset so the
          L-arms read as a separate frame, not painted on the same edge.
        */}
        <MdaFrameCorners
          sizeClassName="h-8 w-8"
          thicknessClassName="border-[4px]"
        />
        <div className="absolute inset-3 z-[1] space-y-2 overflow-y-auto bg-[#BEBEBE]/75 p-3 sm:inset-4">
          <DeckSectionBlock
            title="Main"
            section="mainDeck"
            cards={currentDeck.mainDeck}
            open={mainOpen}
            banlist={banlist}
            onToggle={() => setMainOpen((value) => !value)}
            onAdd={(card) => handleAddToSection(card, "mainDeck")}
            onRemoveOne={(id) => removeCardFromDeck(id, "mainDeck")}
            canAddCard={canAddCard}
          />
          <DeckSectionBlock
            title="Extra"
            section="extraDeck"
            cards={currentDeck.extraDeck}
            open={extraOpen}
            banlist={banlist}
            onToggle={() => setExtraOpen((value) => !value)}
            onAdd={(card) => handleAddToSection(card, "extraDeck")}
            onRemoveOne={(id) => removeCardFromDeck(id, "extraDeck")}
            canAddCard={canAddCard}
          />
          {isTcg ? (
            <DeckSectionBlock
              title="Side"
              section="sideDeck"
              cards={currentDeck.sideDeck}
              open={sideOpen}
              banlist={banlist}
              onToggle={() => setSideOpen((value) => !value)}
              onAdd={(card) => handleAddToSection(card, "sideDeck")}
              onRemoveOne={(id) => removeCardFromDeck(id, "sideDeck")}
              canAddCard={canAddCard}
            />
          ) : null}
        </div>
      </div>

      <div className="flex min-h-0 flex-col bg-transparent p-0">
        <div className="mb-3 flex gap-1 border-b-4 border-mda-chrome">
          {(
            [
              ["cards", "Cards", Layers],
              ["strategist", "Strategist", Bot],
            ] as const
          ).map(([key, label, Icon]) => (
            <button
              key={key}
              type="button"
              onClick={() => setRightPanel(key)}
              data-magnetic
              className={cn(
                "relative flex min-h-[48px] min-w-[140px] items-center justify-center gap-2.5 px-6 font-mda text-2xl font-semibold uppercase tracking-wide transition-colors",
                rightPanel === key
                  ? "bg-mda-chrome text-mda-inverse-text"
                  : "bg-transparent text-mda-ink hover:text-mda-ink-strong",
              )}
            >
              <Icon className="h-6 w-6 shrink-0" aria-hidden />
              {label}
            </button>
          ))}
        </div>

        {rightPanel === "cards" ? (
          <>
            <div className="mb-2 flex items-center gap-2">
              <MdaSearchField
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Search the card library"
                aria-label="Search card library"
                className="normal-case tracking-normal"
                containerClassName="flex-1 bg-mda-chrome ring-mda-chrome-deep focus-within:bg-mda-chrome-deep focus-within:ring-mda-cyan"
              />
              <button
                type="button"
                onClick={() => setFiltersOpen((value) => !value)}
                aria-label={filtersOpen ? "Hide filters" : "Show filters"}
                aria-expanded={filtersOpen}
                data-magnetic
                className={cn(
                  "relative bg-transparent p-2 text-mda-ink-muted transition-colors hover:text-mda-ink",
                  filtersOpen && "text-mda-ink",
                )}
              >
                <SlidersHorizontal className="h-5 w-5" aria-hidden />
                {activeFilterCount > 0 ? (
                  <span className="absolute -right-1 -top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-mda-chrome px-1 font-mda text-[10px] font-bold text-mda-inverse-text">
                    {activeFilterCount}
                  </span>
                ) : null}
              </button>
            </div>
            <WorkshopCardFilters
              open={filtersOpen}
              searchParams={searchParams}
              onSelectChange={handleFilterSelectChange}
              onEffectChange={handleEffectChange}
              onClear={() => setSearchParams(EMPTY_WORKSHOP_FILTERS)}
              activeCount={activeFilterCount}
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
          </>
        ) : (
          <WorkshopStrategistPanel onOpenWorkshopTab={onOpenWorkshopTab} />
        )}
      </div>
    </div>
  );
}
