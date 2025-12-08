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
    <Card className="mb-4 bg-gradient-to-b from-cyan-400/20 via-cyan-500/15 to-cyan-600/5 backdrop-blur-md border border-accent-cyan/18">
      <CardContent className="pt-6">
        <div className="space-y-2">
          <div className="flex items-center justify-between text-xs">
            <div className="flex items-center gap-2">
              <Zap className="h-3.5 w-3.5 text-accent-cyan" />
              <span className="text-muted-50 font-medium">Token Usage</span>
              {isCached && (
                <Badge
                  variant="outline"
                  className="text-xs text-green-400 border-green-500/50"
                >
                  Cached
                </Badge>
              )}
            </div>
            <div className="flex items-center gap-2 text-muted-50/70">
              <span className="font-semibold text-accent-cyan tabular-nums">
                {aiResult.estimated_cost.tokens_used.toLocaleString()}
              </span>
              <span className="text-white0">/</span>
              <span className="tabular-nums">
                {MAX_TOKENS_REFERENCE.toLocaleString()}
              </span>
              {aiResult.estimated_cost.cost_usd > 0 && (
                <>
                  <span className="text-white0">•</span>
                  <span className="text-muted-50">
                    ${aiResult.estimated_cost.cost_usd.toFixed(4)}
                  </span>
                </>
              )}
            </div>
          </div>
          <Progress value={tokenUsagePercent} className="h-2 bg-cyb-800/40" />
        </div>
      </CardContent>
    </Card>
  );
}

