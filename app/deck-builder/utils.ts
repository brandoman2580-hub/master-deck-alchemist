import type React from "react";
import { Card } from "@/types/card";
import { BanStatus, DeckType } from "@/types/types";
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
import { countCardsByRole } from "@/lib/analysis/cardRoleDetector";

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

export interface EnhancedDeckAnalysis {
  // Existing fields (keep these)
  playstyle: 'Combo' | 'Midrange' | 'Control' | 'Stun' | 'Beatdown' | 'Balanced';
  tier: number | null;
  
  // NEW: Detailed counts
  deckSize: number;
  mainDeckSize: number;
  extraDeckSize: number;
  sideDeckSize: number;
  
  // NEW: Ratios
  ratios: {
    monsters: number;
    spells: number;
    traps: number;
    monstersPercent: number;
    spellsPercent: number;
    trapsPercent: number;
  };
  
  // NEW: Archetype distribution
  archetypes: {
    name: string;
    count: number;
    percentage: number;
  }[];
  primaryArchetype: string | null; // Most common archetype
  
  // NEW: Card role detection
  cardRoles: {
    starters: number;
    extenders: number;
    interruptions: number;
    boardBreakers: number;
    endBoardPieces: number;
  };
  
  // NEW: Win condition inference
  winCondition: 'OTK' | 'Control' | 'Grind' | 'Lock' | 'Burn' | 'Unknown';
  
  // NEW: Brick probability estimation
  estimatedBrickRate: number; // 0.0-1.0
  
  // NEW: Missing staples (placeholder - will be populated by comparing against archetype_staples)
  missingStaples: {
    cardName: string;
    reason: string;
  }[];
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
 * Analyze deck to determine play style and tier (legacy function for backward compatibility)
 */
export function analyzeDeck(
  currentDeck: DeckType,
  stats: DeckStats,
): DeckAnalysis {
  const enhanced = analyzeDeckEnhanced(currentDeck, stats);
  return {
    playStyles: [enhanced.playstyle],
    tier: enhanced.tier,
  };
}

/**
 * Enhanced deck analysis with detailed metrics
 */
export function analyzeDeckEnhanced(
  currentDeck: DeckType,
  stats: DeckStats,
): EnhancedDeckAnalysis {
  const allCards = [...currentDeck.mainDeck, ...currentDeck.extraDeck, ...currentDeck.sideDeck];
  const mainCards = currentDeck.mainDeck;
  
  // Calculate sizes
  const deckSize = allCards.length;
  const mainDeckSize = stats.mainCount;
  const extraDeckSize = stats.extraCount;
  const sideDeckSize = stats.sideCount;
  
  // Calculate ratios
  const ratios = {
    monsters: stats.monsterCount,
    spells: stats.spellCount,
    traps: stats.trapCount,
    monstersPercent: mainDeckSize > 0 ? (stats.monsterCount / mainDeckSize) * 100 : 0,
    spellsPercent: mainDeckSize > 0 ? (stats.spellCount / mainDeckSize) * 100 : 0,
    trapsPercent: mainDeckSize > 0 ? (stats.trapCount / mainDeckSize) * 100 : 0,
  };
  
  // Archetype detection
  const archetypes = new Map<string, number>();
  mainCards.forEach((card) => {
    const archetypeName = getArchetypeName(card);
    if (archetypeName) {
      archetypes.set(archetypeName, (archetypes.get(archetypeName) || 0) + 1);
    }
  });
  
  // Sort archetypes by count
  const archetypeArray = Array.from(archetypes.entries())
    .map(([name, count]) => ({
      name,
      count,
      percentage: mainDeckSize > 0 ? (count / mainDeckSize) * 100 : 0,
    }))
    .sort((a, b) => b.count - a.count);
  
  const primaryArchetype = archetypeArray.length > 0 ? archetypeArray[0].name : null;
  
  // Detect card roles
  const cardRoles = {
    starters: countCardsByRole(mainCards, 'starter'),
    extenders: countCardsByRole(mainCards, 'extender'),
    interruptions: countCardsByRole(mainCards, 'interruption'),
    boardBreakers: countCardsByRole(mainCards, 'board_breaker'),
    endBoardPieces: countCardsByRole(mainCards, 'end_board_piece'),
  };
  
  // Determine playstyle using improved heuristics
  let playstyle: EnhancedDeckAnalysis['playstyle'] = 'Balanced';
  
  // Stun: High trap count + floodgates + low starters
  if (ratios.trapsPercent > 30 && cardRoles.starters < 5) {
    playstyle = 'Stun';
  }
  // Control: Moderate traps + interruptions
  else if (ratios.trapsPercent > 20 && cardRoles.interruptions > 5) {
    playstyle = 'Control';
  }
  // Combo: High monster count + many starters/extenders
  else if (ratios.monstersPercent > 60 && (cardRoles.starters + cardRoles.extenders) > 10) {
    playstyle = 'Combo';
  }
  // Beatdown: High monster count + low starters
  else if (ratios.monstersPercent > 65 && cardRoles.starters < 5) {
    playstyle = 'Beatdown';
  }
  // Midrange: Balanced composition
  else if (
    ratios.monstersPercent >= 40 &&
    ratios.monstersPercent <= 60 &&
    ratios.spellsPercent >= 15 &&
    ratios.trapsPercent >= 5
  ) {
    playstyle = 'Midrange';
  }
  
  // Infer win condition
  let winCondition: EnhancedDeckAnalysis['winCondition'] = 'Unknown';
  const burnCards = mainCards.filter(card => 
    (card.desc || "").toLowerCase().includes('damage') || 
    (card.desc || "").toLowerCase().includes('burn')
  );
  
  if (burnCards.length >= 3) {
    winCondition = 'Burn';
  } else if (playstyle === 'Stun' || cardRoles.endBoardPieces > 8) {
    winCondition = 'Lock';
  } else if (playstyle === 'Combo' || playstyle === 'Beatdown') {
    winCondition = 'OTK';
  } else if (playstyle === 'Control') {
    winCondition = 'Grind';
  } else if (mainDeckSize >= 40) {
    winCondition = 'Grind';
  }
  
  // Calculate brick rate based on starter ratio vs ideal
  let estimatedBrickRate = 0.0;
  if (mainDeckSize > 0) {
    const idealStarterRatio = mainDeckSize >= 50 ? 0.15 : 0.10; // 15% for 60-card, 10% for 40-card
    const actualStarterRatio = cardRoles.starters / mainDeckSize;
    const starterDeficit = idealStarterRatio - actualStarterRatio;
    
    if (starterDeficit > 0.05) {
      estimatedBrickRate = 0.4; // High brick rate
    } else if (starterDeficit > 0.02) {
      estimatedBrickRate = 0.25; // Moderate brick rate
    } else {
      estimatedBrickRate = 0.1; // Low brick rate
    }
  }
  
  // Determine tier
  let tier: number | null = null;
  if (mainDeckSize >= 40) {
    const hasArchetype = primaryArchetype && archetypeArray[0].percentage > 30;
    const hasGoodRoleBalance = 
      cardRoles.starters >= 5 &&
      cardRoles.interruptions >= 3 &&
      (cardRoles.extenders >= 3 || playstyle !== 'Combo');
    
    if (hasArchetype && hasGoodRoleBalance) {
      tier = 2;
    } else if (hasArchetype || hasGoodRoleBalance) {
      tier = 3;
    } else {
      tier = 4;
    }
  }
  
  // Detect missing staples based on playstyle
  const missingStaples: EnhancedDeckAnalysis['missingStaples'] = [];
  const deckCardNames = new Set(mainCards.map(c => c.name.toLowerCase()));
  
  // Combo/Midrange decks should have Ash Blossom
  if ((playstyle === 'Combo' || playstyle === 'Midrange') && 
      !deckCardNames.has('ash blossom & joyous spring')) {
    missingStaples.push({
      cardName: 'Ash Blossom & Joyous Spring',
      reason: 'Essential hand trap for combo/midrange decks'
    });
  }
  
  // Control decks should have Solemn Judgment
  if (playstyle === 'Control' && 
      !deckCardNames.has('solemn judgment')) {
    missingStaples.push({
      cardName: 'Solemn Judgment',
      reason: 'Core counter trap for control decks'
    });
  }
  
  // Decks with low interaction should have hand traps
  if (cardRoles.interruptions < 3 && 
      !deckCardNames.has('ash blossom & joyous spring') &&
      !deckCardNames.has('effect veiler')) {
    missingStaples.push({
      cardName: 'Hand Traps',
      reason: 'Deck lacks interaction for going second'
    });
  }
  
  return {
    playstyle,
    tier,
    deckSize,
    mainDeckSize,
    extraDeckSize,
    sideDeckSize,
    ratios,
    archetypes: archetypeArray,
    primaryArchetype,
    cardRoles,
    winCondition,
    estimatedBrickRate,
    missingStaples,
  };
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
  // Direct drop zone targets (support both camelCase and kebab-case for compatibility)
  if (targetId === "mainDeck" || targetId === "main-deck") return "mainDeck";
  if (targetId === "extraDeck" || targetId === "extra-deck") return "extraDeck";
  if (targetId === "sideDeck" || targetId === "side-deck") return "sideDeck";

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

