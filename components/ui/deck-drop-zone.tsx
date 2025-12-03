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

  if (isCardBrowser) {
    return (
      <div
        ref={setNodeRef}
        id={id}
        className="w-full h-full min-h-[300px] transition-all duration-150 relative"
        style={{ position: "relative" }}
      >
        {children}
      </div>
    );
  }

  return (
    <div
      ref={setNodeRef}
      id={id}
      className={`w-full h-full min-h-[300px] transition-all duration-150 ${
        isEmpty
          ? "flex items-center justify-center"
          : "relative"
      } ${
        isOver 
          ? "bg-cyan-500/10 scale-[1.01]" 
          : "bg-cyb-800/20"
      }`}
      style={{ position: "relative" }}
    >
      {children}
    </div>
  );
};
