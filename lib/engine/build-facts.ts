import type { BanStatus, DeckType } from "@/types/types";
import { computeDeckHash, toEngineFormat } from "./deck-hash";
import {
  buildDiagnostics,
  type ArchetypeStrategyRow,
  type StrategyWeightRow,
} from "./diagnostics";
import { evaluateDeckLegality, isDeckPersisted } from "./legality";
import { gradeFromFacts } from "./grade";
import {
  FACTS_SCHEMA_VERSION,
  type ConsistencyStats,
  type FactsEnvelope,
  type MatchupReadiness,
} from "./types";

export interface BuildFactsOptions {
  banlist?: Record<string, BanStatus | string>;
  savedDeckIds?: ReadonlySet<string>;
  strategyWeights?: StrategyWeightRow[];
  archetypeStrategies?: ArchetypeStrategyRow[];
  /** When true, legality requires a persisted deck (Assistant path). */
  requirePersisted?: boolean;
  /** Phase 2+ Monte Carlo results */
  consistency?: ConsistencyStats;
  /** Phase 2+ tag matchup scores */
  matchups?: MatchupReadiness[];
  /** Phase 3 combo graphs */
  combos?: FactsEnvelope["combos"];
}

const EMPTY_CONSISTENCY: ConsistencyStats = {
  n: 0,
  starterAccess: 0,
  brickRate: 0,
  oneInterruptionSurvival: 0,
};

/**
 * Builds a FactsEnvelope.
 * Pass consistency/matchups from Phase 2 workers when available.
 */
export function buildFactsEnvelope(
  deck: DeckType,
  options: BuildFactsOptions = {},
): FactsEnvelope {
  const format = toEngineFormat(deck.mode);
  const isPersisted = isDeckPersisted(deck, options.savedDeckIds);
  const legality = evaluateDeckLegality(deck, {
    banlist: options.banlist,
    isPersisted,
    requirePersisted: options.requirePersisted ?? false,
  });

  const diagnostics = buildDiagnostics(deck, format, {
    strategyWeights: options.strategyWeights,
    archetypeStrategies: options.archetypeStrategies,
  });

  const consistency = options.consistency ?? EMPTY_CONSISTENCY;
  const matchups = options.matchups ?? [];
  const combos = options.combos ?? { lines: [], source: "empty" as const };
  const grade = gradeFromFacts({ consistency, diagnostics, matchups });

  return {
    schemaVersion: FACTS_SCHEMA_VERSION,
    deckId: deck.id,
    deckHash: computeDeckHash(deck),
    format,
    legality,
    diagnostics,
    consistency,
    matchups,
    combos,
    grade,
  };
}

/**
 * Compact prompt block for Groq coaching. Only includes validated facts.
 */
export function formatFactsForPrompt(facts: FactsEnvelope): string {
  const { diagnostics, legality, format, consistency, matchups, grade } = facts;
  const collisions =
    diagnostics.collisions.length > 0
      ? diagnostics.collisions
          .map((c) => `- [${c.severity}] ${c.code}: ${c.message}`)
          .join("\n")
      : "- None";

  const bosses =
    diagnostics.bosses.length > 0
      ? diagnostics.bosses.map((b) => `${b.name} (${b.cardId})`).join(", ")
      : "None detected";

  const consistencyLine =
    consistency.n > 0
      ? `n=${consistency.n}, starterAccess=${consistency.starterAccess.toFixed(3)}, brickRate=${consistency.brickRate.toFixed(3)}, oneInterruptionSurvival=${consistency.oneInterruptionSurvival.toFixed(3)}`
      : "not computed";

  const matchupLines =
    matchups.length > 0
      ? matchups
          .slice(0, 12)
          .map(
            (m) =>
              `- ${m.opponentArchetype} (T${m.tier ?? "?"}): tagAdvantage=${m.tagAdvantage.toFixed(2)}`,
          )
          .join("\n")
      : "- none";

  return `# VALIDATED FACTS (Facts Brain — do not invent alternate metrics)

**Format:** ${format}
**Deck hash:** ${facts.deckHash}
**Legality:** ${legality.ok ? "OK" : "FAILED"}
${legality.errors.length ? legality.errors.map((e) => `- ${e}`).join("\n") : "- No legality errors"}

**Role coverage:** starters=${diagnostics.roleCoverage.starters}, extenders=${diagnostics.roleCoverage.extenders}, handTraps=${diagnostics.roleCoverage.handTraps}, boardBreakers=${diagnostics.roleCoverage.boardBreakers}, endboard=${diagnostics.roleCoverage.endboardPieces}, locks=${diagnostics.roleCoverage.locks}

**Strategy fit:** archetype=${diagnostics.strategyFit.primaryArchetype ?? "unknown"}, primary=${diagnostics.strategyFit.primaryStrategy ?? "n/a"}, fitScore=${diagnostics.strategyFit.fitScore}
${diagnostics.strategyFit.notes.map((n) => `- ${n}`).join("\n") || "-"}

**Bosses:** ${bosses}

**Structural collisions:**
${collisions}

**Consistency:** ${consistencyLine}

**Matchups (tag readiness):**
${matchupLines}

**Grade:** ${grade.letter} (C=${grade.consistency} P=${grade.power} R=${grade.resilience} D=${grade.disruption})

**Combos:** ${facts.combos.source} (${facts.combos.lines.length} lines) — only discuss lines present in facts; do not invent steps.`;
}
