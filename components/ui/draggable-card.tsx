import { useDraggable } from "@dnd-kit/core";
import { CSS } from "@dnd-kit/utilities";
import type { Card } from "@/types/card";
import DeckCard from "../deck-card";

interface DraggableCardProps {
  id: string; // Should be deckInstanceId
  card: Card;
  onRemove: () => void;
  disabled?: boolean;
}

export const DraggableCard: React.FC<DraggableCardProps> = ({ id, card, onRemove, disabled }) => {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id,
    data: { type: "deck", deckInstanceId: id },
    disabled,
  });

  const style = transform ? { transform: CSS.Transform.toString(transform) } : undefined;

  return (
    <div
      ref={setNodeRef}
      {...listeners}
      {...attributes}
      style={style}
      className={`cursor-grab active:cursor-grabbing ${isDragging ? "opacity-50" : ""}`}
      aria-disabled={disabled}
    >
      <DeckCard card={card} onRemove={onRemove} />
    </div>
  );
};
