import { useState } from "react";
import {
  sendChatMessage,
  type DeckAssistantChatResponse,
} from "@/lib/api/strategist";
import type {
  AssistantMode,
  DeckCoachResponse,
} from "@/lib/engine/assistant-contract";
import type { DeckSnapshot } from "@/lib/engine/deck-snapshot";
import type { StrategistMessage } from "@/components/mda/workshop-strategist/types";

/**
 * Prefer the nested coach payload; fall back to flat chat fields when the
 * edge returns a coach answer without `coach` (transitional responses).
 */
function coachFromChatResponse(
  response: DeckAssistantChatResponse,
): DeckCoachResponse | null {
  if (response.coach) return response.coach;
  if (!response.answer) return null;
  return {
    mode: response.mode ?? "qa",
    answer: response.answer,
    confidence: response.confidence ?? "medium",
    limitations: response.limitations ?? [],
    evidence: response.evidence ?? [],
    tuning: response.tuning ?? undefined,
    synergies: response.synergies ?? undefined,
  };
}

interface UseChatMessageOptions {
  currentDeckId: string;
  conversationId: string | undefined;
  onConversationChange?: (conversationId: string | undefined) => void;
  mode?: AssistantMode;
  format?: "TCG" | "MASTER_DUEL";
  /** Live Workshop snapshot builder — called at send time. */
  getDeckSnapshot?: () => DeckSnapshot;
}

/**
 * Sends chat messages to Strategist with the live Workshop deck snapshot.
 * Caller must gate on saved + legal decks before invoking.
 */
export function useChatMessage({
  currentDeckId,
  conversationId,
  onConversationChange,
  mode = "auto",
  format,
  getDeckSnapshot,
}: UseChatMessageOptions) {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const sendMessageWithRetry = async (
    deckId: string,
    userQuery: string,
    convId: string | undefined,
    deckSnapshot: DeckSnapshot | undefined,
    requestMode: AssistantMode,
    retries = 3,
  ): Promise<DeckAssistantChatResponse> => {
    let lastError: Error | null = null;

    for (let attempt = 0; attempt < retries; attempt++) {
      try {
        const response = await sendChatMessage({
          deckId,
          userQuery,
          conversationId: convId,
          mode: requestMode,
          format,
          deckSnapshot,
        });
        return response;
      } catch (err) {
        lastError = err instanceof Error ? err : new Error(String(err));

        if (
          lastError.message.includes("log in") ||
          lastError.message.includes("not legal") ||
          lastError.message.includes("card library") ||
          lastError.message.includes("Save your deck") ||
          lastError.message.includes("could not be found")
        ) {
          throw lastError;
        }

        // Do not retry client validation / auth failures
        const msg = lastError.message.toLowerCase();
        if (
          msg.includes("authentication") ||
          msg.includes("401") ||
          msg.includes("403") ||
          msg.includes("400")
        ) {
          throw lastError;
        }

        if (attempt < retries - 1) {
          const delay = Math.pow(2, attempt) * 1000;
          await new Promise((resolve) => setTimeout(resolve, delay));
        }
      }
    }

    throw lastError ||
      new Error("Strategist could not review your deck right now. Try again.");
  };

  const sendMessage = async (
    userQuery: string,
    setMessages: React.Dispatch<React.SetStateAction<StrategistMessage[]>>,
    modeOverride?: AssistantMode,
  ): Promise<void> => {
    const requestMode = modeOverride ?? mode;
    setIsLoading(true);
    setError(null);

    try {
      const deckId = currentDeckId;
      if (!deckId || deckId === "temp" || deckId === "") {
        throw new Error("Save your deck before using Strategist.");
      }

      const deckSnapshot = getDeckSnapshot?.();

      const response = await sendMessageWithRetry(
        deckId,
        userQuery,
        conversationId,
        deckSnapshot,
        requestMode,
        3,
      );

      if (response.type === "clarification") {
        const clarificationMessage: StrategistMessage = {
          id: (Date.now() + 1).toString(),
          role: "assistant",
          content: response.question || response.text || response.answer || "",
          timestamp: new Date(),
        };
        setMessages((prev) => [...prev, clarificationMessage]);
        if (response.conversation_id) {
          onConversationChange?.(response.conversation_id);
        }
        return;
      }

      const coach = coachFromChatResponse(response);

      const answer =
        response.answer ||
        response.text ||
        coach?.answer ||
        "";

      const assistantMessage: StrategistMessage = {
        id: (Date.now() + 1).toString(),
        role: "assistant",
        content: answer,
        timestamp: new Date(),
        coach,
        mode: coach?.mode,
        confidence: coach?.confidence,
        evidence: coach?.evidence,
        tuning: coach?.tuning ?? null,
        synergies: coach?.synergies ?? null,
        limitations: coach?.limitations,
        recommendations: coach?.recommendations,
        redirectHint: coach?.redirectHint ?? null,
      };

      setMessages((prev) => [...prev, assistantMessage]);
      if (response.conversation_id) {
        onConversationChange?.(response.conversation_id);
      }
    } catch (err) {
      const errorMessageText =
        err instanceof Error
          ? err.message
          : "Strategist could not review your deck right now. Try again.";

      setError(errorMessageText);

      const errorMessage: StrategistMessage = {
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
