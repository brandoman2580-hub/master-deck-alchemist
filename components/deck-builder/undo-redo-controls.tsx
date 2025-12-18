"use client";

import { Button } from "@/components/ui/button";
import { Undo2, Redo2 } from "lucide-react";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

interface UndoRedoControlsProps {
  canUndo: boolean;
  canRedo: boolean;
  onUndo: () => void;
  onRedo: () => void;
}

/**
 * Phase 3: Visible undo/redo controls
 * - Obvious and instant
 * - Keyboard shortcuts (Ctrl+Z, Ctrl+Shift+Z)
 */
export function UndoRedoControls({
  canUndo,
  canRedo,
  onUndo,
  onRedo,
}: UndoRedoControlsProps) {
  return (
    <TooltipProvider>
      <div className="flex items-center gap-1">
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              onClick={onUndo}
              disabled={!canUndo}
              className={`h-7 w-7 text-muted-50/40 hover:text-cyan-300 hover:bg-cyan-500/10 transition-all ${
                canUndo ? "text-cyan-400/60" : "opacity-30"
              }`}
            >
              <Undo2 className="h-3.5 w-3.5" />
            </Button>
          </TooltipTrigger>
          <TooltipContent>
            <p>Undo (Ctrl+Z)</p>
          </TooltipContent>
        </Tooltip>

        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              onClick={onRedo}
              disabled={!canRedo}
              className={`h-7 w-7 text-muted-50/40 hover:text-cyan-300 hover:bg-cyan-500/10 transition-all ${
                canRedo ? "text-cyan-400/60" : "opacity-30"
              }`}
            >
              <Redo2 className="h-3.5 w-3.5" />
            </Button>
          </TooltipTrigger>
          <TooltipContent>
            <p>Redo (Ctrl+Shift+Z)</p>
          </TooltipContent>
        </Tooltip>
      </div>
    </TooltipProvider>
  );
}

