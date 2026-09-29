"use client";

import { useState, useEffect, useCallback, useRef, useMemo } from "react";
import { motion } from "framer-motion";
import { Card as CardUI, CardContent, CardHeader } from "@/components/ui/card";
import { InputWithClear } from "@/components/ui/input-with-clear";
import { Skeleton } from "@/components/ui/skeleton";
import { DeckDropZone } from "@/components/ui/deck-drop-zone";
import { useVirtualizer } from "@tanstack/react-virtual";
import { Card } from "@/types/card";
import { DeckType, DeckMode, BanStatus, DeckSection } from "@/types/types";
import { UniqueIdentifier } from "@dnd-kit/core";
import { getRemainingCopies, isExtraDeckCard } from "@/lib/deck/copy-limits";
import { useCardStore } from "@/store/cardStore";
import { getTCGBanlist, getMasterDuelBanlist } from "@/lib/api";
import { selectFilteredCards } from "@/store/cardPoolSelectors";
import { CardStack } from "@/components/ui/card-stack";
import { FilterSidebar } from "./filter-sidebar";
import { useMasterDuelRarity } from "@/hooks/useMasterDuelRarity";
import { Search, Filter } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { FILTER_CONFIGS } from "@/lib/constants";
import { pulseVariants } from "@/lib/animations";

interface CardBrowserProps {
  currentDeck: DeckType;
  deckMode: DeckMode;
  activeDragId: UniqueIdentifier | null;
  activeDragCard: Card | null;
  droppedCardIds: Set<number>;
  handleCardDoubleClick: (card: Card) => void;
  addCardToDeck: (card: Card, section: DeckSection) => void;
  removeCardFromDeck?: (card: Card) => void;
}

export function CardBrowser({
  currentDeck,
  deckMode,
  droppedCardIds,
  handleCardDoubleClick,
  addCardToDeck,
  removeCardFromDeck,
}: CardBrowserProps) {
  // Zustand store
  const cardList = useCardStore((state) => state.cardList);
  const loading = useCardStore((state) => state.loading);

  // Virtual list container ref
  const virtualContainerRef = useRef<HTMLDivElement>(null);

  // Search and filter state
  const [searchQuery, setSearchQuery] = useState("");
  const [filteredCards, setFilteredCards] = useState<Card[]>([]);
  const [banlist, setBanlist] = useState<Record<string, BanStatus>>({});
  const [isFilterSidebarCollapsed, setIsFilterSidebarCollapsed] =
    useState(true);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const [searchParams, setSearchParams] = useState({
    name: "",
    type: "",
    race: "",
    attribute: "",
    level: "",
    atk: "",
    def: "",
    archetype: "",
    effect: "",
    sort: "name",
    sortDirection: "asc" as "asc" | "desc",
    misc: "",
    atkRange: "",
    defRange: "",
    rarity: "",
    banStatus: "",
  });

  // Load banlist based on deck mode
  useEffect(() => {
    const loadBanlist = async () => {
      try {
        if (deckMode === "TCG") {
          const tcgBanlist = await getTCGBanlist();
          setBanlist(tcgBanlist);
        } else {
          const masterDuelBanlist = await getMasterDuelBanlist();
          setBanlist(masterDuelBanlist);
        }
      } catch (err) {
        // Banlist loading failed - use empty banlist for graceful degradation
        // This allows card browser to continue functioning without banlist validation
        setBanlist({});
      }
    };

    loadBanlist();
  }, [deckMode]);

  // Debounced search query
  const [debouncedSearchQuery, setDebouncedSearchQuery] = useState(searchQuery);

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearchQuery(searchQuery);
    }, 300);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  // Auto-focus search on mount
  useEffect(() => {
    if (searchInputRef.current) {
      searchInputRef.current.focus();
    }
  }, []);

  // Filter and sort cards using memoized selectors
  useEffect(() => {
    if (cardList.length === 0) {
      setFilteredCards([]);
      return;
    }

    let filtered = selectFilteredCards(cardList, debouncedSearchQuery, {
      ...searchParams,
      sort: searchParams.sort || "name",
      sortDirection: searchParams.sortDirection || "asc",
    });

    // Apply banlist filter (uses deck mode's banlist - TCG or Master Duel)
    if (searchParams.banStatus?.trim() && Object.keys(banlist).length > 0) {
      const selectedStatuses = searchParams.banStatus
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean);
      if (selectedStatuses.length > 0) {
        filtered = filtered.filter((card) => {
          const status = banlist[card.name] || "Unlimited";
          return selectedStatuses.includes(status);
        });
      }
    }

    setFilteredCards(filtered);
  }, [debouncedSearchQuery, cardList, searchParams, banlist]);

  // TanStack Virtual setup
  // Note: gap option has a bug with dynamic measurement - bake spacing into estimateSize instead
  const ROW_GAP = 8;
  const CONTENT_HEIGHT = 170;
  const virtualizer = useVirtualizer({
    count: filteredCards.length,
    getScrollElement: () => virtualContainerRef.current,
    estimateSize: () => CONTENT_HEIGHT + ROW_GAP,
    overscan: 5,
  });

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setSearchParams((prev) => ({ ...prev, [name]: value }));
  };

  const handleSelectChange = (name: string, value: string) => {
    setSearchParams((prev) => ({ ...prev, [name]: value }));
  };

  // Get card count in deck
  const getCardCountInDeck = useCallback(
    (cardId: number): number => {
      const allDeckCards = [
        ...currentDeck.mainDeck,
        ...currentDeck.extraDeck,
        ...currentDeck.sideDeck,
      ];
      return allDeckCards.filter((c) => c.id === cardId).length;
    },
    [currentDeck]
  );

  // Handle add card (click-to-add)
  const handleAddCard = useCallback(
    (card: Card) => {
      const section: DeckSection = isExtraDeckCard(card)
        ? "extraDeck"
        : "mainDeck";
      addCardToDeck(card, section);
    },
    [addCardToDeck]
  );

  // Fetch Master Duel rarity for card browser when in Master Duel mode
  const filteredCardIds = useMemo(
    () => filteredCards.map((c) => c.id),
    [filteredCards],
  );
  const mdRarityMap = useMasterDuelRarity(filteredCardIds, deckMode);

  // Get active filters count for badge
  const activeFiltersCount = useMemo(() => {
    let count = 0;
    FILTER_CONFIGS.forEach((config) => {
      const value = searchParams[config.key as keyof typeof searchParams];
      if (value && value.trim()) {
        count += value.split(",").filter((v) => v.trim()).length;
      }
    });
    if (searchParams.archetype) {
      count += searchParams.archetype.split(",").filter((v) => v.trim()).length;
    }
    if (searchParams.effect && searchParams.effect.trim()) {
      count += 1;
    }
    return count;
  }, [searchParams]);

  return (
    <div className="relative grid grid-rows-[auto_1fr] h-full min-h-0 overflow-hidden" style={{ height: "100%" }}>
      <div className="grid grid-rows-[auto_1fr] h-full min-h-0 overflow-hidden" style={{ height: "100%" }}>
        <div className="mt-0 min-h-0 overflow-hidden h-full" style={{ height: "100%" }}>
          <div className="grid grid-rows-[auto_1fr] h-full min-h-0 overflow-hidden" style={{ height: "100%" }}>
            <CardUI className="bg-transparent grid grid-rows-[auto_1fr] h-full min-h-0 overflow-hidden" style={{ height: "100%" }}>
              <CardHeader className="pb-2 flex-shrink-0 px-0 pt-4 sm:pt-6">
                <div className="flex items-center gap-2 w-full">
                  <motion.div
                    className="relative flex-[4] min-w-0"
                    whileFocus={{
                      scale: 1.01,
                      transition: { duration: 0.2 },
                    }}
                  >
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-white/60 pointer-events-none z-10" />
                    <InputWithClear
                      ref={searchInputRef}
                      placeholder="Search cards..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      onClear={() => setSearchQuery("")}
                      className="w-full h-9 pl-9 pr-9 text-sm bg-white/5 border border-white/10 text-white placeholder:text-white/50 focus-visible:outline-none rounded-lg transition-all duration-200 focus:border-white/30 focus:bg-white/10"
                    />
                  </motion.div>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() =>
                      setIsFilterSidebarCollapsed(!isFilterSidebarCollapsed)
                    }
                    className="h-9 flex-1 text-white/80 hover:text-white bg-white/10 hover:bg-white/15 border border-white/20 hover:border-white/30 transition-all focus:outline-none rounded-lg"
                    aria-label={
                      isFilterSidebarCollapsed ? "Show filters" : "Hide filters"
                    }
                  >
                    <Filter className="h-4 w-4 mr-1" />
                    <span className="text-sm">Filters</span>
                    {activeFiltersCount > 0 && (
                      <Badge className="ml-1 h-5 w-5 rounded-full bg-white/10 text-white text-[9px] flex items-center justify-center font-bold p-0 border border-white/20 backdrop-blur-sm">
                        {activeFiltersCount}
                      </Badge>
                    )}
                  </Button>
                </div>
                {!loading && (
                  <div className="flex items-center justify-start mt-2 pl-4 gap-2">
                    <span className="text-xs text-white/80 font-bold tracking-wider uppercase">
                      {filteredCards.length.toLocaleString()}{" "}
                      {filteredCards.length === 1 ? "CARD" : "CARDS"}
                    </span>
                    <div className="h-2.5 w-10 bg-gradient-to-r from-white/20 via-white/10 to-transparent border border-white/10 rounded" />
                  </div>
                )}
              </CardHeader>
              <CardContent className="p-0 h-full min-h-0 overflow-hidden" style={{ height: "100%" }}>
                <div className="h-full min-h-0 border-t border-white/10 overflow-hidden" style={{ height: "100%" }}>
                  <DeckDropZone
                    id="card-browser"
                    isEmpty={false}
                    className="flex-1 min-h-0"
                  >
                    <div className="flex-1 flex flex-col min-h-0 h-full">
                      {loading || cardList.length === 0 ? (
                        <div className="flex flex-col gap-2 p-4 sm:p-6">
                          {Array.from({ length: 8 }).map((_, i) => (
                            <div
                              key={i}
                              className="flex items-center gap-3 px-4 py-2.5"
                            >
                              <Skeleton className="w-16 h-24 flex-shrink-0 rounded" />
                              <div className="flex-1 space-y-2">
                                <Skeleton className="h-4 w-48" />
                                <Skeleton className="h-3 w-32" />
                                <Skeleton className="h-3 w-24" />
                              </div>
                              <Skeleton className="h-8 w-20 flex-shrink-0" />
                            </div>
                          ))}
                        </div>
                      ) : filteredCards.length === 0 ? (
                        <motion.div
                          className="flex flex-col items-center justify-center flex-1 py-16 min-h-[400px]"
                          initial="hidden"
                          animate="visible"
                          variants={pulseVariants}
                        >
                          <Search className="h-12 w-12 mb-3 text-white/30" />
                          <span className="text-sm font-medium text-white/70">
                            No cards found
                          </span>
                          <span className="text-xs text-white/50 mt-2">
                            Try adjusting your search or filters
                          </span>
                        </motion.div>
                      ) : (
                        <div
                          ref={virtualContainerRef}
                          className="flex-1 min-h-0 h-full w-full overflow-auto"
                          style={{ height: "100%" }}
                        >
                          <div
                            style={{
                              height: `${virtualizer.getTotalSize()}px`,
                              width: "100%",
                              position: "relative",
                            }}
                          >
                            {virtualizer.getVirtualItems().map((virtualItem) => {
                              const card = filteredCards[virtualItem.index];
                              const banStatus =
                                banlist[card.name] || "Unlimited";
                              let maxCopies = 3;
                              if (banStatus === "Limited") maxCopies = 1;
                              if (banStatus === "Semi-Limited") maxCopies = 2;
                              if (banStatus === "Forbidden") maxCopies = 0;

                              const remaining = getRemainingCopies(
                                card,
                                currentDeck,
                                banlist,
                              );
                              const currentCount = getCardCountInDeck(card.id);
                              const shouldHideAfterDrop = droppedCardIds.has(
                                card.id,
                              );

                              if (shouldHideAfterDrop) {
                                return (
                                  <div
                                    key={virtualItem.key}
                                    data-index={virtualItem.index}
                                    style={{
                                      position: "absolute",
                                      top: 0,
                                      left: 0,
                                      width: "100%",
                                      height: `${virtualItem.size}px`,
                                      transform: `translateY(${virtualItem.start}px)`,
                                      visibility: "hidden",
                                    }}
                                    aria-hidden="true"
                                  />
                                );
                              }

                              return (
                                <div
                                  key={virtualItem.key}
                                  data-index={virtualItem.index}
                                  className="flex flex-col"
                                  style={{
                                    position: "absolute",
                                    top: 0,
                                    left: 0,
                                    width: "100%",
                                    height: `${virtualItem.size}px`,
                                    transform: `translateY(${virtualItem.start}px)`,
                                  }}
                                >
                                  <div
                                    className="flex-shrink-0"
                                    style={{ marginBottom: ROW_GAP }}
                                  >
                                    <CardStack
                                      card={card}
                                      remainingCopies={remaining}
                                      maxCopies={maxCopies}
                                      banStatus={banStatus}
                                      shouldHideAfterDrop={shouldHideAfterDrop}
                                      currentCount={currentCount}
                                      deckMode={deckMode}
                                      mdRarityOverride={mdRarityMap?.get(
                                        card.id,
                                      )}
                                      onStackClick={() => {
                                        if (remaining > 0) {
                                          handleAddCard(card);
                                        }
                                      }}
                                      onDoubleClick={() => {
                                        if (remaining > 0) {
                                          handleCardDoubleClick(card);
                                        }
                                      }}
                                      onRemove={removeCardFromDeck}
                                    />
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      )}
                    </div>
                  </DeckDropZone>
                </div>
              </CardContent>
            </CardUI>
          </div>
        </div>
      </div>

      <FilterSidebar
        searchParams={searchParams}
        setSearchParams={setSearchParams}
        setSearchQuery={setSearchQuery}
        handleSelectChange={handleSelectChange}
        handleInputChange={handleInputChange}
        isCollapsed={isFilterSidebarCollapsed}
        onToggleCollapse={() =>
          setIsFilterSidebarCollapsed(!isFilterSidebarCollapsed)
        }
      />
    </div>
  );
}
