"use client";

import { useState, useLayoutEffect, useRef } from "react";
import { CardContent } from "@/components/ui/card";
import { Tabs, TabsContent } from "@/components/ui/tabs";
import { Progress } from "@/components/ui/progress";
import { DeckDropZone } from "@/components/ui/deck-drop-zone";
import { DraggableCard } from "@/components/ui/draggable-card";
import { AlertCircle } from "lucide-react";
import { DeckType } from "@/types/types";
import { DeckMode } from "@/types/types";

interface DeckTabsProps {
  stats: {
    mainCount: number;
    extraCount: number;
    sideCount: number;
  };
  currentDeck: DeckType;
  deckMode: DeckMode;
  removeCardFromDeck: (
    deckInstanceId: string,
    section: "mainDeck" | "extraDeck" | "sideDeck",
  ) => void;
  handleDeckCardDoubleClick: (
    deckInstanceId: string,
    section: "mainDeck" | "extraDeck" | "sideDeck",
  ) => void;
}

export function DeckTabs({
  stats,
  currentDeck,
  deckMode,
  removeCardFromDeck,
  handleDeckCardDoubleClick,
}: DeckTabsProps) {
  // Internal state for active tab
  const [activeTab, setActiveTab] = useState("main");

  // Refs for tab slider
  const mainTabRef = useRef<HTMLButtonElement>(null);
  const extraTabRef = useRef<HTMLButtonElement>(null);
  const sideTabRef = useRef<HTMLButtonElement>(null);
  const tabsContainerRef = useRef<HTMLDivElement>(null);
  const [tabSliderStyle, setTabSliderStyle] = useState<React.CSSProperties>({});

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
  }, [activeTab]);
  return (
    <CardContent className="p-0">
      <Tabs
        defaultValue="main"
        onValueChange={setActiveTab}
        value={activeTab}
      >
        <div className="px-6">
          <div
            className="relative flex w-full bg-cyb-800/40 border border-accent-cyan/18 backdrop-blur-sm rounded-lg"
            ref={tabsContainerRef}
          >
            <span
              className="absolute top-0 bottom-0 transition-all duration-200 bg-accent-cyan/20 rounded-lg"
              style={{ ...tabSliderStyle, zIndex: 0 }}
            />
            <button
              ref={mainTabRef}
              type="button"
              onClick={() => setActiveTab("main")}
              className={`relative z-10 flex-1 px-3 py-2 font-semibold transition-colors duration-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400/60 font-display text-xs flex items-center justify-center gap-1 ${
                activeTab === "main"
                  ? "text-accent-cyan/80"
                  : "text-muted-50"
              }`}
              aria-pressed={activeTab === "main"}
              style={{
                background: "transparent",
                position: "relative",
              }}
            >
              Main Deck ({stats.mainCount})
            </button>
            <button
              ref={extraTabRef}
              type="button"
              onClick={() => setActiveTab("extra")}
              className={`relative z-10 flex-1 px-3 py-2 font-semibold transition-colors duration-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400/60 font-display text-xs flex items-center justify-center gap-1 ${
                activeTab === "extra"
                  ? "text-accent-cyan/80"
                  : "text-muted-50"
              }`}
              aria-pressed={activeTab === "extra"}
              style={{
                background: "transparent",
                position: "relative",
              }}
            >
              Extra Deck ({stats.extraCount})
            </button>
            {deckMode === "TCG" && (
              <button
                ref={sideTabRef}
                type="button"
                onClick={() => setActiveTab("side")}
                className={`relative z-10 flex-1 px-3 py-2 font-semibold transition-colors duration-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400/60 font-display text-xs flex items-center justify-center gap-1 ${
                  activeTab === "side"
                    ? "text-accent-cyan/80"
                    : "text-muted-50"
                }`}
                aria-pressed={activeTab === "side"}
                style={{
                  background: "transparent",
                  position: "relative",
                }}
              >
                Side Deck ({stats.sideCount})
              </button>
            )}
          </div>
        </div>

        <TabsContent value="main" className="pt-4 px-6 pb-6">
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-semibold text-white">
                Main Deck ({stats.mainCount}/60)
              </h3>
              <div className="text-sm text-muted-50">Min: 40 cards</div>
            </div>

            <Progress value={(stats.mainCount / 40) * 100} className="h-2" />

            <div
              id="main-deck"
              className="w-full bg-cyb-900/60 hover:bg-[rgba(20,239,255,0.08)] hover:outline hover:outline-[1px] hover:outline-[rgba(20,239,255,0.35)] hover:shadow-[0_0_12px_rgba(20,239,255,0.20)]"
            >
              <DeckDropZone
                id="main-deck"
                isEmpty={currentDeck.mainDeck.length === 0}
              >
                {currentDeck.mainDeck.length === 0 ? (
                  <div className="flex flex-col items-center text-muted-50 py-8">
                    <AlertCircle className="h-8 w-8 mb-2 text-accent-cyan" />
                    <span className="text-sm font-medium text-muted-50">
                      Drag and drop cards here to build your Main Deck
                    </span>
                  </div>
                ) : (
                  <div
                    className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-2"
                    style={{ minHeight: "140px" }}
                  >
                    {currentDeck.mainDeck.map((card) => (
                      <DraggableCard
                        id={card.deckInstanceId}
                        key={card.deckInstanceId}
                        card={card}
                        onRemove={() =>
                          removeCardFromDeck(card.deckInstanceId, "mainDeck")
                        }
                        onDoubleClick={() =>
                          handleDeckCardDoubleClick(card.deckInstanceId, "mainDeck")
                        }
                      />
                    ))}
                  </div>
                )}
              </DeckDropZone>
            </div>
          </div>
        </TabsContent>

        <TabsContent value="extra" className="pt-4 px-6 pb-6">
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-semibold text-white">
                Extra Deck ({stats.extraCount}/15)
              </h3>
              <div className="text-sm text-muted-50">Max: 15 cards</div>
            </div>

            <Progress value={(stats.extraCount / 15) * 100} className="h-2" />

            <div
              id="extra-deck"
              className="w-full bg-cyb-900/60 hover:bg-[rgba(20,239,255,0.08)] hover:outline hover:outline-[1px] hover:outline-[rgba(20,239,255,0.35)] hover:shadow-[0_0_12px_rgba(20,239,255,0.20)]"
            >
              <DeckDropZone
                id="extra-deck"
                isEmpty={currentDeck.extraDeck.length === 0}
              >
                {currentDeck.extraDeck.length === 0 ? (
                  <div className="flex flex-col items-center text-muted-50 py-8">
                    <AlertCircle className="h-8 w-8 mb-2 text-accent-cyan" />
                    <span className="text-sm font-medium text-muted-50">
                      Drag and drop cards here to build your Extra Deck
                    </span>
                  </div>
                ) : (
                  <div
                    className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-2"
                    style={{ minHeight: "140px" }}
                  >
                    {currentDeck.extraDeck.map((card) => (
                      <DraggableCard
                        id={card.deckInstanceId}
                        key={card.deckInstanceId}
                        card={card}
                        onRemove={() =>
                          removeCardFromDeck(card.deckInstanceId, "extraDeck")
                        }
                        onDoubleClick={() =>
                          handleDeckCardDoubleClick(card.deckInstanceId, "extraDeck")
                        }
                      />
                    ))}
                  </div>
                )}
              </DeckDropZone>
            </div>
          </div>
        </TabsContent>

        <TabsContent value="side" className="pt-4 px-6 pb-6">
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-semibold text-white">
                Side Deck ({stats.sideCount}/15)
              </h3>
              <div className="text-sm text-muted-50">Max: 15 cards</div>
            </div>

            <Progress value={(stats.sideCount / 15) * 100} className="h-2" />

            <div
              id="side-deck"
              className="w-full h-full min-h-[300px] rounded-lg bg-cyb-900/60 transition-transform duration-150 hover:scale-[1.01]"
            >
              <DeckDropZone
                id="side-deck"
                isEmpty={currentDeck.sideDeck.length === 0}
              >
                {currentDeck.sideDeck.length === 0 ? (
                  <div className="flex flex-col items-center text-muted-50 py-8">
                    <AlertCircle className="h-8 w-8 mb-2 text-accent-cyan" />
                    <span className="text-sm font-medium text-muted-50">
                      Drag and drop cards here to build your Side Deck
                    </span>
                  </div>
                ) : (
                  <div
                    className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-2"
                    style={{ minHeight: "140px" }}
                  >
                    {currentDeck.sideDeck.map((card) => (
                      <DraggableCard
                        id={card.deckInstanceId}
                        key={card.deckInstanceId}
                        card={card}
                        onRemove={() =>
                          removeCardFromDeck(card.deckInstanceId, "sideDeck")
                        }
                        onDoubleClick={() =>
                          handleDeckCardDoubleClick(card.deckInstanceId, "sideDeck")
                        }
                      />
                    ))}
                  </div>
                )}
              </DeckDropZone>
            </div>
          </div>
        </TabsContent>
      </Tabs>
    </CardContent>
  );
}

