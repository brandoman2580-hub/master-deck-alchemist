import type { WorkshopGrade } from "./workshop-grade-types";
import { gradeFromFacts } from "@/lib/engine/grade";
import type {
  ConsistencyStats,
  DiagnosticsBlock,
  MatchupReadiness,
  WorkshopGradeAxes,
} from "@/lib/engine/types";

export type { WorkshopGrade, WorkshopGradeScore } from "./workshop-grade-types";

export function workshopGradeFromAxes(axes: WorkshopGradeAxes): WorkshopGrade {
  return {
    letter: axes.letter,
    scores: [
      { label: "Consistency", value: axes.consistency },
      { label: "Resilience", value: axes.resilience },
      { label: "Power", value: axes.power },
      { label: "Disruption", value: axes.disruption },
    ],
  };
}

/**
 * Preferred path: grade from Facts Brain axes.
 */
export function gradeFromWorkshopFacts(input: {
  consistency: ConsistencyStats;
  diagnostics: DiagnosticsBlock;
  matchups?: MatchupReadiness[];
}): WorkshopGrade {
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
