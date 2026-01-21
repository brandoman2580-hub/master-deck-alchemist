"use client";

import { useState, useEffect } from "react";
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
import { InputWithClear } from "@/components/ui/input-with-clear";
import { Download, Upload, Trash2, Edit } from "lucide-react";
import { DECK_MODES } from "@/lib/constants";
import { DeckMode } from "@/types/types";
import { openLoginModal } from "@/lib/helpers";
import { Badge } from "@/components/ui/badge";

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
  const [selectedMode, setSelectedMode] = useState<DeckMode>(deckMode);

  // Sync deckName and mode when rename dialog opens
  useEffect(() => {
    if (isRenameOpen) {
      setDeckName(currentDeckName || "");
      setSelectedMode(deckMode);
    }
  }, [isRenameOpen, currentDeckName, deckMode]);

  const displayName = deckName.length > 40 ? `${deckName.slice(0, 40)}...` : deckName;
  const shouldTruncate = deckName.length > 40;

  return (
    <CardHeader className="pb-2 pt-0 space-y-3">
      {/* First Row: Deck Name with Format Mode Badge */}
      <div className="flex items-center gap-2 w-full min-w-0">
        {shouldTruncate ? (
          <span className="text-xl font-bold text-white truncate cursor-help font-display flex-1 min-w-0">
            {displayName}
          </span>
        ) : (
          <span className="text-xl font-bold text-white font-display flex-1 min-w-0">
            {displayName}
          </span>
        )}
        {/* Format Mode Badge */}
        <Badge
          variant="outline"
          className={`px-3 py-1.5 font-semibold text-xs border-white/20 text-white flex-shrink-0 ${deckMode === "TCG"
              ? "bg-red-500/80 border-red-400/50"
              : "bg-blue-500/80 border-blue-400/50"
            }`}
        >
          {deckMode}
        </Badge>
      </div>

      {/* Second Row: Deck Actions with Labels */}
      <div className="flex items-center w-full gap-2">
        <div className="flex items-center gap-2 w-full">
          <Dialog open={isRenameOpen} onOpenChange={setIsRenameOpen}>
            {!user ? (
              <Button
                variant="ghost"
                size="sm"
                onClick={openLoginModal}
                className="h-8 gap-2 flex-1 text-white/80 hover:text-white bg-white/10 hover:bg-white/15 border border-white/20 hover:border-white/30 transition-all focus:outline-none rounded-lg"
              >
                <Edit className="h-4 w-4" />
                <span className="text-xs">Rename</span>
              </Button>
            ) : (
              <DialogTrigger asChild>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-8 gap-2 flex-1 text-white/80 hover:text-white bg-white/10 hover:bg-white/15 border border-white/20 hover:border-white/30 transition-all focus:outline-none rounded-lg"
                >
                  <Edit className="h-4 w-4" />
                  <span className="text-xs">Rename</span>
                </Button>
              </DialogTrigger>
            )}
            <DialogContent className="bg-white/10 border border-white/20 backdrop-blur-xl">
              <div className="flex flex-col gap-4">
                <DialogHeader>
                  <DialogTitle>Rename Deck</DialogTitle>
                  <DialogDescription>
                    Enter a new name for your deck and select the format mode.
                  </DialogDescription>
                </DialogHeader>
                <InputWithClear
                  value={deckName}
                  onChange={(e) => setDeckName(e.target.value)}
                  placeholder="Deck name"
                  maxLength={40}
                  autoFocus
                />
                <div className="flex flex-col gap-2">
                  <label className="text-sm font-medium text-white/90">Format Mode</label>
                  <div className="flex gap-2">
                    {DECK_MODES.map((mode) => (
                      <Button
                        key={mode}
                        type="button"
                        variant={selectedMode === mode ? "default" : "outline"}
                        onClick={() => setSelectedMode(mode)}
                        className="flex-1"
                      >
                        {mode}
                      </Button>
                    ))}
                  </div>
                </div>
                <DialogFooter>
                  <Button
                    onClick={() => {
                      if (
                        deckName.trim() &&
                        deckName.trim() !== currentDeckName
                      ) {
                        renameDeck(deckName.trim());
                      }
                      if (selectedMode !== deckMode) {
                        setDeckMode(selectedMode);
                        updateDeckMode(selectedMode);
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

          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              if (!user) {
                openLoginModal();
              } else {
                handleExportDeck();
              }
            }}
            className="h-8 gap-2 flex-1 text-white/80 hover:text-white bg-white/10 hover:bg-white/15 border border-white/20 hover:border-white/30 transition-all focus:outline-none rounded-lg"
          >
            <Download className="h-4 w-4" />
            <span className="text-xs">Export</span>
          </Button>

          {!user ? (
            <Button variant="ghost" size="sm" onClick={openLoginModal} className="h-8 gap-2 flex-1 text-white/80 hover:text-white bg-white/10 hover:bg-white/15 border border-white/20 hover:border-white/30 transition-all focus:outline-none rounded-lg">
              <Upload className="h-4 w-4" />
              <span className="text-xs">Import</span>
            </Button>
          ) : (
            <Dialog>
              <DialogTrigger asChild>
                <Button variant="ghost" size="sm" className="h-8 gap-2 flex-1 text-white/80 hover:text-white bg-white/10 hover:bg-white/15 border border-white/20 hover:border-white/30 transition-all focus:outline-none rounded-lg">
                  <Upload className="h-4 w-4" />
                  <span className="text-xs">Import</span>
                </Button>
              </DialogTrigger>
              <DialogContent className="bg-white/10 border border-white/20 backdrop-blur-xl">
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

          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              if (!user) {
                openLoginModal();
              } else {
                clearDeck();
              }
            }}
            className="h-8 gap-2 flex-1 text-white/80 hover:text-white bg-white/10 hover:bg-white/15 border border-white/20 hover:border-white/30 transition-all focus:outline-none rounded-lg"
          >
            <Trash2 className="h-4 w-4" />
            <span className="text-xs">Delete</span>
          </Button>
        </div>
      </div>
    </CardHeader>
  );
}

