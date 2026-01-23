import { useState, useEffect, useRef, useCallback } from "react";
import type { Message } from "@/components/deck-assistant/chat-interface-types";
import { getConversationMessages } from "@/lib/api/deckAssistant";

interface UseConversationPersistenceOptions {
  currentDeckId: string | undefined;
  externalConversationId?: string;
  onConversationChange?: (conversationId: string | undefined) => void;
}

export function useConversationPersistence({
  currentDeckId,
  externalConversationId,
  onConversationChange,
}: UseConversationPersistenceOptions) {
  const storageKey = `deck-assistant-conversation-${currentDeckId || 'temp'}`;
  const conversationLoadKeyRef = useRef<string | null>(null);
  const onConversationChangeRef = useRef(onConversationChange);
  const [isLoadingHistory, setIsLoadingHistory] = useState(false);

  // Keep ref updated
  useEffect(() => {
    onConversationChangeRef.current = onConversationChange;
  }, [onConversationChange]);

  // Load conversation history from API
  const loadConversationHistory = useCallback(async (conversationIdToLoad: string) => {
    setIsLoadingHistory(true);
    try {
      const messagesData = await getConversationMessages(conversationIdToLoad);
      const loadedMessages: Message[] = messagesData.map((msg) => ({
        id: msg.id,
        role: msg.role,
        content: msg.content,
        timestamp: new Date(msg.timestamp),
        recommendations: msg.recommendations,
      }));
      setMessages(loadedMessages);
      setConversationId(conversationIdToLoad);
      onConversationChangeRef.current?.(conversationIdToLoad);
    } catch (err) {
      console.error("Failed to load conversation history:", err);
      setMessages([]);
      setConversationId(undefined);
    } finally {
      setIsLoadingHistory(false);
    }
  }, []);

  // Load persisted state from localStorage on mount
  const [messages, setMessages] = useState<Message[]>(() => {
    if (typeof window === 'undefined') return [];
    if (externalConversationId) return [];
    try {
      const saved = localStorage.getItem(storageKey);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (parsed.messages && Array.isArray(parsed.messages)) {
          return parsed.messages.map((msg: any) => ({
            ...msg,
            timestamp: new Date(msg.timestamp),
          }));
        }
      }
    } catch (err) {
      console.error("Failed to load persisted messages:", err);
    }
    return [];
  });

  const [conversationId, setConversationId] = useState<string | undefined>(() => {
    if (typeof window === 'undefined') return externalConversationId;
    if (externalConversationId) return externalConversationId;
    try {
      const saved = localStorage.getItem(storageKey);
      if (saved) {
        const parsed = JSON.parse(saved);
        return parsed.conversationId;
      }
    } catch (err) {
      console.error("Failed to load persisted conversationId:", err);
    }
    return undefined;
  });

  // Persist messages and conversationId to localStorage whenever they change
  useEffect(() => {
    if (typeof window === 'undefined' || !currentDeckId || currentDeckId === "temp" || currentDeckId === "") {
      return;
    }
    try {
      localStorage.setItem(storageKey, JSON.stringify({
        messages: messages.map(msg => ({
          ...msg,
          timestamp: msg.timestamp.toISOString(),
        })),
        conversationId,
      }));
    } catch (err) {
      console.error("Failed to persist conversation state:", err);
    }
  }, [messages, conversationId, storageKey, currentDeckId]);

  // Load conversation history when conversationId changes
  useEffect(() => {
    if (externalConversationId && externalConversationId !== conversationId) {
      try {
        localStorage.removeItem(storageKey);
      } catch (err) {
        console.error("Failed to clear conversation state:", err);
      }
      setMessages([]);
      setConversationId(externalConversationId);
      void loadConversationHistory(externalConversationId);
    } else if (externalConversationId === undefined && conversationId !== undefined) {
      setConversationId(undefined);
      setMessages([]);
      try {
        localStorage.removeItem(storageKey);
      } catch (err) {
        console.error("Failed to clear conversation state:", err);
      }
    }
  }, [externalConversationId, conversationId, storageKey, loadConversationHistory]);

  // Load most recent conversation when deck changes
  useEffect(() => {
    const loadMostRecentConversation = async () => {
      if (!currentDeckId || currentDeckId === "temp" || currentDeckId === "" || externalConversationId !== undefined) {
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
        return;
      }

      try {
        const { getConversationHistory } = await import("@/lib/api/deckAssistant");
        const history = await getConversationHistory(currentDeckId, 5);
        if (history.length > 0) {
          const mostRecentId = history[0].id;
          if (mostRecentId !== conversationId) {
            try {
              localStorage.removeItem(storageKey);
            } catch (err) {
              console.error("Failed to clear conversation state:", err);
            }
            await loadConversationHistory(mostRecentId);
            conversationLoadKeyRef.current = currentDeckId;
          }
        }
      } catch (err) {
        console.error("Failed to load most recent conversation:", err);
      }
    };

    loadMostRecentConversation();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentDeckId, externalConversationId, loadConversationHistory]);

  // Clear persisted state when deck changes
  useEffect(() => {
    const oldStorageKey = `deck-assistant-conversation-${conversationLoadKeyRef.current || 'temp'}`;
    if (conversationLoadKeyRef.current && conversationLoadKeyRef.current !== currentDeckId) {
      try {
        localStorage.removeItem(oldStorageKey);
      } catch (err) {
        console.error("Failed to clear old conversation state:", err);
      }
      conversationLoadKeyRef.current = null;
    }
  }, [currentDeckId]);

  return {
    messages,
    setMessages,
    conversationId,
    setConversationId,
    isLoadingHistory,
  };
}
