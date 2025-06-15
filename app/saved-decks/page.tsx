"use client"

import { useDeck } from "@/context/deck-context"
import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
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
} from "@/components/ui/alert-dialog"
import { Edit, Trash2, Clock, Copy } from "lucide-react"
import Link from "next/link"
import { useRouter } from "next/navigation"

export default function SavedDecks() {
  const { savedDecks, loadDeck, deleteDeck } = useDeck()
  const router = useRouter()
  const [deckToDelete, setDeckToDelete] = useState<string | null>(null)

  const handleLoadDeck = (id: string) => {
    loadDeck(id)
    router.push("/deck-builder")
  }

  const handleDeleteDeck = () => {
    if (deckToDelete) {
      deleteDeck(deckToDelete)
      setDeckToDelete(null)
    }
  }

  const formatDate = (dateString: string) => {
    const date = new Date(dateString)
    return new Intl.DateTimeFormat("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    }).format(date)
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="flex flex-col space-y-6">
        <div className="flex items-center justify-between">
          <h1 className="text-3xl font-bold">Saved Decks</h1>
          <Button asChild>
            <Link href="/deck-builder">Create New Deck</Link>
          </Button>
        </div>

        {savedDecks.length === 0 ? (
          <Card className="p-8 text-center">
            <CardContent className="pt-6">
              <p className="text-muted-foreground">No saved decks found</p>
              <p className="text-sm text-muted-foreground mt-2">Start building a deck and save it to see it here</p>
              <Button className="mt-4" asChild>
                <Link href="/deck-builder">Create Your First Deck</Link>
              </Button>
            </CardContent>
          </Card>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {savedDecks.map((deck) => (
              <Card key={deck.id}>
                <CardHeader>
                  <CardTitle>{deck.name}</CardTitle>
                  <CardDescription className="flex items-center">
                    <Clock className="h-3 w-3 mr-1" />
                    Last updated: {formatDate(deck.updatedAt)}
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-3 gap-2 text-sm">
                    <div className="bg-muted p-2 rounded-md text-center">
                      <p className="text-xs">Main</p>
                      <p className="font-bold">{deck.deck.mainDeck.length}</p>
                    </div>
                    <div className="bg-muted p-2 rounded-md text-center">
                      <p className="text-xs">Extra</p>
                      <p className="font-bold">{deck.deck.extraDeck.length}</p>
                    </div>
                    <div className="bg-muted p-2 rounded-md text-center">
                      <p className="text-xs">Side</p>
                      <p className="font-bold">{deck.deck.sideDeck.length}</p>
                    </div>
                  </div>
                </CardContent>
                <CardFooter className="flex justify-between">
                  <Button variant="outline" size="sm" onClick={() => handleLoadDeck(deck.id)}>
                    <Copy className="h-4 w-4 mr-2" />
                    Load
                  </Button>
                  <div className="flex gap-2">
                    <Button variant="outline" size="sm" onClick={() => handleLoadDeck(deck.id)}>
                      <Edit className="h-4 w-4 mr-2" />
                      Edit
                    </Button>
                    <AlertDialog
                      open={deckToDelete === deck.id}
                      onOpenChange={(open: boolean) => !open && setDeckToDelete(null)}
                    >
                      <AlertDialogTrigger asChild>
                        <Button variant="destructive" size="sm" onClick={() => setDeckToDelete(deck.id)}>
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
                          <AlertDialogAction onClick={handleDeleteDeck}>Delete</AlertDialogAction>
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
  )
}
