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

  // Detect archetype mentions (capitalized words, common patterns)
  // This is a simple heuristic - could be improved with NLP
  const archetypePattern = /\b([A-Z][a-z]+(?:\s+[A-Z][a-z]+)*)\b/g;
  const archetypeMatches = question.match(archetypePattern);
  if (archetypeMatches) {
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
    ];
    const potentialArchetypes = archetypeMatches.filter(
      (match) => !falsePositives.some((fp) => match.includes(fp))
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

    if (!error && data && data.length > 0) {
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
    }
  } catch (err) {
    console.warn("Hybrid search RPC not available, falling back:", err);
  }

  // Fallback 1: Try vector search only
  try {
    const { data, error } = await supabaseClient.rpc("match_cards_with_exclusions", {
      query_embedding: queryEmbedding,
      exclude_archetypes: excludeArchetypes,
      exclude_ids: excludeIds,
      match_count: matchCount,
    });

    if (!error && data && data.length > 0) {
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
    console.warn("Vector search RPC also failed:", err);
  }

  // Fallback 2: Try FTS search only
  if (queryText) {
    try {
      const { data, error } = await supabaseClient.rpc("match_cards_by_text", {
        query: queryText,
        match_count: matchCount,
        excluded_ids: excludeIds.length > 0 ? excludeIds : [0],
        banlist_format: banlistFormat,
      });

      if (!error && data && data.length > 0) {
        return data.map((row: any) => ({
          id: Number(row.card_id || row.id),
          name: String(row.name),
          archetype: row.archetype ?? null,
          type: row.type ?? null,
          desc: row.desc ?? null,
          fts_rank: row.rank,
        }));
      }
    } catch (err) {
      console.warn("FTS search RPC also failed:", err);
    }
  }

  // Last resort: return empty array
  console.error("All search methods failed");
  return [];
}

