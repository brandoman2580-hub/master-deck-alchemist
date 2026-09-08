import type { Card } from "@/types/card";
import { detectCardRole } from "@/lib/analysis/cardRoleDetector";
import type { StrategyWeightRow } from "./diagnostics";
import type { EngineFormat } from "./types";
import type { TaggedMainCard } from "./consistency";

/**
 * Tag main-deck copies for Monte Carlo using curated weights when available,
 * otherwise heuristic role detection from card text.
 */
export function tagMainDeckForConsistency(
  mainDeck: Card[],
  format: EngineFormat,
  strategyWeights: StrategyWeightRow[] = [],
): TaggedMainCard[] {
  const weightByCard = new Map<string, StrategyWeightRow[]>();
  for (const row of strategyWeights) {
    if (row.format !== format) continue;
    const list = weightByCard.get(row.cardId) ?? [];
    list.push(row);
    weightByCard.set(row.cardId, list);
  }

  const counts = new Map<number, TaggedMainCard & { count: number }>();

  for (const card of mainDeck) {
    const curated = weightByCard.get(String(card.id));
    let isStarter = false;
    let isExtender = false;
    let isHandTrap = false;

    if (curated?.length) {
      isStarter = curated.some((r) => r.role === "Starter");
      isExtender = curated.some((r) => r.role === "Extender");
      isHandTrap = curated.some((r) => r.role === "Hand Trap");
    } else {
      const roles = detectCardRole(card);
      isStarter = roles.includes("starter");
      isExtender = roles.includes("extender");
      isHandTrap = roles.includes("interruption");
    }

    const existing = counts.get(card.id);
    if (existing) {
      existing.count += 1;
    } else {
      counts.set(card.id, {
        id: card.id,
        isStarter,
        isExtender,
        isHandTrap,
        count: 1,
      });
    }
  }

  const expanded: TaggedMainCard[] = [];
  for (const entry of counts.values()) {
    for (let i = 0; i < entry.count; i += 1) {
      expanded.push({
        id: entry.id,
        isStarter: entry.isStarter,
        isExtender: entry.isExtender,
        isHandTrap: entry.isHandTrap,
      });
    }
  }
  return expanded;
}
