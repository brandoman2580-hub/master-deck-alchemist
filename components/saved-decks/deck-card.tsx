"use client";

import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "../ui/card";
import { Button } from "../ui/button";
import { Badge } from "../ui/badge";
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
} from "../ui/alert-dialog";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "../ui/tooltip";
import { Edit, Trash2, Clock, Pin } from "lucide-react";
import { DeckType } from "../../types/types";

interface DeckCardProps {
  deck: DeckType;
  onLoad: (id: string) => void;
  onDelete: (id: string) => void;
  onTogglePin: (id: string, isPinned: boolean) => void;
  loading?: boolean;
  formatDate: (dateString: string) => string;
}

export function DeckCard({
  deck,
  onLoad,
  onDelete,
  onTogglePin,
  loading = false,
  formatDate,
}: DeckCardProps) {
  const shouldTruncate = deck.name.length > 25;
  const displayName = shouldTruncate
    ? `${deck.name.slice(0, 25)}...`
    : deck.name;

  return (
    <Card className="hover:border-white/30 transition-colors">
      <CardHeader>
        <div className="flex items-start justify-between gap-2">
          <div className="flex items-center gap-2 flex-1 min-w-0">
            {shouldTruncate ? (
              <TooltipProvider delayDuration={200}>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <CardTitle className="text-white truncate cursor-help font-display">
                      {displayName}
                    </CardTitle>
                  </TooltipTrigger>
                  <TooltipContent
                    className="bg-white/10 border border-white/20 backdrop-blur-xl text-white shadow-lg max-w-xs"
                    side="top"
                  >
                    <p className="font-medium">{deck.name}</p>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            ) : (
              <CardTitle className="text-white truncate font-display">
                {displayName}
              </CardTitle>
            )}
            <Badge
              variant="secondary"
              className="text-xs font-medium pointer-events-none whitespace-nowrap font-display"
            >
              {deck.mode}
            </Badge>
          </div>
          <Button
            variant="ghost"
            size="icon"
            onClick={() => onTogglePin(deck.id, !deck.isPinned)}
            className={`h-8 w-8 flex-shrink-0 ${
              deck.isPinned
                ? "text-white hover:text-white/80"
                : "text-white/60 hover:text-white/80"
            }`}
            aria-pressed={deck.isPinned}
            aria-label={deck.isPinned ? "Unpin deck" : "Pin deck"}
          >
            <Pin className={`h-4 w-4 ${deck.isPinned ? "fill-current" : ""}`} />
          </Button>
        </div>
        <CardDescription className="flex items-center text-white/70">
          <Clock className="h-3 w-3 mr-1 text-white/60" />
          Last updated:{" "}
          {deck.updated_at ? formatDate(deck.updated_at) : "Unknown"}
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-3 gap-2 text-sm">
          <div className="bg-white/5 border border-white/10 p-2 rounded-md text-center backdrop-blur-sm">
            <p className="text-xs text-white/70">Main</p>
            <p className="font-bold text-white font-display">
              {deck.mainDeck.length}
            </p>
          </div>
          <div className="bg-white/5 border border-white/10 p-2 rounded-md text-center backdrop-blur-sm">
            <p className="text-xs text-white/70">Extra</p>
            <p className="font-bold text-white font-display">
              {deck.extraDeck.length}
            </p>
          </div>
          <div className="bg-white/5 border border-white/10 p-2 rounded-md text-center backdrop-blur-sm">
            <p className="text-xs text-white/70">Side</p>
            <p className="font-bold text-white font-display">
              {deck.sideDeck.length}
            </p>
          </div>
        </div>
      </CardContent>
      <CardFooter className="flex justify-between">
        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => onLoad(deck.id)}
            disabled={loading}
          >
            <Edit className="h-4 w-4 mr-2" />
            Edit
          </Button>
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button variant="destructive" size="sm" disabled={loading}>
                <Trash2 className="h-4 w-4" />
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle className="text-white font-display">
                  Delete Deck
                </AlertDialogTitle>
                <AlertDialogDescription className="text-white/80">
                  Are you sure you want to delete {deck.name}? This action
                  cannot be undone.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>
                  Cancel
                </AlertDialogCancel>
                <AlertDialogAction
                  onClick={() => onDelete(deck.id)}
                  disabled={loading}
                  className="bg-red-600 hover:bg-red-700 text-white border-red-500/50"
                >
                  Delete
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>
      </CardFooter>
    </Card>
  );
}
