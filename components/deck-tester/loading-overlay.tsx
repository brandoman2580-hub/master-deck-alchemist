"use client";

import { Loader2 } from "lucide-react";

type TestType = "matchup_analysis" | "duel_simulation" | "strategic_insights";

interface LoadingOverlayProps {
  isLoading: boolean;
  testType: TestType;
  numSimulations: number;
}

export function LoadingOverlay({
  isLoading,
  testType,
  numSimulations,
}: LoadingOverlayProps) {
  if (!isLoading) return null;

  return (
    <div className="absolute inset-0 flex items-center justify-center bg-slate-950/80 backdrop-blur-sm z-10 pointer-events-none">
      <div className="flex flex-col items-center gap-3">
        <Loader2 className="h-8 w-8 animate-spin text-accent-cyan" />
        <div className="text-accent-cyan/90 font-medium">
          {testType === "duel_simulation"
            ? `Simulating ${numSimulations} duels...`
            : "Analyzing matchup..."}
        </div>
      </div>
    </div>
  );
}

