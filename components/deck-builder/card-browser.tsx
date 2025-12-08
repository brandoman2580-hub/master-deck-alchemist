"use client";

import { useState, useEffect } from "react";
import { Card as CardUI, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { InputWithClear } from "@/components/ui/input-with-clear";
import { FilterMenu } from "@/components/ui/filter-menu";
import { Skeleton } from "@/components/ui/skeleton";
import { DeckDropZone } from "@/components/ui/deck-drop-zone";
import { CardStack } from "@/components/ui/card-stack";
import { CyberpunkLoader } from "@/components/ui/cyberpunk-loader";
import { Virtuoso } from "react-virtuoso";
import { ArrowUp, ArrowDown } from "lucide-react";
import CutCornerWrapper from "@/components/cut-corner-wrapper";
import { Card } from "@/types/card";
import { DeckType, DeckMode, BanStatus } from "@/types/types";
import { UniqueIdentifier } from "@dnd-kit/core";
import { getRemainingCopies } from "@/app/deck-builder/utils";
import { useCardStore } from "@/store/cardStore";
import { getTCGBanlist, getMasterDuelBanlist } from "@/lib/api";
import { filterCards, getArchetypeName } from "@/lib/helpers";

interface CardBrowserProps {
  currentDeck: DeckType;
  deckMode: DeckMode;
  activeDragId: UniqueIdentifier | null;
  handleCardDoubleClick: (card: Card) => void;
}

export function CardBrowser({
  currentDeck,
  deckMode,
  activeDragId,
  handleCardDoubleClick,
}: CardBrowserProps) {
  // Zustand store
  const cardList = useCardStore((state) => state.cardList);
  const loading = useCardStore((state) => state.loading);

  // Search and filter state
  const [searchQuery, setSearchQuery] = useState("");
  const [filteredCards, setFilteredCards] = useState<Card[]>([]);
  const [banlist, setBanlist] = useState<Record<string, BanStatus>>({});
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

  // Filter and sort cards
  useEffect(() => {
    let filtered = cardList;
    if (searchQuery.trim() !== "") {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter((card) => {
        const archetypeName = getArchetypeName(card);
        return (
          card.name.toLowerCase().includes(query) ||
          card.desc.toLowerCase().includes(query) ||
          (archetypeName && archetypeName.toLowerCase().includes(query))
        );
      });
    }
    filtered = filterCards(filtered, searchParams);

    // Apply sorting
    const sortKey = searchParams.sort;
    const sortDirection = searchParams.sortDirection;

    filtered.sort((a, b) => {
      let aValue: string | number | undefined;
      let bValue: string | number | undefined;

      switch (sortKey) {
        case "name":
          aValue = a.name.toLowerCase();
          bValue = b.name.toLowerCase();
          break;
        case "atk":
          aValue = typeof a.atk === "number" ? a.atk : a.atk === "?" ? -1 : 0;
          bValue = typeof b.atk === "number" ? b.atk : b.atk === "?" ? -1 : 0;
          break;
        case "def":
          aValue = typeof a.def === "number" ? a.def : a.def === "?" ? -1 : 0;
          bValue = typeof b.def === "number" ? b.def : b.def === "?" ? -1 : 0;
          break;
        case "level":
          aValue = a.level ?? 0;
          bValue = b.level ?? 0;
          break;
        default:
          return 0;
      }

      if (aValue < bValue) return sortDirection === "asc" ? -1 : 1;
      if (aValue > bValue) return sortDirection === "asc" ? 1 : -1;
      return 0;
    });

    setFilteredCards(filtered);
  }, [searchQuery, cardList, searchParams]);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setSearchParams((prev) => ({ ...prev, [name]: value }));
  };

  const handleSelectChange = (name: string, value: string) => {
    setSearchParams((prev) => ({ ...prev, [name]: value }));
  };
  return (
    <div className="space-y-4">
      <CutCornerWrapper
        size="md"
        hoverHighlight
        padding="0"
        style={{
          ["--cut-corner-stroke" as string]: "rgba(20,239,255,0.38)",
          ["--cut-corner-stroke-hover" as string]: "rgba(20,239,255,0.52)",
          ["--cut-corner-fill" as string]: "transparent",
          backdropFilter: "blur(6px) saturate(120%)",
          WebkitBackdropFilter: "blur(6px) saturate(120%)",
        }}
      >
        <CardUI className="bg-transparent">
          <CardHeader className="pb-2">
            <CardTitle className="text-xl text-white font-display">
              Card Browser
            </CardTitle>
            <CardDescription className="text-muted-50">
              Search, filter, and drag/double click cards to add to your deck
            </CardDescription>
          </CardHeader>
          <CardContent className="p-0">
            <div className="p-6 pb-0 space-y-4">
              <div className="flex gap-2">
                <div className="flex-1">
                  <InputWithClear
                    placeholder="Search cards..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    onClear={() => setSearchQuery("")}
                    className="w-full bg-cyb-900/60 border-cyan-500/50 text-white placeholder:text-muted-50/70 focus-visible:border-cyan-400 focus-visible:ring-cyan-400/60"
                  />
                </div>
                <FilterMenu
                  searchParams={searchParams}
                  setSearchParams={setSearchParams}
                  setSearchQuery={setSearchQuery}
                  handleSelectChange={handleSelectChange}
                  handleInputChange={handleInputChange}
                />
              </div>

              <div className="flex items-center justify-between">
                {loading ? (
                  <div className="flex items-center gap-2">
                    <Skeleton className="h-4 w-20" />
                    <Skeleton className="h-4 w-12" />
                  </div>
                ) : (
                  <p className="text-sm text-muted-50">
                    Found {filteredCards.length} cards
                  </p>
                )}
                <div className="flex items-center gap-2">
                  <Select
                    value={searchParams.sort}
                    onValueChange={(value: string) =>
                      handleSelectChange("sort", value)
                    }
                    disabled
                  >
                    <SelectTrigger className="w-[120px] bg-cyb-900/60 border-cyan-500/50 text-white focus:ring-cyan-400/60 opacity-50 cursor-not-allowed">
                      <SelectValue placeholder="Sort by" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem
                        value="name"
                        className="text-white focus:bg-accent-cyan/20 focus:text-accent-cyan/80"
                      >
                        Name
                      </SelectItem>
                      <SelectItem
                        value="atk"
                        className="text-white focus:bg-accent-cyan/20 focus:text-accent-cyan/80"
                      >
                        ATK
                      </SelectItem>
                      <SelectItem
                        value="def"
                        className="text-white focus:bg-accent-cyan/20 focus:text-accent-cyan/80"
                      >
                        DEF
                      </SelectItem>
                      <SelectItem
                        value="level"
                        className="text-white focus:bg-accent-cyan/20 focus:text-accent-cyan/80"
                      >
                        Level
                      </SelectItem>
                    </SelectContent>
                  </Select>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() =>
                      setSearchParams((prev) => ({
                        ...prev,
                        sortDirection:
                          prev.sortDirection === "asc" ? "desc" : "asc",
                      }))
                    }
                    className="h-9 w-9 p-0 opacity-50 cursor-not-allowed"
                    aria-label={`Sort ${searchParams.sortDirection === "asc" ? "descending" : "ascending"}`}
                    disabled
                  >
                    {searchParams.sortDirection === "asc" ? (
                      <ArrowUp className="h-5 w-5 text-accent-cyan" />
                    ) : (
                      <ArrowDown className="h-5 w-5 text-accent-cyan" />
                    )}
                  </Button>
                </div>
              </div>
            </div>

            <div className="h-[500px] border-t border-accent-cyan/18">
              <DeckDropZone id="card-browser" isEmpty={false}>
                {loading || cardList.length === 0 ? (
                  <div className="flex flex-col items-center justify-center h-full">
                    <CyberpunkLoader size="md" />
                    <p className="text-muted-50 mt-4">
                      Loading Card Database...
                    </p>
                  </div>
                ) : filteredCards.length === 0 ? (
                  <div className="flex flex-col items-center justify-center h-full">
                    <p className="text-muted-50">No cards found</p>
                    <p className="text-sm text-muted-50/70">
                      Try adjusting your search filters
                    </p>
                  </div>
                ) : filteredCards.length > 100 ? (
                  <Virtuoso
                    style={{ height: "100%" }}
                    totalCount={filteredCards.length}
                    itemContent={(index) => {
                      const card = filteredCards[index];
                      const banStatus = banlist[card.name] || "Unlimited";
                      let maxCopies = 3;
                      if (banStatus === "Limited") maxCopies = 1;
                      if (banStatus === "Semi-Limited") maxCopies = 2;
                      if (banStatus === "Forbidden") maxCopies = 0;

                      return (
                        <div key={card.id} className="px-2 py-1.5">
                          <CardStack
                            card={card}
                            remainingCopies={getRemainingCopies(
                              card,
                              currentDeck,
                              banlist,
                            )}
                            maxCopies={maxCopies}
                            banStatus={banStatus}
                            isBeingDragged={
                              activeDragId === `browser-${card.id}`
                            }
                            onDoubleClick={() => {
                              const remaining = getRemainingCopies(
                                card,
                                currentDeck,
                                banlist,
                              );
                              if (remaining > 0) {
                                handleCardDoubleClick(card);
                              }
                            }}
                          />
                        </div>
                      );
                    }}
                  />
                ) : (
                  <div className="overflow-y-auto h-full">
                    {filteredCards.map((card) => {
                      const banStatus = banlist[card.name] || "Unlimited";
                      let maxCopies = 3;
                      if (banStatus === "Limited") maxCopies = 1;
                      if (banStatus === "Semi-Limited") maxCopies = 2;
                      if (banStatus === "Forbidden") maxCopies = 0;

                      return (
                        <div key={card.id} className="px-2 py-1.5">
                          <CardStack
                            card={card}
                            remainingCopies={getRemainingCopies(
                              card,
                              currentDeck,
                              banlist,
                            )}
                            maxCopies={maxCopies}
                            banStatus={banStatus}
                            isBeingDragged={activeDragId === `browser-${card.id}`}
                            onDoubleClick={() => {
                              const remaining = getRemainingCopies(
                                card,
                                currentDeck,
                                banlist,
                              );
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
              </DeckDropZone>
            </div>
          </CardContent>
        </CardUI>
      </CutCornerWrapper>
    </div>
  );
}

