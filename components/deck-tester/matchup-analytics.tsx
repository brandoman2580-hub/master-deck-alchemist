"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { AlertCircle, CheckCircle2 } from "lucide-react";
import type { MatchupAnalytics } from "@/types/ai-agents";
import { DeckMode } from "@/types/types";

interface MatchupAnalyticsProps {
  analytics: MatchupAnalytics;
  deckMode: DeckMode;
}

export function MatchupAnalytics({
  analytics,
  deckMode,
}: MatchupAnalyticsProps) {
  return (
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
                {analytics.win_rate_estimates.going_first.toFixed(1)}%
              </span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-xs text-muted-50/70">Going Second</span>
              <span className="text-sm font-semibold text-accent-cyan">
                {analytics.win_rate_estimates.going_second.toFixed(1)}%
              </span>
            </div>
            <div className="flex justify-between items-center pt-2 border-t border-cyan-500/20">
              <span className="text-xs font-medium text-muted-50">Overall</span>
              <span className="text-base font-bold text-accent-cyan/90">
                {analytics.win_rate_estimates.overall.toFixed(1)}%
              </span>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Card Effectiveness */}
      {analytics.card_effectiveness.length > 0 && (
        <Card className="bg-gradient-to-b from-cyan-400/20 via-cyan-500/15 to-cyan-600/5 backdrop-blur-md border border-accent-cyan/18">
          <CardHeader>
            <CardTitle className="text-white text-base font-display">
              Card Effectiveness
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ScrollArea className="h-[200px]">
              <div className="space-y-2 pr-4">
                {analytics.card_effectiveness.slice(0, 5).map((card, i) => (
                  <div
                    key={i}
                    className="bg-cyb-800/40 p-2 border border-cyan-500/20"
                  >
                    <div className="flex items-center justify-between mb-1 gap-2">
                      <span className="text-xs font-semibold text-white break-words">
                        {card.card_name || "Unknown Card"}
                      </span>
                      <Badge variant="outline" className="text-xs shrink-0">
                        {card.impact_score}%
                      </Badge>
                    </div>
                    <p className="text-xs text-muted-50/70 break-words">
                      {card.description}
                    </p>
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
              {analytics.matchup_strengths.length > 0 && (
                <div>
                  <div className="flex items-center gap-2 mb-2">
                    <CheckCircle2 className="h-3.5 w-3.5 text-green-400" />
                    <span className="text-xs font-semibold text-green-400 uppercase">
                      Strengths
                    </span>
                  </div>
                  <div className="space-y-1.5">
                    {analytics.matchup_strengths.slice(0, 3).map((matchup, i) => (
                      <div
                        key={i}
                        className="bg-green-500/10 rounded p-1.5 border border-green-500/20"
                      >
                        <div className="flex justify-between items-center mb-0.5">
                          <span className="text-xs font-medium text-green-300">
                            {matchup.archetype_or_deck_type}
                          </span>
                          <span className="text-xs font-bold text-green-400">
                            {matchup.win_rate.toFixed(0)}%
                          </span>
                        </div>
                        <p className="text-xs text-muted-50/70">
                          {matchup.reason}
                        </p>
                      </div>
                    ))}
                  </div>
                </div>
              )}
              {analytics.matchup_weaknesses.length > 0 && (
                <div>
                  <div className="flex items-center gap-2 mb-2">
                    <AlertCircle className="h-3.5 w-3.5 text-red-400" />
                    <span className="text-xs font-semibold text-red-400 uppercase">
                      Weaknesses
                    </span>
                  </div>
                  <div className="space-y-1.5">
                    {analytics.matchup_weaknesses.slice(0, 3).map((matchup, i) => (
                      <div
                        key={i}
                        className="bg-red-500/10 rounded p-1.5 border border-red-500/20"
                      >
                        <div className="flex justify-between items-center mb-0.5">
                          <span className="text-xs font-medium text-red-300">
                            {matchup.archetype_or_deck_type}
                          </span>
                          <span className="text-xs font-bold text-red-400">
                            {matchup.win_rate.toFixed(0)}%
                          </span>
                        </div>
                        <p className="text-xs text-muted-50/70">
                          {matchup.reason}
                        </p>
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
      {deckMode === "TCG" && analytics.side_deck_impact.length > 0 && (
        <Card className="bg-gradient-to-b from-cyan-400/20 via-cyan-500/15 to-cyan-600/5 backdrop-blur-md border border-accent-cyan/18">
          <CardHeader>
            <CardTitle className="text-white text-base font-display">
              Side Deck Impact
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ScrollArea className="h-[200px]">
              <div className="space-y-2 pr-4">
                {analytics.side_deck_impact.slice(0, 5).map((card, i) => (
                  <div
                    key={i}
                    className="bg-cyb-800/40 p-2 border border-cyan-500/20"
                  >
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-xs font-semibold text-white break-words">
                        {card.card_name || "Unknown Card"}
                      </span>
                      <Badge
                        variant="outline"
                        className="text-xs text-green-400 shrink-0 ml-2"
                      >
                        +{card.matchup_improvement}%
                      </Badge>
                    </div>
                    <p className="text-xs text-muted-50/70 break-words">
                      {card.description}
                    </p>
                  </div>
                ))}
              </div>
            </ScrollArea>
          </CardContent>
        </Card>
      )}

      {/* Resource Usage */}
      {analytics.resource_usage && (
        <Card className="bg-gradient-to-b from-cyan-400/20 via-cyan-500/15 to-cyan-600/5 backdrop-blur-md border border-accent-cyan/18">
          <CardHeader>
            <CardTitle className="text-white text-base font-display">
              Resource Usage
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="space-y-2">
              <div className="flex justify-between items-center">
                <span className="text-xs text-muted-50/70">
                  Draw Consistency
                </span>
                <span className="text-sm font-semibold text-accent-cyan">
                  {analytics.resource_usage.draw_consistency.toFixed(0)}%
                </span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-xs text-muted-50/70">
                  Depletion Rate
                </span>
                <Badge variant="outline" className="text-xs capitalize">
                  {analytics.resource_usage.resource_depletion_rate}
                </Badge>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-xs text-muted-50/70">
                  Recovery Success
                </span>
                <span className="text-sm font-semibold text-accent-cyan">
                  {analytics.resource_usage.recovery_success_rate.toFixed(0)}%
                </span>
              </div>
            </div>
            <p className="text-xs text-muted-50/70 pt-2 border-t border-cyan-500/20 break-words">
              {analytics.resource_usage.description}
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

