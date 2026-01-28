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
 * Returns empty stats if endpoint is not available (expected error)
 * Throws error for unexpected failures (network errors, etc.)
 */
export async function getMetaStats(
  request: MetaStatsRequest = {}
): Promise<MetaStats> {
  const { format = "tcg", days = 30 } = request;

  const emptyStats: MetaStats = {
    format,
    lastUpdate: null,
    totalDecks: 0,
    tierDistribution: [],
    topDecks: [],
    metaHealth: { diversity: 0, stability: 0 },
  };

  // Check if Supabase URL is configured
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL) {
    // Expected: Configuration missing - return empty stats
    return emptyStats;
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
    });

    // Expected: Endpoint not available (404) or service unavailable (503)
    // Return empty stats for graceful degradation
    if (!response.ok) {
      if (response.status === 404 || response.status === 503) {
        return emptyStats;
      }
      // Unexpected error - throw to be caught by error boundary
      throw new Error(
        `Failed to fetch meta stats: ${response.status} ${response.statusText}`
      );
    }

    return (await response.json()) as MetaStats;
  } catch (error) {
    // Network errors or other unexpected failures - throw to bubble up
    if (error instanceof Error) {
      // Check if it's a network error (fetch failed)
      if (error.message.includes("fetch") || error.message.includes("network")) {
        // Network error - could be expected if offline, but throw anyway
        // Components can catch and handle gracefully
        throw error;
      }
      throw error;
    }
    throw new Error("Failed to fetch meta statistics");
  }
}
