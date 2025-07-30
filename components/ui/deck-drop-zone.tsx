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

  // Special handling for card browser - don't apply grid layout
  const isCardBrowser = id === "card-browser";

  return (
    <div
      ref={setNodeRef}
      id={id}
      className={`
        w-full h-full min-h-[300px] transition
        ${isCardBrowser ? "" : "border-2 border-dashed rounded-lg p-4"}
        ${isEmpty
          ? "flex items-center justify-center"
          : "relative"}
        ${isOver ? "bg-blue-100 border-blue-400" : isCardBrowser ? "" : "border-gray-300"}
      `}
      style={{ position: "relative" }}
    >
      {children}
    </div>
  );
};
