"use client";

import { useState, useMemo } from "react";
import Image from "next/image";
import { motion } from "framer-motion";
import { Card } from "../ui/card";
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
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "../ui/dropdown-menu";
import { Edit, Trash2, Clock, Pin, Layers, Zap, Shield, Copy, ChevronDown } from "lucide-react";
import { resolveCardImageUrl } from "../../lib/card-image-url";
import { DeckType } from "../../types/types";
import type { Card as CardType } from "../../types/card";

interface DeckMediaCardProps {
  deck: DeckType;
  onLoad: (id: string) => void;
  onCopy: (deck: DeckType, options?: { targetMode?: "TCG" | "Master Duel"; name?: string }) => void;
  onDelete: (id: string) => void;
  onTogglePin: (id: string, isPinned: boolean) => void;
  loading?: boolean;
  formatDate: (dateString: string) => string;
}

/**
 * Media Card Component for Deck Display
 * Shows a preview image of a deck card with modern, trendy design
 */
export function DeckMediaCard({
  deck,
  onLoad,
  onCopy,
  onDelete,
  onTogglePin,
  loading = false,
  formatDate,
}: DeckMediaCardProps) {
  const [imageError, setImageError] = useState(false);

  // Get preview card - prefer first card from main deck, or first available card
  const previewCard = useMemo(() => {
    if (deck.mainDeck.length > 0) {
      return deck.mainDeck[0];
    }
    if (deck.extraDeck.length > 0) {
      return deck.extraDeck[0];
    }
    if (deck.sideDeck.length > 0) {
      return deck.sideDeck[0];
    }
    return null;
  }, [deck]);

  const cardImageUrl = useMemo(() => {
    if (!previewCard) return null;
    const card = previewCard as CardType;
    const url = resolveCardImageUrl(card.id, card.card_images, {
      preferSmall: false,
    });
    return url === "/placeholder.svg" ? null : url;
  }, [previewCard]);

  const shouldTruncate = deck.name.length > 30;
  const displayName = shouldTruncate
    ? `${deck.name.slice(0, 30)}...`
    : deck.name;

  const totalCards = deck.mainDeck.length + deck.extraDeck.length + deck.sideDeck.length;

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
    >
      <Card className="group relative overflow-hidden bg-white/5 border border-white/10 hover:border-white/20 transition-all duration-300 hover:shadow-xl hover:shadow-white/5 rounded-2xl">
        {/* Image Preview Section */}
        <div className="relative h-48 sm:h-56 overflow-hidden bg-gradient-to-br from-white/10 to-white/5 rounded-t-2xl">
          {cardImageUrl && !imageError ? (
            <>
              <Image
                src={cardImageUrl}
                alt={previewCard?.name || deck.name || "Deck preview"}
                fill
                className="object-cover object-center transition-transform duration-500 group-hover:scale-110"
                sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
                onError={() => setImageError(true)}
                unoptimized
                priority={false}
              />
              {/* Gradient overlays for better text readability */}
              <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/40 to-transparent" />
              {/* Additional top overlay for deck name readability */}
              <div className="absolute top-0 left-0 right-0 h-32 bg-gradient-to-b from-black/90 via-black/60 to-transparent" />
            </>
          ) : (
            <div className="absolute inset-0 flex items-center justify-center bg-gradient-to-br from-white/10 via-white/5 to-transparent">
              <div className="text-center">
                <Layers className="h-16 w-16 text-white/30 mx-auto mb-2" />
                <p className="text-white/40 text-xs font-medium">{totalCards} cards</p>
              </div>
            </div>
          )}

          {/* Header Overlay */}
          <div className="absolute top-0 left-0 right-0 p-4 flex items-start justify-between gap-2 z-10">
            <div className="flex-1 min-w-0">
              {shouldTruncate ? (
                <TooltipProvider delayDuration={200}>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <h3 className="text-white font-bold text-lg font-display truncate cursor-help drop-shadow-lg">
                        {displayName}
                      </h3>
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
                <h3 className="text-white font-bold text-lg font-display drop-shadow-lg">
                  {displayName}
                </h3>
              )}
              <Badge
                variant="secondary"
                className="mt-1.5 text-xs font-medium bg-white/20 text-white border-white/30 backdrop-blur-sm font-display"
              >
                {deck.mode}
              </Badge>
            </div>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => onTogglePin(deck.id, !deck.isPinned)}
              className={`h-8 w-8 flex-shrink-0 bg-white/10 hover:bg-white/20 border border-white/20 backdrop-blur-sm ${
                deck.isPinned
                  ? "text-white"
                  : "text-white/70 hover:text-white"
              }`}
              aria-pressed={deck.isPinned}
              aria-label={deck.isPinned ? "Unpin deck" : "Pin deck"}
            >
              <Pin className={`h-4 w-4 ${deck.isPinned ? "fill-current" : ""}`} />
            </Button>
          </div>

          {/* Stats Overlay at Bottom */}
          <div className="absolute bottom-0 left-0 right-0 p-4 z-10">
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-1.5 bg-white/10 backdrop-blur-md px-2.5 py-1.5 rounded-lg border border-white/20">
                <Layers className="h-3.5 w-3.5 text-white/90" />
                <span className="text-white font-bold text-sm font-display">
                  {deck.mainDeck.length}
                </span>
              </div>
              <div className="flex items-center gap-1.5 bg-white/10 backdrop-blur-md px-2.5 py-1.5 rounded-lg border border-white/20">
                <Zap className="h-3.5 w-3.5 text-white/90" />
                <span className="text-white font-bold text-sm font-display">
                  {deck.extraDeck.length}
                </span>
              </div>
              {deck.mode === "TCG" && (
                <div className="flex items-center gap-1.5 bg-white/10 backdrop-blur-md px-2.5 py-1.5 rounded-lg border border-white/20">
                  <Shield className="h-3.5 w-3.5 text-white/90" />
                  <span className="text-white font-bold text-sm font-display">
                    {deck.sideDeck.length}
                  </span>
                </div>
              )}
              <div className="ml-auto flex items-center gap-1 text-white/80 text-xs">
                <Clock className="h-3 w-3" />
                <span className="font-medium">
                  {deck.updated_at ? formatDate(deck.updated_at) : "Unknown"}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Actions Section */}
        <div className="p-4 bg-white/5 border-t border-white/10">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => onLoad(deck.id)}
                disabled={loading}
                className="flex-1 bg-white/10 hover:bg-white/20 border-white/20 text-white hover:text-white"
              >
                <Edit className="h-4 w-4 mr-2" />
                Edit
              </Button>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={loading}
                    className="bg-white/10 hover:bg-white/20 border-white/20 text-white hover:text-white"
                  >
                    <Copy className="h-4 w-4 mr-2" />
                    Copy
                    <ChevronDown className="h-4 w-4 ml-1" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="start" className="min-w-[180px]">
                  <DropdownMenuItem
                    onClick={() => onCopy(deck)}
                    className="text-white focus:bg-white/10 focus:text-white cursor-pointer"
                  >
                    <Copy className="h-4 w-4 mr-2" />
                    Copy (same format)
                  </DropdownMenuItem>
                  {deck.mode === "TCG" && (
                    <DropdownMenuItem
                      onClick={() => onCopy(deck, { targetMode: "Master Duel", name: `${deck.name} (Master Duel)` })}
                      className="text-white focus:bg-white/10 focus:text-white cursor-pointer"
                    >
                      <Copy className="h-4 w-4 mr-2" />
                      Copy as Master Duel
                    </DropdownMenuItem>
                  )}
                  {deck.mode === "Master Duel" && (
                    <DropdownMenuItem
                      onClick={() => onCopy(deck, { targetMode: "TCG", name: `${deck.name} (TCG)` })}
                      className="text-white focus:bg-white/10 focus:text-white cursor-pointer"
                    >
                      <Copy className="h-4 w-4 mr-2" />
                      Copy as TCG
                    </DropdownMenuItem>
                  )}
                </DropdownMenuContent>
              </DropdownMenu>
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button
                    variant="destructive"
                    size="sm"
                    disabled={loading}
                    className="bg-red-500/20 hover:bg-red-500/30 border-red-500/30 text-red-200 hover:text-red-100"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent className="bg-white/10 border-white/20 backdrop-blur-xl">
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
                    <AlertDialogCancel className="bg-white/10 border-white/20 text-white hover:bg-white/20">
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
            <div className="text-xs text-white/60 font-medium">
              {totalCards} cards
            </div>
          </div>
        </div>
      </Card>
    </motion.div>
  );
}
