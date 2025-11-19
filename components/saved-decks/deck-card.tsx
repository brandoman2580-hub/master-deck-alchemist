"use client";

import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
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
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { Edit, Trash2, Clock, Pin } from "lucide-react";
import { DeckType } from "@/types/types";

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
  const displayName = shouldTruncate ? `${deck.name.slice(0, 25)}...` : deck.name;

  return (
    <Card className="bg-gradient-to-b from-cyan-400/20 via-cyan-500/15 to-cyan-600/5 backdrop-blur-md border border-cyan-500/30 rounded-2xl">
      <CardHeader>
        <div className="flex items-start justify-between gap-2">
          <div className="flex items-center gap-2 flex-1 min-w-0">
            {shouldTruncate ? (
              <TooltipProvider delayDuration={200}>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <CardTitle 
                      className="text-slate-50 truncate cursor-help" 
                      style={{ fontFamily: "var(--font-heading)" }}
                    >
                      {displayName}
                    </CardTitle>
                  </TooltipTrigger>
                  <TooltipContent
                    className="bg-gradient-to-b from-cyan-400/20 via-cyan-500/15 to-cyan-600/5 backdrop-blur-md border border-cyan-500/30 text-slate-50 shadow-[0_0_20px_rgba(56,189,248,0.25)] max-w-xs"
                    side="top"
                  >
                    <p className="font-medium">{deck.name}</p>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            ) : (
              <CardTitle 
                className="text-slate-50 truncate" 
                style={{ fontFamily: "var(--font-heading)" }}
              >
                {displayName}
              </CardTitle>
            )}
            <Badge
              variant="secondary"
              className="text-xs font-medium pointer-events-none border bg-cyan-500/40 border-cyan-400/60 text-cyan-100 whitespace-nowrap"
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
                ? "text-cyan-400 hover:text-cyan-300"
                : "text-slate-400 hover:text-cyan-400"
            }`}
            aria-pressed={deck.isPinned}
            aria-label={deck.isPinned ? "Unpin deck" : "Pin deck"}
          >
            <Pin className={`h-4 w-4 ${deck.isPinned ? "fill-current" : ""}`} />
          </Button>
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
            onClick={() => onLoad(deck.id)}
            disabled={loading}
          >
            <Edit className="h-4 w-4 mr-2" />
            Edit
          </Button>
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button
                variant="destructive"
                size="sm"
                disabled={loading}
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent className="bg-gradient-to-b from-cyan-400/20 via-cyan-500/15 to-cyan-600/5 backdrop-blur-md border border-cyan-500/30">
              <AlertDialogHeader>
                <AlertDialogTitle className="text-slate-50" style={{ fontFamily: "var(--font-heading)" }}>
                  Delete Deck
                </AlertDialogTitle>
                <AlertDialogDescription className="text-slate-300">
                  Are you sure you want to delete {deck.name}? This action cannot be undone.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                <AlertDialogAction
                  onClick={() => onDelete(deck.id)}
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
  );
}

