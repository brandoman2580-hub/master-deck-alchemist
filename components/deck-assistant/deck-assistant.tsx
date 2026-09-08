"use client";

import { useMemo, useState } from "react";
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
import { useDeck } from "@/context/deck-context";
import { evaluateAssistantEligibility } from "@/lib/engine/legality";

interface DeckAssistantProps {
  currentDeck: DeckType;
  deckMode: DeckMode;
}

/**
 * Main Deck Assistant Component
 * Gates chat on saved + legal decks via Facts Brain eligibility.
 */
export function DeckAssistant({ currentDeck, deckMode }: DeckAssistantProps) {
  const [conversationId, setConversationId] = useState<string | undefined>();
  const [isHistoryModalCollapsed, setIsHistoryModalCollapsed] = useState(true);
  const [isInfoDialogOpen, setIsInfoDialogOpen] = useState(false);
  const user = useUserStore((state) => state.user);
  const { banlist, savedDecks } = useDeck();

  const isDeckEmpty =
    currentDeck.mainDeck.length === 0 &&
    currentDeck.extraDeck.length === 0 &&
    currentDeck.sideDeck.length === 0;

  const savedDeckIds = useMemo(
    () => new Set(savedDecks.map((deck) => deck.id)),
    [savedDecks],
  );

  const assistantEligibility = useMemo(
    () =>
      evaluateAssistantEligibility(currentDeck, {
        banlist,
        savedDeckIds,
      }),
    [banlist, currentDeck, savedDeckIds],
  );

  const isAuthenticated = !!user;
  const isAssistantReady = isAuthenticated && assistantEligibility.ok;

  const handleSelectConversation = (convId: string) => {
    setConversationId(convId);
    setIsHistoryModalCollapsed(true);
  };

  const handleNewConversation = () => {
    setConversationId(undefined);
    setIsHistoryModalCollapsed(true);
  };

  return (
    <div className="flex flex-col relative h-[calc(100vh-250px)]">
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

      {isAssistantReady &&
        currentDeck.id &&
        currentDeck.id !== "temp" &&
        currentDeck.id !== "" && (
          <ConversationHistoryModal
            deckId={currentDeck.id}
            currentConversationId={conversationId}
            onSelectConversation={handleSelectConversation}
            onNewConversation={handleNewConversation}
            isCollapsed={isHistoryModalCollapsed}
            onToggleCollapse={() => setIsHistoryModalCollapsed(true)}
          />
        )}

      <div className="flex-1 min-h-0">
        <ChatInterface
          currentDeck={currentDeck}
          deckMode={deckMode}
          conversationId={conversationId}
          onConversationChange={(id) => setConversationId(id)}
          isAuthenticated={isAuthenticated}
          isDeckEmpty={isDeckEmpty}
          assistantBlocked={!assistantEligibility.ok}
          assistantBlockReasons={assistantEligibility.errors}
        />
      </div>

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
              <h3 className="font-semibold text-white/90 text-base">Requirements</h3>
              <p className="leading-relaxed text-white/80">
                The assistant only runs on a saved, renamed, legal deck (40–60 main,
                format banlist compliant). Incomplete or unsaved lists are blocked so
                recommendations stay grounded in validated facts.
              </p>
            </section>
            <section className="space-y-2">
              <h3 className="font-semibold text-white/90 text-base">Getting Started</h3>
              <p className="leading-relaxed text-white/80">
                The AI Assistant analyzes your current deck and provides personalized
                recommendations based on archetype, playstyle, and composition.
              </p>
            </section>
            <section className="space-y-2">
              <h3 className="font-semibold text-white/90 text-base">Asking Good Questions</h3>
              <ul className="list-disc pl-5 space-y-1 text-white/80">
                <li>
                  <strong>Card Ratios:</strong> &quot;How can I adjust my card ratios to
                  improve consistency?&quot;
                </li>
                <li>
                  <strong>Power Level:</strong> &quot;What cards can I add to increase my
                  deck&apos;s power?&quot;
                </li>
                <li>
                  <strong>Specific Needs:</strong> &quot;I need more hand traps&quot; or
                  &quot;Help me find better starters&quot;
                </li>
              </ul>
            </section>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
