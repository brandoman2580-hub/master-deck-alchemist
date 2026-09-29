import {
  emptyWorkshopGradeAxes,
  gradeFromFacts,
  type GradeFromFactsInput,
} from "@/lib/engine/grade";
import type { WorkshopGradeAxes } from "@/lib/engine/types";

export type WorkshopGradeScore = {
  label: string;
  value: number;
};

export type WorkshopGradeBreakdownLine = {
  key: string;
  label: string;
  value: number;
  note?: string;
};

export type WorkshopGrade = {
  letter: string;
  scores: WorkshopGradeScore[];
  /** Present when grade comes from Facts Brain (schema ≥ 0.2.0). */
  synergyFactor?: number;
  formatRulePack?: string;
  formatPackNotes?: string[];
  synergyNotes?: string[];
  breakdown?: {
    consistency: WorkshopGradeBreakdownLine[];
    power: WorkshopGradeBreakdownLine[];
    resilience: WorkshopGradeBreakdownLine[];
    disruption: WorkshopGradeBreakdownLine[];
  };
};

/**
 * Map Facts Brain axes → chrome labels.
 * Tolerates pre-0.2.0 cached grades that lack breakdown / pack metadata.
 */
export function workshopGradeFromAxes(
  axes: WorkshopGradeAxes | null | undefined,
): WorkshopGrade {
  const fallback = emptyWorkshopGradeAxes();
  const safe = axes ?? fallback;
  const breakdown = safe.breakdown ?? fallback.breakdown;

  return {
    letter: safe.letter ?? fallback.letter,
    scores: [
      { label: "Consistency", value: safe.consistency ?? 0 },
      { label: "Resilience", value: safe.resilience ?? 0 },
      { label: "Power", value: safe.power ?? 0 },
      { label: "Disruption", value: safe.disruption ?? 0 },
    ],
    synergyFactor: safe.synergyFactor ?? fallback.synergyFactor,
    formatRulePack: safe.formatRulePack ?? fallback.formatRulePack,
    formatPackNotes: breakdown.formatPackNotes ?? [],
    synergyNotes: breakdown.synergyNotes ?? [],
    breakdown: {
      consistency: breakdown.consistency ?? [],
      power: breakdown.power ?? [],
      resilience: breakdown.resilience ?? [],
      disruption: breakdown.disruption ?? [],
    },
  };
}

/**
 * Preferred path: grade from Facts Brain axes.
 */
export function gradeFromWorkshopFacts(
  input: GradeFromFactsInput,
): WorkshopGrade {
  return workshopGradeFromAxes(gradeFromFacts(input));
}

/**
 * @deprecated Size-only placeholder — prefer gradeFromWorkshopFacts / FactsEnvelope.grade
 */
export function gradeFromCounts(main: number, extra: number): WorkshopGrade {
  const density = Math.min(100, Math.round((main / 40) * 100));
  const extraScore = Math.min(100, Math.round((extra / 15) * 100));
  const consistency = Math.round((density + extraScore) / 2);
  const letter =
    consistency >= 90
      ? "S"
      : consistency >= 75
        ? "A"
        : consistency >= 60
          ? "B"
          : "C";

  return {
    letter,
    scores: [
      { label: "Consistency", value: consistency },
      { label: "Resilience", value: Math.max(40, consistency - 5) },
      { label: "Power", value: Math.max(45, extraScore) },
      { label: "Disruption", value: Math.max(35, Math.round(consistency * 0.9)) },
    ],
  };
}
