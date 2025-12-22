"use client";

import { useState } from "react";
import { Lightbulb } from "lucide-react";
import { Button } from "./ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "./ui/dialog";
import { useDeck } from "../context/deck-context";
import { getArchetypeName } from "../lib/helpers";

export default function DeckBuilderTips() {
  const { currentDeck, getDeckStats } = useDeck();
  const [isOpen, setIsOpen] = useState(false);

  const getTips = (): string[] => {
    const tips: string[] = [];
    const stats = getDeckStats();

    // Deck size tips
    if (stats.mainCount < 40) {
      tips.push(
        `Your Main Deck has ${stats.mainCount} cards. The minimum required is 40 cards for a legal deck.`,
      );
    } else if (stats.mainCount > 60) {
      tips.push(
        "Your Main Deck exceeds 60 cards. Consider reducing it to 40-60 cards for better consistency.",
      );
    } else if (stats.mainCount >= 40 && stats.mainCount <= 60) {
      tips.push(
        `Your Main Deck has ${stats.mainCount} cards. This is within the legal range (40-60 cards).`,
      );
    }

    // Composition tips
    if (stats.monsterCount > 25 && stats.mainCount > 30) {
      tips.push(
        "Your deck has a high monster count. Consider adding more Spell cards for balance and support.",
      );
    }
    if (stats.spellCount < 8 && stats.mainCount > 30) {
      tips.push(
        "Consider adding more Spell cards to support your monsters and provide utility.",
      );
    }
    if (stats.trapCount < 5 && stats.mainCount > 30) {
      tips.push(
        "Your deck could benefit from more Trap cards for protection and disruption.",
      );
    }

    // Balance tips
    if (stats.mainCount >= 40) {
      const monsterRatio = stats.monsterCount / stats.mainCount;
      const spellTrapRatio =
        (stats.spellCount + stats.trapCount) / stats.mainCount;

      if (monsterRatio > 0.6) {
        tips.push(
          "Your deck is heavily monster-focused. Consider adding more Spells and Traps for versatility.",
        );
      } else if (spellTrapRatio < 0.3) {
        tips.push(
          "Your deck has a low spell/trap count. Adding more support cards can improve consistency.",
        );
      }
    }

    // Extra deck tips
    if (stats.extraCount === 0 && stats.mainCount > 30) {
      tips.push(
        "Consider adding Extra Deck monsters (Fusion, Synchro, Xyz, or Link) to expand your options.",
      );
    } else if (stats.extraCount > 0 && stats.extraCount < 5) {
      tips.push(
        "Your Extra Deck is small. Consider adding more Extra Deck monsters for combo potential.",
      );
    }

    // Archetype tips
    const archetypes = new Map<string, number>();
    currentDeck.mainDeck.forEach((card) => {
      const archetypeName = getArchetypeName(card);
      if (archetypeName) {
        archetypes.set(archetypeName, (archetypes.get(archetypeName) || 0) + 1);
      }
    });

    if (archetypes.size === 0 && stats.mainCount > 10) {
      tips.push(
        "Your deck doesn't have a clear archetype. Consider focusing on a specific archetype for better synergy.",
      );
    } else if (archetypes.size > 3 && stats.mainCount < 40) {
      tips.push(
        "Your deck mixes multiple archetypes. Consider focusing on one or two for better consistency.",
      );
    }

    // General tips
    if (stats.mainCount === 0) {
      tips.push(
        "Start building your deck by adding cards from the Card Browser on the right. Drag and drop cards or double-click to add them.",
      );
      tips.push(
        "Use the search and filter options to find specific cards. You can filter by type, attribute, level, and more.",
      );
    }

    if (tips.length === 0 && stats.mainCount >= 40) {
      tips.push(
        "Your deck looks well-balanced! Consider testing it in the Deck Tester to see how it performs.",
      );
    }

    return tips;
  };

  const tips = getTips();

  return (
    <>
      <Button
        variant="ghost"
        size="icon"
        onClick={() => setIsOpen(true)}
        className="relative text-white/80 hover:text-white bg-white/10 hover:bg-white/15 border border-white/20 hover:border-white/30 transition-all focus:outline-none rounded-lg"
        title="View helpful tips"
      >
        <Lightbulb className="h-5 w-5" />
      </Button>

      <Dialog open={isOpen} onOpenChange={setIsOpen}>
        <DialogContent className="max-w-2xl bg-white/10 border border-white/20 backdrop-blur-xl">
          <DialogHeader className="pb-2">
            <div className="flex items-center gap-2">
              <Lightbulb className="h-5 w-5 text-yellow-400" />
              <DialogTitle
                className="text-xl text-slate-50"
                style={{ fontFamily: "var(--font-heading)" }}
              >
                Deck Building Tips
              </DialogTitle>
            </div>
            <DialogDescription className="text-slate-300 pt-2">
              Helpful suggestions to improve your deck building
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3 max-h-[60vh] overflow-y-auto pr-2">
            {tips.length === 0 ? (
              <p className="text-slate-300 text-sm">
                No tips available at this time.
              </p>
            ) : (
              tips.map((tip, index) => (
                <div
                  key={index}
                  className="flex gap-3 p-3 rounded-lg bg-white/5 border border-white/10 hover:border-white/20 transition-colors"
                >
                  <div className="flex-shrink-0 w-6 h-6 rounded-full bg-yellow-500/20 border border-yellow-500/40 flex items-center justify-center mt-0.5">
                    <span className="text-xs font-semibold text-yellow-400">
                      {index + 1}
                    </span>
                  </div>
                  <p className="text-sm text-slate-300 leading-relaxed flex-1">
                    {tip}
                  </p>
                </div>
              ))
            )}
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
