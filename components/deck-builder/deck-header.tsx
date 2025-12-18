"use client";

import { useState, useEffect, useLayoutEffect, useRef, useMemo } from "react";
import { Button } from "@/components/ui/button";
import {
  CardHeader,
} from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { InputWithClear } from "@/components/ui/input-with-clear";
import { Download, Upload, Trash2, Edit, Undo2, Redo2 } from "lucide-react";
import { DECK_MODES } from "@/lib/constants";
import { DeckMode } from "@/types/types";
import { openLoginModal } from "@/lib/helpers";

interface DeckHeaderProps {
  currentDeckName: string;
  user: { id: string } | null;
  deckMode: DeckMode;
  setDeckMode: (mode: DeckMode) => void;
  updateDeckMode: (mode: DeckMode) => void;
  handleExportDeck: () => void;
  importDeck: (jsonData: string) => void;
  clearDeck: () => void;
  renameDeck: (name: string) => void;
  canUndo?: boolean;
  canRedo?: boolean;
  onUndo?: () => void;
  onRedo?: () => void;
}

export function DeckHeader({
  currentDeckName,
  user,
  deckMode,
  setDeckMode,
  updateDeckMode,
  handleExportDeck,
  importDeck,
  clearDeck,
  renameDeck,
  canUndo = false,
  canRedo = false,
  onUndo,
  onRedo,
}: DeckHeaderProps) {
  // Internal state for rename dialog and import
  const [isRenameOpen, setIsRenameOpen] = useState(false);
  const [deckName, setDeckName] = useState(currentDeckName || "");
  const [importText, setImportText] = useState("");

  // Refs for mode selector slider
  const tcgRef = useRef<HTMLButtonElement>(null);
  const masterDuelRef = useRef<HTMLButtonElement>(null);
  const btnRefs = useMemo(
    () => ({
      TCG: tcgRef,
      "Master Duel": masterDuelRef,
    }),
    [],
  );
  const containerRef = useRef<HTMLDivElement>(null);
  const [sliderStyle, setSliderStyle] = useState<React.CSSProperties>({});

  // Sync deckName when rename dialog opens
  useEffect(() => {
    if (isRenameOpen) {
      setDeckName(currentDeckName || "");
    }
  }, [isRenameOpen, currentDeckName]);

  // Calculate mode selector slider position
  useLayoutEffect(() => {
    if (containerRef.current && btnRefs[deckMode]?.current) {
      const containerRect = containerRef.current.getBoundingClientRect();
      const btnRect = btnRefs[deckMode].current.getBoundingClientRect();
      setSliderStyle({
        left: btnRect.left - containerRect.left,
        width: btnRect.width,
      });
    }
  }, [deckMode, btnRefs]);

  const displayName = deckName.length > 40 ? `${deckName.slice(0, 40)}...` : deckName;
  const shouldTruncate = deckName.length > 40;

  return (
    <CardHeader className="pb-2 pt-0 space-y-3">
      {/* First Row: Deck Name with Rename Button */}
      <div className="flex items-center gap-2 w-full min-w-0">
        {shouldTruncate ? (
          <TooltipProvider delayDuration={100} skipDelayDuration={0}>
            <Tooltip>
              <TooltipTrigger asChild>
                <span className="text-xl font-bold text-white truncate cursor-help font-display flex-1 min-w-0">
                  {displayName}
                </span>
              </TooltipTrigger>
              <TooltipContent
                className="max-w-xs"
                side="top"
              >
                <p className="font-medium">{deckName}</p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        ) : (
          <span className="text-xl font-bold text-white font-display flex-1 min-w-0">
            {displayName}
          </span>
        )}
        <Dialog open={isRenameOpen} onOpenChange={setIsRenameOpen}>
          <TooltipProvider delayDuration={100} skipDelayDuration={0}>
            <Tooltip>
              <TooltipTrigger asChild>
                {!user ? (
                  <Button
                    size="icon"
                    variant="ghost"
                    aria-label="Rename deck"
                    onClick={openLoginModal}
                    className="h-8 w-8 flex-shrink-0"
                  >
                    <Edit className="h-4 w-4" />
                  </Button>
                ) : (
                  <DialogTrigger asChild>
                    <Button
                      size="icon"
                      variant="ghost"
                      aria-label="Rename deck"
                      className="h-8 w-8 flex-shrink-0"
                    >
                      <Edit className="h-4 w-4" />
                    </Button>
                  </DialogTrigger>
                )}
              </TooltipTrigger>
              <TooltipContent>
                <p>Rename Deck</p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
          <DialogContent>
            <div className="flex flex-col gap-2">
              <DialogHeader>
                <DialogTitle>Rename Deck</DialogTitle>
                <DialogDescription>
                  Enter a new name for your deck.
                </DialogDescription>
              </DialogHeader>
              <InputWithClear
                value={deckName}
                onChange={(e) => setDeckName(e.target.value)}
                placeholder="Deck name"
                maxLength={40}
                autoFocus
              />
              <DialogFooter>
                <Button
                  onClick={() => {
                    if (
                      deckName.trim() &&
                      deckName.trim() !== currentDeckName
                    ) {
                      renameDeck(deckName.trim());
                    }
                    setIsRenameOpen(false);
                  }}
                >
                  Save
                </Button>
              </DialogFooter>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {/* Second Row: Format Toggle and Deck Actions */}
      <div className="flex items-center justify-between w-full gap-4">
        {/* Format Toggle */}
        <div
          className="relative flex w-fit bg-white/5 border border-white/10 backdrop-blur-xl rounded-lg"
          ref={containerRef}
        >
          <span
            className="absolute top-0 bottom-0 transition-all duration-200 bg-white/10 rounded-lg"
            style={{ ...sliderStyle, zIndex: 0 }}
          />
          {DECK_MODES.map((mode) => (
            <button
              key={mode}
              ref={btnRefs[mode]}
              type="button"
              onClick={() => {
                setDeckMode(mode);
                updateDeckMode(mode);
              }}
              className={`relative z-10 px-3 py-1.5 font-semibold transition-colors duration-200 focus:outline-none font-display text-xs flex items-center justify-center gap-1 ${
                deckMode === mode ? "text-white" : "text-white/60"
              }`}
              aria-pressed={deckMode === mode}
              style={{
                background: "transparent",
                position: "relative",
              }}
            >
              {mode}
            </button>
          ))}
        </div>

        {/* Deck Actions */}
        <TooltipProvider delayDuration={100} skipDelayDuration={0}>
          <div className="flex items-center gap-1">
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => {
                    if (!user) {
                      openLoginModal();
                    } else {
                      handleExportDeck();
                    }
                  }}
                  className="h-8 w-8"
                >
                  <Download className="h-4 w-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>
                <p>Export Deck</p>
              </TooltipContent>
            </Tooltip>

            {!user ? (
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button variant="ghost" size="icon" onClick={openLoginModal} className="h-8 w-8">
                    <Upload className="h-4 w-4" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>
                  <p>Import Deck</p>
                </TooltipContent>
              </Tooltip>
            ) : (
              <Dialog>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <DialogTrigger asChild>
                      <Button variant="ghost" size="icon" className="h-8 w-8">
                        <Upload className="h-4 w-4" />
                      </Button>
                    </DialogTrigger>
                  </TooltipTrigger>
                  <TooltipContent>
                    <p>Import Deck</p>
                  </TooltipContent>
                </Tooltip>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Import Deck</DialogTitle>
                    <DialogDescription>
                      Paste the JSON data of a previously exported deck.
                    </DialogDescription>
                  </DialogHeader>
                  <div className="py-4">
                    <textarea
                      className="w-full h-32 p-2 border rounded-md"
                      placeholder="Paste JSON data here..."
                      value={importText}
                      onChange={(e) => setImportText(e.target.value)}
                    />
                  </div>
                  <DialogFooter>
                    <Button
                      onClick={() => {
                        try {
                          importDeck(importText);
                          setImportText("");
                        } catch (error) {
                          console.error("Failed to import deck:", error);
                        }
                      }}
                      disabled={!importText.trim()}
                    >
                      Import
                    </Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>
            )}

            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => {
                    if (!user) {
                      openLoginModal();
                    } else {
                      clearDeck();
                    }
                  }}
                  className="h-8 w-8"
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>
                <p>Clear Deck</p>
              </TooltipContent>
            </Tooltip>

            {/* Undo/Redo Controls */}
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={onUndo}
                  disabled={!canUndo}
                  className={`h-8 w-8 transition-all ${
                    canUndo ? "text-white/80 hover:text-white" : "text-white/30 opacity-30"
                  }`}
                >
                  <Undo2 className="h-4 w-4" />
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
                  className={`h-8 w-8 transition-all ${
                    canRedo ? "text-white/80 hover:text-white" : "text-white/30 opacity-30"
                  }`}
                >
                  <Redo2 className="h-4 w-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>
                <p>Redo (Ctrl+Shift+Z)</p>
              </TooltipContent>
            </Tooltip>
          </div>
        </TooltipProvider>
      </div>
    </CardHeader>
  );
}

