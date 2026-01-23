import { useState } from "react";
import { sendChatMessage, type DeckAssistantChatResponse } from "@/lib/api/deckAssistant";
import type { Message } from "@/components/deck-assistant/chat-interface-types";

interface UseChatMessageOptions {
  currentDeckId: string;
  conversationId: string | undefined;
  onConversationChange?: (conversationId: string | undefined) => void;
  saveDeck: () => Promise<void>;
}

export function useChatMessage({
  currentDeckId,
  conversationId,
  onConversationChange,
  saveDeck,
}: UseChatMessageOptions) {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Retry logic with exponential backoff
  const sendMessageWithRetry = async (
    deckId: string,
    userQuery: string,
    convId: string | undefined,
    retries = 3
  ): Promise<DeckAssistantChatResponse> => {
    let lastError: Error | null = null;
    
    for (let attempt = 0; attempt < retries; attempt++) {
      try {
        const response = await sendChatMessage({
          deckId,
          userQuery,
          conversationId: convId,
        });
        return response;
      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error));
        
        // Don't retry on authentication errors or client errors (4xx)
        if (lastError.message.includes("Authentication") || 
            lastError.message.includes("401") ||
            lastError.message.includes("403") ||
            lastError.message.includes("400")) {
          throw lastError;
        }
        
        // Exponential backoff: wait 1s, 2s, 4s
        if (attempt < retries - 1) {
          const delay = Math.pow(2, attempt) * 1000;
          await new Promise(resolve => setTimeout(resolve, delay));
        }
      }
    }
    
    throw lastError || new Error("Failed to send message after retries");
  };

  const sendMessage = async (
    userQuery: string,
    setMessages: React.Dispatch<React.SetStateAction<Message[]>>
  ): Promise<void> => {
    setIsLoading(true);
    setError(null);

    try {
      // Ensure deck is saved and has an ID
      let deckId = currentDeckId;
      if (!deckId || deckId === "temp" || deckId === "") {
        await saveDeck();
        deckId = currentDeckId;
        
        if (!deckId || deckId === "temp" || deckId === "") {
          throw new Error("Please save your deck first before using the assistant.");
        }
      }

      // Call deck-assistant API with retry logic
      const response = await sendMessageWithRetry(
        deckId,
        userQuery,
        conversationId,
        3
      );

      // Update conversation ID if provided
      if (response.conversation_id) {
        onConversationChange?.(response.conversation_id);
      }

      // Handle response based on type
      if (response.type === "clarification") {
        const clarificationMessage: Message = {
          id: (Date.now() + 1).toString(),
          role: "assistant",
          content: response.question || response.text,
          timestamp: new Date(),
        };
        setMessages((prev) => [...prev, clarificationMessage]);
      } else if (response.type === "recommendations" || response.type === "ratio_suggestions") {
        const ratioText = response.ratioSuggestions 
          ? "\n\n" + response.ratioSuggestions.map(rs => 
              `${rs.cardName}: ${rs.currentCount} → ${rs.suggestedCount}\n${rs.reason}`
            ).join("\n\n")
          : "";
        const assistantMessage: Message = {
          id: (Date.now() + 1).toString(),
          role: "assistant",
          content: response.text + ratioText,
          timestamp: new Date(),
          recommendations: response.recommendations?.map((rec) => ({
            cardId: rec.cardId,
            cardName: rec.cardName,
            reason: rec.reason,
            priority: rec.priority,
            canAdd: rec.canAdd,
            impactEst: rec.impactEst,
            synergyScore: rec.synergyScore,
          })),
        };
        setMessages((prev) => [...prev, assistantMessage]);
      } else {
        throw new Error(response.error || "Unknown response type");
      }
    } catch (error) {
      console.error("Error sending message:", error);
      const errorMessageText =
        error instanceof Error
          ? error.message
          : "Sorry, I encountered an error. Please try again.";
      
      setError(errorMessageText);
      
      const errorMessage: Message = {
        id: (Date.now() + 1).toString(),
        role: "assistant",
        content: errorMessageText,
        timestamp: new Date(),
      };
      setMessages((prev) => [...prev, errorMessage]);
    } finally {
      setIsLoading(false);
    }
  };

  return {
    sendMessage,
    isLoading,
    error,
    setError,
  };
}
