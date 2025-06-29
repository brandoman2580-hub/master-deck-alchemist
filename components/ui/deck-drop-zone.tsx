import React from "react";
import { useDroppable } from "@dnd-kit/core";

interface DeckDropZoneProps {
  id: string;
  children: React.ReactNode;
  isEmpty?: boolean;
}

export const DeckDropZone: React.FC<DeckDropZoneProps> = ({
  id,
  children,
  isEmpty = false,
}) => {
  const { setNodeRef, isOver } = useDroppable({ id });

  return (
    <div
      ref={setNodeRef}
      id={id}
      className={`
        w-full h-full min-h-[300px] transition
        border-2 border-dashed rounded-lg p-4
        ${isEmpty
          ? "flex items-center justify-center"
          : "flex flex-wrap items-start justify-start gap-2"}
        ${isOver ? "bg-blue-100 border-blue-400" : ""}
      `}
      style={{ position: "relative" }}
    >
      {children}
      {/* Optional: Overlay for visual feedback */}
      {isOver && (
        <div className="absolute inset-0 pointer-events-none bg-blue-100 opacity-50 rounded-lg" />
      )}
    </div>
  );
};
