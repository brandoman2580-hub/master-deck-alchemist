/**
 * Deno mirror of lib/engine/synergy-modifier.ts
 */

import type { Collision, ComboGraphSummary, StrategyFit } from "./types.ts";

export interface SynergyModifierInput {
  strategyFit: StrategyFit;
  primaryArchetypeShare: number;
  combos: ComboGraphSummary;
  collisions: Collision[];
}

export interface SynergyModifierResult {
  factor: number;
  notes: string[];
}

function clamp(n: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, n));
}

export function computeSynergyModifier(
  input: SynergyModifierInput,
): SynergyModifierResult {
  let factor = 1;
  const notes: string[] = [];
  const { strategyFit, primaryArchetypeShare, combos, collisions } = input;

  if (strategyFit.fitScore >= 80) {
    factor += 0.05;
    notes.push(
      `Strong strategy fit (${strategyFit.fitScore}) boosts Consistency/Power.`,
    );
  } else if (strategyFit.fitScore > 0 && strategyFit.fitScore < 40) {
    factor -= 0.05;
    notes.push(
      `Weak strategy fit (${strategyFit.fitScore}) softens Consistency/Power.`,
    );
  }

  if (primaryArchetypeShare >= 0.35 && primaryArchetypeShare <= 0.85) {
    factor += 0.05;
    notes.push(
      `Engine density ${(primaryArchetypeShare * 100).toFixed(0)}% in primary archetype — synergy bonus.`,
    );
  } else if (primaryArchetypeShare > 0 && primaryArchetypeShare < 0.2) {
    factor -= 0.05;
    notes.push(
      `Low engine density (${(primaryArchetypeShare * 100).toFixed(0)}%) — Consistency/Power softened.`,
    );
  } else if (primaryArchetypeShare > 0.85) {
    factor += 0.03;
    notes.push(
      `Very focused engine (${(primaryArchetypeShare * 100).toFixed(0)}%) — modest synergy bonus.`,
    );
  }

  if (combos.source === "template" && combos.lines.length > 0) {
    factor += 0.05;
    notes.push(
      `Curated combo templates matched (${combos.lines.length} lines) — synergy bonus.`,
    );
  } else if (combos.source === "empty") {
    factor -= 0.03;
    notes.push("No compiled combo lines — slight Consistency/Power softener.");
  }

  const errors = collisions.filter((c) => c.severity === "error").length;
  const warnings = collisions.filter((c) => c.severity === "warning").length;
  if (errors > 0) {
    const pen = Math.min(0.1, errors * 0.08);
    factor -= pen;
    notes.push(
      `${errors} error-level collision(s) — anti-synergy penalty on Consistency/Power.`,
    );
  }
  if (warnings > 0) {
    const pen = Math.min(0.06, warnings * 0.02);
    factor -= pen;
    notes.push(
      `${warnings} warning collision(s) — mild anti-synergy softener.`,
    );
  }

  factor = clamp(Math.round(factor * 100) / 100, 0.85, 1.15);
  if (notes.length === 0) {
    notes.push("Neutral synergy factor (1.00) — no strong engine signals.");
  }

  return { factor, notes };
}

export function computePrimaryArchetypeShare(
  cards: Array<{ archetype?: string | null }>,
  primaryArchetype: string | null,
): number {
  if (!primaryArchetype || cards.length === 0) return 0;
  const target = primaryArchetype.trim().toLowerCase();
  let hits = 0;
  for (const card of cards) {
    const arch = card.archetype?.trim().toLowerCase();
    if (arch && arch === target) hits += 1;
  }
  return hits / cards.length;
}
