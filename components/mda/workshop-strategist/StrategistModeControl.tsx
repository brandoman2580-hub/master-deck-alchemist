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
 * Five-column mode strip from the locked Workshop browser screen.
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
      className={cn(
        "grid shrink-0 grid-cols-5 border-b border-[#28303b] bg-[#0c0e12]",
        className,
      )}
    >
      {MODES.map((mode, index) => {
        const selected = value === mode.value;
        const last = index === MODES.length - 1;
        return (
          <button
            key={mode.value}
            type="button"
            role="tab"
            aria-selected={selected}
            onClick={() => onChange(mode.value)}
            className={cn(
              "flex h-8 items-center justify-center text-[10px] font-semibold uppercase tracking-[0.12em] transition-colors hover:bg-[#e2e8f0] hover:text-[#0c0e12]",
              !last && "border-r border-[#28303b] hover:border-r-[#e2e8f0]",
              selected
                ? "border-b-2 border-b-[#bfe5f3] bg-[#14181f] text-[#f7fcff] hover:border-b-[#0c0e12]"
                : "text-[#8a96a6]",
            )}
          >
            {mode.label}
          </button>
        );
      })}
    </div>
  );
}
