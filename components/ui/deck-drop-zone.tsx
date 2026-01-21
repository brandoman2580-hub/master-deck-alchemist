import React from "react";
import { useDroppable } from "@dnd-kit/core";
import { cn } from "@/lib/utils";
import { Plus } from "lucide-react";

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
        {isOver && (
          <div className="absolute inset-0 bg-blue-500/30 backdrop-blur-sm z-50 flex items-center justify-center pointer-events-none">
            <div className="bg-white/20 rounded-full p-6 backdrop-blur-md">
              <Plus className="h-16 w-16 text-blue-500" strokeWidth={3} />
            </div>
          </div>
        )}
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
      {isOver && (
        <div className="absolute inset-0 bg-blue-500/30 backdrop-blur-sm z-50 flex items-center justify-center pointer-events-none">
          <div className="bg-white/20 rounded-full p-6 backdrop-blur-md">
            <Plus className="h-16 w-16 text-blue-500" strokeWidth={3} />
          </div>
        </div>
      )}
    </div>
  );
};
