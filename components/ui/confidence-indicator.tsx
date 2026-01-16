"use client";

import { useMemo } from "react";
import { motion } from "framer-motion";
import { Check, AlertTriangle, X } from "lucide-react";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "./tooltip";
import { cn } from "@/lib/utils";

export type ConfidenceReasonTone = "positive" | "warning" | "negative";

export interface ConfidenceReason {
  tone?: ConfidenceReasonTone;
  text: string;
}

export interface ConfidenceIndicatorProps {
  score: number; // 0..1
  label?: string;
  reasons?: ConfidenceReason[];
  size?: number; // px
  className?: string;
}

function clamp01(value: number): number {
  if (Number.isNaN(value)) return 0;
  return Math.min(1, Math.max(0, value));
}

function getToneColorClass(tone: ConfidenceReasonTone): string {
  switch (tone) {
    case "positive":
      return "text-green-300";
    case "warning":
      return "text-yellow-300";
    case "negative":
      return "text-red-300";
  }
}

function getToneIcon(tone: ConfidenceReasonTone) {
  switch (tone) {
    case "positive":
      return Check;
    case "warning":
      return AlertTriangle;
    case "negative":
      return X;
  }
}

function getScoreColorClass(score: number): string {
  if (score >= 0.8) return "text-green-300";
  if (score >= 0.6) return "text-cyan-300";
  if (score >= 0.5) return "text-blue-300";
  return "text-slate-300";
}

export function ConfidenceIndicator({
  score,
  label = "Confidence",
  reasons = [],
  size = 36,
  className,
}: ConfidenceIndicatorProps) {
  const normalized = clamp01(score);
  const percentage = Math.round(normalized * 100);
  const strokeWidth = 4;
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const dashOffset = circumference * (1 - normalized);
  const scoreColorClass = getScoreColorClass(normalized);

  const safeReasons = useMemo(() => {
    return reasons
      .map((r) => ({
        tone: r.tone ?? "warning",
        text: r.text,
      }))
      .filter((r) => r.text.trim().length > 0)
      .slice(0, 8);
  }, [reasons]);

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <button
            type="button"
            className={cn(
              "inline-flex items-center gap-2 rounded-lg border border-white/10 bg-white/5 px-2 py-1.5 hover:bg-white/10 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-cyan-500/40",
              className,
            )}
            aria-label={`${label}: ${percentage}%`}
          >
            <span className={cn("relative inline-block", scoreColorClass)}>
              <svg
                width={size}
                height={size}
                viewBox={`0 0 ${size} ${size}`}
                role="img"
                aria-hidden="true"
              >
                <circle
                  cx={size / 2}
                  cy={size / 2}
                  r={radius}
                  stroke="rgba(255,255,255,0.12)"
                  strokeWidth={strokeWidth}
                  fill="transparent"
                />
                <motion.circle
                  cx={size / 2}
                  cy={size / 2}
                  r={radius}
                  stroke="currentColor"
                  strokeWidth={strokeWidth}
                  fill="transparent"
                  strokeLinecap="round"
                  strokeDasharray={circumference}
                  initial={{ strokeDashoffset: circumference }}
                  animate={{ strokeDashoffset: dashOffset }}
                  transition={{ duration: 0.5, ease: "easeOut" }}
                  style={{
                    transformOrigin: "50% 50%",
                    transform: "rotate(-90deg)",
                  }}
                />
              </svg>
              <span className="absolute inset-0 flex items-center justify-center text-[10px] font-semibold">
                {percentage}
              </span>
            </span>

            <span className="text-xs font-semibold text-slate-200">{label}</span>
          </button>
        </TooltipTrigger>

        <TooltipContent side="top" align="end" className="max-w-[320px]">
          <div className="space-y-2">
            <div className="flex items-center justify-between gap-3">
              <div className="text-xs font-semibold text-white">{label}</div>
              <div className={cn("text-xs font-semibold", scoreColorClass)}>
                {percentage}%
              </div>
            </div>

            {safeReasons.length > 0 ? (
              <ul className="space-y-1">
                {safeReasons.map((r) => {
                  const Icon = getToneIcon(r.tone);
                  return (
                    <li key={`${r.tone}:${r.text}`} className="flex items-start gap-2">
                      <Icon className={cn("h-3.5 w-3.5 mt-0.5", getToneColorClass(r.tone))} />
                      <span className="text-xs text-white/90 leading-snug">
                        {r.text}
                      </span>
                    </li>
                  );
                })}
              </ul>
            ) : (
              <div className="text-xs text-white/80">
                No detailed factors available yet.
              </div>
            )}
          </div>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

