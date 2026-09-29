import { DeckType } from "@/types/types";

interface MetaDeckMatch {
  deck_name: string;
  tier: number;
  format: "tcg" | "master_duel";
  confidence: number; // 0-1, how confident we are this is the meta deck
  matchingCards: string[]; // Card names that match
}

/**
 * Detect if a deck matches a known meta deck
 * This is a simplified version - in production, you'd use more sophisticated matching
 * (e.g., archetype detection, card name similarity, etc.)
 * Returns null if no match found or service unavailable (expected)
 * Throws error for unexpected failures
 */
export async function detectMetaDeck(
  deck: DeckType,
  format: "tcg" | "master_duel"
): Promise<MetaDeckMatch | null> {
  try {
    // Check if Supabase URL is configured
    if (!process.env.NEXT_PUBLIC_SUPABASE_URL) {
      // Expected: Configuration missing - return null
      return null;
    }

    // Fetch latest tier list for the format
    const response = await fetch(
      `${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/meta-stats?format=${format}`,
      {
        method: "GET",
        headers: {
          "Content-Type": "application/json",
        },
      }
    );

    // Expected: Endpoint not available (404) or service unavailable (503)
    // Return null for graceful degradation
    if (!response.ok) {
      if (response.status === 404 || response.status === 503) {
        return null;
      }
      // Unexpected error - throw to be caught by error boundary
      throw new Error(
        `Failed to fetch meta stats for detection: ${response.status} ${response.statusText}`
      );
    }

    const metaStats = await response.json();
    // Expected: No meta decks available yet
    if (!metaStats.topDecks || metaStats.topDecks.length === 0) {
      return null;
    }

    // Get deck card names
    const deckCardNames = new Set<string>();
    [...deck.mainDeck, ...deck.extraDeck, ...deck.sideDeck].forEach((card) => {
      deckCardNames.add(card.name.toLowerCase());
    });

    // Try to match against top decks
    // Simple heuristic: check if deck name appears in card names or vice versa
    let bestMatch: MetaDeckMatch | null = null;
    let bestConfidence = 0;

    for (const metaDeck of metaStats.topDecks) {
      const metaDeckNameLower = metaDeck.deck_name.toLowerCase();
      const matchingCards: string[] = [];

      // Check if any card names contain the meta deck name
      for (const cardName of deckCardNames) {
        if (cardName.includes(metaDeckNameLower) || metaDeckNameLower.includes(cardName)) {
          matchingCards.push(cardName);
        }
      }

      // Calculate confidence based on:
      // 1. Number of matching cards
      // 2. Tier (higher tier = more likely)
      // 3. Deck name similarity
      const cardMatchRatio = matchingCards.length / Math.max(deckCardNames.size, 1);
      const tierBonus = metaDeck.tier === 1 ? 0.3 : metaDeck.tier === 2 ? 0.2 : 0.1;
      const confidence = Math.min(1.0, cardMatchRatio * 0.7 + tierBonus);

      if (confidence > bestConfidence && confidence > 0.3) {
        bestConfidence = confidence;
        bestMatch = {
          deck_name: metaDeck.deck_name,
          tier: metaDeck.tier,
          format,
          confidence,
          matchingCards,
        };
      }
    }

    return bestMatch;
  } catch (error) {
    // Network errors or other unexpected failures - throw to bubble up
    // Components can catch and handle gracefully
    if (error instanceof Error) {
      throw error;
    }
    throw new Error("Failed to detect meta deck");
  }
}

/**
 * Compare two tier list snapshots
 */
export interface TierListComparison {
  format: "tcg" | "master_duel";
  current: {
    scrapeRunId: string;
    scrapedAt: string;
    totalDecks: number;
  };
  previous: {
    scrapeRunId: string;
    scrapedAt: string;
    totalDecks: number;
  } | null;
  changes: {
    newDecks: string[];
    removedDecks: string[];
    tierChanges: Array<{
      deck_name: string;
      oldTier: number;
      newTier: number;
    }>;
  };
}

/**
 * Compare current tier list with previous snapshot
 * Returns null if service unavailable (expected)
 * Throws error for unexpected failures
 */
export async function compareTierLists(
  format: "tcg" | "master_duel"
): Promise<TierListComparison | null> {
  try {
    if (!process.env.NEXT_PUBLIC_SUPABASE_URL) {
      return null;
    }

    const response = await fetch(
      `${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/meta-stats?format=${format}`,
      {
        method: "GET",
        headers: {
          "Content-Type": "application/json",
        },
      }
    );

    // Expected: Endpoint not available (404) or service unavailable (503)
    if (!response.ok) {
      if (response.status === 404 || response.status === 503) {
        return null;
      }
      // Unexpected error - throw to be caught by error boundary
      throw new Error(
        `Failed to fetch meta stats for comparison: ${response.status} ${response.statusText}`
      );
    }

    // This is a simplified version - in production, you'd fetch both snapshots
    // and compare them directly from the database
    const metaStats = await response.json();

    return {
      format,
      current: {
        scrapeRunId: "current",
        scrapedAt: metaStats.lastUpdate || new Date().toISOString(),
        totalDecks: metaStats.totalDecks,
      },
      previous: null, // Would be populated from database query
      changes: {
        newDecks: [],
        removedDecks: [],
        tierChanges: [],
      },
    };
  } catch (error) {
    // Network errors or other unexpected failures - throw to bubble up
    if (error instanceof Error) {
      throw error;
    }
    throw new Error("Failed to compare tier lists");
  }
}
