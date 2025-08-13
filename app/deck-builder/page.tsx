"use client";

import type React from "react";

import {
  useState,
  useEffect,
  useCallback,
  useLayoutEffect,
  useRef,
  useMemo,
} from "react";
import { useDeck } from "@/context/deck-context";
import {
  DndContext,
  type DragEndEvent,
  type DragStartEvent,
  useSensor,
  useSensors,
  PointerSensor,
  DragOverlay,
  UniqueIdentifier,
} from "@dnd-kit/core";
import { Button } from "@/components/ui/button";
import {
  Card as CardUI,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Virtuoso } from "react-virtuoso";
import {
  AlertCircle,
  Download,
  Trash2,
  Upload,
  Lightbulb,
  MessageSquare,
  Trophy,
  Tag,
  Shuffle,
  BarChart,
  Sliders,
  ZapOff,
  ShieldOff,
  Sparkles,
  Sword,
  Layers,
  Edit,
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { Progress } from "@/components/ui/progress";
import { CardStack } from "@/components/ui/card-stack";
import AIChatbot from "@/components/ai-chatbot";
import { Card } from "@/types/card";
import Image from "next/image";
import {
  DECK_MODES,
  FLOODGATE_CARDS,
  MODE_COLORS,
  POWERFUL_ARCHETYPE_CARDS,
  ROGUE_ARCHETYPE_CARDS,
} from "@/lib/constants";
import { DeckDropZone } from "@/components/ui/deck-drop-zone";
import { DraggableCard } from "@/components/ui/draggable-card";
import { filterCards, openLoginModal } from "@/lib/helpers";
import { BanStatus, DeckMode } from "@/types/types";
import { InputWithClear } from "@/components/ui/input-with-clear";
import { FilterMenu } from "@/components/ui/filter-menu";
import { useCardStore } from "@/store/cardStore";
import { useUserStore } from "@/store/useUserStore";
import { Skeleton } from "@/components/ui/skeleton";
import { getTCGBanlist } from "@/lib/api";
import { useModeStore } from "@/store/modeStore";

export default function DeckBuilder() {
  const {
    currentDeck,
    removeCardFromDeck,
    clearDeck,
    exportDeck,
    importDeck,
    renameDeck,
    getDeckStats,
    getSynergyTips,
    addCardToDeck,
    updateDeckMode,
  } = useDeck();

  // State -----------------------------------------------
  const [isRenameOpen, setIsRenameOpen] = useState(false);
  const [deckName, setDeckName] = useState(currentDeck.name || "");
  const [importText, setImportText] = useState("");
  const [activeTab, setActiveTab] = useState("main");
  const [searchQuery, setSearchQuery] = useState("");
  const [filteredCards, setFilteredCards] = useState<Card[]>([]);
  const [activeDragCard, setActiveDragCard] = useState<Card | null>(null);
  const [isChatOpen, setIsChatOpen] = useState(false);
  const [deckTier, setDeckTier] = useState<number | null>(null);
  const [deckPlayStyle, setDeckPlayStyle] = useState<string[]>([]);
  const [banlist, setBanlist] = useState<Record<string, BanStatus>>({});
  const [activeDragId, setActiveDragId] = useState<UniqueIdentifier | null>(
    null
  );
  const [searchParams, setSearchParams] = useState({
    name: "",
    type: "",
    race: "",
    attribute: "",
    level: "",
    atk: "",
    def: "",
    archetype: "",
    effect: "",
    sort: "name",
    sortDirection: "asc" as "asc" | "desc",
    misc: "",
    atkRange: "",
    defRange: "",
    rarity: "",
  });

  // Zustand Store -----------------------------------------
  const cardList = useCardStore((state) => state.cardList);
  const loading = useCardStore((state) => state.loading);
  const setLoading = useCardStore((state) => state.setLoading);
  const user = useUserStore((state) => state.user);
  const deckMode = useModeStore((state) => state.deckMode);
  const setDeckMode = useModeStore((state) => state.setDeckMode);

  const playstyleIcons: Record<string, React.ElementType> = {
    combo: Shuffle,
    midrange: BarChart,
    control: Sliders,
    stun: ZapOff,
    floodgate: ShieldOff,
    competitive: Trophy,
    "rogue - gimmicky": Sparkles,
    beatdown: Sword,
    swarm: Layers,
  };

  const getPlaystyleIcon = (style: string): React.ElementType => {
    // Normalize style string to match keys
    const key = style.toLowerCase();
    return playstyleIcons[key] || Tag; // fallback to Tag if not found
  };

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 3, // Reduced distance for easier drag activation
      },
    })
  );

  useEffect(() => {
    if (isRenameOpen) {
      setDeckName(currentDeck.name || "");
    }
  }, [isRenameOpen, currentDeck.name]);

  useEffect(() => {
    // Sync deck mode with current deck's mode when deck changes
    if (currentDeck.mode && currentDeck.mode !== deckMode) {
      setDeckMode(currentDeck.mode as DeckMode);
    }
  }, [currentDeck.mode, deckMode, setDeckMode]);

  useEffect(() => {
    let filtered = cardList;
    if (searchQuery.trim() !== "") {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(
        (card) =>
          card.name.toLowerCase().includes(query) ||
          card.desc.toLowerCase().includes(query) ||
          (card.archetype && card.archetype.toLowerCase().includes(query))
      );
    }
    filtered = filterCards(filtered, searchParams);
    setFilteredCards(filtered);
  }, [searchQuery, cardList, searchParams]);

  useEffect(() => {
    const loadBanlist = async () => {
      try {
        if (deckMode === "TCG") {
          // Load TCG banlist from Supabase
          const tcgBanlist = await getTCGBanlist();
          setBanlist(tcgBanlist);
        } else {
          // Load Master Duel banlist from JSON file
          const response = await fetch("/data/master-duel-banlist.json");
          if (!response.ok)
            throw new Error("Failed to load Master Duel banlist");
          const masterDuelBanlist = await response.json();
          setBanlist(masterDuelBanlist);
        }
      } catch (err) {
        console.error("Error loading banlist:", err);
        setBanlist({}); // fallback to empty banlist if needed
      }
    };

    loadBanlist();
  }, [deckMode]);

  const tcgRef = useRef<HTMLButtonElement>(null);
  const masterDuelRef = useRef<HTMLButtonElement>(null);
  const btnRefs = useMemo(
    () => ({
      TCG: tcgRef,
      "Master Duel": masterDuelRef,
    }),
    []
  );
  const containerRef = useRef<HTMLDivElement>(null);
  const [sliderStyle, setSliderStyle] = useState<React.CSSProperties>({});

  useLayoutEffect(() => {
    if (containerRef.current && btnRefs[deckMode].current) {
      const containerRect = containerRef.current.getBoundingClientRect();
      const btnRect = btnRefs[deckMode].current.getBoundingClientRect();
      setSliderStyle({
        left: btnRect.left - containerRect.left,
        width: btnRect.width,
      });
    }
  }, [deckMode, btnRefs]);

  const analyzeDeck = useCallback(() => {
    const stats = getDeckStats();
    const playStyles: string[] = [];

    // Archetype detection (for combo, rogue/gimmicky)
    const archetypes = new Map<string, number>();
    currentDeck.mainDeck.forEach((card) => {
      if (card.archetype) {
        archetypes.set(
          card.archetype,
          (archetypes.get(card.archetype) || 0) + 1
        );
      }
    });

    // Check for combo style: high archetype count or specific combo cards
    for (const [, count] of Array.from(archetypes.entries())) {
      if (count >= 8) {
        playStyles.push("Combo");
        break;
      }
    }

    // Check for midrange: balanced monster/spell/trap ratio
    if (
      stats.monsterCount / stats.mainCount > 0.4 &&
      stats.monsterCount / stats.mainCount < 0.6 &&
      stats.spellCount / stats.mainCount > 0.2 &&
      stats.trapCount / stats.mainCount > 0.05
    ) {
      playStyles.push("Midrange");
    }

    // Check for control: high trap count
    if (stats.trapCount > 10 && stats.trapCount / stats.mainCount > 0.2) {
      playStyles.push("Control");
    }

    // Check for stun: similar to control, but with floodgate cards
    // This is a simplified check; you could also scan for floodgate card names
    const floodgateCards = currentDeck.mainDeck.filter((card) =>
      FLOODGATE_CARDS.includes(card.name)
    );
    if (floodgateCards.length >= 3) {
      playStyles.push("Stun");
      playStyles.push("Floodgate");
    }

    // Check for beatdown: high ATK monsters
    // This is a simplified check; ideally, you'd check for monsters with ATK above a threshold
    const highAtkMonsters = currentDeck.mainDeck.filter(
      (card) => card.type === "monster" && card.atk && Number(card.atk) >= 2500
    );
    if (highAtkMonsters.length >= 6) {
      playStyles.push("Beatdown");
    }

    // Check for swarm: many monsters that summon themselves or others
    // This is a simplified check; ideally, you'd check for effects that summon multiple monsters
    if (stats.monsterCount > 25 && stats.monsterCount / stats.mainCount > 0.6) {
      playStyles.push("Swarm");
    }

    // Rogue/gimmicky: decks with unusual archetypes or win conditions
    // This is a simplified check; you could define a list of rogue/gimmicky archetypes
    if (
      Array.from(archetypes.keys()).some((archetype) =>
        ROGUE_ARCHETYPE_CARDS.includes(archetype)
      )
    ) {
      playStyles.push("Rogue - Gimmicky");
    }

    // If no specific style is detected, mark as "Balanced"
    if (playStyles.length === 0 && stats.mainCount > 30) {
      playStyles.push("Balanced");
    }

    // Add "Incomplete" tag if deck is too small
    if (stats.mainCount < 40) {
      playStyles.push("Incomplete");
    }

    setDeckPlayStyle(playStyles);

    // Determine tier (competitive is not a playstyle but a tier/strength)
    let tier: number | null = null;

    if (stats.mainCount < 30) {
      tier = null; // Not enough cards to determine tier
    } else {
      // Check for powerful archetypes (simplified example)
      const hasPowerfulArchetype = Array.from(archetypes.keys()).some(
        (archetype) => POWERFUL_ARCHETYPE_CARDS.includes(archetype)
      );

      // Check for balanced composition
      const hasBalancedComposition =
        stats.monsterCount >= 16 &&
        stats.spellCount >= 10 &&
        stats.trapCount >= 5;

      // Check for synergy (simplified)
      const tips = getSynergyTips();
      const hasSynergy = tips.length < 3; // Fewer tips means better synergy

      if (hasPowerfulArchetype && hasBalancedComposition && hasSynergy) {
        tier = 1; // Top tier
      } else if (
        (hasPowerfulArchetype || hasBalancedComposition) &&
        hasSynergy
      ) {
        tier = 2; // Competitive
      } else if (hasPowerfulArchetype || hasBalancedComposition || hasSynergy) {
        tier = 3; // Playable
      } else {
        tier = 4; // Casual
      }
    }

    setDeckTier(tier);
  }, [currentDeck.mainDeck, getDeckStats, getSynergyTips]);

  useEffect(() => {
    // Analyze deck and set tier and play style
    analyzeDeck();
  }, [currentDeck, analyzeDeck]);

  const handleSearch = () => {
    setLoading(true);
    try {
      // Optionally, filter by searchQuery first
      let filtered = cardList;
      if (searchQuery.trim() !== "") {
        const query = searchQuery.toLowerCase();
        filtered = filtered.filter(
          (card) =>
            card.name.toLowerCase().includes(query) ||
            card.desc.toLowerCase().includes(query) ||
            (card.archetype && card.archetype.toLowerCase().includes(query))
        );
      }
      filtered = filterCards(filtered, searchParams);
      setFilteredCards(filtered);
    } catch (error) {
      console.error("Error filtering cards:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    // Only fetch when actual search params change (not on every keystroke in searchQuery)
    handleSearch();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams]);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setSearchParams((prev) => ({ ...prev, [name]: value }));
  };

  const handleSelectChange = (name: string, value: string) => {
    setSearchParams((prev) => ({ ...prev, [name]: value }));
  };

  const handleExportDeck = () => {
    const jsonData = exportDeck();
    const blob = new Blob([jsonData], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${deckName || "yugioh-deck"}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const handleImportDeck = () => {
    try {
      importDeck(importText);
      setImportText("");
    } catch (error) {
      console.error("Failed to import deck:", error);
    }
  };

  const handleDragStart = (event: DragStartEvent) => {
    const { active } = event;
    setActiveDragId(active.id);

    const dragType = active.data?.current?.type;
    if (dragType === "browser") {
      const cardId = active.data?.current?.cardId;
      const browserCard = cardId
        ? filteredCards.find((c) => c.id === cardId)
        : null;
      setActiveDragCard(browserCard || null);
    } else if (dragType === "deck") {
      const deckInstanceId = active.data?.current?.deckInstanceId;
      const deckCard =
        currentDeck.mainDeck.find((c) => c.deckInstanceId === deckInstanceId) ||
        currentDeck.extraDeck.find(
          (c) => c.deckInstanceId === deckInstanceId
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

    // Helper function to determine which deck section a target belongs to
    const getDeckSectionFromTarget = (
      targetId: string
    ): "mainDeck" | "extraDeck" | "sideDeck" | null => {
      // Direct drop zone targets
      if (targetId === "main-deck") return "mainDeck";
      if (targetId === "extra-deck") return "extraDeck";
      if (targetId === "side-deck") return "sideDeck";

      // Check if dropping on an existing card in a deck section
      const sections: ("mainDeck" | "extraDeck" | "sideDeck")[] = [
        "mainDeck",
        "extraDeck",
        "sideDeck",
      ];
      for (const section of sections) {
        const found = currentDeck[section].find(
          (c) => c.deckInstanceId === targetId
        );
        if (found) return section;
      }

      return null;
    };

    // Browser -> Deck
    if (dragType === "browser") {
      const cardId = active.data?.current?.cardId;
      const browserCard = cardId
        ? filteredCards.find((c) => c.id === cardId)
        : null;
      if (!browserCard) return;

      const targetSection = getDeckSectionFromTarget(targetId);

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
          (c) => c.deckInstanceId === deckInstanceId
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

      const targetSection = getDeckSectionFromTarget(targetId);

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

  const isExtraDeckCard = (card: Card) => {
    return (
      card.type.includes("Fusion Monster") ||
      card.type.includes("Synchro Monster") ||
      card.type.includes("XYZ Monster") ||
      card.type.includes("Link Monster")
    );
  };

  // Double-click handlers
  const handleCardDoubleClick = (card: Card) => {
    if (getRemainingCopies(card) === 0) return; // Can't add if no copies remaining

    if (isExtraDeckCard(card)) {
      addCardToDeck(card, "extraDeck");
    } else {
      addCardToDeck(card, "mainDeck");
    }
  };

  const handleDeckCardDoubleClick = (
    deckInstanceId: string,
    section: "mainDeck" | "extraDeck" | "sideDeck"
  ) => {
    removeCardFromDeck(deckInstanceId, section);
  };

  const getRemainingCopies = (card: Card) => {
    const banStatus = banlist[card.name] || "Unlimited";
    let maxCopies = 3;
    if (banStatus === "Limited") maxCopies = 1;
    if (banStatus === "Semi-Limited") maxCopies = 2;
    if (banStatus === "Forbidden") maxCopies = 0;

    // Count current copies in all deck sections
    const currentCopies = [
      ...currentDeck.mainDeck,
      ...currentDeck.extraDeck,
      ...currentDeck.sideDeck,
    ].filter((c) => c.id === card.id).length;

    return Math.max(0, maxCopies - currentCopies);
  };

  const renderTierBadge = () => {
    if (deckTier === null) return null;

    let color = "";
    let label = "";

    switch (deckTier) {
      case 1:
        color = "bg-red-500 hover:bg-red-600";
        label = "Tier 1 - Meta";
        break;
      case 2:
        color = "bg-orange-500 hover:bg-orange-600";
        label = "Tier 2 - Competitive";
        break;
      case 3:
        color = "bg-yellow-500 hover:bg-yellow-600";
        label = "Tier 3 - Rogue";
        break;
      default:
        color = "bg-gray-500 hover:bg-gray-600";
        label = "Tier 4 - Casual";
    }

    return (
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <Badge className={`${color} cursor-help`}>
              <Trophy className="h-3 w-3 mr-1" />
              {`Tier ${deckTier}`}
            </Badge>
          </TooltipTrigger>
          <TooltipContent>
            <p>{label}</p>
            <p className="text-xs mt-1">Estimated competitive viability</p>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    );
  };

  const stats = getDeckStats();
  const tips = getSynergyTips();

  return (
    <DndContext
      sensors={sensors}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
    >
      <div className="container mx-auto px-4 py-8">
        <div className="flex flex-col space-y-6">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <h1 className="text-3xl font-bold">Deck Builder</h1>
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
                {renderTierBadge()}
              </div>
            </div>

            <div className="flex flex-wrap gap-2">
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
                AI Assistant
              </Button>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-[1fr_1fr] gap-6">
            {/* Left side - Deck Building Area */}
            <div className="space-y-6">
              <CardUI>
                <CardHeader className="pb-2">
                  <div className="flex items-center justify-between w-full">
                    <div className="flex items-center gap-2">
                      <span className="text-xl font-bold">
                        {currentDeck.name || "New Deck"}
                      </span>
                      <Dialog
                        open={isRenameOpen}
                        onOpenChange={setIsRenameOpen}
                      >
                        {!user ? (
                          <Button
                            size="icon"
                            variant="ghost"
                            aria-label="Rename deck"
                            onClick={openLoginModal}
                          >
                            <Edit className="h-5 w-5" />
                          </Button>
                        ) : (
                          <DialogTrigger asChild>
                            <Button
                              size="icon"
                              variant="ghost"
                              aria-label="Rename deck"
                            >
                              <Edit className="h-5 w-5" />
                            </Button>
                          </DialogTrigger>
                        )}
                        <DialogContent>
                          <DialogHeader>
                            <DialogTitle>Rename Deck</DialogTitle>
                            <DialogDescription>
                              Enter a new name for your deck.
                            </DialogDescription>
                          </DialogHeader>
                          <InputWithClear
                            value={deckName}
                            onChange={(e) => setDeckName(e.target.value)}
                            placeholder="Deck name"
                            maxLength={40}
                            autoFocus
                          />
                          <DialogFooter>
                            <Button
                              onClick={() => {
                                // Only save if changed and not empty
                                if (
                                  deckName.trim() &&
                                  deckName.trim() !== currentDeck.name
                                ) {
                                  renameDeck(deckName.trim());
                                }
                                setIsRenameOpen(false);
                              }}
                            >
                              Save
                            </Button>
                          </DialogFooter>
                        </DialogContent>
                      </Dialog>
                      <div className="flex items-center gap-2">
                        <div
                          className="relative flex w-fit rounded-full bg-zinc-100 shadow-inner"
                          ref={containerRef}
                        >
                          {/* Animated background: matches active button */}
                          <span
                            className={`absolute top-0 bottom-0 rounded-full transition-all duration-200 ${MODE_COLORS[deckMode]}`}
                            style={{
                              ...sliderStyle,
                              zIndex: 0,
                            }}
                          />
                          {DECK_MODES.map((mode) => (
                            <button
                              key={mode}
                              ref={btnRefs[mode]}
                              type="button"
                              onClick={() => {
                                setDeckMode(mode);
                                updateDeckMode(mode);
                              }}
                              className={`relative z-10 px-4 py-1 font-semibold rounded-full transition-colors duration-200 focus:outline-none
            ${deckMode === mode ? "text-white" : "text-gray-700"}
          `}
                              aria-pressed={deckMode === mode}
                              style={{
                                background: "transparent",
                                position: "relative",
                              }}
                            >
                              {mode}
                            </button>
                          ))}
                        </div>
                      </div>
                    </div>

                    <TooltipProvider>
                      <div className="flex gap-1">
                        {/* Export Button */}
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => {
                                if (!user) {
                                  openLoginModal();
                                } else {
                                  handleExportDeck();
                                }
                              }}
                            >
                              <Download className="h-4 w-4" />
                            </Button>
                          </TooltipTrigger>
                          <TooltipContent>
                            <p>Export Deck</p>
                          </TooltipContent>
                        </Tooltip>

                        {/* Import Button */}
                        {!user ? (
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={openLoginModal}
                              >
                                <Upload className="h-4 w-4" />
                              </Button>
                            </TooltipTrigger>
                            <TooltipContent>
                              <p>Import Deck</p>
                            </TooltipContent>
                          </Tooltip>
                        ) : (
                          <Dialog>
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <DialogTrigger asChild>
                                  <Button variant="ghost" size="icon">
                                    <Upload className="h-4 w-4" />
                                  </Button>
                                </DialogTrigger>
                              </TooltipTrigger>
                              <TooltipContent>
                                <p>Import Deck</p>
                              </TooltipContent>
                            </Tooltip>
                            <DialogContent>
                              <DialogHeader>
                                <DialogTitle>Import Deck</DialogTitle>
                                <DialogDescription>
                                  Paste the JSON data of a previously exported
                                  deck.
                                </DialogDescription>
                              </DialogHeader>
                              <div className="py-4">
                                <textarea
                                  className="w-full h-32 p-2 border rounded-md"
                                  placeholder="Paste JSON data here..."
                                  value={importText}
                                  onChange={(e) =>
                                    setImportText(e.target.value)
                                  }
                                />
                              </div>
                              <DialogFooter>
                                <Button
                                  onClick={handleImportDeck}
                                  disabled={!importText.trim()}
                                >
                                  Import
                                </Button>
                              </DialogFooter>
                            </DialogContent>
                          </Dialog>
                        )}

                        {/* Clear Button */}
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => {
                                if (!user) {
                                  openLoginModal();
                                } else {
                                  clearDeck();
                                }
                              }}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </TooltipTrigger>
                          <TooltipContent>
                            <p>Clear Deck</p>
                          </TooltipContent>
                        </Tooltip>
                      </div>
                    </TooltipProvider>
                  </div>
                  <CardDescription>
                    Drag cards from the right panel to add them to your deck, or
                    drag cards back to the browser to remove them
                  </CardDescription>
                </CardHeader>
                <CardContent className="p-0">
                  <Tabs
                    defaultValue="main"
                    onValueChange={setActiveTab}
                    value={activeTab}
                  >
                    <div className="px-6">
                      <TabsList
                        className={`grid w-full ${
                          deckMode === "Master Duel"
                            ? "grid-cols-2"
                            : "grid-cols-3"
                        }`}
                      >
                        <TabsTrigger value="main">
                          Main Deck ({stats.mainCount})
                        </TabsTrigger>
                        <TabsTrigger value="extra">
                          Extra Deck ({stats.extraCount})
                        </TabsTrigger>
                        {deckMode === "TCG" && (
                          <TabsTrigger value="side">
                            Side Deck ({stats.sideCount})
                          </TabsTrigger>
                        )}
                      </TabsList>
                    </div>

                    <TabsContent value="main" className="pt-4 px-6 pb-6">
                      <div className="space-y-4">
                        <div className="flex items-center justify-between">
                          <h3 className="text-lg font-medium">
                            Main Deck ({stats.mainCount}/60)
                          </h3>
                          <div className="text-sm text-muted-foreground">
                            Min: 40 cards
                          </div>
                        </div>

                        <Progress
                          value={(stats.mainCount / 40) * 100}
                          className="h-2"
                        />

                        <div
                          id="main-deck"
                          className={`
                            w-full
                            border-2 border-dashed
                            rounded-lg
                            p-4
                          `}
                        >
                          <DeckDropZone
                            id="main-deck"
                            isEmpty={currentDeck.mainDeck.length === 0}
                          >
                            {currentDeck.mainDeck.length === 0 ? (
                              <div className="flex flex-col items-center text-muted-foreground py-8">
                                <AlertCircle className="h-8 w-8 mb-2" />
                                <span className="text-sm font-medium">
                                  Drag and drop cards here to build your Main
                                  Deck
                                </span>
                              </div>
                            ) : (
                              <div
                                className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-2"
                                style={{
                                  minHeight: "140px",
                                }}
                              >
                                {currentDeck.mainDeck.map((card) => (
                                  <DraggableCard
                                    id={card.deckInstanceId}
                                    key={card.deckInstanceId}
                                    card={card}
                                    onRemove={() =>
                                      removeCardFromDeck(
                                        card.deckInstanceId,
                                        "mainDeck"
                                      )
                                    }
                                    onDoubleClick={() =>
                                      handleDeckCardDoubleClick(
                                        card.deckInstanceId,
                                        "mainDeck"
                                      )
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
                          <h3 className="text-lg font-medium">
                            Extra Deck ({stats.extraCount}/15)
                          </h3>
                          <div className="text-sm text-muted-foreground">
                            Max: 15 cards
                          </div>
                        </div>

                        <Progress
                          value={(stats.extraCount / 15) * 100}
                          className="h-2"
                        />

                        <div
                          id="extra-deck"
                          className={`
                            w-full
                            border-2 border-dashed
                            rounded-lg
                            p-4
                          `}
                        >
                          <DeckDropZone
                            id="extra-deck"
                            isEmpty={currentDeck.extraDeck.length === 0}
                          >
                            {currentDeck.extraDeck.length === 0 ? (
                              <div className="flex flex-col items-center text-muted-foreground py-8">
                                <AlertCircle className="h-8 w-8 mb-2" />
                                <span className="text-sm font-medium">
                                  Drag and drop cards here to build your Extra
                                  Deck
                                </span>
                              </div>
                            ) : (
                              <div
                                className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-2"
                                style={{
                                  minHeight: "140px",
                                }}
                              >
                                {currentDeck.extraDeck.map((card) => (
                                  <DraggableCard
                                    id={card.deckInstanceId}
                                    key={card.deckInstanceId}
                                    card={card}
                                    onRemove={() =>
                                      removeCardFromDeck(
                                        card.deckInstanceId,
                                        "extraDeck"
                                      )
                                    }
                                    onDoubleClick={() =>
                                      handleDeckCardDoubleClick(
                                        card.deckInstanceId,
                                        "extraDeck"
                                      )
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
                          <h3 className="text-lg font-medium">
                            Side Deck ({stats.sideCount}/15)
                          </h3>
                          <div className="text-sm text-muted-foreground">
                            Max: 15 cards
                          </div>
                        </div>

                        <Progress
                          value={(stats.sideCount / 15) * 100}
                          className="h-2"
                        />

                        <div
                          id="side-deck"
                          className={`
                            w-full
                            h-full
                            min-h-[300px]
                            border-2
                            border-dashed
                            rounded-lg
                            p-4
                          `}
                        >
                          <DeckDropZone
                            id="side-deck"
                            isEmpty={currentDeck.sideDeck.length === 0}
                          >
                            {currentDeck.sideDeck.length === 0 ? (
                              <div className="flex flex-col items-center text-muted-foreground py-8">
                                <AlertCircle className="h-8 w-8 mb-2" />
                                <span className="text-sm font-medium">
                                  Drag and drop cards here to build your Side
                                  Deck
                                </span>
                              </div>
                            ) : (
                              <div
                                className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-2"
                                style={{
                                  minHeight: "140px",
                                }}
                              >
                                {currentDeck.sideDeck.map((card) => (
                                  <DraggableCard
                                    id={card.deckInstanceId}
                                    key={card.deckInstanceId}
                                    card={card}
                                    onRemove={() =>
                                      removeCardFromDeck(
                                        card.deckInstanceId,
                                        "sideDeck"
                                      )
                                    }
                                    onDoubleClick={() =>
                                      handleDeckCardDoubleClick(
                                        card.deckInstanceId,
                                        "sideDeck"
                                      )
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
              </CardUI>

              {tips.length > 0 && (
                <CardUI>
                  <CardHeader>
                    <CardTitle className="flex items-center">
                      <Lightbulb className="h-5 w-5 mr-2 text-yellow-500" />
                      Synergy Tips
                    </CardTitle>
                    <CardDescription>
                      Suggestions to improve your deck
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-2">
                      {tips.map((tip, index) => (
                        <Alert key={index}>
                          <AlertCircle className="h-4 w-4" />
                          <AlertTitle>Tip {index + 1}</AlertTitle>
                          <AlertDescription>{tip}</AlertDescription>
                        </Alert>
                      ))}
                    </div>
                  </CardContent>
                </CardUI>
              )}
            </div>

            {/* Right side - Card Browser */}
            <div className="space-y-4">
              <CardUI>
                <CardHeader className="pb-2">
                  <CardTitle>Card Browser</CardTitle>
                  <CardDescription>
                    Search, filter, and drag cards to add to your deck
                  </CardDescription>
                </CardHeader>
                <CardContent className="p-0">
                  <div className="p-6 pb-0 space-y-4">
                    <div className="flex gap-2">
                      <div className="flex-1">
                        <InputWithClear
                          placeholder="Search cards..."
                          value={searchQuery}
                          onChange={(e) => setSearchQuery(e.target.value)}
                          onClear={() => setSearchQuery("")}
                          className="w-full"
                        />
                      </div>
                      <FilterMenu
                        searchParams={searchParams}
                        setSearchParams={setSearchParams}
                        setSearchQuery={setSearchQuery}
                        handleSelectChange={handleSelectChange}
                        handleInputChange={handleInputChange}
                      />
                    </div>

                    <div className="flex items-center justify-between">
                      {loading ? (
                        <div className="flex items-center gap-2">
                          <Skeleton className="h-4 w-20" />
                          <Skeleton className="h-4 w-12" />
                        </div>
                      ) : (
                        <p className="text-sm text-muted-foreground">
                          Found {filteredCards.length} cards
                        </p>
                      )}
                      <div className="flex items-center gap-2">
                        <Select
                          value={searchParams.sort}
                          onValueChange={(value: string) =>
                            handleSelectChange("sort", value)
                          }
                        >
                          <SelectTrigger className="w-[120px]">
                            <SelectValue placeholder="Sort by" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="name">Name</SelectItem>
                            <SelectItem value="atk">ATK</SelectItem>
                            <SelectItem value="def">DEF</SelectItem>
                            <SelectItem value="level">Level</SelectItem>
                          </SelectContent>
                        </Select>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() =>
                            setSearchParams((prev) => ({
                              ...prev,
                              sortDirection:
                                prev.sortDirection === "asc" ? "desc" : "asc",
                            }))
                          }
                        >
                          {searchParams.sortDirection === "asc" ? "↑" : "↓"}
                        </Button>
                      </div>
                    </div>
                  </div>

                  <div className="h-[500px] border-t">
                    <DeckDropZone id="card-browser" isEmpty={false}>
                      {loading ? (
                        <div className="flex flex-col items-center justify-center h-full">
                          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mb-4"></div>
                          <p className="text-muted-foreground">
                            Loading cards...
                          </p>
                        </div>
                      ) : filteredCards.length === 0 ? (
                        <div className="flex flex-col items-center justify-center h-full">
                          <p className="text-muted-foreground">
                            No cards found
                          </p>
                          <p className="text-sm text-muted-foreground">
                            Try adjusting your search filters
                          </p>
                        </div>
                      ) : filteredCards.length > 100 ? (
                        <Virtuoso
                          style={{ height: "100%" }}
                          totalCount={filteredCards.length}
                          itemContent={(index) => {
                            const card = filteredCards[index];
                            const banStatus = banlist[card.name] || "Unlimited";
                            let maxCopies = 3;
                            if (banStatus === "Limited") maxCopies = 1;
                            if (banStatus === "Semi-Limited") maxCopies = 2;
                            if (banStatus === "Forbidden") maxCopies = 0;

                            return (
                              <CardStack
                                key={card.id}
                                card={card}
                                remainingCopies={getRemainingCopies(card)}
                                maxCopies={maxCopies}
                                banStatus={banStatus}
                                isBeingDragged={
                                  activeDragId === `browser-${card.id}`
                                }
                                onDoubleClick={() =>
                                  handleCardDoubleClick(card)
                                }
                              />
                            );
                          }}
                        />
                      ) : (
                        <div className="overflow-y-auto h-full">
                          {filteredCards.map((card) => {
                            const banStatus = banlist[card.name] || "Unlimited";
                            let maxCopies = 3;
                            if (banStatus === "Limited") maxCopies = 1;
                            if (banStatus === "Semi-Limited") maxCopies = 2;
                            if (banStatus === "Forbidden") maxCopies = 0;

                            return (
                              <CardStack
                                key={card.id}
                                card={card}
                                remainingCopies={getRemainingCopies(card)}
                                maxCopies={maxCopies}
                                banStatus={banStatus}
                                isBeingDragged={
                                  activeDragId === `browser-${card.id}`
                                }
                                onDoubleClick={() =>
                                  handleCardDoubleClick(card)
                                }
                              />
                            );
                          })}
                        </div>
                      )}
                    </DeckDropZone>
                  </div>
                </CardContent>
              </CardUI>
            </div>
          </div>
        </div>
      </div>

      <TooltipProvider>
        <DragOverlay>
          {activeDragCard && (
            <div className="w-[100px] h-[146px] opacity-80">
              <Image
                width={80}
                height={120}
                src={
                  activeDragCard.card_images[0].image_url_small ||
                  "/placeholder.svg"
                }
                alt={activeDragCard.name}
                className="w-full h-full object-contain rounded-lg"
              />
            </div>
          )}
        </DragOverlay>
      </TooltipProvider>

      <AIChatbot isOpen={isChatOpen} onClose={() => setIsChatOpen(false)} />
    </DndContext>
  );
}
