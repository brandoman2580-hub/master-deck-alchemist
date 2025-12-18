"use client";

import { useState } from "react";
import { getUserDecks, getMetaDecks } from "../../lib/supabaseDecks";
import { useUserStore } from "../../store/useUserStore";
import { openLoginModal } from "../../lib/helpers";
import {
  analyzeMatchup,
  simulateDuels,
  getStrategicInsights,
} from "../../lib/api/deckTesterAgent";
import { DeckTesterAgentResponse } from "../../types/ai-agents";
import { useModeStore } from "../../store/modeStore";
import { TestSetupPanel } from "../../components/deck-tester/test-setup-panel";
import { TokenUsageCard } from "../../components/deck-tester/token-usage-card";
import { ErrorCard } from "../../components/deck-tester/error-card";
import { EmptyState } from "../../components/deck-tester/empty-state";
import { LoadingOverlay } from "../../components/deck-tester/loading-overlay";
import { MatchupAnalytics } from "../../components/deck-tester/matchup-analytics";
import { DuelSimulationAnalytics } from "../../components/deck-tester/duel-simulation-analytics";
import { StrategicInsightsAnalytics } from "../../components/deck-tester/strategic-insights-analytics";
import {
  formatDeck,
  getBanlistFormat,
} from "./utils";

type TestType = "matchup_analysis" | "duel_simulation" | "strategic_insights";

export default function DeckTester() {
  const [simulationLoading, setSimulationLoading] = useState(false);
  const [aiResult, setAiResult] = useState<DeckTesterAgentResponse | null>(
    null,
  );
  const [error, setError] = useState<string | null>(null);
  const [isCached, setIsCached] = useState(false);
  const [currentTestType, setCurrentTestType] = useState<TestType>("matchup_analysis");
  const [currentNumSimulations, setCurrentNumSimulations] = useState(10);

  const user = useUserStore((state) => state.user);
  const deckMode = useModeStore((state) => state.deckMode);

  // AI-powered testing logic
  const handleRunTest = async (config: {
    selectedDeckId: string;
    opponentDeckId: string;
    testType: TestType;
    numSimulations: number;
    context: string;
  }) => {
    if (!user) {
      openLoginModal();
      return;
    }

    setSimulationLoading(true);
    setAiResult(null);
    setError(null);
    setCurrentTestType(config.testType);
    setCurrentNumSimulations(config.numSimulations);

    try {
      // Fetch decks to get the full deck data
      const [userDecks, metaDecks] = await Promise.all([
        getUserDecks(user.id),
        getMetaDecks(),
      ]);
      const allDecks = [
        ...userDecks.map(formatDeck),
        ...metaDecks.map(formatDeck),
      ];
      const selectedDeck = allDecks.find((d) => d.id === config.selectedDeckId);
      const opponentDeck = allDecks.find((d) => d.id === config.opponentDeckId);

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

      const banlistFormat = getBanlistFormat(deckMode);
      let result: DeckTesterAgentResponse;

      if (config.testType === "matchup_analysis") {
        result = await analyzeMatchup({
          deck_a: selectedDeck,
          deck_b: opponentDeck,
          test_type: "matchup_analysis",
          banlist_format: banlistFormat,
          context: config.context || undefined,
        });
      } else if (config.testType === "duel_simulation") {
        result = await simulateDuels({
          deck_a: selectedDeck,
          deck_b: opponentDeck,
          test_type: "duel_simulation",
          num_simulations: Math.min(config.numSimulations, 20),
          banlist_format: banlistFormat,
          context: config.context || undefined,
        });
      } else {
        result = await getStrategicInsights({
          deck_a: selectedDeck,
          deck_b: opponentDeck,
          test_type: "strategic_insights",
          banlist_format: banlistFormat,
          context: config.context || undefined,
        });
      }

      setAiResult(result);
      setIsCached((result as { _cached?: boolean })._cached === true);
    } catch (err: unknown) {
      console.error("Test failed:", err);
      const errorMessage =
        err instanceof Error ? err.message : "Failed to run test. Please try again.";
      setError(errorMessage);
    } finally {
      setSimulationLoading(false);
    }
  };

  const tokenUsagePercent =
    aiResult?.estimated_cost?.tokens_used != null
      ? Math.min((aiResult.estimated_cost.tokens_used / 100000) * 100, 100)
      : 0;

  return (
    <div className="min-h-screen bg-transparent px-4 sm:px-6 lg:px-8 pt-6 sm:pt-8 pb-8 sm:pb-10 relative">
      <div className="max-w-7xl mx-auto relative z-10">
        <div className="flex flex-col md:flex-row gap-4 sm:gap-6 lg:gap-8">
          {/* ==== Filter Panel ==== */}
          <TestSetupPanel
            onRunTest={handleRunTest}
            simulationLoading={simulationLoading}
          />

          {/* ==== Results Grid ==== */}
          <div className="grow flex flex-col relative">
            <ErrorCard error={error} onDismiss={() => setError(null)} />

            {/* Token Usage Display */}
            <TokenUsageCard
              aiResult={aiResult}
              isCached={isCached}
              tokenUsagePercent={tokenUsagePercent}
            />

            {aiResult ? (
              <div className="space-y-6">
                {/* Test Type Specific Analytics */}
                {currentTestType === "matchup_analysis" &&
                  aiResult.matchup_analytics && (
                    <MatchupAnalytics
                      analytics={aiResult.matchup_analytics}
                      deckMode={deckMode}
                    />
                  )}

                {currentTestType === "duel_simulation" &&
                  aiResult.simulation_analytics && (
                    <DuelSimulationAnalytics
                      analytics={aiResult.simulation_analytics}
                    />
                  )}

                {currentTestType === "strategic_insights" &&
                  aiResult.strategic_analytics && (
                    <StrategicInsightsAnalytics
                      analytics={aiResult.strategic_analytics}
                    />
                  )}
              </div>
            ) : (
              <EmptyState />
            )}

            <LoadingOverlay
              isLoading={simulationLoading}
              testType={currentTestType}
              numSimulations={currentNumSimulations}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
