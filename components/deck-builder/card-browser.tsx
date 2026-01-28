"use client";

import { useState, useEffect, useCallback, useRef, useMemo, useLayoutEffect } from "react";
import { motion } from "framer-motion";
import { Card as CardUI, CardContent, CardHeader } from "@/components/ui/card";
import { InputWithClear } from "@/components/ui/input-with-clear";
import { Skeleton } from "@/components/ui/skeleton";
import { DeckDropZone } from "@/components/ui/deck-drop-zone";
import { useVirtualizer } from "@tanstack/react-virtual";
import { Card } from "@/types/card";
import { DeckType, DeckMode, BanStatus, DeckSection } from "@/types/types";
import { UniqueIdentifier } from "@dnd-kit/core";
import { getRemainingCopies, isExtraDeckCard } from "@/app/deck-builder/utils";
import { useCardStore } from "@/store/cardStore";
import { getTCGBanlist, getMasterDuelBanlist } from "@/lib/api";
import { selectFilteredCards } from "@/store/cardPoolSelectors";
import { CardStack } from "@/components/ui/card-stack";
import { FilterSidebar } from "./filter-sidebar";
import { Search, Filter, Bot } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { FILTER_CONFIGS } from "@/lib/constants";
import { pulseVariants, SPRING_CONFIG } from "@/lib/animations";
import { DeckAssistant } from "@/components/deck-assistant/deck-assistant";

interface CardBrowserProps {
  currentDeck: DeckType;
  deckMode: DeckMode;
  activeDragId: UniqueIdentifier | null;
  activeDragCard: Card | null;
  droppedCardIds: Set<number>;
  handleCardDoubleClick: (card: Card) => void;
  addCardToDeck: (card: Card, section: DeckSection) => void;
}

export function CardBrowser({
  currentDeck,
  deckMode,
  droppedCardIds,
  handleCardDoubleClick,
  addCardToDeck,
}: CardBrowserProps) {
  // Zustand store
  const cardList = useCardStore((state) => state.cardList);
  const loading = useCardStore((state) => state.loading);

  // Tab state - controlled to track active tab
  const [activeTab, setActiveTab] = useState("browser");

  // Refs for tab slider animation
  const browserTabRef = useRef<HTMLButtonElement>(null);
  const assistantTabRef = useRef<HTMLButtonElement>(null);
  const tabsContainerRef = useRef<HTMLDivElement>(null);
  const [tabSliderStyle, setTabSliderStyle] = useState<React.CSSProperties>({});

  // Virtual list container ref
  const virtualContainerRef = useRef<HTMLDivElement>(null);

  // Calculate tab slider position
  useLayoutEffect(() => {
    if (tabsContainerRef.current) {
      let activeTabRef: React.RefObject<HTMLButtonElement> | null = null;
      if (activeTab === "browser") activeTabRef = browserTabRef;
      else if (activeTab === "assistant") activeTabRef = assistantTabRef;

      if (activeTabRef?.current) {
        const containerRect = tabsContainerRef.current.getBoundingClientRect();
        const btnRect = activeTabRef.current.getBoundingClientRect();
        setTabSliderStyle({
          left: btnRect.left - containerRect.left,
          width: btnRect.width,
        });
      }
    }
  }, [activeTab]);

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

    const filtered = selectFilteredCards(cardList, debouncedSearchQuery, {
      ...searchParams,
      sort: searchParams.sort || "name",
      sortDirection: searchParams.sortDirection || "asc",
    });

    setFilteredCards(filtered);
  }, [debouncedSearchQuery, cardList, searchParams]);

  // TanStack Virtual setup - only create when browser tab is active
  const virtualizer = useVirtualizer({
    count: filteredCards.length,
    getScrollElement: () => (activeTab === "browser" ? virtualContainerRef.current : null),
    estimateSize: () => 100, // Estimated height per card item (~100px)
    overscan: 5, // Render 5 extra items outside viewport for smooth scrolling
  });

  // Reset scroll position when switching to browser tab
  useEffect(() => {
    if (activeTab === "browser" && virtualContainerRef.current) {
      // Use double requestAnimationFrame to ensure DOM is fully rendered
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          if (virtualContainerRef.current) {
            // Reset scroll to top when switching to browser tab
            virtualContainerRef.current.scrollTop = 0;
          }
        });
      });
    }
  }, [activeTab]);

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
      {/* Tabbed Interface: Card Browser + AI Assistant */}
      <div className="grid grid-rows-[auto_1fr] h-full min-h-0 overflow-hidden" style={{ height: "100%" }}>
        {/* Custom Tab List with Slide Animation */}
        <div className="pb-2 flex-shrink-0">
          <div
            ref={tabsContainerRef}
            className="relative flex w-full bg-white/5 border border-white/10 backdrop-blur-xl rounded-lg p-1"
          >
            <motion.span
              className="absolute top-1 bottom-1 bg-white/10 rounded-md"
              style={{
                ...tabSliderStyle,
                zIndex: 0,
                left: typeof tabSliderStyle.left === "number" ? tabSliderStyle.left + 4 : 0,
                width: typeof tabSliderStyle.width === "number" ? tabSliderStyle.width - 8 : 0,
              }}
              layout
              transition={{
                type: "spring",
                stiffness: SPRING_CONFIG.gentle.tension,
                damping: SPRING_CONFIG.gentle.friction,
              }}
            />
            <motion.button
              ref={browserTabRef}
              type="button"
              onClick={() => setActiveTab("browser")}
              className={`relative z-10 flex-1 px-4 py-3 font-medium transition-colors duration-200 focus:outline-none text-sm flex items-center justify-center gap-2 ${
                activeTab === "browser"
                  ? "text-white"
                  : "text-white/60 hover:text-white/80"
              }`}
              aria-pressed={activeTab === "browser"}
              style={{
                background: "transparent",
                position: "relative",
              }}
            >
              <Search className="h-4 w-4" />
              Card Browser
            </motion.button>
            <motion.button
              ref={assistantTabRef}
              type="button"
              onClick={() => setActiveTab("assistant")}
              className={`relative z-10 flex-1 px-4 py-3 font-medium transition-colors duration-200 focus:outline-none text-sm flex items-center justify-center gap-2 ${
                activeTab === "assistant"
                  ? "text-white"
                  : "text-white/60 hover:text-white/80"
              }`}
              aria-pressed={activeTab === "assistant"}
              style={{
                background: "transparent",
                position: "relative",
              }}
            >
              <Bot className="h-4 w-4" />
              AI Assistant
            </motion.button>
          </div>
        </div>

        {/* Card Browser Tab */}
        <div
          className="mt-0 min-h-0 overflow-hidden h-full"
          style={{ height: "100%", display: activeTab === "browser" ? "grid" : "none" }}
        >
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
                          {activeTab === "browser" && (
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
                                banlist
                              );
                              const currentCount = getCardCountInDeck(card.id);

                              // Hide card after drop: when card is in droppedCardIds set
                              // CardStack component handles hiding during drag via isDragging
                              const shouldHideAfterDrop = droppedCardIds.has(card.id);

                              // Don't render the wrapper div if card should be hidden
                              // This prevents layout issues with TanStack Virtual
                              if (shouldHideAfterDrop) {
                                return (
                                  <div
                                    key={virtualItem.key}
                                    data-index={virtualItem.index}
                                    ref={virtualizer.measureElement}
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
                                  ref={virtualizer.measureElement}
                                  style={{
                                    position: "absolute",
                                    top: 0,
                                    left: 0,
                                    width: "100%",
                                    height: `${virtualItem.size}px`,
                                    transform: `translateY(${virtualItem.start}px)`,
                                  }}
                                >
                                  <CardStack
                                    card={card}
                                    remainingCopies={remaining}
                                    maxCopies={maxCopies}
                                    banStatus={banStatus}
                                    shouldHideAfterDrop={shouldHideAfterDrop}
                                    currentCount={currentCount}
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
                                  />
                                </div>
                              );
                            })}
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  </DeckDropZone>
                </div>
              </CardContent>
            </CardUI>
          </div>
        </div>

        {/* AI Assistant Tab */}
        <div
          className="mt-0 min-h-0 overflow-hidden h-full"
          style={{ height: "100%", display: activeTab === "assistant" ? "flex" : "none" }}
        >
          <div className="h-full min-h-0 overflow-hidden flex flex-col w-full">
            <DeckAssistant currentDeck={currentDeck} deckMode={deckMode} />
          </div>
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
