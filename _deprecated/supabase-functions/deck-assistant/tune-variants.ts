/**
 * Server-side copy-variant Monte Carlo for tune_copies mode.
 * Only these validated deltas may be cited by Groq.
 */

import type { Card, Deck } from "./types.ts";
import {
  buildTaggedMainDeck,
  VARIANT_ITERATIONS,
  type StrategyWeightRow,
} from "./get-facts-edge.ts";
import { simulateConsistency } from "../_shared/engine/consistency.ts";
import type { ConsistencyStats, FactsEnvelope } from "../_shared/engine/types.ts";
import { EvidenceIds } from "./assistant-contract.ts";
import { formatPlayerChangeReason } from "./player-voice.ts";

export interface CopyVariant {
  cardId: string;
  cardName: string;
  fromCopies: number;
  toCopies: number;
  factsDelta: {
    starterAccess: number;
    brickRate: number;
    oneInterruptionSurvival: number;
  };
  mainDeckSizeAfter: number;
  evidenceId: string;
  /** Higher = more useful to surface to the coach */
  score: number;
}

const MAX_VARIANTS = 12;

function mainSize(deck: Deck): number {
  return deck.mainDeck.reduce((s, c) => s + (c.count ?? 1), 0);
}

function cloneDeck(deck: Deck): Deck {
  return {
    mainDeck: deck.mainDeck.map((c) => ({
      cardId: c.cardId,
      count: c.count ?? 1,
    })),
    extraDeck: deck.extraDeck.map((c) => ({
      cardId: c.cardId,
      count: c.count ?? 1,
    })),
    sideDeck: deck.sideDeck.map((c) => ({
      cardId: c.cardId,
      count: c.count ?? 1,
    })),
  };
}

function applyMainCopyChange(
  deck: Deck,
  cardId: number,
  toCopies: number,
): Deck | null {
  const next = cloneDeck(deck);
  const idx = next.mainDeck.findIndex((c) => c.cardId === cardId);
  if (toCopies <= 0) {
    if (idx < 0) return null;
    next.mainDeck.splice(idx, 1);
  } else if (idx < 0) {
    if (toCopies > 3) return null;
    next.mainDeck.push({ cardId, count: toCopies });
  } else {
    if (toCopies > 3) return null;
    next.mainDeck[idx] = { cardId, count: toCopies };
  }
  const size = mainSize(next);
  if (size < 40 || size > 60) return null;
  return next;
}

function delta(
  baseline: ConsistencyStats,
  next: ConsistencyStats,
): CopyVariant["factsDelta"] {
  return {
    starterAccess: next.starterAccess - baseline.starterAccess,
    brickRate: next.brickRate - baseline.brickRate,
    oneInterruptionSurvival:
      next.oneInterruptionSurvival - baseline.oneInterruptionSurvival,
  };
}

function variantScore(
  d: CopyVariant["factsDelta"],
  from: number,
  to: number,
  sizeBefore: number,
  sizeAfter: number,
): number {
  // Prefer lower brick, higher starter access / survival; bonus for cutting toward 40
  let score =
    d.starterAccess * 2.0 -
    d.brickRate * 2.5 +
    d.oneInterruptionSurvival * 1.5;
  if (sizeBefore > 40 && sizeAfter < sizeBefore && to < from) {
    score += 0.15 * (sizeBefore - sizeAfter);
  }
  // Prefer meaningful magnitude
  score += Math.abs(d.starterAccess) + Math.abs(d.brickRate);
  return score;
}

/**
 * Pick candidate main-deck cards and evaluate ±1 copy changes.
 */
export function computeCopyVariants(args: {
  deck: Deck;
  allCards: Card[];
  weights: StrategyWeightRow[];
  baseline: FactsEnvelope;
  iterations?: number;
  /** Prefer simulating these card IDs first (NLP entity resolution). */
  preferCardIds?: string[];
}): CopyVariant[] {
  const {
    deck,
    allCards,
    weights,
    baseline,
    iterations = VARIANT_ITERATIONS,
    preferCardIds = [],
  } = args;
  const cardMap = new Map(allCards.map((c) => [c.id, c]));
  const sizeBefore = mainSize(deck);
  const baselineStats = baseline.consistency;
  const prefer = new Set(preferCardIds.map(String));

  // Prefer NLP-targeted cards, then 2–3 ofs when cutting, oversized pressure.
  // Coalesce split main-deck rows for the same cardId so we never emit duplicate variants.
  const countById = new Map<number, number>();
  for (const c of deck.mainDeck) {
    countById.set(c.cardId, (countById.get(c.cardId) ?? 0) + (c.count ?? 1));
  }
  const candidates = [...countById.entries()]
    .map(([cardId, count]) => ({
      cardId,
      count,
      name: cardMap.get(cardId)?.name ?? `Card ${cardId}`,
    }))
    .filter((c) => c.count >= 1)
    .sort((a, b) => {
      const ap = prefer.has(String(a.cardId)) ? 1 : 0;
      const bp = prefer.has(String(b.cardId)) ? 1 : 0;
      if (ap !== bp) return bp - ap;
      return b.count - a.count;
    })
    .slice(0, 10);

  const variants: CopyVariant[] = [];
  const seenKeys = new Set<string>();

  for (const cand of candidates) {
    const targets: number[] = [];
    if (cand.count > 1) targets.push(cand.count - 1);
    if (cand.count < 3 && sizeBefore < 60) targets.push(cand.count + 1);
    // Extra cut pressure when oversized
    if (sizeBefore > 40 && cand.count === 1) {
      targets.push(0);
    }

    for (const to of [...new Set(targets)]) {
      if (to === cand.count) continue;
      const dedupeKey = `${cand.cardId}:${cand.count}->${to}`;
      if (seenKeys.has(dedupeKey)) continue;
      seenKeys.add(dedupeKey);
      const nextDeck = applyMainCopyChange(deck, cand.cardId, to);
      if (!nextDeck) continue;

      const tagged = buildTaggedMainDeck(nextDeck, allCards, weights);
      const stats = simulateConsistency(tagged, { iterations });
      const factsDelta = delta(baselineStats, stats);
      const sizeAfter = mainSize(nextDeck);
      const evidenceId = EvidenceIds.variant(cand.cardId, cand.count, to);
      variants.push({
        cardId: String(cand.cardId),
        cardName: cand.name,
        fromCopies: cand.count,
        toCopies: to,
        factsDelta,
        mainDeckSizeAfter: sizeAfter,
        evidenceId,
        score:
          variantScore(
            factsDelta,
            cand.count,
            to,
            sizeBefore,
            sizeAfter,
          ) + (prefer.has(String(cand.cardId)) ? 0.35 : 0),
      });
    }
  }

  return variants
    .sort((a, b) => b.score - a.score)
    .slice(0, MAX_VARIANTS);
}

export function formatVariantsForPrompt(variants: CopyVariant[]): string {
  if (variants.length === 0) {
    return "# SERVER_VARIANTS\nNone computed — do not invent copy deltas.";
  }
  const lines = variants.map((v) => {
    const slang = formatPlayerChangeReason({
      cardName: v.cardName,
      fromCopies: v.fromCopies,
      toCopies: v.toCopies,
      factsDelta: v.factsDelta,
    });
    return `- ${v.evidenceId} | ${v.cardName} ${v.fromCopies}→${v.toCopies} | player="${slang}" | internal_delta starter=${v.factsDelta.starterAccess.toFixed(4)} brick=${v.factsDelta.brickRate.toFixed(4)} survive=${v.factsDelta.oneInterruptionSurvival.toFixed(4)} | mainAfter=${v.mainDeckSizeAfter}`;
  });
  return `# SERVER_VARIANTS (cite player= strings in answer; never dump internal_delta decimals to the user)\n${lines.join("\n")}`;
}
