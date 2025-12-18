"use client";

import { useState, useEffect, useCallback } from "react";
import { useDeck } from "../../context/deck-context";
import {
  DndContext,
  type DragEndEvent,
  type DragStartEvent,
  useSensor,
  useSensors,
  PointerSensor,
  UniqueIdentifier,
} from "@dnd-kit/core";
import { Button } from "../../components/ui/button";
import { Card as CardUI } from "../../components/ui/card";
import { Badge } from "../../components/ui/badge";
import { Sparkles } from "lucide-react";
import AIChatbot from "../../components/ai-chatbot/ai-chatbot";
import { Card } from "../../types/card";
import { openLoginModal } from "../../lib/helpers";
import { DeckMode, DeckSection } from "../../types/types";
import { useCardStore } from "../../store/cardStore";
import { useUserStore } from "../../store/useUserStore";
import { useModeStore } from "../../store/modeStore";
import DeckBuilderTips from "../../components/deck-builder-tips";
import {
  analyzeDeck as analyzeDeckUtil,
  isExtraDeckCard,
  exportDeckAsFile,
  getPlaystyleIcon,
  getDeckSectionFromTarget,
} from "./utils";
import { TierBadge } from "../../components/deck-builder/tier-badge";
import { DeckHeader } from "../../components/deck-builder/deck-header";
import { DeckTabs } from "../../components/deck-builder/deck-tabs";
import { CardBrowser } from "../../components/deck-builder/card-browser";
import { DragOverlayComponent } from "../../components/deck-builder/drag-overlay";
import { useAnalytics } from "../../lib/hooks/useAnalytics";

export default function DeckBuilder() {
  const {
    currentDeck,
    removeCardFromDeck,
    clearDeck,
    exportDeck,
    importDeck,
    renameDeck,
    getDeckStats,
    addCardToDeck,
    updateDeckMode,
  } = useDeck();

  // State -----------------------------------------------
  const [activeDragCard, setActiveDragCard] = useState<Card | null>(null);
  const [isChatOpen, setIsChatOpen] = useState(false);
  const [deckTier, setDeckTier] = useState<number | null>(null);
  const [deckPlayStyle, setDeckPlayStyle] = useState<string[]>([]);
  const [activeDragId, setActiveDragId] = useState<UniqueIdentifier | null>(
    null,
  );

  // Zustand Store -----------------------------------------
  const cardList = useCardStore((state) => state.cardList);
  const user = useUserStore((state) => state.user);
  const deckMode = useModeStore((state) => state.deckMode);
  const setDeckMode = useModeStore((state) => state.setDeckMode);
  
  // Phase 6: Analytics
  const { track } = useAnalytics();

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 3, // Reduced distance for easier drag activation
      },
    }),
  );

  useEffect(() => {
    // Sync deck mode with current deck's mode when deck changes
    if (currentDeck.mode && currentDeck.mode !== deckMode) {
      setDeckMode(currentDeck.mode as DeckMode);
    }
  }, [currentDeck.mode, deckMode, setDeckMode]);

  const analyzeDeck = useCallback(() => {
    const stats = getDeckStats();
    const analysis = analyzeDeckUtil(currentDeck, stats);
    setDeckPlayStyle(analysis.playStyles);
    setDeckTier(analysis.tier);
  }, [currentDeck, getDeckStats]);

  useEffect(() => {
    // Analyze deck and set tier and play style
    analyzeDeck();
  }, [currentDeck, analyzeDeck]);

  const handleExportDeck = () => {
    const jsonData = exportDeck();
    exportDeckAsFile(jsonData, currentDeck.name || "");
  };

  // Phase 6: Wrapper for addCardToDeck with analytics
  const handleAddCardToDeck = useCallback(
    (card: Card, section: DeckSection) => {
      addCardToDeck(card, section);
      track({
        type: "card_added",
        cardId: card.id,
        cardName: card.name,
        section,
      });
    },
    [addCardToDeck, track],
  );

  // Phase 6: Wrapper for removeCardFromDeck with analytics
  const handleRemoveCardFromDeck = useCallback(
    (deckInstanceId: string, section: DeckSection) => {
      // Find card before removing for analytics
      const cardInstance = currentDeck[section].find(
        (c) => c.deckInstanceId === deckInstanceId,
      );
      if (cardInstance) {
        track({
          type: "card_removed",
          cardId: cardInstance.id,
          cardName: cardInstance.name,
          section,
        });
      }
      removeCardFromDeck(deckInstanceId, section);
    },
    [currentDeck, removeCardFromDeck, track],
  );

  const handleDragStart = (event: DragStartEvent) => {
    const { active } = event;
    setActiveDragId(active.id);

    const dragType = active.data?.current?.type;
    if (dragType === "browser") {
      const cardId = active.data?.current?.cardId;
      const browserCard = cardId
        ? cardList.find((c) => c.id === cardId)
        : null;
      setActiveDragCard(browserCard || null);
    } else if (dragType === "deck") {
      const deckInstanceId = active.data?.current?.deckInstanceId;
      const deckCard =
        currentDeck.mainDeck.find((c) => c.deckInstanceId === deckInstanceId) ||
        currentDeck.extraDeck.find(
          (c) => c.deckInstanceId === deckInstanceId,
        ) ||
        currentDeck.sideDeck.find((c) => c.deckInstanceId === deckInstanceId);
      setActiveDragCard(deckCard || null);
    } else {
      setActiveDragCard(null);
    }
  };

  const handleDragEnd = useCallback((event: DragEndEvent) => {
    const { active, over } = event;
    setActiveDragId(null);
    setActiveDragCard(null);

    if (!over) return;

    const targetId = over.id as string;
    const dragType = active.data?.current?.type;

    // Browser -> Deck
    if (dragType === "browser") {
      const cardId = active.data?.current?.cardId;
      const browserCard = cardId
        ? cardList.find((c) => c.id === cardId)
        : null;
      if (!browserCard) return;

      const targetSection = getDeckSectionFromTarget(targetId, currentDeck);

      if (targetSection === "mainDeck" && !isExtraDeckCard(browserCard)) {
        handleAddCardToDeck(browserCard, "mainDeck");
      } else if (
        targetSection === "extraDeck" &&
        isExtraDeckCard(browserCard)
      ) {
        handleAddCardToDeck(browserCard, "extraDeck");
      } else if (targetSection === "sideDeck") {
        handleAddCardToDeck(browserCard, "sideDeck");
      }
      return;
    }

    // Deck -> Browser or move section
    if (dragType === "deck") {
      const deckInstanceId = active.data?.current?.deckInstanceId;
      const sections: ("mainDeck" | "extraDeck" | "sideDeck")[] = [
        "mainDeck",
        "extraDeck",
        "sideDeck",
      ];
      let deckCard: Card | null = null,
        currentSection: "mainDeck" | "extraDeck" | "sideDeck" | null = null;

      for (const section of sections) {
        const found = currentDeck[section].find(
          (c) => c.deckInstanceId === deckInstanceId,
        );
        if (found) {
          deckCard = found;
          currentSection = section;
          break;
        }
      }
      if (!deckCard || !currentSection) return;

      // Deck -> Card Browser: remove card from deck
      if (targetId === "card-browser") {
        handleRemoveCardFromDeck(deckInstanceId, currentSection);
        return;
      }

      const targetSection = getDeckSectionFromTarget(targetId, currentDeck);

      // If dropping on the same section, do nothing
      if (targetSection === currentSection) return;

      // Deck section moves (remove from current, add to new)
      handleRemoveCardFromDeck(deckInstanceId, currentSection);

      if (targetSection === "mainDeck" && !isExtraDeckCard(deckCard)) {
        handleAddCardToDeck(deckCard, "mainDeck");
      } else if (targetSection === "extraDeck" && isExtraDeckCard(deckCard)) {
        handleAddCardToDeck(deckCard, "extraDeck");
      } else if (targetSection === "sideDeck") {
        handleAddCardToDeck(deckCard, "sideDeck");
      } else {
        // Restore if dropped on invalid target
        handleAddCardToDeck(deckCard, currentSection);
      }
      return;
    }
  }, [currentDeck, cardList, handleAddCardToDeck, handleRemoveCardFromDeck]);

  // Double-click handlers
  const handleCardDoubleClick = useCallback(
    (card: Card) => {
      const section = isExtraDeckCard(card) ? "extraDeck" : "mainDeck";
      handleAddCardToDeck(card, section);
    },
    [handleAddCardToDeck],
  );


  const stats = getDeckStats();

  return (
    <DndContext
      sensors={sensors}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
    >
      {/* Glassmorphic deck builder layout */}
      <div className="h-[calc(100vh-3.75rem)] bg-transparent flex flex-col overflow-hidden">
        <div className="flex-shrink-0 px-4 sm:px-6 lg:px-8 pt-4 sm:pt-6 pb-4">
          <div className="max-w-7xl mx-auto">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div>
                <h1 className="text-2xl sm:text-3xl font-bold text-white font-display tracking-wider">
                  DECK BUILDER
                </h1>
                <div className="flex flex-wrap gap-2 mt-2">
                  {deckPlayStyle.map((style, index) => {
                    const Icon = getPlaystyleIcon(style);
                    return (
                      <Badge
                        key={index}
                        variant="outline"
                        className="flex items-center"
                      >
                        <Icon className="h-3 w-3 mr-1" />
                        {style}
                      </Badge>
                    );
                  })}
                  <TierBadge tier={deckTier} />
                </div>
              </div>

              <div className="flex flex-wrap gap-2 items-center">
                <DeckBuilderTips />
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => {
                    if (!user) {
                      openLoginModal();
                    } else {
                      setIsChatOpen(true);
                    }
                  }}
                  className="text-white/80 hover:text-white hover:bg-white/10"
                  aria-label="Ask AI Assistant"
                >
                  <Sparkles className="h-5 w-5" />
                </Button>
              </div>
            </div>
          </div>
        </div>

        <div className="flex-1 min-h-0 px-4 sm:px-6 lg:px-8 pb-4 sm:pb-6">
          <div className="max-w-7xl mx-auto h-full">
            <div className="h-full grid grid-cols-1 lg:grid-cols-[1.2fr_0.8fr] gap-4 sm:gap-6">
              {/* Left side - Deck Building Area (Primary Drop/Upload Panel) - Visually Dominant */}
              <div className="h-full flex flex-col min-h-0">
                <div className="h-full rounded-2xl bg-white/5 border border-white/10 backdrop-blur-xl shadow-lg flex flex-col min-h-0 overflow-hidden">
                  <div className="p-4 sm:p-6 flex-1 min-h-0 flex flex-col overflow-y-auto">
                    <CardUI className="bg-transparent h-full flex flex-col">
                      <DeckHeader
                        currentDeckName={currentDeck.name || ""}
                        user={user}
                        deckMode={deckMode}
                        setDeckMode={setDeckMode}
                        updateDeckMode={updateDeckMode}
                        handleExportDeck={handleExportDeck}
                        importDeck={importDeck}
                        clearDeck={clearDeck}
                        renameDeck={renameDeck}
                      />
                      <DeckTabs
                        stats={stats}
                        currentDeck={currentDeck}
                        deckMode={deckMode}
                        activeDragId={activeDragId}
                        removeCardFromDeck={handleRemoveCardFromDeck}
                        addCardToDeck={handleAddCardToDeck}
                      />
                    </CardUI>
                  </div>
                </div>
              </div>

              {/* Right side - Card Browser (Shopping-style) */}
              <div className="h-full flex flex-col min-h-0">
                <CardBrowser
                  currentDeck={currentDeck}
                  deckMode={deckMode}
                  activeDragId={activeDragId}
                  handleCardDoubleClick={handleCardDoubleClick}
                  addCardToDeck={handleAddCardToDeck}
                />
              </div>
            </div>
          </div>
        </div>
      </div>

      <DragOverlayComponent activeDragCard={activeDragCard} />

      {/* AI Assistant Modal */}
      <AIChatbot isOpen={isChatOpen} onClose={() => setIsChatOpen(false)} />
    </DndContext>
  );
}
