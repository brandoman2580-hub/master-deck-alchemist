"use client";

import { useState, useRef, useEffect } from "react";
import { motion } from "framer-motion";
import { DeckType, DeckMode } from "@/types/types";
import { InputWithClear } from "@/components/ui/input-with-clear";
import { Button } from "@/components/ui/button";
import { Send } from "lucide-react";
import { MessageList } from "./message-list";
import { sendChatMessage, getConversationMessages, getConversationHistory, type DeckAssistantChatResponse } from "@/lib/api/deckAssistant";
import { useDeck } from "@/context/deck-context";
import { fingerprintDeck } from "@/lib/recommender-helpers";
import { Skeleton } from "@/components/ui/skeleton";
import type { Card } from "@/types/card";
import type { DeckSection } from "@/types/types";

export interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
  timestamp: Date;
  recommendations?: Recommendation[];
}

export interface Recommendation {
  cardId: number;
  cardName: string;
  reason: string;
  priority: "high" | "medium" | "low";
  canAdd: boolean;
  impactEst?: number;
  synergyScore?: number;
}

interface ChatInterfaceProps {
  currentDeck: DeckType;
  deckMode: DeckMode;
  conversationId?: string;
  onConversationChange?: (conversationId: string | undefined) => void;
}

/**
 * SMS-Style Chat Interface
 * Phase 6: Integrated with deck-assistant edge function API
 */
export function ChatInterface({ 
  currentDeck, 
  deckMode: _deckMode,
  conversationId: externalConversationId,
  onConversationChange,
}: ChatInterfaceProps) {
  // Persist conversation state in localStorage to survive tab switches
  const storageKey = `deck-assistant-conversation-${currentDeck.id || 'temp'}`;
  
  // Load persisted state from localStorage on mount
  const [messages, setMessages] = useState<Message[]>(() => {
    if (typeof window === 'undefined') return [];
    try {
      const saved = localStorage.getItem(storageKey);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (parsed.messages && Array.isArray(parsed.messages)) {
          // Convert timestamp strings back to Date objects
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
  
  const [inputValue, setInputValue] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [conversationId, setConversationId] = useState<string | undefined>(() => {
    if (typeof window === 'undefined') return externalConversationId;
    try {
      const saved = localStorage.getItem(storageKey);
      if (saved) {
        const parsed = JSON.parse(saved);
        return parsed.conversationId || externalConversationId;
      }
    } catch (err) {
      console.error("Failed to load persisted conversationId:", err);
    }
    return externalConversationId;
  });
  const [error, setError] = useState<string | null>(null);
  const [deckFingerprint, setDeckFingerprint] = useState<string | undefined>();
  const [isLoadingHistory, setIsLoadingHistory] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const { saveDeck, addCardToDeck } = useDeck();

  // Persist messages and conversationId to localStorage whenever they change
  useEffect(() => {
    if (typeof window === 'undefined' || !currentDeck.id || currentDeck.id === "temp" || currentDeck.id === "") {
      return;
    }
    try {
      localStorage.setItem(storageKey, JSON.stringify({
        messages: messages.map(msg => ({
          ...msg,
          timestamp: msg.timestamp.toISOString(), // Convert Date to string for JSON
        })),
        conversationId,
      }));
    } catch (err) {
      console.error("Failed to persist conversation state:", err);
    }
  }, [messages, conversationId, storageKey, currentDeck.id]);

  // Generate deck fingerprint when deck changes
  useEffect(() => {
    const generateFingerprint = async () => {
      if (currentDeck.id && currentDeck.id !== "temp" && currentDeck.id !== "") {
        try {
          const fp = await fingerprintDeck(currentDeck, "novice", {});
          setDeckFingerprint(fp);
        } catch (err) {
          console.error("Failed to generate deck fingerprint:", err);
        }
      }
    };
    generateFingerprint();
  }, [currentDeck]);

  // Load conversation history when conversationId changes
  useEffect(() => {
    if (externalConversationId && externalConversationId !== conversationId) {
      setConversationId(externalConversationId);
      loadConversationHistory(externalConversationId);
    }
  }, [externalConversationId]);

  // Track if we've loaded a conversation to prevent unnecessary reloads
  // Use a key based on deck ID to persist across tab switches but reset on deck change
  const conversationLoadKeyRef = useRef<string | null>(null);

  // Load most recent conversation when deck changes (if no conversationId is set or externalConversationId is undefined)
  useEffect(() => {
    const loadMostRecentConversation = async () => {
      // Only load if deck is valid and no external conversationId is provided
      if (!currentDeck.id || currentDeck.id === "temp" || currentDeck.id === "" || externalConversationId !== undefined) {
        return;
      }

      // If we already have a conversationId and messages, don't reload (persist state)
      // This prevents reloading when switching tabs - messages are already loaded from localStorage
      if (conversationId && messages.length > 0) {
        conversationLoadKeyRef.current = currentDeck.id;
        return;
      }

      // If we've already loaded a conversation for this deck, don't reload
      // This prevents reloading when switching tabs
      if (conversationLoadKeyRef.current === currentDeck.id) {
        return;
      }

      try {
        const history = await getConversationHistory(currentDeck.id);
        if (history.length > 0) {
          // Load the most recent conversation (first in the list since it's ordered by updated_at DESC)
          const mostRecentId = history[0].id;
          // Only load if it's different from what we have
          if (mostRecentId !== conversationId) {
            await loadConversationHistory(mostRecentId);
            conversationLoadKeyRef.current = currentDeck.id;
          }
        }
      } catch (err) {
        // Silently fail - user can start a new conversation
        console.error("Failed to load most recent conversation:", err);
      }
    };

    loadMostRecentConversation();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentDeck.id, externalConversationId]); // Load when deck changes or when externalConversationId becomes undefined

  // Clear persisted state when deck changes
  useEffect(() => {
    const oldStorageKey = `deck-assistant-conversation-${conversationLoadKeyRef.current || 'temp'}`;
    if (conversationLoadKeyRef.current && conversationLoadKeyRef.current !== currentDeck.id) {
      // Clear old deck's conversation state
      try {
        localStorage.removeItem(oldStorageKey);
      } catch (err) {
        console.error("Failed to clear old conversation state:", err);
      }
      conversationLoadKeyRef.current = null;
    }
  }, [currentDeck.id]);

  const loadConversationHistory = async (convId: string) => {
    setIsLoadingHistory(true);
    try {
      const historyMessages = await getConversationMessages(convId);
      const formattedMessages: Message[] = historyMessages.map((msg) => ({
        id: msg.id,
        role: msg.role,
        content: msg.content,
        timestamp: new Date(msg.timestamp),
        recommendations: msg.recommendations,
      }));
      setMessages(formattedMessages);
      // Update conversationId if it changed
      if (convId !== conversationId) {
        setConversationId(convId);
        onConversationChange?.(convId);
      }
    } catch (err) {
      console.error("Failed to load conversation history:", err);
      setError(
        err instanceof Error
          ? err.message
          : "Failed to load conversation history",
      );
    } finally {
      setIsLoadingHistory(false);
    }
  };

  const handleAddCard = (card: Card, section: DeckSection) => {
    addCardToDeck(card, section);
  };

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // Retry logic with exponential backoff
  const sendMessageWithRetry = async (
    deckId: string,
    userQuery: string,
    conversationId: string | undefined,
    retries = 3
  ): Promise<DeckAssistantChatResponse> => {
    let lastError: Error | null = null;
    
    for (let attempt = 0; attempt < retries; attempt++) {
      try {
        const response = await sendChatMessage({
          deckId,
          userQuery,
          conversationId,
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

  const handleSend = async () => {
    if (!inputValue.trim() || isLoading) return;

    const userQuery = inputValue.trim();
    const userMessage: Message = {
      id: Date.now().toString(),
      role: "user",
      content: userQuery,
      timestamp: new Date(),
    };

    setMessages((prev) => [...prev, userMessage]);
    setInputValue("");
    setIsLoading(true);
    setError(null);

    try {
      // Ensure deck is saved and has an ID
      let deckId = currentDeck.id;
      if (!deckId || deckId === "temp" || deckId === "") {
        // Save deck first to get an ID
        await saveDeck();
        deckId = currentDeck.id;
        
        if (!deckId || deckId === "temp" || deckId === "") {
          throw new Error("Please save your deck first before using the assistant.");
        }
      }

      // Call deck-assistant API with retry logic
      const response = await sendMessageWithRetry(
        deckId,
        userQuery,
        conversationId,
        3 // 3 retries with exponential backoff
      );

      // Update conversation ID if provided
      if (response.conversation_id) {
        setConversationId(response.conversation_id);
        onConversationChange?.(response.conversation_id);
      }

      // Handle response based on type
      if (response.type === "clarification") {
        // Show clarification question
        const clarificationMessage: Message = {
          id: (Date.now() + 1).toString(),
          role: "assistant",
          content: response.question || response.text,
          timestamp: new Date(),
        };
        setMessages((prev) => [...prev, clarificationMessage]);
      } else if (response.type === "recommendations" || response.type === "ratio_suggestions") {
        // Show recommendations or ratio suggestions
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
          recommendations: response.recommendations,
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

  const handleKeyPress = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
    // Escape to clear input
    if (e.key === "Escape") {
      setInputValue("");
    }
  };

  // Global keyboard shortcuts (when input is not focused)
  useEffect(() => {
    const handleGlobalKeyPress = (e: KeyboardEvent) => {
      // Don't handle if user is typing in an input
      if (document.activeElement?.tagName === "INPUT" || document.activeElement?.tagName === "TEXTAREA") {
        return;
      }

      // Focus input on "/" key
      if (e.key === "/" && !isLoading) {
        e.preventDefault();
        const input = document.querySelector('input[placeholder*="Ask about"]') as HTMLInputElement;
        input?.focus();
      }
    };

    window.addEventListener("keydown", handleGlobalKeyPress);
    return () => window.removeEventListener("keydown", handleGlobalKeyPress);
  }, [isLoading]);

  return (
    <div className="flex flex-col h-full min-h-0">
      {/* Message List - Scrollable */}
      <div className="flex-1 overflow-y-auto min-h-0 p-4 sm:p-6">
        {isLoadingHistory ? (
          // Loading skeletons
          <div className="flex flex-col gap-4">
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="flex flex-col gap-2">
                <div className="flex justify-end">
                  <Skeleton className="h-8 w-48 bg-white/10" />
                </div>
                <div className="flex justify-start">
                  <div className="bg-white/10 border border-white/20 backdrop-blur-xl rounded-2xl px-4 py-3 max-w-[80%] space-y-2">
                    <Skeleton className="h-4 w-full bg-white/10" />
                    <Skeleton className="h-4 w-3/4 bg-white/10" />
                    <Skeleton className="h-32 w-full bg-white/10 rounded-lg mt-2" />
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : messages.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-center">
            <p className="text-white/70 text-sm mb-2">Ask me anything about your deck!</p>
            <p className="text-white/50 text-xs">I can help you find cards, improve consistency, or optimize ratios.</p>
            {error && (
              <p className="text-red-400 text-xs mt-2">{error}</p>
            )}
          </div>
        ) : (
          <>
            <MessageList 
              messages={messages} 
              onAddCard={handleAddCard} 
              deckFingerprint={deckFingerprint}
              conversationId={conversationId}
            />
            {/* Loading indicator */}
            {isLoading && (
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className="flex items-start gap-3 mt-4"
              >
                <div className="bg-white/10 border border-white/20 backdrop-blur-xl rounded-2xl px-4 py-3 flex items-center gap-2">
                  <div className="flex gap-1">
                    <motion.div
                      className="w-2 h-2 bg-white/60 rounded-full"
                      animate={{ y: [0, -4, 0] }}
                      transition={{ duration: 0.6, repeat: Infinity, delay: 0 }}
                    />
                    <motion.div
                      className="w-2 h-2 bg-white/60 rounded-full"
                      animate={{ y: [0, -4, 0] }}
                      transition={{ duration: 0.6, repeat: Infinity, delay: 0.2 }}
                    />
                    <motion.div
                      className="w-2 h-2 bg-white/60 rounded-full"
                      animate={{ y: [0, -4, 0] }}
                      transition={{ duration: 0.6, repeat: Infinity, delay: 0.4 }}
                    />
                  </div>
                  <span className="text-white/70 text-sm">Thinking...</span>
                </div>
              </motion.div>
            )}
            {error && (
              <div className="mt-2 p-2 bg-red-500/10 border border-red-500/20 rounded-lg">
                <p className="text-red-400 text-xs">{error}</p>
              </div>
            )}
            <div ref={messagesEndRef} />
          </>
        )}
      </div>

      {/* Input Bar - Fixed at bottom */}
      <div className="border-t border-white/10 p-4 sm:p-6 flex-shrink-0">
        <div className="flex items-center gap-2">
          <InputWithClear
            placeholder="Ask about your deck..."
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            onClear={() => setInputValue("")}
            onKeyPress={handleKeyPress}
            disabled={isLoading}
            className="flex-1 h-9 text-sm bg-white/5 border border-white/10 text-white placeholder:text-white/50 focus-visible:outline-none rounded-lg transition-all duration-200 focus:border-white/30 focus:bg-white/10"
          />
          <Button
            onClick={handleSend}
            disabled={!inputValue.trim() || isLoading}
            size="icon"
            className="h-9 w-9 flex-shrink-0 bg-white/10 hover:bg-white/15 border border-white/20 text-white disabled:opacity-50 disabled:cursor-not-allowed rounded-lg"
          >
            <Send className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </div>
  );
}
