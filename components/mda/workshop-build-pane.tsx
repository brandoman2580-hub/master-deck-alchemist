"use client";

import {
  useMemo,
  useState,
  type ChangeEvent,
  type DragEvent,
  type ReactNode,
} from "react";
import { ChevronDown, Minus, Plus, Search, SlidersHorizontal } from "lucide-react";
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

function gradeFromCounts(
  main: number,
  extra: number,
): {
  letter: string;
  scores: { label: string; value: number }[];
} {
  const density = Math.min(100, Math.round((main / 40) * 100));
  const extraScore = Math.min(100, Math.round((extra / 15) * 100));
  const consistency = Math.round((density + extraScore) / 2);
  const letter =
    consistency >= 90
      ? "S"
      : consistency >= 75
        ? "A"
        : consistency >= 60
          ? "B"
          : "C";
  return {
    letter,
    scores: [
      { label: "Consistency", value: consistency },
      { label: "Resilience", value: Math.max(40, consistency - 5) },
      { label: "Power", value: Math.max(45, extraScore) },
      { label: "Disruption", value: Math.max(35, Math.round(consistency * 0.9)) },
    ],
  };
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

function BuilderCardRow({
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
  const race = card.race ?? "";
  const attribute = card.attribute ?? "";

  return (
    <div className="flex items-center gap-3 px-2.5 py-2">
      <MdaCardPreview card={card}>
        <div className="relative h-[99px] w-[72px] shrink-0 cursor-help overflow-hidden bg-[color:var(--mda-bg-deep)] transition-[box-shadow] duration-200 ease-in-out hover:shadow-[0_0_16px_2px_rgba(255,255,255,0.65)]">
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
        <p className="truncate font-mda text-lg font-bold uppercase text-white">
          {card.name}
        </p>
        <div className="mt-1 flex flex-wrap gap-2">
          <span className="rounded bg-white/15 px-2 py-1 font-mda text-xs text-white/90">
            {card.type?.split(" ")[0] ?? "Card"}
          </span>
          {race ? (
            <span className="rounded bg-white/15 px-2 py-1 font-mda text-xs text-white/90">
              {race}
            </span>
          ) : null}
          {attribute ? (
            <span className="rounded bg-white/15 px-2 py-1 font-mda text-xs text-white/90">
              {attribute}
            </span>
          ) : null}
        </div>
      </div>
      <div className="flex shrink-0 items-center gap-2">
        <span className="inline-flex items-center rounded bg-white/10 px-2 py-1 font-mda text-lg font-bold text-white">
          ×
          <MdaAnimatedNumber value={quantity} />
        </span>
        <div className="flex flex-col overflow-hidden rounded border border-white/15">
          <button
            type="button"
            onClick={onAdd}
            disabled={!canAdd}
            aria-label={`Add another ${card.name}`}
            className="flex h-5 w-7 items-center justify-center text-white/80 hover:bg-white/15 disabled:cursor-not-allowed disabled:opacity-30"
          >
            <Plus className="h-3.5 w-3.5" aria-hidden />
          </button>
          <button
            type="button"
            onClick={onRemove}
            aria-label={`Remove one ${card.name}`}
            className="flex h-5 w-7 items-center justify-center border-t border-white/15 text-white/80 hover:bg-white/15"
          >
            <Minus className="h-3.5 w-3.5" aria-hidden />
          </button>
        </div>
      </div>
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
    <section className="mb-3">
      <button
        type="button"
        onClick={onToggle}
        className="flex w-full items-center justify-between bg-[#0B5393] px-3 py-1.5 font-mda text-sm font-bold uppercase tracking-wide text-white"
      >
        {title} ({cards.length})
        <ChevronDown
          className={cn("h-4 w-4 transition-transform", open && "rotate-180")}
          aria-hidden
        />
      </button>
      {open ? (
        <div
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          className={cn(
            "min-h-[120px] divide-y divide-white/5 bg-[rgba(3,19,26,0.6)] transition-shadow",
            isDragOver && "ring-2 ring-inset ring-[color:var(--mda-cyan-soft)]",
          )}
        >
          {grouped.length === 0 ? (
            <p className="px-3 py-8 text-center font-mda text-sm text-white/40">
              Drop cards here or add from the library
            </p>
          ) : (
            grouped.map(({ card, quantity, instances }) => (
              <BuilderCardRow
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
            ))
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

  const grade = useMemo(
    () =>
      gradeFromCounts(currentDeck.mainDeck.length, currentDeck.extraDeck.length),
    [currentDeck.mainDeck.length, currentDeck.extraDeck.length],
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
    <div className="grid h-full min-h-0 grid-cols-1 gap-3 xl:grid-cols-[minmax(0,1fr)_533px]">
      <div className="min-h-0 overflow-y-auto bg-[rgba(3,19,26,0.6)] p-2.5">
        <div className="mb-4 flex items-center justify-between gap-3">
          <span className="font-mda text-sm font-bold uppercase tracking-wide text-white/80">
            Deck Grade
          </span>
          <span className="font-mda text-sm font-bold uppercase tracking-wide text-white">
            {grade.letter} Tier
          </span>
        </div>
        <div className="mb-6 space-y-2">
          {grade.scores.map((score) => (
            <div key={score.label} className="flex items-center gap-3">
              <span className="w-28 font-mda text-xs uppercase text-white/70">
                {score.label}
              </span>
              <div className="h-2 flex-1 overflow-hidden rounded-sm bg-white/10">
                <div
                  className="h-full bg-[#EAF7FF]"
                  style={{ width: `${score.value}%` }}
                />
              </div>
              <span className="w-8 text-right font-mda text-xs text-white/70">
                {score.value}
              </span>
            </div>
          ))}
        </div>

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

      <div className="flex min-h-0 flex-col bg-[rgba(3,19,26,0.35)] p-2.5">
        <div className="mb-3 flex gap-2">
          {(
            [
              ["cards", "Cards"],
              ["assistant", "Assistant"],
            ] as const
          ).map(([key, label]) => (
            <button
              key={key}
              type="button"
              onClick={() => setRightPanel(key)}
              className={cn(
                "flex-1 py-2 font-mda text-sm font-bold uppercase transition-colors",
                rightPanel === key
                  ? "bg-[#0B5393] text-white"
                  : "bg-transparent text-white/70 hover:text-white",
              )}
            >
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
                containerClassName="flex-1 bg-[#45474B]"
              />
              <button
                type="button"
                onClick={() => setFiltersOpen((value) => !value)}
                aria-label={filtersOpen ? "Hide filters" : "Show filters"}
                aria-expanded={filtersOpen}
                className={cn(
                  "relative rounded p-2 text-white/70 hover:bg-white/10 hover:text-white",
                  filtersOpen && "bg-white/10 text-white",
                )}
              >
                <SlidersHorizontal className="h-5 w-5" aria-hidden />
                {activeFilterCount > 0 ? (
                  <span className="absolute -right-1 -top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-[#0B5393] px-1 font-mda text-[10px] font-bold text-white">
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
              <div className="grid grid-cols-4 gap-2 sm:grid-cols-6">
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
                          "relative aspect-[72/99] overflow-hidden bg-[color:var(--mda-bg-deep)] transition-[box-shadow] duration-200 ease-in-out hover:shadow-[0_0_16px_2px_rgba(255,255,255,0.65)]",
                          disabled && "cursor-not-allowed opacity-40 hover:shadow-none",
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
                  <div className="col-span-full flex flex-col items-center gap-2 py-10 text-white/40">
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
            <div className="min-h-0 flex-1 space-y-3 overflow-y-auto p-2">
              {assistantMessages.map((message, index) => (
                <div
                  key={`${message.role}-${index}`}
                  className={cn(
                    "rounded px-3 py-2 font-mda text-sm",
                    message.role === "ai"
                      ? "bg-[color:var(--mda-bg-deep)] text-white/80"
                      : "bg-[color:var(--mda-cyan-muted)] text-white",
                  )}
                >
                  {message.text}
                </div>
              ))}
            </div>
            <form
              className="mt-2 flex gap-2"
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
              <input
                value={assistantInput}
                onChange={(event) => setAssistantInput(event.target.value)}
                placeholder="Ask the assistant…"
                className="flex-1 bg-[#45474B] px-3 py-2 font-mda text-sm text-white placeholder:text-white/40 focus:outline-none"
              />
              <button
                type="submit"
                className="bg-[color:var(--mda-cyan)] px-4 font-mda text-sm font-bold uppercase text-[color:var(--mda-bg-deep)]"
              >
                Send
              </button>
            </form>
          </div>
        )}
      </div>
    </div>
  );
}
