import { getAccessToken } from "../supabaseClient";
import { DeckType } from "../../types/types";
import type { RecommenderResponse } from "../../types/recommender";
import { extractNumberConstraint } from "../utils/prompt-utils";

// Phase 1: Enhanced deck analysis type
export interface EnhancedDeckAnalysis {
  playstyle: 'Combo' | 'Midrange' | 'Control' | 'Stun' | 'Beatdown' | 'Balanced';
  tier: number | null;
  deckSize: number;
  mainDeckSize: number;
  extraDeckSize: number;
  sideDeckSize: number;
  ratios: {
    monsters: number;
    spells: number;
    traps: number;
    monstersPercent: number;
    spellsPercent: number;
    trapsPercent: number;
  };
  archetypes: {
    name: string;
    count: number;
    percentage: number;
  }[];
  primaryArchetype: string | null;
  cardRoles: {
    starters: number;
    extenders: number;
    interruptions: number;
    boardBreakers: number;
    endBoardPieces: number;
  };
  winCondition: 'OTK' | 'Control' | 'Grind' | 'Lock' | 'Burn' | 'Unknown';
  estimatedBrickRate: number;
  missingStaples: {
    cardName: string;
    reason: string;
  }[];
}

// Phase 1: Conversation context (multi-turn memory) passed to the edge function
export interface ConversationFeedbackItem {
  cardId: string;
  accepted: boolean;
  // Optional structured reason for accept/reject (phase 5+)
  reason?: string;
}

export interface DeckSnapshot {
  timestamp: string;
  deckFingerprint?: string;
  mainCount?: number;
  extraCount?: number;
  sideCount?: number;
}

export interface ConversationContext {
  previousRecommendations: string[];
  userFeedback: ConversationFeedbackItem[];
  deckEvolution: DeckSnapshot[];
  userGoals: string[];
}

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
  conversationContext?: ConversationContext;
  maxOutputTokens?: number;
  // Number constraint extracted from user prompt
  numberConstraint?: {
    exact?: number;
    min?: number;
    max?: number;
  };
  // Phase 1: Enhanced deck analysis
  deckAnalysis?: EnhancedDeckAnalysis;
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
    conversationContext: request.conversationContext || undefined,
    maxOutputTokens: request.maxOutputTokens,
    numberConstraint: numberConstraint || undefined,
    deckAnalysis: request.deckAnalysis || undefined, // Phase 1: Send enhanced analysis
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
    // Phase 2: Log two-stage metadata
    hasReasoning: !!result.reasoning,
    stage1Duration: result.meta?.stage1Duration,
    stage2Duration: result.meta?.stage2Duration,
    totalDuration: result.meta?.totalDuration,
  });

  return result;
}

/**
 * Get category-specific recommendations using the recommendation-agent edge function
 * This replaces the old recommend-cards edge function
 */
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

  // Fetch deck data to get current_deck and format
  const { supabase } = await import("../supabaseClient");
  const { data: deck, error: deckError } = await supabase
    .from("decks")
    .select("*")
    .eq("id", payload.deckId)
    .single();

  if (deckError || !deck) {
    throw new Error("Deck not found");
  }

  // Map category to recommendation type
  const categoryToRecommendationType: Record<string, "personalized" | "archetype" | "engine" | "tech" | "simple"> = {
    consistency: "personalized",
    power: "personalized",
    interaction: "tech",
    meta: "personalized",
  };

  const recommendationType = categoryToRecommendationType[payload.category] || "personalized";

  // Build question from category and prompt
  // Strip category label from question before sending to edge function to avoid false archetype detection
  // The recommendation_type parameter already provides category context to the edge function
  const question = payload.prompt.trim();

  // Convert deck to current_deck format
  const current_deck = deck.cards
    ? {
        main: (deck.cards.main || []).map((c: any) => ({
          cardId: typeof c === "number" ? c : c.id || c.cardId,
          count: c.count || 1,
        })),
        extra: (deck.cards.extra || []).map((c: any) => ({
          cardId: typeof c === "number" ? c : c.id || c.cardId,
          count: c.count || 1,
        })),
        side: (deck.cards.side || []).map((c: any) => ({
          cardId: typeof c === "number" ? c : c.id || c.cardId,
          count: c.count || 1,
        })),
      }
    : undefined;

  // Determine format from deck mode
  const format = deck.mode === "Master Duel" ? "MASTER_DUEL" : "TCG";

  // Call recommendation-agent edge function
  const url = `${supabaseUrl}/functions/v1/recommendation-agent`;

  const response = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${accessToken}`,
    },
    body: JSON.stringify({
      question,
      current_deck,
      format,
      recommendation_type: recommendationType,
      use_hybrid_search: true,
      explainTo: "intermediate",
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

  const recommendationResult = (await response.json()) as RecommenderResponse;

  // Check if response is valid (not an error response)
  const isErrorResponse = 
    recommendationResult.confidence === 0 ||
    !recommendationResult.reasoning ||
    recommendationResult.summary?.toLowerCase().includes("invalid") ||
    recommendationResult.summary?.toLowerCase().includes("model output invalid");

  if (isErrorResponse) {
    // Return error response in CategoryRecommendationResponse format
    const errorMessage = recommendationResult.summary || "Failed to generate recommendations";
    return {
      category: payload.category,
      mode: deck.mode || "TCG",
      recommendations: {
        categoryAnalysis: {
          category: payload.category,
          mode: deck.mode || "TCG",
          score: 0,
          summary: errorMessage,
          specificIssues: [],
          opportunities: [],
          formatSpecificNotes: "",
        },
        recommendations: [],
        comboLines: [],
        cutsRecommendations: [],
        ratioAdjustments: [],
      },
      sessionId: recommendationResult.meta?.recommendation_id || null,
      error: errorMessage,
    };
  }

  // Map recommendation-agent response to CategoryRecommendationResponse format
  const categoryRecommendations: CategoryRecommendation = {
    categoryAnalysis: {
      category: payload.category,
      mode: deck.mode || "TCG",
      score: Math.round((recommendationResult.confidence || 0) * 10),
      summary: recommendationResult.summary || recommendationResult.reasoning?.userIntent || "Analysis complete",
      specificIssues: recommendationResult.reasoning?.deckWeaknesses
        ? (typeof recommendationResult.reasoning.deckWeaknesses === "string"
            ? recommendationResult.reasoning.deckWeaknesses.split(";").filter((w: string) => w.trim())
            : [])
        : [],
      opportunities: recommendationResult.reasoning?.strategicConsiderations
        ? (typeof recommendationResult.reasoning.strategicConsiderations === "string"
            ? recommendationResult.reasoning.strategicConsiderations.split(";").filter((c: string) => c.trim())
            : [])
        : [],
      formatSpecificNotes: recommendationResult.reasoning?.metaContext || "",
    },
    recommendations: (recommendationResult.recommendations || []).map((rec) => ({
      cardName: rec.cardName || `Card ${rec.cardId}`,
      reason: rec.reason,
      location: rec.action === "add" ? "main" : rec.action === "tech" ? "side" : "main",
      priority: rec.impactEst >= 0.8 ? "critical" : rec.impactEst >= 0.6 ? "high" : rec.impactEst >= 0.5 ? "medium" : "low",
      quantity: 1,
      synergies: rec.evidence || [],
      impact: rec.impactEst >= 0.7 ? "high" : rec.impactEst >= 0.5 ? "medium" : "low",
      banlistLegal: !rec.banned,
    })),
    comboLines: [],
    cutsRecommendations: [],
    ratioAdjustments: [],
  };

  const result: CategoryRecommendationResponse = {
    category: payload.category,
    mode: deck.mode || "TCG",
    recommendations: categoryRecommendations,
    sessionId: recommendationResult.meta?.recommendation_id || null,
    error: undefined,
  };

  return result;
}

export type AnalysisCategoryType = AnalysisCategory;
export type CategoryRecommendationResponseType = CategoryRecommendationResponse;
