"use client";

import { DeckType, DeckMode } from "../../types/types";
import { DeckMediaCard } from "./deck-media-card";
import { Card, CardContent } from "../ui/card";

interface ModeDecksSectionProps {
  decks: DeckType[];
  mode: DeckMode;
  onLoad: (id: string) => void;
  onCopy: (deck: DeckType, options?: { targetMode?: "TCG" | "Master Duel"; name?: string }) => void;
  onDelete: (id: string) => void;
  onTogglePin: (id: string, isPinned: boolean) => void;
  loading?: boolean;
  formatDate: (dateString: string) => string;
}

export function ModeDecksSection({
  decks,
  mode,
  onLoad,
  onCopy,
  onDelete,
  onTogglePin,
  loading = false,
  formatDate,
}: ModeDecksSectionProps) {
  const modeDecks = decks
    .filter((deck) => deck.mode === mode)
    .sort((a, b) => {
      if (!a.updated_at || !b.updated_at) return 0;
      return (
        new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime()
      );
    });

  if (modeDecks.length === 0) {
    return (
      <div className="space-y-4">
        <h2 className="text-xl font-bold text-white font-display tracking-wider">
          {mode} DECKS
        </h2>
        <Card className="p-6 text-center">
          <CardContent className="pt-0">
            <p className="text-white/70 text-sm">No {mode} decks found</p>
            <p className="text-xs text-white/50 mt-1">
              Create a deck in {mode} mode to see it here
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <h2
        className="text-xl font-bold text-slate-50"
        style={{ fontFamily: "var(--font-heading)" }}
      >
        {mode} Decks
      </h2>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
        {modeDecks.map((deck) => (
          <DeckMediaCard
            key={deck.id}
            deck={deck}
            onLoad={onLoad}
            onCopy={onCopy}
            onDelete={onDelete}
            onTogglePin={onTogglePin}
            loading={loading}
            formatDate={formatDate}
          />
        ))}
      </div>
    </div>
  );
}
