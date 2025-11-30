import { X } from "lucide-react";
import { CardPreview } from "./ui/card-preview";
import { Card } from "../types/card.ts";
import Image from "next/image";

interface DeckCardProps {
  card: Card;
  onRemove: () => void;
}

export default function DeckCard({ card, onRemove }: DeckCardProps) {
  return (
    <CardPreview card={card}>
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
    </CardPreview>
  );
}
