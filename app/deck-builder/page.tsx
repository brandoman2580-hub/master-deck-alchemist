"use client";

import type React from "react";

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
import CutCornerWrapper from "../../components/cut-corner-wrapper";
import { Badge } from "../../components/ui/badge";
import { MessageSquare } from "lucide-react";
import AIChatbot from "../../components/ai-chatbot";
import { Card } from "../../types/card";
import { openLoginModal } from "../../lib/helpers";
import { DeckMode } from "../../types/types";
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

  const handleDragEnd = (event: DragEndEvent) => {
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
        addCardToDeck(browserCard, "mainDeck");
      } else if (
        targetSection === "extraDeck" &&
        isExtraDeckCard(browserCard)
      ) {
        addCardToDeck(browserCard, "extraDeck");
      } else if (targetSection === "sideDeck") {
        addCardToDeck(browserCard, "sideDeck");
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
        removeCardFromDeck(deckInstanceId, currentSection);
        return;
      }

      const targetSection = getDeckSectionFromTarget(targetId, currentDeck);

      // If dropping on the same section, do nothing
      if (targetSection === currentSection) return;

      // Deck section moves (remove from current, add to new)
      removeCardFromDeck(deckInstanceId, currentSection);

      if (targetSection === "mainDeck" && !isExtraDeckCard(deckCard)) {
        addCardToDeck(deckCard, "mainDeck");
      } else if (targetSection === "extraDeck" && isExtraDeckCard(deckCard)) {
        addCardToDeck(deckCard, "extraDeck");
      } else if (targetSection === "sideDeck") {
        addCardToDeck(deckCard, "sideDeck");
      } else {
        // Restore if dropped on invalid target
        addCardToDeck(deckCard, currentSection);
      }
      return;
    }
  };

  // Double-click handlers
  const handleCardDoubleClick = (card: Card) => {
    if (isExtraDeckCard(card)) {
      addCardToDeck(card, "extraDeck");
    } else {
      addCardToDeck(card, "mainDeck");
    }
  };

  const handleDeckCardDoubleClick = (
    deckInstanceId: string,
    section: "mainDeck" | "extraDeck" | "sideDeck",
  ) => {
    removeCardFromDeck(deckInstanceId, section);
  };

  const stats = getDeckStats();

  return (
    <DndContext
      sensors={sensors}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
    >
      {/* Cyberpunk-styled deck builder layout */}
      <div className="min-h-screen bg-cyb-900 px-8 pt-8 pb-10 relative">
        <div className="max-w-7xl mx-auto relative z-10">
          <div className="flex flex-col space-y-6">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div>
                <h1 className="text-3xl font-bold text-white font-display tracking-wider">
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
                  variant="default"
                  onClick={() => {
                    if (!user) {
                      openLoginModal();
                    } else {
                      setIsChatOpen(true);
                    }
                  }}
                >
                  <MessageSquare className="h-4 w-4 mr-2" />
                  Ask AI Assistant
                </Button>
              </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-[1fr_1fr] gap-6">
              {/* Left side - Deck Building Area (Primary Drop/Upload Panel) */}
              <div className="space-y-6">
                <CutCornerWrapper
                  size="md"
                  hoverHighlight
                  padding="0"
                  style={{
                    ["--cut-corner-stroke" as string]: "rgba(20,239,255,0.38)",
                    ["--cut-corner-stroke-hover" as string]:
                      "rgba(20,239,255,0.52)",
                    ["--cut-corner-fill" as string]: "transparent",
                    backdropFilter: "blur(6px) saturate(120%)",
                    WebkitBackdropFilter: "blur(6px) saturate(120%)",
                  } as React.CSSProperties}
                >
                  <CardUI className="bg-transparent">
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
                      removeCardFromDeck={removeCardFromDeck}
                      handleDeckCardDoubleClick={handleDeckCardDoubleClick}
                    />
                  </CardUI>
                </CutCornerWrapper>
              </div>

              {/* Right side - Card Browser (File List / Library) */}
              <CardBrowser
                currentDeck={currentDeck}
                deckMode={deckMode}
                activeDragId={activeDragId}
                handleCardDoubleClick={handleCardDoubleClick}
              />
            </div>
          </div>
        </div>
      </div>

      <DragOverlayComponent activeDragCard={activeDragCard} />

      <AIChatbot isOpen={isChatOpen} onClose={() => setIsChatOpen(false)} />
    </DndContext>
  );
}
