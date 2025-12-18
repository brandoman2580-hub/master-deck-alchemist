import { Gauge, Shield, Swords, Zap } from "lucide-react";
import type { AnalysisMode } from "./types";

export const ANALYSIS_MODES: AnalysisMode[] = [
  {
    id: "consistency",
    label: "Consistency",
    description: "Reduce bricking, tighten ratios, and improve starters.",
    prompt: "Check my deck for consistency issues and safer ratios.",
    accent: "from-cyan-500/30 via-sky-500/30 to-emerald-400/25",
    icon: Gauge,
  },
  {
    id: "power",
    label: "Power",
    description: "Raise your ceiling, win conditions, and end boards.",
    prompt: "Highlight stronger win lines and missing power cards.",
    accent: "from-fuchsia-500/30 via-purple-500/30 to-cyan-400/25",
    icon: Zap,
  },
  {
    id: "interaction",
    label: "Interaction",
    description: "Add disruption, protection, and ways to grind.",
    prompt: "Find better interaction and resilience options.",
    accent: "from-amber-500/25 via-orange-500/25 to-red-400/25",
    icon: Shield,
  },
  {
    id: "meta",
    label: "Meta",
    description: "Tech and side options for top matchups.",
    prompt: "Suggest matchup counters and side deck upgrades.",
    accent: "from-indigo-500/25 via-blue-500/25 to-cyan-400/20",
    icon: Swords,
  },
];

