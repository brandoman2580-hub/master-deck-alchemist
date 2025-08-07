"use client";

import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
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
import { getMetaDecks, getUserDecks } from "@/lib/supabaseDecks";
import { useUserStore } from "@/store/useUserStore";
import { DeckType } from "@/types/types";

import {
  PieChart,
  Pie,
  Cell,
  Tooltip,
  Legend,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  ResponsiveContainer,
  LineChart,
  Line,
} from "recharts";
import { DECK_MODES, MODE_COLORS } from "@/lib/constants";
import { useModeStore } from "@/store/modeStore";
import { useDeck } from "@/context/deck-context";

const COLORS = ["#8884d8", "#FF8042", "#00C49F", "#FFBB28"];

export default function DeckTester() {
  const [decks, setDecks] = useState<DeckType[]>([]);
  const [opponentDecks, setOpponentDecks] = useState<Partial<DeckType[]>>([]);
  const [loading, setLoading] = useState(false);

  const [selectedDeckId, setSelectedDeckId] = useState<string | null>(null);
  const [opponentDeckId, setOpponentDeckId] = useState<string | null>(null);
  const [numSimulations, setNumSimulations] = useState(100);
  const [simulationLoading, setSimulationLoading] = useState(false);
  const [simulationResult, setSimulationResult] = useState<any>(null);

  const user = useUserStore((state) => state.user);
  const deckMode = useModeStore((state) => state.deckMode);
  const setDeckMode = useModeStore((state) => state.setDeckMode);
  const { updateDeckMode } = useDeck();

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

  useEffect(() => {
    const fetchUserDecks = async () => {
      if (!user) return;
      setLoading(true);
      try {
        const supabaseUserDecks = await getUserDecks(user.id);
        const decks: DeckType[] = supabaseUserDecks.map((deck: any) => ({
          id: deck.id,
          name: deck.name,
          mainDeck: deck.cards.main,
          extraDeck: deck.cards.extra,
          sideDeck: deck.cards.side,
          updated_at: deck.updated_at,
          mode: deck.mode || "Master Duel",
        }));
        setDecks(decks);
      } catch (error) {
        console.error("Failed to fetch decks:", error);
      }
      setLoading(false);
    };
    fetchUserDecks();

    const fetchMetaDecks = async () => {
      if (!user) return;
      setLoading(true);
      try {
        const supabaseMetaDecks = await getMetaDecks();
        const metaDecks: DeckType[] = supabaseMetaDecks.map((deck: any) => ({
          id: deck.id,
          name: deck.name,
          mainDeck: deck.cards.main,
          extraDeck: deck.cards.extra,
          sideDeck: deck.cards.side,
          updated_at: deck.updated_at,
          mode: deck.mode || "Master Duel",
        }));
        setOpponentDecks(metaDecks);
      } catch (error) {
        console.error("Failed to fetch meta decks:", error);
      }
      setLoading(false);
    };
    fetchMetaDecks();
  }, [user]);

  const handleRunSimulation = async () => {
    if (!selectedDeckId || !opponentDeckId || numSimulations < 1) return;

    setSimulationLoading(true);
    setSimulationResult(null);

    setTimeout(() => {
      const winCount = Math.floor(numSimulations * 0.52);
      const lossCount = numSimulations - winCount;
      const winRateData = [
        { name: "Wins", value: winCount },
        { name: "Losses", value: lossCount },
      ];
      const comboData = [
        { combo: "Combo A", frequency: 30 },
        { combo: "Combo B", frequency: 45 },
        { combo: "Combo C", frequency: 25 },
      ];
      const lineChartData = Array.from({ length: 10 }).map((_, i) => ({
        attempt: i + 1,
        winRate: 40 + Math.random() * 20,
      }));
      const heatmapData = [
        { cardA: "Card1", cardB: "Card2", count: 15 },
        { cardA: "Card1", cardB: "Card3", count: 5 },
        { cardA: "Card2", cardB: "Card3", count: 10 },
      ];

      setSimulationResult({
        winRateData,
        comboData,
        lineChartData,
        heatmapData,
        gamesSimulated: numSimulations,
      });
      setSimulationLoading(false);
    }, 1400);
  };

  // EMPTY DATA for placeholder charts
  const emptyPieData = [
    { name: "Wins", value: 0 },
    { name: "Losses", value: 0 },
  ];
  const emptyBarData = [
    { combo: "A", frequency: 0 },
    { combo: "B", frequency: 0 },
  ];
  const emptyLineData = Array.from({ length: 5 }).map((_, i) => ({
    attempt: i + 1,
    winRate: 0,
  }));
  const emptyHeatmapData = [{ cardA: "?", cardB: "?", count: 0 }];

  // Show placeholders before results available
  const chartData = {
    winRateData: simulationResult ? simulationResult.winRateData : emptyPieData,
    comboData: simulationResult ? simulationResult.comboData : emptyBarData,
    lineChartData: simulationResult
      ? simulationResult.lineChartData
      : emptyLineData,
    heatmapData: simulationResult
      ? simulationResult.heatmapData
      : emptyHeatmapData,
  };

  return (
    <div className="container mx-auto px-4 py-8">
      {/* Flex container for Filter Panel + Charts */}
      <div className="flex flex-col md:flex-row gap-8">
        {/* Filter Panel */}
        <Card className="w-full md:w-80 shrink-0">
          <CardHeader>
            <CardTitle>Control Panel</CardTitle>
            <CardDescription>
              Select deck(s) and simulation options.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
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
            <div>
              <label className="block mb-2 font-medium">Your Deck</label>
              <Select
                value={selectedDeckId || ""}
                onValueChange={setSelectedDeckId}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Choose your deck" />
                </SelectTrigger>
                <SelectContent>
                  {decks.map((deck) => (
                    <SelectItem key={deck.id} value={deck.id}>
                      {deck.name} ({deck.mode})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="block mb-2 font-medium">Opponent Deck</label>
              <Select
                value={opponentDeckId || ""}
                onValueChange={setOpponentDeckId}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Choose opponent deck" />
                </SelectTrigger>
                <SelectContent>
                  {opponentDecks.map((deck) => (
                    <SelectItem key={deck?.id} value={deck?.id ?? ""}>
                      {deck?.name} ({deck?.mode})
                    </SelectItem>
                  ))}
                  <SelectItem
                    disabled
                    className="opacity-50 select-none"
                    value="divider"
                  >
                    ----
                  </SelectItem>
                  {decks.map((deck) => (
                    <SelectItem key={deck.id + "-op"} value={deck.id}>
                      Your: {deck.name} ({deck.mode})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="block mb-2 font-medium">
                Number of Simulations
              </label>
              <Input
                type="number"
                min={10}
                max={1000}
                value={numSimulations}
                onChange={(e) => setNumSimulations(Number(e.target.value))}
                className="w-32"
                disabled={simulationLoading}
              />
            </div>
          </CardContent>
          <CardFooter>
            <Button
              onClick={handleRunSimulation}
              disabled={
                simulationLoading ||
                loading ||
                !selectedDeckId ||
                !opponentDeckId
              }
            >
              {simulationLoading ? "Running..." : "Run Test"}
            </Button>
          </CardFooter>
        </Card>
        {/* Charts Grid */}
        <div className="grow flex flex-col">
          <div className="grid grid-cols-1 md:grid-cols-2 grid-rows-2 gap-6 h-full">
            {/* Pie Chart */}
            <Card>
              <CardHeader>
                <CardTitle>Win Rate</CardTitle>
              </CardHeader>
              <CardContent style={{ height: 250 }}>
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={chartData.winRateData}
                      dataKey="value"
                      nameKey="name"
                      cx="50%"
                      cy="50%"
                      outerRadius={80}
                      fill="#8884d8"
                      label
                    >
                      {chartData.winRateData.map((_, index: number) => (
                        <Cell
                          key={`cell-${index}`}
                          fill={COLORS[index % COLORS.length]}
                        />
                      ))}
                    </Pie>
                    <Tooltip />
                    <Legend />
                  </PieChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
            {/* Bar Chart */}
            <Card>
              <CardHeader>
                <CardTitle>Combo Frequency</CardTitle>
              </CardHeader>
              <CardContent style={{ height: 250 }}>
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart
                    data={chartData.comboData}
                    margin={{ top: 20, right: 30, left: 20, bottom: 5 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="combo" />
                    <YAxis />
                    <Tooltip />
                    <Legend />
                    <Bar dataKey="frequency" fill="#82ca9d" />
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
            {/* Line Chart */}
            <Card>
              <CardHeader>
                <CardTitle>Opening Hands Over Time</CardTitle>
              </CardHeader>
              <CardContent style={{ height: 250 }}>
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart
                    data={chartData.lineChartData}
                    margin={{ top: 20, right: 30, left: 0, bottom: 0 }}
                  >
                    <XAxis dataKey="attempt" />
                    <YAxis domain={[0, 100]} />
                    <Line type="monotone" dataKey="winRate" stroke="#8884d8" />
                    <Tooltip />
                  </LineChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
            {/* Heatmap Table (simplified) */}
            <Card>
              <CardHeader>
                <CardTitle>Combo Piece Heatmap (Simplified)</CardTitle>
              </CardHeader>
              <CardContent style={{ height: 250, overflowY: "auto" }}>
                <table className="w-full text-xs table-auto border border-gray-300">
                  <thead>
                    <tr>
                      <th className="border border-gray-300 p-1">Card A</th>
                      <th className="border border-gray-300 p-1">Card B</th>
                      <th className="border border-gray-300 p-1">Count</th>
                    </tr>
                  </thead>
                  <tbody>
                    {chartData.heatmapData.map((entry: any, idx: number) => (
                      <tr key={idx} className="odd:bg-white even:bg-gray-50">
                        <td className="border border-gray-300 p-1">
                          {entry.cardA}
                        </td>
                        <td className="border border-gray-300 p-1">
                          {entry.cardB}
                        </td>
                        <td className="border border-gray-300 p-1 text-center">
                          {entry.count}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </CardContent>
            </Card>
          </div>
          {/* Simulation loading overlay */}
          {simulationLoading && (
            <div className="absolute inset-0 flex items-center justify-center bg-white/60 z-10 pointer-events-none">
              <div className="animate-pulse text-muted-foreground">
                Simulating {numSimulations} games...
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
