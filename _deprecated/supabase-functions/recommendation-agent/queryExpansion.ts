/**
 * Phase 2: Query Expansion
 * Expands user queries with archetype-specific and playstyle-specific terms
 */

import type { EnhancedDeckAnalysis } from "../_shared/intentClassifier.ts";
import { getArchetypeTerms } from "../../../lib/analysis/archetypeKnowledge.ts";

const ENABLE_QUERY_EXPANSION = Deno.env.get("ENABLE_QUERY_EXPANSION") !== "false"; // Default: true

/**
 * Expand query with archetype-specific and playstyle-specific terms
 */
export function expandQuery(
  originalQuestion: string,
  deckAnalysis: EnhancedDeckAnalysis | undefined,
  intentType?: string,
): string {
  if (!ENABLE_QUERY_EXPANSION) {
    return originalQuestion;
  }

  const expandedTerms: string[] = [];
  const questionLower = originalQuestion.toLowerCase();

  // Add archetype-specific terms
  if (deckAnalysis?.primaryArchetype) {
    const archetypeTerms = getArchetypeTerms(deckAnalysis.primaryArchetype);
    expandedTerms.push(...archetypeTerms);
    console.log(`[QUERY-EXPANSION] Added ${archetypeTerms.length} terms for archetype: ${deckAnalysis.primaryArchetype}`);
  }

  // Add playstyle-specific terms
  if (deckAnalysis?.playstyle) {
    const playstyleTerms = getPlaystyleTerms(deckAnalysis.playstyle);
    expandedTerms.push(...playstyleTerms);
    console.log(`[QUERY-EXPANSION] Added ${playstyleTerms.length} terms for playstyle: ${deckAnalysis.playstyle}`);
  }

  // Add intent-specific synonyms
  if (intentType) {
    const intentSynonyms = getIntentSynonyms(intentType);
    expandedTerms.push(...intentSynonyms);
    console.log(`[QUERY-EXPANSION] Added ${intentSynonyms.length} synonyms for intent: ${intentType}`);
  }

  // Remove duplicates and filter out terms already in the question
  const uniqueTerms = [...new Set(expandedTerms)]
    .filter(term => {
      const termLower = term.toLowerCase();
      return !questionLower.includes(termLower) && term.length > 2;
    })
    .slice(0, 10); // Limit to 10 additional terms to avoid bloating

  if (uniqueTerms.length === 0) {
    return originalQuestion;
  }

  const expandedQuery = `${originalQuestion} ${uniqueTerms.join(" ")}`;
  console.log(`[QUERY-EXPANSION] Expanded query: "${originalQuestion.substring(0, 50)}..." -> "${expandedQuery.substring(0, 100)}..."`);

  return expandedQuery;
}

/**
 * Get playstyle-specific terms
 */
function getPlaystyleTerms(playstyle: EnhancedDeckAnalysis["playstyle"]): string[] {
  const terms: Record<string, string[]> = {
    Combo: ["starter", "extender", "one-card combo", "combo piece", "combo enabler", "searcher"],
    Control: ["interruption", "negate", "removal", "grind game", "resource", "recurring"],
    Midrange: ["versatile", "value", "advantage", "tempo", "mid-game"],
    Stun: ["floodgate", "lock", "prevent", "cannot", "restriction"],
    Beatdown: ["attack", "damage", "OTK", "finisher", "boss monster"],
    Balanced: ["versatile", "flexible", "adaptable"],
  };

  return terms[playstyle] || [];
}

/**
 * Get intent-specific synonyms
 */
function getIntentSynonyms(intentType: string): string[] {
  const synonyms: Record<string, string[]> = {
    consistency: ["tutor", "thin deck", "cycle", "draw power", "search", "add to hand"],
    interaction: ["hand trap", "negate", "interrupt", "disruption", "going second", "board breaker"],
    power: ["combo", "extender", "boss monster", "end board", "win condition"],
    tech: ["counter", "side deck", "specific", "against", "out"],
    archetype_support: ["archetype", "support", "engine", "core"],
  };

  return synonyms[intentType] || [];
}
