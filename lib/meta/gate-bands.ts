import { DECK_SCORE_VERSION } from "./deck-score";
import type { MetaTier } from "./representation-tier";

export type GateMark = "ready" | "struggling" | "unconfirmed";

export interface TierFloors {
  tier1: number | null;
  tier2: number | null;
  tier3: number | null;
}

export interface StoredDeckScore {
  name: string;
  tier: MetaTier;
  consistency: number;
  resilience: number;
  interaction: number;
  ceiling: number;
  outing: number;
  composite: number;
  ceilingMode: "endboard" | "lock";
  letter: string;
}

export interface MetaGateBands {
  ceiling: TierFloors;
  floor: TierFloors;
  nonEngine: TierFloors;
  /** Chance to open a starter. Absent on snapshots scored before this line existed. */
  openPlay?: TierFloors;
  sampleIterations: number;
  listCounts: Record<MetaTier, number>;
  /** Bumped when the five-gate function changes. Older rows stay hidden. */
  scoreVersion?: number;
  decks?: StoredDeckScore[];
}

export interface ScoredMetaList {
  tier: MetaTier;
  name?: string;
  endboardPieces: number;
  oneInterruptionSurvival: number;
  starterAccess: number;
  nonEngineCopies: number;
  score?: Omit<StoredDeckScore, "name" | "tier">;
}

const EMPTY_FLOORS: TierFloors = { tier1: null, tier2: null, tier3: null };

function minForTier(
  lists: ScoredMetaList[],
  tier: MetaTier,
  pick: (list: ScoredMetaList) => number,
): number | null {
  const values = lists.filter((list) => list.tier === tier).map(pick);
  if (values.length === 0) return null;
  return Math.min(...values);
}

function floorsFor(
  lists: ScoredMetaList[],
  pick: (list: ScoredMetaList) => number,
): TierFloors {
  return {
    tier1: minForTier(lists, 1, pick),
    tier2: minForTier(lists, 2, pick),
    tier3: minForTier(lists, 3, pick),
  };
}

/**
 * The ready line for a gate is the lowest score among current tier-1 lists.
 * Tier 2 and tier 3 floors are kept so the sheet can show the rest of the meta.
 * A missing tier-1 score leaves that gate unconfirmed.
 */
export function bandsFromScoredLists(
  lists: ScoredMetaList[],
  sampleIterations: number,
  scoreVersion = DECK_SCORE_VERSION,
): MetaGateBands {
  return {
    ceiling: floorsFor(lists, (list) => list.endboardPieces),
    floor: floorsFor(lists, (list) => list.oneInterruptionSurvival),
    nonEngine: floorsFor(lists, (list) => list.nonEngineCopies),
    openPlay: floorsFor(lists, (list) => list.starterAccess),
    sampleIterations,
    listCounts: {
      1: lists.filter((list) => list.tier === 1).length,
      2: lists.filter((list) => list.tier === 2).length,
      3: lists.filter((list) => list.tier === 3).length,
    },
    scoreVersion,
    decks: lists.flatMap((list) => {
      if (!list.name || !list.score) return [];
      return [{ name: list.name, tier: list.tier, ...list.score }];
    }),
  };
}

export function markAgainstTier1(
  value: number | null,
  floors: TierFloors,
): GateMark {
  if (floors.tier1 == null || value == null) return "unconfirmed";
  return value >= floors.tier1 ? "ready" : "struggling";
}

export function emptyTierFloors(): TierFloors {
  return { ...EMPTY_FLOORS };
}

export function isMetaGateBands(value: unknown): value is MetaGateBands {
  if (!value || typeof value !== "object") return false;
  const bands = value as Partial<MetaGateBands>;
  return (
    typeof bands.sampleIterations === "number" &&
    bands.ceiling != null &&
    bands.floor != null &&
    bands.nonEngine != null &&
    bands.listCounts != null
  );
}
