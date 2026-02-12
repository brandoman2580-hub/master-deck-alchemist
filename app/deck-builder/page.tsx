"use client";

import { useState, useEffect, useCallback, useRef, useMemo } from "react";
import { motion } from "framer-motion";
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
import { Card as CardUI } from "../../components/ui/card";
import { Badge } from "../../components/ui/badge";
import { Card } from "../../types/card";
import { DeckMode, DeckSection } from "../../types/types";
import { useCardStore } from "../../store/cardStore";
import { useUserStore } from "../../store/useUserStore";
import { useModeStore } from "../../store/modeStore";
import DeckBuilderTips from "@/components/deck-builder/deck-builder-tips";
import {
  analyzeDeck as analyzeDeckUtil,
  isExtraDeckCard,
  getPlaystyleIcon,
  getDeckSectionFromTarget,
} from "./utils";
import { TierBadge } from "../../components/deck-builder/tier-badge";
import { MetaBadge } from "../../components/deck-builder/meta-badge";
import { DeckHeader } from "../../components/deck-builder/deck-header";
import { DeckTabs } from "../../components/deck-builder/deck-tabs";
import { CardBrowser } from "../../components/deck-builder/card-browser";
import { DragOverlayComponent } from "../../components/deck-builder/drag-overlay";
import { useAnalytics } from "../../lib/hooks/useAnalytics";
import {
  slideInDownVariants,
  scaleInVariants,
} from "@/lib/animations";
import { detectMetaDeck } from "../../lib/utils/metaDetector";
import { useMasterDuelRarity } from "../../hooks/useMasterDuelRarity";

export default function DeckBuilder() {
  const {
    currentDeck,
    removeCardFromDeck,
    clearDeck,
    renameDeck,
    getDeckStats,
    addCardToDeck,
    updateDeckMode,
    banlist,
  } = useDeck();

  // State -----------------------------------------------
  const [activeDragCard, setActiveDragCard] = useState<Card | null>(null);
  const [deckTier, setDeckTier] = useState<number | null>(null);
  const [deckPlayStyle, setDeckPlayStyle] = useState<string[]>([]);
  const [metaMatch, setMetaMatch] = useState<{
    deck_name: string;
    tier: number;
    format: "tcg" | "master_duel";
    confidence: number;
  } | null>(null);
  const [activeDragId, setActiveDragId] = useState<UniqueIdentifier | null>(
    null,
  );
  // Track cards that have been dropped and should be hidden during transition
  const [droppedCardIds, setDroppedCardIds] = useState<Set<number>>(new Set());
  // Track deck cards being removed (to hide during transition)
  const [removingDeckCardIds, setRemovingDeckCardIds] = useState<Set<string>>(new Set());
  const [deckSort, setDeckSort] = useState("name");
  const [deckSortDirection, setDeckSortDirection] = useState<"asc" | "desc">("asc");

  // Zustand Store -----------------------------------------
  const cardList = useCardStore((state) => state.cardList);
  const user = useUserStore((state) => state.user);
  const deckMode = useModeStore((state) => state.deckMode);
  const setDeckMode = useModeStore((state) => state.setDeckMode);
  
  // Analytics
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

  // Reset Rarity sort when switching to TCG (Rarity only applies to Master Duel)
  useEffect(() => {
    if (deckMode === "TCG" && deckSort === "md_rarity") {
      setDeckSort("name");
    }
  }, [deckMode, deckSort]);

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

  // Detect meta deck match
  useEffect(() => {
    const detectMeta = async () => {
      if (currentDeck.mainDeck.length === 0) {
        setMetaMatch(null);
        return;
      }

      try {
        const format = deckMode === "TCG" ? "tcg" : "master_duel";
        
        // Detect if deck matches a known meta deck
        // This will gracefully handle if the endpoint is not available (404/503)
        // but will throw errors for unexpected failures (network errors, etc.)
        const match = await detectMetaDeck(currentDeck, format);
        setMetaMatch(match);
      } catch (error) {
        // Meta detection is an optional feature - gracefully degrade
        // Expected errors (404, 503) are handled by detectMetaDeck and return null
        // Unexpected errors (network failures) bubble up but we catch them here
        // to prevent breaking the deck builder
        setMetaMatch(null);
        // In production, you might want to log this to an error reporting service
        // but not show it to users since meta detection is optional
      }
    };

    detectMeta();
  }, [currentDeck, deckMode]);

  // Wrapper for addCardToDeck with analytics
  const handleAddCardToDeck = useCallback(
    async (card: Card, section: DeckSection) => {
      // Simulate small delay for UI feedback
      await new Promise((resolve) => setTimeout(resolve, 300));

      addCardToDeck(card, section);
      track({
        type: "card_added",
        cardId: card.id,
        cardName: card.name,
        section,
      });

      // Clear from added set after 2s
      setTimeout(() => {
      }, 2000);
    },
    [addCardToDeck, track],
  );

  // Wrapper for removeCardFromDeck with analytics
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

  // Drag and Drop Handlers
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
    const dragType = active.data?.current?.type;

    // Browser -> Deck
    if (dragType === "browser") {
      const cardId = active.data?.current?.cardId;
      const browserCard = cardId
        ? cardList.find((c) => c.id === cardId)
        : null;

      if (!over || !browserCard) {
        // Drop cancelled or invalid - clear drag state immediately
        setActiveDragId(null);
        setActiveDragCard(null);
        return;
      }

      const targetId = over.id as string;
      
      // If dropped back into Card Browser zone, hide card image immediately
      if (targetId === "card-browser") {
        // Mark card as dropped immediately to hide it BEFORE dnd-kit animation starts
        setDroppedCardIds((prev) => new Set(prev).add(browserCard.id));
        // Clear drag overlay immediately to prevent any animation
        setActiveDragCard(null);
        setActiveDragId(null);
        // Keep card hidden briefly to prevent visual "travel back"
        setTimeout(() => {
          setDroppedCardIds((prev) => {
            const next = new Set(prev);
            next.delete(browserCard.id);
            return next;
          });
        }, 200);
        return;
      }

      const targetSection = getDeckSectionFromTarget(targetId, currentDeck);

      // Check if dropping on a valid deck section
      const isValidDrop = 
        (targetSection === "mainDeck" && !isExtraDeckCard(browserCard)) ||
        (targetSection === "extraDeck" && isExtraDeckCard(browserCard)) ||
        targetSection === "sideDeck";

      if (isValidDrop) {
        // Mark card as dropped immediately to hide it during transition
        setDroppedCardIds((prev) => new Set(prev).add(browserCard.id));

        // Add card to deck immediately (optimistic update - no delay for drag operations)
        // Use addCardToDeck directly for immediate state update
        if (targetSection === "mainDeck" && !isExtraDeckCard(browserCard)) {
          addCardToDeck(browserCard, "mainDeck");
          track({
            type: "card_added",
            cardId: browserCard.id,
            cardName: browserCard.name,
            section: "mainDeck",
          });
        } else if (
          targetSection === "extraDeck" &&
          isExtraDeckCard(browserCard)
        ) {
          addCardToDeck(browserCard, "extraDeck");
          track({
            type: "card_added",
            cardId: browserCard.id,
            cardName: browserCard.name,
            section: "extraDeck",
          });
        } else if (targetSection === "sideDeck") {
          addCardToDeck(browserCard, "sideDeck");
          track({
            type: "card_added",
            cardId: browserCard.id,
            cardName: browserCard.name,
            section: "sideDeck",
          });
        }

        // Clear drag overlay immediately to prevent animation
        setActiveDragCard(null);
        setActiveDragId(null);
        
        // Clear dropped state after brief delay to ensure card stays hidden during transition
        setTimeout(() => {
          setDroppedCardIds((prev) => {
            const next = new Set(prev);
            next.delete(browserCard.id);
            return next;
          });
        }, 200);
      } else {
        // Invalid drop - clear immediately
        setActiveDragId(null);
        setActiveDragCard(null);
      }
      return;
    }

    if (!over) {
      // Drop cancelled - clear immediately
      setActiveDragId(null);
      setActiveDragCard(null);
      return;
    }

    const targetId = over.id as string;

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
      if (!deckCard || !currentSection) {
        setActiveDragId(null);
        setActiveDragCard(null);
        return;
      }

      // Deck -> Card Browser: remove card from deck
      if (targetId === "card-browser") {
        // Mark card as being removed to hide it during transition
        setRemovingDeckCardIds((prev) => new Set(prev).add(deckInstanceId));
        // Clear drag overlay immediately to prevent animation
        setActiveDragCard(null);
        setActiveDragId(null);
        // Remove card from deck immediately (optimistic update)
        handleRemoveCardFromDeck(deckInstanceId, currentSection);
        // Clear removing state after brief delay
        setTimeout(() => {
          setRemovingDeckCardIds((prev) => {
            const next = new Set(prev);
            next.delete(deckInstanceId);
            return next;
          });
        }, 200);
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
  const pageRef = useRef<HTMLDivElement>(null);

  // Fetch Master Duel rarity for deck cards (display in badges & cost)
  const deckCardIds = [
    ...currentDeck.mainDeck,
    ...currentDeck.extraDeck,
    ...currentDeck.sideDeck,
  ].map((c) => c.id);
  const mdRarityMap = useMasterDuelRarity(deckCardIds, deckMode);

  // Card lookup for deck cost: enrich deck cards with prices from pool when missing
  const cardLookup = useMemo(
    () => new Map(cardList.map((c) => [c.id, c])),
    [cardList],
  );

  return (
    <DndContext
      sensors={sensors}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
    >
      {/* Glassmorphic deck builder layout */}
      <motion.div
        ref={pageRef}
        className="h-[calc(100vh-3.75rem)] bg-transparent flex flex-col overflow-hidden"
        initial="hidden"
        animate="visible"
        variants={scaleInVariants}
      >
        <motion.div
          className="flex-shrink-0 px-4 sm:px-6 lg:px-8 pt-4 sm:pt-6 pb-4"
          initial="hidden"
          animate="visible"
          variants={slideInDownVariants}
        >
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
                  {metaMatch && (
                    <MetaBadge
                      metaMatch={metaMatch}
                      format={deckMode === "TCG" ? "tcg" : "master_duel"}
                    />
                  )}
                </div>
              </div>

              <div className="flex flex-wrap gap-2 items-center">
                <DeckBuilderTips />
              </div>
            </div>
          </div>
        </motion.div>

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
                        currentDeck={currentDeck}
                        user={user}
                        deckMode={deckMode}
                        setDeckMode={setDeckMode}
                        updateDeckMode={updateDeckMode}
                        clearDeck={clearDeck}
                        renameDeck={renameDeck}
                        hasCards={
                          currentDeck.mainDeck.length > 0 ||
                          currentDeck.extraDeck.length > 0 ||
                          currentDeck.sideDeck.length > 0
                        }
                        mdRarityMap={mdRarityMap}
                        cardLookup={cardLookup}
                        banlist={banlist}
                        deckSort={deckSort}
                        deckSortDirection={deckSortDirection}
                        onDeckSortChange={setDeckSort}
                        onDeckSortDirectionChange={setDeckSortDirection}
                      />
                      <DeckTabs
                        stats={stats}
                        currentDeck={currentDeck}
                        deckMode={deckMode}
                        activeDragId={activeDragId}
                        removingDeckCardIds={removingDeckCardIds}
                        removeCardFromDeck={handleRemoveCardFromDeck}
                        addCardToDeck={handleAddCardToDeck}
                        mdRarityMap={mdRarityMap}
                        banlist={banlist}
                        cardLookup={cardLookup}
                        deckSort={deckSort}
                        deckSortDirection={deckSortDirection}
                      />
                    </CardUI>
                  </div>
                </div>
              </div>

              {/* Right side - Card Browser */}
              <div className="flex flex-col min-h-0">
                  <CardBrowser
                    currentDeck={currentDeck}
                    deckMode={deckMode}
                    activeDragId={activeDragId}
                    activeDragCard={activeDragCard}
                    droppedCardIds={droppedCardIds}
                    handleCardDoubleClick={handleCardDoubleClick}
                    addCardToDeck={handleAddCardToDeck}
                  />
              </div>
            </div>
          </div>
        </div>

      <DragOverlayComponent activeDragCard={activeDragCard} />
      </motion.div>
    </DndContext>
  );
}
