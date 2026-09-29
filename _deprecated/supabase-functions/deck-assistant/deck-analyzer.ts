/**
 * Rule-based deck analysis (no LLM calls)
 * Analyzes deck composition and generates structured analysis
 * This is cached in deck_embeddings_cache for efficiency
 */

import type { Card, Deck, DeckCard, DeckAnalysis, DeckStats } from "./types.ts";

/**
 * Detect card role based on card description
 */
function detectCardRole(card: Card): string[] {
  const roles: string[] = [];
  const desc = (card.desc || "").toLowerCase();
  
  // Starter: cards that search/summon from deck
  if (
    desc.includes('search') || 
    (desc.includes('add') && desc.includes('deck')) ||
    (desc.includes('special summon') && desc.includes('deck'))
  ) {
    roles.push('starter');
  }
  
  // Extender: cards that continue combos
  if (
    (desc.includes('special summon') && (desc.includes('hand') || desc.includes('gy'))) ||
    desc.includes('send to') ||
    desc.includes('mill') ||
    (desc.includes('discard') && desc.includes('draw'))
  ) {
    roles.push('extender');
  }
  
  // Interruption: hand traps, quick effects that negate
  if (
    ((desc.includes('negate') || desc.includes('destroy')) && 
     (desc.includes('quick effect') || desc.includes('opponent'))) ||
    (desc.includes('hand') && desc.includes('quick effect'))
  ) {
    roles.push('interruption');
  }
  
  // Searcher: cards that search/add cards
  if (
    desc.includes('search') ||
    (desc.includes('add') && (desc.includes('deck') || desc.includes('hand')))
  ) {
    roles.push('searcher');
  }
  
  // Removal: cards that destroy/banish/return
  if (
    desc.includes('destroy') ||
    desc.includes('banish') ||
    (desc.includes('return') && desc.includes('hand'))
  ) {
    roles.push('removal');
  }
  
  return roles;
}

/**
 * Count cards by role in a deck section
 */
function countCardsByRole(
  cards: Card[],
  role: string
): number {
  return cards.filter(card => detectCardRole(card).includes(role)).length;
}

/**
 * Get archetype name from card
 * Matches the logic from lib/helpers.ts
 */
function getArchetypeName(card: Card): string | null {
  // First check if card has explicit archetype field
  if (card.archetype) {
    return card.archetype;
  }
  
  // Try to extract from name (common patterns)
  const name = card.name.toLowerCase();
  
  // Common archetype suffixes/patterns
  const archetypePatterns = [
    /^(.+?)\s+(dragon|warrior|spellcaster|fairy|fiend|zombie|machine|aqua|pyro|rock|winged beast|beast|beast-warrior|insect|plant|reptile|thunder|sea serpent|dinosaur|fish|psychic)/i,
    /^(.+?)\s+(the|of|and)/i, // "Blue-Eyes White Dragon", "Dark Magician"
  ];
  
  for (const pattern of archetypePatterns) {
    const match = name.match(pattern);
    if (match && match[1] && match[1].trim().length > 2) {
      return match[1].trim();
    }
  }
  
  // If no pattern matches, return null
  return null;
}

/**
 * Calculate deck statistics
 */
function calculateDeckStats(
  deck: Deck,
  allCards: Card[]
): DeckStats {
  const cardMap = new Map(allCards.map(c => [c.id, c]));
  
  let monsterCount = 0;
  let spellCount = 0;
  let trapCount = 0;
  
  const processSection = (section: DeckCard[]) => {
    section.forEach(deckCard => {
      const card = cardMap.get(deckCard.cardId);
      if (!card) return;
      
      const count = deckCard.count || 1;
      const type = card.type.toLowerCase();
      
      if (type.includes('monster')) {
        monsterCount += count;
      } else if (type.includes('spell')) {
        spellCount += count;
      } else if (type.includes('trap')) {
        trapCount += count;
      }
    });
  };
  
  processSection(deck.mainDeck);
  
  return {
    mainCount: deck.mainDeck.length,
    extraCount: deck.extraDeck.length,
    sideCount: deck.sideDeck.length,
    monsterCount,
    spellCount,
    trapCount,
  };
}

/**
 * Analyze deck composition and generate structured analysis
 * Rule-based analysis (no LLM calls) for efficiency
 */
export async function analyzeDeck(
  deck: Deck,
  allCards: Card[]
): Promise<DeckAnalysis> {
  const stats = calculateDeckStats(deck, allCards);
  const cardMap = new Map(allCards.map(c => [c.id, c]));
  
  // Get main deck cards
  const mainCards = deck.mainDeck
    .map(dc => cardMap.get(dc.cardId))
    .filter((c): c is Card => c !== undefined);
  
  // Archetype detection
  const archetypes = new Map<string, number>();
  mainCards.forEach(card => {
    const archetypeName = getArchetypeName(card);
    if (archetypeName) {
      archetypes.set(archetypeName, (archetypes.get(archetypeName) || 0) + 1);
    }
  });
  
  const archetypeArray = Array.from(archetypes.entries())
    .sort((a, b) => b[1] - a[1]);
  
  const primaryArchetype = archetypeArray.length > 0 && archetypeArray[0][1] >= 3
    ? archetypeArray[0][0]
    : null;
  
  // Card role detection
  const cardRoles = {
    starters: countCardsByRole(mainCards, 'starter'),
    extenders: countCardsByRole(mainCards, 'extender'),
    interruptions: countCardsByRole(mainCards, 'interruption'),
    searchers: countCardsByRole(mainCards, 'searcher'),
    removals: countCardsByRole(mainCards, 'removal'),
  };
  
  // Determine playstyle
  const ratios = {
    monsters: stats.monsterCount,
    spells: stats.spellCount,
    traps: stats.trapCount,
  };
  
  const monsterPercent = stats.mainCount > 0 
    ? (stats.monsterCount / stats.mainCount) * 100 
    : 0;
  const trapPercent = stats.mainCount > 0 
    ? (stats.trapCount / stats.mainCount) * 100 
    : 0;
  
  let playstyle: DeckAnalysis['playstyle'] = 'hybrid';
  
  // Stun: High trap count + low starters
  if (trapPercent > 30 && cardRoles.starters < 5) {
    playstyle = 'stall';
  }
  // Control: Moderate traps + interruptions
  else if (trapPercent > 20 && cardRoles.interruptions > 5) {
    playstyle = 'control';
  }
  // Combo: High monster count + many starters/extenders
  else if (monsterPercent > 60 && (cardRoles.starters + cardRoles.extenders) > 10) {
    playstyle = 'combo';
  }
  // Aggro: High monster count + low starters
  else if (monsterPercent > 65 && cardRoles.starters < 5) {
    playstyle = 'aggro';
  }
  
  // Identify key effects
  const keyEffects: string[] = [];
  mainCards.forEach(card => {
    const desc = (card.desc || "").toLowerCase();
    if (desc.includes('negate') && !keyEffects.includes('negation')) {
      keyEffects.push('negation');
    }
    if (desc.includes('search') && !keyEffects.includes('search')) {
      keyEffects.push('search');
    }
    if (desc.includes('special summon') && !keyEffects.includes('special summon')) {
      keyEffects.push('special summon');
    }
    if (desc.includes('draw') && !keyEffects.includes('draw')) {
      keyEffects.push('draw');
    }
  });
  
  // Identify weaknesses
  const weaknesses: string[] = [];
  
  // Low starter count
  if (cardRoles.starters < 5 && stats.mainCount >= 40) {
    weaknesses.push('low starter count');
  }
  
  // Low interruption count
  if (cardRoles.interruptions < 3 && stats.mainCount >= 40) {
    weaknesses.push('low interruption count');
  }
  
  // High monster ratio (potential bricking)
  if (monsterPercent > 70 && cardRoles.starters < 8) {
    weaknesses.push('high monster ratio without sufficient starters');
  }
  
  // No clear archetype
  if (!primaryArchetype && stats.mainCount >= 40) {
    weaknesses.push('no clear archetype focus');
  }
  
  return {
    archetype: primaryArchetype,
    playstyle,
    cardRoles,
    ratios,
    deckSize: {
      main: stats.mainCount,
      extra: stats.extraCount,
      side: stats.sideCount,
    },
    keyEffects,
    weaknesses,
  };
}

/**
 * Build deck context text for embedding generation
 * Creates concise but comprehensive deck description
 */
export function buildDeckContextText(
  deck: Deck,
  allCards: Card[]
): string {
  const cardMap = new Map(allCards.map(c => [c.id, c]));
  
  const sections: string[] = [];
  
  if (deck.mainDeck.length > 0) {
    sections.push(`Main Deck (${deck.mainDeck.length}):`);
    deck.mainDeck.slice(0, 20).forEach(dc => {
      const card = cardMap.get(dc.cardId);
      if (card) {
        const desc = card.desc ? `: ${card.desc.substring(0, 100)}` : '';
        sections.push(`- ${card.name} (${card.type})${desc}`);
      }
    });
    if (deck.mainDeck.length > 20) {
      sections.push(`... and ${deck.mainDeck.length - 20} more cards`);
    }
  }
  
  if (deck.extraDeck.length > 0) {
    sections.push(`Extra Deck (${deck.extraDeck.length}):`);
    deck.extraDeck.forEach(dc => {
      const card = cardMap.get(dc.cardId);
      if (card) {
        sections.push(`- ${card.name} (${card.type})`);
      }
    });
  }
  
  if (deck.sideDeck.length > 0) {
    sections.push(`Side Deck (${deck.sideDeck.length}):`);
    deck.sideDeck.forEach(dc => {
      const card = cardMap.get(dc.cardId);
      if (card) {
        sections.push(`- ${card.name} (${card.type})`);
      }
    });
  }
  
  return sections.join('\n');
}
