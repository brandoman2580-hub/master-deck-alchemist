"use client";

import { useState, useLayoutEffect, useRef, useCallback, useEffect } from "react";
import { CardContent } from "@/components/ui/card";
import { Tabs, TabsContent } from "@/components/ui/tabs";
import { Card } from "@/types/card";
import { DeckType, DeckMode, DeckSection } from "@/types/types";
import { UniqueIdentifier } from "@dnd-kit/core";
import { CartSection } from "./cart-section";
import { Layers, Zap, Shield } from "lucide-react";

interface DeckTabsProps {
  stats: {
    mainCount: number;
    extraCount: number;
    sideCount: number;
  };
  currentDeck: DeckType;
  deckMode: DeckMode;
  activeDragId: UniqueIdentifier | null;
  removeCardFromDeck: (
    deckInstanceId: string,
    section: "mainDeck" | "extraDeck" | "sideDeck",
  ) => void;
  addCardToDeck: (card: Card, section: DeckSection) => void;
}

export function DeckTabs({
  stats,
  currentDeck,
  deckMode,
  activeDragId,
  removeCardFromDeck,
  addCardToDeck,
}: DeckTabsProps) {
  // Internal state for active tab
  const [activeTab, setActiveTab] = useState("main");

  // Refs for tab slider
  const mainTabRef = useRef<HTMLButtonElement>(null);
  const extraTabRef = useRef<HTMLButtonElement>(null);
  const sideTabRef = useRef<HTMLButtonElement>(null);
  const tabsContainerRef = useRef<HTMLDivElement>(null);
  const [tabSliderStyle, setTabSliderStyle] = useState<React.CSSProperties>({});


  // Switch to valid tab if current tab becomes invalid when deck mode changes
  useEffect(() => {
    if (deckMode === "Master Duel" && activeTab === "side") {
      setActiveTab("main");
    }
  }, [deckMode, activeTab]);

  // Calculate tab slider position
  useLayoutEffect(() => {
    if (tabsContainerRef.current) {
      let activeTabRef: React.RefObject<HTMLButtonElement> | null = null;
      if (activeTab === "main") activeTabRef = mainTabRef;
      else if (activeTab === "extra") activeTabRef = extraTabRef;
      else if (activeTab === "side") activeTabRef = sideTabRef;

      if (activeTabRef?.current) {
        const containerRect = tabsContainerRef.current.getBoundingClientRect();
        const btnRect = activeTabRef.current.getBoundingClientRect();
        setTabSliderStyle({
          left: btnRect.left - containerRect.left,
          width: btnRect.width,
        });
      }
    }
  }, [activeTab, deckMode]);

  // Handler for removing individual card instances
  const handleRemove = useCallback(
    (deckInstanceId: string, section: DeckSection) => {
      removeCardFromDeck(deckInstanceId, section);
    },
    [removeCardFromDeck],
  );

  // Undo/Redo handlers (using deckStore from Phase 1)
  // For now, we'll add basic handlers that can be connected to the store later
  const handleUndo = useCallback(() => {
    // TODO: Connect to deckStore.undo() when ready
    console.log("Undo not yet connected to store");
  }, []);

  const handleRedo = useCallback(() => {
    // TODO: Connect to deckStore.redo() when ready
    console.log("Redo not yet connected to store");
  }, []);

  // Check undo/redo availability (placeholder)
  const canUndo = false; // TODO: useDeckStore((state) => state.canUndo())
  const canRedo = false; // TODO: useDeckStore((state) => state.canRedo())

  // Keyboard shortcuts for undo/redo
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === "z" && !e.shiftKey) {
        e.preventDefault();
        if (canUndo) handleUndo();
      } else if ((e.ctrlKey || e.metaKey) && (e.key === "y" || (e.key === "z" && e.shiftKey))) {
        e.preventDefault();
        if (canRedo) handleRedo();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [canUndo, canRedo, handleUndo, handleRedo]);
  // Calculate status colors for counts
  const getMainCountColor = () => {
    if (stats.mainCount < 40) return "text-yellow-400";
    if (stats.mainCount > 60) return "text-red-400";
    return "text-white/80";
  };

  const getExtraCountColor = () => {
    if (stats.extraCount > 15) return "text-red-400";
    return "text-white/80";
  };

  const getSideCountColor = () => {
    if (stats.sideCount > 15) return "text-red-400";
    return "text-white/80";
  };

  return (
    <CardContent className="p-0">
      <Tabs
        defaultValue="main"
        onValueChange={setActiveTab}
        value={activeTab}
      >
        <div className="px-6">
          <div
            className="relative flex w-full bg-white/5 border border-white/10 backdrop-blur-xl rounded-lg p-1"
            ref={tabsContainerRef}
          >
            <span
              className="absolute top-1 bottom-1 transition-all duration-300 bg-white/10 rounded-md"
              style={{
                ...tabSliderStyle,
                zIndex: 0,
                left: typeof tabSliderStyle.left === "number" ? tabSliderStyle.left + 4 : 0,
                width: typeof tabSliderStyle.width === "number" ? tabSliderStyle.width - 8 : 0,
              }}
            />
            <button
              ref={mainTabRef}
              type="button"
              onClick={() => setActiveTab("main")}
              className={`relative z-10 flex-1 px-4 py-3 font-bold transition-all duration-200 focus:outline-none font-display text-sm flex items-center justify-center gap-2 ${
                activeTab === "main"
                  ? "text-white"
                  : "text-white/60 hover:text-white/80"
              }`}
              aria-pressed={activeTab === "main"}
              style={{
                background: "transparent",
                position: "relative",
              }}
            >
              <Layers className="h-4 w-4" />
              <span>Main</span>
              <span className={`text-xs font-semibold ${getMainCountColor()}`}>
                {stats.mainCount}/60
              </span>
            </button>
            <button
              ref={extraTabRef}
              type="button"
              onClick={() => setActiveTab("extra")}
              className={`relative z-10 flex-1 px-4 py-3 font-bold transition-all duration-200 focus:outline-none font-display text-sm flex items-center justify-center gap-2 ${
                activeTab === "extra"
                  ? "text-white"
                  : "text-white/60 hover:text-white/80"
              }`}
              aria-pressed={activeTab === "extra"}
              style={{
                background: "transparent",
                position: "relative",
              }}
            >
              <Zap className="h-4 w-4" />
              <span>Extra</span>
              <span className={`text-xs font-semibold ${getExtraCountColor()}`}>
                {stats.extraCount}/15
              </span>
            </button>
            {deckMode === "TCG" && (
              <button
                ref={sideTabRef}
                type="button"
                onClick={() => setActiveTab("side")}
                className={`relative z-10 flex-1 px-4 py-3 font-bold transition-all duration-200 focus:outline-none font-display text-sm flex items-center justify-center gap-2 ${
                  activeTab === "side"
                    ? "text-white"
                    : "text-white/60 hover:text-white/80"
                }`}
                aria-pressed={activeTab === "side"}
                style={{
                  background: "transparent",
                  position: "relative",
                }}
              >
                <Shield className="h-4 w-4" />
                <span>Side</span>
                <span className={`text-xs font-semibold ${getSideCountColor()}`}>
                  {stats.sideCount}/15
                </span>
              </button>
            )}
          </div>
        </div>

        <TabsContent value="main" className="pt-4 px-6 pb-6">
          <CartSection
            section="mainDeck"
            cards={currentDeck.mainDeck}
            activeDragId={activeDragId}
            onRemove={handleRemove}
            count={stats.mainCount}
            maxCount={60}
          />
        </TabsContent>

        <TabsContent value="extra" className="pt-4 px-6 pb-6">
          <CartSection
            section="extraDeck"
            cards={currentDeck.extraDeck}
            activeDragId={activeDragId}
            onRemove={handleRemove}
            count={stats.extraCount}
            maxCount={15}
          />
        </TabsContent>

        <TabsContent value="side" className="pt-4 px-6 pb-6">
          <CartSection
            section="sideDeck"
            cards={currentDeck.sideDeck}
            activeDragId={activeDragId}
            onRemove={handleRemove}
            count={stats.sideCount}
            maxCount={15}
          />
        </TabsContent>
      </Tabs>
    </CardContent>
  );
}

