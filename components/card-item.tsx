"use client";

import { useMemo, useState } from "react";
import { useDraggable } from "@dnd-kit/core";
import { CSS } from "@dnd-kit/utilities";
import { Button } from "./ui/button";
import { Badge } from "./ui/badge";
import { Plus, Info } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogClose,
} from "./ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "./ui/dropdown-menu";
import { Card } from "../types/card";
import Image from "next/image";
import { getArchetypeName } from "../lib/helpers";

interface CardItemProps {
  isBeingDragged: boolean;
  card: Card;
  onAddToMainDeck: () => void;
  onAddToExtraDeck: () => void;
  onAddToSideDeck: () => void;
  isExtraDeckCard: boolean;
  addToMainDisabled?: boolean;
  addToExtraDisabled?: boolean;
  addToSideDisabled?: boolean;
  remainingCopies?: number;
}

export default function CardItem({
  isBeingDragged,
  card,
  onAddToMainDeck,
  onAddToExtraDeck,
  onAddToSideDeck,
  isExtraDeckCard,
  addToMainDisabled,
  addToExtraDisabled,
  addToSideDisabled,
  remainingCopies,
}: CardItemProps) {
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const disabled = addToMainDisabled || addToExtraDisabled || addToSideDisabled;

  const dragInstanceId = useMemo(() => `browser-${card.id}`, [card.id]);

  const { attributes, listeners, setNodeRef, transform } = useDraggable({
    id: dragInstanceId, // Stable ID based on card ID
    data: { cardId: card.id, type: 'browser' }, // Store the actual card id and type for lookup
    disabled: disabled,
  });
  const style = transform
    ? {
        transform: CSS.Transform.toString(transform),
      }
    : undefined;

  return (
    <>
      <div className={`p-2 border-b hover:bg-accent/10 ${isBeingDragged ? 'opacity-50' : ''}`}>
        <div className="flex gap-3">
          <div
            ref={setNodeRef}
            style={style}
            {...listeners}
            {...attributes}
            className="w-12 h-18 flex-shrink-0 cursor-grab active:cursor-grabbing"
          >
            <Image
              width={80}
              height={120}
              src={card.card_images[0].image_url_small || "/placeholder.svg"}
              alt={card.name}
              className={`w-full h-auto object-contain ${
                disabled ? "opacity-60" : ""
              } ${isBeingDragged ? "opacity-30" : ""}`}
            />
          </div>

          <div className="flex-1 min-w-0">
            <h4 className="font-medium text-sm truncate">{card.name}</h4>
            <div className="flex flex-wrap gap-1 mt-1">
              <Badge variant="outline" className="text-xs">
                {card.type}
              </Badge>
              {card.attribute && (
                <Badge variant="outline" className="text-xs">
                  {card.attribute}
                </Badge>
              )}
              {remainingCopies !== undefined && (
                <Badge variant="secondary" className="text-xs">
                  {remainingCopies} left
                </Badge>
              )}
            </div>
            <p className="text-xs text-muted-foreground mt-1 line-clamp-2">
              {card.desc}
            </p>
          </div>

          <div className="flex flex-col gap-1 ml-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setIsDialogOpen(true)}
            >
              <Info className="h-4 w-4" />
            </Button>

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button disabled={disabled} variant="default" size="sm">
                  <Plus className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                {!isExtraDeckCard && (
                  <DropdownMenuItem onClick={onAddToMainDeck}>
                    Add to Main Deck
                  </DropdownMenuItem>
                )}
                {isExtraDeckCard && (
                  <DropdownMenuItem onClick={onAddToExtraDeck}>
                    Add to Extra Deck
                  </DropdownMenuItem>
                )}
                <DropdownMenuItem onClick={onAddToSideDeck}>
                  Add to Side Deck
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      </div>

      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{card.name}</DialogTitle>
            <DialogDescription>
              {card.type} • {card.race}
              {card.attribute && ` • ${card.attribute}`}
            </DialogDescription>
          </DialogHeader>
          <div className="flex flex-col sm:flex-row gap-4">
            <Image
              width={80}
              height={120}
              src={card.card_images[0].image_url || "/placeholder.svg"}
              alt={card.name}
              className="w-full sm:w-1/3 object-contain"
            />
            <div className="flex-1 space-y-2">
              <p className="text-sm">{card.desc}</p>
              {card.atk !== undefined && (
                <p className="text-sm">
                  <span className="font-medium">ATK/DEF:</span> {card.atk} /{" "}
                  {card.def}
                </p>
              )}
              {card.level !== undefined && (
                <p className="text-sm">
                  <span className="font-medium">Level:</span> {card.level}
                </p>
              )}
              {(() => {
                const archetypeName = getArchetypeName(card);
                return archetypeName ? (
                  <p className="text-sm">
                    <span className="font-medium">Archetype:</span>{" "}
                    {archetypeName}
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
                <Button disabled={disabled}>
                  <Plus className="h-4 w-4 mr-2" />
                  Add to Deck
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent>
                {!isExtraDeckCard && (
                  <DropdownMenuItem onClick={onAddToMainDeck}>
                    Add to Main Deck
                  </DropdownMenuItem>
                )}
                {isExtraDeckCard && (
                  <DropdownMenuItem onClick={onAddToExtraDeck}>
                    Add to Extra Deck
                  </DropdownMenuItem>
                )}
                <DropdownMenuItem onClick={onAddToSideDeck}>
                  Add to Side Deck
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
