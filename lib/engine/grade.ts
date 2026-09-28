import type { BanStatus } from "@/types/types";
import { applyFormatRulePack } from "./format-rule-packs";
import {
  computePrimaryArchetypeShare,
  computeSynergyModifier,
} from "./synergy-modifier";
import type {
  ComboGraphSummary,
  ConsistencyStats,
  DiagnosticsBlock,
  EngineFormat,
  GradeAxisContribution,
  GradeBreakdown,
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

export interface GradeFromFactsInput {
  consistency: ConsistencyStats;
  diagnostics: DiagnosticsBlock;
  matchups?: MatchupReadiness[];
  combos?: ComboGraphSummary;
  format: EngineFormat;
  /** Banlist for the active format only. */
  banlist?: Record<string, BanStatus | string>;
  mainDeckCardNames?: string[];
  /** Main + extra cards for archetype share. */
  engineCards?: Array<{ archetype?: string | null }>;
}

function emptyBreakdown(): GradeBreakdown {
  return {
    consistency: [],
    power: [],
    resilience: [],
    disruption: [],
    synergyNotes: [],
    formatPackNotes: [],
  };
}

/**
 * Derive workshop grade axes from Facts Brain consistency + diagnostics
 * (+ matchups, format rule packs, internal synergy).
 */
export function gradeFromFacts(input: GradeFromFactsInput): WorkshopGradeAxes {
  const {
    consistency,
    diagnostics,
    matchups = [],
    combos = { lines: [], source: "empty" as const },
    format,
    banlist,
    mainDeckCardNames = [],
    engineCards = [],
  } = input;
  const roles = diagnostics.roleCoverage;

  const starterPart =
    consistency.n > 0 ? consistency.starterAccess * 55 : 0;
  const brickPart =
    consistency.n > 0 ? (1 - consistency.brickRate) * 25 : 0;
  const survivalPartC =
    consistency.n > 0 ? consistency.oneInterruptionSurvival * 20 : 0;

  let consistencyScore = clamp100(starterPart + brickPart + survivalPartC);

  const htPart = Math.min(40, roles.handTraps * 8);
  const breakerPart = Math.min(40, roles.boardBreakers * 10);
  const lockPart = Math.min(20, roles.locks * 10);
  let disruptionScore = clamp100(htPart + breakerPart + lockPart);

  const endboardPart = Math.min(45, roles.endboardPieces * 12);
  const extenderPart = Math.min(35, roles.extenders * 5);
  const bossPart = Math.min(20, diagnostics.bosses.length * 8);
  let powerScore = clamp100(endboardPart + extenderPart + bossPart);

  const matchupAvg =
    matchups.length > 0
      ? matchups.reduce((sum, m) => sum + (50 + m.tagAdvantage * 22), 0) /
        matchups.length
      : 50;

  const survivalPartR = consistency.oneInterruptionSurvival * 50;
  const brickPartR = (1 - consistency.brickRate) * 20;
  const matchupPartR = matchupAvg * 0.3;
  let resilienceScore = clamp100(survivalPartR + brickPartR + matchupPartR);

  const archetypeShare = computePrimaryArchetypeShare(
    engineCards,
    diagnostics.strategyFit.primaryArchetype,
  );
  const synergy = computeSynergyModifier({
    strategyFit: diagnostics.strategyFit,
    primaryArchetypeShare: archetypeShare,
    combos,
    collisions: diagnostics.collisions,
  });

  consistencyScore = clamp100(consistencyScore * synergy.factor);
  powerScore = clamp100(powerScore * synergy.factor);

  const pack = applyFormatRulePack({
    format,
    banlist,
    mainDeckCardNames,
    roleCoverage: roles,
  });
  resilienceScore = clamp100(resilienceScore + pack.resilienceDelta);
  disruptionScore = clamp100(disruptionScore + pack.disruptionDelta);

  const avg =
    (consistencyScore + disruptionScore + powerScore + resilienceScore) / 4;

  const consistencyBreakdown: GradeAxisContribution[] = [
    {
      key: "starterAccess",
      label: "Starter access",
      value: Math.round(starterPart),
      note: consistency.n > 0
        ? `Monte Carlo starterAccess=${consistency.starterAccess.toFixed(3)}`
        : "Consistency not computed",
    },
    {
      key: "brickRate",
      label: "Non-brick rate",
      value: Math.round(brickPart),
      note:
        consistency.n > 0
          ? `brickRate=${consistency.brickRate.toFixed(3)}`
          : undefined,
    },
    {
      key: "oneHTSurvival",
      label: "1-HT survival (consistency share)",
      value: Math.round(survivalPartC),
    },
    {
      key: "synergyFactor",
      label: "Synergy modifier",
      value: synergy.factor,
      note: "Internal — applied to Consistency/Power only",
    },
  ];

  const powerBreakdown: GradeAxisContribution[] = [
    {
      key: "endboard",
      label: "Endboard pieces",
      value: Math.round(endboardPart),
      note: `${roles.endboardPieces} roles`,
    },
    {
      key: "extenders",
      label: "Extenders",
      value: Math.round(extenderPart),
      note: `${roles.extenders} roles`,
    },
    {
      key: "bosses",
      label: "Bosses",
      value: Math.round(bossPart),
      note: `${diagnostics.bosses.length} bosses`,
    },
    {
      key: "synergyFactor",
      label: "Synergy modifier",
      value: synergy.factor,
      note: "Internal — applied to Consistency/Power only",
    },
  ];

  const resilienceBreakdown: GradeAxisContribution[] = [
    {
      key: "oneHTSurvival",
      label: "1-HT survival",
      value: Math.round(survivalPartR),
    },
    {
      key: "brickRate",
      label: "Non-brick rate",
      value: Math.round(brickPartR),
    },
    {
      key: "matchupAvg",
      label: "Matchup readiness",
      value: Math.round(matchupPartR),
      note: matchups.length
        ? `${matchups.length} tag matchups`
        : "No matchups — neutral 50 baseline",
    },
    {
      key: "formatPack",
      label: `Format pack (${pack.packId})`,
      value: pack.resilienceDelta,
      note: pack.maxxPressureActive
        ? `Maxx outs in Main: ${pack.maxxOutCount}`
        : undefined,
    },
  ];

  const disruptionBreakdown: GradeAxisContribution[] = [
    {
      key: "handTraps",
      label: "Hand traps",
      value: Math.round(htPart),
      note: `${roles.handTraps} roles`,
    },
    {
      key: "boardBreakers",
      label: "Board breakers",
      value: Math.round(breakerPart),
      note: `${roles.boardBreakers} roles`,
    },
    {
      key: "locks",
      label: "Locks",
      value: Math.round(lockPart),
      note: `${roles.locks} roles`,
    },
    {
      key: "formatPack",
      label: `Format pack (${pack.packId})`,
      value: pack.disruptionDelta,
    },
  ];

  const breakdown: GradeBreakdown = {
    consistency: consistencyBreakdown,
    power: powerBreakdown,
    resilience: resilienceBreakdown,
    disruption: disruptionBreakdown,
    synergyNotes: synergy.notes,
    formatPackNotes: pack.notes,
  };

  return {
    consistency: consistencyScore,
    power: powerScore,
    resilience: resilienceScore,
    disruption: disruptionScore,
    letter: letterFromAverage(avg),
    synergyFactor: synergy.factor,
    formatRulePack: pack.packId,
    breakdown,
  };
}

/** Neutral grade shell for tests / empty envelopes. */
export function emptyWorkshopGradeAxes(): WorkshopGradeAxes {
  return {
    consistency: 0,
    power: 0,
    resilience: 0,
    disruption: 0,
    letter: "F",
    synergyFactor: 1,
    formatRulePack: "none",
    breakdown: emptyBreakdown(),
  };
}
