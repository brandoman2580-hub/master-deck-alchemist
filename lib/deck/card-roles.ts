import { Card } from "@/types/card";
import {
  detectHeuristicRoleSlugs,
  type HeuristicRoleSlug,
} from "@/lib/engine/card-role-heuristics";

export type CardRole =
  | "starter"
  | "extender"
  | "interruption"
  | "board_breaker"
  | "end_board_piece"
  | "generic";

function slugToCardRole(slug: HeuristicRoleSlug): CardRole | null {
  switch (slug) {
    case "starter":
      return "starter";
    case "extender":
      return "extender";
    case "hand_trap":
      return "interruption";
    case "board_breaker":
      return "board_breaker";
    case "endboard":
      return "end_board_piece";
    case "lock":
      return null;
    default:
      return null;
  }
}

/**
 * Detect the role(s) a card plays based on its description.
 * Delegates to shared Facts Brain heuristics (multi-label).
 */
export function detectCardRole(card: Card): CardRole[] {
  const roles = detectHeuristicRoleSlugs(card)
    .map(slugToCardRole)
    .filter((r): r is CardRole => r != null);
  return roles.length > 0 ? [...new Set(roles)] : ["generic"];
}

/**
 * Count cards by role in a deck section
 */
export function countCardsByRole(cards: Card[], role: CardRole): number {
  return cards.filter((card) => detectCardRole(card).includes(role)).length;
}
