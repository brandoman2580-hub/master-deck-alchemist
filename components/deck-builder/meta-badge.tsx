"use client";

import { Badge } from "@/components/ui/badge";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { TrendingUp, Shield } from "lucide-react";

interface MetaBadgeProps {
  metaMatch: {
    deck_name: string;
    tier: number;
    format: "tcg" | "master_duel";
    confidence: number;
  } | null;
  format: "tcg" | "master_duel";
}

export function MetaBadge({ metaMatch, format }: MetaBadgeProps) {
  if (!metaMatch) return null;

  const tierColors: Record<number, string> = {
    1: "bg-red-500/90 hover:bg-red-600/90 border-red-400",
    2: "bg-orange-500/90 hover:bg-orange-600/90 border-orange-400",
    3: "bg-yellow-500/90 hover:bg-yellow-600/90 border-yellow-400",
    4: "bg-gray-500/90 hover:bg-gray-600/90 border-gray-400",
  };

  const tierLabels: Record<number, string> = {
    1: "Tier 1 - Meta",
    2: "Tier 2 - Competitive",
    3: "Tier 3 - Rogue",
    4: "Tier 4 - Casual",
  };

  const color = tierColors[metaMatch.tier] || tierColors[4];
  const label = tierLabels[metaMatch.tier] || tierLabels[4];
  const confidencePercent = Math.round(metaMatch.confidence * 100);

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <Badge className={`${color} cursor-help border`}>
            <TrendingUp className="h-3 w-3 mr-1" />
            {metaMatch.deck_name}
            <span className="ml-1 text-xs opacity-75">({confidencePercent}%)</span>
          </Badge>
        </TooltipTrigger>
        <TooltipContent>
          <div className="space-y-1">
            <p className="font-semibold">{label}</p>
            <p className="text-xs">
              Matches: <span className="font-medium">{metaMatch.deck_name}</span>
            </p>
            <p className="text-xs">
              Format: <span className="font-medium">{format.toUpperCase()}</span>
            </p>
            <p className="text-xs text-muted-foreground">
              Confidence: {confidencePercent}%
            </p>
          </div>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

interface MetaThreatBadgeProps {
  threats: Array<{
    deck_name: string;
    tier: number;
  }>;
}

export function MetaThreatBadge({ threats }: MetaThreatBadgeProps) {
  if (!threats || threats.length === 0) return null;

  const topThreats = threats.slice(0, 3);
  const tier1Threats = threats.filter((t) => t.tier === 1);

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <Badge
            variant="outline"
            className="cursor-help border-amber-500/50 text-amber-300 hover:bg-amber-500/10"
          >
            <Shield className="h-3 w-3 mr-1" />
            {tier1Threats.length > 0
              ? `${tier1Threats.length} Tier 1 Threat${tier1Threats.length > 1 ? "s" : ""}`
              : `${threats.length} Meta Threat${threats.length > 1 ? "s" : ""}`}
          </Badge>
        </TooltipTrigger>
        <TooltipContent>
          <div className="space-y-1">
            <p className="font-semibold text-sm">Current Meta Threats</p>
            <div className="space-y-0.5">
              {topThreats.map((threat, idx) => (
                <p key={idx} className="text-xs">
                  <span className="font-medium">T{threat.tier}:</span> {threat.deck_name}
                </p>
              ))}
              {threats.length > 3 && (
                <p className="text-xs text-muted-foreground">
                  +{threats.length - 3} more
                </p>
              )}
            </div>
          </div>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
