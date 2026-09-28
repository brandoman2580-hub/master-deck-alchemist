/**
 * Deno mirror of lib/engine/consistency.ts
 */

import type { ConsistencyStats } from "./types.ts";

export interface TaggedMainCard {
  id: number;
  isStarter: boolean;
  isExtender: boolean;
  isHandTrap: boolean;
}

export interface ConsistencySimOptions {
  handSize?: number;
  iterations?: number;
  random?: () => number;
}

export interface HandOutcome {
  hasStarter: boolean;
  isBrick: boolean;
  survivesOneInterruption: boolean;
}

const DEFAULT_ITERATIONS = 3000;
const DEFAULT_HAND_SIZE = 5;

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
