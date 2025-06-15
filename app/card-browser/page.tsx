"use client"

import type React from "react"
import { useState, useEffect, useCallback } from "react"
import { searchCards, getCardTypes, getCardRaces, getCardAttributes } from "@/lib/api"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Label } from "@/components/ui/label"
import { Loader2, Search, SlidersHorizontal, ChevronUp, ChevronDown, Plus, Info } from "lucide-react"
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet"
import { Virtuoso } from "react-virtuoso"
import { useDeck } from "@/context/deck-context"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogClose,
} from "@/components/ui/dialog"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import { Badge } from "@/components/ui/badge"
import { Card } from "@/types/card"
import Image from "next/image"

export default function CardBrowser() {
  const [cards, setCards] = useState<Card[]>([])
  const [loading, setLoading] = useState(false)
  const [cardTypes, setCardTypes] = useState<string[]>([])
  const [cardRaces, setCardRaces] = useState<string[]>([])
  const [archetypes, setArchetypes] = useState<string[]>([])
  const [selectedCard, setSelectedCard] = useState<Card | null>(null)
  const { addCardToDeck } = useDeck()

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
  })

  const handleSearch = useCallback(async () => {
    setLoading(true)
    try {
      const results = await searchCards(searchParams)
      setCards(results)
    } catch (error) {
      console.error("Error searching cards:", error)
    } finally {
      setLoading(false)
    }
  }, [searchParams, setLoading, setCards])

  useEffect(() => {
    // Load filter options
    const loadFilterOptions = async () => {
      const types = await getCardTypes()
      const races = await getCardRaces()
      const archetypes = await getCardAttributes()

      setCardTypes(types)
      setCardRaces(races)
      setArchetypes(archetypes)
    }

    loadFilterOptions()

    // Initial search with empty params to show some cards
    handleSearch()
  }, [handleSearch])

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target
    setSearchParams((prev) => ({ ...prev, [name]: value }))
  }

  const handleSelectChange = (name: string, value: string) => {
    setSearchParams((prev) => ({ ...prev, [name]: value }))
  }

  const handleReset = () => {
    setSearchParams({
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
      sortDirection: "asc",
    })
  }

  const handleSort = (field: string) => {
    setSearchParams((prev) => ({
      ...prev,
      sort: field,
      sortDirection: prev.sort === field && prev.sortDirection === "asc" ? "desc" : "asc",
    }))
    handleSearch()
  }

  const isExtraDeckCard = (card: Card) => {
    return (
      card.type.includes("Fusion") ||
      card.type.includes("Synchro") ||
      card.type.includes("Xyz") ||
      card.type.includes("Link")
    )
  }

  const handleAddToDeck = useCallback(
    (card: Card, deckType: "mainDeck" | "extraDeck" | "sideDeck") => {
      addCardToDeck(card, deckType)
    },
    [addCardToDeck]
  )

  const renderCardRow = useCallback(
    (index: number) => {
      const card = cards[index]
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
          <div className="text-center">{card.level !== undefined ? card.level : "-"}</div>
          <div className="text-center">{card.atk !== undefined ? card.atk : "-"}</div>
          <div className="text-center">{card.def !== undefined ? card.def : "-"}</div>
          <div className="flex justify-end gap-2">
            <Dialog>
              <DialogTrigger asChild>
                <Button variant="ghost" size="sm" onClick={() => setSelectedCard(card)}>
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
                        {selectedCard.attribute && ` • ${selectedCard.attribute}`}
                      </DialogDescription>
                    </DialogHeader>
                    <div className="flex flex-col sm:flex-row gap-4">
                      <Image
                        width={80}
                        height={120}
                        src={selectedCard.card_images[0].image_url || "/placeholder.svg"}
                        alt={selectedCard.name}
                        className="w-full sm:w-1/3 object-contain"
                      />
                      <div className="flex-1 space-y-2">
                        <p className="text-sm">{selectedCard.desc}</p>
                        {selectedCard.atk !== undefined && (
                          <p className="text-sm">
                            <span className="font-medium">ATK/DEF:</span> {selectedCard.atk} / {selectedCard.def}
                          </p>
                        )}
                        {selectedCard.level !== undefined && (
                          <p className="text-sm">
                            <span className="font-medium">Level:</span> {selectedCard.level}
                          </p>
                        )}
                        {selectedCard.archetype && (
                          <p className="text-sm">
                            <span className="font-medium">Archetype:</span> {selectedCard.archetype}
                          </p>
                        )}
                      </div>
                    </div>
                    <div className="flex justify-end gap-2 mt-4">
                      <DialogClose asChild>
                        <Button variant="outline">Close</Button>
                      </DialogClose>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button>
                            <Plus className="h-4 w-4 mr-2" />
                            Add to Deck
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent>
                          <DropdownMenuItem
                            onClick={() =>
                              handleAddToDeck(selectedCard, isExtraDeckCard(selectedCard) ? "extraDeck" : "mainDeck")
                            }
                          >
                            Add to {isExtraDeckCard(selectedCard) ? "Extra" : "Main"} Deck
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => handleAddToDeck(selectedCard, "sideDeck")}>
                            Add to Side Deck
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                  </>
                )}
              </DialogContent>
            </Dialog>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="default" size="sm">
                  <Plus className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent>
                <DropdownMenuItem
                  onClick={() => handleAddToDeck(card, isExtraDeckCard(card) ? "extraDeck" : "mainDeck")}
                >
                  Add to {isExtraDeckCard(card) ? "Extra" : "Main"} Deck
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => handleAddToDeck(card, "sideDeck")}>Add to Side Deck</DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      )
    },
    [cards, selectedCard, handleAddToDeck],
  )

  const TableHeader = () => (
    <div className="grid grid-cols-[80px_1fr_100px_100px_100px_120px] gap-2 p-2 font-medium bg-background border-b sticky top-0 z-10">
      <div>Image</div>
      <div className="flex items-center cursor-pointer" onClick={() => handleSort("name")}>
        Name
        {searchParams.sort === "name" && (
          <span className="ml-1">
            {searchParams.sortDirection === "asc" ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
          </span>
        )}
      </div>
      <div className="text-center cursor-pointer" onClick={() => handleSort("level")}>
        Level
        {searchParams.sort === "level" && (
          <span className="ml-1">
            {searchParams.sortDirection === "asc" ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
          </span>
        )}
      </div>
      <div className="text-center cursor-pointer" onClick={() => handleSort("atk")}>
        ATK
        {searchParams.sort === "atk" && (
          <span className="ml-1">
            {searchParams.sortDirection === "asc" ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
          </span>
        )}
      </div>
      <div className="text-center cursor-pointer" onClick={() => handleSort("def")}>
        DEF
        {searchParams.sort === "def" && (
          <span className="ml-1">
            {searchParams.sortDirection === "asc" ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
          </span>
        )}
      </div>
      <div className="text-right">Actions</div>
    </div>
  )

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="flex flex-col space-y-4">
        <div className="flex items-center justify-between">
          <h1 className="text-3xl font-bold">Card Browser</h1>
          <Sheet>
            <SheetTrigger asChild>
              <Button variant="outline" className="md:hidden">
                <SlidersHorizontal className="h-4 w-4 mr-2" />
                Filters
              </Button>
            </SheetTrigger>
            <SheetContent side="right">
              <SheetHeader>
                <SheetTitle>Search Filters</SheetTitle>
                <SheetDescription>Refine your card search with these filters</SheetDescription>
              </SheetHeader>
              <div className="grid gap-4 py-4">{renderFilters()}</div>
            </SheetContent>
          </Sheet>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-[1fr_300px] gap-6">
          <div className="space-y-4">
            <div className="flex gap-2 sticky top-0 z-20 bg-background pt-2 pb-4">
              <div className="flex-1">
                <Input
                  placeholder="Search card name..."
                  name="name"
                  value={searchParams.name}
                  onChange={handleInputChange}
                  className="w-full"
                />
              </div>
              <Button onClick={handleSearch} disabled={loading}>
                {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
                <span className="ml-2 hidden sm:inline">Search</span>
              </Button>
            </div>

            <div className="flex items-center justify-between sticky top-14 z-20 bg-background pb-2">
              <p className="text-sm text-muted-foreground">
                {loading ? "Searching..." : `Found ${cards.length} cards`}
              </p>
            </div>

            <div className="h-[calc(100vh-220px)] border rounded-md overflow-hidden">
              {cards.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-full">
                  <p className="text-muted-foreground">No cards found</p>
                  <p className="text-sm text-muted-foreground">Try adjusting your search filters</p>
                </div>
              ) : (
                <Virtuoso
                  style={{ height: "100%" }}
                  totalCount={cards.length}
                  itemContent={renderCardRow}
                  components={{
                    Header: TableHeader,
                  }}
                />
              )}
            </div>
          </div>

          <div className="hidden md:block space-y-6 bg-card p-6 rounded-lg border">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-medium">Filters</h3>
              <Button variant="ghost" size="sm" onClick={handleReset}>
                Reset
              </Button>
            </div>
            {renderFilters()}
          </div>
        </div>
      </div>
    </div>
  )

  function renderFilters() {
    return (
      <>
        <div className="space-y-2">
          <Label htmlFor="effect">Effect Text</Label>
          <Input
            id="effect"
            name="effect"
            placeholder="Search card effects..."
            value={searchParams.effect}
            onChange={handleInputChange}
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="type">Card Type</Label>
          <Select value={searchParams.type} onValueChange={(value: string) => handleSelectChange("type", value)}>
            <SelectTrigger id="type">
              <SelectValue placeholder="Select type" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="any">Any</SelectItem>
              {cardTypes.map((type) => (
                <SelectItem key={type} value={type}>
                  {type}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <Label htmlFor="race">Monster Type</Label>
          <Select value={searchParams.race} onValueChange={(value: string) => handleSelectChange("race", value)}>
            <SelectTrigger id="race">
              <SelectValue placeholder="Select monster type" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="any">Any</SelectItem>
              {cardRaces.map((race) => (
                <SelectItem key={race} value={race}>
                  {race}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <Label htmlFor="attribute">Attribute</Label>
          <Select value={searchParams.attribute} onValueChange={(value: string) => handleSelectChange("attribute", value)}>
            <SelectTrigger id="attribute">
              <SelectValue placeholder="Select attribute" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="any">Any</SelectItem>
              <SelectItem value="DARK">DARK</SelectItem>
              <SelectItem value="LIGHT">LIGHT</SelectItem>
              <SelectItem value="EARTH">EARTH</SelectItem>
              <SelectItem value="WATER">WATER</SelectItem>
              <SelectItem value="FIRE">FIRE</SelectItem>
              <SelectItem value="WIND">WIND</SelectItem>
              <SelectItem value="DIVINE">DIVINE</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <Label htmlFor="archetype">Archetype</Label>
          <Select value={searchParams.archetype} onValueChange={(value: string) => handleSelectChange("archetype", value)}>
            <SelectTrigger id="archetype">
              <SelectValue placeholder="Select archetype" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="any">Any</SelectItem>
              {archetypes.map((archetype) => (
                <SelectItem key={archetype} value={archetype}>
                  {archetype}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <Label htmlFor="level">Level/Rank</Label>
          <Select value={searchParams.level} onValueChange={(value: string) => handleSelectChange("level", value)}>
            <SelectTrigger id="level">
              <SelectValue placeholder="Select level" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="any">Any</SelectItem>
              {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12].map((level) => (
                <SelectItem key={level} value={level.toString()}>
                  {level}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="pt-4">
          <Button onClick={handleSearch} className="w-full" disabled={loading}>
            {loading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Search className="h-4 w-4 mr-2" />}
            Apply Filters
          </Button>
        </div>
      </>
    )
  }
}
