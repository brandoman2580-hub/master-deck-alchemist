/**
 * Pure copy-variant delta helpers for unit tests / shared scoring.
 * Edge Monte Carlo lives in supabase/functions/strategist/tune-variants.ts.
 */

export interface ConsistencyDeltaInput {
  starterAccess: number;
  brickRate: number;
  oneInterruptionSurvival: number;
}

export function consistencyDelta(
  baseline: ConsistencyDeltaInput,
  next: ConsistencyDeltaInput,
): ConsistencyDeltaInput {
  return {
    starterAccess: next.starterAccess - baseline.starterAccess,
    brickRate: next.brickRate - baseline.brickRate,
    oneInterruptionSurvival:
      next.oneInterruptionSurvival - baseline.oneInterruptionSurvival,
  };
}

/**
 * Score a copy change: prefer lower brick, higher access/survival,
 * Main-toward-40 cuts on oversized lists, and NLP-preferred entities.
 */
export function scoreCopyVariant(args: {
  delta: ConsistencyDeltaInput;
  fromCopies: number;
  toCopies: number;
  sizeBefore: number;
  sizeAfter: number;
  preferred?: boolean;
  isStarter?: boolean;
  isExtender?: boolean;
}): number {
  const {
    delta,
    fromCopies,
    toCopies,
    sizeBefore,
    sizeAfter,
    preferred = false,
    isStarter = false,
    isExtender = false,
  } = args;

  let score =
    delta.starterAccess * 2.0 -
    delta.brickRate * 2.5 +
    delta.oneInterruptionSurvival * 1.5;

  const cutting = toCopies < fromCopies;
  const adding = toCopies > fromCopies;

  if (sizeBefore > 40 && sizeAfter < sizeBefore && cutting) {
    score += 0.35 * (sizeBefore - sizeAfter);
    if (!isStarter) score += 0.2;
    if (isExtender && fromCopies >= 2) score += 0.1;
  }

  if (sizeBefore > 40 && adding) {
    score -= 0.25;
  }

  if (sizeBefore <= 40 && sizeAfter === 40 && cutting) {
    score += 0.05;
  }

  score += Math.abs(delta.starterAccess) + Math.abs(delta.brickRate);

  if (preferred) score += 0.45;

  return score;
}

/**
 * Order main-deck candidates for Monte Carlo: preferred IDs first,
 * then high-count (especially when Main is oversized).
 */
export function selectTuneCandidateIds(args: {
  mainDeck: Array<{ cardId: number | string; count?: number }>;
  preferCardIds?: Array<number | string>;
  sizeBefore: number;
  candidateCap?: number;
}): number[] {
  const prefer = new Set((args.preferCardIds ?? []).map(String));
  const countById = new Map<number, number>();
  for (const c of args.mainDeck) {
    const id = Number(c.cardId);
    if (!Number.isFinite(id)) continue;
    countById.set(id, (countById.get(id) ?? 0) + (c.count ?? 1));
  }

  const allCandidates = [...countById.entries()].map(([cardId, count]) => ({
    cardId,
    count,
  }));

  const preferred = allCandidates
    .filter((c) => prefer.has(String(c.cardId)))
    .sort((a, b) => b.count - a.count);
  const rest = allCandidates
    .filter((c) => !prefer.has(String(c.cardId)))
    .sort((a, b) => {
      if (args.sizeBefore > 40 && a.count !== b.count) return b.count - a.count;
      return b.count - a.count;
    });

  const cap =
    args.candidateCap ?? (preferred.length > 0 ? 14 : 10);
  return [...preferred, ...rest].slice(0, cap).map((c) => c.cardId);
}
