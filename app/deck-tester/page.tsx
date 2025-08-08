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
  runDeckSimulation,
  Deck as SimulationDeck,
  SimulationResult,
} from "@/lib/deckTesterMonteCarlo";

// Recharts imports
import {
  PieChart,
  Pie,
  Cell,
  Tooltip as PieTooltip,
  Legend as PieLegend,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip as BarTooltip,
  ResponsiveContainer,
} from "recharts";

import { DECK_MODES, MODE_COLORS } from "@/lib/constants";
import { useModeStore } from "@/store/modeStore";
import { useDeck } from "@/context/deck-context";

const PIE_COLORS = ["#16a34a", "#e11d48", "#737373"];

function formatPercent(value: number, denom: number) {
  return denom > 0 ? `${((value / denom) * 100).toFixed(1)}%` : "0%";
}

const CustomBarTooltip = ({ active, payload }) => {
  if (!active || !payload || payload.length === 0) return null;
  const { metric, value } = payload[0].payload;
  const metricStr = typeof metric === "string" ? metric : String(metric);
  const valueNum =
    typeof value === "number" ? value : parseFloat(value as string);
  const formattedValue = metricStr.toLowerCase().includes("turn")
    ? valueNum.toFixed(1)
    : valueNum.toFixed(1) + "%";

  return (
    <div
      style={{
        background: "#18181b",
        color: "#fff",
        border: "1px solid #52525b",
        borderRadius: 8,
        fontSize: 14,
        padding: "0.7em 1.1em",
        minWidth: 110,
      }}
    >
      <div style={{ color: "#fff", fontWeight: 600 }}>{metricStr}</div>
      <div style={{ color: "#fff", marginTop: 4 }}>{formattedValue}</div>
    </div>
  );
};

export default function DeckTester() {
  const [decks, setDecks] = useState<DeckType[]>([]);
  const [opponentDecks, setOpponentDecks] = useState<DeckType[]>([]);
  const [loading, setLoading] = useState(false);

  const [selectedDeckId, setSelectedDeckId] = useState<string | null>(null);
  const [opponentDeckId, setOpponentDeckId] = useState<string | null>(null);
  const [numSimulations, setNumSimulations] = useState(100);

  const [simulationLoading, setSimulationLoading] = useState(false);
  const [simulationResult, setSimulationResult] =
    useState<SimulationResult | null>(null);

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

  // Util: Convert DeckType to SimulationDeck
  const convertToSimulationDeck = (deck: DeckType): SimulationDeck => ({
    id: deck.id,
    name: deck.name,
    mainDeck: deck.mainDeck.map((card) => ({
      id: card.id.toString(),
      name: card.name,
      isComboPiece:
        card.type === "Effect Monster" ||
        !!card.archetype ||
        card.type === "Spell Card",
    })),
    extraDeck: deck.extraDeck?.map((card) => ({
      id: card.id.toString(),
      name: card.name,
      isComboPiece: true,
    })),
    sideDeck: deck.sideDeck?.map((card) => ({
      id: card.id.toString(),
      name: card.name,
      isComboPiece: false,
    })),
    mode: deck.mode,
  });

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

  // Simulation logic
  const handleRunSimulation = async () => {
    if (!selectedDeckId || !opponentDeckId || numSimulations < 1) return;
    setSimulationLoading(true);
    setSimulationResult(null);

    try {
      const allDecks = [...decks, ...opponentDecks];
      const selectedDeck = allDecks.find((d) => d.id === selectedDeckId);
      const opponentDeck = allDecks.find((d) => d.id === opponentDeckId);
      if (!selectedDeck || !opponentDeck) {
        setSimulationLoading(false);
        return;
      }
      const simDeckA = convertToSimulationDeck(selectedDeck);
      const simDeckB = convertToSimulationDeck(opponentDeck);
      const result = runDeckSimulation(simDeckA, simDeckB, numSimulations);
      setSimulationResult(result);
    } catch (err) {
      alert("Simulation failed.");
    } finally {
      setSimulationLoading(false);
    }
  };

  // ChartData Mappers
  const getChartData = (result: SimulationResult | null) => {
    return {
      pie: [
        { name: "Wins", value: result?.wins || 0 },
        { name: "Losses", value: result?.losses || 0 },
        ...(result && result.draws > 0
          ? [{ name: "Draws", value: result.draws }]
          : []),
      ],
      bar: [
        {
          metric: "First Hand Combo Rate",
          value: result?.firstHandComboRate || 0,
          color: "#16a34a",
        },
        {
          metric: "Opponent Combo Rate",
          value: result?.opponentFirstHandComboRate || 0,
          color: "#22d3ee",
        },
        {
          metric: "Brick Rate",
          value: result?.brickRate || 0,
          color: "#f59e42",
        },
        {
          metric: "Opponent Brick Rate",
          value: result?.opponentBrickRate || 0,
          color: "#fbbf24",
        },
        {
          metric: "Avg Turn Length",
          value: result?.avgTurnLength || 0,
          color: "#6366F1",
        },
      ],
      line:
        result?.topOpeners.map((opener, i) => ({
          attempt: i + 1,
          opener: opener.combo,
          count: opener.count,
        })) || [],
      heatmap: (() => {
        if (!result) return [];
        const pairs: Array<{ cardA: string; cardB: string; count: number }> =
          [];
        for (const [a, obj] of Object.entries(result.synergy || {})) {
          for (const [b, count] of Object.entries(obj)) {
            pairs.push({ cardA: a, cardB: b, count });
          }
        }
        pairs.sort((a, b) => b.count - a.count);
        return pairs.slice(0, 10); // Show top synergy pairs
      })(),
    };
  };

  const chartData = getChartData(simulationResult);

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="flex flex-col md:flex-row gap-8">
        {/* ==== Filter Panel ==== */}
        <Card className="w-full md:w-80 shrink-0">
          <CardHeader>
            <CardTitle>Testing Setup</CardTitle>
            <CardDescription>
              Pick format, decks and simulation settings.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Mode Buttons */}
            <div className="flex items-center gap-2">
              <div
                ref={containerRef}
                className="relative flex w-fit rounded-full bg-zinc-100 shadow-inner"
              >
                <span
                  className={`absolute top-0 bottom-0 rounded-full transition-all ${MODE_COLORS[deckMode]}`}
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
                      setSimulationResult(null);
                    }}
                    className={`relative z-10 px-4 py-1 font-semibold rounded-full transition-colors duration-200 focus:outline-none
                    ${deckMode === mode ? "text-white" : "text-gray-700"}`}
                    aria-pressed={deckMode === mode}
                    style={{ background: "transparent", position: "relative" }}
                  >
                    {mode}
                  </button>
                ))}
              </div>
            </div>
            {/* User Deck */}
            <div>
              <label className="block mb-2 font-medium">Your Deck</label>
              <Select
                value={selectedDeckId || ""}
                onValueChange={setSelectedDeckId}
              >
                <SelectTrigger>
                  <SelectValue
                    placeholder={
                      decks.length === 0 ? "No decks" : "Choose your deck"
                    }
                  />
                </SelectTrigger>
                <SelectContent>
                  {decks.map((deck) => (
                    <SelectItem key={deck.id} value={deck.id}>
                      {deck.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            {/* Opponent Deck */}
            <div>
              <label className="block mb-2 font-medium">Opponent Deck</label>
              <Select
                value={opponentDeckId || ""}
                onValueChange={setOpponentDeckId}
              >
                <SelectTrigger>
                  <SelectValue
                    placeholder={
                      opponentDecks.length === 0
                        ? "No meta decks"
                        : "Choose opponent deck"
                    }
                  />
                </SelectTrigger>
                <SelectContent>
                  <div className="font-bold px-2 py-1">Meta Decks</div>
                  {opponentDecks.map((deck) => (
                    <SelectItem key={deck.id} value={deck.id}>
                      {deck.name}
                    </SelectItem>
                  ))}
                  <SelectItem disabled value="divider">
                    ----
                  </SelectItem>
                  <div className="font-bold px-2 py-1">Your Decks</div>
                  {decks.map((deck) => (
                    <SelectItem key={deck.id + "-op"} value={deck.id}>
                      Your: {deck.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            {/* Simulation Config */}
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
        {/* ==== Chart Grid ==== */}
        <div className="grow flex flex-col">
          <div className="grid grid-cols-1 md:grid-cols-2 grid-rows-2 gap-6 h-full">
            {/* Pie Chart */}
            <Card>
              <CardHeader>
                <CardTitle>Win Rate</CardTitle>
                <CardDescription>
                  Shows win/loss/draw breakdown for your deck in{" "}
                  {numSimulations} duels.
                </CardDescription>
              </CardHeader>
              <CardContent
                style={{ height: 300 /* was 250, increased for space */ }}
              >
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      isAnimationActive={false}
                      data={chartData.pie}
                      dataKey="value"
                      nameKey="name"
                      cx="50%"
                      cy="57%" // move center lower down for label room
                      outerRadius={80} // slightly reduce if still tight
                      label={({ name }) =>
                        `${name}: ${formatPercent(
                          chartData.pie.find((x) => x.name === name)?.value ||
                            0,
                          simulationResult?.gamesSimulated || 1
                        )}`
                      }
                      labelLine={false} // disables spider lines, can help visual clarity
                    >
                      {chartData.pie.map((_, idx) => (
                        <Cell
                          key={idx}
                          fill={PIE_COLORS[idx % PIE_COLORS.length]}
                        />
                      ))}
                    </Pie>
                    <PieTooltip
                      formatter={(val, name) => [
                        `${val} games (${
                          simulationResult
                            ? formatPercent(
                                val as number,
                                simulationResult.gamesSimulated
                              )
                            : "0%"
                        })`,
                        name,
                      ]}
                    />
                    <PieLegend />
                  </PieChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
            {/* Bar Chart */}
            <Card>
              <CardHeader>
                <CardTitle>Key Rates</CardTitle>
                <CardDescription>
                  Combo rates, brick rates, and turn stats.
                </CardDescription>
              </CardHeader>
              <CardContent style={{ height: 300 }}>
                <ResponsiveContainer width="100%" height={210}>
                  <BarChart data={chartData.bar}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#262626" />
                    <XAxis
                      dataKey="metric"
                      tick={{ fill: "#cbd5e1", fontSize: 12 }}
                    />
                    <YAxis tick={{ fill: "#cbd5e1", fontSize: 12 }} />
                    <BarTooltip content={CustomBarTooltip} />
                    <Bar dataKey="value" isAnimationActive={false}>
                      {chartData.bar.map((entry, idx) => (
                        <Cell key={idx} fill={entry.color} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>

                {/* Custom Legend Below Chart */}
                <div className="grid grid-cols-2 gap-x-5 gap-y-2 mt-2 text-xs">
                  {chartData.bar.map((entry, idx) => (
                    <span
                      key={idx}
                      className="flex items-center gap-2 whitespace-nowrap"
                    >
                      <span
                        className="inline-block w-3 h-3 rounded-sm"
                        style={{ background: entry.color }}
                      />
                      <span>{entry.metric}:</span>
                      <span className="ml-1 text-primary-400">
                        {entry.metric.toLowerCase().includes("turn")
                          ? entry.value.toFixed(1)
                          : entry.value.toFixed(1) + "%"}
                      </span>
                    </span>
                  ))}
                </div>
              </CardContent>
            </Card>
            {/* Line Chart */}
            <Card>
              <CardHeader>
                <CardTitle>Top Opening Hands</CardTitle>
                <CardDescription>
                  Most frequent 5-card combinations drawn across simulations.
                  <br />
                  Useful for seeing which combos/lines start your duels.
                </CardDescription>
              </CardHeader>
              <CardContent style={{ height: 300 }}>
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart
                    layout="vertical"
                    data={chartData.line.map((d) => ({
                      combo:
                        d.opener.length > 38
                          ? d.opener.slice(0, 38) + "…"
                          : d.opener,
                      count: d.count,
                      fullCombo: d.opener,
                    }))}
                    margin={{ left: 60, right: 30, top: 10, bottom: 10 }}
                  >
                    <XAxis
                      type="number"
                      dataKey="count"
                      tick={{ fill: "#fff" }}
                    />
                    <YAxis
                      type="category"
                      dataKey="combo"
                      width={105}
                      tick={{ fill: "#fff", fontSize: 11 }}
                    />
                    <BarTooltip
                      contentStyle={{
                        background: "#18181b",
                        color: "#fff",
                        border: "1px solid #52525b",
                        borderRadius: 8,
                        fontSize: 13,
                        maxWidth: 300,
                        whiteSpace: "pre-line",
                      }}
                      formatter={(_, __, { payload }) => [
                        <span key="opener-info">
                          <span className="font-semibold text-green-400">
                            {payload.count} times
                          </span>
                          <br />
                          <span className="text-xs">
                            {payload.fullCombo
                              .split(" | ")
                              .map((card) => card.trim())
                              .join(", ")}
                          </span>
                        </span>,
                        "Opener",
                      ]}
                      labelFormatter={() => ""}
                    />
                    <Bar
                      dataKey="count"
                      fill="#14b8a6"
                      isAnimationActive={false}
                    />
                  </BarChart>
                </ResponsiveContainer>
                <div className="mt-2 text-xs text-zinc-400">
                  Bars show the 10 most common unique opening hands.
                </div>
              </CardContent>
            </Card>

            {/* Synergy Heatmap Table */}
            <Card>
              <CardHeader>
                <CardTitle>Combo Synergy</CardTitle>
                <CardDescription>
                  Most common pairs of combo cards found together in openers.
                </CardDescription>
              </CardHeader>
              <CardContent style={{ height: 250, overflowY: "auto" }}>
                {chartData.heatmap.length > 0 ? (
                  <table className="w-full text-xs">
                    <thead>
                      <tr>
                        <th className="p-1">Card A</th>
                        <th className="p-1">Card B</th>
                        <th className="p-1 text-right"># Together</th>
                      </tr>
                    </thead>
                    <tbody>
                      {chartData.heatmap.map((row, i) => (
                        <tr key={i}>
                          <td className="p-1">{row.cardA}</td>
                          <td className="p-1">{row.cardB}</td>
                          <td className="p-1 text-right">
                            <span
                              className={`px-2 py-0.5 rounded font-bold text-white ${
                                row.count > 10
                                  ? "bg-green-700"
                                  : row.count > 5
                                  ? "bg-yellow-700"
                                  : "bg-zinc-700"
                              }`}
                            >
                              {row.count}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                ) : (
                  <div className="text-sm text-gray-300 text-center mt-8">
                    No combos detected.
                  </div>
                )}
                <div className="mt-1 text-xs text-gray-500">
                  Pairs = both combo pieces in same opener.
                </div>
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
