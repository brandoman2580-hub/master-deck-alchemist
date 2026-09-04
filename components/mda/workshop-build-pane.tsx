"use client";

import {
  useMemo,
  useState,
  type ChangeEvent,
  type DragEvent,
  type ReactNode,
} from "react";
import {
  Bot,
  ChevronDown,
  Layers,
  Minus,
  Plus,
  Search,
  Send,
  SlidersHorizontal,
} from "lucide-react";
import { CardImage } from "@/components/ui/card-image";
import { MdaSearchField } from "@/components/mda/search-field";
import { MdaCardPreview } from "@/components/mda/mda-card-preview";
import { MdaAnimatedNumber } from "@/components/mda/deck-cap-badge";
import {
  EMPTY_WORKSHOP_FILTERS,
  WorkshopCardFilters,
  type WorkshopFilterState,
} from "@/components/mda/workshop-card-filters";
import type { DeckCard, DeckSection } from "@/types/types";
import type { Card } from "@/types/card";
import { useDeck } from "@/context/deck-context";
import { useCardStore } from "@/store/cardStore";
import { selectFilteredCards } from "@/store/cardPoolSelectors";
import {
  getRemainingCopies,
  isExtraDeckCard,
} from "@/app/deck-builder/utils";
import { cn } from "@/lib/utils";

type RightPanel = "cards" | "assistant";

const SECTION_LIMITS: Record<DeckSection, number> = {
  mainDeck: 60,
  extraDeck: 15,
  sideDeck: 15,
};

const DRAG_MIME = "application/x-mda-card-id";

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
  onAdd,
  onRemove,
}: {
  card: DeckCard;
  quantity: number;
  canAdd: boolean;
  onAdd: () => void;
  onRemove: () => void;
}): ReactNode {
  return (
    <div className="group relative">
      <MdaCardPreview card={card}>
        <div className="relative aspect-[72/99] overflow-hidden bg-mda-deep shadow-sm ring-1 ring-mda-ink/10 transition-shadow hover:shadow-mda-soft">
          <CardImage
            card={card}
            preferSmall
            fill
            alt={card.name}
            className="object-cover"
            sizes="80px"
          />
          {quantity > 1 ? (
            <span className="absolute bottom-0 left-0 bg-mda-chrome px-1.5 py-0.5 font-mda text-xs font-bold text-mda-inverse-text">
              ×<MdaAnimatedNumber value={quantity} />
            </span>
          ) : null}
          <div className="absolute inset-0 flex items-center justify-center gap-1 bg-mda-chrome/85 opacity-0 transition-opacity group-hover:opacity-100 group-focus-within:opacity-100">
            <button
              type="button"
              onClick={onAdd}
              disabled={!canAdd}
              aria-label={`Add another ${card.name}`}
              className="flex h-7 w-7 items-center justify-center bg-mda-inverse-text/15 text-mda-inverse-text hover:bg-mda-inverse-text/25 disabled:cursor-not-allowed disabled:opacity-40"
            >
              <Plus className="h-4 w-4" aria-hidden />
            </button>
            <button
              type="button"
              onClick={onRemove}
              aria-label={`Remove one ${card.name}`}
              className="flex h-7 w-7 items-center justify-center bg-mda-inverse-text/15 text-mda-inverse-text hover:bg-mda-inverse-text/25"
            >
              <Minus className="h-4 w-4" aria-hidden />
            </button>
          </div>
        </div>
      </MdaCardPreview>
    </div>
  );
}

function DeckSectionBlock({
  title,
  section,
  cards,
  open,
  onToggle,
  onAdd,
  onRemoveOne,
  canAddCard,
}: {
  title: string;
  section: DeckSection;
  cards: DeckCard[];
  open: boolean;
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
    <section className="border-b border-mda-ink/15 last:border-b-0">
      <button
        type="button"
        onClick={onToggle}
        className="flex w-full items-center justify-between border-y border-mda-chrome/30 bg-mda-bg px-3 py-2 font-mda text-sm font-bold uppercase tracking-wide text-mda-ink-strong"
      >
        {title}
        <span className="flex items-center gap-2 font-mda text-xs text-mda-ink-muted">
          ({cards.length})
          <ChevronDown
            className={cn("h-4 w-4 transition-transform", open && "rotate-180")}
            aria-hidden
          />
        </span>
      </button>
      {open ? (
        <div
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          className={cn(
            "min-h-[120px] bg-mda-surface/60 p-3 transition-shadow",
            isDragOver && "ring-2 ring-inset ring-mda-cyan",
          )}
        >
          {grouped.length === 0 ? (
            <p className="py-8 text-center font-mda text-sm text-mda-ink-muted">
              Drop cards here or add from the library
            </p>
          ) : (
            <div className="grid grid-cols-4 gap-2 sm:grid-cols-5 md:grid-cols-6 lg:grid-cols-5 xl:grid-cols-6">
              {grouped.map(({ card, quantity, instances }) => (
                <BuilderCardGridItem
                  key={card.id}
                  card={card}
                  quantity={quantity}
                  canAdd={!atSectionCap && canAddCard(card)}
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

export function WorkshopBuildPane(): ReactNode {
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
  const [assistantInput, setAssistantInput] = useState("");
  const [assistantMessages, setAssistantMessages] = useState<
    { role: "user" | "ai"; text: string }[]
  >([
    {
      role: "ai",
      text: "Ask about ratios, tech choices, or cuts. Full assistant streaming still runs from the classic builder tools.",
    },
  ]);

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
    return filtered.slice(0, 120);
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

  return (
    <div className="grid h-full min-h-0 grid-cols-1 lg:grid-cols-[minmax(0,1fr)_minmax(280px,420px)]">
      <div className="min-h-0 overflow-y-auto border-r border-mda-ink/10">
        <DeckSectionBlock
          title="Main"
          section="mainDeck"
          cards={currentDeck.mainDeck}
          open={mainOpen}
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
          onToggle={() => setExtraOpen((value) => !value)}
          onAdd={(card) => handleAddToSection(card, "extraDeck")}
          onRemoveOne={(id) => removeCardFromDeck(id, "extraDeck")}
          canAddCard={canAddCard}
        />
        <DeckSectionBlock
          title="Side"
          section="sideDeck"
          cards={currentDeck.sideDeck}
          open={sideOpen}
          onToggle={() => setSideOpen((value) => !value)}
          onAdd={(card) => handleAddToSection(card, "sideDeck")}
          onRemoveOne={(id) => removeCardFromDeck(id, "sideDeck")}
          canAddCard={canAddCard}
        />
      </div>

      <div className="flex min-h-0 flex-col bg-mda-bg/40 p-3">
        <div className="mb-3 grid grid-cols-2 gap-0 border border-mda-chrome">
          {(
            [
              ["cards", "Cards", Layers],
              ["assistant", "Assistant", Bot],
            ] as const
          ).map(([key, label, Icon]) => (
            <button
              key={key}
              type="button"
              onClick={() => setRightPanel(key)}
              className={cn(
                "flex items-center justify-center gap-2 py-2.5 font-mda text-xs font-bold uppercase tracking-wide transition-colors",
                rightPanel === key
                  ? "bg-mda-chrome text-mda-inverse-text"
                  : "bg-mda-bg text-mda-ink hover:bg-mda-surface",
              )}
            >
              <Icon className="h-4 w-4" aria-hidden />
              {label}
            </button>
          ))}
        </div>

        {rightPanel === "cards" ? (
          <>
            <div className="mb-3 flex items-center gap-2">
              <MdaSearchField
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Search the card library"
                aria-label="Search card library"
                containerClassName="flex-1 bg-mda-chrome ring-mda-chrome-deep focus-within:bg-mda-chrome-deep focus-within:ring-mda-cyan"
              />
              <button
                type="button"
                onClick={() => setFiltersOpen((value) => !value)}
                aria-label={filtersOpen ? "Hide filters" : "Show filters"}
                aria-expanded={filtersOpen}
                className={cn(
                  "relative rounded p-2 text-mda-ink-muted transition-colors hover:bg-mda-panel hover:text-mda-ink",
                  filtersOpen && "bg-mda-panel text-mda-ink",
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
              onToggle={() => setFiltersOpen((value) => !value)}
              searchParams={searchParams}
              onSelectChange={handleFilterSelectChange}
              onEffectChange={handleEffectChange}
              onClear={() => setSearchParams(EMPTY_WORKSHOP_FILTERS)}
              activeCount={activeFilterCount}
            />
            <div className="min-h-0 flex-1 overflow-y-auto">
              <div className="grid grid-cols-4 gap-2 sm:grid-cols-5">
                {library.map((card) => {
                  const remaining = getRemainingCopies(
                    card,
                    currentDeck,
                    banlist,
                  );
                  const disabled = remaining <= 0;
                  return (
                    <MdaCardPreview key={card.id} card={card}>
                      <button
                        type="button"
                        draggable={!disabled}
                        onDragStart={(event) =>
                          handleLibraryDragStart(event, card)
                        }
                        onClick={() => handleLibraryAdd(card)}
                        disabled={disabled}
                        className={cn(
                          "relative aspect-[72/99] overflow-hidden bg-mda-deep ring-1 ring-mda-ink/10 transition-shadow hover:shadow-mda-soft",
                          disabled &&
                            "cursor-not-allowed opacity-40 hover:shadow-none",
                        )}
                        title={
                          disabled
                            ? `${card.name} — copy limit reached`
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
                          className="object-cover"
                          sizes="80px"
                        />
                      </button>
                    </MdaCardPreview>
                  );
                })}
                {library.length === 0 ? (
                  <div className="col-span-full flex flex-col items-center gap-2 py-10 text-mda-ink-muted">
                    <Search className="h-8 w-8" aria-hidden />
                    <p className="font-mda text-sm">
                      {cardList.length === 0
                        ? "Loading card library…"
                        : "No cards match"}
                    </p>
                  </div>
                ) : null}
              </div>
            </div>
          </>
        ) : (
          <div className="flex min-h-0 flex-1 flex-col">
            <div className="min-h-0 flex-1 space-y-4 overflow-y-auto p-1">
              {assistantMessages.map((message, index) => (
                <div
                  key={`${message.role}-${index}`}
                  className={cn(
                    "font-mda text-sm leading-relaxed",
                    message.role === "user"
                      ? "ml-4 rounded bg-mda-chrome px-3 py-2.5 text-mda-inverse-text"
                      : "flex gap-2 text-mda-ink",
                  )}
                >
                  {message.role === "ai" ? (
                    <Bot
                      className="mt-0.5 h-4 w-4 shrink-0 text-mda-ink-muted"
                      aria-hidden
                    />
                  ) : null}
                  <span>{message.text}</span>
                </div>
              ))}
            </div>
            <form
              className="mt-3"
              onSubmit={(event) => {
                event.preventDefault();
                if (!assistantInput.trim()) return;
                setAssistantMessages((prev) => [
                  ...prev,
                  { role: "user", text: assistantInput.trim() },
                  {
                    role: "ai",
                    text: "Noted. Wire the full deck-assistant stream into this panel in a follow-up pass.",
                  },
                ]);
                setAssistantInput("");
              }}
            >
              <label className="flex items-center gap-2 bg-mda-chrome px-3 py-2.5">
                <Search className="h-4 w-4 shrink-0 text-mda-inverse-text/70" aria-hidden />
                <input
                  value={assistantInput}
                  onChange={(event) => setAssistantInput(event.target.value)}
                  placeholder="Ask questions about your deck"
                  className="w-full bg-transparent font-mda text-sm text-mda-inverse-text placeholder:text-mda-inverse-text/45 focus:outline-none"
                />
                <button
                  type="submit"
                  aria-label="Send message"
                  className="shrink-0 text-mda-cyan transition-colors hover:text-mda-cyan-soft"
                >
                  <Send className="h-4 w-4" aria-hidden />
                </button>
              </label>
            </form>
          </div>
        )}
      </div>
    </div>
  );
}
