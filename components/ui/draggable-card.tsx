import { useDraggable } from "@dnd-kit/core";
import type { Card } from "@/types/card";
import DeckCard from "../deck-card";

interface DraggableCardProps {
    card: Card;
    onRemove: () => void;
    disabled?: boolean;
}

export const DraggableCard: React.FC<DraggableCardProps> = ({ card, onRemove, disabled }) => {
    const { attributes, listeners, setNodeRef } = useDraggable({ id: card.id });

    return (
        <div ref={setNodeRef} {...listeners} {...attributes} aria-disabled={disabled}>
            <DeckCard card={card} onRemove={onRemove} />
        </div>
    );
};
