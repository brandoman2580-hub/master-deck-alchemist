"use client";

import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import type { StrategicAnalytics } from "@/types/ai-agents";

interface StrategicInsightsAnalyticsProps {
  analytics: StrategicAnalytics;
}

export function StrategicInsightsAnalytics({
  analytics,
}: StrategicInsightsAnalyticsProps) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
      {/* Key Card Synergies */}
      {analytics.key_card_synergies.length > 0 && (
        <Card className="rounded-xl bg-white/10 border border-white/20 backdrop-blur-xl shadow-lg">
          <CardHeader>
            <CardTitle className="text-white text-base font-display">
              Key Card Synergies
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ScrollArea className="h-[250px]">
              <div className="space-y-2 pr-4">
                {analytics.key_card_synergies.slice(0, 5).map((synergy, i) => (
                  <div
                    key={i}
                    className="bg-white/5 p-2 border border-white/10 rounded-md backdrop-blur-sm"
                  >
                    <div className="flex items-center justify-between mb-1 gap-2">
                      <span className="text-xs font-semibold text-white break-words">
                        {synergy.card_a || "Unknown"} + {synergy.card_b || "Unknown"}
                      </span>
                      <Badge
                        variant="outline"
                        className="text-xs text-green-400 shrink-0"
                      >
                        {synergy.synergy_score}%
                      </Badge>
                    </div>
                    <p className="text-xs text-white/70 break-words">
                      {synergy.description}
                    </p>
                  </div>
                ))}
              </div>
            </ScrollArea>
          </CardContent>
        </Card>
      )}

      {/* Vulnerabilities & Counters */}
      {analytics.vulnerabilities.length > 0 && (
        <Card className="rounded-xl bg-white/10 border border-white/20 backdrop-blur-xl shadow-lg">
          <CardHeader>
            <CardTitle className="text-white text-base font-display">
              Vulnerabilities & Counters
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ScrollArea className="h-[250px]">
              <div className="space-y-2 pr-4">
                {analytics.vulnerabilities.slice(0, 5).map((vuln, i) => (
                  <div
                    key={i}
                    className="bg-red-500/10 p-2 border border-red-500/20"
                  >
                    <div className="flex items-center justify-between mb-1 gap-2">
                      <span className="text-xs font-semibold text-red-300 break-words capitalize">
                        {vuln.weakness}
                      </span>
                      <Badge
                        variant="outline"
                        className={`text-xs shrink-0 capitalize ${
                          vuln.exploitability_level === "high"
                            ? "border-red-500/50 text-red-400"
                            : vuln.exploitability_level === "medium"
                              ? "border-yellow-500/50 text-yellow-400"
                              : "border-white/20 text-white/60"
                        }`}
                      >
                        {vuln.exploitability_level}
                      </Badge>
                    </div>
                    {vuln.countermeasures.length > 0 && (
                      <>
                        <p className="text-xs text-white/70 mb-1 break-words">
                          Countermeasures:
                        </p>
                        <ul className="list-disc list-inside text-xs text-white/70 space-y-0.5">
                          {vuln.countermeasures.slice(0, 2).map((cm, j) => (
                            <li key={j}>{cm}</li>
                          ))}
                        </ul>
                      </>
                    )}
                  </div>
                ))}
              </div>
            </ScrollArea>
          </CardContent>
        </Card>
      )}

      {/* Playstyle Profile */}
      {analytics.playstyle_profile && (
        <Card className="rounded-xl bg-white/10 border border-white/20 backdrop-blur-xl shadow-lg">
          <CardHeader>
            <CardTitle className="text-white text-base font-display">
              Playstyle Profile
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div>
              <Badge
                variant="outline"
                className="text-sm py-1.5 w-full justify-center capitalize"
              >
                {analytics.playstyle_profile.primary_style}
              </Badge>
              <div className="text-xs text-white/70 mt-1 text-center">
                Confidence: {analytics.playstyle_profile.style_confidence}%
              </div>
            </div>
            <p className="text-xs text-white/80 break-words">
              {analytics.playstyle_profile.description}
            </p>
            {analytics.playstyle_profile.evidence.length > 0 && (
              <div>
                <div className="text-xs font-semibold text-white/90 mb-1">
                  Evidence:
                </div>
                <ul className="list-disc list-inside text-xs text-white/70 space-y-0.5">
                  {analytics.playstyle_profile.evidence
                    .slice(0, 3)
                    .map((ev, i) => (
                      <li key={i}>{ev}</li>
                    ))}
                </ul>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Meta Adaptation */}
      {analytics.meta_adaptation && (
        <Card className="bg-gradient-to-b from-cyan-400/20 via-cyan-500/15 to-cyan-600/5 backdrop-blur-md border border-accent-cyan/18 md:col-span-2">
          <CardHeader>
            <CardTitle className="text-white text-base font-display">
              Meta Adaptation
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs text-white/70">Current Meta Fit</span>
                <span className="text-lg font-bold text-white">
                  {analytics.meta_adaptation.current_meta_fit.toFixed(0)}%
                </span>
              </div>
              {analytics.meta_adaptation.recommended_changes.length > 0 && (
                <div>
                  <div className="text-xs font-semibold text-white/90 mb-2">
                    Recommended Changes:
                  </div>
                  <div className="space-y-2">
                    {analytics.meta_adaptation.recommended_changes
                      .slice(0, 3)
                      .map((change, i) => (
                        <div
                          key={i}
                          className="bg-white/5 p-2 border border-white/10 rounded-md backdrop-blur-sm"
                        >
                          <div className="flex items-center justify-between mb-1 gap-2">
                            <span className="text-xs font-medium text-white break-words">
                              {change.card_to_add && `Add: ${change.card_to_add}`}
                              {change.card_to_remove &&
                                `Remove: ${change.card_to_remove}`}
                            </span>
                            <Badge
                              variant="outline"
                              className="text-xs text-green-400 shrink-0"
                            >
                              +{change.expected_improvement}%
                            </Badge>
                          </div>
                          <p className="text-xs text-white/70 break-words">
                            {change.reason}
                          </p>
                        </div>
                      ))}
                  </div>
                </div>
              )}
              {analytics.meta_adaptation.meta_trends.length > 0 && (
                <div>
                  <div className="text-xs font-semibold text-white/90 mb-1">
                    Meta Trends:
                  </div>
                  <ul className="list-disc list-inside text-xs text-white/70 space-y-0.5">
                    {analytics.meta_adaptation.meta_trends
                      .slice(0, 3)
                      .map((trend, i) => (
                        <li key={i}>{trend}</li>
                      ))}
                  </ul>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Risk vs Reward Analysis */}
      {analytics.risk_reward_analysis.length > 0 && (
        <Card className="bg-gradient-to-b from-cyan-400/20 via-cyan-500/15 to-cyan-600/5 backdrop-blur-md border border-accent-cyan/18 md:col-span-2 lg:col-span-3">
          <CardHeader>
            <CardTitle className="text-white text-base font-display">
              Risk vs Reward Analysis
            </CardTitle>
            <CardDescription className="text-white/70 text-xs">
              Evaluation of high-risk/high-reward plays and their success
              likelihood
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {analytics.risk_reward_analysis.slice(0, 6).map((analysis, i) => (
                <div
                  key={i}
                  className="bg-white/5 p-4 border border-white/10 rounded-md hover:border-white/20 transition-colors backdrop-blur-sm"
                >
                  <div className="space-y-3">
                    <h4 className="text-sm font-semibold text-white break-words leading-tight">
                      {analysis.play}
                    </h4>

                    <div className="grid grid-cols-3 gap-2">
                      {/* Risk Level */}
                      <div className="space-y-1">
                        <div className="text-xs text-white/70">Risk</div>
                        <Badge
                          variant="outline"
                          className={`w-full justify-center text-xs capitalize ${
                            analysis.risk_level === "high"
                              ? "border-red-500/50 text-red-400 bg-red-500/10"
                              : analysis.risk_level === "medium"
                                ? "border-yellow-500/50 text-yellow-400 bg-yellow-500/10"
                                : "border-white/20 text-white/60 bg-white/5"
                          }`}
                        >
                          {analysis.risk_level}
                        </Badge>
                      </div>

                      {/* Reward Potential */}
                      <div className="space-y-1">
                        <div className="text-xs text-white/70">Reward</div>
                        <Badge
                          variant="outline"
                          className={`w-full justify-center text-xs capitalize ${
                            analysis.reward_potential === "high"
                              ? "border-green-500/50 text-green-400 bg-green-500/10"
                              : analysis.reward_potential === "medium"
                                ? "border-yellow-500/50 text-yellow-400 bg-yellow-500/10"
                                : "border-white/20 text-white/60 bg-white/5"
                          }`}
                        >
                          {analysis.reward_potential}
                        </Badge>
                      </div>

                      {/* Success Rate */}
                      <div className="space-y-1">
                        <div className="text-xs text-white/70">Success</div>
                        <div className="text-sm font-bold text-white text-center">
                          {analysis.success_rate}%
                        </div>
                      </div>
                    </div>

                    <p className="text-xs text-white/70 break-words leading-relaxed">
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
  );
}

