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
 */
export async function detectMetaDeck(
  deck: DeckType,
  format: "tcg" | "master_duel"
): Promise<MetaDeckMatch | null> {
  try {
    // Check if Supabase URL is configured
    if (!process.env.NEXT_PUBLIC_SUPABASE_URL) {
      console.warn("NEXT_PUBLIC_SUPABASE_URL not configured, skipping meta detection");
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
    ).catch((error) => {
      // Silently fail if endpoint is not available (e.g., not deployed yet)
      console.warn("Meta stats endpoint not available:", error);
      return null;
    });

    if (!response || !response.ok) {
      return null;
    }

    const metaStats = await response.json();
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
    console.error("Error detecting meta deck:", error);
    return null;
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
 */
export async function compareTierLists(
  format: "tcg" | "master_duel"
): Promise<TierListComparison | null> {
  try {
    const response = await fetch(
      `${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/meta-stats?format=${format}`,
      {
        method: "GET",
        headers: {
          "Content-Type": "application/json",
        },
      }
    );

    if (!response.ok) {
      return null;
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
    console.error("Error comparing tier lists:", error);
    return null;
  }
}
