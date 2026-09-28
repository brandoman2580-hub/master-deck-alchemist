import { useState, useEffect, useRef, useCallback } from "react";
import type { StrategistMessage } from "@/components/mda/workshop-strategist/types";
import { getConversationMessages } from "@/lib/api/strategist";

interface UseConversationPersistenceOptions {
  currentDeckId: string | undefined;
  /** When set (e.g. history picker), load that conversation from the API. */
  externalConversationId?: string;
  onConversationChange?: (conversationId: string | undefined) => void;
}

function strategistStorageKey(deckId: string | undefined): string {
  return `strategist-conversation-${deckId || "temp"}`;
}

function legacyAssistantStorageKey(deckId: string | undefined): string {
  return `deck-assistant-conversation-${deckId || "temp"}`;
}

function readLocalThread(
  deckId: string | undefined,
): { messages: StrategistMessage[]; conversationId?: string } | null {
  if (typeof window === "undefined") return null;
  const keys = [strategistStorageKey(deckId), legacyAssistantStorageKey(deckId)];
  for (const key of keys) {
    try {
      const saved = localStorage.getItem(key);
      if (!saved) continue;
      const parsed = JSON.parse(saved);
      if (parsed.messages && Array.isArray(parsed.messages)) {
        return {
          messages: parsed.messages.map(
            (msg: StrategistMessage & { timestamp: string }) => ({
              ...msg,
              timestamp: new Date(msg.timestamp),
            }),
          ),
          conversationId: parsed.conversationId as string | undefined,
        };
      }
    } catch {
      // ignore
    }
  }
  return null;
}

/**
 * Persists Strategist thread to localStorage and optionally loads server history.
 * Migrates once from deck-assistant-conversation-* keys.
 */
export function useConversationPersistence({
  currentDeckId,
  externalConversationId,
  onConversationChange,
}: UseConversationPersistenceOptions) {
  const storageKey = strategistStorageKey(currentDeckId);
  const conversationLoadKeyRef = useRef<string | null>(null);
  const onConversationChangeRef = useRef(onConversationChange);
  const [isLoadingHistory, setIsLoadingHistory] = useState(false);
  const skipAutoLoadRef = useRef(false);

  useEffect(() => {
    onConversationChangeRef.current = onConversationChange;
  }, [onConversationChange]);

  const loadConversationHistory = useCallback(
    async (conversationIdToLoad: string) => {
      setIsLoadingHistory(true);
      try {
        const messagesData = await getConversationMessages(conversationIdToLoad);
        const loadedMessages: StrategistMessage[] = messagesData.map((msg) => ({
          id: msg.id,
          role: msg.role,
          content: msg.content,
          timestamp: new Date(msg.timestamp),
          coach: msg.coach ?? null,
          mode: msg.coach?.mode,
          confidence: msg.coach?.confidence,
          evidence: msg.coach?.evidence,
          tuning: msg.coach?.tuning ?? null,
          synergies: msg.coach?.synergies ?? null,
          limitations: msg.coach?.limitations,
        }));
        setMessages(loadedMessages);
        setConversationId(conversationIdToLoad);
        onConversationChangeRef.current?.(conversationIdToLoad);
      } catch {
        setMessages([]);
        setConversationId(undefined);
      } finally {
        setIsLoadingHistory(false);
      }
    },
    [],
  );

  const [messages, setMessages] = useState<StrategistMessage[]>(() => {
    if (externalConversationId) return [];
    return readLocalThread(currentDeckId)?.messages ?? [];
  });

  const [conversationId, setConversationId] = useState<string | undefined>(
    () => {
      if (typeof window === "undefined") return externalConversationId;
      if (externalConversationId) return externalConversationId;
      return readLocalThread(currentDeckId)?.conversationId;
    },
  );

  useEffect(() => {
    if (
      typeof window === "undefined" ||
      !currentDeckId ||
      currentDeckId === "temp" ||
      currentDeckId === ""
    ) {
      return;
    }
    try {
      localStorage.setItem(
        storageKey,
        JSON.stringify({
          messages: messages.map((msg) => ({
            ...msg,
            timestamp: msg.timestamp.toISOString(),
          })),
          conversationId,
        }),
      );
      localStorage.removeItem(legacyAssistantStorageKey(currentDeckId));
    } catch {
      // ignore
    }
  }, [messages, conversationId, storageKey, currentDeckId]);

  useEffect(() => {
    if (!externalConversationId) return;
    if (externalConversationId === conversationId) return;

    try {
      localStorage.removeItem(storageKey);
    } catch {
      // ignore
    }
    setMessages([]);
    setConversationId(externalConversationId);
    skipAutoLoadRef.current = false;
    void loadConversationHistory(externalConversationId);
  }, [
    externalConversationId,
    conversationId,
    storageKey,
    loadConversationHistory,
  ]);

  useEffect(() => {
    const loadMostRecentConversation = async () => {
      if (
        !currentDeckId ||
        currentDeckId === "temp" ||
        currentDeckId === "" ||
        externalConversationId !== undefined
      ) {
        return;
      }

      if (skipAutoLoadRef.current) {
        conversationLoadKeyRef.current = currentDeckId;
        return;
      }

      if (conversationId && messages.length > 0) {
        conversationLoadKeyRef.current = currentDeckId;
        return;
      }

      if (conversationLoadKeyRef.current === currentDeckId) {
        return;
      }

      if (messages.length > 0) {
        conversationLoadKeyRef.current = currentDeckId;
        return;
      }

      try {
        const { getConversationHistory } = await import("@/lib/api/strategist");
        const history = await getConversationHistory(currentDeckId, 5);
        if (history.length > 0) {
          const mostRecentId = history[0].id;
          if (mostRecentId !== conversationId) {
            await loadConversationHistory(mostRecentId);
          }
        }
        conversationLoadKeyRef.current = currentDeckId;
      } catch {
        conversationLoadKeyRef.current = currentDeckId;
      }
    };

    void loadMostRecentConversation();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentDeckId, externalConversationId, loadConversationHistory]);

  useEffect(() => {
    if (
      conversationLoadKeyRef.current &&
      conversationLoadKeyRef.current !== currentDeckId
    ) {
      conversationLoadKeyRef.current = null;
      skipAutoLoadRef.current = false;
    }
  }, [currentDeckId]);

  const startNewConversation = useCallback(() => {
    skipAutoLoadRef.current = true;
    conversationLoadKeyRef.current = currentDeckId ?? null;
    setConversationId(undefined);
    setMessages([]);
    try {
      if (currentDeckId && currentDeckId !== "temp" && currentDeckId !== "") {
        localStorage.removeItem(storageKey);
        localStorage.removeItem(legacyAssistantStorageKey(currentDeckId));
      }
    } catch {
      // ignore
    }
  }, [currentDeckId, storageKey]);

  return {
    messages,
    setMessages,
    conversationId,
    setConversationId,
    isLoadingHistory,
    startNewConversation,
  };
}
