/**
 * Shared card search utilities for recommendation agent and other edge functions
 * Provides reusable functions for question analysis, embedding generation, and hybrid search
 */

import { createClient } from "@supabase/supabase-js";

// Type definitions
export interface StructuredFilters {
  types?: string[];
  races?: string[];
  attributes?: string[];
  archetypes?: string[];
  excludeTypes?: string[];
  excludeRaces?: string[];
  excludeArchetypes?: string[];
}

export interface HybridSearchParams {
  queryEmbedding: number[];
  queryText: string;
  excludeArchetypes?: string[];
  excludeIds?: number[];
  excludeTypes?: string[];
  excludeRaces?: string[];
  banlistFormat?: "MASTER_DUEL" | "TCG";
  vectorWeight?: number;
  ftsWeight?: number;
  matchCount?: number;
}

export interface CardCandidate {
  id: number;
  name: string;
  archetype?: string | null;
  type?: string | null;
  desc?: string | null;
  race?: string | null; // Added for synergy scoring (e.g., "Dragon", "Spellcaster")
  attribute?: string | null; // Added for synergy scoring (e.g., "LIGHT", "DARK")
  level?: number; // Added for level-based synergy
  vector_sim?: number;
  fts_rank?: number;
  hybrid_score?: number;
}

// Card type mappings for question analysis
const CARD_TYPES = [
  "Normal Monster",
  "Effect Monster",
  "Ritual Monster",
  "Fusion Monster",
  "Synchro Monster",
  "Xyz Monster",
  "Pendulum Monster",
  "Link Monster",
  "Spell Card",
  "Trap Card",
  "Normal Spell",
  "Quick-Play Spell",
  "Continuous Spell",
  "Field Spell",
  "Ritual Spell",
  "Equip Spell",
  "Normal Trap",
  "Continuous Trap",
  "Counter Trap",
];

const MONSTER_TYPES = [
  "Normal Monster",
  "Effect Monster",
  "Ritual Monster",
  "Fusion Monster",
  "Synchro Monster",
  "Xyz Monster",
  "Pendulum Monster",
  "Link Monster",
];

const SPELL_TYPES = [
  "Spell Card",
  "Normal Spell",
  "Quick-Play Spell",
  "Continuous Spell",
  "Field Spell",
  "Ritual Spell",
  "Equip Spell",
];

const TRAP_TYPES = [
  "Trap Card",
  "Normal Trap",
  "Continuous Trap",
  "Counter Trap",
];

// Common monster races
const RACES = [
  "Dragon",
  "Spellcaster",
  "Zombie",
  "Warrior",
  "Beast-Warrior",
  "Beast",
  "Winged Beast",
  "Fiend",
  "Fairy",
  "Insect",
  "Dinosaur",
  "Reptile",
  "Fish",
  "Sea Serpent",
  "Machine",
  "Thunder",
  "Aqua",
  "Pyro",
  "Rock",
  "Plant",
  "Psychic",
  "Divine-Beast",
  "Wyrm",
  "Cyberse",
];

// Attributes
const ATTRIBUTES = [
  "DARK",
  "LIGHT",
  "EARTH",
  "WATER",
  "FIRE",
  "WIND",
  "DIVINE",
];

/**
 * Analyze user question to extract structured filters
 * Auto-detects card types, races, attributes, and archetypes from natural language
 */
export function analyzeQuestionForFilters(question: string): StructuredFilters {
  const lowerQuestion = question.toLowerCase();
  const filters: StructuredFilters = {};

  // Detect card types
  const detectedTypes: string[] = [];
  if (lowerQuestion.includes("spell") || lowerQuestion.includes("spell card")) {
    detectedTypes.push(...SPELL_TYPES);
  }
  if (lowerQuestion.includes("trap") || lowerQuestion.includes("trap card")) {
    detectedTypes.push(...TRAP_TYPES);
  }
  if (
    lowerQuestion.includes("monster") &&
    !lowerQuestion.includes("spell") &&
    !lowerQuestion.includes("trap")
  ) {
    detectedTypes.push(...MONSTER_TYPES);
  }
  if (lowerQuestion.includes("fusion")) {
    detectedTypes.push("Fusion Monster");
  }
  if (lowerQuestion.includes("synchro")) {
    detectedTypes.push("Synchro Monster");
  }
  if (lowerQuestion.includes("xyz") || lowerQuestion.includes("xyz")) {
    detectedTypes.push("Xyz Monster");
  }
  if (lowerQuestion.includes("link")) {
    detectedTypes.push("Link Monster");
  }
  if (lowerQuestion.includes("pendulum")) {
    detectedTypes.push("Pendulum Monster");
  }
  if (lowerQuestion.includes("ritual")) {
    detectedTypes.push("Ritual Monster");
  }

  if (detectedTypes.length > 0) {
    filters.types = [...new Set(detectedTypes)];
  }

  // Detect races
  const detectedRaces: string[] = [];
  for (const race of RACES) {
    if (lowerQuestion.includes(race.toLowerCase())) {
      detectedRaces.push(race);
    }
  }
  if (detectedRaces.length > 0) {
    filters.races = detectedRaces;
  }

  // Detect attributes
  const detectedAttributes: string[] = [];
  for (const attr of ATTRIBUTES) {
    if (lowerQuestion.includes(attr.toLowerCase())) {
      detectedAttributes.push(attr);
    }
  }
  if (detectedAttributes.length > 0) {
    filters.attributes = detectedAttributes;
  }

  // Filter out category labels in brackets (e.g., [POWER LEVEL], [CONSISTENCY])
  // These are analysis mode labels, not archetypes
  const categoryLabels = ["POWER LEVEL", "CONSISTENCY", "INTERACTION", "META", "POWER", "CONSISTENCY", "INTERACTION"];
  const categoryPattern = /\[([A-Z\s]+)\]/g;
  const cleanedQuestion = question.replace(categoryPattern, (match, label) => {
    if (categoryLabels.some(cat => label.toUpperCase().includes(cat))) {
      return ""; // Remove category labels
    }
    return match; // Keep other bracketed text
  });

  // Detect archetype mentions (improved: case-insensitive, supports single words)
  // Strategy 1: Check for quoted strings (e.g., "Toy" cards, 'Blue-Eyes')
  const quotedPattern = /["']([^"']+)["']/g;
  const quotedMatches: string[] = [];
  let quotedMatch;
  while ((quotedMatch = quotedPattern.exec(cleanedQuestion)) !== null) {
    quotedMatches.push(quotedMatch[1].trim());
  }

  // Strategy 2: Look for "explore X", "find X", "recommend X" patterns (BEFORE other patterns)
  // This catches "Explore Toy cards" -> "Toy"
  const explorePattern =
    /\b(?:explore|find|recommend|suggest|show|list|search|look\s+for)\s+([A-Z][a-z]+(?:\s+[A-Z][a-z]+)*)\s+(?:cards?|archetype|monsters?|spells?|traps?)/gi;
  const exploreMatches = cleanedQuestion.match(explorePattern) || [];
  const extractedExplore = exploreMatches
    .map((m) => {
      const match = m.match(
        /\b(?:explore|find|recommend|suggest|show|list|search|look\s+for)\s+([A-Z][a-z]+(?:\s+[A-Z][a-z]+)*)\s+/,
      );
      return match ? match[1] : null;
    })
    .filter(Boolean) as string[];

  // Strategy 3: Single capitalized words that might be archetypes (e.g., "Toy", "Blue-Eyes")
  // Look for patterns like "Toy cards", "Toy archetype", etc.
  const singleWordArchetypePattern =
    /\b([A-Z][a-z]+)\s+(?:cards?|archetype|deck|monsters?|spells?|traps?|support)/gi;
  const singleWordMatches = cleanedQuestion.match(singleWordArchetypePattern) || [];
  const extractedSingleWords = singleWordMatches
    .map((m) => {
      const match = m.match(/\b([A-Z][a-z]+)\s+/);
      return match ? match[1] : null;
    })
    .filter(Boolean) as string[];

  // Strategy 4: Capitalized words (case-insensitive regex) - multi-word archetypes
  const archetypePattern = /\b([A-Z][a-z]+(?:\s+[A-Z][a-z]+)*)\b/gi;
  const archetypeMatches = cleanedQuestion.match(archetypePattern) || [];

  // Strategy 5: Common archetype keywords followed by a word
  const archetypeKeywords = ["archetype", "cards", "deck"];
  const keywordMatches: string[] = [];
  for (const keyword of archetypeKeywords) {
    const keywordPattern = new RegExp(
      `\\b${keyword}\\s+([A-Z][a-z]+(?:\\s+[A-Z][a-z]+)*)`,
      "gi",
    );
    const matches = cleanedQuestion.match(keywordPattern);
    if (matches) {
      matches.forEach((match) => {
        const extracted = match
          .replace(new RegExp(`\\b${keyword}\\s+`, "gi"), "")
          .trim();
        if (extracted) keywordMatches.push(extracted);
      });
    }
  }

  // Combine all matches (prioritize explore/find patterns)
  const allMatches = [
    ...quotedMatches,
    ...extractedExplore,
    ...extractedSingleWords,
    ...archetypeMatches,
    ...keywordMatches,
  ];

  if (allMatches.length > 0) {
    // Filter out common false positives
    const falsePositives = [
      "Spell Card",
      "Trap Card",
      "Monster",
      "Master Duel",
      "TCG",
      "Deck",
      "Hand",
      "Graveyard",
      "Field",
      "Extra Deck",
      "Main Deck",
      "Side Deck",
      "Card",
      "Cards",
      // Category labels (analysis modes)
      "Power Level",
      "POWER LEVEL",
      "Consistency",
      "CONSISTENCY",
      "Interaction",
      "INTERACTION",
      "Meta",
      "META",
      "Power",
      "POWER",
    ];
    const potentialArchetypes = allMatches
      .map((m) => m.trim())
      .filter((m) => m.length > 0)
      .filter(
        (match) =>
          !falsePositives.some((fp) =>
            match.toLowerCase().includes(fp.toLowerCase()),
          ),
      );

    if (potentialArchetypes.length > 0) {
      filters.archetypes = [...new Set(potentialArchetypes)];
    }
  }

  return filters;
}

/**
 * Build deck context text for embedding generation
 * Creates a concise summary of the deck's strategy, archetypes, and key cards
 * Enhanced version that accepts optional deck analysis for richer context
 */
export function buildDeckContextText(
  deck: {
    mainDeck?: Array<{
      name: string;
      type?: string;
      desc?: string;
      archetype?: any;
    }>;
    extraDeck?: Array<{ name: string; type?: string; desc?: string; archetype?: any }>;
    sideDeck?: Array<{ name: string; type?: string; desc?: string; archetype?: any }>;
  },
  deckAnalysis?: {
    primaryArchetype?: string | null;
    playstyle?: string;
    deckSize?: number;
    mainDeckSize?: number;
    extraDeckSize?: number;
    ratios?: {
      monsters: number;
      spells: number;
      traps: number;
      monstersPercent: number;
      spellsPercent: number;
      trapsPercent: number;
    };
    cardRoles?: {
      starters: number;
      extenders: number;
      interruptions: number;
      boardBreakers: number;
      endBoardPieces: number;
    };
    winCondition?: string;
    estimatedBrickRate?: number;
    missingStaples?: Array<{ cardName: string; reason: string }>;
  }
): string {
  const allCards = [
    ...(deck.mainDeck || []),
    ...(deck.extraDeck || []),
    ...(deck.sideDeck || []),
  ];

  if (allCards.length === 0) {
    return "No deck provided";
  }

  const parts: string[] = [];

  // Enhanced context with deck analysis if provided
  if (deckAnalysis) {
    if (deckAnalysis.primaryArchetype) {
      parts.push(`Primary archetype: ${deckAnalysis.primaryArchetype}`);
    }
    if (deckAnalysis.playstyle) {
      parts.push(`Playstyle: ${deckAnalysis.playstyle}`);
    }
    if (deckAnalysis.mainDeckSize) {
      parts.push(`Deck size: ${deckAnalysis.mainDeckSize} main deck cards`);
    }
    if (deckAnalysis.ratios) {
      parts.push(
        `Ratios: ${deckAnalysis.ratios.monsters}M / ${deckAnalysis.ratios.spells}S / ${deckAnalysis.ratios.traps}T (${deckAnalysis.ratios.monstersPercent.toFixed(1)}% / ${deckAnalysis.ratios.spellsPercent.toFixed(1)}% / ${deckAnalysis.ratios.trapsPercent.toFixed(1)}%)`
      );
    }
    if (deckAnalysis.cardRoles) {
      parts.push(
        `Card roles: ${deckAnalysis.cardRoles.starters} starters, ${deckAnalysis.cardRoles.extenders} extenders, ${deckAnalysis.cardRoles.interruptions} interruptions`
      );
    }
    if (deckAnalysis.winCondition) {
      parts.push(`Win condition: ${deckAnalysis.winCondition}`);
    }
    if (deckAnalysis.estimatedBrickRate !== undefined) {
      parts.push(
        `Estimated brick rate: ${(deckAnalysis.estimatedBrickRate * 100).toFixed(1)}%`
      );
    }
    if (deckAnalysis.missingStaples && deckAnalysis.missingStaples.length > 0) {
      parts.push(
        `Missing staples: ${deckAnalysis.missingStaples.map((s) => s.cardName).join(", ")}`
      );
    }
  }

  // Extract archetypes (fallback if no analysis)
  if (!deckAnalysis?.primaryArchetype) {
    const archetypes = new Set<string>();
    allCards.forEach((card) => {
      const arch = getArchetypeName(card);
      if (arch) archetypes.add(arch);
    });
    if (archetypes.size > 0) {
      parts.push(`Archetypes: ${Array.from(archetypes).join(", ")}`);
    }
  }

  // Include top 10 card names
  const topCards = allCards
    .slice(0, 10)
    .map((c) => c.name)
    .join(", ");
  parts.push(`Key cards: ${topCards}`);

  return parts.join(". ");
}

/**
 * Helper to extract archetype name from card object
 */
function getArchetypeName(card: { archetype?: any }): string {
  const raw = card?.archetype;
  if (!raw) return "";
  if (typeof raw === "string") {
    const trimmed = raw.trim();
    if (trimmed === "[object Object]") return "";
    return trimmed;
  }
  if (typeof raw === "object" && typeof raw.name === "string") {
    const name = raw.name.trim();
    if (name === "[object Object]") return "";
    return name;
  }
  return "";
}

// Declare Supabase.ai global (available at runtime in Supabase Edge Functions)
declare const Supabase: {
  ai: {
    Session: new (model: string) => {
      run: (
        input: string,
        options?: { mean_pool?: boolean; normalize?: boolean },
      ) => Promise<number[]>;
    };
  };
};

/**
 * Get embedding for text using Supabase AI directly (in Deno runtime)
 * This function must be called from within a Supabase Edge Function
 * CRITICAL: Uses MODEL_NAME env variable to match the model used for card embeddings
 */
export async function getQueryEmbedding(text: string): Promise<number[]> {
  if (!text || text.trim().length === 0) {
    throw new Error("Empty text provided for embedding");
  }

  try {
    // Use "gte-small" for Supabase embedding model (must match the model used to generate card embeddings)
    // Note: MODEL_NAME env variable is for LLM model (Groq), not embedding model
    const modelName = "gte-small";
    
    // Create an inference session using the built-in Supabase.ai API
    const session = new Supabase.ai.Session(modelName);

    const raw = await session.run(String(text).slice(0, 20000), {
      mean_pool: true,
      normalize: true,
    });

    // Normalize to a plain JS number[]
    const embedding = Array.isArray(raw)
      ? raw.map((v: any) => Number(v))
      : Array.from(raw as any, (v: any) => Number(v));

    if (!embedding || !Array.isArray(embedding) || embedding.length === 0) {
      throw new Error(
        `Invalid embedding format: expected non-empty array, got length=${
          embedding?.length ?? 0
        }`,
      );
    }

    return embedding;
  } catch (error) {
    throw new Error(
      `Failed to generate embedding: ${error instanceof Error ? error.message : String(error)}`,
    );
  }
}

/**
 * Perform hybrid search using the hybrid_card_search RPC function
 * Falls back to vector-only or FTS-only if hybrid RPC unavailable
 */
export async function hybridSearch(
  params: HybridSearchParams,
  supabaseClient: any,
): Promise<CardCandidate[]> {
  const {
    queryEmbedding,
    queryText,
    excludeArchetypes = [],
    excludeIds = [],
    excludeTypes = [],
    excludeRaces = [],
    banlistFormat = "MASTER_DUEL",
    vectorWeight = 0.7,
    ftsWeight = 0.3,
    matchCount = 200,
  } = params;

  // Try hybrid search RPC first
  try {
    console.log("🔍 Attempting hybrid_card_search RPC with params:", {
      queryText: queryText?.substring(0, 50),
      excludeArchetypes: excludeArchetypes.length,
      excludeIds: excludeIds.length,
      excludeTypes: excludeTypes.length,
      excludeRaces: excludeRaces.length,
      matchCount,
    });

    // Ensure exclude_ids are integers (not bigints) to avoid type ambiguity
    const excludeIdsInt = excludeIds.map((id) => Number(id)).filter((id) => !isNaN(id));
    
    const { data, error } = await supabaseClient.rpc("hybrid_card_search", {
      query_embedding: queryEmbedding,
      query_text: queryText || "card",
      exclude_archetypes: excludeArchetypes,
      exclude_ids: excludeIdsInt,
      exclude_types: excludeTypes,
      exclude_races: excludeRaces,
      banlist_format: banlistFormat,
      vector_weight: vectorWeight,
      fts_weight: ftsWeight,
      match_count: matchCount,
    });

    if (error) {
      console.error(
        "❌ Hybrid search RPC error:",
        error.message,
        error.code,
        error.details,
      );
    } else if (data && data.length > 0) {
      console.log(`✅ Hybrid search RPC returned ${data.length} results`);
      return data.map((row: any) => ({
        id: Number(row.id),
        name: String(row.name),
        archetype: row.archetype ?? null,
        type: row.type ?? null,
        desc: row.desc ?? null,
        race: row.race ?? null,
        attribute: row.attribute ?? null,
        level: row.level ?? null,
        vector_sim: row.vector_sim,
        fts_rank: row.fts_rank,
        hybrid_score: row.hybrid_score,
      }));
    } else {
      console.warn("⚠️ Hybrid search RPC returned empty result (no error)");
    }
  } catch (err) {
    console.error(
      "❌ Hybrid search RPC exception:",
      err instanceof Error ? err.message : String(err),
    );
  }

  // Fallback 1: Try vector search only
  try {
    console.log(
      "🔍 Attempting vector-only search (match_cards_with_exclusions)...",
    );
    // Ensure exclude_ids are integers (not bigints) to avoid type ambiguity
    const excludeIdsInt = excludeIds.map((id) => Number(id)).filter((id) => !isNaN(id));
    
    const { data, error } = await supabaseClient.rpc(
      "match_cards_with_exclusions",
      {
        query_embedding: queryEmbedding,
        exclude_archetypes: excludeArchetypes,
        exclude_ids: excludeIdsInt,
        match_count: matchCount,
      },
    );

    if (error) {
      console.error("❌ Vector search RPC error:", error.message, error.code);
    } else if (data && data.length > 0) {
      console.log(`✅ Vector search returned ${data.length} results`);
      return data.map((row: any) => ({
        id: Number(row.id),
        name: String(row.name),
        archetype: row.archetype ?? null,
        type: row.type ?? null,
        desc: row.desc ?? null,
        race: row.race ?? null,
        attribute: row.attribute ?? null,
        level: row.level ?? null,
        vector_sim: row.similarity,
      }));
    } else {
      console.warn("⚠️ Vector search returned empty result");
    }
  } catch (err) {
    console.error(
      "❌ Vector search RPC exception:",
      err instanceof Error ? err.message : String(err),
    );
  }

  // Fallback 2: Try FTS search only (use direct SQL query since RPC may not exist)
  if (queryText) {
    try {
      console.log("🔍 Attempting FTS-only search via direct query...");
      // Ensure exclude_ids are integers
      const excludeIdsInt = excludeIds.map((id) => Number(id)).filter((id) => !isNaN(id));
      
      // Use direct SQL query with text search
      let query = supabaseClient
        .from("cards")
        .select("id, name, archetype, type, desc")
        .textSearch("name", queryText, { type: "websearch" });
      
      // Exclude IDs using filter (Supabase doesn't support .not() with "in" directly)
      if (excludeIdsInt.length > 0 && excludeIdsInt.length < 100) {
        // For small lists, use individual .not() calls
        for (const excludeId of excludeIdsInt.slice(0, 50)) { // Limit to 50 to avoid query size issues
          query = query.neq("id", excludeId);
        }
      }
      
      query = query.limit(matchCount);
      const { data, error } = await query;

      if (error) {
        console.error("❌ FTS search error:", error.message, error.code);
      } else if (data && data.length > 0) {
        console.log(`✅ FTS search returned ${data.length} results`);
        return data.map((row: any) => ({
          id: Number(row.id),
          name: String(row.name),
          archetype: row.archetype ?? null,
          type: row.type ?? null,
          desc: row.desc ?? null,
          race: row.race ?? null,
          attribute: row.attribute ?? null,
          level: row.level ?? null,
          fts_rank: 1.0, // Default rank for direct queries
        }));
      } else {
        console.warn("⚠️ FTS search returned empty result");
      }
    } catch (err) {
      console.error(
        "❌ FTS search RPC exception:",
        err instanceof Error ? err.message : String(err),
      );
    }
  }

  // Last resort: Try a very permissive search without exclusions (if we have too many exclusions)
  if (excludeIds.length > 50 || excludeArchetypes.length > 10) {
    console.log("🔄 Last resort: Trying search with reduced exclusions...");
    try {
      // Try with only ID exclusions (no archetype exclusions)
      const { data, error } = await supabaseClient.rpc(
        "match_cards_with_exclusions",
        {
          query_embedding: queryEmbedding,
          exclude_archetypes: [],
          exclude_ids: excludeIds.slice(0, 20), // Only exclude first 20 IDs
          match_count: matchCount,
        },
      );

      if (!error && data && data.length > 0) {
        console.log(`✅ Last resort search returned ${data.length} results`);
        return data.map((row: any) => ({
          id: Number(row.id),
          name: String(row.name),
          archetype: row.archetype ?? null,
          type: row.type ?? null,
          desc: row.desc ?? null,
          race: row.race ?? null,
          attribute: row.attribute ?? null,
          level: row.level ?? null,
          vector_sim: row.similarity,
        }));
      }
    } catch (err) {
      console.error("❌ Last resort search also failed:", err);
    }
  }

  // All methods failed
  console.error("❌ All search methods failed - no candidates found");
  return [];
}
