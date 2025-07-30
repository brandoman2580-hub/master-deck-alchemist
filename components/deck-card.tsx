import { X } from "lucide-react";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Card } from "@/types/card";
import Image from "next/image";

interface DeckCardProps {
  card: Card;
  onRemove: () => void;
}

export default function DeckCard({ card, onRemove }: DeckCardProps) {
  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <div className="relative group">
            <Image
              width={80}
              height={120}
              src={card.card_images[0].image_url_small || "/placeholder.svg"}
              alt={card.name}
              className="w-full rounded-lg"
            />
            <button
              onClick={(e) => {
                e.stopPropagation();
                onRemove();
              }}
              className="absolute top-1 right-1 bg-red-500 text-white rounded-full p-1 opacity-0 group-hover:opacity-100 transition-opacity"
              aria-label="Remove card"
            >
              <X className="h-3 w-3" />
            </button>
          </div>
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
            <p className="text-xs mt-1 line-clamp-3">{card.desc}</p>
          </div>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
