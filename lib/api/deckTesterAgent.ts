import { getAccessToken, supabaseUrl } from "../supabaseClient";
import {
  DeckTesterAgentRequest,
  DeckTesterAgentResponse,
} from "../../types/ai-agents";

// Cache for API responses
const cache = new Map<
  string,
  { response: DeckTesterAgentResponse; timestamp: number }
>();
const CACHE_TTL = 24 * 60 * 60 * 1000; // 24 hours

// Generate cache key from request
function generateCacheKey(request: DeckTesterAgentRequest): string {
  const deckAId = request.deck_a.id || "unknown";
  const deckBId = request.deck_b.id || "unknown";
  const deckAHash = `${request.deck_a.mainDeck.length}-${request.deck_a.extraDeck.length}-${request.deck_a.sideDeck.length}`;
  const deckBHash = `${request.deck_b.mainDeck.length}-${request.deck_b.extraDeck.length}-${request.deck_b.sideDeck.length}`;
  return `${request.test_type}-${deckAId}-${deckBId}-${deckAHash}-${deckBHash}-${request.num_simulations || 10}-${request.banlist_format}-${request.context || ""}`;
}

// Check cache and return if valid
function getCachedResponse(key: string): DeckTesterAgentResponse | null {
  const cached = cache.get(key);
  if (!cached) return null;

  const now = Date.now();
  if (now - cached.timestamp > CACHE_TTL) {
    cache.delete(key);
    return null;
  }

  return cached.response;
}

// Store response in cache
function setCachedResponse(
  key: string,
  response: DeckTesterAgentResponse,
): void {
  // Limit cache size to 50 entries
  if (cache.size >= 50) {
    const firstKey = cache.keys().next().value;
    if (firstKey) {
      cache.delete(firstKey);
    }
  }

  cache.set(key, {
    response,
    timestamp: Date.now(),
  });
}

async function callDeckTesterAgent(
  request: DeckTesterAgentRequest,
): Promise<DeckTesterAgentResponse & { _cached?: boolean }> {
  const accessToken = await getAccessToken();

  if (!accessToken) {
    throw new Error("Authentication required");
  }

  // Use the validated URL from supabaseClient (which already checked the env var)
  if (!supabaseUrl) {
    throw new Error(
      "Missing Supabase URL. Please check your environment variables.",
    );
  }

  // Check cache first
  const cacheKey = generateCacheKey(request);
  const cached = getCachedResponse(cacheKey);
  if (cached) {
    return { ...cached, _cached: true };
  }

  const deckTesterAgentUrl = `${supabaseUrl}/functions/v1/deck-tester-agent`;
  const response = await fetch(deckTesterAgentUrl, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${accessToken}`,
    },
    body: JSON.stringify(request),
  });

  if (!response.ok) {
    let errorMessage = `Failed to analyze matchup (Status: ${response.status})`;

    try {
      const errorData = await response.json();
      if (errorData.error) {
        errorMessage = errorData.error;
      } else if (errorData.message) {
        errorMessage = errorData.message;
      } else if (typeof errorData === "string") {
        errorMessage = errorData;
      }
    } catch {
      // If response is not JSON, try to get text
      try {
        const errorText = await response.text();
        if (errorText) {
          errorMessage = errorText;
        }
      } catch {
        // If all else fails, use the default message with status code
      }
    }

    throw new Error(errorMessage);
  }

  const result = (await response.json()) as DeckTesterAgentResponse;

  // Cache the result
  setCachedResponse(cacheKey, result);

  return { ...result, _cached: false };
}

export async function analyzeMatchup(
  request: DeckTesterAgentRequest,
): Promise<DeckTesterAgentResponse> {
  return callDeckTesterAgent({
    ...request,
    test_type: "matchup_analysis",
  });
}

export async function simulateDuels(
  request: DeckTesterAgentRequest,
): Promise<DeckTesterAgentResponse> {
  // Enforce max 20 simulations
  const numSimulations = Math.min(
    Math.max(1, request.num_simulations || 10),
    20,
  );

  return callDeckTesterAgent({
    ...request,
    test_type: "duel_simulation",
    num_simulations: numSimulations,
  });
}

export async function getStrategicInsights(
  request: DeckTesterAgentRequest,
): Promise<DeckTesterAgentResponse> {
  return callDeckTesterAgent({
    ...request,
    test_type: "strategic_insights",
  });
}
