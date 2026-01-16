"use client";

import { useState } from "react";
import { DeckType, DeckMode } from "@/types/types";
import { ChatInterface } from "./chat-interface";
import { ConversationHistorySidebar } from "./conversation-history-sidebar";
import { History, Info } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

interface DeckAssistantProps {
  currentDeck: DeckType;
  deckMode: DeckMode;
}

/**
 * Main Deck Assistant Component
 * Phase 6: Integrated with conversation history sidebar
 */
export function DeckAssistant({ currentDeck, deckMode }: DeckAssistantProps) {
  const [conversationId, setConversationId] = useState<string | undefined>();
  const [isHistorySidebarCollapsed, setIsHistorySidebarCollapsed] = useState(true);
  const [isInfoDialogOpen, setIsInfoDialogOpen] = useState(false);

  // Note: Conversation persistence is handled in ChatInterface component
  // We don't reset conversationId here to allow persistence across deck changes

  const handleSelectConversation = (convId: string) => {
    setConversationId(convId);
    setIsHistorySidebarCollapsed(true);
  };

  const handleNewConversation = () => {
    setConversationId(undefined);
    setIsHistorySidebarCollapsed(true);
  };

  return (
    <div className="h-full flex flex-col min-h-0 relative">
      {/* History Toggle Button */}
      <div className="absolute top-4 left-4 z-30 flex items-center gap-2">
        <Button
          variant="ghost"
          size="icon"
          onClick={() => setIsHistorySidebarCollapsed(!isHistorySidebarCollapsed)}
          className="h-8 w-8 bg-white/10 hover:bg-white/15 border border-white/20 text-white"
        >
          <History className="h-4 w-4" />
        </Button>
        <Button
          variant="ghost"
          size="icon"
          onClick={() => setIsInfoDialogOpen(true)}
          className="h-8 w-8 bg-white/10 hover:bg-white/15 border border-white/20 text-white"
          aria-label="How to use AI Assistant"
        >
          <Info className="h-4 w-4" />
        </Button>
      </div>

      {/* Conversation History Sidebar */}
      {currentDeck.id && currentDeck.id !== "temp" && currentDeck.id !== "" && (
        <ConversationHistorySidebar
          deckId={currentDeck.id}
          currentConversationId={conversationId}
          onSelectConversation={handleSelectConversation}
          onNewConversation={handleNewConversation}
          isCollapsed={isHistorySidebarCollapsed}
          onToggleCollapse={() => setIsHistorySidebarCollapsed(true)}
        />
      )}

      {/* Chat Interface */}
      <div className="flex-1 min-h-0">
        <ChatInterface
          currentDeck={currentDeck}
          deckMode={deckMode}
          conversationId={conversationId}
          onConversationChange={(id) => setConversationId(id)}
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
          <div className="space-y-4 text-sm text-white/90 max-h-[60vh] overflow-y-auto pr-2">
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
                <li><strong>Ratio Suggestions:</strong> When you ask about ratios, you'll get specific recommendations like "Lair of Darkness: 3 → 2"</li>
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
