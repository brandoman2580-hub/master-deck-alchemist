/**
 * Deno mirror of lib/engine/matchups.ts (tag readiness).
 */

import type {
  ConsistencyStats,
  DiagnosticsBlock,
  MatchupReadiness,
  YugiohPlayStrategy,
} from "./types.ts";

export interface MetaMatchupTemplate {
  name: string;
  opponentArchetype: string;
  opponentDeckId?: string;
  tier: "1" | "2" | "3";
  metaShare: number;
  strategy?: YugiohPlayStrategy | null;
  playstyle?: string | null;
}

export interface MatchupScoreInput {
  diagnostics: DiagnosticsBlock;
  consistency: ConsistencyStats;
  templates: MetaMatchupTemplate[];
}

function opponentPressure(template: MetaMatchupTemplate): {
  disruptionNeed: number;
  consistencyPressure: number;
} {
  const strategy = template.strategy ?? null;
  const playstyle = (template.playstyle ?? "").toLowerCase();

  if (
    strategy === "Combo" ||
    strategy === "OTK / FTK" ||
    strategy === "Swarm" ||
    playstyle.includes("combo")
  ) {
    return { disruptionNeed: 0.75, consistencyPressure: 0.55 };
  }
  if (
    strategy === "Control" ||
    strategy === "Stun / Floodgate" ||
    playstyle.includes("control") ||
    playstyle.includes("stun")
  ) {
    return { disruptionNeed: 0.45, consistencyPressure: 0.7 };
  }
  if (
    strategy === "Aggro / Beatdown" ||
    playstyle.includes("aggro") ||
    playstyle.includes("beat")
  ) {
    return { disruptionNeed: 0.55, consistencyPressure: 0.5 };
  }
  return { disruptionNeed: 0.55, consistencyPressure: 0.55 };
}

function clamp(n: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, n));
}

export function scoreMatchupReadiness(
  input: MatchupScoreInput,
): MatchupReadiness[] {
  const { diagnostics, consistency, templates } = input;
  const roles = diagnostics.roleCoverage;
  const mainProxy = Math.max(
    1,
    roles.starters +
      roles.extenders +
      roles.handTraps +
      roles.boardBreakers +
      roles.endboardPieces +
      roles.locks,
  );

  const htDensity = roles.handTraps / mainProxy;
  const breakerDensity = roles.boardBreakers / mainProxy;
  const starterRate = consistency.starterAccess;
  const brick = consistency.brickRate;

  return templates.map((template) => {
    const pressure = opponentPressure(template);
    const disruptionScore =
      htDensity * 0.6 + breakerDensity * 0.4 - pressure.disruptionNeed * 0.35;
    const consistencyScore =
      starterRate * 0.7 +
      consistency.oneInterruptionSurvival * 0.3 -
      brick * 0.5 -
      pressure.consistencyPressure * 0.15;

    const tagAdvantage = clamp(
      disruptionScore * 0.55 + consistencyScore * 0.45,
      -1,
      1,
    );

    const notes: string[] = [];
    if (htDensity < 0.08 && pressure.disruptionNeed > 0.6) {
      notes.push("Low hand-trap density vs combo-leaning meta deck");
    }
    if (breakerDensity < 0.05 && pressure.disruptionNeed > 0.5) {
      notes.push("Few board breakers for going-second pressure");
    }
    if (brick > 0.25) {
      notes.push("Elevated brick rate hurts race matchups");
    }
    if (starterRate >= 0.75) {
      notes.push("Strong starter access supports proactive lines");
    }

    return {
      opponentArchetype: template.opponentArchetype || template.name,
      opponentDeckId: template.opponentDeckId,
      tier: template.tier,
      metaShare: template.metaShare,
      starterAccessDelta: clamp(
        starterRate - pressure.consistencyPressure,
        -1,
        1,
      ),
      brickRateDelta: clamp(
        pressure.consistencyPressure * 0.4 - brick,
        -1,
        1,
      ),
      tagAdvantage,
      opponentStrategy: template.strategy ?? null,
      disruptionScore: clamp(disruptionScore, -1, 1),
      consistencyScore: clamp(consistencyScore, -1, 1),
      notes,
    };
  });
}
