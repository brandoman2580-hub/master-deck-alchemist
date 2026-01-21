"use client";

import { useEffect, useState, useRef } from "react";
import { motion } from "framer-motion";
import { Button } from "../../components/ui/button";
import { Card, CardContent } from "../../components/ui/card";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  getUserDecks,
  deleteDeck,
  toggleDeckPin,
} from "../../lib/supabaseDecks";
import { useUserStore } from "../../store/useUserStore";
import { useDeck } from "../../context/deck-context";
import { DeckType } from "../../types/types";
import { DeckSearchAutocomplete } from "../../components/saved-decks/deck-search-autocomplete";
import { PinnedDecksSection } from "../../components/saved-decks/pinned-decks-section";
import { ModeDecksSection } from "../../components/saved-decks/mode-decks-section";
import {
  fadeInVariants,
  staggerContainer,
  staggerItem,
} from "@/lib/animations";

export default function SavedDecks() {
  const [decks, setDecks] = useState<DeckType[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const hasLoadedRef = useRef(false);
  const lastUserIdRef = useRef<string | null>(null);

  const user = useUserStore((state) => state.user);
  const router = useRouter();
  const { loadDeck } = useDeck();

  // Ensure page starts at top on initial load
  useEffect(() => {
    // Disable scroll restoration to prevent browser from restoring scroll position
    if ('scrollRestoration' in window.history) {
      window.history.scrollRestoration = 'manual';
    }
    
    // Scroll to top immediately on mount (synchronous)
    window.scrollTo({ top: 0, left: 0, behavior: 'instant' });
    
    // Also set scroll position directly for cross-browser compatibility
    if (document.documentElement) {
      document.documentElement.scrollTop = 0;
    }
    if (document.body) {
      document.body.scrollTop = 0;
    }
  }, []);

  useEffect(() => {
    const fetchDecks = async () => {
      if (!user) {
        // Clear decks if user logs out
        if (hasLoadedRef.current) {
          setDecks([]);
          hasLoadedRef.current = false;
          lastUserIdRef.current = null;
        }
        return;
      }

      // Only fetch if we haven't loaded yet OR if the user ID changed
      const userIdChanged = lastUserIdRef.current !== user.id;
      if (!userIdChanged && hasLoadedRef.current) {
        return; // Already loaded for this user, don't reload
      }

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
        hasLoadedRef.current = true;
        lastUserIdRef.current = user.id;
      } catch (err: any) {
        setError(err.message || "Failed to load decks");
        hasLoadedRef.current = false;
      } finally {
        setLoading(false);
      }
    };
    fetchDecks();
  }, [user?.id]); // Only depend on user.id, not the entire user object

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
        prev.map((deck) => (deck.id === id ? { ...deck, isPinned } : deck)),
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

  const containerRef = useRef<HTMLDivElement>(null);

  return (
    <div className="min-h-screen bg-transparent px-4 sm:px-6 lg:px-8 pt-6 sm:pt-8 pb-8 sm:pb-10 relative">
      <div ref={containerRef} className="max-w-7xl mx-auto relative z-10">
        <motion.div
          className="flex flex-col space-y-4 sm:space-y-6"
          initial="hidden"
          animate="visible"
          variants={fadeInVariants}
        >
          <motion.div
            className="flex items-center justify-between"
            variants={fadeInVariants}
          >
            <h1 className="text-2xl sm:text-3xl font-bold text-white font-display tracking-wider">
              SAVED DECKS
            </h1>
            <Button asChild>
              <Link href="/deck-builder">Create New Deck</Link>
            </Button>
          </motion.div>

          {error && (
            <div className="rounded-lg bg-white/10 border border-white/20 backdrop-blur-xl shadow-lg p-3 sm:p-4">
              <div className="text-white/90 text-sm sm:text-base">
                {error}
              </div>
            </div>
          )}

          {loading ? (
            <p className="text-white/70">Loading decks...</p>
          ) : decks.length === 0 ? (
            <motion.div
              initial="hidden"
              animate="visible"
              variants={fadeInVariants}
            >
              <Card className="p-6 sm:p-8 text-center rounded-xl bg-white/5 border border-white/10 backdrop-blur-xl shadow-lg">
                <CardContent className="pt-6">
                  <p className="text-white/80">No saved decks found</p>
                  <p className="text-sm text-white/60 mt-2">
                    Start building a deck and save it to see it here
                  </p>
                  <Button className="mt-4" asChild>
                    <Link href="/deck-builder">Create Your First Deck</Link>
                  </Button>
                </CardContent>
              </Card>
            </motion.div>
          ) : (
            <motion.div
              initial="hidden"
              animate="visible"
              variants={staggerContainer(0.1)}
            >
              <motion.div variants={staggerItem}>
                <DeckSearchAutocomplete decks={decks} />
              </motion.div>

              <motion.div variants={staggerItem} className="mt-6">
                <PinnedDecksSection
                  decks={decks}
                  onLoad={handleLoadDeck}
                  onDelete={handleDeleteDeck}
                  onTogglePin={handleTogglePin}
                  loading={loading}
                  formatDate={formatDate}
                />
              </motion.div>

              <motion.div variants={staggerItem} className="mt-10 pt-8 border-t border-white/20">
                <ModeDecksSection
                  decks={decks}
                  mode="TCG"
                  onLoad={handleLoadDeck}
                  onDelete={handleDeleteDeck}
                  onTogglePin={handleTogglePin}
                  loading={loading}
                  formatDate={formatDate}
                />
              </motion.div>

              <motion.div variants={staggerItem} className="mt-10 pt-8 border-t border-white/20">
                <ModeDecksSection
                  decks={decks}
                  mode="Master Duel"
                  onLoad={handleLoadDeck}
                  onDelete={handleDeleteDeck}
                  onTogglePin={handleTogglePin}
                  loading={loading}
                  formatDate={formatDate}
                />
              </motion.div>
            </motion.div>
          )}
        </motion.div>
      </div>
    </div>
  );
}
