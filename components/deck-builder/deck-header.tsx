"use client";

import { useState, useEffect, useMemo } from "react";
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
import { Trash2, Edit, Share2, AlertTriangle } from "lucide-react";
import { DECK_MODES } from "@/lib/constants";
import { DeckMode, DeckType } from "@/types/types";
import type { Card } from "@/types/card";
import { openLoginModal } from "@/lib/helpers";
import { Badge } from "@/components/ui/badge";
import { ShareLinkDialog } from "@/components/ui/share-link-dialog";
import { DeckCostDisplay } from "./deck-cost-display";
import { SortControls } from "./sort-controls";
import { validateBanlistCompliance } from "@/lib/validation/deck-validator";

interface DeckHeaderProps {
  currentDeckName: string;
  currentDeck: DeckType;
  user: { id: string } | null;
  deckMode: DeckMode;
  setDeckMode: (mode: DeckMode) => void;
  updateDeckMode: (mode: DeckMode) => void;
  clearDeck: () => void;
  renameDeck: (name: string) => void;
  hasCards?: boolean;
  mdRarityMap?: Map<number, string>;
  /** Card pool lookup to enrich deck cost with prices */
  cardLookup?: Map<number, Card>;
  /** Banlist for compliance checking (TCG or Master Duel per deck mode) */
  banlist?: Record<string, string | undefined>;
  deckSort?: string;
  deckSortDirection?: "asc" | "desc";
  onDeckSortChange?: (sort: string) => void;
  onDeckSortDirectionChange?: (direction: "asc" | "desc") => void;
}

export function DeckHeader({
  currentDeckName,
  currentDeck,
  user,
  deckMode,
  setDeckMode,
  updateDeckMode,
  clearDeck,
  renameDeck,
  hasCards = false,
  mdRarityMap,
  cardLookup,
  banlist = {},
  deckSort = "name",
  deckSortDirection = "asc",
  onDeckSortChange,
  onDeckSortDirectionChange,
}: DeckHeaderProps) {
  // Internal state for rename dialog
  const [isRenameOpen, setIsRenameOpen] = useState(false);
  const [deckName, setDeckName] = useState(currentDeckName || "");
  const [selectedMode, setSelectedMode] = useState<DeckMode>(deckMode);
  const [isShareDialogOpen, setIsShareDialogOpen] = useState(false);

  // Compute banlist violations (deck out of sync with banlist)
  const banlistViolations = useMemo(() => {
    if (!hasCards || Object.keys(banlist).length === 0) return [];
    const deckForValidation = {
      mainDeck: currentDeck.mainDeck.map((c) => ({ cardId: c.id, name: c.name })),
      extraDeck: currentDeck.extraDeck.map((c) => ({ cardId: c.id, name: c.name })),
      sideDeck: currentDeck.sideDeck.map((c) => ({ cardId: c.id, name: c.name })),
    };
    const banlistStrings: Record<string, string> = {};
    for (const [k, v] of Object.entries(banlist)) {
      if (typeof v === "string") banlistStrings[k] = v;
    }
    const result = validateBanlistCompliance(deckForValidation, banlistStrings);
    return result.errors;
  }, [currentDeck, banlist, hasCards]);

  const hasBanlistViolations = banlistViolations.length > 0;

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
        {/* Banlist violation warning - deck may be out of sync with recent banlist update */}
        {hasBanlistViolations && (
          <Dialog>
            <DialogTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8 flex-shrink-0 text-amber-400 hover:text-amber-300 hover:bg-amber-500/20 rounded-lg"
                aria-label="View banlist violations"
              >
                <AlertTriangle className="h-5 w-5" />
              </Button>
            </DialogTrigger>
            <DialogContent className="bg-white/10 border border-white/20 backdrop-blur-xl max-w-md">
              <DialogHeader>
                <DialogTitle className="text-white font-display flex items-center gap-2">
                  <AlertTriangle className="h-5 w-5 text-amber-400" />
                  Banlist Violations
                </DialogTitle>
                <DialogDescription className="text-white/80">
                  Your deck contains too many copies of Limited, Semi-Limited, or Forbidden cards.
                  This can happen if the banlist was recently updated. Please remove or reduce the
                  following cards to comply with the current {deckMode} banlist.
                </DialogDescription>
              </DialogHeader>
              <ul className="space-y-2 max-h-60 overflow-y-auto">
                {banlistViolations.map((msg, i) => (
                  <li
                    key={i}
                    className="text-sm text-amber-200/90 py-2 px-3 rounded-lg bg-amber-500/10 border border-amber-500/20"
                  >
                    {msg}
                  </li>
                ))}
              </ul>
            </DialogContent>
          </Dialog>
        )}
        {/* Format Mode Badge - Only show when deck has cards or has been renamed */}
        {hasCards && (
          <Badge
            variant="outline"
            className={`px-3 py-1.5 font-semibold text-xs border-white/20 text-white flex-shrink-0 ${deckMode === "TCG"
                ? "bg-red-500/80 border-red-400/50"
                : "bg-blue-500/80 border-blue-400/50"
              }`}
          >
            {deckMode}
          </Badge>
        )}
      </div>

      {/* Budget: TCG prices or Master Duel CP */}
      {hasCards && (
        <DeckCostDisplay
          deck={currentDeck}
          deckMode={deckMode}
          mdRarityMap={mdRarityMap}
          cardLookup={cardLookup}
        />
      )}

      {/* Second Row: Deck Actions with Labels + Sort Controls */}
      <div className="flex items-center w-full gap-2 flex-wrap">
        <div className="flex items-center gap-1.5 flex-1 min-w-0">
          <Dialog open={isRenameOpen} onOpenChange={setIsRenameOpen}>
            {!user ? (
              <Button
                variant="ghost"
                size="sm"
                onClick={openLoginModal}
                className="h-8 gap-1.5 px-2.5 flex-shrink-0 text-white/80 hover:text-white bg-white/10 hover:bg-white/15 border border-white/20 hover:border-white/30 transition-all focus:outline-none rounded-lg"
              >
                <Edit className="h-4 w-4" />
                <span className="text-xs">Rename</span>
              </Button>
            ) : (
              <DialogTrigger asChild>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-8 gap-1.5 px-2.5 flex-shrink-0 text-white/80 hover:text-white bg-white/10 hover:bg-white/15 border border-white/20 hover:border-white/30 transition-all focus:outline-none rounded-lg"
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
                setIsShareDialogOpen(true);
              }
            }}
            disabled={!user || !hasCards}
            className="h-8 gap-1.5 px-2.5 flex-shrink-0 text-white/80 hover:text-white bg-white/10 hover:bg-white/15 border border-white/20 hover:border-white/30 transition-all focus:outline-none rounded-lg disabled:opacity-50"
          >
            <Share2 className="h-4 w-4" />
            <span className="text-xs">Share</span>
          </Button>

          <ShareLinkDialog
            open={isShareDialogOpen}
            onOpenChange={setIsShareDialogOpen}
            deckName={currentDeckName}
            deckData={{
              name: currentDeck.name,
              mainDeck: currentDeck.mainDeck.map((card) => ({
                cardId: card.id,
                deckInstanceId: card.deckInstanceId,
                name: card.name,
                type: card.type,
                desc: card.desc,
              })),
              extraDeck: currentDeck.extraDeck.map((card) => ({
                cardId: card.id,
                deckInstanceId: card.deckInstanceId,
                name: card.name,
                type: card.type,
                desc: card.desc,
              })),
              sideDeck: currentDeck.sideDeck.map((card) => ({
                cardId: card.id,
                deckInstanceId: card.deckInstanceId,
                name: card.name,
                type: card.type,
                desc: card.desc,
              })),
              mode: currentDeck.mode,
            }}
          />

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
            className="h-8 gap-1.5 px-2.5 flex-shrink-0 text-white/80 hover:text-white bg-white/10 hover:bg-white/15 border border-white/20 hover:border-white/30 transition-all focus:outline-none rounded-lg"
          >
            <Trash2 className="h-4 w-4" />
            <span className="text-xs">Delete</span>
          </Button>
        </div>
        {onDeckSortChange && onDeckSortDirectionChange && (
          <SortControls
            sort={deckSort}
            sortDirection={deckSortDirection}
            onSortChange={onDeckSortChange}
            onSortDirectionChange={onDeckSortDirectionChange}
            deckMode={deckMode}
          />
        )}
      </div>
    </CardHeader>
  );
}

