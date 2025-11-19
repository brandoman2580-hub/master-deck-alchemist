"use client";

import { DeckType, DeckMode } from "@/types/types";
import { DeckCard } from "./deck-card";
import { Card, CardContent } from "@/components/ui/card";

interface ModeDecksSectionProps {
  decks: DeckType[];
  mode: DeckMode;
  onLoad: (id: string) => void;
  onDelete: (id: string) => void;
  onTogglePin: (id: string, isPinned: boolean) => void;
  loading?: boolean;
  formatDate: (dateString: string) => string;
}

export function ModeDecksSection({
  decks,
  mode,
  onLoad,
  onDelete,
  onTogglePin,
  loading = false,
  formatDate,
}: ModeDecksSectionProps) {
  const modeDecks = decks
    .filter((deck) => deck.mode === mode)
    .sort((a, b) => {
      if (!a.updated_at || !b.updated_at) return 0;
      return new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime();
    });

  if (modeDecks.length === 0) {
    return (
      <div className="space-y-4">
        <h2 className="text-xl font-bold text-slate-50" style={{ fontFamily: "var(--font-heading)" }}>
          {mode} Decks
        </h2>
        <Card className="p-6 text-center bg-gradient-to-b from-cyan-400/10 via-cyan-500/8 to-cyan-600/5 backdrop-blur-md border border-cyan-500/20 rounded-xl">
          <CardContent className="pt-0">
            <p className="text-slate-400 text-sm">No {mode} decks found</p>
            <p className="text-xs text-slate-500 mt-1">Create a deck in {mode} mode to see it here</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <h2 className="text-xl font-bold text-slate-50" style={{ fontFamily: "var(--font-heading)" }}>
        {mode} Decks
      </h2>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
        {modeDecks.map((deck) => (
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

