"use client";

import { useState } from "react";
import { DeckType, DeckMode } from "@/types/types";
import { ChatInterface } from "./chat-interface";
import { ConversationHistoryModal } from "./conversation-history-modal";
import { History, Info, Lock } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { useUserStore } from "@/store/useUserStore";
import { openLoginModal } from "@/lib/helpers";

interface DeckAssistantProps {
  currentDeck: DeckType;
  deckMode: DeckMode;
}

/**
 * Main Deck Assistant Component
 * Integrated with conversation history modal
 */
export function DeckAssistant({ currentDeck, deckMode }: DeckAssistantProps) {
  const [conversationId, setConversationId] = useState<string | undefined>();
  const [isHistoryModalCollapsed, setIsHistoryModalCollapsed] = useState(true);
  const [isInfoDialogOpen, setIsInfoDialogOpen] = useState(false);
  const user = useUserStore((state) => state.user);
  
  // Check if deck is empty
  const isDeckEmpty = 
    currentDeck.mainDeck.length === 0 &&
    currentDeck.extraDeck.length === 0 &&
    currentDeck.sideDeck.length === 0;
  
  const isAuthenticated = !!user;

  // Note: Conversation persistence is handled in ChatInterface component
  // We don't reset conversationId here to allow persistence across deck changes

  const handleSelectConversation = (convId: string) => {
    setConversationId(convId);
    setIsHistoryModalCollapsed(true);
  };

  const handleNewConversation = () => {
    // Clear conversation state - ChatInterface will handle clearing localStorage
    setConversationId(undefined);
    setIsHistoryModalCollapsed(true);
  };

  return (
    <div className="flex flex-col relative h-[calc(100vh-250px)]">
      {/* History Toggle Button */}
      <div className="absolute top-4 left-4 z-30 flex items-center gap-2">
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => {
                  if (!isAuthenticated) {
                    openLoginModal();
                  } else {
                    setIsHistoryModalCollapsed(!isHistoryModalCollapsed);
                  }
                }}
                disabled={!isAuthenticated}
                className={`h-8 w-8 bg-white/10 border border-white/20 text-white ${
                  isAuthenticated
                    ? "hover:bg-white/15"
                    : "opacity-50 cursor-not-allowed relative group"
                }`}
              >
                <History className="h-4 w-4" />
                {!isAuthenticated && (
                  <Lock className="h-3 w-3 absolute -top-0.5 -right-0.5 text-red-400 opacity-0 group-hover:opacity-100 transition-opacity" />
                )}
              </Button>
            </TooltipTrigger>
            {!isAuthenticated && (
              <TooltipContent>
                <p>Please log in to use this feature</p>
              </TooltipContent>
            )}
          </Tooltip>
        </TooltipProvider>
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => {
                  if (!isAuthenticated) {
                    openLoginModal();
                  } else {
                    setIsInfoDialogOpen(true);
                  }
                }}
                disabled={!isAuthenticated}
                className={`h-8 w-8 bg-white/10 border border-white/20 text-white ${
                  isAuthenticated
                    ? "hover:bg-white/15"
                    : "opacity-50 cursor-not-allowed relative group"
                }`}
                aria-label="How to use AI Assistant"
              >
                <Info className="h-4 w-4" />
                {!isAuthenticated && (
                  <Lock className="h-3 w-3 absolute -top-0.5 -right-0.5 text-red-400 opacity-0 group-hover:opacity-100 transition-opacity" />
                )}
              </Button>
            </TooltipTrigger>
            {!isAuthenticated && (
              <TooltipContent>
                <p>Please log in to use this feature</p>
              </TooltipContent>
            )}
          </Tooltip>
        </TooltipProvider>
      </div>

      {/* Conversation History Dialog */}
      {isAuthenticated && currentDeck.id && currentDeck.id !== "temp" && currentDeck.id !== "" && (
        <ConversationHistoryModal
          deckId={currentDeck.id}
          currentConversationId={conversationId}
          onSelectConversation={handleSelectConversation}
          onNewConversation={handleNewConversation}
          isCollapsed={isHistoryModalCollapsed}
          onToggleCollapse={() => setIsHistoryModalCollapsed(true)}
        />
      )}

      {/* Chat Interface */}
      <div className="flex-1 min-h-0">
        <ChatInterface
          currentDeck={currentDeck}
          deckMode={deckMode}
          conversationId={conversationId}
          onConversationChange={(id) => setConversationId(id)}
          isAuthenticated={isAuthenticated}
          isDeckEmpty={isDeckEmpty}
        />
      </div>

      {/* Information Dialog */}
      <Dialog open={isInfoDialogOpen} onOpenChange={setIsInfoDialogOpen}>
        <DialogContent className="max-w-2xl bg-white/10 border border-white/20 backdrop-blur-xl">
          <DialogHeader>
            <DialogTitle className="text-xl font-bold text-white flex items-center gap-2">
              <Info className="h-5 w-5 text-white/80" />
              How to Use the AI Assistant
            </DialogTitle>
            <DialogDescription className="text-white/80 pt-2">
              Learn how to get the most out of your AI-powered deck building assistant.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 text-sm text-white/90 max-h-[60vh] overflow-y-auto pr-2 pt-4">
            <section className="space-y-2">
              <h3 className="font-semibold text-white/90 text-base">
                Getting Started
              </h3>
              <p className="leading-relaxed text-white/80">
                The AI Assistant analyzes your current deck and provides personalized recommendations. 
                It considers your deck's archetype, playstyle, and composition to give you relevant suggestions.
              </p>
            </section>

            <section className="space-y-2">
              <h3 className="font-semibold text-white/90 text-base">
                Asking Good Questions
              </h3>
              <ul className="list-disc pl-5 space-y-1 text-white/80">
                <li><strong>Card Ratios:</strong> "How can I adjust my card ratios to improve consistency?"</li>
                <li><strong>Power Level:</strong> "What cards can I add to increase my deck's power?"</li>
                <li><strong>Specific Needs:</strong> "I need more hand traps" or "Help me find better starters"</li>
                <li><strong>Deck Optimization:</strong> "What should I cut to make room for X?"</li>
                <li><strong>Matchup Help:</strong> "What cards help against control decks?"</li>
              </ul>
            </section>

            <section className="space-y-2">
              <h3 className="font-semibold text-white/90 text-base">
                Understanding Responses
              </h3>
              <p className="leading-relaxed text-white/80">
                The assistant will provide:
              </p>
              <ul className="list-disc pl-5 space-y-1 text-white/80">
                <li><strong>Ratio Suggestions:</strong> When you ask about ratios, you'll get specific recommendations like "Effect Veiler: 3 → 2"</li>
                <li><strong>Card Recommendations:</strong> When you ask for new cards, you'll see a slideshow with reasoning and priority levels</li>
                <li><strong>Archetype-Aware:</strong> Suggestions consider your deck's archetype (Dragons, Fiends, etc.)</li>
              </ul>
            </section>

            <section className="space-y-2">
              <h3 className="font-semibold text-white/90 text-base">
                Feedback
              </h3>
              <p className="leading-relaxed text-white/80">
                Use 👍 or 👎 on AI responses to help improve future recommendations. Your feedback helps the AI learn what works best for your deck.
              </p>
            </section>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
