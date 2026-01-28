"use client";

import { useState, useRef, useEffect } from "react";
import { DeckType, DeckMode } from "@/types/types";
import { MessageList } from "./message-list";
import { useDeck } from "@/context/deck-context";
import { fingerprintDeck } from "@/lib/recommender-helpers";
import type { Card } from "@/types/card";
import type { DeckSection } from "@/types/types";
import { ChatEmptyState } from "./chat-empty-state";
import { ChatLoadingSkeleton } from "./chat-loading-skeleton";
import { ChatLoadingIndicator } from "./chat-loading-indicator";
import { ChatInputBar } from "./chat-input-bar";
import { useConversationPersistence } from "@/hooks/useConversationPersistence";
import { useChatMessage } from "@/hooks/useChatMessage";
import type { Message } from "./chat-interface-types";

export type { Message, Recommendation } from "./chat-interface-types";

interface ChatInterfaceProps {
  currentDeck: DeckType;
  deckMode: DeckMode;
  conversationId?: string;
  onConversationChange?: (conversationId: string | undefined) => void;
  isAuthenticated?: boolean;
  isDeckEmpty?: boolean;
}

/**
 * SMS-Style Chat Interface
 * Integrated with deck-assistant edge function API
 */
export function ChatInterface({ 
  currentDeck, 
  deckMode: _deckMode,
  conversationId: externalConversationId,
  onConversationChange,
  isAuthenticated = false,
  isDeckEmpty = false,
}: ChatInterfaceProps) {
  const [inputValue, setInputValue] = useState("");
  const [deckFingerprint, setDeckFingerprint] = useState<string | undefined>();
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const { saveDeck, addCardToDeck } = useDeck();

  const {
    messages,
    setMessages,
    conversationId,
    setConversationId,
    isLoadingHistory,
  } = useConversationPersistence({
    currentDeckId: currentDeck.id,
    externalConversationId,
    onConversationChange,
  });

  const {
    sendMessage,
    isLoading,
    error,
  } = useChatMessage({
    currentDeckId: currentDeck.id || "",
    conversationId,
    onConversationChange: (id) => {
      setConversationId(id);
      onConversationChange?.(id);
    },
    saveDeck,
  });

  // Generate deck fingerprint when deck changes
  useEffect(() => {
    const generateFingerprint = async () => {
      if (currentDeck.id && currentDeck.id !== "temp" && currentDeck.id !== "") {
        try {
          const fp = await fingerprintDeck(currentDeck, "novice", {});
          setDeckFingerprint(fp);
        } catch (err) {
          // Failed to generate deck fingerprint - silently continue
        }
      }
    };
    generateFingerprint();
  }, [currentDeck]);

  const handleAddCard = (card: Card, section: DeckSection) => {
    addCardToDeck(card, section);
  };

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const handleSend = async () => {
    if (!inputValue.trim() || isLoading || !isAuthenticated || isDeckEmpty) return;

    const userQuery = inputValue.trim();
    const userMessage: Message = {
      id: Date.now().toString(),
      role: "user",
      content: userQuery,
      timestamp: new Date(),
    };

    setMessages((prev) => [...prev, userMessage]);
    setInputValue("");
    await sendMessage(userQuery, setMessages);
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
      <div className="flex-1 overflow-y-auto min-h-0 p-4 sm:p-6" style={{ minHeight: 0 }}>
        {isLoadingHistory ? (
          <ChatLoadingSkeleton />
        ) : messages.length === 0 ? (
          <ChatEmptyState
            isAuthenticated={isAuthenticated}
            isDeckEmpty={isDeckEmpty}
            error={error}
          />
        ) : (
          <>
            <MessageList 
              messages={messages} 
              onAddCard={handleAddCard} 
              deckFingerprint={deckFingerprint}
              conversationId={conversationId}
            />
            {isLoading && <ChatLoadingIndicator />}
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
      <ChatInputBar
        inputValue={inputValue}
        isLoading={isLoading}
        isAuthenticated={isAuthenticated}
        isDeckEmpty={isDeckEmpty}
        onInputChange={(e) => setInputValue(e.target.value)}
        onInputClear={() => setInputValue("")}
        onKeyPress={handleKeyPress}
        onSend={handleSend}
      />
    </div>
  );
}
