import { getAccessToken } from "../supabaseClient";

export interface DeckAssistantChatRequest {
  deckId: string;
  userQuery: string;
  conversationId?: string;
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

export interface RatioSuggestion {
  cardName: string;
  currentCount: number;
  suggestedCount: number;
  reason: string;
}

export interface DeckAssistantChatResponse {
  type: "recommendations" | "clarification" | "ratio_suggestions";
  text: string;
  recommendations?: DeckAssistantRecommendation[];
  ratioSuggestions?: RatioSuggestion[];
  conversation_id: string;
  question?: string; // For clarification type
  structured_query?: any; // For recommendations type
  error?: string;
}

/**
 * Send a chat message to the deck assistant
 */
export async function sendChatMessage(
  request: DeckAssistantChatRequest,
): Promise<DeckAssistantChatResponse> {
  const accessToken = await getAccessToken();

  if (!accessToken) {
    throw new Error(
      "Authentication required. Please log in to use the deck assistant.",
    );
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (!supabaseUrl) {
    throw new Error("Missing env.NEXT_PUBLIC_SUPABASE_URL");
  }

  const url = `${supabaseUrl}/functions/v1/deck-assistant`;

  const body = JSON.stringify({
    action: "chat",
    deck_id: request.deckId,
    user_query: request.userQuery,
    conversation_id: request.conversationId || undefined,
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
          errorData = { error: errorText, message: errorText };
        }
      }
    } catch (parseError) {
      console.error("Failed to parse error response:", parseError);
      errorText = "Failed to read error response";
      errorData = { error: "Unknown error", status: response.status };
    }

    if (response.status === 401) {
      throw new Error(
        (errorData.details as string) ||
          (errorData.error as string) ||
          (errorData.message as string) ||
          "Authentication failed. Please log in again.",
      );
    }

    const errorMessage =
      (errorData.details as string) ||
      (errorData.error as string) ||
      (errorData.message as string) ||
      errorText ||
      `Failed to send message (${response.status}: ${response.statusText})`;

    throw new Error(errorMessage);
  }

  const result = (await response.json()) as DeckAssistantChatResponse;
  return result;
}

/**
 * Get conversation history for a deck
 */
export async function getConversationHistory(
  deckId: string,
): Promise<Array<{ id: string; created_at: string; updated_at: string }>> {
  const accessToken = await getAccessToken();

  if (!accessToken) {
    throw new Error(
      "Authentication required. Please log in to view conversation history.",
    );
  }

  const { supabase } = await import("../supabaseClient");
  const { data, error } = await supabase
    .from("chatbot_conversations")
    .select("id, created_at, updated_at")
    .eq("deck_id", deckId)
    .order("updated_at", { ascending: false });

  if (error) {
    throw new Error(`Failed to load conversation history: ${error.message}`);
  }

  return data || [];
}

/**
 * Get messages for a conversation
 */
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
    .select("id, role, content, sequence_number, timestamp, recommendations")
    .eq("conversation_id", conversationId)
    .order("sequence_number", { ascending: true });

  if (error) {
    throw new Error(`Failed to load messages: ${error.message}`);
  }

  return (
    data?.map((msg) => ({
      ...msg,
      recommendations: msg.recommendations as
        | DeckAssistantRecommendation[]
        | undefined,
    })) || []
  );
}
