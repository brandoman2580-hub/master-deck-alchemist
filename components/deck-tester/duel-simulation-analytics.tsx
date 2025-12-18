"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import type { SimulationAnalytics } from "@/types/ai-agents";

interface DuelSimulationAnalyticsProps {
  analytics: SimulationAnalytics;
}

export function DuelSimulationAnalytics({
  analytics,
}: DuelSimulationAnalyticsProps) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
      {/* Simulation Stats */}
      <Card className="rounded-xl bg-white/10 border border-white/20 backdrop-blur-xl shadow-lg">
        <CardHeader>
          <CardTitle className="text-white text-base font-display">
            Simulation Stats
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="grid grid-cols-3 gap-2">
            <div className="bg-white/5 p-2 border border-white/10 rounded-md text-center backdrop-blur-sm">
              <div className="text-xs text-white/70 mb-0.5">Wins</div>
              <div className="text-xl font-bold text-green-400">
                {analytics.wins_deck_a}
              </div>
            </div>
            <div className="bg-white/5 p-2 border border-white/10 rounded-md text-center backdrop-blur-sm">
              <div className="text-xs text-white/70 mb-0.5">Losses</div>
              <div className="text-xl font-bold text-red-400">
                {analytics.wins_deck_b}
              </div>
            </div>
            <div className="bg-white/5 p-2 border border-white/10 rounded-md text-center backdrop-blur-sm">
              <div className="text-xs text-white/70 mb-0.5">Draws</div>
              <div className="text-xl font-bold text-white/70">
                {analytics.draws}
              </div>
            </div>
          </div>
          <div className="bg-white/5 p-3 border border-white/10 rounded-md backdrop-blur-sm">
            <div className="text-xs text-white/70 mb-1">Avg Turn Length</div>
            <div className="text-2xl font-bold text-white">
              {analytics.avg_turn_length.toFixed(1)}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Game Duration Stats */}
      {analytics.game_duration_stats && (
        <Card className="rounded-xl bg-white/10 border border-white/20 backdrop-blur-xl shadow-lg">
          <CardHeader>
            <CardTitle className="text-white text-base font-display">
              Game Duration
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <div className="flex justify-between items-center">
              <span className="text-xs text-white/70">Fastest Win</span>
              <span className="text-sm font-semibold text-green-400">
                {analytics.game_duration_stats.fastest_win} turns
              </span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-xs text-white/70">Slowest Win</span>
              <span className="text-sm font-semibold text-orange-400">
                {analytics.game_duration_stats.slowest_win} turns
              </span>
            </div>
            <div className="flex justify-between items-center pt-2 border-t border-white/10">
              <span className="text-xs font-medium text-white/80">Average</span>
              <span className="text-base font-bold text-white">
                {analytics.game_duration_stats.average_duration.toFixed(1)} turns
              </span>
            </div>
            <Badge
              variant="outline"
              className="w-full justify-center mt-2 capitalize"
            >
              Tempo: {analytics.game_duration_stats.tempo}
            </Badge>
          </CardContent>
        </Card>
      )}

      {/* Combo Success Rates */}
      {analytics.combo_success_rates.length > 0 && (
        <Card className="rounded-xl bg-white/10 border border-white/20 backdrop-blur-xl shadow-lg">
          <CardHeader>
            <CardTitle className="text-white text-base font-display">
              Combo Success Rates
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ScrollArea className="h-[200px]">
              <div className="space-y-2 pr-4">
                {analytics.combo_success_rates.slice(0, 5).map((combo, i) => (
                  <div
                    key={i}
                    className="bg-white/5 p-2 border border-white/10 rounded-md backdrop-blur-sm"
                  >
                    <div className="flex items-center justify-between mb-1 gap-2">
                      <span className="text-xs font-semibold text-white break-words">
                        {combo.combo_name}
                      </span>
                      <Badge variant="outline" className="text-xs shrink-0">
                        {combo.success_rate}%
                      </Badge>
                    </div>
                    <p className="text-xs text-white/70 break-words">
                      {combo.description}
                    </p>
                  </div>
                ))}
              </div>
            </ScrollArea>
          </CardContent>
        </Card>
      )}

      {/* Decision Points */}
      {analytics.decision_points.length > 0 && (
        <Card className="bg-gradient-to-b from-cyan-400/20 via-cyan-500/15 to-cyan-600/5 backdrop-blur-md border border-accent-cyan/18 md:col-span-2 lg:col-span-1">
          <CardHeader>
            <CardTitle className="text-white text-base font-display">
              Decision Points
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ScrollArea className="h-[200px]">
              <div className="space-y-2 pr-4">
                {analytics.decision_points.slice(0, 5).map((decision, i) => (
                  <div
                    key={i}
                    className="bg-white/5 p-2 border border-white/10 rounded-md backdrop-blur-sm"
                  >
                    <div className="flex items-center justify-between mb-1 gap-2">
                      <span className="text-xs font-medium text-white/80">
                        Turn {decision.turn}
                      </span>
                      <Badge
                        variant="outline"
                        className={`text-xs shrink-0 capitalize ${
                          decision.impact === "high"
                            ? "border-red-500/50 text-red-400"
                            : decision.impact === "medium"
                              ? "border-yellow-500/50 text-yellow-400"
                              : "border-white/20 text-white/60"
                        }`}
                      >
                        {decision.impact}
                      </Badge>
                    </div>
                    <p className="text-xs text-white font-medium mb-0.5 break-words">
                      {decision.decision}
                    </p>
                    <p className="text-xs text-white/70 break-words">
                      {decision.outcome}
                    </p>
                  </div>
                ))}
              </div>
            </ScrollArea>
          </CardContent>
        </Card>
      )}

      {/* Damage Trends */}
      {analytics.damage_trends && (
        <Card className="rounded-xl bg-white/10 border border-white/20 backdrop-blur-xl shadow-lg">
          <CardHeader>
            <CardTitle className="text-white text-base font-display">
              Damage Trends
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <div className="flex justify-between items-center">
              <span className="text-xs text-white/70">Avg Damage/Turn</span>
              <span className="text-sm font-semibold text-white">
                {analytics.damage_trends.avg_damage_per_turn.toFixed(0)}
              </span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-xs text-white/70">Peak Damage Turn</span>
              <span className="text-sm font-semibold text-orange-400">
                Turn {analytics.damage_trends.peak_damage_turn}
              </span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-xs text-white/70">Consistency</span>
              <span className="text-sm font-semibold text-white">
                {analytics.damage_trends.damage_consistency.toFixed(0)}%
              </span>
            </div>
            <p className="text-xs text-muted-50/70 pt-2 border-t border-cyan-500/20 break-words">
              {analytics.damage_trends.description}
            </p>
          </CardContent>
        </Card>
      )}

      {/* Common Outcomes */}
      {analytics.common_outcomes.length > 0 && (
        <Card className="bg-gradient-to-b from-cyan-400/20 via-cyan-500/15 to-cyan-600/5 backdrop-blur-md border border-accent-cyan/18 md:col-span-2">
          <CardHeader>
            <CardTitle className="text-white text-base font-display">
              Common Outcomes
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {analytics.common_outcomes.map((outcome, i) => (
                <div
                  key={i}
                  className="bg-cyb-800/40 p-3 border border-cyan-500/20"
                >
                  <div className="flex items-center justify-between mb-1 gap-2">
                    <span className="text-sm font-semibold text-white break-words capitalize">
                      {outcome.outcome}
                    </span>
                    <Badge variant="outline" className="text-xs shrink-0">
                      {outcome.frequency} times
                    </Badge>
                  </div>
                  <p className="text-xs text-muted-50/70 break-words">
                    {outcome.explanation}
                  </p>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

