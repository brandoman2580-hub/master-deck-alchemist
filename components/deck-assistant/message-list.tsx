"use client";

import { useState, useEffect, useMemo } from "react";
import { motion } from "framer-motion";
import { ThumbsUp, ThumbsDown, Search, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { Message } from "./chat-interface";
import { CardSlideshow } from "./card-slideshow";
import type { Card } from "@/types/card";
import type { DeckSection } from "@/types/types";
import { submitTelemetryFeedback } from "@/lib/api/recommendationFeedback";

interface MessageListProps {
  messages: Message[];
  onAddCard?: (card: Card, section: DeckSection) => void;
  deckFingerprint?: string; // For feedback tracking
  conversationId?: string; // For persisting feedback state
}

/**
 * Message List Component
 * Phase 5: User messages are plain text (right-aligned), assistant messages are rounded bubbles (left-aligned)
 * Updated: Slideshows integrated into assistant message bubbles, feedback buttons added
 */
export function MessageList({ messages, onAddCard, deckFingerprint, conversationId }: MessageListProps) {
  const [feedbackStates, setFeedbackStates] = useState<Map<string, "approved" | "disapproved" | null>>(new Map());
  const [searchQuery, setSearchQuery] = useState("");
  const [isSearchOpen, setIsSearchOpen] = useState(false);

  // Filter messages based on search query
  const filteredMessages = useMemo(() => {
    if (!searchQuery.trim()) return messages;
    const query = searchQuery.toLowerCase();
    return messages.filter((msg) => 
      msg.content.toLowerCase().includes(query) ||
      msg.recommendations?.some(rec => rec.cardName.toLowerCase().includes(query))
    );
  }, [messages, searchQuery]);

  // Load feedback states from localStorage when conversationId changes
  useEffect(() => {
    if (conversationId) {
      const storageKey = `deck-assistant-feedback-${conversationId}`;
      const saved = localStorage.getItem(storageKey);
      if (saved) {
        try {
          const parsed = JSON.parse(saved) as Record<string, "approved" | "disapproved" | null>;
          setFeedbackStates(new Map(Object.entries(parsed)));
        } catch (err) {
          console.error("Failed to load feedback states:", err);
        }
      }
    }
  }, [conversationId]);

  // Save feedback states to localStorage whenever they change
  useEffect(() => {
    if (conversationId && feedbackStates.size > 0) {
      const storageKey = `deck-assistant-feedback-${conversationId}`;
      const toSave = Object.fromEntries(feedbackStates);
      localStorage.setItem(storageKey, JSON.stringify(toSave));
    }
  }, [feedbackStates, conversationId]);

  const handleFeedback = async (messageId: string, feedback: "approved" | "disapproved") => {
    const message = messages.find((m) => m.id === messageId);
    if (!message || message.role !== "assistant") {
      return;
    }

    // Optimistic update
    const previousFeedback = feedbackStates.get(messageId);
    setFeedbackStates((prev) => {
      const newMap = new Map(prev);
      newMap.set(messageId, feedback);
      return newMap;
    });

    try {
      // Submit feedback using telemetry format
      if (deckFingerprint) {
        await submitTelemetryFeedback({
          deckFingerprint,
          suggestionId: `deck-assistant-${messageId}`,
          accepted: feedback === "approved",
          context: {
            originalQuestion: messages[messages.indexOf(message) - 1]?.content || "",
            receivedCount: message.recommendations?.length || 0,
          },
        });
      }
    } catch (error) {
      console.error("Failed to submit feedback:", error);
      // Revert optimistic update on error
      setFeedbackStates((prev) => {
        const newMap = new Map(prev);
        newMap.set(messageId, previousFeedback || null);
        return newMap;
      });
    }
  };

  return (
    <div className="flex flex-col gap-4">
      {/* Search Bar */}
      {messages.length > 0 && (
        <div className="flex items-center gap-2 mb-2">
          {isSearchOpen ? (
            <div className="flex items-center gap-2 flex-1">
              <Input
                placeholder="Search messages..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="h-8 text-sm bg-white/5 border-white/10 text-white placeholder:text-white/50"
                autoFocus
              />
              <Button
                variant="ghost"
                size="icon"
                onClick={() => {
                  setIsSearchOpen(false);
                  setSearchQuery("");
                }}
                className="h-8 w-8 text-white/70 hover:text-white"
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
          ) : (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setIsSearchOpen(true)}
              className="h-8 text-xs text-white/70 hover:text-white hover:bg-white/10"
            >
              <Search className="h-3 w-3 mr-1" />
              Search
            </Button>
          )}
        </div>
      )}

      {/* Search Results Count */}
      {searchQuery && (
        <div className="text-xs text-white/60 mb-2">
          Found {filteredMessages.length} of {messages.length} messages
        </div>
      )}

      {filteredMessages.length === 0 && searchQuery ? (
        <div className="text-center py-8 text-white/50 text-sm">
          No messages found matching &quot;{searchQuery}&quot;
        </div>
      ) : (
        filteredMessages.map((message) => {
          const feedbackState = feedbackStates.get(message.id);
          const hasRecommendations = message.recommendations && message.recommendations.length > 0;
          const showFeedback = message.role === "assistant" && (hasRecommendations || message.content.length > 50);

          return (
          <motion.div
            key={message.id}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.2 }}
            className={`flex flex-col ${message.role === "user" ? "items-end" : "items-start"}`}
          >
            {message.role === "user" ? (
              // User message: Plain text, no bubble, right-aligned
              <p className="text-white/90 text-sm max-w-[80%] break-words">
                {message.content}
              </p>
            ) : (
              // Assistant message: Rounded bubble, no tail, left-aligned, with integrated slideshow
              <div className="bg-white/10 border border-white/20 backdrop-blur-xl rounded-2xl px-4 py-3 max-w-[80%] flex flex-col gap-3">
                <p className="text-white text-sm break-words whitespace-pre-wrap">
                  {message.content}
                </p>
                {/* Integrated slideshow for recommendations */}
                {hasRecommendations && onAddCard && (
                  <div className="mt-2 -mx-2">
                    <CardSlideshow 
                      recommendations={message.recommendations!} 
                      onAddCard={onAddCard}
                    />
                  </div>
                )}
                {/* Feedback buttons */}
                {showFeedback && (
                  <div className="flex items-center gap-2 mt-2 pt-2 border-t border-white/10">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleFeedback(message.id, "approved")}
                      className={`h-7 px-2 text-xs ${
                        feedbackState === "approved"
                          ? "bg-white/20 text-white"
                          : "text-white/70 hover:text-white hover:bg-white/10"
                      }`}
                      aria-label="Helpful"
                    >
                      <ThumbsUp className="h-3 w-3 mr-1" />
                      Helpful
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleFeedback(message.id, "disapproved")}
                      className={`h-7 px-2 text-xs ${
                        feedbackState === "disapproved"
                          ? "bg-white/20 text-white"
                          : "text-white/70 hover:text-white hover:bg-white/10"
                      }`}
                      aria-label="Not helpful"
                    >
                      <ThumbsDown className="h-3 w-3 mr-1" />
                      Not helpful
                    </Button>
                  </div>
                )}
              </div>
            )}
          </motion.div>
          );
        })
      )}
    </div>
  );
}
