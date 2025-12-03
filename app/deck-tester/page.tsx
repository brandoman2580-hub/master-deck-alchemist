"use client";

import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { Button } from "../../components/ui/button";
import {
  Card,
  CardContent,
  CardFooter,
  CardHeader,
  CardTitle,
  CardDescription,
} from "../../components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../../components/ui/select";
import { Input } from "../../components/ui/input";
import { Badge } from "../../components/ui/badge";
import { Progress } from "../../components/ui/progress";
import { ScrollArea } from "../../components/ui/scroll-area";
import CutCornerWrapper from "../../components/cut-corner-wrapper";
import { getMetaDecks, getUserDecks } from "../../lib/supabaseDecks";
import { useUserStore } from "../../store/useUserStore";
import { DeckType } from "../../types/types";
import { openLoginModal } from "../../lib/helpers";
import {
  analyzeMatchup,
  simulateDuels,
  getStrategicInsights,
} from "../../lib/api/deckTesterAgent";
import { DeckTesterAgentResponse } from "../../types/ai-agents";

import { DECK_MODES } from "../../lib/constants";
import { useModeStore } from "../../store/modeStore";
import { useDeck } from "../../context/deck-context";
import { Loader2, Zap, AlertCircle, CheckCircle2, X, Info, Target, Dices, Brain } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "../../components/ui/dialog";

type TestType = "matchup_analysis" | "duel_simulation" | "strategic_insights";

export default function DeckTester() {
  const [decks, setDecks] = useState<DeckType[]>([]);
  const [opponentDecks, setOpponentDecks] = useState<DeckType[]>([]);
  const [loading, setLoading] = useState(false);

  const [selectedDeckId, setSelectedDeckId] = useState<string | null>(null);
  const [opponentDeckId, setOpponentDeckId] = useState<string | null>(null);
  const [numSimulations, setNumSimulations] = useState(10);
  const [testType, setTestType] = useState<TestType>("matchup_analysis");
  const [context, setContext] = useState("");

  const [simulationLoading, setSimulationLoading] = useState(false);
  const [aiResult, setAiResult] = useState<DeckTesterAgentResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isCached, setIsCached] = useState(false);
  const [infoModalOpen, setInfoModalOpen] = useState(false);

  const user = useUserStore((state) => state.user);
  const deckMode = useModeStore((state) => state.deckMode);
  const setDeckMode = useModeStore((state) => state.setDeckMode);
  const { updateDeckMode } = useDeck();

  // Filter panel slider highlight logic (for mode buttons)
  const tcgRef = useRef<HTMLButtonElement>(null);
  const masterDuelRef = useRef<HTMLButtonElement>(null);
  const btnRefs = useMemo(
    () => ({ TCG: tcgRef, "Master Duel": masterDuelRef }),
    []
  );
  const containerRef = useRef<HTMLDivElement>(null);
  const [sliderStyle, setSliderStyle] = useState<React.CSSProperties>({});
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
        const deckFormat = (d: any): DeckType => ({
          id: d.id,
          name: d.name,
          mainDeck: d.cards.main,
          extraDeck: d.cards.extra,
          sideDeck: d.cards.side,
          updated_at: d.updated_at,
          mode: d.mode || "Master Duel",
        });
        setDecks(
          userDecks
            .filter((d: any) => (d.mode || "Master Duel") === deckMode)
            .map(deckFormat)
        );
        setOpponentDecks(
          metaDecks
            .filter((d: any) => (d.mode || "Master Duel") === deckMode)
            .map(deckFormat)
        );
      } catch (error) {
        console.error("Failed to fetch decks:", error);
      }
      setLoading(false);
    };
    fetchAll();
  }, [user, deckMode]);

  // AI-powered testing logic
  const handleRunTest = async () => {
    if (!selectedDeckId || !opponentDeckId) return;
    if (!user) {
      openLoginModal();
      return;
    }

    setSimulationLoading(true);
    setAiResult(null);
    setError(null);

    try {
      const allDecks = [...decks, ...opponentDecks];
      const selectedDeck = allDecks.find((d) => d.id === selectedDeckId);
      const opponentDeck = allDecks.find((d) => d.id === opponentDeckId);
      
      if (!selectedDeck || !opponentDeck) {
        setError("Deck not found");
        setSimulationLoading(false);
        return;
      }

      // Validate deck structure
      if (!selectedDeck.mainDeck || !Array.isArray(selectedDeck.mainDeck)) {
        setError("Selected deck has invalid structure");
        setSimulationLoading(false);
        return;
      }

      if (!opponentDeck.mainDeck || !Array.isArray(opponentDeck.mainDeck)) {
        setError("Opponent deck has invalid structure");
        setSimulationLoading(false);
        return;
      }

      const banlistFormat = deckMode === "Master Duel" ? "MASTER_DUEL" : "TCG";
      let result: DeckTesterAgentResponse;

      if (testType === "matchup_analysis") {
        result = await analyzeMatchup({
          deck_a: selectedDeck,
          deck_b: opponentDeck,
          test_type: "matchup_analysis",
          banlist_format: banlistFormat,
          context: context || undefined,
        });
      } else if (testType === "duel_simulation") {
        result = await simulateDuels({
          deck_a: selectedDeck,
          deck_b: opponentDeck,
          test_type: "duel_simulation",
          num_simulations: Math.min(numSimulations, 20),
          banlist_format: banlistFormat,
          context: context || undefined,
        });
      } else {
        result = await getStrategicInsights({
          deck_a: selectedDeck,
          deck_b: opponentDeck,
          test_type: "strategic_insights",
          banlist_format: banlistFormat,
          context: context || undefined,
        });
      }

      setAiResult(result);
      setIsCached((result as any)._cached === true);
    } catch (err: any) {
      console.error("Test failed:", err);
      setError(err.message || "Failed to run test. Please try again.");
    } finally {
      setSimulationLoading(false);
    }
  };

  const MAX_TOKENS_REFERENCE = 100000;
  const tokenUsagePercent = aiResult?.estimated_cost
    ? Math.min((aiResult.estimated_cost.tokens_used / MAX_TOKENS_REFERENCE) * 100, 100)
    : 0;

  return (
    <div className="min-h-screen bg-cyb-900 px-8 pt-8 pb-10 relative">
      <div className="max-w-7xl mx-auto relative z-10">
        <div className="flex flex-col md:flex-row gap-8">
          {/* ==== Filter Panel ==== */}
          <Card className="w-full md:w-80 shrink-0 glass-panel">
            <CardHeader>
              <CardTitle className="text-white font-display tracking-wider">
                AI TESTING SETUP
              </CardTitle>
              <CardDescription className="text-muted-50">
                Pick format, decks and test type for AI-powered analysis.
              </CardDescription>
            </CardHeader>
          <CardContent className="space-y-4">
            {/* Mode Buttons */}
            <div className="flex items-center gap-2">
              <CutCornerWrapper
                size="sm"
                padding="0"
                className="relative flex w-fit"
                style={{
                  ["--cut-corner-stroke" as any]: "rgba(20,239,255,0.38)",
                  ["--cut-corner-fill" as any]: "transparent",
                }}
              >
                <div
                  ref={containerRef}
                  className="relative flex w-fit bg-cyb-800/40 border border-accent-cyan/18 backdrop-blur-sm"
                >
                  <span
                    className="absolute top-0 bottom-0 transition-all duration-200 bg-accent-cyan/20"
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
                        setAiResult(null);
                    }}
                    className={`relative z-10 px-3 py-2 font-semibold transition-colors duration-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-accent-cyan/60 font-display text-xs flex items-center justify-center gap-1
                    ${deckMode === mode ? "text-accent-cyan/80" : "text-muted-50"}`}
                    aria-pressed={deckMode === mode}
                    style={{ background: "transparent", position: "relative"                     }}
                  >
                    {mode}
                  </button>
                ))}
                </div>
              </CutCornerWrapper>
            </div>

              {/* Test Type Selector */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="block font-medium text-accent-cyan font-display text-xs">Test Type</label>
                  <Dialog open={infoModalOpen} onOpenChange={setInfoModalOpen}>
                    <DialogTrigger asChild>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-5 w-5 text-accent-cyan hover:text-accent-cyan/90 hover:bg-accent-cyan/20"
                      >
                        <Info className="h-4 w-4" />
                      </Button>
                    </DialogTrigger>
                    <DialogContent className="text-white max-w-2xl">
                      <DialogHeader>
                        <DialogTitle className="text-accent-cyan/80 font-display">
                          Test Type Information
                        </DialogTitle>
                        <DialogDescription className="text-muted-50">
                          Learn about what each test type analyzes and provides.
                        </DialogDescription>
                      </DialogHeader>
                      <div className="space-y-6 mt-4">
                        {/* Matchup Analysis */}
                        <div className="space-y-2">
                          <h3 className="text-lg font-semibold text-accent-cyan/90 flex items-center gap-2">
                            <Target className="h-5 w-5" />
                            Matchup Analysis
                          </h3>
                          <p className="text-sm text-muted-50">
                            Provides comprehensive matchup assessment between two decks, including:
                          </p>
                          <ul className="list-disc list-inside text-sm text-muted-50/70 space-y-1 ml-2">
                            <li>Win rate estimates (going first, going second, overall)</li>
                            <li>Card effectiveness analysis - which cards are most impactful</li>
                            <li>Matchup strengths and weaknesses against different archetypes</li>
                            <li>Side deck impact (TCG only) - side deck cards that improve the matchup</li>
                            <li>Resource usage metrics - draw consistency, depletion rate, recovery success</li>
                          </ul>
                        </div>

                        {/* Duel Simulation */}
                        <div className="space-y-2">
                          <h3 className="text-lg font-semibold text-accent-cyan/90 flex items-center gap-2">
                            <Dices className="h-5 w-5" />
                            Duel Simulation
                          </h3>
                          <p className="text-sm text-muted-50">
                            Simulates multiple duels using AI reasoning to provide statistical insights, including:
                          </p>
                          <ul className="list-disc list-inside text-sm text-muted-50/70 space-y-1 ml-2">
                            <li>Simulation statistics - wins, losses, draws, average turn length</li>
                            <li>Turn-by-turn progression - critical plays and game states</li>
                            <li>Combo success rates - frequency and impact of key combos</li>
                            <li>Decision point analysis - pivotal decisions affecting outcomes</li>
                            <li>Game duration stats - fastest/slowest wins, tempo analysis</li>
                            <li>Damage trends - average damage per turn, peak damage turns</li>
                          </ul>
                        </div>

                        {/* Strategic Insights */}
                        <div className="space-y-2">
                          <h3 className="text-lg font-semibold text-accent-cyan/90 flex items-center gap-2">
                            <Brain className="h-5 w-5" />
                            Strategic Insights
                          </h3>
                          <p className="text-sm text-muted-50">
                            Offers detailed strategic guidance and deck optimization recommendations, including:
                          </p>
                          <ul className="list-disc list-inside text-sm text-muted-50/70 space-y-1 ml-2">
                            <li>Key card synergies - most impactful card interactions</li>
                            <li>Vulnerabilities and counters - deck weaknesses and countermeasures</li>
                            <li>Playstyle profiling - categorizes deck playstyle with evidence</li>
                            <li>Meta adaptation - suggestions for improving meta fit</li>
                            <li>Risk vs reward analysis - evaluates high-risk/high-reward plays</li>
                          </ul>
                        </div>
                      </div>
                    </DialogContent>
                  </Dialog>
                </div>
                <Select value={testType} onValueChange={(value) => setTestType(value as TestType)}>
                  <SelectTrigger className="bg-slate-950/60 border-cyan-500/50 text-white focus:ring-cyan-400/60">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="bg-gradient-to-b from-cyan-400/20 via-cyan-500/15 to-cyan-600/5 backdrop-blur-md border border-accent-cyan/18">
                    <SelectItem value="matchup_analysis" className="text-white focus:bg-cyan-500/40 focus:text-accent-cyan/80">
                      Matchup Analysis
                    </SelectItem>
                    <SelectItem value="duel_simulation" className="text-white focus:bg-cyan-500/40 focus:text-accent-cyan/80">
                      Duel Simulation
                    </SelectItem>
                    <SelectItem value="strategic_insights" className="text-white focus:bg-cyan-500/40 focus:text-accent-cyan/80">
                      Strategic Insights
                    </SelectItem>
                  </SelectContent>
                </Select>
              </div>

            {/* User Deck */}
            <div>
              <label className="block mb-2 font-medium text-accent-cyan/90">Your Deck</label>
              <Select
                value={selectedDeckId || ""}
                onValueChange={setSelectedDeckId}
              >
                <SelectTrigger className="bg-slate-950/60 border-cyan-500/50 text-white focus:ring-cyan-400/60">
                  <SelectValue
                    placeholder={
                      decks.length === 0 ? "No decks" : "Choose your deck"
                    }
                  />
                </SelectTrigger>
                <SelectContent className="bg-gradient-to-b from-cyan-400/20 via-cyan-500/15 to-cyan-600/5 backdrop-blur-md border border-accent-cyan/18">
                  {decks.map((deck) => (
                    <SelectItem key={deck.id} value={deck.id} className="text-white focus:bg-cyan-500/40 focus:text-accent-cyan/80">
                      {deck.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Opponent Deck */}
            <div>
              <label className="block mb-2 font-medium text-accent-cyan/90">Opponent Deck</label>
              <Select
                value={opponentDeckId || ""}
                onValueChange={setOpponentDeckId}
              >
                <SelectTrigger className="bg-slate-950/60 border-cyan-500/50 text-white focus:ring-cyan-400/60">
                  <SelectValue
                    placeholder={
                      opponentDecks.length === 0
                        ? "No meta decks"
                        : "Choose opponent deck"
                    }
                  />
                </SelectTrigger>
                <SelectContent className="bg-gradient-to-b from-cyan-400/20 via-cyan-500/15 to-cyan-600/5 backdrop-blur-md border border-accent-cyan/18">
                  <div className="font-bold px-2 py-1 text-accent-cyan/90">Meta Decks</div>
                  {opponentDecks.map((deck) => (
                    <SelectItem key={deck.id} value={deck.id} className="text-white focus:bg-cyan-500/40 focus:text-accent-cyan/80">
                      {deck.name}
                    </SelectItem>
                  ))}
                  <SelectItem disabled value="divider" className="text-muted-50/70">
                    ----
                  </SelectItem>
                  <div className="font-bold px-2 py-1 text-accent-cyan/90">Your Decks</div>
                  {decks.map((deck) => (
                    <SelectItem key={deck.id + "-op"} value={deck.id} className="text-white focus:bg-cyan-500/40 focus:text-accent-cyan/80">
                      Your: {deck.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

              {/* Simulation Config (only for duel_simulation) */}
              {testType === "duel_simulation" && (
            <div>
              <label className="block mb-2 font-medium text-accent-cyan/90">
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
                className="w-32 bg-slate-950/60 border-cyan-500/50 text-white placeholder:text-muted-50/70 focus-visible:border-cyan-400 focus-visible:ring-cyan-400/60"
                    disabled={simulationLoading}
                  />
                </div>
              )}

              {/* Context Input */}
              <div>
                <label className="block mb-2 font-medium text-accent-cyan/90">
                  Additional Context (Optional)
                </label>
                <Input
                  type="text"
                  value={context}
                  onChange={(e) => setContext(e.target.value)}
                  placeholder="e.g., going first, specific scenario..."
                  className="bg-slate-950/60 border-cyan-500/50 text-white placeholder:text-muted-50/70 focus-visible:border-cyan-400 focus-visible:ring-cyan-400/60"
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
                <p className="text-xs text-muted-50/70 text-center">
                  Please log in to use AI testing
                </p>
              )}
          </CardFooter>
        </Card>

          {/* ==== Results Grid ==== */}
          <div className="grow flex flex-col relative">
            {error && (
              <Card className="mb-4 bg-red-500/10 border-red-500/30">
                <CardContent className="pt-6">
                  <div className="flex items-center gap-2 text-red-400">
                    <AlertCircle className="h-5 w-5" />
                    <p>{error}</p>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="ml-auto h-6 w-6"
                      onClick={() => setError(null)}
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Token Usage Display */}
            {aiResult?.estimated_cost && (
              <Card className="mb-4 bg-gradient-to-b from-cyan-400/20 via-cyan-500/15 to-cyan-600/5 backdrop-blur-md border border-accent-cyan/18">
                <CardContent className="pt-6">
                  <div className="space-y-2">
                    <div className="flex items-center justify-between text-xs">
                      <div className="flex items-center gap-2">
                        <Zap className="h-3.5 w-3.5 text-accent-cyan" />
                        <span className="text-muted-50 font-medium">Token Usage</span>
                        {isCached && (
                          <Badge variant="outline" className="text-xs text-green-400 border-green-500/50">
                            Cached
                          </Badge>
                        )}
                      </div>
                      <div className="flex items-center gap-2 text-muted-50/70">
                        <span className="font-semibold text-accent-cyan tabular-nums">
                          {aiResult.estimated_cost.tokens_used.toLocaleString()}
                        </span>
                        <span className="text-white0">/</span>
                        <span className="tabular-nums">{MAX_TOKENS_REFERENCE.toLocaleString()}</span>
                        {aiResult.estimated_cost.cost_usd > 0 && (
                          <>
                            <span className="text-white0">•</span>
                            <span className="text-muted-50">${aiResult.estimated_cost.cost_usd.toFixed(4)}</span>
                          </>
                        )}
                      </div>
                    </div>
                    <Progress value={tokenUsagePercent} className="h-2 bg-cyb-800/40" />
                  </div>
                </CardContent>
              </Card>
            )}

            {aiResult ? (
              <div className="space-y-6">
                {/* Test Type Specific Analytics */}
                {testType === "matchup_analysis" && aiResult.matchup_analytics && (
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {/* Win Rate Estimates */}
            <Card className="bg-gradient-to-b from-cyan-400/20 via-cyan-500/15 to-cyan-600/5 backdrop-blur-md border border-accent-cyan/18">
              <CardHeader>
                        <CardTitle className="text-white text-base font-display">
                          Win Rate Estimates
                        </CardTitle>
              </CardHeader>
                      <CardContent className="space-y-3">
                        <div className="space-y-2">
                          <div className="flex justify-between items-center">
                            <span className="text-xs text-muted-50/70">Going First</span>
                            <span className="text-sm font-semibold text-accent-cyan">
                              {aiResult.matchup_analytics.win_rate_estimates.going_first.toFixed(1)}%
                            </span>
                          </div>
                          <div className="flex justify-between items-center">
                            <span className="text-xs text-muted-50/70">Going Second</span>
                            <span className="text-sm font-semibold text-accent-cyan">
                              {aiResult.matchup_analytics.win_rate_estimates.going_second.toFixed(1)}%
                            </span>
                          </div>
                          <div className="flex justify-between items-center pt-2 border-t border-cyan-500/20">
                            <span className="text-xs font-medium text-muted-50">Overall</span>
                            <span className="text-base font-bold text-accent-cyan/90">
                              {aiResult.matchup_analytics.win_rate_estimates.overall.toFixed(1)}%
                            </span>
                          </div>
                        </div>
                      </CardContent>
                    </Card>

                    {/* Card Effectiveness */}
                    {aiResult.matchup_analytics.card_effectiveness.length > 0 && (
                      <Card className="bg-gradient-to-b from-cyan-400/20 via-cyan-500/15 to-cyan-600/5 backdrop-blur-md border border-accent-cyan/18">
                        <CardHeader>
                          <CardTitle className="text-white text-base font-display">
                            Card Effectiveness
                          </CardTitle>
                        </CardHeader>
                        <CardContent>
                          <ScrollArea className="h-[200px]">
                            <div className="space-y-2 pr-4">
                              {aiResult.matchup_analytics.card_effectiveness.slice(0, 5).map((card, i) => (
                                <div key={i} className="bg-cyb-800/40 p-2 border border-cyan-500/20">
                                  <div className="flex items-center justify-between mb-1 gap-2">
                                    <span className="text-xs font-semibold text-white break-words">{card.card_name || "Unknown Card"}</span>
                                    <Badge variant="outline" className="text-xs shrink-0">
                                      {card.impact_score}%
                                    </Badge>
                                  </div>
                                  <p className="text-xs text-muted-50/70 break-words">{card.description}</p>
                                </div>
                              ))}
                            </div>
                          </ScrollArea>
                        </CardContent>
                      </Card>
                    )}

                    {/* Matchup Strengths & Weaknesses */}
                    <Card className="bg-gradient-to-b from-cyan-400/20 via-cyan-500/15 to-cyan-600/5 backdrop-blur-md border border-accent-cyan/18 md:col-span-2 lg:col-span-1">
                      <CardHeader>
                        <CardTitle className="text-white text-base font-display">
                          Matchup Profile
                        </CardTitle>
                      </CardHeader>
                      <CardContent>
                        <ScrollArea className="h-[200px]">
                          <div className="space-y-3 pr-4">
                            {aiResult.matchup_analytics.matchup_strengths.length > 0 && (
                              <div>
                                <div className="flex items-center gap-2 mb-2">
                                  <CheckCircle2 className="h-3.5 w-3.5 text-green-400" />
                                  <span className="text-xs font-semibold text-green-400 uppercase">Strengths</span>
                                </div>
                                <div className="space-y-1.5">
                                  {aiResult.matchup_analytics.matchup_strengths.slice(0, 3).map((matchup, i) => (
                                    <div key={i} className="bg-green-500/10 rounded p-1.5 border border-green-500/20">
                                      <div className="flex justify-between items-center mb-0.5">
                                        <span className="text-xs font-medium text-green-300">{matchup.archetype_or_deck_type}</span>
                                        <span className="text-xs font-bold text-green-400">{matchup.win_rate.toFixed(0)}%</span>
                                      </div>
                                      <p className="text-xs text-muted-50/70">{matchup.reason}</p>
                                    </div>
                                  ))}
                                </div>
                              </div>
                            )}
                            {aiResult.matchup_analytics.matchup_weaknesses.length > 0 && (
                              <div>
                                <div className="flex items-center gap-2 mb-2">
                                  <AlertCircle className="h-3.5 w-3.5 text-red-400" />
                                  <span className="text-xs font-semibold text-red-400 uppercase">Weaknesses</span>
                                </div>
                                <div className="space-y-1.5">
                                  {aiResult.matchup_analytics.matchup_weaknesses.slice(0, 3).map((matchup, i) => (
                                    <div key={i} className="bg-red-500/10 rounded p-1.5 border border-red-500/20">
                                      <div className="flex justify-between items-center mb-0.5">
                                        <span className="text-xs font-medium text-red-300">{matchup.archetype_or_deck_type}</span>
                                        <span className="text-xs font-bold text-red-400">{matchup.win_rate.toFixed(0)}%</span>
                                      </div>
                                      <p className="text-xs text-muted-50/70">{matchup.reason}</p>
                                    </div>
                                  ))}
                                </div>
                              </div>
                            )}
                          </div>
                        </ScrollArea>
                      </CardContent>
                    </Card>

                    {/* Side Deck Impact - Only show for TCG format */}
                    {deckMode === "TCG" && aiResult.matchup_analytics.side_deck_impact.length > 0 && (
                      <Card className="bg-gradient-to-b from-cyan-400/20 via-cyan-500/15 to-cyan-600/5 backdrop-blur-md border border-accent-cyan/18">
                        <CardHeader>
                          <CardTitle className="text-white text-base font-display">
                            Side Deck Impact
                          </CardTitle>
                        </CardHeader>
                        <CardContent>
                          <ScrollArea className="h-[200px]">
                            <div className="space-y-2 pr-4">
                              {aiResult.matchup_analytics.side_deck_impact.slice(0, 5).map((card, i) => (
                                <div key={i} className="bg-cyb-800/40 p-2 border border-cyan-500/20">
                                  <div className="flex items-center justify-between mb-1">
                                    <span className="text-xs font-semibold text-white break-words">{card.card_name || "Unknown Card"}</span>
                                    <Badge variant="outline" className="text-xs text-green-400 shrink-0 ml-2">
                                      +{card.matchup_improvement}%
                                    </Badge>
                                  </div>
                                  <p className="text-xs text-muted-50/70 break-words">{card.description}</p>
                                </div>
                              ))}
                            </div>
                          </ScrollArea>
                        </CardContent>
                      </Card>
                    )}

                    {/* Resource Usage */}
                    {aiResult.matchup_analytics.resource_usage && (
                      <Card className="bg-gradient-to-b from-cyan-400/20 via-cyan-500/15 to-cyan-600/5 backdrop-blur-md border border-accent-cyan/18">
                        <CardHeader>
                          <CardTitle className="text-white text-base font-display">
                            Resource Usage
                          </CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-3">
                          <div className="space-y-2">
                            <div className="flex justify-between items-center">
                              <span className="text-xs text-muted-50/70">Draw Consistency</span>
                              <span className="text-sm font-semibold text-accent-cyan">
                                {aiResult.matchup_analytics.resource_usage.draw_consistency.toFixed(0)}%
                              </span>
                            </div>
                            <div className="flex justify-between items-center">
                              <span className="text-xs text-muted-50/70">Depletion Rate</span>
                              <Badge variant="outline" className="text-xs capitalize">
                                {aiResult.matchup_analytics.resource_usage.resource_depletion_rate}
                              </Badge>
                            </div>
                            <div className="flex justify-between items-center">
                              <span className="text-xs text-muted-50/70">Recovery Success</span>
                              <span className="text-sm font-semibold text-accent-cyan">
                                {aiResult.matchup_analytics.resource_usage.recovery_success_rate.toFixed(0)}%
                              </span>
                            </div>
                          </div>
                          <p className="text-xs text-muted-50/70 pt-2 border-t border-cyan-500/20 break-words">
                            {aiResult.matchup_analytics.resource_usage.description}
                          </p>
                        </CardContent>
                      </Card>
                    )}
                  </div>
                )}

                {/* Duel Simulation Analytics */}
                {testType === "duel_simulation" && aiResult.simulation_analytics && (
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {/* Simulation Stats */}
                    <Card className="bg-gradient-to-b from-cyan-400/20 via-cyan-500/15 to-cyan-600/5 backdrop-blur-md border border-accent-cyan/18">
                      <CardHeader>
                        <CardTitle className="text-white text-base font-display">
                          Simulation Stats
                        </CardTitle>
                      </CardHeader>
                      <CardContent className="space-y-3">
                        <div className="grid grid-cols-3 gap-2">
                          <div className="bg-cyb-800/40 p-2 border border-cyan-500/20 text-center">
                            <div className="text-xs text-muted-50/70 mb-0.5">Wins</div>
                            <div className="text-xl font-bold text-green-400">
                              {aiResult.simulation_analytics.wins_deck_a}
                            </div>
                          </div>
                          <div className="bg-cyb-800/40 p-2 border border-cyan-500/20 text-center">
                            <div className="text-xs text-muted-50/70 mb-0.5">Losses</div>
                            <div className="text-xl font-bold text-red-400">
                              {aiResult.simulation_analytics.wins_deck_b}
                            </div>
                          </div>
                          <div className="bg-cyb-800/40 p-2 border border-cyan-500/20 text-center">
                            <div className="text-xs text-muted-50/70 mb-0.5">Draws</div>
                            <div className="text-xl font-bold text-muted-50/70">
                              {aiResult.simulation_analytics.draws}
                            </div>
                          </div>
                        </div>
                        <div className="bg-cyb-800/40 p-3 border border-cyan-500/20">
                          <div className="text-xs text-muted-50/70 mb-1">Avg Turn Length</div>
                          <div className="text-2xl font-bold text-accent-cyan">
                            {aiResult.simulation_analytics.avg_turn_length.toFixed(1)}
                          </div>
                        </div>
                      </CardContent>
                    </Card>

                    {/* Game Duration Stats */}
                    {aiResult.simulation_analytics.game_duration_stats && (
                      <Card className="bg-gradient-to-b from-cyan-400/20 via-cyan-500/15 to-cyan-600/5 backdrop-blur-md border border-accent-cyan/18">
                        <CardHeader>
                          <CardTitle className="text-white text-base font-display">
                            Game Duration
                          </CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-2">
                          <div className="flex justify-between items-center">
                            <span className="text-xs text-muted-50/70">Fastest Win</span>
                            <span className="text-sm font-semibold text-green-400">
                              {aiResult.simulation_analytics.game_duration_stats.fastest_win} turns
                            </span>
                          </div>
                          <div className="flex justify-between items-center">
                            <span className="text-xs text-muted-50/70">Slowest Win</span>
                            <span className="text-sm font-semibold text-orange-400">
                              {aiResult.simulation_analytics.game_duration_stats.slowest_win} turns
                            </span>
                          </div>
                          <div className="flex justify-between items-center pt-2 border-t border-cyan-500/20">
                            <span className="text-xs font-medium text-muted-50">Average</span>
                            <span className="text-base font-bold text-accent-cyan/90">
                              {aiResult.simulation_analytics.game_duration_stats.average_duration.toFixed(1)} turns
                            </span>
                          </div>
                          <Badge variant="outline" className="w-full justify-center mt-2 capitalize">
                            Tempo: {aiResult.simulation_analytics.game_duration_stats.tempo}
                          </Badge>
                        </CardContent>
                      </Card>
                    )}

                    {/* Combo Success Rates */}
                    {aiResult.simulation_analytics.combo_success_rates.length > 0 && (
                      <Card className="bg-gradient-to-b from-cyan-400/20 via-cyan-500/15 to-cyan-600/5 backdrop-blur-md border border-accent-cyan/18">
                        <CardHeader>
                          <CardTitle className="text-white text-base font-display">
                            Combo Success Rates
                          </CardTitle>
                        </CardHeader>
                        <CardContent>
                          <ScrollArea className="h-[200px]">
                            <div className="space-y-2 pr-4">
                              {aiResult.simulation_analytics.combo_success_rates.slice(0, 5).map((combo, i) => (
                                <div key={i} className="bg-cyb-800/40 p-2 border border-cyan-500/20">
                                  <div className="flex items-center justify-between mb-1 gap-2">
                                    <span className="text-xs font-semibold text-white break-words">{combo.combo_name}</span>
                                    <Badge variant="outline" className="text-xs shrink-0">
                                      {combo.success_rate}%
                                    </Badge>
                                  </div>
                                  <p className="text-xs text-muted-50/70 break-words">{combo.description}</p>
                                </div>
                              ))}
                            </div>
                          </ScrollArea>
                        </CardContent>
                      </Card>
                    )}

                    {/* Decision Points */}
                    {aiResult.simulation_analytics.decision_points.length > 0 && (
                      <Card className="bg-gradient-to-b from-cyan-400/20 via-cyan-500/15 to-cyan-600/5 backdrop-blur-md border border-accent-cyan/18 md:col-span-2 lg:col-span-1">
                        <CardHeader>
                          <CardTitle className="text-white text-base font-display">
                            Decision Points
                          </CardTitle>
                        </CardHeader>
                        <CardContent>
                          <ScrollArea className="h-[200px]">
                            <div className="space-y-2 pr-4">
                              {aiResult.simulation_analytics.decision_points.slice(0, 5).map((decision, i) => (
                                <div key={i} className="bg-cyb-800/40 p-2 border border-cyan-500/20">
                                  <div className="flex items-center justify-between mb-1 gap-2">
                                    <span className="text-xs font-medium text-muted-50">Turn {decision.turn}</span>
                                    <Badge
                                      variant="outline"
                                      className={`text-xs shrink-0 capitalize ${
                                        decision.impact === "high"
                                          ? "border-red-500/50 text-red-400"
                                          : decision.impact === "medium"
                                          ? "border-yellow-500/50 text-yellow-400"
                                          : "border-slate-500/50 text-muted-50/70"
                                      }`}
                                    >
                                      {decision.impact}
                                    </Badge>
                                  </div>
                                  <p className="text-xs text-white font-medium mb-0.5 break-words">{decision.decision}</p>
                                  <p className="text-xs text-muted-50/70 break-words">{decision.outcome}</p>
                                </div>
                              ))}
                            </div>
                          </ScrollArea>
                        </CardContent>
                      </Card>
                    )}

                    {/* Damage Trends */}
                    {aiResult.simulation_analytics.damage_trends && (
                      <Card className="bg-gradient-to-b from-cyan-400/20 via-cyan-500/15 to-cyan-600/5 backdrop-blur-md border border-accent-cyan/18">
                        <CardHeader>
                          <CardTitle className="text-white text-base font-display">
                            Damage Trends
                          </CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-2">
                          <div className="flex justify-between items-center">
                            <span className="text-xs text-muted-50/70">Avg Damage/Turn</span>
                            <span className="text-sm font-semibold text-accent-cyan">
                              {aiResult.simulation_analytics.damage_trends.avg_damage_per_turn.toFixed(0)}
                            </span>
                          </div>
                          <div className="flex justify-between items-center">
                            <span className="text-xs text-muted-50/70">Peak Damage Turn</span>
                            <span className="text-sm font-semibold text-orange-400">
                              Turn {aiResult.simulation_analytics.damage_trends.peak_damage_turn}
                            </span>
                          </div>
                          <div className="flex justify-between items-center">
                            <span className="text-xs text-muted-50/70">Consistency</span>
                            <span className="text-sm font-semibold text-accent-cyan">
                              {aiResult.simulation_analytics.damage_trends.damage_consistency.toFixed(0)}%
                            </span>
                          </div>
                          <p className="text-xs text-muted-50/70 pt-2 border-t border-cyan-500/20 break-words">
                            {aiResult.simulation_analytics.damage_trends.description}
                          </p>
              </CardContent>
            </Card>
                    )}

                    {/* Common Outcomes */}
                    {aiResult.simulation_analytics.common_outcomes.length > 0 && (
                      <Card className="bg-gradient-to-b from-cyan-400/20 via-cyan-500/15 to-cyan-600/5 backdrop-blur-md border border-accent-cyan/18 md:col-span-2">
                        <CardHeader>
                          <CardTitle className="text-white text-base font-display">
                            Common Outcomes
                          </CardTitle>
                        </CardHeader>
                        <CardContent>
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                            {aiResult.simulation_analytics.common_outcomes.map((outcome, i) => (
                              <div
                                key={i}
                                className="bg-cyb-800/40 p-3 border border-cyan-500/20"
                              >
                                <div className="flex items-center justify-between mb-1 gap-2">
                                  <span className="text-sm font-semibold text-white break-words capitalize">{outcome.outcome}</span>
                                  <Badge variant="outline" className="text-xs shrink-0">
                                    {outcome.frequency} times
                                  </Badge>
                                </div>
                                <p className="text-xs text-muted-50/70 break-words">{outcome.explanation}</p>
                              </div>
                            ))}
                          </div>
                        </CardContent>
                      </Card>
                    )}
                  </div>
                )}

                {/* Strategic Insights Analytics */}
                {testType === "strategic_insights" && aiResult.strategic_analytics && (
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {/* Key Card Synergies */}
                    {aiResult.strategic_analytics.key_card_synergies.length > 0 && (
            <Card className="bg-gradient-to-b from-cyan-400/20 via-cyan-500/15 to-cyan-600/5 backdrop-blur-md border border-accent-cyan/18">
              <CardHeader>
                          <CardTitle className="text-white text-base font-display">
                            Key Card Synergies
                          </CardTitle>
              </CardHeader>
                        <CardContent>
                          <ScrollArea className="h-[250px]">
                            <div className="space-y-2 pr-4">
                              {aiResult.strategic_analytics.key_card_synergies.slice(0, 5).map((synergy, i) => (
                                <div key={i} className="bg-cyb-800/40 p-2 border border-cyan-500/20">
                                  <div className="flex items-center justify-between mb-1 gap-2">
                                    <span className="text-xs font-semibold text-white break-words">
                                      {synergy.card_a || "Unknown"} + {synergy.card_b || "Unknown"}
                                    </span>
                                    <Badge variant="outline" className="text-xs text-green-400 shrink-0">
                                      {synergy.synergy_score}%
                                    </Badge>
                                  </div>
                                  <p className="text-xs text-muted-50/70 break-words">{synergy.description}</p>
                                </div>
                              ))}
                            </div>
                          </ScrollArea>
                        </CardContent>
                      </Card>
                    )}

                    {/* Vulnerabilities & Counters */}
                    {aiResult.strategic_analytics.vulnerabilities.length > 0 && (
                      <Card className="bg-gradient-to-b from-cyan-400/20 via-cyan-500/15 to-cyan-600/5 backdrop-blur-md border border-accent-cyan/18">
                        <CardHeader>
                          <CardTitle className="text-white text-base font-display">
                            Vulnerabilities & Counters
                          </CardTitle>
                        </CardHeader>
                        <CardContent>
                          <ScrollArea className="h-[250px]">
                            <div className="space-y-2 pr-4">
                              {aiResult.strategic_analytics.vulnerabilities.slice(0, 5).map((vuln, i) => (
                                <div key={i} className="bg-red-500/10 p-2 border border-red-500/20">
                                  <div className="flex items-center justify-between mb-1 gap-2">
                                    <span className="text-xs font-semibold text-red-300 break-words capitalize">{vuln.weakness}</span>
                                    <Badge
                                      variant="outline"
                                      className={`text-xs shrink-0 capitalize ${
                                        vuln.exploitability_level === "high"
                                          ? "border-red-500/50 text-red-400"
                                          : vuln.exploitability_level === "medium"
                                          ? "border-yellow-500/50 text-yellow-400"
                                          : "border-slate-500/50 text-muted-50/70"
                                      }`}
                                    >
                                      {vuln.exploitability_level}
                                    </Badge>
                                  </div>
                                  {vuln.countermeasures.length > 0 && (
                                    <p className="text-xs text-muted-50/70 mb-1 break-words">Countermeasures:</p>
                                  )}
                                  {vuln.countermeasures.length > 0 && (
                                    <ul className="list-disc list-inside text-xs text-muted-50 space-y-0.5">
                                      {vuln.countermeasures.slice(0, 2).map((cm, j) => (
                                        <li key={j}>{cm}</li>
                                      ))}
                                    </ul>
                                  )}
                                </div>
                              ))}
                            </div>
                          </ScrollArea>
                        </CardContent>
                      </Card>
                    )}

                    {/* Playstyle Profile */}
                    {aiResult.strategic_analytics.playstyle_profile && (
                      <Card className="bg-gradient-to-b from-cyan-400/20 via-cyan-500/15 to-cyan-600/5 backdrop-blur-md border border-accent-cyan/18">
                        <CardHeader>
                          <CardTitle className="text-white text-base font-display">
                            Playstyle Profile
                          </CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-3">
                          <div>
                            <Badge variant="outline" className="text-sm py-1.5 w-full justify-center capitalize">
                              {aiResult.strategic_analytics.playstyle_profile.primary_style}
                            </Badge>
                            <div className="text-xs text-muted-50/70 mt-1 text-center">
                              Confidence: {aiResult.strategic_analytics.playstyle_profile.style_confidence}%
                            </div>
                          </div>
                          <p className="text-xs text-muted-50 break-words">{aiResult.strategic_analytics.playstyle_profile.description}</p>
                          {aiResult.strategic_analytics.playstyle_profile.evidence.length > 0 && (
                            <div>
                              <div className="text-xs font-semibold text-accent-cyan mb-1">Evidence:</div>
                              <ul className="list-disc list-inside text-xs text-muted-50/70 space-y-0.5">
                                {aiResult.strategic_analytics.playstyle_profile.evidence.slice(0, 3).map((ev, i) => (
                                  <li key={i}>{ev}</li>
                                ))}
                              </ul>
                            </div>
                          )}
                        </CardContent>
                      </Card>
                    )}

                    {/* Meta Adaptation */}
                    {aiResult.strategic_analytics.meta_adaptation && (
                      <Card className="bg-gradient-to-b from-cyan-400/20 via-cyan-500/15 to-cyan-600/5 backdrop-blur-md border border-accent-cyan/18 md:col-span-2">
                        <CardHeader>
                          <CardTitle className="text-white text-base font-display">
                            Meta Adaptation
                          </CardTitle>
                        </CardHeader>
                        <CardContent>
                          <div className="space-y-3">
                            <div className="flex items-center justify-between">
                              <span className="text-xs text-muted-50/70">Current Meta Fit</span>
                              <span className="text-lg font-bold text-accent-cyan">
                                {aiResult.strategic_analytics.meta_adaptation.current_meta_fit.toFixed(0)}%
                            </span>
                            </div>
                            {aiResult.strategic_analytics.meta_adaptation.recommended_changes.length > 0 && (
                              <div>
                                <div className="text-xs font-semibold text-accent-cyan mb-2">Recommended Changes:</div>
                                <div className="space-y-2">
                                  {aiResult.strategic_analytics.meta_adaptation.recommended_changes.slice(0, 3).map((change, i) => (
                                    <div key={i} className="bg-cyb-800/40 p-2 border border-cyan-500/20">
                                      <div className="flex items-center justify-between mb-1 gap-2">
                                        <span className="text-xs font-medium text-white break-words">
                                          {change.card_to_add && `Add: ${change.card_to_add}`}
                                          {change.card_to_remove && `Remove: ${change.card_to_remove}`}
                                        </span>
                                        <Badge variant="outline" className="text-xs text-green-400 shrink-0">
                                          +{change.expected_improvement}%
                                        </Badge>
                                      </div>
                                      <p className="text-xs text-muted-50/70 break-words">{change.reason}</p>
                                    </div>
                                  ))}
                                </div>
                  </div>
                )}
                            {aiResult.strategic_analytics.meta_adaptation.meta_trends.length > 0 && (
                              <div>
                                <div className="text-xs font-semibold text-accent-cyan mb-1">Meta Trends:</div>
                                <ul className="list-disc list-inside text-xs text-muted-50/70 space-y-0.5">
                                  {aiResult.strategic_analytics.meta_adaptation.meta_trends.slice(0, 3).map((trend, i) => (
                                    <li key={i}>{trend}</li>
                                  ))}
                                </ul>
                              </div>
                            )}
                </div>
              </CardContent>
            </Card>
                    )}

                    {/* Risk vs Reward - Redesigned */}
                    {aiResult.strategic_analytics.risk_reward_analysis.length > 0 && (
                      <Card className="bg-gradient-to-b from-cyan-400/20 via-cyan-500/15 to-cyan-600/5 backdrop-blur-md border border-accent-cyan/18 md:col-span-2 lg:col-span-3">
                        <CardHeader>
                          <CardTitle className="text-white text-base font-display">
                            Risk vs Reward Analysis
                          </CardTitle>
                          <CardDescription className="text-muted-50 text-xs">
                            Evaluation of high-risk/high-reward plays and their success likelihood
                          </CardDescription>
                        </CardHeader>
                        <CardContent>
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            {aiResult.strategic_analytics.risk_reward_analysis.slice(0, 6).map((analysis, i) => (
                              <div
                                key={i}
                                className="bg-cyb-800/40 p-4 border border-cyan-500/20 hover:border-cyan-500/40 transition-colors"
                              >
                                <div className="space-y-3">
                                  {/* Play Name */}
                                  <h4 className="text-sm font-semibold text-white break-words leading-tight">
                                    {analysis.play}
                                  </h4>

                                  {/* Metrics Grid */}
                                  <div className="grid grid-cols-3 gap-2">
                                    {/* Risk Level */}
                                    <div className="space-y-1">
                                      <div className="text-xs text-muted-50/70">Risk</div>
                                      <Badge
                                        variant="outline"
                                        className={`w-full justify-center text-xs capitalize ${
                                          analysis.risk_level === "high"
                                            ? "border-red-500/50 text-red-400 bg-red-500/10"
                                            : analysis.risk_level === "medium"
                                            ? "border-yellow-500/50 text-yellow-400 bg-yellow-500/10"
                                            : "border-slate-500/50 text-muted-50/70 bg-slate-500/10"
                                        }`}
                                      >
                                        {analysis.risk_level}
                                      </Badge>
                                    </div>

                                    {/* Reward Potential */}
                                    <div className="space-y-1">
                                      <div className="text-xs text-muted-50/70">Reward</div>
                                      <Badge
                                        variant="outline"
                                        className={`w-full justify-center text-xs capitalize ${
                                          analysis.reward_potential === "high"
                                            ? "border-green-500/50 text-green-400 bg-green-500/10"
                                            : analysis.reward_potential === "medium"
                                            ? "border-yellow-500/50 text-yellow-400 bg-yellow-500/10"
                                            : "border-slate-500/50 text-muted-50/70 bg-slate-500/10"
                                        }`}
                                      >
                                        {analysis.reward_potential}
                                      </Badge>
                                    </div>

                                    {/* Success Rate */}
                                    <div className="space-y-1">
                                      <div className="text-xs text-muted-50/70">Success</div>
                                      <div className="text-sm font-bold text-accent-cyan text-center">
                                        {analysis.success_rate}%
                                      </div>
                                    </div>
                                  </div>

                                  {/* Description */}
                                  <p className="text-xs text-muted-50/70 break-words leading-relaxed">
                                    {analysis.description}
                                  </p>
                                </div>
                              </div>
                            ))}
                          </div>
                        </CardContent>
                      </Card>
                    )}
                  </div>
                )}

              </div>
            ) : (
              <Card className="bg-gradient-to-b from-cyan-400/20 via-cyan-500/15 to-cyan-600/5 backdrop-blur-md border border-accent-cyan/18">
                <CardContent className="pt-12 pb-12">
                  <div className="text-center text-muted-50/70">
                    <Zap className="h-12 w-12 mx-auto mb-4 text-accent-cyan/50" />
                    <p>Select decks and run an AI test to see results</p>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Loading overlay */}
          {simulationLoading && (
              <div className="absolute inset-0 flex items-center justify-center bg-slate-950/80 backdrop-blur-sm z-10 pointer-events-none">
                <div className="flex flex-col items-center gap-3">
                  <Loader2 className="h-8 w-8 animate-spin text-accent-cyan" />
                  <div className="text-accent-cyan/90 font-medium">
                    {testType === "duel_simulation"
                      ? `Simulating ${numSimulations} duels...`
                      : "Analyzing matchup..."}
                  </div>
              </div>
            </div>
          )}
        </div>
      </div>
      </div>
    </div>
  );
}
