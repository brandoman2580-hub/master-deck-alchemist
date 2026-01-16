import type { Card } from "../../types/card";
import type { DeckType } from "../../types/types";
import { supabase } from "../../lib/supabaseClient";
import { getRecommendations, type ConversationContext } from "../../lib/api/recommendationAgent";
import type { Message, Quota, AnalysisType } from "./types";
import { extractCardsFromText, isRecommendationRequest } from "./utils";
import { analyzeDeckEnhanced } from "../../app/deck-builder/utils";
import type { AIExplainToPreference, AIPlaystylePreference } from "@/store/aiPrefsStore";

type DeckStatsParam = {
  mainCount: number;
  extraCount: number;
  sideCount: number;
  monsterCount: number;
  spellCount: number;
  trapCount: number;
};

export type GenerateAIResponseOptions = {
  deckStats?: DeckStatsParam;
  conversationContext?: ConversationContext;
  explainTo?: AIExplainToPreference;
  userPrefs?: {
    playstyle?: AIPlaystylePreference;
  };
};

/**
 * Generate AI response for a user message
 */
export async function generateAIResponse(
  userMessage: string,
  currentDeck: DeckType,
  allCards: Card[],
  options?: GenerateAIResponseOptions,
): Promise<{ message: Message; quota?: Quota }> {
  const message: Message = {
    id: crypto.randomUUID(),
    role: "assistant",
    content: "",
    timestamp: new Date(),
  };

  const deckId = currentDeck?.id;
  if (!deckId) {
    message.content = "No deck selected. Please select a deck first.";
    return { message };
  }

  try {
    const { data } = await supabase.auth.getSession();
    const accessToken = data.session?.access_token;

    // Map deck mode to banlist_format for edge function
    const banlistFormat =
      currentDeck.mode === "Master Duel" ? "MASTER_DUEL" : "TCG";

    // Check if this is a recommendation request
    const isRecommendation = isRecommendationRequest();

    if (isRecommendation) {
      // Use recommendation agent
      try {
        // Phase 1: Compute enhanced deck analysis if stats are available
        let deckAnalysis: ReturnType<typeof analyzeDeckEnhanced> | undefined = undefined;
        if (options?.deckStats) {
          try {
            deckAnalysis = analyzeDeckEnhanced(currentDeck, options.deckStats);
            console.log("📊 Computed deck analysis:", {
              playstyle: deckAnalysis.playstyle,
              primaryArchetype: deckAnalysis.primaryArchetype,
              brickRate: deckAnalysis.estimatedBrickRate,
              cardRoles: deckAnalysis.cardRoles,
            });
          } catch (analysisError) {
            console.warn("⚠️ Failed to compute deck analysis:", analysisError);
          }
        }

        const recommendationResult = await getRecommendations({
          question: userMessage,
          current_deck: currentDeck,
          format: banlistFormat,
          recommendation_type: "personalized",
          explainTo: options?.explainTo,
          userPrefs: options?.userPrefs,
          deckAnalysis, // Phase 1: Pass enhanced analysis
          conversationContext: options?.conversationContext, // Phase 1: Multi-turn memory
        });

        // Phase 3: Handle new strict schema response format
        if (recommendationResult.schemaVersion) {
          // Check if this is an invalid schema response (confidence 0 and error indicators)
          const isInvalidSchema = 
            recommendationResult.confidence === 0 ||
            (recommendationResult.summary?.toLowerCase().includes("invalid") ||
             recommendationResult.summary?.toLowerCase().includes("model output invalid")) ||
            (recommendationResult.ui?.some(block => 
              block.type === "text" && 
              typeof block.content === "string" &&
              block.content.toLowerCase().includes("invalid")
            ));

          if (isInvalidSchema) {
            // Invalid schema detected - fall back to deck-analysis
            console.warn(
              "Invalid schema detected from recommender (confidence: 0), falling back to deck-analysis",
            );
            throw new Error("Invalid schema response - falling back to deck-analysis");
          }

          // New format: Store full RecommenderResponse
          message.recommenderResponse = recommendationResult;
          message.content = recommendationResult.summary || "No summary available.";
          
          // Store recommendation_id from meta
          if (recommendationResult.meta?.recommendation_id) {
            message.recommendation_id = String(recommendationResult.meta.recommendation_id);
          }
          message.response_version = recommendationResult.schemaVersion;

          // Convert recommendations to suggestedCards for backward compatibility
          if (recommendationResult.recommendations && recommendationResult.recommendations.length > 0) {
            const cardIds = recommendationResult.recommendations
              .map((r) => parseInt(r.cardId, 10))
              .filter((id) => !isNaN(id));
            
            message.suggestedCards = cardIds
              .map((cardId) => {
                const fullCard = allCards.find((c) => c.id === cardId);
                if (fullCard) {
                  return fullCard;
                }
                return null;
              })
              .filter((card): card is Card => card != null);
          }
        } else {
          // Legacy format: Handle old response structure
          message.content =
            (recommendationResult as any).answer || "No recommendations available.";

          if ((recommendationResult as any).recommendation_id) {
            message.recommendation_id = (recommendationResult as any).recommendation_id;
          }
          message.response_version = (recommendationResult as any).response_version || "1.0";

          if ((recommendationResult as any).recommended_cards) {
            message.recommendedCards = (recommendationResult as any).recommended_cards;
          }
          if ((recommendationResult as any).alternative_considerations) {
            message.alternativeConsiderations = (recommendationResult as any).alternative_considerations;
          }
          if ((recommendationResult as any).meta) {
            message.recommendationMeta = (recommendationResult as any).meta;
          }

          if ((recommendationResult as any).validated_cards) {
            message.suggestedCards = (recommendationResult as any).validated_cards
              .map((card: Card) => {
                const fullCard = allCards.find((c) => c.id === card.id);
                if (fullCard) {
                  return fullCard;
                }
                return {
                  ...card,
                  deckInstanceId: `temp-${card.id}`,
                  race: card.race || "",
                  misc_info: card.misc_info || [],
                  card_sets: card.card_sets || [],
                  card_prices: card.card_prices || [],
                } as Card;
              })
              .filter((card: Card) => card != null);
          }
        }

        return { message };
      } catch (recError: unknown) {
        // Fall back to deck-analysis if recommendation fails
        console.warn(
          "Recommendation agent failed, falling back to deck-analysis:",
          recError,
        );
      }
    }

    // Use deck-analysis for non-recommendation requests
    const response = await fetch(
      `https://izshwywgfaozmisedwxm.supabase.co/functions/v1/deck-analysis`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(accessToken && { Authorization: `Bearer ${accessToken}` }),
        },
        body: JSON.stringify({
          deck_id: deckId,
          banlist_format: banlistFormat,
          question: userMessage,
          analysis_type: "custom", // Custom user prompts use "custom" analysis type
        }),
      },
    );

    const result = await response.json();

    if (!response.ok) {
      message.content = result.error
        ? `AI error: ${result.error}`
        : "AI error: Unknown error.";
      return { message };
    }

    // Extract structured analysis and deck stats
    const structuredAnalysis = result.structured_analysis ?? null;
    const resultDeckStats = result.deck_stats ?? null;
    const analysisType = (result.analysis_type ?? "custom") as AnalysisType;

    // For custom prompts, use raw_answer (plain text response)
    // For card_suggestions, use a summary or empty text (cards are rendered separately)
    // For other types, use overview
    let answerText: string;
    if (analysisType === "custom") {
      // Custom prompts: use raw_answer (plain text, not JSON)
      answerText =
        result.raw_answer ?? result.answer ?? "AI did not return an answer.";
    } else if (analysisType === "card_suggestions") {
      // Card suggestions: use empty or summary text since cards are rendered separately
      answerText = result.raw_answer ?? "";
    } else if (structuredAnalysis?.overview) {
      answerText = structuredAnalysis.overview;
    } else {
      answerText =
        result.raw_answer ?? result.answer ?? "AI did not return an answer.";
    }

    message.content = answerText;

    // Handle card suggestions: use recommendedCards from backend
    if (
      analysisType === "card_suggestions" &&
      result.recommendedCards &&
      Array.isArray(result.recommendedCards)
    ) {
      // Use recommendedCards from backend - these are the primary_card recommendations
      message.suggestedCards = result.recommendedCards
        .map((card: Card) => {
          // Find the full card data from allCards to ensure we have all fields (like card_images, deckInstanceId)
          const fullCard = allCards.find((c) => c.id === card.id);
          if (fullCard) {
            return fullCard; // Use full card from store which has all required fields
          }
          // If not found in store, create a card object with required fields
          return {
            ...card,
            deckInstanceId: `temp-${card.id}`, // Generate a temporary instance ID
            race: card.race || "", // Ensure race is not undefined
            misc_info: card.misc_info || [],
            card_sets: card.card_sets || [],
            card_prices: card.card_prices || [],
          } as Card;
        })
        .filter((card: Card) => card != null);

      // Store card suggestions metadata (with candidateId)
      if (result.suggestions && Array.isArray(result.suggestions)) {
        message.cardSuggestionsMeta = result.suggestions;
      }

      // Store candidate cards for UI
      if (result.candidateCards && Array.isArray(result.candidateCards)) {
        message.candidateCards = result.candidateCards;
      }
    } else if (analysisType === "custom") {
      // Handle card suggestions for custom prompts
      let cardsToShow: Card[] = [];
      
      // First, try to use validated_cards from backend (most reliable)
      if (result.validated_cards && Array.isArray(result.validated_cards) && result.validated_cards.length > 0) {
        cardsToShow = result.validated_cards
          .map((card: Card) => {
            // Find the full card data from allCards to ensure we have all fields (like card_images, deckInstanceId)
            const fullCard = allCards.find((c) => c.id === card.id);
            if (fullCard) {
              return {
                ...fullCard,
                deckInstanceId: `temp-${fullCard.id}`, // Generate a temporary instance ID
              } as Card;
            }
            // If not found in store, use the card from backend (it should have card_images)
            return {
              ...card,
              deckInstanceId: `temp-${card.id}`, // Generate a temporary instance ID
              race: card.race || "", // Ensure race is not undefined
              misc_info: card.misc_info || [],
              card_sets: card.card_sets || [],
              card_prices: card.card_prices || [],
              card_images: card.card_images || [], // Ensure card_images is included
            } as Card;
          })
          .filter((card): card is Card => card != null && card.id != null);
      }
      
      // Fallback: if no validated_cards or empty, try to extract from text
      if (cardsToShow.length === 0) {
        const extractedCards = extractCardsFromText(answerText, allCards);
        if (extractedCards.length > 0) {
          cardsToShow = extractedCards;
        }
      }
      
      if (cardsToShow.length > 0) {
        message.suggestedCards = cardsToShow;
        console.log("✅ Custom prompt cards extracted:", {
          count: cardsToShow.length,
          cards: cardsToShow.map(c => ({
            id: c.id,
            name: c.name,
            hasImages: !!c.card_images && c.card_images.length > 0,
            imageUrl: c.card_images?.[0]?.image_url_small || c.card_images?.[0]?.image_url,
          })),
        });
      } else {
        console.log("⚠️ No cards extracted for custom prompt");
      }
    } else if (analysisType !== "card_suggestions") {
      // For other analysis types, use validated_cards if available, otherwise extract from text
      if (result.validated_cards && Array.isArray(result.validated_cards) && result.validated_cards.length > 0) {
        message.suggestedCards = result.validated_cards
          .map((card: Card) => {
            const fullCard = allCards.find((c) => c.id === card.id);
            if (fullCard) {
              return {
                ...fullCard,
                deckInstanceId: `temp-${fullCard.id}`,
              } as Card;
            }
            return {
              ...card,
              deckInstanceId: `temp-${card.id}`,
              race: card.race || "",
              misc_info: card.misc_info || [],
              card_sets: card.card_sets || [],
              card_prices: card.card_prices || [],
              card_images: card.card_images || [],
            } as Card;
          })
          .filter((card): card is Card => card != null && card.id != null);
      } else {
        // Fallback: parse suggested cards from the response text and match to actual cards
        const extractedCards = extractCardsFromText(answerText, allCards);
        if (extractedCards.length > 0) {
          message.suggestedCards = extractedCards;
        }
      }
    }

    // Store structured analysis and deck stats in message metadata
    if (structuredAnalysis && analysisType !== "custom") {
      message.type = "deck-analysis";
      message.meta = {
        deckId,
        banlistFormat,
        analysisType,
        structuredAnalysis,
        deckStats: resultDeckStats,
      };
    } else if (analysisType === "custom") {
      // For custom prompts, set type and basic metadata
      message.type = "deck-analysis";
      message.meta = {
        deckId,
        banlistFormat,
        analysisType: "custom",
        deckStats: resultDeckStats,
      };
    }

    const quota: Quota | undefined =
      result.requests_left != null && result.max_requests != null
        ? {
            requests_left: result.requests_left,
            max_requests: result.max_requests,
          }
        : undefined;

    return { message, quota };
  } catch (error: unknown) {
    message.content = `Error contacting AI: ${error instanceof Error ? error.message : "Unknown error"}`;
    return { message };
  }
}

