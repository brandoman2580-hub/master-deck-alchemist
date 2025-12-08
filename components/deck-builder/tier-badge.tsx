// NOTE: extracted from app/deck-builder/page.tsx
"use client";

import { Badge } from "@/components/ui/badge";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { Trophy } from "lucide-react";

interface TierBadgeProps {
  tier: number | null;
}

export function TierBadge({ tier }: TierBadgeProps) {
  if (tier === null) return null;

  let color = "";
  let label = "";

  switch (tier) {
    case 1:
      color = "bg-red-500 hover:bg-red-600";
      label = "Tier 1 - Meta";
      break;
    case 2:
      color = "bg-orange-500 hover:bg-orange-600";
      label = "Tier 2 - Competitive";
      break;
    case 3:
      color = "bg-yellow-500 hover:bg-yellow-600";
      label = "Tier 3 - Rogue";
      break;
    default:
      color = "bg-gray-500 hover:bg-gray-600";
      label = "Tier 4 - Casual";
  }

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <Badge className={`${color} cursor-help`}>
            <Trophy className="h-3 w-3 mr-1" />
            {`Tier ${tier}`}
          </Badge>
        </TooltipTrigger>
        <TooltipContent>
          <p>{label}</p>
          <p className="text-xs mt-1">Estimated competitive viability</p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

