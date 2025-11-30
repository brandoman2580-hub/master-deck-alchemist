import { getAccessToken } from "../supabaseClient.ts";
import { DeckType } from "../../types/types.ts";

export interface RecommendationRequest {
  question: string;
  current_deck?: DeckType;
  format?: "MASTER_DUEL" | "TCG";
  recommendation_type?: "personalized" | "archetype" | "engine" | "tech" | "simple";
  use_hybrid_search?: boolean; // Enable hybrid RAG (default: true)
}

export interface RecommendedCard {
  id?: number;
  name: string;
  reason?: string;
  synergy_score?: number;
  risk_assessment?: "low" | "medium" | "high";
}

export interface AlternativeConsideration {
  name: string;
  why_not?: string;
}

export interface RecommendationMeta {
  intent_classified?: string;
  confidence?: number;
  format_specific_notes?: string;
}

export interface RecommendationResponse {
  answer: string;
  validated_cards: any[];
  recommendation_id?: string; // NEW: For feedback tracking
  response_version?: string; // NEW: For schema versioning (defaults to "1.0")
  estimated_cost?: {
    tokens_used: number;
    cost_usd: number;
  };
  // Full JSON response structure (if LLM returns structured JSON)
  recommended_cards?: RecommendedCard[];
  alternative_considerations?: AlternativeConsideration[];
  meta?: RecommendationMeta;
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

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (!supabaseUrl) {
    throw new Error('Missing env.NEXT_PUBLIC_SUPABASE_URL');
  }
  
  const url = `${supabaseUrl}/functions/v1/recommendation-agent`;
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
    let errorText = "";
    let errorData: Record<string, unknown> = {};
    
    try {
      errorText = await response.text();
      if (errorText) {
        try {
          errorData = JSON.parse(errorText);
        } catch {
          // If JSON parse fails, treat as plain text error
          errorData = { error: errorText, message: errorText };
        }
      }
    } catch (parseError) {
      console.error("Failed to parse error response:", parseError);
      errorText = "Failed to read error response";
      errorData = { error: "Unknown error", status: response.status };
    }
    
    // Log more detailed error information
    console.error("❌ Recommendation request failed:", {
      status: response.status,
      statusText: response.statusText,
      url,
      errorText: errorText || "No error text",
      errorData: Object.keys(errorData).length > 0 ? errorData : "Empty error object",
      hasAccessToken: !!accessToken,
      accessTokenLength: accessToken?.length || 0,
    });
    
    if (response.status === 401) {
      throw new Error(
        (errorData.details as string) || (errorData.error as string) || (errorData.message as string) || 
        "Authentication failed. Please log in again."
      );
    }
    
    if (response.status === 404) {
      throw new Error(
        (errorData.details as string) || (errorData.error as string) || (errorData.message as string) ||
        "Recommendation service not found. Please check your Supabase configuration."
      );
    }
    
    const errorMessage = (errorData.details as string) || 
                        (errorData.error as string) || 
                        (errorData.message as string) || 
                        errorText ||
                        `Failed to get recommendations (${response.status}: ${response.statusText})`;
    
    throw new Error(errorMessage);
  }

  const result = await response.json() as RecommendationResponse;
  console.log("✅ Recommendation received:", {
    answerLength: result.answer?.length || 0,
    cardsCount: result.validated_cards?.length || 0,
  });
  
  return result;
}

