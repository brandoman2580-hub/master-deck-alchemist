"use client"

import { useDeck } from "../context/deck-context.tsx"
import { useState } from "react"
import { Card, CardContent } from "./ui/card.tsx"
import { Button } from "./ui/button.tsx"
import { Plus, Info } from "lucide-react"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogClose,
} from "./ui/dialog.tsx"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "./ui/dropdown-menu.tsx"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "./ui/tooltip.tsx"
import { Card as CardType } from "../types/card.ts"
import Image from "next/image"
import { getArchetypeName } from "../lib/helpers.ts"

export default function CardGrid({ cards }: { cards: CardType[] }) {
  const { addCardToDeck } = useDeck()
  const [selectedCard, setSelectedCard] = useState<CardType | null>(null)

  if (cards.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-64 border rounded-lg bg-card">
        <p className="text-muted-foreground">No cards found</p>
        <p className="text-sm text-muted-foreground">Try adjusting your search filters</p>
      </div>
    )
  }

  const isExtraDeckCard = (card: CardType) => {
    // Check for Extra Deck monster types (case-insensitive check for all variations)
    const type = card.type.toLowerCase();
    return (
      type.includes("fusion") ||
      type.includes("synchro") ||
      type.includes("xyz") ||
      type.includes("link")
    );
  }

  const handleAddToDeck = (card: CardType, deckType: "mainDeck" | "extraDeck" | "sideDeck") => {
    addCardToDeck(card, deckType)
  }

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
      {cards.map((card) => (
        <TooltipProvider key={card.id}>
          <Tooltip>
            <TooltipTrigger asChild>
              <Card className="overflow-hidden hover:shadow-md transition-shadow">
                <CardContent className="p-0 relative group">
                  <Image
                    width={80}
                    height={120}
                    src={card.card_images[0].image_url_small || "/placeholder.svg"}
                    alt={card.name}
                    className="w-full h-auto object-cover"
                    loading="lazy"
                  />
                  <div className="absolute inset-0 bg-black/70 opacity-0 group-hover:opacity-100 transition-opacity flex flex-col justify-between p-2">
                    <div className="text-xs text-white font-medium truncate">{card.name}</div>
                    <div className="flex justify-between items-center">
                      <Dialog>
                        <DialogTrigger asChild>
                          <Button variant="secondary" size="sm" className="h-7" onClick={() => setSelectedCard(card)}>
                            <Info className="h-3 w-3 mr-1" />
                            Details
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
                                      <span className="font-medium">ATK/DEF:</span> {selectedCard.atk} /{" "}
                                      {selectedCard.def}
                                    </p>
                                  )}
                                  {selectedCard.level !== undefined && (
                                    <p className="text-sm">
                                      <span className="font-medium">Level:</span> {selectedCard.level}
                                    </p>
                                  )}
                                  {(() => {
                                    const archetypeName = getArchetypeName(selectedCard);
                                    return archetypeName ? (
                                      <p className="text-sm">
                                        <span className="font-medium">Archetype:</span> {archetypeName}
                                      </p>
                                    ) : null;
                                  })()}
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
                                        handleAddToDeck(
                                          selectedCard,
                                          isExtraDeckCard(selectedCard) ? "extraDeck" : "mainDeck",
                                        )
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
                          <Button variant="default" size="sm" className="h-7">
                            <Plus className="h-3 w-3 mr-1" />
                            Add
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent>
                          <DropdownMenuItem
                            onClick={() => handleAddToDeck(card, isExtraDeckCard(card) ? "extraDeck" : "mainDeck")}
                          >
                            Add to {isExtraDeckCard(card) ? "Extra" : "Main"} Deck
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => handleAddToDeck(card, "sideDeck")}>
                            Add to Side Deck
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </TooltipTrigger>
            <TooltipContent side="top" className="max-w-xs">
              <div className="space-y-1">
                <p className="font-medium">{card.name}</p>
                <p className="text-xs">{card.type}</p>
                {card.atk !== undefined && (
                  <p className="text-xs">
                    ATK: {card.atk} / DEF: {card.def}
                  </p>
                )}
              </div>
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
      ))}
    </div>
  )
}
