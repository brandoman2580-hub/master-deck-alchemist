/**
 * Facts Brain helpers for deck-assistant (Deno).
 * Mirrors lib/engine Phase 1 contracts for edge runtime.
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import type { Card, Deck, DeckAnalysis } from "./types.ts";

export type EngineFormat = "TCG" | "MASTER_DUEL";

export interface FactsPromptBlock {
  format: EngineFormat;
  deckHash: string;
  legalityOk: boolean;
  legalityErrors: string[];
  roleCoverage: {
    starters: number;
    extenders: number;
    handTraps: number;
    boardBreakers: number;
    endboardPieces: number;
  };
  collisions: Array<{ code: string; severity: string; message: string }>;
  primaryArchetype: string | null;
  primaryStrategy: string | null;
  fitScore: number;
  bosses: string[];
  notes: string[];
}

function zoneSignature(
  cards: Array<{ cardId: number; count?: number }>,
): string {
  const counts = new Map<number, number>();
  for (const card of cards) {
    const n = card.count ?? 1;
    counts.set(card.cardId, (counts.get(card.cardId) ?? 0) + n);
  }
  return [...counts.entries()]
    .sort((a, b) => a[0] - b[0])
    .map(([id, n]) => `${id}x${n}`)
    .join(",");
}

function fnv1aHex(input: string): string {
  let hash = 0x811c9dc5;
  for (let i = 0; i < input.length; i += 1) {
    hash ^= input.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }
  return (hash >>> 0).toString(16).padStart(8, "0");
}

export function computeDeckHashFromSections(
  format: EngineFormat,
  deck: Deck,
): string {
  const payload = [
    format,
    `main:${zoneSignature(deck.mainDeck)}`,
    `extra:${zoneSignature(deck.extraDeck)}`,
    `side:${zoneSignature(deck.sideDeck)}`,
  ].join("|");
  return fnv1aHex(payload);
}

export function evaluateStructuralLegality(deck: Deck): {
  ok: boolean;
  errors: string[];
} {
  const errors: string[] = [];
  const main = deck.mainDeck.reduce((sum, c) => sum + (c.count ?? 1), 0);
  const extra = deck.extraDeck.reduce((sum, c) => sum + (c.count ?? 1), 0);
  const side = deck.sideDeck.reduce((sum, c) => sum + (c.count ?? 1), 0);

  if (main < 40) errors.push("Main deck must have at least 40 cards");
  if (main > 60) errors.push("Main deck cannot exceed 60 cards");
  if (extra > 15) errors.push("Extra deck cannot exceed 15 cards");
  if (side > 15) errors.push("Side deck cannot exceed 15 cards");

  const copies = new Map<number, number>();
  for (const section of [deck.mainDeck, deck.extraDeck, deck.sideDeck]) {
    for (const card of section) {
      const next = (copies.get(card.cardId) ?? 0) + (card.count ?? 1);
      copies.set(card.cardId, next);
    }
  }
  for (const [cardId, count] of copies) {
    if (count > 3) errors.push(`Card ${cardId} exceeds maximum copies (3)`);
  }

  return { ok: errors.length === 0, errors };
}

function detectRoles(card: Card): string[] {
  const roles: string[] = [];
  const desc = (card.desc || "").toLowerCase();
  if (
    desc.includes("search") ||
    (desc.includes("add") && desc.includes("deck")) ||
    (desc.includes("special summon") && desc.includes("deck"))
  ) {
    roles.push("starter");
  }
  if (
    (desc.includes("special summon") &&
      (desc.includes("hand") || desc.includes("gy"))) ||
    desc.includes("send to") ||
    desc.includes("mill")
  ) {
    roles.push("extender");
  }
  if (
    ((desc.includes("negate") || desc.includes("destroy")) &&
      (desc.includes("quick effect") || desc.includes("opponent"))) ||
    (desc.includes("hand") && desc.includes("quick effect"))
  ) {
    roles.push("hand_trap");
  }
  if (
    desc.includes("destroy all") ||
    desc.includes("banish all") ||
    (desc.includes("destroy") && desc.includes("opponent"))
  ) {
    roles.push("board_breaker");
  }
  if (
    ((desc.includes("cannot be") || desc.includes("unaffected")) &&
      card.type.includes("Monster")) ||
    (card.atk && Number(card.atk) >= 2500 && desc.includes("negate"))
  ) {
    roles.push("endboard");
  }
  return roles;
}

/**
 * Build facts prompt block from deck analysis + strategy tables + heuristics.
 */
export async function getOrComputeFactsPromptBlock(
  supabase: SupabaseClient,
  args: {
    deckId: string;
    deck: Deck;
    allCards: Card[];
    deckAnalysis: DeckAnalysis;
    format: EngineFormat;
  },
): Promise<FactsPromptBlock> {
  const { deckId, deck, allCards, deckAnalysis, format } = args;
  const deckHash = computeDeckHashFromSections(format, deck);

  const { data: cached } = await supabase
    .from("deck_analysis_cache")
    .select("facts, deck_hash")
    .eq("deck_id", deckId)
    .maybeSingle();

  if (cached?.deck_hash === deckHash && cached.facts) {
    const facts = cached.facts as Record<string, unknown>;
    const diagnostics = (facts.diagnostics ?? {}) as Record<string, unknown>;
    const roleCoverage = (diagnostics.roleCoverage ?? {}) as Record<
      string,
      number
    >;
    const strategyFit = (diagnostics.strategyFit ?? {}) as Record<
      string,
      unknown
    >;
    const legality = (facts.legality ?? {}) as {
      ok?: boolean;
      errors?: string[];
    };
    return {
      format,
      deckHash,
      legalityOk: Boolean(legality.ok),
      legalityErrors: legality.errors ?? [],
      roleCoverage: {
        starters: roleCoverage.starters ?? 0,
        extenders: roleCoverage.extenders ?? 0,
        handTraps: roleCoverage.handTraps ?? 0,
        boardBreakers: roleCoverage.boardBreakers ?? 0,
        endboardPieces: roleCoverage.endboardPieces ?? 0,
      },
      collisions: (diagnostics.collisions as FactsPromptBlock["collisions"]) ??
        [],
      primaryArchetype: (strategyFit.primaryArchetype as string | null) ??
        deckAnalysis.archetype,
      primaryStrategy: (strategyFit.primaryStrategy as string | null) ?? null,
      fitScore: Number(strategyFit.fitScore ?? 0),
      bosses: ((diagnostics.bosses as Array<{ name: string }>) ?? []).map(
        (b) => b.name,
      ),
      notes: (strategyFit.notes as string[]) ?? [],
    };
  }

  const cardMap = new Map(allCards.map((c) => [c.id, c]));
  const coverage = {
    starters: 0,
    extenders: 0,
    handTraps: 0,
    boardBreakers: 0,
    endboardPieces: 0,
  };
  const bosses: string[] = [];

  const { data: weightRows } = await supabase
    .from("card_strategy_weights")
    .select("card_id, role, is_boss")
    .eq("format", format);

  const weightsByCard = new Map<string, Array<{ role: string; isBoss: boolean }>>();
  for (const row of weightRows ?? []) {
    const list = weightsByCard.get(String(row.card_id)) ?? [];
    list.push({ role: row.role, isBoss: Boolean(row.is_boss) });
    weightsByCard.set(String(row.card_id), list);
  }

  for (const entry of deck.mainDeck) {
    const card = cardMap.get(entry.cardId);
    if (!card) continue;
    const curated = weightsByCard.get(String(entry.cardId));
    const count = entry.count ?? 1;
    if (curated?.length) {
      for (const w of curated) {
        if (w.role === "Starter") coverage.starters += count;
        if (w.role === "Extender") coverage.extenders += count;
        if (w.role === "Hand Trap") coverage.handTraps += count;
        if (w.role === "Board Breaker") coverage.boardBreakers += count;
        if (w.role === "Endboard") coverage.endboardPieces += count;
      }
    } else {
      const roles = detectRoles(card);
      if (roles.includes("starter")) coverage.starters += count;
      if (roles.includes("extender")) coverage.extenders += count;
      if (roles.includes("hand_trap")) coverage.handTraps += count;
      if (roles.includes("board_breaker")) coverage.boardBreakers += count;
      if (roles.includes("endboard")) coverage.endboardPieces += count;
    }
  }

  for (const entry of deck.extraDeck) {
    const card = cardMap.get(entry.cardId);
    if (!card) continue;
    const curated = weightsByCard.get(String(entry.cardId));
    if (curated?.some((w) => w.isBoss) || detectRoles(card).includes("endboard")) {
      bosses.push(card.name);
    }
  }

  const collisions: FactsPromptBlock["collisions"] = [];
  const mainSize = deck.mainDeck.reduce((s, c) => s + (c.count ?? 1), 0);
  if (mainSize >= 40 && coverage.starters < 6) {
    collisions.push({
      code: "LOW_STARTER_DENSITY",
      severity: "warning",
      message: `Only ${coverage.starters} starter-tagged cards detected in main.`,
    });
  }
  if (mainSize >= 40 && coverage.handTraps < 3) {
    collisions.push({
      code: "LOW_INTERACTION",
      severity: "info",
      message: `Only ${coverage.handTraps} hand-trap tags detected.`,
    });
  }

  let primaryStrategy: string | null = null;
  let fitScore = 30;
  const notes: string[] = [];
  if (deckAnalysis.archetype) {
    const { data: strategyRow } = await supabase
      .from("archetype_strategies")
      .select("primary_strategy, secondary_strategy")
      .eq("format", format)
      .ilike("archetype_name", deckAnalysis.archetype)
      .maybeSingle();
    if (strategyRow) {
      primaryStrategy = strategyRow.primary_strategy;
      fitScore = 80;
      notes.push(`Matched curated strategy for ${deckAnalysis.archetype}`);
    } else {
      notes.push(`No curated strategy row for ${deckAnalysis.archetype}`);
    }
  }

  const legality = evaluateStructuralLegality(deck);

  const factsPayload = {
    schemaVersion: "0.1.0",
    deckId,
    deckHash,
    format,
    legality,
    diagnostics: {
      collisions,
      roleCoverage: { ...coverage, locks: 0 },
      strategyFit: {
        primaryArchetype: deckAnalysis.archetype,
        primaryStrategy,
        secondaryStrategy: null,
        fitScore,
        notes,
      },
      bosses: bosses.map((name) => ({ cardId: 0, name, zone: "extra" })),
    },
    consistency: {
      n: 0,
      starterAccess: 0,
      brickRate: 0,
      oneInterruptionSurvival: 0,
    },
    matchups: [],
    combos: { lines: [], source: "empty" },
    grade: {
      consistency: 0,
      power: 0,
      resilience: 0,
      disruption: 0,
      letter: "F",
    },
  };

  await supabase.from("deck_analysis_cache").upsert({
    deck_id: deckId,
    deck_hash: deckHash,
    format,
    facts: factsPayload,
    computed_at: new Date().toISOString(),
  });

  return {
    format,
    deckHash,
    legalityOk: legality.ok,
    legalityErrors: legality.errors,
    roleCoverage: coverage,
    collisions,
    primaryArchetype: deckAnalysis.archetype,
    primaryStrategy,
    fitScore,
    bosses,
    notes,
  };
}

export function formatFactsPromptBlock(block: FactsPromptBlock): string {
  const collisions =
    block.collisions.length > 0
      ? block.collisions
          .map((c) => `- [${c.severity}] ${c.code}: ${c.message}`)
          .join("\n")
      : "- None";

  return `# VALIDATED FACTS (Facts Brain — do not invent alternate metrics)

**Format:** ${block.format}
**Deck hash:** ${block.deckHash}
**Legality:** ${block.legalityOk ? "OK" : "FAILED"}
${block.legalityErrors.length ? block.legalityErrors.map((e) => `- ${e}`).join("\n") : "- No legality errors"}

**Role coverage:** starters=${block.roleCoverage.starters}, extenders=${block.roleCoverage.extenders}, handTraps=${block.roleCoverage.handTraps}, boardBreakers=${block.roleCoverage.boardBreakers}, endboard=${block.roleCoverage.endboardPieces}

**Strategy fit:** archetype=${block.primaryArchetype ?? "unknown"}, primary=${block.primaryStrategy ?? "n/a"}, fitScore=${block.fitScore}
${block.notes.map((n) => `- ${n}`).join("\n") || "-"}

**Bosses:** ${block.bosses.length ? block.bosses.join(", ") : "None detected"}

**Structural collisions:**
${collisions}

**Consistency / matchups / combos:** not computed in Phase 1 — do not invent rates or combo lines.`;
}
