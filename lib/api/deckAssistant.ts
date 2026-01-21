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
  limit: number = 5,
): Promise<Array<{ id: string; created_at: string; updated_at: string; name?: string | null }>> {
  const accessToken = await getAccessToken();

  if (!accessToken) {
    throw new Error(
      "Authentication required. Please log in to view conversation history.",
    );
  }

  const { supabase } = await import("../supabaseClient");
  
  // Try to select with name column, fallback to without if column doesn't exist
  let data: any[] | null = null;
  let error: any = null;
  
  try {
    const result = await supabase
      .from("chatbot_conversations")
      .select("id, created_at, updated_at, name")
      .eq("deck_id", deckId)
      .order("updated_at", { ascending: false })
      .limit(limit);
    
    data = result.data;
    error = result.error;
    
    // If error is about missing column, try without name
    if (error && (error.message.includes("column") && error.message.includes("does not exist"))) {
      const fallbackResult = await supabase
        .from("chatbot_conversations")
        .select("id, created_at, updated_at")
        .eq("deck_id", deckId)
        .order("updated_at", { ascending: false })
        .limit(limit);
      
      data = fallbackResult.data;
      error = fallbackResult.error;
      
      // Add null name to all conversations if name column doesn't exist
      if (data) {
        data = data.map(conv => ({ ...conv, name: null }));
      }
    }
  } catch (err) {
    error = err;
  }

  if (error) {
    throw new Error(`Failed to load conversation history: ${error.message}`);
  }

  // If name is null, generate it from the first user message
  const conversationsWithNames = await Promise.all(
    (data || []).map(async (conv) => {
      if (conv.name) {
        return conv;
      }
      
      // Fetch first user message to generate name
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
          // Try to update conversation name in database (gracefully fail if column doesn't exist)
          try {
            const { error: updateError } = await supabase
              .from("chatbot_conversations")
              .update({ name: generatedName })
              .eq("id", conv.id);
            
            if (updateError && !updateError.message.includes("column") && !updateError.message.includes("does not exist")) {
              console.warn(`Failed to update conversation name: ${updateError.message}`);
            }
          } catch (updateErr) {
            // Silently fail if name column doesn't exist
            console.warn("Name column may not exist yet, skipping update");
          }
          
          return { ...conv, name: generatedName };
        }
      } catch (err) {
        console.error(`Failed to generate name for conversation ${conv.id}:`, err);
      }
      
      return { ...conv, name: null };
    })
  );

  return conversationsWithNames;
}

/**
 * Generate a conversation name from the first user message
 */
function generateConversationName(firstMessage: string): string {
  // Clean up the message and truncate to 50 characters
  const cleaned = firstMessage.trim().replace(/\s+/g, " ");
  if (cleaned.length <= 50) {
    return cleaned;
  }
  // Truncate at word boundary
  const truncated = cleaned.substring(0, 47);
  const lastSpace = truncated.lastIndexOf(" ");
  return lastSpace > 0 ? truncated.substring(0, lastSpace) + "..." : truncated + "...";
}

/**
 * Update conversation name
 */
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
    .update({ name: name.trim().substring(0, 100) }) // Limit to 100 chars
    .eq("id", conversationId);

  if (error) {
    // If error is about missing column, provide a helpful message
    if (error.message.includes("column") && error.message.includes("does not exist")) {
      throw new Error("Conversation name feature is not available yet. Please run the database migration to add the name column.");
    }
    throw new Error(`Failed to update conversation name: ${error.message}`);
  }
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
