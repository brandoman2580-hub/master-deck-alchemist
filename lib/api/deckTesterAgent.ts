import { getAccessToken } from "@/lib/supabaseClient";
import {
  DeckTesterAgentRequest,
  DeckTesterAgentResponse,
} from "@/types/ai-agents";

const DECK_TESTER_AGENT_URL = `${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/deck-tester-agent`;

// Cache for API responses
const cache = new Map<string, { response: DeckTesterAgentResponse; timestamp: number }>();
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
function setCachedResponse(key: string, response: DeckTesterAgentResponse): void {
  // Limit cache size to 50 entries
  if (cache.size >= 50) {
    const firstKey = cache.keys().next().value;
    cache.delete(firstKey);
  }
  
  cache.set(key, {
    response,
    timestamp: Date.now(),
  });
}

async function callDeckTesterAgent(
  request: DeckTesterAgentRequest
): Promise<DeckTesterAgentResponse & { _cached?: boolean }> {
  const accessToken = await getAccessToken();

  if (!accessToken) {
    throw new Error("Authentication required");
  }

  // Check cache first
  const cacheKey = generateCacheKey(request);
  const cached = getCachedResponse(cacheKey);
  if (cached) {
    return { ...cached, _cached: true };
  }

  const response = await fetch(DECK_TESTER_AGENT_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${accessToken}`,
    },
    body: JSON.stringify(request),
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    throw new Error(error.error || "Failed to analyze matchup");
  }

  const result = (await response.json()) as DeckTesterAgentResponse;
  
  // Cache the result
  setCachedResponse(cacheKey, result);
  
  return { ...result, _cached: false };
}

export async function analyzeMatchup(
  request: DeckTesterAgentRequest
): Promise<DeckTesterAgentResponse> {
  return callDeckTesterAgent({
    ...request,
    test_type: "matchup_analysis",
  });
}

export async function simulateDuels(
  request: DeckTesterAgentRequest
): Promise<DeckTesterAgentResponse> {
  // Enforce max 20 simulations
  const numSimulations = Math.min(Math.max(1, request.num_simulations || 10), 20);

  return callDeckTesterAgent({
    ...request,
    test_type: "duel_simulation",
    num_simulations: numSimulations,
  });
}

export async function getStrategicInsights(
  request: DeckTesterAgentRequest
): Promise<DeckTesterAgentResponse> {
  return callDeckTesterAgent({
    ...request,
    test_type: "strategic_insights",
  });
}
