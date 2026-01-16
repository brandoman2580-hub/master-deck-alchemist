import React from "react";
import { useDroppable } from "@dnd-kit/core";
import { cn } from "@/lib/utils";

interface DeckDropZoneProps {
  id: string;
  children: React.ReactNode;
  isEmpty?: boolean;
  className?: string;
}

export const DeckDropZone: React.FC<DeckDropZoneProps> = ({
  id,
  children,
  isEmpty = false,
  className,
}) => {
  const { setNodeRef, isOver } = useDroppable({ id });

  // Special handling for card browser - don't apply grid layout
  const isCardBrowser = id === "card-browser";

  if (isCardBrowser) {
    return (
      <div
        ref={setNodeRef}
        id={id}
        className={cn("w-full h-full min-h-[300px] transition-all duration-150 relative flex flex-col", className)}
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
      className={`w-full h-full min-h-[300px] transition-all duration-200 ${
        isEmpty ? "flex items-center justify-center" : "relative"
      } ${
        isOver
          ? "bg-cyan-500/15 ring-2 ring-cyan-400/50 ring-offset-2 ring-offset-transparent"
          : ""
      }`}
      style={{ position: "relative" }}
    >
      {children}
    </div>
  );
};
