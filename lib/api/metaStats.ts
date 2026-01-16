/**
 * Meta Statistics API Client
 * Fetches tier list statistics and meta insights
 */

export interface TierDistribution {
  tier: number;
  count: number;
  decks: string[];
}

export interface MetaStats {
  format: string;
  lastUpdate: string | null;
  totalDecks: number;
  tierDistribution: TierDistribution[];
  topDecks: Array<{
    deck_name: string;
    tier: number;
    firstSeen: string;
    lastSeen: string;
  }>;
  metaHealth: {
    diversity: number; // 0-1, higher = more diverse
    stability: number; // 0-1, higher = more stable
  };
}

export interface MetaStatsRequest {
  format?: "tcg" | "master_duel";
  days?: number;
}

/**
 * Fetch meta statistics for a format
 */
export async function getMetaStats(
  request: MetaStatsRequest = {}
): Promise<MetaStats> {
  const { format = "tcg", days = 30 } = request;

  // Check if Supabase URL is configured
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL) {
    console.warn("NEXT_PUBLIC_SUPABASE_URL not configured, returning empty stats");
    return {
      format,
      lastUpdate: null,
      totalDecks: 0,
      tierDistribution: [],
      topDecks: [],
      metaHealth: { diversity: 0, stability: 0 },
    };
  }

  const url = new URL(
    `${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/meta-stats`
  );
  url.searchParams.set("format", format);
  url.searchParams.set("days", days.toString());

  try {
    const response = await fetch(url.toString(), {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
      },
    }).catch((error) => {
      // Silently fail if endpoint is not available (e.g., not deployed yet)
      console.warn("Meta stats endpoint not available:", error);
      return null;
    });

    if (!response || !response.ok) {
      // Return empty stats instead of throwing
      return {
        format,
        lastUpdate: null,
        totalDecks: 0,
        tierDistribution: [],
        topDecks: [],
        metaHealth: { diversity: 0, stability: 0 },
      };
    }

    return (await response.json()) as MetaStats;
  } catch (error) {
    console.warn("Error fetching meta stats:", error);
    // Return empty stats instead of throwing
    return {
      format,
      lastUpdate: null,
      totalDecks: 0,
      tierDistribution: [],
      topDecks: [],
      metaHealth: { diversity: 0, stability: 0 },
    };
  }
}
