import { createClient } from "@/utils/supabase/client";
import type { EngineFormat, FactsEnvelope } from "./types";
import type {
  ArchetypeStrategyRow,
  StrategyWeightRow,
} from "./diagnostics";

const supabase = createClient();

/**
 * Load curated strategy tables for Facts Brain consumers.
 * Returns empty arrays when offline / unauthenticated so heuristics still run.
 */
export async function loadStrategyKnowledge(format: EngineFormat): Promise<{
  strategyWeights: StrategyWeightRow[];
  archetypeStrategies: ArchetypeStrategyRow[];
}> {
  const [weightsRes, archetypesRes] = await Promise.all([
    supabase
      .from("card_strategy_weights")
      .select("card_id, format, strategy, role, synergy_weight, is_boss")
      .eq("format", format),
    supabase
      .from("archetype_strategies")
      .select(
        "archetype_name, format, primary_strategy, secondary_strategy",
      )
      .eq("format", format),
  ]);

  const strategyWeights: StrategyWeightRow[] = (weightsRes.data ?? []).map(
    (row) => ({
      cardId: String(row.card_id),
      format: row.format as EngineFormat,
      strategy: row.strategy,
      role: row.role,
      synergyWeight: Number(row.synergy_weight),
      isBoss: Boolean(row.is_boss),
    }),
  );

  const archetypeStrategies: ArchetypeStrategyRow[] = (
    archetypesRes.data ?? []
  ).map((row) => ({
    archetypeName: row.archetype_name,
    format: row.format as EngineFormat,
    primaryStrategy: row.primary_strategy,
    secondaryStrategy: row.secondary_strategy,
  }));

  return { strategyWeights, archetypeStrategies };
}

/**
 * Upsert FactsEnvelope into deck_analysis_cache (remote SoT).
 */
export async function upsertDeckAnalysisCache(
  facts: FactsEnvelope,
): Promise<void> {
  const { error } = await supabase.from("deck_analysis_cache").upsert({
    deck_id: facts.deckId,
    deck_hash: facts.deckHash,
    format: facts.format,
    facts,
    computed_at: new Date().toISOString(),
  });

  if (error) {
    throw new Error(`Failed to cache deck analysis: ${error.message}`);
  }
}

/**
 * Read cached facts when deck hash still matches.
 */
export async function readDeckAnalysisCache(
  deckId: string,
  deckHash: string,
): Promise<FactsEnvelope | null> {
  const { data, error } = await supabase
    .from("deck_analysis_cache")
    .select("facts, deck_hash")
    .eq("deck_id", deckId)
    .maybeSingle();

  if (error || !data) return null;
  if (data.deck_hash !== deckHash) return null;
  return data.facts as FactsEnvelope;
}
