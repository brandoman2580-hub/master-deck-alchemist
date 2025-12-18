"use client";

import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Zap } from "lucide-react";
import { DeckTesterAgentResponse } from "@/types/ai-agents";

interface TokenUsageCardProps {
  aiResult: DeckTesterAgentResponse | null;
  isCached: boolean;
  tokenUsagePercent: number;
}

export function TokenUsageCard({
  aiResult,
  isCached,
  tokenUsagePercent,
}: TokenUsageCardProps) {
  const MAX_TOKENS_REFERENCE = 100000;
  if (!aiResult?.estimated_cost) return null;

  return (
    <Card className="mb-4 rounded-xl bg-white/10 border border-white/20 backdrop-blur-xl shadow-lg">
      <CardContent className="pt-6">
        <div className="space-y-2">
          <div className="flex items-center justify-between text-xs">
            <div className="flex items-center gap-2">
              <Zap className="h-3.5 w-3.5 text-white/80" />
              <span className="text-white/80 font-medium">Token Usage</span>
              {isCached && (
                <Badge
                  variant="outline"
                  className="text-xs text-green-400 border-green-500/50"
                >
                  Cached
                </Badge>
              )}
            </div>
            <div className="flex items-center gap-2 text-white/70">
              <span className="font-semibold text-white tabular-nums">
                {aiResult.estimated_cost.tokens_used.toLocaleString()}
              </span>
              <span className="text-white/50">/</span>
              <span className="tabular-nums">
                {MAX_TOKENS_REFERENCE.toLocaleString()}
              </span>
              {aiResult.estimated_cost.cost_usd > 0 && (
                <>
                  <span className="text-white/50">•</span>
                  <span className="text-white/70">
                    ${aiResult.estimated_cost.cost_usd.toFixed(4)}
                  </span>
                </>
              )}
            </div>
          </div>
          <Progress value={tokenUsagePercent} className="h-2 bg-white/5" />
        </div>
      </CardContent>
    </Card>
  );
}

