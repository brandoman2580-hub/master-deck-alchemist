import type { BanStatus, DeckCard, DeckType } from "@/types/types";
import type { Card } from "@/types/card";
import { buildFactsEnvelope } from "./build-facts";
import { compileCombos, type DeckCardRef } from "./combos";
import { loadComboTemplates } from "./combo-templates";
import { computeDeckHash, toEngineFormat } from "./deck-hash";
import {
  loadStrategyKnowledge,
  readDeckAnalysisCache,
  upsertDeckAnalysisCache,
} from "./facts-cache";
import { loadMetaMatchupTemplates } from "./meta-templates";
import { scoreMatchupReadiness } from "./matchups";
import { tagMainDeckForConsistency } from "./tag-main-deck";
import { runConsistencySimulation } from "./worker/client";
import { FACTS_SCHEMA_VERSION, type FactsEnvelope } from "./types";

const DEFAULT_ITERATIONS = 3000;

/**
 * Cached envelopes must match the current schema and include grade breakdown
 * (0.2.0+). Stale 0.1.0 rows are ignored so Workshop recompute runs.
 */
export function isUsableCachedFacts(
  facts: FactsEnvelope | null | undefined,
): facts is FactsEnvelope {
  if (!facts) return false;
  if (facts.schemaVersion !== FACTS_SCHEMA_VERSION) return false;
  if (!(facts.consistency?.n > 0)) return false;
  if (!facts.combos || !facts.matchups) return false;
  if (!facts.grade?.breakdown) return false;
  return true;
}

export interface GetFactsOptions {
  banlist?: Record<string, BanStatus | string>;
  savedDeckIds?: ReadonlySet<string>;
  /** Monte Carlo iterations (desktop budget ~2k–5k). */
  iterations?: number;
  /** Persist envelope to deck_analysis_cache when legality allows. */
  writeCache?: boolean;
  /** Reuse cache when deck hash matches. */
  readCache?: boolean;
  requirePersisted?: boolean;
}

function toDeckCardRefs(deck: DeckType): DeckCardRef[] {
  const map = (cards: DeckCard[], zone: DeckCardRef["zone"]) =>
    cards.map((c) => ({ id: c.id, name: c.name, zone }));
  return [
    ...map(deck.mainDeck, "main"),
    ...map(deck.extraDeck, "extra"),
    ...map(deck.sideDeck, "side"),
  ];
}

/**
 * Shared getFacts pipeline (Phases 2–4):
 * diagnostics → consistency → matchups → combos → grade → optional cache.
 *
 * Workshop Matchups/Combos/grade and future coach wrappers should call this
 * instead of re-implementing the pipeline.
 */
export async function getFacts(
  deck: DeckType,
  options: GetFactsOptions = {},
): Promise<FactsEnvelope | null> {
  if (deck.mainDeck.length < 40) {
    return null;
  }

  const format = toEngineFormat(deck.mode);
  const deckHash = computeDeckHash(deck);

  if (options.readCache !== false) {
    const cached = await readDeckAnalysisCache(deck.id, deckHash);
    if (isUsableCachedFacts(cached)) {
      return cached;
    }
  }

  const { strategyWeights, archetypeStrategies } =
    await loadStrategyKnowledge(format);

  const base = buildFactsEnvelope(deck, {
    banlist: options.banlist,
    savedDeckIds: options.savedDeckIds,
    strategyWeights,
    archetypeStrategies,
    requirePersisted: options.requirePersisted ?? false,
  });

  const tagged = tagMainDeckForConsistency(
    deck.mainDeck as Card[],
    format,
    strategyWeights,
  );

  const consistency = await runConsistencySimulation(
    tagged,
    options.iterations ?? DEFAULT_ITERATIONS,
  );

  const metaTemplates = await loadMetaMatchupTemplates(format);
  const matchups = scoreMatchupReadiness({
    diagnostics: base.diagnostics,
    consistency,
    templates: metaTemplates,
  });

  const comboTemplates = await loadComboTemplates(
    format,
    base.diagnostics.strategyFit.primaryArchetype,
  );

  const starterNames = deck.mainDeck
    .filter((c) => tagged.some((t) => t.id === c.id && t.isStarter))
    .map((c) => c.name);

  const combos = compileCombos({
    format,
    archetype: base.diagnostics.strategyFit.primaryArchetype,
    deckCards: toDeckCardRefs(deck),
    templates: comboTemplates,
    bosses: base.diagnostics.bosses,
    starterNames,
  });

  const facts = buildFactsEnvelope(deck, {
    banlist: options.banlist,
    savedDeckIds: options.savedDeckIds,
    strategyWeights,
    archetypeStrategies,
    requirePersisted: options.requirePersisted ?? false,
    consistency,
    matchups,
    combos,
  });

  if (options.writeCache !== false && facts.legality.ok !== false) {
    try {
      await upsertDeckAnalysisCache(facts);
    } catch {
      // Cache write is best-effort for workshop UX
    }
  }

  return facts;
}
