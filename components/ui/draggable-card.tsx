import { useDraggable } from "@dnd-kit/core";
import type { Card } from "@/types/card";
import DeckCard from "../deck-card";

interface DraggableCardProps {
    id: string;
    card: Card;
    onRemove: () => void;
    disabled?: boolean;
}

export const DraggableCard: React.FC<DraggableCardProps> = ({ id, card, onRemove, disabled }) => {
    const { attributes, listeners, setNodeRef } = useDraggable({ id });

    return (
        <div ref={setNodeRef} {...listeners} {...attributes} aria-disabled={disabled}>
            <DeckCard card={card} onRemove={onRemove} />
        </div>
    );
};
