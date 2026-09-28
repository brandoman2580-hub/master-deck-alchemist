import { getAccessToken } from "../supabaseClient";
import type {
  AssistantMode,
  DeckCoachResponse,
  EvidenceClaim,
  SynergyCandidate,
  TuningRecommendation,
} from "@/lib/engine/assistant-contract";
import type { DeckSnapshot } from "@/lib/engine/deck-snapshot";

export type { AssistantMode, DeckCoachResponse };

export interface DeckAssistantChatRequest {
  deckId: string;
  userQuery: string;
  conversationId?: string;
  mode?: AssistantMode;
  format?: "TCG" | "MASTER_DUEL";
  /** Live Workshop list (id + count). Preferred over DB-saved cards for coaching. */
  deckSnapshot?: DeckSnapshot;
}

export interface DeckAssistantRecommendation {
  cardId: number;
  cardName: string;
  reason: string;
  priority: "high" | "medium" | "low";
  canAdd: boolean;
  impactEst?: number;
  synergyScore?: number;
}

/** @deprecated Prefer coach.tuning — kept for transitional UI */
export interface RatioSuggestion {
  cardName: string;
  currentCount: number;
  suggestedCount: number;
  reason: string;
}

export interface DeckAssistantChatResponse {
  type: "coach" | "clarification" | "recommendations" | "ratio_suggestions";
  /** Primary coach answer (DeckCoachResponse.answer) */
  answer?: string;
  text?: string;
  mode?: DeckCoachResponse["mode"];
  confidence?: DeckCoachResponse["confidence"];
  limitations?: string[];
  evidence?: EvidenceClaim[];
  tuning?: DeckCoachResponse["tuning"] | null;
  synergies?: SynergyCandidate[] | null;
  coach?: DeckCoachResponse;
  recommendations?: DeckAssistantRecommendation[];
  ratioSuggestions?: RatioSuggestion[];
  conversation_id: string;
  question?: string;
  structured_query?: unknown;
  error?: string;
}

/**
 * Map API failures to deck/card/rejection language only.
 */
function userFacingChatError(
  status: number,
  errorData: Record<string, unknown>,
  fallback: string,
): string {
  const primary =
    (typeof errorData.error === "string" && errorData.error) ||
    (typeof errorData.message === "string" && errorData.message) ||
    "";

  if (status === 401 || status === 403) {
    return "Please log in again to use Strategist.";
  }

  if (
    primary &&
    !/GROQ|FactsEnvelope|Monte Carlo|stack|exception|internal|supabase|jwt|token is empty/i
      .test(primary)
  ) {
    return primary;
  }

  if (status === 400 && Array.isArray(errorData.legality_errors)) {
    return "Your current deck is not legal for coaching. Fix banlist or size issues, then ask again.";
  }

  if (status === 400 && Array.isArray(errorData.unknown_card_ids)) {
    return "Some cards in your current deck are not in the card library. Remove or replace them, then ask again.";
  }

  if (status === 404) {
    return "That deck could not be found for your account.";
  }

  return fallback;
}

/**
 * Send a chat message to Strategist (Facts Brain coach).
 */
export async function sendChatMessage(
  request: DeckAssistantChatRequest,
): Promise<DeckAssistantChatResponse> {
  const accessToken = await getAccessToken();

  if (!accessToken) {
    throw new Error("Please log in to use Strategist.");
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (!supabaseUrl) {
    throw new Error(
      "Strategist is unavailable right now. Try again in a moment.",
    );
  }

  const url = `${supabaseUrl}/functions/v1/strategist`;

  const body = JSON.stringify({
    action: "chat",
    deck_id: request.deckId,
    user_query: request.userQuery,
    question: request.userQuery,
    conversation_id: request.conversationId || undefined,
    mode: request.mode ?? "auto",
    format: request.format,
    deck_snapshot: request.deckSnapshot,
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
    let errorData: Record<string, unknown> = {};

    try {
      const errorText = await response.text();
      if (errorText) {
        try {
          errorData = JSON.parse(errorText);
        } catch {
          errorData = {};
        }
      }
    } catch {
      errorData = {};
    }

    throw new Error(
      userFacingChatError(
        response.status,
        errorData,
        "Strategist could not review your deck right now. Try again.",
      ),
    );
  }

  const result = (await response.json()) as DeckAssistantChatResponse;
  return result;
}

/**
 * Project synergies / tuning into slideshow-friendly recommendations.
 */
export function recommendationsFromCoach(
  response: DeckAssistantChatResponse,
): DeckAssistantRecommendation[] {
  if (response.recommendations?.length) {
    return response.recommendations;
  }
  const fromSynergies = (response.synergies ?? response.coach?.synergies ?? []).map(
    (s) => ({
      cardId: Number(s.cardId) || 0,
      cardName: s.title,
      reason: s.fitSummary,
      priority: "medium" as const,
      canAdd: true,
      synergyScore: 0.7,
    }),
  );
  if (fromSynergies.length) return fromSynergies;
  return [];
}

export function tuningChipsFromCoach(
  response: DeckAssistantChatResponse,
): TuningRecommendation[] {
  return response.tuning?.recommendation ??
    response.coach?.tuning?.recommendation ??
    [];
}

export async function getConversationHistory(
  deckId: string,
  limit: number = 5,
): Promise<
  Array<{
    id: string;
    created_at: string;
    updated_at: string;
    name?: string | null;
  }>
> {
  const accessToken = await getAccessToken();

  if (!accessToken) {
    throw new Error(
      "Authentication required. Please log in to view conversation history.",
    );
  }

  const { supabase } = await import("../supabaseClient");

  let data: Array<{
    id: string;
    created_at: string;
    updated_at: string;
    name?: string | null;
  }> | null = null;
  let error: { message: string } | null = null;

  try {
    const result = await supabase
      .from("chatbot_conversations")
      .select("id, created_at, updated_at, name")
      .eq("deck_id", deckId)
      .order("updated_at", { ascending: false })
      .limit(limit);

    data = result.data;
    error = result.error;

    if (
      error &&
      error.message.includes("column") &&
      error.message.includes("does not exist")
    ) {
      const fallbackResult = await supabase
        .from("chatbot_conversations")
        .select("id, created_at, updated_at")
        .eq("deck_id", deckId)
        .order("updated_at", { ascending: false })
        .limit(limit);

      data = fallbackResult.data;
      error = fallbackResult.error;

      if (data) {
        data = data.map((conv) => ({ ...conv, name: null }));
      }
    }
  } catch (err) {
    error = err as { message: string };
  }

  if (error) {
    throw new Error(`Failed to load conversation history: ${error.message}`);
  }

  const conversationsWithNames = await Promise.all(
    (data || []).map(async (conv) => {
      if (conv.name) {
        return conv;
      }

      try {
        const { data: messages } = await supabase
          .from("chatbot_messages")
          .select("content")
          .eq("conversation_id", conv.id)
          .eq("role", "user")
          .order("sequence_number", { ascending: true })
          .limit(1)
          .single();

        if (messages?.content) {
          const generatedName = generateConversationName(messages.content);
          try {
            await supabase
              .from("chatbot_conversations")
              .update({ name: generatedName })
              .eq("id", conv.id);
          } catch {
            // ignore
          }

          return { ...conv, name: generatedName };
        }
      } catch {
        // ignore
      }

      return { ...conv, name: null };
    }),
  );

  return conversationsWithNames;
}

function generateConversationName(firstMessage: string): string {
  const cleaned = firstMessage.trim().replace(/\s+/g, " ");
  if (cleaned.length <= 50) {
    return cleaned;
  }
  const truncated = cleaned.substring(0, 47);
  const lastSpace = truncated.lastIndexOf(" ");
  return lastSpace > 0
    ? truncated.substring(0, lastSpace) + "..."
    : truncated + "...";
}

export async function updateConversationName(
  conversationId: string,
  name: string,
): Promise<void> {
  const accessToken = await getAccessToken();

  if (!accessToken) {
    throw new Error(
      "Authentication required. Please log in to update conversation name.",
    );
  }

  const { supabase } = await import("../supabaseClient");
  const { error } = await supabase
    .from("chatbot_conversations")
    .update({ name: name.trim().substring(0, 100) })
    .eq("id", conversationId);

  if (error) {
    if (
      error.message.includes("column") &&
      error.message.includes("does not exist")
    ) {
      throw new Error(
        "Conversation name feature is not available yet. Please run the database migration to add the name column.",
      );
    }
    throw new Error(`Failed to update conversation name: ${error.message}`);
  }
}

export async function getConversationMessages(
  conversationId: string,
): Promise<
  Array<{
    id: string;
    role: "user" | "assistant";
    content: string;
    sequence_number: number;
    timestamp: string;
    recommendations?: DeckAssistantRecommendation[];
    coach?: DeckCoachResponse | null;
  }>
> {
  const accessToken = await getAccessToken();

  if (!accessToken) {
    throw new Error(
      "Authentication required. Please log in to view messages.",
    );
  }

  const { supabase } = await import("../supabaseClient");
  const { data, error } = await supabase
    .from("chatbot_messages")
    .select(
      "id, role, content, sequence_number, timestamp, recommendations, retrieval_metadata",
    )
    .eq("conversation_id", conversationId)
    .order("sequence_number", { ascending: true });

  if (error) {
    throw new Error(`Failed to load messages: ${error.message}`);
  }

  return (
    data?.map((msg) => {
      const meta = msg.retrieval_metadata as
        | { coach?: DeckCoachResponse }
        | null
        | undefined;
      return {
        id: msg.id,
        role: msg.role as "user" | "assistant",
        content: msg.content,
        sequence_number: msg.sequence_number,
        timestamp: msg.timestamp,
        recommendations: msg.recommendations as
          | DeckAssistantRecommendation[]
          | undefined,
        coach: meta?.coach ?? null,
      };
    }) || []
  );
}
