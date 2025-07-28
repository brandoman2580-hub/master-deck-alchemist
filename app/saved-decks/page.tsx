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
    <div className="container mx-auto px-4 py-8">
      <div className="flex flex-col space-y-6">
        <div className="flex items-center justify-between">
          <h1 className="text-3xl font-bold">Saved Decks</h1>
          <Button asChild>
            <Link href="/deck-builder">Create New Deck</Link>
          </Button>
        </div>
        {error && (
          <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded">{error}</div>
        )}
        {loading ? (
          <p>Loading decks...</p>
        ) : decks.length === 0 ? (
          <Card className="p-8 text-center">
            <CardContent className="pt-6">
              <p className="text-muted-foreground">No saved decks found</p>
              <p className="text-sm text-muted-foreground mt-2">
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
              <Card key={deck.id}>
                <CardHeader>
                  <div className="flex items-center gap-2">
                    <CardTitle>{deck.name}</CardTitle>
                    <Badge 
                      variant="secondary" 
                      className={`text-xs font-medium pointer-events-none ${
                        deck.mode === "TCG" 
                          ? "bg-blue-100 text-blue-800 border-blue-200" 
                          : "bg-yellow-100 text-yellow-800 border-yellow-200"
                      }`}
                    >
                      {deck.mode}
                    </Badge>
                  </div>
                  <CardDescription className="flex items-center">
                    <Clock className="h-3 w-3 mr-1" />
                    Last updated: {deck.updated_at ? formatDate(deck.updated_at) : "Unknown"}
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-3 gap-2 text-sm">
                    <div className="bg-muted p-2 rounded-md text-center">
                      <p className="text-xs">Main</p>
                      <p className="font-bold">{deck.mainDeck.length}</p>
                    </div>
                    <div className="bg-muted p-2 rounded-md text-center">
                      <p className="text-xs">Extra</p>
                      <p className="font-bold">{deck.extraDeck.length}</p>
                    </div>
                    <div className="bg-muted p-2 rounded-md text-center">
                      <p className="text-xs">Side</p>
                      <p className="font-bold">{deck.sideDeck.length}</p>
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
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>Delete Deck</AlertDialogTitle>
                          <AlertDialogDescription>
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
  );
}
