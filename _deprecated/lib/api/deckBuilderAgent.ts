import { getAccessToken } from "../supabaseClient";
import {
  DeckBuilderAgentRequest,
  DeckBuilderAgentResponse,
} from "../../types/ai-agents";
import process from "node:process";

/**
 * Get deck building suggestions from the AI agent
 */
export async function getDeckBuilderSuggestions(
  request: DeckBuilderAgentRequest,
): Promise<DeckBuilderAgentResponse> {
  const accessToken = await getAccessToken();

  if (!accessToken) {
    throw new Error(
      "Authentication required. Please log in to use the AI Builder Agent.",
    );
  }

  const response = await fetch(
    `${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/deck-builder-agent`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${accessToken}`,
      },
      body: JSON.stringify({
        current_deck: request.current_deck,
        user_goal: request.user_goal,
        archetype_preference: request.archetype_preference,
        playstyle: request.playstyle,
        context: request.context || "refining",
        banlist_format: request.banlist_format || "MASTER_DUEL",
      }),
    },
  );

  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    throw new Error(error.error || "Failed to get deck builder suggestions");
  }

  return (await response.json()) as DeckBuilderAgentResponse;
}

/**
 * Analyze deck progress and get assessment
 */
export async function analyzeDeckProgress(
  deck: DeckBuilderAgentRequest["current_deck"],
  context: "initial_build" | "refining" | "completing" = "refining",
  banlistFormat: "MASTER_DUEL" | "TCG" = "MASTER_DUEL",
): Promise<DeckBuilderAgentResponse> {
  return getDeckBuilderSuggestions({
    current_deck: deck,
    context,
    banlist_format: banlistFormat,
  });
}

/**
 * Get archetype-specific recommendations
 */
export async function getArchetypeRecommendations(
  deck: DeckBuilderAgentRequest["current_deck"],
  archetype: string,
  format: "MASTER_DUEL" | "TCG" = "MASTER_DUEL",
): Promise<DeckBuilderAgentResponse> {
  return getDeckBuilderSuggestions({
    current_deck: deck,
    archetype_preference: archetype,
    banlist_format: format,
    context: "initial_build",
  });
}
