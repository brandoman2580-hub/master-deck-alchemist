"use client";

import { useState, useEffect, useCallback, useRef, useMemo } from "react";
import { Card as CardUI, CardContent, CardHeader } from "@/components/ui/card";
import { InputWithClear } from "@/components/ui/input-with-clear";
import { Skeleton } from "@/components/ui/skeleton";
import { DeckDropZone } from "@/components/ui/deck-drop-zone";
import { Virtuoso } from "react-virtuoso";
import { Card } from "@/types/card";
import { DeckType, DeckMode, BanStatus, DeckSection } from "@/types/types";
import { UniqueIdentifier } from "@dnd-kit/core";
import { getRemainingCopies, isExtraDeckCard } from "@/app/deck-builder/utils";
import { useCardStore } from "@/store/cardStore";
import { getTCGBanlist, getMasterDuelBanlist } from "@/lib/api";
import { selectFilteredCards } from "@/store/cardPoolSelectors";
import { CardStack } from "@/components/ui/card-stack";
import { FilterSidebar } from "./filter-sidebar";
import { Search, Filter } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { FILTER_CONFIGS } from "@/lib/constants";

interface CardBrowserProps {
  currentDeck: DeckType;
  deckMode: DeckMode;
  activeDragId: UniqueIdentifier | null;
  handleCardDoubleClick: (card: Card) => void;
  addCardToDeck: (card: Card, section: DeckSection) => void;
}

export function CardBrowser({
  currentDeck,
  deckMode,
  activeDragId,
  handleCardDoubleClick,
  addCardToDeck,
}: CardBrowserProps) {
  // Zustand store
  const cardList = useCardStore((state) => state.cardList);
  const loading = useCardStore((state) => state.loading);

  // Phase 6: Removed debug logs for performance

  // Search and filter state
  const [searchQuery, setSearchQuery] = useState("");
  const [filteredCards, setFilteredCards] = useState<Card[]>([]);
  const [banlist, setBanlist] = useState<Record<string, BanStatus>>({});
  const [isFilterSidebarCollapsed, setIsFilterSidebarCollapsed] = useState(true);
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
        console.error("Error loading banlist:", err);
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

  // Filter and sort cards using memoized selectors (Phase 1 optimization)
  useEffect(() => {
    if (cardList.length === 0) {
      setFilteredCards([]);
      return;
    }

    const filtered = selectFilteredCards(cardList, debouncedSearchQuery, {
      ...searchParams,
      sort: searchParams.sort || "name",
      sortDirection: searchParams.sortDirection || "asc",
    });
    
    // Phase 6: Removed debug logs for performance
    setFilteredCards(filtered);
  }, [debouncedSearchQuery, cardList, searchParams]);

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
    [currentDeck],
  );

  // Handle add card (click-to-add)
  const handleAddCard = useCallback(
    (card: Card) => {
      const section: DeckSection = isExtraDeckCard(card)
        ? "extraDeck"
        : "mainDeck";
      addCardToDeck(card, section);
    },
    [addCardToDeck],
  );


  // Get active filters count for badge
  const activeFiltersCount = useMemo(() => {
    let count = 0;
    FILTER_CONFIGS.forEach((config) => {
      const value = searchParams[config.key as keyof typeof searchParams];
      if (value && value.trim()) {
        count += value.split(",").filter(v => v.trim()).length;
      }
    });
    if (searchParams.archetype) {
      count += searchParams.archetype.split(",").filter(v => v.trim()).length;
    }
    if (searchParams.effect && searchParams.effect.trim()) {
      count += 1;
    }
    return count;
  }, [searchParams]);

  return (
    <div className="relative flex flex-col h-full">
      {/* Main Card Browser - Fixed Width */}
      <div className="flex-1 flex flex-col min-w-0 w-full min-h-0">
        <div className="h-full rounded-2xl bg-white/5 border border-white/10 backdrop-blur-xl shadow-lg">
          <CardUI className="bg-transparent h-full flex flex-col pt-4 sm:pt-6">
            <CardHeader className="pb-2 flex-shrink-0 px-4 sm:px-6 pt-0">
              <div className="flex items-center gap-2 w-full">
                <div className="relative flex-1 min-w-0">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-white/60 pointer-events-none z-10" />
                  <InputWithClear
                    ref={searchInputRef}
                    placeholder="Search cards..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    onClear={() => setSearchQuery("")}
                    className="w-full h-9 pl-9 pr-9 text-sm bg-white/5 border border-white/10 text-white placeholder:text-white/50 focus-visible:outline-none rounded-lg"
                  />
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => setIsFilterSidebarCollapsed(!isFilterSidebarCollapsed)}
                  className="h-9 w-9 flex-shrink-0 text-white/80 hover:text-white hover:bg-white/10 relative rounded-lg"
                  aria-label={isFilterSidebarCollapsed ? "Show filters" : "Hide filters"}
                >
                  <Filter className="h-4 w-4" />
                  {activeFiltersCount > 0 && (
                    <Badge className="absolute -top-1 -right-1 h-4 w-4 rounded-full bg-white/10 text-white text-[9px] flex items-center justify-center font-bold p-0 border border-white/20 backdrop-blur-sm">
                      {activeFiltersCount}
                    </Badge>
                  )}
                </Button>
              </div>
              {!loading && (
                <div className="flex items-center justify-end mt-2 gap-2">
                  <span className="text-xs text-white/80 font-bold tracking-wider uppercase">
                    {filteredCards.length.toLocaleString()} {filteredCards.length === 1 ? "CARD" : "CARDS"}
                  </span>
                  <div className="h-2.5 w-10 bg-gradient-to-r from-white/20 via-white/10 to-transparent border border-white/10 rounded" />
                </div>
              )}
            </CardHeader>
            <CardContent className="p-0 flex-1 min-h-0">
              <div className="h-full border-t border-white/10">
                <DeckDropZone id="card-browser" isEmpty={false}>
                  {loading || cardList.length === 0 ? (
                    <div className="flex flex-col gap-2 p-4 sm:p-6">
                      {Array.from({ length: 8 }).map((_, i) => (
                        <div key={i} className="flex items-center gap-3 px-4 py-2.5">
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
                    <div className="flex flex-col items-center justify-center h-full py-16 min-h-[400px]">
                      <Search className="h-12 w-12 mb-3 text-white/30" />
                      <span className="text-sm font-medium text-white/70">
                        No cards found
                      </span>
                      <span className="text-xs text-white/50 mt-2">
                        Try adjusting your search or filters
                      </span>
                    </div>
                  ) : (
                    <Virtuoso
                      style={{ height: "100%", minHeight: "400px" }}
                      totalCount={filteredCards.length}
                      // Phase 6: itemContent is already optimized by Virtuoso
                      // CardStack is memoized, so re-renders are minimal
                      itemContent={(index) => {
                        const card = filteredCards[index];
                        const banStatus = banlist[card.name] || "Unlimited";
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

                        const stackProps = {
                          card,
                          remainingCopies: remaining,
                          maxCopies,
                          banStatus,
                          isBeingDragged: activeDragId === `browser-${card.id}`,
                          currentCount,
                          onStackClick: () => {
                            if (remaining > 0) {
                              handleAddCard(card);
                            }
                          },
                          onDoubleClick: () => {
                            if (remaining > 0) {
                              handleCardDoubleClick(card);
                            }
                          },
                        };
                        return <CardStack key={card.id} {...stackProps} />;
                      }}
                    />
                  )}
                </DeckDropZone>
              </div>
            </CardContent>
          </CardUI>
        </div>
      </div>

      {/* Filter Sidebar - Overlay/Slide Over */}
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

