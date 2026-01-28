"use client";

import { useState, useEffect, useLayoutEffect, useRef, useMemo } from "react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardFooter,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { DECK_MODES } from "@/lib/constants";
import { DeckType } from "@/types/types";
import {
  Loader2,
  Zap,
  Info,
  Target,
  Dices,
  Brain,
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { getUserDecks, getMetaDecks } from "@/lib/supabaseDecks";
import { formatDeck } from "@/app/deck-tester/utils";
import { useUserStore } from "@/store/useUserStore";
import { useModeStore } from "@/store/modeStore";
import { useDeck } from "@/context/deck-context";

type TestType = "matchup_analysis" | "duel_simulation" | "strategic_insights";

interface TestSetupPanelProps {
  onRunTest: (config: {
    selectedDeckId: string;
    opponentDeckId: string;
    testType: TestType;
    numSimulations: number;
    context: string;
  }) => void;
  simulationLoading: boolean;
}

export function TestSetupPanel({
  onRunTest,
  simulationLoading,
}: TestSetupPanelProps) {
  // Internal state
  const [decks, setDecks] = useState<DeckType[]>([]);
  const [opponentDecks, setOpponentDecks] = useState<DeckType[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedDeckId, setSelectedDeckId] = useState<string | null>(null);
  const [opponentDeckId, setOpponentDeckId] = useState<string | null>(null);
  const [numSimulations, setNumSimulations] = useState(10);
  const [testType, setTestType] = useState<TestType>("matchup_analysis");
  const [context, setContext] = useState("");
  const [infoModalOpen, setInfoModalOpen] = useState(false);

  // Zustand stores
  const user = useUserStore((state) => state.user);
  const deckMode = useModeStore((state) => state.deckMode);
  const setDeckMode = useModeStore((state) => state.setDeckMode);
  const { updateDeckMode } = useDeck();

  // Refs for mode selector slider
  const tcgRef = useRef<HTMLButtonElement>(null);
  const masterDuelRef = useRef<HTMLButtonElement>(null);
  const btnRefs = useMemo(
    () => ({ TCG: tcgRef, "Master Duel": masterDuelRef }),
    [],
  );
  const containerRef = useRef<HTMLDivElement>(null);
  const [sliderStyle, setSliderStyle] = useState<React.CSSProperties>({});

  // Calculate mode selector slider position
  useLayoutEffect(() => {
    if (containerRef.current && btnRefs[deckMode]?.current) {
      const containerRect = containerRef.current.getBoundingClientRect();
      const btnRect = btnRefs[deckMode].current.getBoundingClientRect();
      setSliderStyle({
        left: btnRect.left - containerRect.left,
        width: btnRect.width,
      });
    }
  }, [deckMode, btnRefs]);

  // Fetch decks on mount / mode change
  useEffect(() => {
    if (!user) return;
    setLoading(true);

    const fetchAll = async () => {
      try {
        const [userDecks, metaDecks] = await Promise.all([
          getUserDecks(user.id),
          getMetaDecks(),
        ]);
        setDecks(
          userDecks
            .filter((d) => {
              const mode = (d as { mode?: string }).mode || "Master Duel";
              return mode === deckMode;
            })
            .map(formatDeck),
        );
        setOpponentDecks(
          metaDecks
            .filter((d) => {
              const mode = (d as { mode?: string }).mode || "Master Duel";
              return mode === deckMode;
            })
            .map(formatDeck),
        );
      } catch (error) {
        // Failed to fetch decks
      }
      setLoading(false);
    };
    fetchAll();
  }, [user, deckMode]);

  const handleRunTest = () => {
    if (!selectedDeckId || !opponentDeckId) return;
    onRunTest({
      selectedDeckId,
      opponentDeckId,
      testType,
      numSimulations,
      context,
    });
  };

  return (
    <Card className="w-full md:w-80 shrink-0 glass-panel">
      <CardHeader>
        <CardTitle className="text-white font-display tracking-wider">
          AI TESTING SETUP
        </CardTitle>
        <CardDescription className="text-white/70">
          Pick format, decks and test type for AI-powered analysis.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Mode Buttons */}
        <div className="flex items-center gap-2">
          <div
            ref={containerRef}
            className="relative flex w-fit bg-white/5 border border-white/10 backdrop-blur-xl rounded-lg"
          >
            <span
              className="absolute top-0 bottom-0 transition-all duration-200 bg-white/10 rounded-lg"
              style={{ ...sliderStyle, zIndex: 0 }}
            />
            {DECK_MODES.map((mode) => (
              <button
                key={mode}
                ref={btnRefs[mode]}
                type="button"
                onClick={() => {
                  setDeckMode(mode);
                  updateDeckMode(mode);
                  setSelectedDeckId(null);
                  setOpponentDeckId(null);
                }}
                className={`relative z-10 px-3 py-2 font-semibold transition-colors duration-200 focus:outline-none font-display text-xs flex items-center justify-center gap-1
                  ${deckMode === mode ? "text-white" : "text-white/60"}`}
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

        {/* Test Type Selector */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <label className="block font-medium text-white/80 font-display text-xs">
              Test Type
            </label>
            <Dialog open={infoModalOpen} onOpenChange={setInfoModalOpen}>
              <DialogTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-5 w-5 text-white/80 hover:text-white hover:bg-white/10"
                >
                  <Info className="h-4 w-4" />
                </Button>
              </DialogTrigger>
              <DialogContent className="text-white max-w-2xl bg-white/10 border border-white/20 backdrop-blur-xl">
                <DialogHeader>
                  <DialogTitle className="text-white/90 font-display">
                    Test Type Information
                  </DialogTitle>
                  <DialogDescription className="text-white/70">
                    Learn about what each test type analyzes and provides.
                  </DialogDescription>
                </DialogHeader>
                <div className="space-y-6 mt-4">
                  {/* Matchup Analysis */}
                  <div className="space-y-2">
                    <h3 className="text-lg font-semibold text-white/90 flex items-center gap-2">
                      <Target className="h-5 w-5" />
                      Matchup Analysis
                    </h3>
                    <p className="text-sm text-white/80">
                      Provides comprehensive matchup assessment between two
                      decks, including:
                    </p>
                    <ul className="list-disc list-inside text-sm text-white/70 space-y-1 ml-2">
                      <li>
                        Win rate estimates (going first, going second, overall)
                      </li>
                      <li>
                        Card effectiveness analysis - which cards are most
                        impactful
                      </li>
                      <li>
                        Matchup strengths and weaknesses against different
                        archetypes
                      </li>
                      <li>
                        Side deck impact (TCG only) - side deck cards that
                        improve the matchup
                      </li>
                      <li>
                        Resource usage metrics - draw consistency, depletion
                        rate, recovery success
                      </li>
                    </ul>
                  </div>

                  {/* Duel Simulation */}
                  <div className="space-y-2">
                    <h3 className="text-lg font-semibold text-white/90 flex items-center gap-2">
                      <Dices className="h-5 w-5" />
                      Duel Simulation
                    </h3>
                    <p className="text-sm text-white/80">
                      Simulates multiple duels using AI reasoning to provide
                      statistical insights, including:
                    </p>
                    <ul className="list-disc list-inside text-sm text-white/70 space-y-1 ml-2">
                      <li>
                        Simulation statistics - wins, losses, draws, average
                        turn length
                      </li>
                      <li>
                        Turn-by-turn progression - critical plays and game states
                      </li>
                      <li>
                        Combo success rates - frequency and impact of key combos
                      </li>
                      <li>
                        Decision point analysis - pivotal decisions affecting
                        outcomes
                      </li>
                      <li>
                        Game duration stats - fastest/slowest wins, tempo
                        analysis
                      </li>
                      <li>
                        Damage trends - average damage per turn, peak damage
                        turns
                      </li>
                    </ul>
                  </div>

                  {/* Strategic Insights */}
                  <div className="space-y-2">
                    <h3 className="text-lg font-semibold text-white/90 flex items-center gap-2">
                      <Brain className="h-5 w-5" />
                      Strategic Insights
                    </h3>
                    <p className="text-sm text-white/80">
                      Offers detailed strategic guidance and deck optimization
                      recommendations, including:
                    </p>
                    <ul className="list-disc list-inside text-sm text-white/70 space-y-1 ml-2">
                      <li>
                        Key card synergies - most impactful card interactions
                      </li>
                      <li>
                        Vulnerabilities and counters - deck weaknesses and
                        countermeasures
                      </li>
                      <li>
                        Playstyle profiling - categorizes deck playstyle with
                        evidence
                      </li>
                      <li>
                        Meta adaptation - suggestions for improving meta fit
                      </li>
                      <li>
                        Risk vs reward analysis - evaluates high-risk/high-reward
                        plays
                      </li>
                    </ul>
                  </div>
                </div>
              </DialogContent>
            </Dialog>
          </div>
          <Select
            value={testType}
            onValueChange={(value) => setTestType(value as TestType)}
          >
            <SelectTrigger className="bg-white/10 border-white/20 text-white focus:outline-none rounded-lg">
              <SelectValue />
            </SelectTrigger>
            <SelectContent className="bg-white/20 border-white/30 backdrop-blur-xl rounded-lg">
              <SelectItem
                value="matchup_analysis"
                className="text-white focus:bg-white/20 focus:text-white"
              >
                Matchup Analysis
              </SelectItem>
              <SelectItem
                value="duel_simulation"
                className="text-white focus:bg-white/20 focus:text-white"
              >
                Duel Simulation
              </SelectItem>
              <SelectItem
                value="strategic_insights"
                className="text-white focus:bg-white/20 focus:text-white"
              >
                Strategic Insights
              </SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* User Deck */}
        <div>
          <label className="block mb-2 font-medium text-white/80">
            Your Deck
          </label>
          <Select value={selectedDeckId || ""} onValueChange={setSelectedDeckId}>
            <SelectTrigger className="bg-white/10 border-white/20 text-white focus:outline-none rounded-lg">
              <SelectValue
                placeholder={
                  decks.length === 0 ? "No decks" : "Choose your deck"
                }
              />
            </SelectTrigger>
            <SelectContent className="bg-white/20 border-white/30 backdrop-blur-xl rounded-lg">
              {decks.map((deck) => (
                <SelectItem
                  key={deck.id}
                  value={deck.id}
                  className="text-white focus:bg-white/20 focus:text-white"
                >
                  {deck.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Opponent Deck */}
        <div>
          <label className="block mb-2 font-medium text-white/80">
            Opponent Deck
          </label>
          <Select
            value={opponentDeckId || ""}
            onValueChange={setOpponentDeckId}
          >
            <SelectTrigger className="bg-white/10 border-white/20 text-white focus:outline-none rounded-lg">
              <SelectValue
                placeholder={
                  opponentDecks.length === 0
                    ? "No meta decks"
                    : "Choose opponent deck"
                }
              />
            </SelectTrigger>
            <SelectContent className="bg-white/20 border-white/30 backdrop-blur-xl rounded-lg">
              <div className="font-bold px-2 py-1 text-white/80">
                Meta Decks
              </div>
              {opponentDecks.map((deck) => (
                <SelectItem
                  key={deck.id}
                  value={deck.id}
                  className="text-white focus:bg-white/20 focus:text-white"
                >
                  {deck.name}
                </SelectItem>
              ))}
              <SelectItem
                disabled
                value="divider"
                className="text-white/50"
              >
                ----
              </SelectItem>
              <div className="font-bold px-2 py-1 text-white/80">
                Your Decks
              </div>
              {decks.map((deck) => (
                <SelectItem
                  key={deck.id + "-op"}
                  value={deck.id}
                  className="text-white focus:bg-white/20 focus:text-white"
                >
                  Your: {deck.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Simulation Config (only for duel_simulation) */}
        {testType === "duel_simulation" && (
          <div>
            <label className="block mb-2 font-medium text-white/80">
              Number of Simulations (Max 20)
            </label>
            <Input
              type="number"
              min={1}
              max={20}
              value={numSimulations}
              onChange={(e) => {
                const val = Math.min(Math.max(1, Number(e.target.value)), 20);
                setNumSimulations(val);
              }}
              className="w-32 bg-white/5 border-white/10 text-white placeholder:text-white/50 focus-visible:outline-none rounded-lg"
              disabled={simulationLoading}
            />
          </div>
        )}

        {/* Context Input */}
        <div>
          <label className="block mb-2 font-medium text-white/80">
            Additional Context (Optional)
          </label>
          <Input
            type="text"
            value={context}
            onChange={(e) => setContext(e.target.value)}
            placeholder="e.g., going first, specific scenario..."
            className="bg-white/5 border-white/10 text-white placeholder:text-white/50 focus-visible:outline-none rounded-lg"
            disabled={simulationLoading}
          />
        </div>
      </CardContent>
      <CardFooter className="flex flex-col gap-2">
        <Button
          onClick={handleRunTest}
          disabled={
            simulationLoading ||
            loading ||
            !selectedDeckId ||
            !opponentDeckId ||
            !user
          }
          className="w-full"
        >
          {simulationLoading ? (
            <>
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              Analyzing...
            </>
          ) : (
            <>
              <Zap className="h-4 w-4 mr-2" />
              Run AI Test
            </>
          )}
        </Button>
        {!user && (
          <p className="text-xs text-white/70 text-center">
            Please log in to use AI testing
          </p>
        )}
      </CardFooter>
    </Card>
  );
}

