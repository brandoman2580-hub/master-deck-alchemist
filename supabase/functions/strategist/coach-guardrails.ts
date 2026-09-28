/**
 * Server-owned coach clamps: tuning from variants, evidence ID allowlist.
 * Deno mirror of lib/engine/coach-guardrails.ts.
 */

import { EvidenceIds } from "./assistant-contract.ts";
import type {
  DeckCoachResponse,
  EvidenceClaim,
  TuningBlock,
  TuningRecommendation,
} from "./assistant-contract.ts";
import type { EngineCondition } from "./engine-conditions.ts";
import type { CopyVariant } from "./tune-variants.ts";
import type { FactsEnvelope } from "../_shared/engine/types.ts";
import {
  defaultPlayerTradeoffs,
  formatPlayerChangeReason,
} from "./player-voice.ts";
import {
  containsEngineerMetrics,
  stripEngineerMetrics,
} from "./yugioh-slang.ts";

/** Minimal retrieved row shape to avoid circular import with coach-response. */
export interface RetrievedCardRef {
  card: { id: number | string };
  condition: { evidenceId: string };
}

/**
 * Build tuning SoT exclusively from Monte Carlo SERVER_VARIANTS.
 * changeReason is player slang — never raw Δ dumps.
 */
export function buildTuningFromVariants(
  variants: CopyVariant[],
  limit = 5,
): TuningBlock {
  const seen = new Set<string>();
  const top: CopyVariant[] = [];
  for (const v of variants) {
    const key = `${v.cardId}:${v.fromCopies}->${v.toCopies}`;
    if (seen.has(key)) continue;
    seen.add(key);
    top.push(v);
    if (top.length >= limit) break;
  }
  return {
    recommendation: top.map((v) => ({
      cardId: v.cardId,
      fromCopies: v.fromCopies,
      toCopies: v.toCopies,
      changeReason: formatPlayerChangeReason({
        cardName: v.cardName,
        fromCopies: v.fromCopies,
        toCopies: v.toCopies,
        factsDelta: v.factsDelta,
      }),
      evidenceIds: [v.evidenceId, EvidenceIds.consistency],
    })),
    tradeoffs: defaultPlayerTradeoffs(),
  };
}

/**
 * Merge optional Groq changeReason text onto server rows when cardId/from/to match.
 */
export function mergeGroqTuningReasons(
  server: TuningBlock,
  groq: TuningBlock | undefined,
): TuningBlock {
  if (!groq?.recommendation?.length) return server;
  const byKey = new Map<string, TuningRecommendation>(
    groq.recommendation.map((r: TuningRecommendation) => [
      `${r.cardId}:${r.fromCopies}->${r.toCopies}`,
      r,
    ]),
  );
  return {
    recommendation: server.recommendation.map((row: TuningRecommendation) => {
      const key = `${row.cardId}:${row.fromCopies}->${row.toCopies}`;
      const g = byKey.get(key);
      if (
        g?.changeReason?.trim() &&
        g.evidenceIds?.includes(row.evidenceIds[0]!) &&
        !containsEngineerMetrics(g.changeReason)
      ) {
        return {
          ...row,
          changeReason: stripEngineerMetrics(g.changeReason).slice(0, 600),
        };
      }
      return row;
    }),
    tradeoffs:
      groq.tradeoffs?.length && groq.tradeoffs.length > 0
        ? groq.tradeoffs
          .map((t) => stripEngineerMetrics(t))
          .filter((t) => t.length > 0 && !containsEngineerMetrics(t))
          .slice(0, 8)
        : server.tradeoffs,
  };
}

/** Stable evidence IDs always present for a FactsEnvelope. */
export function collectFactsEvidenceIds(facts: FactsEnvelope): string[] {
  const ids: string[] = [
    EvidenceIds.consistency,
    EvidenceIds.roleCoverage,
    EvidenceIds.strategyFit,
    EvidenceIds.collisions,
    EvidenceIds.bosses,
    EvidenceIds.matchups,
    EvidenceIds.combos,
    EvidenceIds.grade,
    EvidenceIds.gradeBreakdown,
    EvidenceIds.formatRulePack,
    EvidenceIds.legality,
    EvidenceIds.mainDeckSize,
    EvidenceIds.restrictions,
  ];
  for (const boss of facts.diagnostics.bosses) {
    ids.push(EvidenceIds.card(boss.cardId));
  }
  for (const r of facts.diagnostics.restrictions ?? []) {
    ids.push(r.evidenceId);
    ids.push(EvidenceIds.card(r.cardId));
  }
  return ids;
}

export function collectAllowedEvidenceIds(args: {
  facts: FactsEnvelope;
  variants?: CopyVariant[];
  conditions?: EngineCondition[];
  retrieved?: RetrievedCardRef[];
}): Set<string> {
  const allowed = new Set<string>(collectFactsEvidenceIds(args.facts));
  allowed.add(EvidenceIds.coachScope);
  for (const v of args.variants ?? []) {
    allowed.add(v.evidenceId);
    allowed.add(EvidenceIds.card(v.cardId));
  }
  for (const c of args.conditions ?? []) {
    allowed.add(c.evidenceId);
  }
  for (const r of args.retrieved ?? []) {
    allowed.add(EvidenceIds.card(r.card.id));
    allowed.add(r.condition.evidenceId);
  }
  return allowed;
}

/**
 * Drop unknown evidence IDs; remove empty claims; note if scrubbing occurred.
 */
export function sanitizeCoachEvidence(
  coach: DeckCoachResponse,
  allowed: Set<string>,
): DeckCoachResponse {
  let scrubbed = false;
  const evidence: EvidenceClaim[] = [];

  for (const claim of coach.evidence) {
    const ids = claim.evidenceIds.filter((id) => allowed.has(id));
    if (ids.length === 0) {
      scrubbed = true;
      continue;
    }
    if (ids.length !== claim.evidenceIds.length) scrubbed = true;
    evidence.push({
      claim: stripEngineerMetrics(claim.claim).slice(0, 500) || claim.claim,
      evidenceIds: ids.slice(0, 6),
    });
  }

  if (evidence.length === 0) {
    evidence.push({
      claim: "Opening consistency from your current list",
      evidenceIds: [EvidenceIds.consistency],
    });
    scrubbed = true;
  }

  const limitations = [...coach.limitations]
    .map((l) => stripEngineerMetrics(l))
    .filter(Boolean);
  if (scrubbed) {
    const note =
      "Some supporting details were limited to verified deck and card data.";
    if (!limitations.includes(note) && limitations.length < 5) {
      limitations.push(note);
    }
  }

  const confidence =
    scrubbed && coach.confidence === "high" ? "medium" : coach.confidence;

  let answer = stripEngineerMetrics(coach.answer);
  if (!answer) answer = coach.answer;

  return {
    ...coach,
    answer: answer.slice(0, 2400),
    evidence: evidence.slice(0, 12),
    limitations: limitations.slice(0, 5),
    confidence,
  };
}

/**
 * Force server-owned actionable blocks for tune_copies / discover_synergy / optimize.
 */
export function clampCoachActionables(args: {
  coach: DeckCoachResponse;
  mode: DeckCoachResponse["mode"];
  variants: CopyVariant[];
  synergiesBuilder: () => DeckCoachResponse["synergies"];
  recommendationsBuilder?: () => DeckCoachResponse["recommendations"];
}): DeckCoachResponse {
  const {
    coach,
    mode,
    variants,
    synergiesBuilder,
    recommendationsBuilder,
  } = args;
  let next: DeckCoachResponse = { ...coach, mode };

  if (mode === "tune_copies" || mode === "optimize") {
    const server = buildTuningFromVariants(variants);
    next = {
      ...next,
      tuning: mergeGroqTuningReasons(server, coach.tuning),
    };
  }

  if (mode === "discover_synergy" || mode === "optimize") {
    next = {
      ...next,
      synergies: synergiesBuilder(),
    };
  }

  if (mode === "optimize" && recommendationsBuilder) {
    next = {
      ...next,
      recommendations: recommendationsBuilder(),
    };
  } else if (mode !== "optimize") {
    // Keep optional recommendations if Groq emitted them on other modes; strip unknown
    if (coach.recommendations?.length) {
      next = { ...next, recommendations: coach.recommendations.slice(0, 10) };
    }
  }

  return next;
}

/** Exported for tests — validate a single tuning row is in the variant set. */
export function isTuningRowInVariants(
  row: TuningRecommendation,
  variants: CopyVariant[],
): boolean {
  return variants.some(
    (v) =>
      v.cardId === row.cardId &&
      v.fromCopies === row.fromCopies &&
      v.toCopies === row.toCopies,
  );
}
