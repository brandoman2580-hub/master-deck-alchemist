"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Edit, Trash2, Clock } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { getUserDecks, deleteDeck } from "@/lib/supabaseDecks";
import { useUserStore } from "@/store/useUserStore";
import { useDeck } from "@/context/deck-context";
import { DeckType } from "@/types/types";

export default function SavedDecks() {
  const [decks, setDecks] = useState<DeckType[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [deckToDelete, setDeckToDelete] = useState<string | null>(null);

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
    await loadDeck(id); // context sets currentDeck
    router.push("/deck-builder");
  } catch (err: any) {
    setError(err.message || "Failed to load deck");
  }
};

  const handleDeleteDeck = async () => {
    if (!deckToDelete || !user) return;
    try {
      await deleteDeck(deckToDelete, user.id);
      setDecks(prev => prev.filter(d => d.id !== deckToDelete));
      setDeckToDelete(null);
    } catch (err: any) {
      setError(err.message || "Failed to delete deck");
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
    <div className="min-h-screen bg-slate-950 px-8 pt-8 pb-10">
      <div className="max-w-7xl mx-auto">
        <div className="flex flex-col space-y-6">
          <div className="flex items-center justify-between">
            <h1 className="text-3xl font-bold text-slate-50" style={{ fontFamily: "var(--font-heading)" }}>Saved Decks</h1>
            <Button asChild>
              <Link href="/deck-builder">Create New Deck</Link>
            </Button>
          </div>
          {error && (
            <div className="bg-red-500/20 border border-red-500/50 text-red-300 px-4 py-3 rounded-lg backdrop-blur-sm">{error}</div>
          )}
          {loading ? (
            <p className="text-slate-300">Loading decks...</p>
          ) : decks.length === 0 ? (
            <Card className="p-8 text-center bg-gradient-to-b from-cyan-400/20 via-cyan-500/15 to-cyan-600/5 backdrop-blur-md border border-cyan-500/30 rounded-2xl">
              <CardContent className="pt-6">
                <p className="text-slate-300">No saved decks found</p>
                <p className="text-sm text-slate-400 mt-2">
                  Start building a deck and save it to see it here
                </p>
                <Button className="mt-4" asChild>
                  <Link href="/deck-builder">Create Your First Deck</Link>
                </Button>
              </CardContent>
            </Card>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
              {decks.map((deck) => (
                <Card key={deck.id} className="bg-gradient-to-b from-cyan-400/20 via-cyan-500/15 to-cyan-600/5 backdrop-blur-md border border-cyan-500/30 rounded-2xl">
                <CardHeader>
                  <div className="flex items-center gap-2">
                    <CardTitle className="text-slate-50" style={{ fontFamily: "var(--font-heading)" }}>{deck.name}</CardTitle>
                    <Badge 
                      variant="secondary" 
                      className={`text-xs font-medium pointer-events-none border ${
                        deck.mode === "TCG" 
                          ? "bg-cyan-500/40 border-cyan-400/60 text-cyan-100" 
                          : "bg-cyan-500/40 border-cyan-400/60 text-cyan-100"
                      }`}
                    >
                      {deck.mode}
                    </Badge>
                  </div>
                  <CardDescription className="flex items-center text-slate-300">
                    <Clock className="h-3 w-3 mr-1 text-cyan-400" />
                    Last updated: {deck.updated_at ? formatDate(deck.updated_at) : "Unknown"}
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-3 gap-2 text-sm">
                    <div className="bg-slate-950/60 border border-cyan-500/30 p-2 rounded-md text-center">
                      <p className="text-xs text-slate-300">Main</p>
                      <p className="font-bold text-cyan-300">{deck.mainDeck.length}</p>
                    </div>
                    <div className="bg-slate-950/60 border border-cyan-500/30 p-2 rounded-md text-center">
                      <p className="text-xs text-slate-300">Extra</p>
                      <p className="font-bold text-cyan-300">{deck.extraDeck.length}</p>
                    </div>
                    <div className="bg-slate-950/60 border border-cyan-500/30 p-2 rounded-md text-center">
                      <p className="text-xs text-slate-300">Side</p>
                      <p className="font-bold text-cyan-300">{deck.sideDeck.length}</p>
                    </div>
                  </div>
                </CardContent>
                <CardFooter className="flex justify-between">
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleLoadDeck(deck.id)}
                      disabled={loading}
                    >
                      <Edit className="h-4 w-4 mr-2" />
                      Edit
                    </Button>
                    <AlertDialog
                      open={deckToDelete === deck.id}
                      onOpenChange={(open) => !open && setDeckToDelete(null)}
                    >
                      <AlertDialogTrigger asChild>
                        <Button
                          variant="destructive"
                          size="sm"
                          onClick={() => setDeckToDelete(deck.id)}
                          disabled={loading}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent className="bg-gradient-to-b from-cyan-400/20 via-cyan-500/15 to-cyan-600/5 backdrop-blur-md border border-cyan-500/30">
                        <AlertDialogHeader>
                          <AlertDialogTitle className="text-slate-50" style={{ fontFamily: "var(--font-heading)" }}>Delete Deck</AlertDialogTitle>
                          <AlertDialogDescription className="text-slate-300">
                            Are you sure you want to delete {`${deck.name}`}? This action cannot be undone.
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>Cancel</AlertDialogCancel>
                          <AlertDialogAction
                            onClick={handleDeleteDeck}
                            disabled={loading}
                          >
                            Delete
                          </AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  </div>
                </CardFooter>
              </Card>
            ))}
          </div>
        )}

        </div>
      </div>
    </div>
  );
}
