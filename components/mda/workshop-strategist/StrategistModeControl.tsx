"use client";

import { cn } from "@/lib/utils";
import type { AssistantMode } from "@/lib/engine/assistant-contract";

const MODES: Array<{ value: AssistantMode; label: string }> = [
  { value: "auto", label: "Auto" },
  { value: "qa", label: "Ask" },
  { value: "tune_copies", label: "Tune" },
  { value: "discover_synergy", label: "Synergy" },
  { value: "optimize", label: "Optimize" },
];

interface StrategistModeControlProps {
  value: AssistantMode;
  onChange: (mode: AssistantMode) => void;
  className?: string;
}

/**
 * Mode tabs for Strategist — full inverse text on every tab for chrome contrast.
 */
export function StrategistModeControl({
  value,
  onChange,
  className,
}: StrategistModeControlProps) {
  return (
    <div
      role="tablist"
      aria-label="Strategist mode"
      className={cn("flex flex-1 gap-1", className)}
    >
      {MODES.map((mode) => {
        const selected = value === mode.value;
        return (
          <button
            key={mode.value}
            type="button"
            role="tab"
            aria-selected={selected}
            data-magnetic
            onClick={() => onChange(mode.value)}
            className={cn(
              "min-h-11 flex-1 px-2 font-mda text-xs font-bold uppercase tracking-wide text-mda-inverse-text transition-colors",
              selected
                ? "bg-mda-chrome-deep"
                : "bg-mda-chrome hover:bg-mda-chrome-deep/80",
            )}
          >
            {mode.label}
          </button>
        );
      })}
    </div>
  );
}
