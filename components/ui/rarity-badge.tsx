"use client";

import { cn } from "@/lib/utils";
import type { RarityBadgeResult } from "@/lib/card/rarity";

interface RarityBadgeProps {
  result: RarityBadgeResult;
  className?: string;
  size?: "xs" | "sm" | "md";
}

const sizeClasses = {
  xs: "text-[8px] px-1 py-0 min-w-[18px] h-4",
  sm: "text-[10px] px-1.5 py-0.5 min-w-[22px] h-5",
  md: "text-xs px-1.5 py-0.5",
};

/**
 * Rarity badge using plain span + inline styles to guarantee colors display.
 * Badge component variants override custom backgrounds; this avoids that.
 */
export function RarityBadge({ result, className, size = "md" }: RarityBadgeProps) {
  return (
    <span
      className={cn(
        "inline-flex items-center justify-center border rounded-md font-bold shadow-sm",
        sizeClasses[size],
        className,
      )}
      style={getRarityInlineStyles(result.badgeClass)}
    >
      {result.displayText}
    </span>
  );
}

/**
 * Map badge class markers to inline styles for guaranteed color application.
 * Handles solid colors and gradients.
 */
function getRarityInlineStyles(badgeClass: string): React.CSSProperties {
  // N - gray
  if (badgeClass.includes("gray-500")) {
    return {
      backgroundColor: "rgb(107 114 128)",
      borderColor: "rgb(156 163 175)",
      color: "white",
    };
  }
  // R - blue
  if (badgeClass.includes("blue-500")) {
    return {
      backgroundColor: "rgb(59 130 246)",
      borderColor: "rgb(96 165 250)",
      color: "white",
    };
  }
  // SR - gold gradient; use darker border for clear definition (matches N/R style)
  if (badgeClass.includes("amber-gradient") || badgeClass.includes("amber-400")) {
    return {
      background: "linear-gradient(to right, rgb(251 191 36), rgb(234 179 8), rgb(245 158 11))",
      borderColor: "rgb(180 83 9)", // amber-700 for contrast
      color: "white",
    };
  }
  // UR / ScR - purple/pink/sky gradient; use darker border for clear definition
  if (badgeClass.includes("purple-gradient") || badgeClass.includes("purple-500")) {
    return {
      background: "linear-gradient(to right, rgb(168 85 247), rgb(236 72 153), rgb(56 189 248))",
      borderColor: "rgb(126 34 206)", // purple-700 for contrast
      color: "white",
    };
  }
  return {};
}
