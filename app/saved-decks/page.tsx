"use client";

import { useEffect, useState } from "react";
import { Button } from "../../components/ui/button";
import { Card, CardContent } from "../../components/ui/card";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { getUserDecks, deleteDeck, toggleDeckPin } from "../../lib/supabaseDecks";
import { useUserStore } from "../../store/useUserStore";
import { useDeck } from "../../context/deck-context";
import { DeckType } from "../../types/types";
import { DeckSearchAutocomplete } from "../../components/saved-decks/deck-search-autocomplete";
import { PinnedDecksSection } from "../../components/saved-decks/pinned-decks-section";
import { ModeDecksSection } from "../../components/saved-decks/mode-decks-section";
import CutCornerWrapper from "../../components/cut-corner-wrapper";

export default function SavedDecks() {
  const [decks, setDecks] = useState<DeckType[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const user = useUserStore((state) => state.user);
  const router = useRouter();
  const { loadDeck } = useDeck();

  useEffect(() => {
    const fetchDecks = async () => {
      if (!user) return;
      setLoading(true);
      setError(null);
      try {
        const supabaseDecks = await getUserDecks(user.id);
        const decks: DeckType[] = supabaseDecks.map((deck: any) => ({
          id: deck.id,
          name: deck.name,
          mainDeck: deck.cards.main,
          extraDeck: deck.cards.extra,
          sideDeck: deck.cards.side,
          updated_at: deck.updated_at,
          mode: deck.mode || "Master Duel",
          isPinned: deck.is_pinned ?? false,
        }));
        setDecks(decks);
      } catch (err: any) {
        setError(err.message || "Failed to load decks");
      } finally {
        setLoading(false);
      }
    };
    fetchDecks();
  }, [user]);

  const handleLoadDeck = async (id: string) => {
    if (!user) return;
    try {
      await loadDeck(id);
      router.push("/deck-builder");
    } catch (err: any) {
      setError(err.message || "Failed to load deck");
    }
  };

  const handleDeleteDeck = async (id: string) => {
    if (!user) return;
    try {
      await deleteDeck(id, user.id);
      setDecks((prev) => prev.filter((d) => d.id !== id));
    } catch (err: any) {
      setError(err.message || "Failed to delete deck");
    }
  };

  const handleTogglePin = async (id: string, isPinned: boolean) => {
    if (!user) return;
    try {
      await toggleDeckPin(id, user.id, isPinned);
      setDecks((prev) =>
        prev.map((deck) =>
          deck.id === id ? { ...deck, isPinned } : deck
        )
      );
    } catch (err: any) {
      setError(err.message || "Failed to toggle pin");
    }
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return new Intl.DateTimeFormat("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    }).format(date);
  };

  return (
    <div className="min-h-screen bg-cyb-900 px-8 pt-8 pb-10 relative">
      <div className="max-w-7xl mx-auto relative z-10">
        <div className="flex flex-col space-y-6">
          <div className="flex items-center justify-between">
            <h1 className="text-3xl font-bold text-white font-display tracking-wider">
              SAVED DECKS
            </h1>
            <Button asChild>
              <Link href="/deck-builder">Create New Deck</Link>
            </Button>
          </div>

          {error && (
            <CutCornerWrapper
              size="md"
              padding="0.75rem 1rem"
              style={{
                ["--cut-corner-stroke" as any]: "rgba(20,239,255,0.38)",
                ["--cut-corner-fill" as any]: "transparent",
              }}
            >
              <div className="bg-accent-cyan/10 border border-accent-cyan/30 text-accent-cyan backdrop-blur-sm glass-panel">
                {error}
              </div>
            </CutCornerWrapper>
          )}

          {loading ? (
            <p className="text-muted-50">Loading decks...</p>
          ) : decks.length === 0 ? (
            <Card className="p-8 text-center glass-panel border-thin-neon">
              <CardContent className="pt-6">
                <p className="text-muted-50">No saved decks found</p>
                <p className="text-sm text-muted-50/70 mt-2">
                  Start building a deck and save it to see it here
                </p>
                <Button className="mt-4" asChild>
                  <Link href="/deck-builder">Create Your First Deck</Link>
                </Button>
              </CardContent>
            </Card>
          ) : (
            <>
              <DeckSearchAutocomplete decks={decks} />

              <PinnedDecksSection
                decks={decks}
                onLoad={handleLoadDeck}
                onDelete={handleDeleteDeck}
                onTogglePin={handleTogglePin}
                loading={loading}
                formatDate={formatDate}
              />

              <ModeDecksSection
                decks={decks}
                mode="TCG"
                onLoad={handleLoadDeck}
                onDelete={handleDeleteDeck}
                onTogglePin={handleTogglePin}
                loading={loading}
                formatDate={formatDate}
              />

              <ModeDecksSection
                decks={decks}
                mode="Master Duel"
                onLoad={handleLoadDeck}
                onDelete={handleDeleteDeck}
                onTogglePin={handleTogglePin}
                loading={loading}
                formatDate={formatDate}
              />
            </>
          )}
        </div>
      </div>
    </div>
  );
}
