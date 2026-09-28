/**
 * Server-owned coach clamps: tuning from variants, evidence ID allowlist.
 * Client mirror of edge coach-guardrails (pure helpers for Jest).
 */

import { EvidenceIds } from "./assistant-contract";
import type {
  DeckCoachResponse,
  EvidenceClaim,
  TuningBlock,
  TuningRecommendation,
} from "./assistant-contract";
import {
  defaultPlayerTradeoffs,
  formatPlayerChangeReason,
} from "./player-voice";
import {
  containsEngineerMetrics,
  stripEngineerMetrics,
} from "./yugioh-slang";

export interface GuardrailVariant {
  cardId: string;
  cardName?: string;
  fromCopies: number;
  toCopies: number;
  evidenceId: string;
  factsDelta: {
    starterAccess: number;
    brickRate: number;
    oneInterruptionSurvival: number;
  };
  packageHint?: string;
}

/**
 * Build tuning SoT exclusively from Monte Carlo SERVER_VARIANTS.
 * changeReason is player slang — never raw Δ dumps.
 */
export function buildTuningFromVariants(
  variants: GuardrailVariant[],
  limit = 5,
): TuningBlock {
  const seen = new Set<string>();
  const top: GuardrailVariant[] = [];
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
        packageHint: v.packageHint,
      }),
      evidenceIds: [v.evidenceId, EvidenceIds.consistency],
    })),
    tradeoffs: defaultPlayerTradeoffs(),
  };
}

export function mergeGroqTuningReasons(
  server: TuningBlock,
  groq: TuningBlock | undefined,
): TuningBlock {
  if (!groq?.recommendation?.length) return server;
  const byKey = new Map(
    groq.recommendation.map((r) => [
      `${r.cardId}:${r.fromCopies}->${r.toCopies}`,
      r,
    ]),
  );
  return {
    recommendation: server.recommendation.map((row) => {
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

export function collectAllowedEvidenceIds(args: {
  baseIds?: string[];
  variantEvidenceIds?: string[];
  conditionEvidenceIds?: string[];
  cardEvidenceIds?: string[];
}): Set<string> {
  const allowed = new Set<string>([
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
    EvidenceIds.coachScope,
    EvidenceIds.restrictions,
    ...(args.baseIds ?? []),
  ]);
  for (const id of args.variantEvidenceIds ?? []) allowed.add(id);
  for (const id of args.conditionEvidenceIds ?? []) allowed.add(id);
  for (const id of args.cardEvidenceIds ?? []) allowed.add(id);
  return allowed;
}

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

export function isTuningRowInVariants(
  row: TuningRecommendation,
  variants: GuardrailVariant[],
): boolean {
  return variants.some(
    (v) =>
      v.cardId === row.cardId &&
      v.fromCopies === row.fromCopies &&
      v.toCopies === row.toCopies,
  );
}
