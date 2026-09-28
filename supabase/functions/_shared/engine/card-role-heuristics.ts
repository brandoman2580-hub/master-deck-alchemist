/**
 * Shared multi-role card heuristics for Facts Brain + Strategist.
 * Curated `card_strategy_weights` rows always win; this is the fallback only.
 */

import type { CardRoleTag, EngineFormat } from "./types.ts";

export type HeuristicRoleSlug =
  | "starter"
  | "extender"
  | "hand_trap"
  | "board_breaker"
  | "endboard"
  | "lock";

export interface HeuristicCardInput {
  id?: number;
  name?: string;
  type: string;
  desc?: string | null;
  atk?: number | string | null;
}

export interface StrategyWeightCoverageRow {
  cardId: string;
  format: EngineFormat;
  role: CardRoleTag | string;
}

export interface RoleCoverageSourceStats {
  totalCards: number;
  curatedCards: number;
  heuristicOnlyCards: number;
  /** Fraction of unique cards that have at least one curated weight row. */
  curatedCoverageRatio: number;
}

/**
 * Detect strategic roles from official card text (multi-label).
 */
export function detectHeuristicRoleSlugs(
  card: HeuristicCardInput,
): HeuristicRoleSlug[] {
  const roles: HeuristicRoleSlug[] = [];
  const desc = (card.desc || "").toLowerCase();
  const type = (card.type || "").toLowerCase();
  const atk = Number(card.atk ?? 0);

  if (
    desc.includes("search") ||
    (desc.includes("add") && desc.includes("deck")) ||
    (desc.includes("special summon") && desc.includes("deck"))
  ) {
    roles.push("starter");
  }

  if (
    (desc.includes("special summon") &&
      (desc.includes("hand") || desc.includes("gy") || desc.includes("graveyard"))) ||
    desc.includes("send to") ||
    desc.includes("mill") ||
    (desc.includes("discard") && desc.includes("draw"))
  ) {
    roles.push("extender");
  }

  if (
    ((desc.includes("negate") || desc.includes("destroy") || desc.includes("banish")) &&
      (desc.includes("quick effect") ||
        desc.includes("opponent") ||
        desc.includes("either player's turn"))) ||
    (desc.includes("hand") && desc.includes("quick effect")) ||
    (type.includes("trap") &&
      (desc.includes("negate") || desc.includes("when your opponent")))
  ) {
    roles.push("hand_trap");
  }

  if (
    desc.includes("destroy all") ||
    desc.includes("banish all") ||
    desc.includes("return all") ||
    desc.includes("send all") ||
    (desc.includes("destroy") && desc.includes("opponent")) ||
    (desc.includes("banish") && desc.includes("opponent") && desc.includes("controls"))
  ) {
    roles.push("board_breaker");
  }

  const isExtraType =
    type.includes("synchro") ||
    type.includes("xyz") ||
    type.includes("fusion") ||
    type.includes("link") ||
    type.includes("pendulum");

  if (
    ((desc.includes("cannot be") || desc.includes("unaffected")) &&
      type.includes("monster")) ||
    (atk >= 2500 && desc.includes("negate")) ||
    (isExtraType &&
      (desc.includes("negate") ||
        desc.includes("unaffected") ||
        desc.includes("cannot be destroyed")))
  ) {
    roles.push("endboard");
  }

  if (
    desc.includes("cannot special summon") ||
    desc.includes("floodgate") ||
    desc.includes("neither player can") ||
    desc.includes("each player can only")
  ) {
    roles.push("lock");
  }

  return [...new Set(roles)];
}

/**
 * Map heuristic slugs onto Facts Brain `card_role_tag` enum values.
 */
export function heuristicSlugsToCardRoleTags(
  slugs: HeuristicRoleSlug[],
): CardRoleTag[] {
  const mapped: CardRoleTag[] = [];
  for (const slug of slugs) {
    switch (slug) {
      case "starter":
        mapped.push("Starter");
        break;
      case "extender":
        mapped.push("Extender");
        break;
      case "hand_trap":
        mapped.push("Hand Trap");
        break;
      case "board_breaker":
        mapped.push("Board Breaker");
        break;
      case "endboard":
        mapped.push("Endboard");
        break;
      case "lock":
        mapped.push("Lock");
        break;
      default:
        break;
    }
  }
  return [...new Set(mapped)];
}

/**
 * Measure how many unique deck cards have curated weights vs heuristic-only.
 */
export function measureWeightCoverage(
  cardIds: Array<number | string>,
  weights: StrategyWeightCoverageRow[],
  format: EngineFormat,
): RoleCoverageSourceStats {
  const uniqueIds = [
    ...new Set(
      cardIds
        .map((id) => String(id))
        .filter((id) => id.length > 0 && id !== "NaN"),
    ),
  ];
  const curatedIds = new Set(
    weights
      .filter((w) => w.format === format)
      .map((w) => String(w.cardId)),
  );
  let curatedCards = 0;
  for (const id of uniqueIds) {
    if (curatedIds.has(id)) curatedCards += 1;
  }
  const totalCards = uniqueIds.length;
  const heuristicOnlyCards = Math.max(0, totalCards - curatedCards);
  return {
    totalCards,
    curatedCards,
    heuristicOnlyCards,
    curatedCoverageRatio: totalCards === 0 ? 0 : curatedCards / totalCards,
  };
}
