/**
 * Phase 2: Negative Filtering
 * Detects and applies negative filters from user questions (e.g., "not hand traps", "without Pot cards")
 */

import type { CardCandidate } from "../_shared/cardSearch.ts";

export interface NegativeFilters {
  excludeStaples: boolean;
  excludeCategories: string[];
  excludeTypes: string[];
  excludeArchetypes: string[];
  excludeCardNames: string[];
}

/**
 * Detect negative filters from user question
 */
export function detectNegativeFilters(question: string): NegativeFilters {
  const filters: NegativeFilters = {
    excludeStaples: false,
    excludeCategories: [],
    excludeTypes: [],
    excludeArchetypes: [],
    excludeCardNames: [],
  };

  const q = question.toLowerCase();

  // Detect negative keywords
  const negativePatterns = [
    /(?:not|without|avoid|exclude|except|no)\s+([^.!?]+)/gi,
    /(?:don'?t|do not)\s+(?:want|need|use|include)\s+([^.!?]+)/gi,
  ];

  for (const pattern of negativePatterns) {
    const matches = [...q.matchAll(pattern)];
    for (const match of matches) {
      const exclusion = match[1]?.trim() || "";
      if (!exclusion) continue;

      // Check for specific categories
      if (exclusion.includes("hand trap") || exclusion.includes("handtrap")) {
        filters.excludeCategories.push("hand_trap");
      }
      if (exclusion.includes("staple")) {
        filters.excludeStaples = true;
      }
      if (exclusion.includes("board breaker")) {
        filters.excludeCategories.push("board_breaker");
      }
      if (exclusion.includes("starter")) {
        filters.excludeCategories.push("starter");
      }
      if (exclusion.includes("extender")) {
        filters.excludeCategories.push("extender");
      }
      if (exclusion.includes("floodgate")) {
        filters.excludeCategories.push("floodgate");
      }

      // Check for card types
      if (exclusion.includes("spell")) {
        filters.excludeTypes.push("Spell Card");
      }
      if (exclusion.includes("trap")) {
        filters.excludeTypes.push("Trap Card");
      }
      if (exclusion.includes("monster")) {
        filters.excludeTypes.push("Monster");
      }

      // Check for specific card names (e.g., "Pot of")
      const cardNameMatch = exclusion.match(/(?:pot|ash|maxx|nibiru|impermanence|called by)/i);
      if (cardNameMatch) {
        const cardName = cardNameMatch[0];
        if (cardName.toLowerCase().includes("pot")) {
          filters.excludeCardNames.push("Pot of");
        } else {
          filters.excludeCardNames.push(cardName);
        }
      }

      // Check for archetypes
      const archetypeMatch = exclusion.match(/(?:branded|kashtira|tearlaments|spright|runick|purrely|labrynth)/i);
      if (archetypeMatch) {
        filters.excludeArchetypes.push(archetypeMatch[0]);
      }
    }
  }

  // Also check for explicit "no" patterns
  if (q.includes("no hand trap") || q.includes("no handtrap")) {
    filters.excludeCategories.push("hand_trap");
  }
  if (q.includes("no staple") || q.includes("no generic")) {
    filters.excludeStaples = true;
  }
  if (q.includes("no pot")) {
    filters.excludeCardNames.push("Pot of");
  }

  console.log("[NEGATIVE-FILTER] Detected filters:", filters);

  return filters;
}

/**
 * Apply negative filters to candidate list
 */
export function applyNegativeFilters(
  candidates: CardCandidate[],
  filters: NegativeFilters,
  cardMetadata?: Map<number, any>,
): CardCandidate[] {
  if (
    !filters.excludeStaples &&
    filters.excludeCategories.length === 0 &&
    filters.excludeTypes.length === 0 &&
    filters.excludeArchetypes.length === 0 &&
    filters.excludeCardNames.length === 0
  ) {
    return candidates; // No filters to apply
  }

  const originalCount = candidates.length;
  let filtered = candidates;

  // Filter by staples
  if (filters.excludeStaples) {
    filtered = filtered.filter((card) => {
      const metadata = cardMetadata?.get(card.id);
      return !metadata?.is_staple;
    });
  }

  // Filter by categories (requires metadata)
  if (filters.excludeCategories.length > 0 && cardMetadata) {
    filtered = filtered.filter((card) => {
      const metadata = cardMetadata.get(card.id);
      if (!metadata) return true;

      for (const category of filters.excludeCategories) {
        // Check metadata for category flags
        if (category === "hand_trap" && metadata.hand_trap) return false;
        if (category === "board_breaker" && metadata.board_breaker) return false;
        if (category === "starter" && metadata.starter) return false;
        if (category === "extender" && metadata.extender) return false;
        if (category === "floodgate" && metadata.floodgate) return false;
      }
      return true;
    });
  }

  // Filter by card types
  if (filters.excludeTypes.length > 0) {
    filtered = filtered.filter((card) => {
      const cardType = card.type || "";
      return !filters.excludeTypes.some((excludeType) =>
        cardType.toLowerCase().includes(excludeType.toLowerCase()),
      );
    });
  }

  // Filter by archetypes
  if (filters.excludeArchetypes.length > 0) {
    filtered = filtered.filter((card) => {
      const cardArchetype = (card.archetype || "").toLowerCase();
      return !filters.excludeArchetypes.some((excludeArch) =>
        cardArchetype.includes(excludeArch.toLowerCase()),
      );
    });
  }

  // Filter by card names (partial match)
  if (filters.excludeCardNames.length > 0) {
    filtered = filtered.filter((card) => {
      const cardName = (card.name || "").toLowerCase();
      return !filters.excludeCardNames.some((excludeName) =>
        cardName.includes(excludeName.toLowerCase()),
      );
    });
  }

  const filteredCount = filtered.length;
  const removedCount = originalCount - filteredCount;

  if (removedCount > 0) {
    console.log(
      `[NEGATIVE-FILTER] Filtered out ${removedCount} cards (${originalCount} -> ${filteredCount})`,
    );
  }

  return filtered;
}
