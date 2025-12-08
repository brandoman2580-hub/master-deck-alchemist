import type React from "react";
import { Card } from "@/types/card";
import { BanStatus, DeckType } from "@/types/types";
import {
  FLOODGATE_CARDS,
  POWERFUL_ARCHETYPE_CARDS,
  ROGUE_ARCHETYPE_CARDS,
} from "@/lib/constants";
import { getArchetypeName } from "@/lib/helpers";
import {
  Tag,
  Shuffle,
  BarChart,
  Sliders,
  ZapOff,
  ShieldOff,
  Sparkles,
  Sword,
  Layers,
  Trophy,
} from "lucide-react";

export interface DeckStats {
  mainCount: number;
  extraCount: number;
  sideCount: number;
  monsterCount: number;
  spellCount: number;
  trapCount: number;
}

export interface DeckAnalysis {
  playStyles: string[];
  tier: number | null;
}

/**
 * Check if a card belongs in the Extra Deck
 */
export function isExtraDeckCard(card: Card): boolean {
  return (
    card.type.includes("Fusion") ||
    card.type.includes("Synchro") ||
    card.type.includes("XYZ") ||
    card.type.includes("Link")
  );
}

/**
 * Calculate remaining copies of a card that can be added to deck
 */
export function getRemainingCopies(
  card: Card,
  currentDeck: DeckType,
  banlist: Record<string, BanStatus>,
): number {
  const banStatus = banlist[card.name] || "Unlimited";
  let maxCopies = 3;
  if (banStatus === "Limited") maxCopies = 1;
  if (banStatus === "Semi-Limited") maxCopies = 2;
  if (banStatus === "Forbidden") maxCopies = 0;

  // Count current copies in all deck sections
  const currentCopies = [
    ...currentDeck.mainDeck,
    ...currentDeck.extraDeck,
    ...currentDeck.sideDeck,
  ].filter((c) => c.id === card.id).length;

  return Math.max(0, maxCopies - currentCopies);
}

/**
 * Analyze deck to determine play style and tier
 */
export function analyzeDeck(
  currentDeck: DeckType,
  stats: DeckStats,
): DeckAnalysis {
  const playStyles: string[] = [];

  // Archetype detection (for combo, rogue/gimmicky)
  const archetypes = new Map<string, number>();
  currentDeck.mainDeck.forEach((card) => {
    const archetypeName = getArchetypeName(card);
    if (archetypeName) {
      archetypes.set(archetypeName, (archetypes.get(archetypeName) || 0) + 1);
    }
  });

  // Check for combo style: high archetype count or specific combo cards
  for (const [, count] of Array.from(archetypes.entries())) {
    if (count >= 8) {
      playStyles.push("Combo");
      break;
    }
  }

  // Check for midrange: balanced monster/spell/trap ratio
  if (
    stats.monsterCount / stats.mainCount > 0.4 &&
    stats.monsterCount / stats.mainCount < 0.6 &&
    stats.spellCount / stats.mainCount > 0.2 &&
    stats.trapCount / stats.mainCount > 0.05
  ) {
    playStyles.push("Midrange");
  }

  // Check for control: high trap count
  if (stats.trapCount > 10 && stats.trapCount / stats.mainCount > 0.2) {
    playStyles.push("Control");
  }

  // Check for stun: similar to control, but with floodgate cards
  const floodgateCards = currentDeck.mainDeck.filter((card) =>
    FLOODGATE_CARDS.includes(card.name),
  );
  if (floodgateCards.length >= 3) {
    playStyles.push("Stun");
    playStyles.push("Floodgate");
  }

  // Check for beatdown: high ATK monsters
  const highAtkMonsters = currentDeck.mainDeck.filter(
    (card) => card.type === "monster" && card.atk && Number(card.atk) >= 2500,
  );
  if (highAtkMonsters.length >= 6) {
    playStyles.push("Beatdown");
  }

  // Check for swarm: many monsters that summon themselves or others
  if (stats.monsterCount > 25 && stats.monsterCount / stats.mainCount > 0.6) {
    playStyles.push("Swarm");
  }

  // Rogue/gimmicky: decks with unusual archetypes or win conditions
  if (
    Array.from(archetypes.keys()).some((archetype) =>
      ROGUE_ARCHETYPE_CARDS.includes(archetype),
    )
  ) {
    playStyles.push("Rogue - Gimmicky");
  }

  // If no specific style is detected, mark as "Balanced"
  if (playStyles.length === 0 && stats.mainCount > 30) {
    playStyles.push("Balanced");
  }

  // Add "Incomplete" tag if deck is too small
  if (stats.mainCount < 40) {
    playStyles.push("Incomplete");
  }

  // Determine tier (competitive is not a playstyle but a tier/strength)
  let tier: number | null = null;

  if (stats.mainCount < 30) {
    tier = null; // Not enough cards to determine tier
  } else {
    // Check for powerful archetypes
    const hasPowerfulArchetype = Array.from(archetypes.keys()).some(
      (archetype) => POWERFUL_ARCHETYPE_CARDS.includes(archetype),
    );

    // Check for balanced composition
    const hasBalancedComposition =
      stats.monsterCount >= 16 &&
      stats.spellCount >= 10 &&
      stats.trapCount >= 5;

    // Tier calculation based on archetype and composition
    if (hasPowerfulArchetype && hasBalancedComposition) {
      tier = 1; // Top tier
    } else if (hasPowerfulArchetype || hasBalancedComposition) {
      tier = 2; // Competitive
    } else {
      tier = 3; // Playable
    }
  }

  return { playStyles, tier };
}

/**
 * Export deck as JSON file
 */
export function exportDeckAsFile(deckData: string, deckName: string): void {
  const blob = new Blob([deckData], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `${deckName || "yugioh-deck"}.json`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

/**
 * Playstyle icon mapping
 */
const playstyleIcons: Record<string, React.ElementType> = {
  combo: Shuffle,
  midrange: BarChart,
  control: Sliders,
  stun: ZapOff,
  floodgate: ShieldOff,
  competitive: Trophy,
  "rogue - gimmicky": Sparkles,
  beatdown: Sword,
  swarm: Layers,
};

/**
 * Get the icon component for a playstyle
 */
export function getPlaystyleIcon(style: string): React.ElementType {
  // Normalize style string to match keys
  const key = style.toLowerCase();
  return playstyleIcons[key] || Tag; // fallback to Tag if not found
}

/**
 * Determine which deck section a target belongs to based on target ID
 */
export function getDeckSectionFromTarget(
  targetId: string,
  currentDeck: DeckType,
): "mainDeck" | "extraDeck" | "sideDeck" | null {
  // Direct drop zone targets
  if (targetId === "main-deck") return "mainDeck";
  if (targetId === "extra-deck") return "extraDeck";
  if (targetId === "side-deck") return "sideDeck";

  // Check if dropping on an existing card in a deck section
  const sections: ("mainDeck" | "extraDeck" | "sideDeck")[] = [
    "mainDeck",
    "extraDeck",
    "sideDeck",
  ];
  for (const section of sections) {
    const found = currentDeck[section].find(
      (c) => c.deckInstanceId === targetId,
    );
    if (found) return section;
  }

  return null;
}

