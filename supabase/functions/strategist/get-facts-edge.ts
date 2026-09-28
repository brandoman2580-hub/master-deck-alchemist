/**
 * Edge getFacts pipeline — full FactsEnvelope with cache.
 * Replaces Phase-1 FactsPromptBlock stub for deck-assistant coaching.
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import type { Card, Deck } from "./types.ts";
import {
  compileCombos,
  type ComboTemplateRow,
  type DeckCardRef,
} from "../_shared/engine/combos.ts";
import {
  simulateConsistency,
  type TaggedMainCard,
} from "../_shared/engine/consistency.ts";
import { gradeFromFacts } from "../_shared/engine/grade.ts";
import {
  scoreMatchupReadiness,
  type MetaMatchupTemplate,
} from "../_shared/engine/matchups.ts";
import type {
  BossCard,
  Collision,
  DiagnosticsBlock,
  EngineFormat,
  FactsEnvelope,
  RoleCoverage,
  StrategyFit,
  YugiohPlayStrategy,
} from "../_shared/engine/types.ts";
import {
  detectPackageLockConflicts,
  extractRestrictions,
} from "./restrictions.ts";
import { evaluateBanlistLegality } from "./synergy-eligibility.ts";
import { FACTS_SCHEMA_VERSION } from "../_shared/engine/types.ts";
import { detectHeuristicRoleSlugs } from "../_shared/engine/card-role-heuristics.ts";

const DEFAULT_ITERATIONS = 2500;
const VARIANT_ITERATIONS = 1200;

export interface StrategyWeightRow {
  cardId: string;
  role: string;
  isBoss: boolean;
  synergyWeight: number;
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

/**
 * Structural size/copy rules plus optional format banlist compliance.
 */
export function evaluateDeckLegality(
  deck: Deck,
  options: {
    banlist?: Record<string, string>;
    allCards?: Card[];
  } = {},
): { ok: boolean; errors: string[] } {
  const structural = evaluateStructuralLegality(deck);
  const ban =
    options.banlist && options.allCards
      ? evaluateBanlistLegality(deck, options.allCards, options.banlist)
      : { ok: true, errors: [] as string[] };
  const errors = [...structural.errors, ...ban.errors];
  return { ok: errors.length === 0, errors };
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

export function buildTaggedMainDeck(
  deck: Deck,
  allCards: Card[],
  weights: StrategyWeightRow[],
): TaggedMainCard[] {
  const cardMap = new Map(allCards.map((c) => [c.id, c]));
  const weightByCard = new Map<string, StrategyWeightRow[]>();
  for (const row of weights) {
    const list = weightByCard.get(row.cardId) ?? [];
    list.push(row);
    weightByCard.set(row.cardId, list);
  }

  const expanded: TaggedMainCard[] = [];
  for (const entry of deck.mainDeck) {
    const card = cardMap.get(entry.cardId);
    const curated = weightByCard.get(String(entry.cardId));
    let isStarter = false;
    let isExtender = false;
    let isHandTrap = false;
    if (curated?.length) {
      isStarter = curated.some((r) => r.role === "Starter");
      isExtender = curated.some((r) => r.role === "Extender");
      isHandTrap = curated.some((r) => r.role === "Hand Trap");
    } else if (card) {
      const roles = detectHeuristicRoleSlugs(card);
      isStarter = roles.includes("starter");
      isExtender = roles.includes("extender");
      isHandTrap = roles.includes("hand_trap");
    }
    const count = Math.max(1, entry.count ?? 1);
    for (let i = 0; i < count; i += 1) {
      expanded.push({
        id: entry.cardId,
        isStarter,
        isExtender,
        isHandTrap,
      });
    }
  }
  return expanded;
}

function buildDiagnostics(
  deck: Deck,
  allCards: Card[],
  format: EngineFormat,
  weights: StrategyWeightRow[],
  primaryArchetype: string | null,
  strategyFit: StrategyFit,
): DiagnosticsBlock {
  const cardMap = new Map(allCards.map((c) => [c.id, c]));
  const weightByCard = new Map<string, StrategyWeightRow[]>();
  for (const row of weights) {
    const list = weightByCard.get(row.cardId) ?? [];
    list.push(row);
    weightByCard.set(row.cardId, list);
  }

  const coverage = emptyCoverage();
  const bosses: BossCard[] = [];

  for (const entry of deck.mainDeck) {
    const card = cardMap.get(entry.cardId);
    if (!card) continue;
    const count = entry.count ?? 1;
    const curated = weightByCard.get(String(entry.cardId));
    if (curated?.length) {
      for (const w of curated) {
        if (w.role === "Starter") coverage.starters += count;
        if (w.role === "Extender") coverage.extenders += count;
        if (w.role === "Hand Trap") coverage.handTraps += count;
        if (w.role === "Board Breaker") coverage.boardBreakers += count;
        if (w.role === "Endboard") coverage.endboardPieces += count;
        if (w.role === "Lock") coverage.locks += count;
        if (w.isBoss) {
          bosses.push({ cardId: entry.cardId, name: card.name, zone: "main" });
        }
      }
    } else {
      const roles = detectHeuristicRoleSlugs(card);
      if (roles.includes("starter")) coverage.starters += count;
      if (roles.includes("extender")) coverage.extenders += count;
      if (roles.includes("hand_trap")) coverage.handTraps += count;
      if (roles.includes("board_breaker")) coverage.boardBreakers += count;
      if (roles.includes("endboard")) coverage.endboardPieces += count;
      if (roles.includes("lock")) coverage.locks += count;
    }
  }

  for (const entry of deck.extraDeck) {
    const card = cardMap.get(entry.cardId);
    if (!card) continue;
    const curated = weightByCard.get(String(entry.cardId));
    if (
      curated?.some((w) => w.isBoss) ||
      detectHeuristicRoleSlugs(card).includes("endboard")
    ) {
      bosses.push({ cardId: entry.cardId, name: card.name, zone: "extra" });
    }
  }

  const collisions: Collision[] = [];
  const mainSize = deck.mainDeck.reduce((s, c) => s + (c.count ?? 1), 0);
  if (mainSize > 40) {
    collisions.push({
      code: "MAIN_OVER_MINIMUM",
      severity: "info",
      message: `Main deck is ${mainSize} cards; 40 maximizes draw consistency.`,
    });
  }
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
  if (!primaryArchetype) {
    collisions.push({
      code: "NO_DOMINANT_ARCHETYPE",
      severity: "info",
      message: "No dominant archetype detected from card metadata.",
    });
  }

  const restrictionCards = allCards.map((c) => ({
    id: c.id,
    name: c.name,
    desc: c.desc,
  }));
  const restrictions = extractRestrictions(restrictionCards);
  const deckNames = allCards.map((c) => c.name);
  collisions.push(
    ...detectPackageLockConflicts({
      restrictions,
      deckCardNames: deckNames,
    }),
  );

  return {
    collisions,
    roleCoverage: coverage,
    strategyFit,
    bosses,
    restrictions,
  };
}

function detectPrimaryArchetype(deck: Deck, allCards: Card[]): string | null {
  const cardMap = new Map(allCards.map((c) => [c.id, c]));
  const counts = new Map<string, number>();
  for (const entry of [...deck.mainDeck, ...deck.extraDeck]) {
    const card = cardMap.get(entry.cardId);
    const name = card?.archetype?.trim();
    if (!name) continue;
    counts.set(name, (counts.get(name) ?? 0) + (entry.count ?? 1));
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

function isCompleteFacts(facts: FactsEnvelope): boolean {
  return (
    facts.schemaVersion === FACTS_SCHEMA_VERSION &&
    facts.consistency?.n > 0 &&
    Array.isArray(facts.matchups) &&
    Boolean(facts.combos) &&
    Boolean(facts.grade?.breakdown)
  );
}

/**
 * Load or compute a full FactsEnvelope for assistant coaching.
 */
export async function getOrComputeFactsEnvelope(
  supabase: SupabaseClient,
  args: {
    deckId: string;
    deck: Deck;
    allCards: Card[];
    format: EngineFormat;
    iterations?: number;
    writeCache?: boolean;
    /** Format banlist (card name → status); folds into facts.legality. */
    banlist?: Record<string, string>;
  },
): Promise<FactsEnvelope> {
  const {
    deckId,
    deck,
    allCards,
    format,
    iterations = DEFAULT_ITERATIONS,
    writeCache = true,
    banlist = {},
  } = args;
  const deckHash = computeDeckHashFromSections(format, deck);

  const { data: cached } = await supabase
    .from("deck_analysis_cache")
    .select("facts, deck_hash")
    .eq("deck_id", deckId)
    .maybeSingle();

  if (cached?.deck_hash === deckHash && cached.facts) {
    const facts = cached.facts as FactsEnvelope;
    if (isCompleteFacts(facts)) {
      if (!facts.diagnostics.restrictions) {
        facts.diagnostics.restrictions = [];
      }
      return facts;
    }
  }

  const { data: weightRows } = await supabase
    .from("card_strategy_weights")
    .select("card_id, role, is_boss, synergy_weight")
    .eq("format", format);

  const weights: StrategyWeightRow[] = (weightRows ?? []).map((row) => ({
    cardId: String(row.card_id),
    role: String(row.role),
    isBoss: Boolean(row.is_boss),
    synergyWeight: Number(row.synergy_weight ?? 0),
  }));

  const primaryArchetype = detectPrimaryArchetype(deck, allCards);
  let strategyFit: StrategyFit = {
    primaryArchetype,
    primaryStrategy: null,
    secondaryStrategy: null,
    fitScore: primaryArchetype ? 30 : 0,
    notes: primaryArchetype
      ? [`Archetype ${primaryArchetype} — checking curated strategy`]
      : ["No dominant archetype detected"],
  };

  if (primaryArchetype) {
    const { data: strategyRow } = await supabase
      .from("archetype_strategies")
      .select("primary_strategy, secondary_strategy")
      .eq("format", format)
      .ilike("archetype_name", primaryArchetype)
      .maybeSingle();
    if (strategyRow) {
      strategyFit = {
        primaryArchetype,
        primaryStrategy: strategyRow.primary_strategy as YugiohPlayStrategy,
        secondaryStrategy:
          (strategyRow.secondary_strategy as YugiohPlayStrategy | null) ?? null,
        fitScore: 80,
        notes: [`Matched curated strategy for ${primaryArchetype} (${format})`],
      };
    } else {
      strategyFit.notes = [
        `Archetype ${primaryArchetype} has no curated strategy row yet`,
      ];
    }
  }

  const legality = evaluateDeckLegality(deck, { banlist, allCards });
  const diagnostics = buildDiagnostics(
    deck,
    allCards,
    format,
    weights,
    primaryArchetype,
    strategyFit,
  );

  const tagged = buildTaggedMainDeck(deck, allCards, weights);
  const consistency = simulateConsistency(tagged, { iterations });

  const metaTemplates = await loadMetaTemplates(supabase, format);
  const matchups = scoreMatchupReadiness({
    diagnostics,
    consistency,
    templates: metaTemplates,
  });

  const comboTemplates = await loadComboTemplates(
    supabase,
    format,
    primaryArchetype,
  );
  const cardMap = new Map(allCards.map((c) => [c.id, c]));
  const deckCards: DeckCardRef[] = [];
  const pushZone = (
    section: Deck["mainDeck"],
    zone: DeckCardRef["zone"],
  ) => {
    for (const entry of section) {
      const card = cardMap.get(entry.cardId);
      const count = entry.count ?? 1;
      for (let i = 0; i < count; i += 1) {
        deckCards.push({
          id: entry.cardId,
          name: card?.name ?? `Card ${entry.cardId}`,
          zone,
        });
      }
    }
  };
  pushZone(deck.mainDeck, "main");
  pushZone(deck.extraDeck, "extra");
  pushZone(deck.sideDeck, "side");

  const starterNames = [
    ...new Set(
      tagged
        .filter((t) => t.isStarter)
        .map((t) => cardMap.get(t.id)?.name)
        .filter((n): n is string => Boolean(n)),
    ),
  ];

  const combos = compileCombos({
    format,
    archetype: primaryArchetype,
    deckCards,
    templates: comboTemplates,
    bosses: diagnostics.bosses,
    starterNames,
  });

  const grade = gradeFromFacts({
    consistency,
    diagnostics,
    matchups,
    combos,
    format,
    banlist,
    mainDeckCardNames: deckCards
      .filter((c) => c.zone === "main")
      .map((c) => c.name),
    engineCards: deckCards
      .filter((c) => c.zone === "main" || c.zone === "extra")
      .map((c) => ({
        archetype: cardMap.get(c.id)?.archetype ?? null,
      })),
  });

  const facts: FactsEnvelope = {
    schemaVersion: FACTS_SCHEMA_VERSION,
    deckId,
    deckHash,
    format,
    legality,
    diagnostics,
    consistency,
    matchups,
    combos,
    grade,
  };

  if (writeCache) {
    await supabase.from("deck_analysis_cache").upsert({
      deck_id: deckId,
      deck_hash: deckHash,
      format,
      facts,
      computed_at: new Date().toISOString(),
    });
  }

  return facts;
}

async function loadMetaTemplates(
  supabase: SupabaseClient,
  format: EngineFormat,
): Promise<MetaMatchupTemplate[]> {
  const formats =
    format === "TCG"
      ? ["tcg", "TCG"]
      : ["master_duel", "MASTER_DUEL", "Master Duel", "md"];

  const { data: tiers } = await supabase
    .from("tier_list_snapshots")
    .select("deck_name, tier, format, playstyle, scraped_at")
    .in("format", formats)
    .order("scraped_at", { ascending: false })
    .limit(80);

  if (!tiers?.length) {
    return [
      {
        name: "Generic Combo",
        opponentArchetype: "Combo",
        tier: "1",
        metaShare: 20,
        playstyle: "combo",
      },
      {
        name: "Generic Control",
        opponentArchetype: "Control",
        tier: "2",
        metaShare: 15,
        playstyle: "control",
      },
    ];
  }

  const seen = new Set<string>();
  const unique: typeof tiers = [];
  for (const row of tiers) {
    const key = String(row.deck_name ?? "").toLowerCase();
    if (!key || seen.has(key)) continue;
    seen.add(key);
    unique.push(row);
    if (unique.length >= 16) break;
  }

  return unique.map((row, index) => {
    const name = String(row.deck_name ?? "Unknown");
    const tierNum = Number(row.tier);
    const tier = (tierNum === 1 ? "1" : tierNum === 2 ? "2" : "3") as
      | "1"
      | "2"
      | "3";
    const base = tier === "1" ? 12 : tier === "2" ? 7 : 3;
    return {
      name,
      opponentArchetype: name,
      tier,
      metaShare: base + (index % 5) * 0.8,
      playstyle: (row.playstyle as string | null) ?? null,
    };
  });
}

async function loadComboTemplates(
  supabase: SupabaseClient,
  format: EngineFormat,
  archetype: string | null,
): Promise<ComboTemplateRow[]> {
  return loadComboTemplatesForArchetypes(
    supabase,
    format,
    archetype ? [archetype] : [],
  );
}

/**
 * Distinct archetype_name values from combo_templates for a format
 * (used to resolve free-form bridge phrases against curated labels).
 */
export async function listComboTemplateArchetypeNames(
  supabase: SupabaseClient,
  format: EngineFormat,
): Promise<string[]> {
  const { data } = await supabase
    .from("combo_templates")
    .select("archetype_name")
    .eq("format", format)
    .limit(200);
  const names = (data ?? [])
    .map((row) => String(row.archetype_name ?? "").trim())
    .filter((n) => n.length >= 2);
  return [...new Set(names)].sort((a, b) => a.localeCompare(b));
}

/**
 * Load curated combo graphs for one or more archetypes (optimize bridge asks).
 */
export async function loadComboTemplatesForArchetypes(
  supabase: SupabaseClient,
  format: EngineFormat,
  archetypes: string[],
): Promise<ComboTemplateRow[]> {
  const cleaned = [
    ...new Set(archetypes.map((a) => a.trim()).filter((a) => a.length >= 2)),
  ].slice(0, 4);

  let query = supabase
    .from("combo_templates")
    .select("id, archetype_name, format, name, bosses, graph, killers")
    .eq("format", format)
    .limit(40);

  if (cleaned.length === 1) {
    query = query.ilike("archetype_name", `%${cleaned[0]}%`);
  } else if (cleaned.length > 1) {
    const orFilter = cleaned
      .map((a) => `archetype_name.ilike.%${a}%`)
      .join(",");
    query = query.or(orFilter);
  }

  const { data } = await query;
  return (data ?? []).map((row) => ({
    id: String(row.id),
    archetypeName: String(row.archetype_name),
    format: row.format as EngineFormat,
    name: String(row.name),
    bosses: (row.bosses as string[]) ?? [],
    graph: row.graph as ComboTemplateRow["graph"],
    killers: (row.killers as string[]) ?? [],
  }));
}

export { VARIANT_ITERATIONS, DEFAULT_ITERATIONS };
