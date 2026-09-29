/**
 * Phase 2: Synergy Scoring
 * Calculates how well a candidate card synergizes with the current deck
 */

import type { CardCandidate } from "../_shared/cardSearch.ts";
import type { EnhancedDeckAnalysis } from "../_shared/intentClassifier.ts";

const ENABLE_SYNERGY_SCORING = Deno.env.get("ENABLE_SYNERGY_SCORING") !== "false"; // Default: true

/**
 * Calculate synergy score for a candidate card with the current deck
 */
export function calculateSynergyScore(
  candidate: CardCandidate,
  deckCards: Array<{ id: number; type?: string; race?: string; attribute?: string; archetype?: string | null; level?: number }>,
  deckAnalysis: EnhancedDeckAnalysis | undefined,
): number {
  if (!ENABLE_SYNERGY_SCORING) {
    return 0.5; // Neutral score if disabled
  }

  let synergyScore = 0.0;

  // 1. Archetype match score
  if (deckAnalysis?.primaryArchetype && candidate.archetype) {
    const deckArchetype = deckAnalysis.primaryArchetype.toLowerCase();
    const cardArchetype = candidate.archetype.toLowerCase();
    
    if (cardArchetype === deckArchetype || 
        cardArchetype.includes(deckArchetype) || 
        deckArchetype.includes(cardArchetype)) {
      synergyScore += 1.0; // Perfect match
    } else {
      // Check for complementary archetypes (e.g., Branded/Despia)
      const complementaryArchetypes: Record<string, string[]> = {
        "branded": ["despia", "bytsial"],
        "despia": ["branded", "bytsial"],
        "tearlaments": ["ishizu"],
        "spright": ["gigantic", "elf"],
      };
      
      const complementary = complementaryArchetypes[deckArchetype] || [];
      if (complementary.some(arch => cardArchetype.includes(arch))) {
        synergyScore += 0.5;
      }
    }
  }

  // 2. Type synergy
  if (deckAnalysis && deckCards.length > 0) {
    // Count types in deck
    const typeCounts = new Map<string, number>();
    deckCards.forEach(card => {
      if (card.type) {
        const baseType = card.type.split(" ")[0]; // "Effect Monster" -> "Effect"
        typeCounts.set(baseType, (typeCounts.get(baseType) || 0) + 1);
      }
    });

    // Boost if candidate matches dominant type
    const dominantType = Array.from(typeCounts.entries())
      .sort((a, b) => b[1] - a[1])[0]?.[0];
    
    if (dominantType && candidate.type?.includes(dominantType)) {
      const typeRatio = (typeCounts.get(dominantType) || 0) / deckCards.length;
      if (typeRatio >= 0.3) {
        synergyScore += 0.2;
      }
    }
  }

  // 2.5. Race/Attribute synergy (generic effect matching)
  // This helps discover hidden synergies like Dragolithia Kunzite → Blue-Eyes (Dragon support)
  if (deckCards.length > 0 && candidate.desc) {
    const desc = candidate.desc.toLowerCase();
    
    // Count races in deck
    const raceCounts = new Map<string, number>();
    deckCards.forEach(card => {
      if (card.race) {
        raceCounts.set(card.race, (raceCounts.get(card.race) || 0) + 1);
      }
    });
    
    // Count attributes in deck
    const attributeCounts = new Map<string, number>();
    deckCards.forEach(card => {
      if (card.attribute) {
        attributeCounts.set(card.attribute, (attributeCounts.get(card.attribute) || 0) + 1);
      }
    });

    // Find dominant race and attribute
    const dominantRace = Array.from(raceCounts.entries())
      .sort((a, b) => b[1] - a[1])[0]?.[0];
    const dominantAttribute = Array.from(attributeCounts.entries())
      .sort((a, b) => b[1] - a[1])[0]?.[0];

    // Check if candidate mentions dominant race in effect text
    if (dominantRace) {
      const raceRatio = (raceCounts.get(dominantRace) || 0) / deckCards.length;
      if (raceRatio >= 0.2) { // At least 20% of deck is this race
        const raceLower = dominantRace.toLowerCase();
        // Check if card effect mentions the race (generic support)
        if (desc.includes(raceLower) || 
            (candidate.race && candidate.race.toLowerCase() === raceLower)) {
          // Boost generic race support cards
          synergyScore += 0.4 * raceRatio; // Scale by how dominant the race is
        }
      }
    }

    // Check if candidate mentions dominant attribute in effect text
    if (dominantAttribute) {
      const attributeRatio = (attributeCounts.get(dominantAttribute) || 0) / deckCards.length;
      if (attributeRatio >= 0.2) { // At least 20% of deck is this attribute
        const attributeLower = dominantAttribute.toLowerCase();
        // Check if card effect mentions the attribute (generic support)
        if (desc.includes(attributeLower) || 
            (candidate.attribute && candidate.attribute.toLowerCase() === attributeLower)) {
          // Boost generic attribute support cards
          synergyScore += 0.3 * attributeRatio; // Scale by how dominant the attribute is
        }
      }
    }

    // Check for generic "Dragon" support (common example)
    if (dominantRace && dominantRace.toLowerCase() === "dragon") {
      const dragonRatio = (raceCounts.get("Dragon") || 0) / deckCards.length;
      if (dragonRatio >= 0.2) {
        // Look for generic dragon support keywords
        const dragonSupportKeywords = [
          "dragon",
          "dragon-type",
          "dragon monster",
        ];
        if (dragonSupportKeywords.some(keyword => desc.includes(keyword))) {
          synergyScore += 0.5 * dragonRatio;
        }
      }
    }
  }

  // 3. Mechanic synergy
  if (deckAnalysis && candidate.desc) {
    const desc = candidate.desc.toLowerCase();
    const deckDesc = deckCards.map(c => c.type || "").join(" ").toLowerCase();

    // GY synergy: if deck has GY effects, boost GY-dependent cards
    const hasGYEffects = deckDesc.includes("graveyard") || 
                        deckDesc.includes("gy") ||
                        deckAnalysis.cardRoles.endBoardPieces > 0;
    if (hasGYEffects && (desc.includes("graveyard") || desc.includes("send to gy") || desc.includes("mill"))) {
      synergyScore += 0.3;
    }

    // Fusion synergy: if deck has fusion spells, boost fusion monsters
    const hasFusionSpells = deckDesc.includes("fusion") || 
                           deckCards.some(c => c.type?.includes("Fusion"));
    if (hasFusionSpells && candidate.type?.includes("Fusion")) {
      synergyScore += 0.5;
    }

    // Synchro synergy: if deck has tuners, boost synchro monsters
    const hasTuners = deckCards.some(c => c.type?.includes("Tuner"));
    if (hasTuners && candidate.type?.includes("Synchro")) {
      synergyScore += 0.4;
    }

    // Xyz synergy: if deck has many Level 4 monsters, boost Rank 4 Xyz
    if (deckAnalysis.ratios.monsters > 0) {
      const level4Count = deckCards.filter(c => c.level === 4).length;
      const level4Ratio = level4Count / deckAnalysis.ratios.monsters;
      if (level4Ratio >= 0.3 && candidate.type?.includes("Xyz")) {
        // Check if it's likely Rank 4 (would need level info, but we'll estimate)
        synergyScore += 0.4;
      }
    }

    // Link synergy: if deck has many monsters, boost link monsters
    if (deckAnalysis.ratios.monstersPercent >= 50 && candidate.type?.includes("Link")) {
      synergyScore += 0.3;
    }
  }

  // 4. Level/Link synergy for Extra Deck cards
  if (candidate.type && (candidate.type.includes("Fusion") || 
                         candidate.type.includes("Synchro") || 
                         candidate.type.includes("Xyz") || 
                         candidate.type.includes("Link"))) {
    // Check if deck has materials for this card type
    // This is simplified - in practice, you'd check specific material requirements
    const hasMaterials = deckCards.length >= 5; // Basic check
    if (hasMaterials) {
      synergyScore += 0.2;
    }
  }

  // Normalize to 0.0-1.0 range
  return Math.min(1.0, synergyScore);
}

/**
 * Apply synergy scoring to candidate list
 */
export function applySynergyScoring(
  candidates: CardCandidate[],
  deckCards: Array<{ id: number; type?: string; race?: string; attribute?: string; archetype?: string | null; level?: number }>,
  deckAnalysis: EnhancedDeckAnalysis | undefined,
): Array<CardCandidate & { synergyScore: number }> {
  return candidates.map(candidate => ({
    ...candidate,
    synergyScore: calculateSynergyScore(candidate, deckCards, deckAnalysis),
  }));
}
