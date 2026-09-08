import type { Card } from "@/types/card";
import type { DeckType } from "@/types/types";
import { detectCardRole } from "@/lib/analysis/cardRoleDetector";
import {
  ARCHETYPE_KNOWLEDGE,
  findArchetypeKnowledge,
} from "@/lib/analysis/archetypeKnowledge";
import type {
  BossCard,
  CardRoleTag,
  Collision,
  DiagnosticsBlock,
  EngineFormat,
  RoleCoverage,
  StrategyFit,
  YugiohPlayStrategy,
} from "./types";

export interface StrategyWeightRow {
  cardId: string;
  format: EngineFormat;
  strategy: YugiohPlayStrategy;
  role: CardRoleTag;
  synergyWeight: number;
  isBoss: boolean;
}

export interface ArchetypeStrategyRow {
  archetypeName: string;
  format: EngineFormat;
  primaryStrategy: YugiohPlayStrategy;
  secondaryStrategy: YugiohPlayStrategy | null;
}

const PLAYSTYLE_TO_STRATEGY: Record<string, YugiohPlayStrategy> = {
  Combo: "Combo",
  Midrange: "Midrange / Hybrid",
  Control: "Control",
  Stun: "Stun / Floodgate",
  Beatdown: "Aggro / Beatdown",
};

function mapHeuristicRoles(card: Card): CardRoleTag[] {
  const roles = detectCardRole(card);
  const mapped: CardRoleTag[] = [];
  for (const role of roles) {
    switch (role) {
      case "starter":
        mapped.push("Starter");
        break;
      case "extender":
        mapped.push("Extender");
        break;
      case "interruption":
        mapped.push("Hand Trap");
        break;
      case "board_breaker":
        mapped.push("Board Breaker");
        break;
      case "end_board_piece":
        mapped.push("Endboard");
        break;
      default:
        break;
    }
  }
  return mapped;
}

function emptyCoverage(): RoleCoverage {
  return {
    starters: 0,
    extenders: 0,
    handTraps: 0,
    boardBreakers: 0,
    endboardPieces: 0,
    locks: 0,
  };
}

function bumpCoverage(coverage: RoleCoverage, roles: CardRoleTag[]): void {
  for (const role of roles) {
    switch (role) {
      case "Starter":
        coverage.starters += 1;
        break;
      case "Extender":
        coverage.extenders += 1;
        break;
      case "Hand Trap":
        coverage.handTraps += 1;
        break;
      case "Board Breaker":
        coverage.boardBreakers += 1;
        break;
      case "Endboard":
        coverage.endboardPieces += 1;
        break;
      case "Lock":
        coverage.locks += 1;
        break;
      default:
        break;
    }
  }
}

function detectPrimaryArchetype(cards: Card[]): string | null {
  const counts = new Map<string, number>();
  for (const card of cards) {
    const name = card.archetype?.trim();
    if (!name) continue;
    counts.set(name, (counts.get(name) ?? 0) + 1);
  }
  let best: string | null = null;
  let bestCount = 0;
  for (const [name, count] of counts) {
    if (count > bestCount) {
      best = name;
      bestCount = count;
    }
  }
  return best;
}

function resolveStrategy(
  archetype: string | null,
  format: EngineFormat,
  rows: ArchetypeStrategyRow[],
): StrategyFit {
  if (!archetype) {
    return {
      primaryArchetype: null,
      primaryStrategy: null,
      secondaryStrategy: null,
      fitScore: 0,
      notes: ["No dominant archetype detected"],
    };
  }

  const row = rows.find(
    (r) =>
      r.format === format &&
      r.archetypeName.toLowerCase() === archetype.toLowerCase(),
  );
  if (row) {
    return {
      primaryArchetype: archetype,
      primaryStrategy: row.primaryStrategy,
      secondaryStrategy: row.secondaryStrategy,
      fitScore: 80,
      notes: [`Matched curated strategy for ${archetype} (${format})`],
    };
  }

  const kb = findArchetypeKnowledge(archetype);
  if (kb?.playstyle) {
    return {
      primaryArchetype: archetype,
      primaryStrategy: PLAYSTYLE_TO_STRATEGY[kb.playstyle] ?? "Midrange / Hybrid",
      secondaryStrategy: null,
      fitScore: 55,
      notes: [`Fallback playstyle from archetype knowledge (${kb.playstyle})`],
    };
  }

  return {
    primaryArchetype: archetype,
    primaryStrategy: null,
    secondaryStrategy: null,
    fitScore: 30,
    notes: [`Archetype ${archetype} has no curated strategy row yet`],
  };
}

/**
 * Deterministic diagnostics for Phase 1 Facts Brain.
 * Prefers curated strategy weights when present; falls back to text heuristics.
 */
export function buildDiagnostics(
  deck: DeckType,
  format: EngineFormat,
  options: {
    strategyWeights?: StrategyWeightRow[];
    archetypeStrategies?: ArchetypeStrategyRow[];
  } = {},
): DiagnosticsBlock {
  const weights = options.strategyWeights ?? [];
  const strategies = options.archetypeStrategies ?? [];
  const mainCards = deck.mainDeck as Card[];
  const extraCards = deck.extraDeck as Card[];
  const allCards = [...mainCards, ...extraCards, ...(deck.sideDeck as Card[])];

  const coverage = emptyCoverage();
  const bosses: BossCard[] = [];
  const weightByCard = new Map<string, StrategyWeightRow[]>();
  for (const row of weights) {
    if (row.format !== format) continue;
    const list = weightByCard.get(row.cardId) ?? [];
    list.push(row);
    weightByCard.set(row.cardId, list);
  }

  for (const card of mainCards) {
    const curated = weightByCard.get(String(card.id));
    const roles =
      curated && curated.length > 0
        ? curated.map((r) => r.role)
        : mapHeuristicRoles(card);
    bumpCoverage(coverage, roles);
  }

  for (const card of extraCards) {
    const curated = weightByCard.get(String(card.id));
    const roles =
      curated && curated.length > 0
        ? curated.map((r) => r.role)
        : mapHeuristicRoles(card);
    bumpCoverage(coverage, roles);
    const isBoss =
      curated?.some((r) => r.isBoss) ||
      roles.includes("Endboard") ||
      (typeof card.atk === "number" && card.atk >= 2500) ||
      (typeof card.atk === "string" && Number(card.atk) >= 2500);
    if (isBoss) {
      bosses.push({ cardId: card.id, name: card.name, zone: "extra" });
    }
  }

  const collisions: Collision[] = [];
  if (coverage.starters < 6 && mainCards.length >= 40) {
    collisions.push({
      code: "LOW_STARTER_DENSITY",
      severity: "warning",
      message: `Only ${coverage.starters} starter-tagged cards detected in main; consistency may suffer.`,
    });
  }
  if (coverage.handTraps < 3 && mainCards.length >= 40) {
    collisions.push({
      code: "LOW_INTERACTION",
      severity: "info",
      message: `Only ${coverage.handTraps} hand-trap/interaction tags detected.`,
    });
  }
  if (coverage.extenders === 0 && coverage.starters > 0 && mainCards.length >= 40) {
    collisions.push({
      code: "NO_EXTENDERS",
      severity: "warning",
      message: "Starters present but no extender tags detected — lines may fizzle.",
    });
  }

  const primaryArchetype = detectPrimaryArchetype(allCards);
  const strategyFit = resolveStrategy(primaryArchetype, format, strategies);

  // Knowledge coverage note for curation pipeline
  if (
    primaryArchetype &&
    !ARCHETYPE_KNOWLEDGE.some(
      (a) => a.name.toLowerCase() === primaryArchetype.toLowerCase(),
    )
  ) {
    strategyFit.notes.push(
      "Archetype not in static knowledge base; prefer curated DB rows.",
    );
  }

  return {
    collisions,
    roleCoverage: coverage,
    strategyFit,
    bosses: bosses.slice(0, 8),
  };
}
