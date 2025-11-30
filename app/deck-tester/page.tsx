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
    <div className="min-h-screen bg-slate-950 px-8 pt-8 pb-10">
      <div className="max-w-7xl mx-auto">
        <div className="flex flex-col md:flex-row gap-8">
          {/* ==== Filter Panel ==== */}
          <Card className="w-full md:w-80 shrink-0 bg-gradient-to-b from-cyan-400/20 via-cyan-500/15 to-cyan-600/5 backdrop-blur-md border border-cyan-500/30 rounded-2xl">
            <CardHeader>
              <CardTitle className="text-slate-50" style={{ fontFamily: "var(--font-heading)" }}>
                AI Testing Setup
              </CardTitle>
              <CardDescription className="text-slate-300">
                Pick format, decks and test type for AI-powered analysis.
              </CardDescription>
            </CardHeader>
          <CardContent className="space-y-4">
            {/* Mode Buttons */}
            <div className="flex items-center gap-2">
              <div
                ref={containerRef}
                className="relative flex w-fit rounded-full bg-slate-900/60 border border-cyan-500/30 backdrop-blur-sm"
              >
                <span
                  className="absolute top-0 bottom-0 rounded-full transition-all duration-200 bg-cyan-500/40"
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
                    className={`relative z-10 px-4 py-1 font-semibold rounded-full transition-colors duration-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400/60
                    ${deckMode === mode ? "text-cyan-100" : "text-slate-300"}`}
                    aria-pressed={deckMode === mode}
                    style={{ background: "transparent", position: "relative" }}
                  >
                    {mode}
                  </button>
                ))}
              </div>
            </div>

              {/* Test Type Selector */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="block font-medium text-cyan-300">Test Type</label>
                  <Dialog open={infoModalOpen} onOpenChange={setInfoModalOpen}>
                    <DialogTrigger asChild>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-5 w-5 text-cyan-400 hover:text-cyan-300 hover:bg-cyan-500/20"
                      >
                        <Info className="h-4 w-4" />
                      </Button>
                    </DialogTrigger>
                    <DialogContent className="bg-gradient-to-b from-cyan-400/20 via-cyan-500/15 to-cyan-600/5 backdrop-blur-md border border-cyan-500/30 text-slate-50 max-w-2xl">
                      <DialogHeader>
                        <DialogTitle className="text-cyan-100" style={{ fontFamily: "var(--font-heading)" }}>
                          Test Type Information
                        </DialogTitle>
                        <DialogDescription className="text-slate-300">
                          Learn about what each test type analyzes and provides.
                        </DialogDescription>
                      </DialogHeader>
                      <div className="space-y-6 mt-4">
                        {/* Matchup Analysis */}
                        <div className="space-y-2">
                          <h3 className="text-lg font-semibold text-cyan-300 flex items-center gap-2">
                            <Target className="h-5 w-5" />
                            Matchup Analysis
                          </h3>
                          <p className="text-sm text-slate-300">
                            Provides comprehensive matchup assessment between two decks, including:
                          </p>
                          <ul className="list-disc list-inside text-sm text-slate-400 space-y-1 ml-2">
                            <li>Win rate estimates (going first, going second, overall)</li>
                            <li>Card effectiveness analysis - which cards are most impactful</li>
                            <li>Matchup strengths and weaknesses against different archetypes</li>
                            <li>Side deck impact (TCG only) - side deck cards that improve the matchup</li>
                            <li>Resource usage metrics - draw consistency, depletion rate, recovery success</li>
                          </ul>
                        </div>

                        {/* Duel Simulation */}
                        <div className="space-y-2">
                          <h3 className="text-lg font-semibold text-cyan-300 flex items-center gap-2">
                            <Dices className="h-5 w-5" />
                            Duel Simulation
                          </h3>
                          <p className="text-sm text-slate-300">
                            Simulates multiple duels using AI reasoning to provide statistical insights, including:
                          </p>
                          <ul className="list-disc list-inside text-sm text-slate-400 space-y-1 ml-2">
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
                          <h3 className="text-lg font-semibold text-cyan-300 flex items-center gap-2">
                            <Brain className="h-5 w-5" />
                            Strategic Insights
                          </h3>
                          <p className="text-sm text-slate-300">
                            Offers detailed strategic guidance and deck optimization recommendations, including:
                          </p>
                          <ul className="list-disc list-inside text-sm text-slate-400 space-y-1 ml-2">
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
                  <SelectTrigger className="bg-slate-950/60 border-cyan-500/50 text-slate-50 focus:ring-cyan-400/60">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="bg-gradient-to-b from-cyan-400/20 via-cyan-500/15 to-cyan-600/5 backdrop-blur-md border border-cyan-500/30">
                    <SelectItem value="matchup_analysis" className="text-slate-50 focus:bg-cyan-500/40 focus:text-cyan-100">
                      Matchup Analysis
                    </SelectItem>
                    <SelectItem value="duel_simulation" className="text-slate-50 focus:bg-cyan-500/40 focus:text-cyan-100">
                      Duel Simulation
                    </SelectItem>
                    <SelectItem value="strategic_insights" className="text-slate-50 focus:bg-cyan-500/40 focus:text-cyan-100">
                      Strategic Insights
                    </SelectItem>
                  </SelectContent>
                </Select>
              </div>

            {/* User Deck */}
            <div>
              <label className="block mb-2 font-medium text-cyan-300">Your Deck</label>
              <Select
                value={selectedDeckId || ""}
                onValueChange={setSelectedDeckId}
              >
                <SelectTrigger className="bg-slate-950/60 border-cyan-500/50 text-slate-50 focus:ring-cyan-400/60">
                  <SelectValue
                    placeholder={
                      decks.length === 0 ? "No decks" : "Choose your deck"
                    }
                  />
                </SelectTrigger>
                <SelectContent className="bg-gradient-to-b from-cyan-400/20 via-cyan-500/15 to-cyan-600/5 backdrop-blur-md border border-cyan-500/30">
                  {decks.map((deck) => (
                    <SelectItem key={deck.id} value={deck.id} className="text-slate-50 focus:bg-cyan-500/40 focus:text-cyan-100">
                      {deck.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Opponent Deck */}
            <div>
              <label className="block mb-2 font-medium text-cyan-300">Opponent Deck</label>
              <Select
                value={opponentDeckId || ""}
                onValueChange={setOpponentDeckId}
              >
                <SelectTrigger className="bg-slate-950/60 border-cyan-500/50 text-slate-50 focus:ring-cyan-400/60">
                  <SelectValue
                    placeholder={
                      opponentDecks.length === 0
                        ? "No meta decks"
                        : "Choose opponent deck"
                    }
                  />
                </SelectTrigger>
                <SelectContent className="bg-gradient-to-b from-cyan-400/20 via-cyan-500/15 to-cyan-600/5 backdrop-blur-md border border-cyan-500/30">
                  <div className="font-bold px-2 py-1 text-cyan-300">Meta Decks</div>
                  {opponentDecks.map((deck) => (
                    <SelectItem key={deck.id} value={deck.id} className="text-slate-50 focus:bg-cyan-500/40 focus:text-cyan-100">
                      {deck.name}
                    </SelectItem>
                  ))}
                  <SelectItem disabled value="divider" className="text-slate-400">
                    ----
                  </SelectItem>
                  <div className="font-bold px-2 py-1 text-cyan-300">Your Decks</div>
                  {decks.map((deck) => (
                    <SelectItem key={deck.id + "-op"} value={deck.id} className="text-slate-50 focus:bg-cyan-500/40 focus:text-cyan-100">
                      Your: {deck.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

              {/* Simulation Config (only for duel_simulation) */}
              {testType === "duel_simulation" && (
            <div>
              <label className="block mb-2 font-medium text-cyan-300">
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
                className="w-32 bg-slate-950/60 border-cyan-500/50 text-slate-50 placeholder:text-slate-400 focus-visible:border-cyan-400 focus-visible:ring-cyan-400/60"
                    disabled={simulationLoading}
                  />
                </div>
              )}

              {/* Context Input */}
              <div>
                <label className="block mb-2 font-medium text-cyan-300">
                  Additional Context (Optional)
                </label>
                <Input
                  type="text"
                  value={context}
                  onChange={(e) => setContext(e.target.value)}
                  placeholder="e.g., going first, specific scenario..."
                  className="bg-slate-950/60 border-cyan-500/50 text-slate-50 placeholder:text-slate-400 focus-visible:border-cyan-400 focus-visible:ring-cyan-400/60"
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
                <p className="text-xs text-slate-400 text-center">
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
              <Card className="mb-4 bg-gradient-to-b from-cyan-400/20 via-cyan-500/15 to-cyan-600/5 backdrop-blur-md border border-cyan-500/30 rounded-2xl">
                <CardContent className="pt-6">
                  <div className="space-y-2">
                    <div className="flex items-center justify-between text-xs">
                      <div className="flex items-center gap-2">
                        <Zap className="h-3.5 w-3.5 text-cyan-400" />
                        <span className="text-slate-300 font-medium">Token Usage</span>
                        {isCached && (
                          <Badge variant="outline" className="text-xs text-green-400 border-green-500/50">
                            Cached
                          </Badge>
                        )}
                      </div>
                      <div className="flex items-center gap-2 text-slate-400">
                        <span className="font-semibold text-cyan-400 tabular-nums">
                          {aiResult.estimated_cost.tokens_used.toLocaleString()}
                        </span>
                        <span className="text-slate-500">/</span>
                        <span className="tabular-nums">{MAX_TOKENS_REFERENCE.toLocaleString()}</span>
                        {aiResult.estimated_cost.cost_usd > 0 && (
                          <>
                            <span className="text-slate-500">•</span>
                            <span className="text-slate-300">${aiResult.estimated_cost.cost_usd.toFixed(4)}</span>
                          </>
                        )}
                      </div>
                    </div>
                    <Progress value={tokenUsagePercent} className="h-2 bg-slate-900/60" />
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
            <Card className="bg-gradient-to-b from-cyan-400/20 via-cyan-500/15 to-cyan-600/5 backdrop-blur-md border border-cyan-500/30 rounded-2xl">
              <CardHeader>
                        <CardTitle className="text-slate-50 text-base" style={{ fontFamily: "var(--font-heading)" }}>
                          Win Rate Estimates
                        </CardTitle>
              </CardHeader>
                      <CardContent className="space-y-3">
                        <div className="space-y-2">
                          <div className="flex justify-between items-center">
                            <span className="text-xs text-slate-400">Going First</span>
                            <span className="text-sm font-semibold text-cyan-400">
                              {aiResult.matchup_analytics.win_rate_estimates.going_first.toFixed(1)}%
                            </span>
                          </div>
                          <div className="flex justify-between items-center">
                            <span className="text-xs text-slate-400">Going Second</span>
                            <span className="text-sm font-semibold text-cyan-400">
                              {aiResult.matchup_analytics.win_rate_estimates.going_second.toFixed(1)}%
                            </span>
                          </div>
                          <div className="flex justify-between items-center pt-2 border-t border-cyan-500/20">
                            <span className="text-xs font-medium text-slate-300">Overall</span>
                            <span className="text-base font-bold text-cyan-300">
                              {aiResult.matchup_analytics.win_rate_estimates.overall.toFixed(1)}%
                            </span>
                          </div>
                        </div>
                      </CardContent>
                    </Card>

                    {/* Card Effectiveness */}
                    {aiResult.matchup_analytics.card_effectiveness.length > 0 && (
                      <Card className="bg-gradient-to-b from-cyan-400/20 via-cyan-500/15 to-cyan-600/5 backdrop-blur-md border border-cyan-500/30 rounded-2xl">
                        <CardHeader>
                          <CardTitle className="text-slate-50 text-base" style={{ fontFamily: "var(--font-heading)" }}>
                            Card Effectiveness
                          </CardTitle>
                        </CardHeader>
                        <CardContent>
                          <ScrollArea className="h-[200px]">
                            <div className="space-y-2 pr-4">
                              {aiResult.matchup_analytics.card_effectiveness.slice(0, 5).map((card, i) => (
                                <div key={i} className="bg-slate-900/60 rounded-lg p-2 border border-cyan-500/20">
                                  <div className="flex items-center justify-between mb-1 gap-2">
                                    <span className="text-xs font-semibold text-slate-50 break-words">{card.card_name || "Unknown Card"}</span>
                                    <Badge variant="outline" className="text-xs shrink-0">
                                      {card.impact_score}%
                                    </Badge>
                                  </div>
                                  <p className="text-xs text-slate-400 break-words">{card.description}</p>
                                </div>
                              ))}
                            </div>
                          </ScrollArea>
                        </CardContent>
                      </Card>
                    )}

                    {/* Matchup Strengths & Weaknesses */}
                    <Card className="bg-gradient-to-b from-cyan-400/20 via-cyan-500/15 to-cyan-600/5 backdrop-blur-md border border-cyan-500/30 rounded-2xl md:col-span-2 lg:col-span-1">
                      <CardHeader>
                        <CardTitle className="text-slate-50 text-base" style={{ fontFamily: "var(--font-heading)" }}>
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
                                      <p className="text-xs text-slate-400">{matchup.reason}</p>
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
                                      <p className="text-xs text-slate-400">{matchup.reason}</p>
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
                      <Card className="bg-gradient-to-b from-cyan-400/20 via-cyan-500/15 to-cyan-600/5 backdrop-blur-md border border-cyan-500/30 rounded-2xl">
                        <CardHeader>
                          <CardTitle className="text-slate-50 text-base" style={{ fontFamily: "var(--font-heading)" }}>
                            Side Deck Impact
                          </CardTitle>
                        </CardHeader>
                        <CardContent>
                          <ScrollArea className="h-[200px]">
                            <div className="space-y-2 pr-4">
                              {aiResult.matchup_analytics.side_deck_impact.slice(0, 5).map((card, i) => (
                                <div key={i} className="bg-slate-900/60 rounded-lg p-2 border border-cyan-500/20">
                                  <div className="flex items-center justify-between mb-1">
                                    <span className="text-xs font-semibold text-slate-50 break-words">{card.card_name || "Unknown Card"}</span>
                                    <Badge variant="outline" className="text-xs text-green-400 shrink-0 ml-2">
                                      +{card.matchup_improvement}%
                                    </Badge>
                                  </div>
                                  <p className="text-xs text-slate-400 break-words">{card.description}</p>
                                </div>
                              ))}
                            </div>
                          </ScrollArea>
                        </CardContent>
                      </Card>
                    )}

                    {/* Resource Usage */}
                    {aiResult.matchup_analytics.resource_usage && (
                      <Card className="bg-gradient-to-b from-cyan-400/20 via-cyan-500/15 to-cyan-600/5 backdrop-blur-md border border-cyan-500/30 rounded-2xl">
                        <CardHeader>
                          <CardTitle className="text-slate-50 text-base" style={{ fontFamily: "var(--font-heading)" }}>
                            Resource Usage
                          </CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-3">
                          <div className="space-y-2">
                            <div className="flex justify-between items-center">
                              <span className="text-xs text-slate-400">Draw Consistency</span>
                              <span className="text-sm font-semibold text-cyan-400">
                                {aiResult.matchup_analytics.resource_usage.draw_consistency.toFixed(0)}%
                              </span>
                            </div>
                            <div className="flex justify-between items-center">
                              <span className="text-xs text-slate-400">Depletion Rate</span>
                              <Badge variant="outline" className="text-xs capitalize">
                                {aiResult.matchup_analytics.resource_usage.resource_depletion_rate}
                              </Badge>
                            </div>
                            <div className="flex justify-between items-center">
                              <span className="text-xs text-slate-400">Recovery Success</span>
                              <span className="text-sm font-semibold text-cyan-400">
                                {aiResult.matchup_analytics.resource_usage.recovery_success_rate.toFixed(0)}%
                              </span>
                            </div>
                          </div>
                          <p className="text-xs text-slate-400 pt-2 border-t border-cyan-500/20 break-words">
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
                    <Card className="bg-gradient-to-b from-cyan-400/20 via-cyan-500/15 to-cyan-600/5 backdrop-blur-md border border-cyan-500/30 rounded-2xl">
                      <CardHeader>
                        <CardTitle className="text-slate-50 text-base" style={{ fontFamily: "var(--font-heading)" }}>
                          Simulation Stats
                        </CardTitle>
                      </CardHeader>
                      <CardContent className="space-y-3">
                        <div className="grid grid-cols-3 gap-2">
                          <div className="bg-slate-900/60 rounded-lg p-2 border border-cyan-500/20 text-center">
                            <div className="text-xs text-slate-400 mb-0.5">Wins</div>
                            <div className="text-xl font-bold text-green-400">
                              {aiResult.simulation_analytics.wins_deck_a}
                            </div>
                          </div>
                          <div className="bg-slate-900/60 rounded-lg p-2 border border-cyan-500/20 text-center">
                            <div className="text-xs text-slate-400 mb-0.5">Losses</div>
                            <div className="text-xl font-bold text-red-400">
                              {aiResult.simulation_analytics.wins_deck_b}
                            </div>
                          </div>
                          <div className="bg-slate-900/60 rounded-lg p-2 border border-cyan-500/20 text-center">
                            <div className="text-xs text-slate-400 mb-0.5">Draws</div>
                            <div className="text-xl font-bold text-slate-400">
                              {aiResult.simulation_analytics.draws}
                            </div>
                          </div>
                        </div>
                        <div className="bg-slate-900/60 rounded-lg p-3 border border-cyan-500/20">
                          <div className="text-xs text-slate-400 mb-1">Avg Turn Length</div>
                          <div className="text-2xl font-bold text-cyan-400">
                            {aiResult.simulation_analytics.avg_turn_length.toFixed(1)}
                          </div>
                        </div>
                      </CardContent>
                    </Card>

                    {/* Game Duration Stats */}
                    {aiResult.simulation_analytics.game_duration_stats && (
                      <Card className="bg-gradient-to-b from-cyan-400/20 via-cyan-500/15 to-cyan-600/5 backdrop-blur-md border border-cyan-500/30 rounded-2xl">
                        <CardHeader>
                          <CardTitle className="text-slate-50 text-base" style={{ fontFamily: "var(--font-heading)" }}>
                            Game Duration
                          </CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-2">
                          <div className="flex justify-between items-center">
                            <span className="text-xs text-slate-400">Fastest Win</span>
                            <span className="text-sm font-semibold text-green-400">
                              {aiResult.simulation_analytics.game_duration_stats.fastest_win} turns
                            </span>
                          </div>
                          <div className="flex justify-between items-center">
                            <span className="text-xs text-slate-400">Slowest Win</span>
                            <span className="text-sm font-semibold text-orange-400">
                              {aiResult.simulation_analytics.game_duration_stats.slowest_win} turns
                            </span>
                          </div>
                          <div className="flex justify-between items-center pt-2 border-t border-cyan-500/20">
                            <span className="text-xs font-medium text-slate-300">Average</span>
                            <span className="text-base font-bold text-cyan-300">
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
                      <Card className="bg-gradient-to-b from-cyan-400/20 via-cyan-500/15 to-cyan-600/5 backdrop-blur-md border border-cyan-500/30 rounded-2xl">
                        <CardHeader>
                          <CardTitle className="text-slate-50 text-base" style={{ fontFamily: "var(--font-heading)" }}>
                            Combo Success Rates
                          </CardTitle>
                        </CardHeader>
                        <CardContent>
                          <ScrollArea className="h-[200px]">
                            <div className="space-y-2 pr-4">
                              {aiResult.simulation_analytics.combo_success_rates.slice(0, 5).map((combo, i) => (
                                <div key={i} className="bg-slate-900/60 rounded-lg p-2 border border-cyan-500/20">
                                  <div className="flex items-center justify-between mb-1 gap-2">
                                    <span className="text-xs font-semibold text-slate-50 break-words">{combo.combo_name}</span>
                                    <Badge variant="outline" className="text-xs shrink-0">
                                      {combo.success_rate}%
                                    </Badge>
                                  </div>
                                  <p className="text-xs text-slate-400 break-words">{combo.description}</p>
                                </div>
                              ))}
                            </div>
                          </ScrollArea>
                        </CardContent>
                      </Card>
                    )}

                    {/* Decision Points */}
                    {aiResult.simulation_analytics.decision_points.length > 0 && (
                      <Card className="bg-gradient-to-b from-cyan-400/20 via-cyan-500/15 to-cyan-600/5 backdrop-blur-md border border-cyan-500/30 rounded-2xl md:col-span-2 lg:col-span-1">
                        <CardHeader>
                          <CardTitle className="text-slate-50 text-base" style={{ fontFamily: "var(--font-heading)" }}>
                            Decision Points
                          </CardTitle>
                        </CardHeader>
                        <CardContent>
                          <ScrollArea className="h-[200px]">
                            <div className="space-y-2 pr-4">
                              {aiResult.simulation_analytics.decision_points.slice(0, 5).map((decision, i) => (
                                <div key={i} className="bg-slate-900/60 rounded-lg p-2 border border-cyan-500/20">
                                  <div className="flex items-center justify-between mb-1 gap-2">
                                    <span className="text-xs font-medium text-slate-300">Turn {decision.turn}</span>
                                    <Badge
                                      variant="outline"
                                      className={`text-xs shrink-0 capitalize ${
                                        decision.impact === "high"
                                          ? "border-red-500/50 text-red-400"
                                          : decision.impact === "medium"
                                          ? "border-yellow-500/50 text-yellow-400"
                                          : "border-slate-500/50 text-slate-400"
                                      }`}
                                    >
                                      {decision.impact}
                                    </Badge>
                                  </div>
                                  <p className="text-xs text-slate-50 font-medium mb-0.5 break-words">{decision.decision}</p>
                                  <p className="text-xs text-slate-400 break-words">{decision.outcome}</p>
                                </div>
                              ))}
                            </div>
                          </ScrollArea>
                        </CardContent>
                      </Card>
                    )}

                    {/* Damage Trends */}
                    {aiResult.simulation_analytics.damage_trends && (
                      <Card className="bg-gradient-to-b from-cyan-400/20 via-cyan-500/15 to-cyan-600/5 backdrop-blur-md border border-cyan-500/30 rounded-2xl">
                        <CardHeader>
                          <CardTitle className="text-slate-50 text-base" style={{ fontFamily: "var(--font-heading)" }}>
                            Damage Trends
                          </CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-2">
                          <div className="flex justify-between items-center">
                            <span className="text-xs text-slate-400">Avg Damage/Turn</span>
                            <span className="text-sm font-semibold text-cyan-400">
                              {aiResult.simulation_analytics.damage_trends.avg_damage_per_turn.toFixed(0)}
                            </span>
                          </div>
                          <div className="flex justify-between items-center">
                            <span className="text-xs text-slate-400">Peak Damage Turn</span>
                            <span className="text-sm font-semibold text-orange-400">
                              Turn {aiResult.simulation_analytics.damage_trends.peak_damage_turn}
                            </span>
                          </div>
                          <div className="flex justify-between items-center">
                            <span className="text-xs text-slate-400">Consistency</span>
                            <span className="text-sm font-semibold text-cyan-400">
                              {aiResult.simulation_analytics.damage_trends.damage_consistency.toFixed(0)}%
                            </span>
                          </div>
                          <p className="text-xs text-slate-400 pt-2 border-t border-cyan-500/20 break-words">
                            {aiResult.simulation_analytics.damage_trends.description}
                          </p>
              </CardContent>
            </Card>
                    )}

                    {/* Common Outcomes */}
                    {aiResult.simulation_analytics.common_outcomes.length > 0 && (
                      <Card className="bg-gradient-to-b from-cyan-400/20 via-cyan-500/15 to-cyan-600/5 backdrop-blur-md border border-cyan-500/30 rounded-2xl md:col-span-2">
                        <CardHeader>
                          <CardTitle className="text-slate-50 text-base" style={{ fontFamily: "var(--font-heading)" }}>
                            Common Outcomes
                          </CardTitle>
                        </CardHeader>
                        <CardContent>
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                            {aiResult.simulation_analytics.common_outcomes.map((outcome, i) => (
                              <div
                                key={i}
                                className="bg-slate-900/60 rounded-lg p-3 border border-cyan-500/20"
                              >
                                <div className="flex items-center justify-between mb-1 gap-2">
                                  <span className="text-sm font-semibold text-slate-50 break-words capitalize">{outcome.outcome}</span>
                                  <Badge variant="outline" className="text-xs shrink-0">
                                    {outcome.frequency} times
                                  </Badge>
                                </div>
                                <p className="text-xs text-slate-400 break-words">{outcome.explanation}</p>
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
            <Card className="bg-gradient-to-b from-cyan-400/20 via-cyan-500/15 to-cyan-600/5 backdrop-blur-md border border-cyan-500/30 rounded-2xl">
              <CardHeader>
                          <CardTitle className="text-slate-50 text-base" style={{ fontFamily: "var(--font-heading)" }}>
                            Key Card Synergies
                          </CardTitle>
              </CardHeader>
                        <CardContent>
                          <ScrollArea className="h-[250px]">
                            <div className="space-y-2 pr-4">
                              {aiResult.strategic_analytics.key_card_synergies.slice(0, 5).map((synergy, i) => (
                                <div key={i} className="bg-slate-900/60 rounded-lg p-2 border border-cyan-500/20">
                                  <div className="flex items-center justify-between mb-1 gap-2">
                                    <span className="text-xs font-semibold text-slate-50 break-words">
                                      {synergy.card_a || "Unknown"} + {synergy.card_b || "Unknown"}
                                    </span>
                                    <Badge variant="outline" className="text-xs text-green-400 shrink-0">
                                      {synergy.synergy_score}%
                                    </Badge>
                                  </div>
                                  <p className="text-xs text-slate-400 break-words">{synergy.description}</p>
                                </div>
                              ))}
                            </div>
                          </ScrollArea>
                        </CardContent>
                      </Card>
                    )}

                    {/* Vulnerabilities & Counters */}
                    {aiResult.strategic_analytics.vulnerabilities.length > 0 && (
                      <Card className="bg-gradient-to-b from-cyan-400/20 via-cyan-500/15 to-cyan-600/5 backdrop-blur-md border border-cyan-500/30 rounded-2xl">
                        <CardHeader>
                          <CardTitle className="text-slate-50 text-base" style={{ fontFamily: "var(--font-heading)" }}>
                            Vulnerabilities & Counters
                          </CardTitle>
                        </CardHeader>
                        <CardContent>
                          <ScrollArea className="h-[250px]">
                            <div className="space-y-2 pr-4">
                              {aiResult.strategic_analytics.vulnerabilities.slice(0, 5).map((vuln, i) => (
                                <div key={i} className="bg-red-500/10 rounded-lg p-2 border border-red-500/20">
                                  <div className="flex items-center justify-between mb-1 gap-2">
                                    <span className="text-xs font-semibold text-red-300 break-words capitalize">{vuln.weakness}</span>
                                    <Badge
                                      variant="outline"
                                      className={`text-xs shrink-0 capitalize ${
                                        vuln.exploitability_level === "high"
                                          ? "border-red-500/50 text-red-400"
                                          : vuln.exploitability_level === "medium"
                                          ? "border-yellow-500/50 text-yellow-400"
                                          : "border-slate-500/50 text-slate-400"
                                      }`}
                                    >
                                      {vuln.exploitability_level}
                                    </Badge>
                                  </div>
                                  {vuln.countermeasures.length > 0 && (
                                    <p className="text-xs text-slate-400 mb-1 break-words">Countermeasures:</p>
                                  )}
                                  {vuln.countermeasures.length > 0 && (
                                    <ul className="list-disc list-inside text-xs text-slate-300 space-y-0.5">
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
                      <Card className="bg-gradient-to-b from-cyan-400/20 via-cyan-500/15 to-cyan-600/5 backdrop-blur-md border border-cyan-500/30 rounded-2xl">
                        <CardHeader>
                          <CardTitle className="text-slate-50 text-base" style={{ fontFamily: "var(--font-heading)" }}>
                            Playstyle Profile
                          </CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-3">
                          <div>
                            <Badge variant="outline" className="text-sm py-1.5 w-full justify-center capitalize">
                              {aiResult.strategic_analytics.playstyle_profile.primary_style}
                            </Badge>
                            <div className="text-xs text-slate-400 mt-1 text-center">
                              Confidence: {aiResult.strategic_analytics.playstyle_profile.style_confidence}%
                            </div>
                          </div>
                          <p className="text-xs text-slate-300 break-words">{aiResult.strategic_analytics.playstyle_profile.description}</p>
                          {aiResult.strategic_analytics.playstyle_profile.evidence.length > 0 && (
                            <div>
                              <div className="text-xs font-semibold text-cyan-400 mb-1">Evidence:</div>
                              <ul className="list-disc list-inside text-xs text-slate-400 space-y-0.5">
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
                      <Card className="bg-gradient-to-b from-cyan-400/20 via-cyan-500/15 to-cyan-600/5 backdrop-blur-md border border-cyan-500/30 rounded-2xl md:col-span-2">
                        <CardHeader>
                          <CardTitle className="text-slate-50 text-base" style={{ fontFamily: "var(--font-heading)" }}>
                            Meta Adaptation
                          </CardTitle>
                        </CardHeader>
                        <CardContent>
                          <div className="space-y-3">
                            <div className="flex items-center justify-between">
                              <span className="text-xs text-slate-400">Current Meta Fit</span>
                              <span className="text-lg font-bold text-cyan-400">
                                {aiResult.strategic_analytics.meta_adaptation.current_meta_fit.toFixed(0)}%
                            </span>
                            </div>
                            {aiResult.strategic_analytics.meta_adaptation.recommended_changes.length > 0 && (
                              <div>
                                <div className="text-xs font-semibold text-cyan-400 mb-2">Recommended Changes:</div>
                                <div className="space-y-2">
                                  {aiResult.strategic_analytics.meta_adaptation.recommended_changes.slice(0, 3).map((change, i) => (
                                    <div key={i} className="bg-slate-900/60 rounded-lg p-2 border border-cyan-500/20">
                                      <div className="flex items-center justify-between mb-1 gap-2">
                                        <span className="text-xs font-medium text-slate-50 break-words">
                                          {change.card_to_add && `Add: ${change.card_to_add}`}
                                          {change.card_to_remove && `Remove: ${change.card_to_remove}`}
                                        </span>
                                        <Badge variant="outline" className="text-xs text-green-400 shrink-0">
                                          +{change.expected_improvement}%
                                        </Badge>
                                      </div>
                                      <p className="text-xs text-slate-400 break-words">{change.reason}</p>
                                    </div>
                                  ))}
                                </div>
                  </div>
                )}
                            {aiResult.strategic_analytics.meta_adaptation.meta_trends.length > 0 && (
                              <div>
                                <div className="text-xs font-semibold text-cyan-400 mb-1">Meta Trends:</div>
                                <ul className="list-disc list-inside text-xs text-slate-400 space-y-0.5">
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
                      <Card className="bg-gradient-to-b from-cyan-400/20 via-cyan-500/15 to-cyan-600/5 backdrop-blur-md border border-cyan-500/30 rounded-2xl md:col-span-2 lg:col-span-3">
                        <CardHeader>
                          <CardTitle className="text-slate-50 text-base" style={{ fontFamily: "var(--font-heading)" }}>
                            Risk vs Reward Analysis
                          </CardTitle>
                          <CardDescription className="text-slate-300 text-xs">
                            Evaluation of high-risk/high-reward plays and their success likelihood
                          </CardDescription>
                        </CardHeader>
                        <CardContent>
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            {aiResult.strategic_analytics.risk_reward_analysis.slice(0, 6).map((analysis, i) => (
                              <div
                                key={i}
                                className="bg-slate-900/60 rounded-lg p-4 border border-cyan-500/20 hover:border-cyan-500/40 transition-colors"
                              >
                                <div className="space-y-3">
                                  {/* Play Name */}
                                  <h4 className="text-sm font-semibold text-slate-50 break-words leading-tight">
                                    {analysis.play}
                                  </h4>

                                  {/* Metrics Grid */}
                                  <div className="grid grid-cols-3 gap-2">
                                    {/* Risk Level */}
                                    <div className="space-y-1">
                                      <div className="text-xs text-slate-400">Risk</div>
                                      <Badge
                                        variant="outline"
                                        className={`w-full justify-center text-xs capitalize ${
                                          analysis.risk_level === "high"
                                            ? "border-red-500/50 text-red-400 bg-red-500/10"
                                            : analysis.risk_level === "medium"
                                            ? "border-yellow-500/50 text-yellow-400 bg-yellow-500/10"
                                            : "border-slate-500/50 text-slate-400 bg-slate-500/10"
                                        }`}
                                      >
                                        {analysis.risk_level}
                                      </Badge>
                                    </div>

                                    {/* Reward Potential */}
                                    <div className="space-y-1">
                                      <div className="text-xs text-slate-400">Reward</div>
                                      <Badge
                                        variant="outline"
                                        className={`w-full justify-center text-xs capitalize ${
                                          analysis.reward_potential === "high"
                                            ? "border-green-500/50 text-green-400 bg-green-500/10"
                                            : analysis.reward_potential === "medium"
                                            ? "border-yellow-500/50 text-yellow-400 bg-yellow-500/10"
                                            : "border-slate-500/50 text-slate-400 bg-slate-500/10"
                                        }`}
                                      >
                                        {analysis.reward_potential}
                                      </Badge>
                                    </div>

                                    {/* Success Rate */}
                                    <div className="space-y-1">
                                      <div className="text-xs text-slate-400">Success</div>
                                      <div className="text-sm font-bold text-cyan-400 text-center">
                                        {analysis.success_rate}%
                                      </div>
                                    </div>
                                  </div>

                                  {/* Description */}
                                  <p className="text-xs text-slate-400 break-words leading-relaxed">
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
              <Card className="bg-gradient-to-b from-cyan-400/20 via-cyan-500/15 to-cyan-600/5 backdrop-blur-md border border-cyan-500/30 rounded-2xl">
                <CardContent className="pt-12 pb-12">
                  <div className="text-center text-slate-400">
                    <Zap className="h-12 w-12 mx-auto mb-4 text-cyan-400/50" />
                    <p>Select decks and run an AI test to see results</p>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Loading overlay */}
          {simulationLoading && (
              <div className="absolute inset-0 flex items-center justify-center bg-slate-950/80 backdrop-blur-sm z-10 pointer-events-none rounded-2xl">
                <div className="flex flex-col items-center gap-3">
                  <Loader2 className="h-8 w-8 animate-spin text-cyan-400" />
                  <div className="text-cyan-300 font-medium">
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
