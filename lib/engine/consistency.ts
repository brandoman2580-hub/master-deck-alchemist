import type { ConsistencyStats } from "./types";

/**
 * Minimal tagged main-deck copy for hand sampling.
 * Roles are precomputed on the main thread (or edge) before Monte Carlo.
 */
export interface TaggedMainCard {
  id: number;
  isStarter: boolean;
  isExtender: boolean;
  isHandTrap: boolean;
}

export interface ConsistencySimOptions {
  /** Opening hand size (Yu-Gi-Oh default 5). */
  handSize?: number;
  /** Iteration count; desktop budget targets ≤ ~300ms at ~2k–5k. */
  iterations?: number;
  /** Optional RNG for deterministic tests. */
  random?: () => number;
}

export interface HandOutcome {
  hasStarter: boolean;
  isBrick: boolean;
  survivesOneInterruption: boolean;
}

const DEFAULT_ITERATIONS = 3000;
const DEFAULT_HAND_SIZE = 5;

/**
 * Fisher–Yates shuffle (in-place) using provided RNG.
 */
export function fisherYatesShuffle<T>(
  items: T[],
  random: () => number = Math.random,
): T[] {
  for (let i = items.length - 1; i > 0; i -= 1) {
    const j = Math.floor(random() * (i + 1));
    const tmp = items[i]!;
    items[i] = items[j]!;
    items[j] = tmp;
  }
  return items;
}

/**
 * Classify a 5-card opening hand for consistency metrics.
 *
 * - Starter access: ≥1 starter
 * - Brick: no starter and no extender
 * - One-interruption survival: ≥2 starters OR (starter + extender)
 *   (proxy for still having a line after one hand trap)
 */
export function classifyOpeningHand(hand: TaggedMainCard[]): HandOutcome {
  let starters = 0;
  let extenders = 0;
  for (const card of hand) {
    if (card.isStarter) starters += 1;
    if (card.isExtender) extenders += 1;
  }
  const hasStarter = starters > 0;
  const isBrick = !hasStarter && extenders === 0;
  const survivesOneInterruption =
    starters >= 2 || (starters >= 1 && extenders >= 1);
  return { hasStarter, isBrick, survivesOneInterruption };
}

/**
 * Expand deck list into individual copies for shuffling.
 */
export function expandMainDeckCopies(
  cards: Array<{ id: number; count?: number } & Omit<TaggedMainCard, "id">>,
): TaggedMainCard[] {
  const out: TaggedMainCard[] = [];
  for (const card of cards) {
    const n = Math.max(1, card.count ?? 1);
    for (let i = 0; i < n; i += 1) {
      out.push({
        id: card.id,
        isStarter: card.isStarter,
        isExtender: card.isExtender,
        isHandTrap: card.isHandTrap,
      });
    }
  }
  return out;
}

/**
 * Monte Carlo opening-hand consistency simulation.
 */
export function simulateConsistency(
  mainDeck: TaggedMainCard[],
  options: ConsistencySimOptions = {},
): ConsistencyStats {
  const handSize = options.handSize ?? DEFAULT_HAND_SIZE;
  const iterations = options.iterations ?? DEFAULT_ITERATIONS;
  const random = options.random ?? Math.random;

  if (mainDeck.length < handSize || iterations <= 0) {
    return {
      n: 0,
      starterAccess: 0,
      brickRate: 1,
      oneInterruptionSurvival: 0,
    };
  }

  let starterHits = 0;
  let bricks = 0;
  let survives = 0;

  for (let i = 0; i < iterations; i += 1) {
    const pool = mainDeck.slice();
    fisherYatesShuffle(pool, random);
    const hand = pool.slice(0, handSize);
    const outcome = classifyOpeningHand(hand);
    if (outcome.hasStarter) starterHits += 1;
    if (outcome.isBrick) bricks += 1;
    if (outcome.survivesOneInterruption) survives += 1;
  }

  return {
    n: iterations,
    starterAccess: starterHits / iterations,
    brickRate: bricks / iterations,
    oneInterruptionSurvival: survives / iterations,
  };
}
