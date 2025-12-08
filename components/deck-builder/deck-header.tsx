// NOTE: extracted from app/deck-builder/page.tsx
"use client";

import { useState, useEffect, useLayoutEffect, useRef, useMemo } from "react";
import { Button } from "@/components/ui/button";
import {
  CardHeader,
  CardDescription,
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
import { Download, Upload, Trash2, Edit } from "lucide-react";
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

  const displayName = deckName.length > 8 ? `${deckName.slice(0, 8)}...` : deckName;
  const shouldTruncate = deckName.length > 8;

  return (
    <CardHeader className="pb-2">
      <div className="flex items-center justify-between w-full">
        <div className="flex items-center gap-2">
          {shouldTruncate ? (
            <TooltipProvider delayDuration={100} skipDelayDuration={0}>
              <Tooltip>
                <TooltipTrigger asChild>
                  <span className="text-xl font-bold text-white truncate cursor-help font-display">
                    {displayName}
                  </span>
                </TooltipTrigger>
                <TooltipContent
                  className="text-white shadow-[0_0_20px_rgba(56,189,248,0.25)] max-w-xs"
                  side="top"
                >
                  <p className="font-medium">{deckName}</p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          ) : (
            <span className="text-xl font-bold text-white font-display">
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
                    >
                      <Edit className="h-5 w-5" />
                    </Button>
                  ) : (
                    <DialogTrigger asChild>
                      <Button
                        size="icon"
                        variant="ghost"
                        aria-label="Rename deck"
                      >
                        <Edit className="h-5 w-5" />
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
            </DialogContent>
          </Dialog>
        </div>
        <div className="flex items-center gap-2">
          <div
            className="relative flex w-fit bg-cyb-800/40 border border-accent-cyan/18 backdrop-blur-sm rounded-lg"
            ref={containerRef}
          >
            <span
              className="absolute top-0 bottom-0 transition-all duration-200 bg-accent-cyan/20 rounded-lg"
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
                className={`relative z-10 px-3 py-2 font-semibold transition-colors duration-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400/60 font-display text-xs flex items-center justify-center gap-1 ${
                  deckMode === mode ? "text-accent-cyan/80" : "text-muted-50"
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
        </div>

        <TooltipProvider delayDuration={100} skipDelayDuration={0}>
          <div className="flex gap-1">
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
                  <Button variant="ghost" size="icon" onClick={openLoginModal}>
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
                      <Button variant="ghost" size="icon">
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
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>
                <p>Clear Deck</p>
              </TooltipContent>
            </Tooltip>
          </div>
        </TooltipProvider>
      </div>
      <CardDescription className="text-muted-50">
        Drag cards from the right panel to add them to your deck, or drag cards
        back to the browser to remove them
      </CardDescription>
    </CardHeader>
  );
}

