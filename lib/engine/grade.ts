import type {
  ConsistencyStats,
  DiagnosticsBlock,
  MatchupReadiness,
  WorkshopGradeAxes,
} from "./types";

function clamp100(n: number): number {
  return Math.min(100, Math.max(0, Math.round(n)));
}

function letterFromAverage(avg: number): WorkshopGradeAxes["letter"] {
  if (avg >= 90) return "S";
  if (avg >= 80) return "A";
  if (avg >= 70) return "B";
  if (avg >= 55) return "C";
  if (avg >= 40) return "D";
  return "F";
}

/**
 * Derive workshop grade axes from Facts Brain consistency + diagnostics (+ optional matchups).
 */
export function gradeFromFacts(input: {
  consistency: ConsistencyStats;
  diagnostics: DiagnosticsBlock;
  matchups?: MatchupReadiness[];
}): WorkshopGradeAxes {
  const { consistency, diagnostics, matchups = [] } = input;
  const roles = diagnostics.roleCoverage;

  const consistencyScore = clamp100(
    consistency.n > 0
      ? consistency.starterAccess * 55 +
          (1 - consistency.brickRate) * 25 +
          consistency.oneInterruptionSurvival * 20
      : 0,
  );

  const disruptionScore = clamp100(
    Math.min(40, roles.handTraps * 8) + Math.min(40, roles.boardBreakers * 10) +
      Math.min(20, roles.locks * 10),
  );

  const powerScore = clamp100(
    Math.min(45, roles.endboardPieces * 12) +
      Math.min(35, roles.extenders * 5) +
      Math.min(20, diagnostics.bosses.length * 8),
  );

  const matchupAvg =
    matchups.length > 0
      ? matchups.reduce((sum, m) => sum + (50 + m.tagAdvantage * 22), 0) /
        matchups.length
      : 50;

  const resilienceScore = clamp100(
    consistency.oneInterruptionSurvival * 50 +
      (1 - consistency.brickRate) * 20 +
      matchupAvg * 0.3,
  );

  const avg =
    (consistencyScore + disruptionScore + powerScore + resilienceScore) / 4;

  return {
    consistency: consistencyScore,
    power: powerScore,
    resilience: resilienceScore,
    disruption: disruptionScore,
    letter: letterFromAverage(avg),
  };
}
