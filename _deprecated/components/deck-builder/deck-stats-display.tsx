"use client";

import { useMemo } from "react";
import { Badge } from "@/components/ui/badge";
import { Layers, Zap, Shield } from "lucide-react";
import { DeckMode } from "@/types/types";

interface DeckStatsDisplayProps {
  mainCount: number;
  extraCount: number;
  sideCount: number;
  deckMode: DeckMode;
  className?: string;
}

/**
 * Modern, polished deck count display
 * Shows counts in a premium, visual way (not code-like)
 */
export function DeckStatsDisplay({
  mainCount,
  extraCount,
  sideCount,
  deckMode,
  className = "",
}: DeckStatsDisplayProps) {
  // Calculate status colors and messages
  const mainStatus = useMemo(() => {
    if (mainCount < 40) {
      return {
        color: "text-yellow-400",
        bgColor: "bg-yellow-500/10",
        borderColor: "border-yellow-500/30",
        status: "Incomplete",
      };
    }
    if (mainCount > 60) {
      return {
        color: "text-red-400",
        bgColor: "bg-red-500/10",
        borderColor: "border-red-500/30",
        status: "Over Limit",
      };
    }
    return {
      color: "text-cyan-400",
      bgColor: "bg-cyan-500/10",
      borderColor: "border-cyan-500/30",
      status: "Valid",
    };
  }, [mainCount]);

  const extraStatus = useMemo(() => {
    if (extraCount > 15) {
      return {
        color: "text-red-400",
        bgColor: "bg-red-500/10",
        borderColor: "border-red-500/30",
      };
    }
    return {
      color: "text-cyan-400",
      bgColor: "bg-cyan-500/10",
      borderColor: "border-cyan-500/30",
    };
  }, [extraCount]);

  const sideStatus = useMemo(() => {
    if (sideCount > 15) {
      return {
        color: "text-red-400",
        bgColor: "bg-red-500/10",
        borderColor: "border-red-500/30",
      };
    }
    return {
      color: "text-cyan-400",
      bgColor: "bg-cyan-500/10",
      borderColor: "border-cyan-500/30",
    };
  }, [sideCount]);

  return (
    <div className={`flex items-center gap-3 ${className}`}>
      {/* Main Deck */}
      <div
        className={`
          flex items-center gap-2 px-3 py-1.5 rounded-lg border
          ${mainStatus.bgColor} ${mainStatus.borderColor}
          transition-all duration-200
        `}
      >
        <Layers className={`h-4 w-4 ${mainStatus.color}`} />
        <div className="flex flex-col">
          <span className="text-xs text-slate-400 font-medium">Main</span>
          <span className={`text-sm font-bold ${mainStatus.color}`}>
            {mainCount}
            <span className="text-slate-500 font-normal">/60</span>
          </span>
        </div>
      </div>

      {/* Extra Deck */}
      <div
        className={`
          flex items-center gap-2 px-3 py-1.5 rounded-lg border
          ${extraStatus.bgColor} ${extraStatus.borderColor}
          transition-all duration-200
        `}
      >
        <Zap className={`h-4 w-4 ${extraStatus.color}`} />
        <div className="flex flex-col">
          <span className="text-xs text-slate-400 font-medium">Extra</span>
          <span className={`text-sm font-bold ${extraStatus.color}`}>
            {extraCount}
            <span className="text-slate-500 font-normal">/15</span>
          </span>
        </div>
      </div>

      {/* Side Deck (TCG only) */}
      {deckMode === "TCG" && (
        <div
          className={`
            flex items-center gap-2 px-3 py-1.5 rounded-lg border
            ${sideStatus.bgColor} ${sideStatus.borderColor}
            transition-all duration-200
          `}
        >
          <Shield className={`h-4 w-4 ${sideStatus.color}`} />
          <div className="flex flex-col">
            <span className="text-xs text-slate-400 font-medium">Side</span>
            <span className={`text-sm font-bold ${sideStatus.color}`}>
              {sideCount}
              <span className="text-slate-500 font-normal">/15</span>
            </span>
          </div>
        </div>
      )}

      {/* Status Badge for Main Deck */}
      {mainCount < 40 && (
        <Badge
          variant="outline"
          className="border-yellow-500/50 text-yellow-400 bg-yellow-500/10 text-xs"
        >
          Need {40 - mainCount} more
        </Badge>
      )}
      {mainCount > 60 && (
        <Badge
          variant="outline"
          className="border-red-500/50 text-red-400 bg-red-500/10 text-xs"
        >
          Over limit
        </Badge>
      )}
    </div>
  );
}

