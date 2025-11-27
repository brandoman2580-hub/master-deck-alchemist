import { getAccessToken } from "@/lib/supabaseClient";
import { DeckType } from "@/types/types";

export interface RecommendationRequest {
  question: string;
  current_deck?: DeckType;
  format?: "MASTER_DUEL" | "TCG";
  recommendation_type?: "personalized" | "archetype" | "engine" | "tech" | "simple";
  use_hybrid_search?: boolean; // Enable hybrid RAG (default: true)
}

export interface RecommendationResponse {
  answer: string;
  validated_cards: any[];
  estimated_cost?: {
    tokens_used: number;
    cost_usd: number;
  };
}

/**
 * Get recommendations from the AI agent
 */
export async function getRecommendations(
  request: RecommendationRequest
): Promise<RecommendationResponse> {
  const accessToken = await getAccessToken();

  if (!accessToken) {
    throw new Error("Authentication required. Please log in to use recommendations.");
  }

  const response = await fetch(
    `${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/recommendation-agent`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${accessToken}`,
      },
      body: JSON.stringify({
        question: request.question,
        current_deck: request.current_deck,
        format: request.format || "MASTER_DUEL",
        recommendation_type: request.recommendation_type || "personalized",
        use_hybrid_search: request.use_hybrid_search !== false, // Default to true
      }),
    }
  );

  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    throw new Error(error.error || "Failed to get recommendations");
  }

  return (await response.json()) as RecommendationResponse;
}

