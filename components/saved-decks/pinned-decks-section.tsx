"use client";

import { DeckType } from "../../types/types";
import { DeckMediaCard } from "./deck-media-card";
import { Card, CardContent } from "../ui/card";

interface PinnedDecksSectionProps {
  decks: DeckType[];
  onLoad: (id: string) => void;
  onDelete: (id: string) => void;
  onTogglePin: (id: string, isPinned: boolean) => void;
  loading?: boolean;
  formatDate: (dateString: string) => string;
}

export function PinnedDecksSection({
  decks,
  onLoad,
  onDelete,
  onTogglePin,
  loading = false,
  formatDate,
}: PinnedDecksSectionProps) {
  const pinnedDecks = decks
    .filter((deck) => deck.isPinned)
    .sort((a, b) => {
      if (!a.updated_at || !b.updated_at) return 0;
      return (
        new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime()
      );
    });

  if (pinnedDecks.length === 0) {
    return (
      <div className="space-y-4">
        <h2 className="text-xl font-bold text-white font-display tracking-wider">
          PINNED DECKS
        </h2>
        <Card className="p-6 text-center">
          <CardContent className="pt-0">
            <p className="text-white/70 text-sm">No pinned decks yet</p>
            <p className="text-xs text-white/50 mt-1">
              Pin decks to keep them at the top
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <h2 className="text-xl font-bold text-white font-display tracking-wider">
        PINNED DECKS
      </h2>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
        {pinnedDecks.map((deck) => (
          <DeckMediaCard
            key={deck.id}
            deck={deck}
            onLoad={onLoad}
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
