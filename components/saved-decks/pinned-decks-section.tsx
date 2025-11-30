"use client";

import { DeckType } from "../../types/types.ts";
import { DeckCard } from "./deck-card.tsx";
import { Card, CardContent } from "../ui/card.tsx";

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
      return new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime();
    });

  if (pinnedDecks.length === 0) {
    return (
      <div className="space-y-4">
        <h2 className="text-xl font-bold text-slate-50" style={{ fontFamily: "var(--font-heading)" }}>
          Pinned Decks
        </h2>
        <Card className="p-6 text-center bg-gradient-to-b from-cyan-400/10 via-cyan-500/8 to-cyan-600/5 backdrop-blur-md border border-cyan-500/20 rounded-xl">
          <CardContent className="pt-0">
            <p className="text-slate-400 text-sm">No pinned decks yet</p>
            <p className="text-xs text-slate-500 mt-1">Pin decks to keep them at the top</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <h2 className="text-xl font-bold text-slate-50" style={{ fontFamily: "var(--font-heading)" }}>
        Pinned Decks
      </h2>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
        {pinnedDecks.map((deck) => (
          <DeckCard
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

