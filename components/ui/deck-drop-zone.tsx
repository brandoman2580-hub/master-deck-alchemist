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
  const { setNodeRef } = useDroppable({ id });

  return (
    <div
      ref={setNodeRef}
      id={id}
      className={`
        w-full h-full min-h-[300px]
        border-2 border-dashed rounded-lg p-4
        ${isEmpty
          ? "flex items-center justify-center"
          : "flex flex-wrap items-start justify-start gap-2"}
      `}
    >
      {children}
    </div>
  );
};

