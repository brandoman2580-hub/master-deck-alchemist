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
const ATTRIBUTES = ["DARK", "LIGHT", "EARTH", "WATER", "FIRE", "WIND", "DIVINE"];

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
  if (lowerQuestion.includes("monster") && !lowerQuestion.includes("spell") && !lowerQuestion.includes("trap")) {
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

  // Detect archetype mentions (improved: case-insensitive, supports single words)
  // Strategy 1: Check for quoted strings (e.g., "Toy" cards, 'Blue-Eyes')
  const quotedPattern = /["']([^"']+)["']/g;
  const quotedMatches: string[] = [];
  let quotedMatch;
  while ((quotedMatch = quotedPattern.exec(question)) !== null) {
    quotedMatches.push(quotedMatch[1].trim());
  }

  // Strategy 2: Look for "explore X", "find X", "recommend X" patterns (BEFORE other patterns)
  // This catches "Explore Toy cards" -> "Toy"
  const explorePattern = /\b(?:explore|find|recommend|suggest|show|list|search|look\s+for)\s+([A-Z][a-z]+(?:\s+[A-Z][a-z]+)*)\s+(?:cards?|archetype|monsters?|spells?|traps?)/gi;
  const exploreMatches = question.match(explorePattern) || [];
  const extractedExplore = exploreMatches.map(m => {
    const match = m.match(/\b(?:explore|find|recommend|suggest|show|list|search|look\s+for)\s+([A-Z][a-z]+(?:\s+[A-Z][a-z]+)*)\s+/);
    return match ? match[1] : null;
  }).filter(Boolean) as string[];

  // Strategy 3: Single capitalized words that might be archetypes (e.g., "Toy", "Blue-Eyes")
  // Look for patterns like "Toy cards", "Toy archetype", etc.
  const singleWordArchetypePattern = /\b([A-Z][a-z]+)\s+(?:cards?|archetype|deck|monsters?|spells?|traps?|support)/gi;
  const singleWordMatches = question.match(singleWordArchetypePattern) || [];
  const extractedSingleWords = singleWordMatches.map(m => {
    const match = m.match(/\b([A-Z][a-z]+)\s+/);
    return match ? match[1] : null;
  }).filter(Boolean) as string[];

  // Strategy 4: Capitalized words (case-insensitive regex) - multi-word archetypes
  const archetypePattern = /\b([A-Z][a-z]+(?:\s+[A-Z][a-z]+)*)\b/gi;
  const archetypeMatches = question.match(archetypePattern) || [];

  // Strategy 5: Common archetype keywords followed by a word
  const archetypeKeywords = ['archetype', 'cards', 'deck'];
  const keywordMatches: string[] = [];
  for (const keyword of archetypeKeywords) {
    const keywordPattern = new RegExp(`\\b${keyword}\\s+([A-Z][a-z]+(?:\\s+[A-Z][a-z]+)*)`, 'gi');
    const matches = question.match(keywordPattern);
    if (matches) {
      matches.forEach(match => {
        const extracted = match.replace(new RegExp(`\\b${keyword}\\s+`, 'gi'), '').trim();
        if (extracted) keywordMatches.push(extracted);
      });
    }
  }

  // Combine all matches (prioritize explore/find patterns)
  const allMatches = [...quotedMatches, ...extractedExplore, ...extractedSingleWords, ...archetypeMatches, ...keywordMatches];

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
    ];
    const potentialArchetypes = allMatches
      .map(m => m.trim())
      .filter(m => m.length > 0)
      .filter((match) => !falsePositives.some((fp) => match.toLowerCase().includes(fp.toLowerCase())));
    
    if (potentialArchetypes.length > 0) {
      filters.archetypes = [...new Set(potentialArchetypes)];
    }
  }

  return filters;
}

/**
 * Build deck context text for embedding generation
 * Creates a concise summary of the deck's strategy, archetypes, and key cards
 */
export function buildDeckContextText(deck: {
  mainDeck?: Array<{ name: string; type?: string; desc?: string; archetype?: any }>;
  extraDeck?: Array<{ name: string; type?: string; desc?: string }>;
  sideDeck?: Array<{ name: string; type?: string; desc?: string }>;
}): string {
  const allCards = [
    ...(deck.mainDeck || []),
    ...(deck.extraDeck || []),
    ...(deck.sideDeck || []),
  ];

  if (allCards.length === 0) {
    return "No deck provided";
  }

  // Extract archetypes
  const archetypes = new Set<string>();
  allCards.forEach((card) => {
    const arch = getArchetypeName(card);
    if (arch) archetypes.add(arch);
  });

  // Extract key card types
  const types = new Set<string>();
  allCards.forEach((card) => {
    if (card.type) types.add(card.type);
  });

  // Build context
  const parts: string[] = [];

  if (archetypes.size > 0) {
    parts.push(`Archetypes: ${Array.from(archetypes).join(", ")}`);
  }

  if (types.size > 0) {
    const typeList = Array.from(types).slice(0, 5).join(", ");
    parts.push(`Card types: ${typeList}`);
  }

  // Include top 10 card names
  const topCards = allCards.slice(0, 10).map((c) => c.name).join(", ");
  parts.push(`Key cards: ${topCards}`);

  // Include brief effect descriptions (truncated)
  const effectTexts = allCards
    .slice(0, 5)
    .map((c) => (c.desc || "").slice(0, 100))
    .filter(Boolean)
    .join(" ");
  if (effectTexts) {
    parts.push(`Effects: ${effectTexts}`);
  }

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
        options?: { mean_pool?: boolean; normalize?: boolean }
      ) => Promise<number[]>;
    };
  };
};

/**
 * Get embedding for text using Supabase AI directly (in Deno runtime)
 * This function must be called from within a Supabase Edge Function
 */
export async function getQueryEmbedding(text: string): Promise<number[]> {
  if (!text || text.trim().length === 0) {
    throw new Error("Empty text provided for embedding");
  }

  try {
    // Create an inference session using the built-in Supabase.ai API
    const session = new Supabase.ai.Session("gte-small");
    
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
        }`
      );
    }

    return embedding;
  } catch (error) {
    throw new Error(
      `Failed to generate embedding: ${error instanceof Error ? error.message : String(error)}`
    );
  }
}

/**
 * Perform hybrid search using the hybrid_card_search RPC function
 * Falls back to vector-only or FTS-only if hybrid RPC unavailable
 */
export async function hybridSearch(
  params: HybridSearchParams,
  supabaseClient: any
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
    
    const { data, error } = await supabaseClient.rpc("hybrid_card_search", {
      query_embedding: queryEmbedding,
      query_text: queryText || "card",
      exclude_archetypes: excludeArchetypes,
      exclude_ids: excludeIds,
      exclude_types: excludeTypes,
      exclude_races: excludeRaces,
      banlist_format: banlistFormat,
      vector_weight: vectorWeight,
      fts_weight: ftsWeight,
      match_count: matchCount,
    });

    if (error) {
      console.error("❌ Hybrid search RPC error:", error.message, error.code, error.details);
    } else if (data && data.length > 0) {
      console.log(`✅ Hybrid search RPC returned ${data.length} results`);
      return data.map((row: any) => ({
        id: Number(row.id),
        name: String(row.name),
        archetype: row.archetype ?? null,
        type: row.type ?? null,
        desc: row.desc ?? null,
        vector_sim: row.vector_sim,
        fts_rank: row.fts_rank,
        hybrid_score: row.hybrid_score,
      }));
    } else {
      console.warn("⚠️ Hybrid search RPC returned empty result (no error)");
    }
  } catch (err) {
    console.error("❌ Hybrid search RPC exception:", err instanceof Error ? err.message : String(err));
  }

  // Fallback 1: Try vector search only
  try {
    console.log("🔍 Attempting vector-only search (match_cards_with_exclusions)...");
    const { data, error } = await supabaseClient.rpc("match_cards_with_exclusions", {
      query_embedding: queryEmbedding,
      exclude_archetypes: excludeArchetypes,
      exclude_ids: excludeIds,
      match_count: matchCount,
    });

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
        vector_sim: row.similarity,
      }));
    } else {
      console.warn("⚠️ Vector search returned empty result");
    }
  } catch (err) {
    console.error("❌ Vector search RPC exception:", err instanceof Error ? err.message : String(err));
  }

  // Fallback 2: Try FTS search only
  if (queryText) {
    try {
      console.log("🔍 Attempting FTS-only search (match_cards_by_text)...");
      const { data, error } = await supabaseClient.rpc("match_cards_by_text", {
        query: queryText,
        match_count: matchCount,
        excluded_ids: excludeIds.length > 0 ? excludeIds : [0],
        banlist_format: banlistFormat,
      });

      if (error) {
        console.error("❌ FTS search RPC error:", error.message, error.code);
      } else if (data && data.length > 0) {
        console.log(`✅ FTS search returned ${data.length} results`);
        return data.map((row: any) => ({
          id: Number(row.card_id || row.id),
          name: String(row.name),
          archetype: row.archetype ?? null,
          type: row.type ?? null,
          desc: row.desc ?? null,
          fts_rank: row.rank,
        }));
      } else {
        console.warn("⚠️ FTS search returned empty result");
      }
    } catch (err) {
      console.error("❌ FTS search RPC exception:", err instanceof Error ? err.message : String(err));
    }
  }

  // Last resort: Try a very permissive search without exclusions (if we have too many exclusions)
  if (excludeIds.length > 50 || excludeArchetypes.length > 10) {
    console.log("🔄 Last resort: Trying search with reduced exclusions...");
    try {
      // Try with only ID exclusions (no archetype exclusions)
      const { data, error } = await supabaseClient.rpc("match_cards_with_exclusions", {
        query_embedding: queryEmbedding,
        exclude_archetypes: [],
        exclude_ids: excludeIds.slice(0, 20), // Only exclude first 20 IDs
        match_count: matchCount,
      });

      if (!error && data && data.length > 0) {
        console.log(`✅ Last resort search returned ${data.length} results`);
        return data.map((row: any) => ({
          id: Number(row.id),
          name: String(row.name),
          archetype: row.archetype ?? null,
          type: row.type ?? null,
          desc: row.desc ?? null,
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

