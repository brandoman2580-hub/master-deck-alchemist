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
    console.error("❌ No access token available - user may not be logged in");
    throw new Error("Authentication required. Please log in to use recommendations.");
  }

  console.log("🔐 Making recommendation request with token (length:", accessToken.length, ")");

  const url = `${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/recommendation-agent`;
  const body = JSON.stringify({
    question: request.question,
    current_deck: request.current_deck,
    format: request.format || "MASTER_DUEL",
    recommendation_type: request.recommendation_type || "personalized",
    use_hybrid_search: request.use_hybrid_search !== false, // Default to true
  });

  console.log("📤 Request:", {
    url,
    question: request.question,
    hasDeck: !!request.current_deck,
    format: request.format,
  });

  const response = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${accessToken}`,
    },
    body,
  });

  if (!response.ok) {
    const errorText = await response.text();
    let errorData;
    try {
      errorData = JSON.parse(errorText);
    } catch {
      errorData = { error: errorText, status: response.status };
    }
    
    console.error("❌ Recommendation request failed:", {
      status: response.status,
      statusText: response.statusText,
      error: errorData,
    });
    
    if (response.status === 401) {
      throw new Error(
        errorData.details || errorData.error || 
        "Authentication failed. Please log in again."
      );
    }
    
    throw new Error(
      errorData.details || errorData.error || 
      `Failed to get recommendations (${response.status})`
    );
  }

  const result = await response.json() as RecommendationResponse;
  console.log("✅ Recommendation received:", {
    answerLength: result.answer?.length || 0,
    cardsCount: result.validated_cards?.length || 0,
  });
  
  return result;
}

