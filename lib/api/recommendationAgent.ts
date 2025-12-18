import { getAccessToken } from "../supabaseClient";
import { DeckType } from "../../types/types";
import type { RecommenderResponse } from "../../types/recommender";
import { extractNumberConstraint } from "../utils/prompt-utils";

// Phase 3: Updated to use types from types/recommender.ts
export interface RecommendationRequest {
  question?: string;
  current_deck?: DeckType;
  format?: "MASTER_DUEL" | "TCG";
  recommendation_type?:
    | "personalized"
    | "archetype"
    | "engine"
    | "tech"
    | "simple";
  use_hybrid_search?: boolean;
  explainTo?: "novice" | "intermediate" | "advanced";
  userPrefs?: {
    playstyle?: "aggro" | "control" | "combo" | "stall" | "hybrid";
    budget?: "low" | "mid" | "high";
  };
  maxOutputTokens?: number;
  // Number constraint extracted from user prompt
  numberConstraint?: {
    exact?: number;
    min?: number;
    max?: number;
  };
}

// Phase 3: Use the new RecommenderResponse type from types/recommender.ts
export type RecommendationResponse = RecommenderResponse;

// Legacy types for backward compatibility (deprecated, use RecommenderResponse)
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

export type AnalysisCategory = "consistency" | "power" | "interaction" | "meta";

export interface CategoryRecommendationRequest {
  deckId: string;
  category: AnalysisCategory;
  prompt: string;
}

export interface CategoryAnalysisBlock {
  category: string;
  mode: string;
  score?: number;
  summary?: string;
  specificIssues?: string[];
  opportunities?: string[];
  formatSpecificNotes?: string;
}

export interface CategoryRecommendation {
  categoryAnalysis?: CategoryAnalysisBlock;
  recommendations?: Array<{
    cardName: string;
    reason: string;
    location: "main" | "extra" | "side";
    priority: "critical" | "high" | "medium" | "low";
    quantity?: number;
    replacesCards?: string[];
    synergies?: string[];
    impact?: string;
    banlistLegal?: boolean;
  }>;
  comboLines?: Array<{
    name: string;
    relevance?: string;
    cards?: string[];
    steps?: string[];
    outcome?: string;
    consistency?: string;
  }>;
  cutsRecommendations?: Array<{
    cardName: string;
    reason?: string;
    quantity?: number;
  }>;
  ratioAdjustments?: Array<{
    cardName: string;
    currentQuantity?: number;
    recommendedQuantity?: number;
    reason?: string;
  }>;
}

export interface CategoryRecommendationResponse {
  category: AnalysisCategory;
  mode: string;
  recommendations: CategoryRecommendation;
  sessionId?: string | null;
  error?: string;
}


/**
 * Get recommendations from the AI agent
 */
export async function getRecommendations(
  request: RecommendationRequest,
): Promise<RecommendationResponse> {
  const accessToken = await getAccessToken();

  if (!accessToken) {
    console.error("❌ No access token available - user may not be logged in");
    throw new Error(
      "Authentication required. Please log in to use recommendations.",
    );
  }

  console.log(
    "🔐 Making recommendation request with token (length:",
    accessToken.length,
    ")",
  );

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (!supabaseUrl) {
    throw new Error("Missing env.NEXT_PUBLIC_SUPABASE_URL");
  }

  const url = `${supabaseUrl}/functions/v1/recommendation-agent`;
  
  // Phase 3: Convert DeckType to new format (main/extra/side with cardId/count)
  const current_deck = request.current_deck
    ? {
        main:
          request.current_deck.mainDeck?.map((c) => ({
            cardId: c.id,
            count: 1, // TODO: Track actual count if available
          })) || [],
        extra:
          request.current_deck.extraDeck?.map((c) => ({
            cardId: c.id,
            count: 1,
          })) || [],
        side:
          request.current_deck.sideDeck?.map((c) => ({
            cardId: c.id,
            count: 1,
          })) || [],
      }
    : undefined;

  // Extract number constraint from question if not already provided
  const numberConstraint =
    request.numberConstraint ||
    (request.question ? extractNumberConstraint(request.question) : null);

  const body = JSON.stringify({
    question: request.question,
    current_deck,
    format: request.format || "MASTER_DUEL",
    recommendation_type: request.recommendation_type || "personalized",
    use_hybrid_search: request.use_hybrid_search !== false,
    explainTo: request.explainTo || "novice",
    userPrefs: request.userPrefs,
    maxOutputTokens: request.maxOutputTokens,
    numberConstraint: numberConstraint || undefined,
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
      errorData:
        Object.keys(errorData).length > 0 ? errorData : "Empty error object",
      hasAccessToken: !!accessToken,
      accessTokenLength: accessToken?.length || 0,
    });

    if (response.status === 401) {
      throw new Error(
        (errorData.details as string) ||
          (errorData.error as string) ||
          (errorData.message as string) ||
          "Authentication failed. Please log in again.",
      );
    }

    if (response.status === 404) {
      throw new Error(
        (errorData.details as string) ||
          (errorData.error as string) ||
          (errorData.message as string) ||
          "Recommendation service not found. Please check your Supabase configuration.",
      );
    }

    const errorMessage =
      (errorData.details as string) ||
      (errorData.error as string) ||
      (errorData.message as string) ||
      errorText ||
      `Failed to get recommendations (${response.status}: ${response.statusText})`;

    throw new Error(errorMessage);
  }

  const result = (await response.json()) as RecommenderResponse;
  
  // Phase 3: Validate response structure
  if (!result.schemaVersion) {
    console.warn("⚠️ Response missing schemaVersion, may be legacy format");
  }

  console.log("✅ Recommendation received:", {
    schemaVersion: result.schemaVersion,
    confidence: result.confidence,
    recommendationsCount: result.recommendations?.length || 0,
    uiBlocksCount: result.ui?.length || 0,
    summary: result.summary?.substring(0, 100),
    hasDeckFingerprint: !!result.meta?.deckFingerprint,
  });

  return result;
}

export async function getCategoryRecommendations(
  payload: CategoryRecommendationRequest,
): Promise<CategoryRecommendationResponse> {
  const accessToken = await getAccessToken();

  if (!accessToken) {
    throw new Error("Authentication required. Please log in to use recommendations.");
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (!supabaseUrl) {
    throw new Error("Missing env.NEXT_PUBLIC_SUPABASE_URL");
  }

  const url = `${supabaseUrl}/functions/v1/recommend-cards`;

  const response = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${accessToken}`,
    },
    body: JSON.stringify({
      deckId: payload.deckId,
      category: payload.category,
      prompt: payload.prompt,
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    let errorMessage = errorText;
    try {
      const parsed = JSON.parse(errorText);
      errorMessage =
        (parsed.error as string) ||
        (parsed.message as string) ||
        (parsed.details as string) ||
        errorText;
    } catch {
      // ignore parse failure
    }
    throw new Error(errorMessage || "Failed to fetch recommendations");
  }

  const result = (await response.json()) as CategoryRecommendationResponse;
  return result;
}

export type AnalysisCategoryType = AnalysisCategory;
export type CategoryRecommendationResponseType = CategoryRecommendationResponse;
