"use client";

import type React from "react";
import { useState, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { ChevronUp, ChevronDown, Info } from "lucide-react";
import { Virtuoso } from "react-virtuoso";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogClose,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/types/card";
import Image from "next/image";
import { FilterMenu } from "@/components/ui/filter-menu";
import { useCardStore } from "@/store/cardStore";
import { filterCards } from "@/lib/helpers";
import { InputWithClear } from "@/components/ui/input-with-clear";

export default function CardBrowser() {
  const [loading, setLoading] = useState(false);
  const [selectedCard, setSelectedCard] = useState<Card | null>(null);
  const [filteredCards, setFilteredCards] = useState<Card[]>([]);
  const [searchQuery, setSearchQuery] = useState("");

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
  const cardList = useCardStore((state) => state.cardList);

  useEffect(() => {
    let filtered = cardList;
    if (searchQuery.trim() !== "") {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(
        (card) =>
          card.name.toLowerCase().includes(query) ||
          card.desc.toLowerCase().includes(query) ||
          (card.archetype && card.archetype.toLowerCase().includes(query))
      );
    }
    filtered = filterCards(filtered, searchParams);
    setFilteredCards(filtered);
  }, [searchQuery, cardList, searchParams]);

  const handleSearch = () => {
    setLoading(true);
    try {
      // Optionally, filter by searchQuery first
      let filtered = cardList;
      if (searchQuery.trim() !== "") {
        const query = searchQuery.toLowerCase();
        filtered = filtered.filter(
          (card) =>
            card.name.toLowerCase().includes(query) ||
            card.desc.toLowerCase().includes(query) ||
            (card.archetype && card.archetype.toLowerCase().includes(query))
        );
      }
      filtered = filterCards(filtered, searchParams);
      setFilteredCards(filtered);
    } catch (error) {
      console.error("Error filtering cards:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    // Only fetch when actual search params change (not on every keystroke in searchQuery)
    handleSearch();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams]);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setSearchParams((prev) => ({ ...prev, [name]: value }));
  };

  const handleSelectChange = (name: string, value: string) => {
    setSearchParams((prev) => ({ ...prev, [name]: value }));
  };

  const handleSort = (field: string) => {
    setSearchParams((prev) => ({
      ...prev,
      sort: field,
      sortDirection:
        prev.sort === field && prev.sortDirection === "asc" ? "desc" : "asc",
    }));
    handleSearch();
  };

  const renderCardRow = useCallback(
    (index: number) => {
      const card = filteredCards[index];
      return (
        <div
          className="grid grid-cols-[80px_1fr_100px_100px_100px_120px] gap-2 p-2 border-b hover:bg-accent/10 items-center"
          key={card.id}
        >
          <div className="flex items-center">
            <Image
              width={80}
              height={120}
              src={card.card_images[0].image_url_small || "/placeholder.svg"}
              alt={card.name}
              className="w-16 h-auto object-contain"
              loading="lazy"
            />
          </div>
          <div className="flex flex-col">
            <span className="font-medium truncate">{card.name}</span>
            <div className="flex flex-wrap gap-1 mt-1">
              <Badge variant="outline" className="text-xs">
                {card.type}
              </Badge>
              {card.race && (
                <Badge variant="outline" className="text-xs">
                  {card.race}
                </Badge>
              )}
              {card.attribute && (
                <Badge variant="outline" className="text-xs">
                  {card.attribute}
                </Badge>
              )}
            </div>
          </div>
          <div className="text-center">
            {card.level !== undefined ? card.level : "-"}
          </div>
          <div className="text-center">
            {card.atk !== undefined ? card.atk : "-"}
          </div>
          <div className="text-center">
            {card.def !== undefined ? card.def : "-"}
          </div>
          <div className="flex justify-end gap-2">
            <Dialog>
              <DialogTrigger asChild>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setSelectedCard(card)}
                >
                  <Info className="h-4 w-4" />
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-md">
                {selectedCard && (
                  <>
                    <DialogHeader>
                      <DialogTitle>{selectedCard.name}</DialogTitle>
                      <DialogDescription>
                        {selectedCard.type} • {selectedCard.race}
                        {selectedCard.attribute &&
                          ` • ${selectedCard.attribute}`}
                      </DialogDescription>
                    </DialogHeader>
                    <div className="flex flex-col sm:flex-row gap-4">
                      <Image
                        width={80}
                        height={120}
                        src={
                          selectedCard.card_images[0].image_url ||
                          "/placeholder.svg"
                        }
                        alt={selectedCard.name}
                        className="w-full sm:w-1/3 object-contain"
                      />
                      <div className="flex-1 space-y-2">
                        <p className="text-sm">{selectedCard.desc}</p>
                        {selectedCard.atk !== undefined && (
                          <p className="text-sm">
                            <span className="font-medium">ATK/DEF:</span>{" "}
                            {selectedCard.atk} / {selectedCard.def}
                          </p>
                        )}
                        {selectedCard.level !== undefined && (
                          <p className="text-sm">
                            <span className="font-medium">Level:</span>{" "}
                            {selectedCard.level}
                          </p>
                        )}
                        {selectedCard.archetype && (
                          <p className="text-sm">
                            <span className="font-medium">Archetype:</span>{" "}
                            {selectedCard.archetype}
                          </p>
                        )}
                      </div>
                    </div>
                    <div className="flex justify-end gap-2 mt-4">
                      <DialogClose asChild>
                        <Button variant="outline">Close</Button>
                      </DialogClose>
                    </div>
                  </>
                )}
              </DialogContent>
            </Dialog>
          </div>
        </div>
      );
    },
    [filteredCards, selectedCard]
  );

  const TableHeader = () => (
    <div className="grid grid-cols-[80px_1fr_100px_100px_100px_120px] gap-2 p-2 font-medium bg-background border-b sticky top-0 z-10">
      <div>Image</div>
      <div
        className="flex items-center cursor-pointer"
        onClick={() => handleSort("name")}
      >
        Name
        {searchParams.sort === "name" && (
          <span className="ml-1">
            {searchParams.sortDirection === "asc" ? (
              <ChevronUp size={14} />
            ) : (
              <ChevronDown size={14} />
            )}
          </span>
        )}
      </div>
      <div
        className="text-center cursor-pointer"
        onClick={() => handleSort("level")}
      >
        Level
        {searchParams.sort === "level" && (
          <span className="ml-1">
            {searchParams.sortDirection === "asc" ? (
              <ChevronUp size={14} />
            ) : (
              <ChevronDown size={14} />
            )}
          </span>
        )}
      </div>
      <div
        className="text-center cursor-pointer"
        onClick={() => handleSort("atk")}
      >
        ATK
        {searchParams.sort === "atk" && (
          <span className="ml-1">
            {searchParams.sortDirection === "asc" ? (
              <ChevronUp size={14} />
            ) : (
              <ChevronDown size={14} />
            )}
          </span>
        )}
      </div>
      <div
        className="text-center cursor-pointer"
        onClick={() => handleSort("def")}
      >
        DEF
        {searchParams.sort === "def" && (
          <span className="ml-1">
            {searchParams.sortDirection === "asc" ? (
              <ChevronUp size={14} />
            ) : (
              <ChevronDown size={14} />
            )}
          </span>
        )}
      </div>
      <div className="text-right">Actions</div>
    </div>
  );

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="flex flex-col space-y-4">
        <div className="flex items-center justify-between">
          <h1 className="text-3xl font-bold">Card Browser</h1>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-[1fr_300px] gap-6">
          <div className="space-y-4">
            <div className="flex gap-2 sticky top-0 z-20 bg-background pt-2 pb-4">
              <div className="flex-1">
                <InputWithClear
                  placeholder="Search cards..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  onClear={() => setSearchQuery("")}
                  className="w-full"
                />
              </div>
            </div>

            <div className="flex items-center justify-between sticky top-14 z-20 bg-background pb-2">
              <p className="text-sm text-muted-foreground">
                {loading
                  ? "Searching..."
                  : `Found ${filteredCards.length} cards`}
              </p>
              <FilterMenu
                searchParams={searchParams}
                setSearchParams={setSearchParams}
                setSearchQuery={setSearchQuery}
                handleSelectChange={handleSelectChange}
                handleInputChange={handleInputChange}
              />
            </div>

            <div className="h-[calc(100vh-20rem)] border rounded-md overflow-hidden">
              {filteredCards.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-full">
                  <p className="text-muted-foreground">No cards found</p>
                  <p className="text-sm text-muted-foreground">
                    Try adjusting your search filters
                  </p>
                </div>
              ) : (
                <Virtuoso
                  style={{ height: "100%" }}
                  totalCount={filteredCards.length}
                  itemContent={renderCardRow}
                  components={{
                    Header: TableHeader,
                  }}
                />
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
