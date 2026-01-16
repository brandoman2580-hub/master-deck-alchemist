/**
 * RAG Retrieval: Retrieves cards using structured query + deck context
 */

import { createClient, SupabaseClient } from "@supabase/supabase-js";
import type { Card, DeckAnalysis } from "./types.ts";
import type { StructuredQuery } from "./self-query.ts";
// Note: detectCardRole is not exported from deck-analyzer, so we'll define it here
function detectCardRole(card: Card): string[] {
  const roles: string[] = [];
  const desc = (card.desc || "").toLowerCase();
  
  if (desc.includes('search') || (desc.includes('add') && desc.includes('deck'))) {
    roles.push('starter');
  }
  if (desc.includes('special summon') && (desc.includes('hand') || desc.includes('gy'))) {
    roles.push('extender');
  }
  if ((desc.includes('negate') || desc.includes('destroy')) && desc.includes('quick effect')) {
    roles.push('interruption');
  }
  if (desc.includes('destroy') || desc.includes('banish')) {
    roles.push('removal');
  }
  
  return roles.length > 0 ? roles : ['generic'];
}

const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
const SUPABASE_SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

/**
 * Generate query embedding using embed edge function
 * Uses the same approach as recommendation-agent for consistency
 */
async function generateQueryEmbedding(text: string): Promise<number[]> {
  if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
    throw new Error("Missing Supabase environment variables");
  }

  if (!text || text.trim().length === 0) {
    throw new Error("Empty text provided for embedding");
  }

  try {
    // Call the embed edge function via HTTP (same approach as recommendation-agent)
    const embedFn = `${SUPABASE_URL}/functions/v1/embed`;
    const res = await fetch(embedFn, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${SUPABASE_SERVICE_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        input: String(text).slice(0, 20000),
        model: "gte-small", // Explicitly specify model
      }),
    });

    if (!res.ok) {
      const errorText = await res.text();
      throw new Error(`Embed call failed: ${res.status} - ${errorText}`);
    }

    const result = await res.json();
    if (!result.embedding || !Array.isArray(result.embedding)) {
      throw new Error("Invalid embedding response format");
    }

    const embedding = result.embedding as number[];

    if (!embedding || embedding.length === 0) {
      throw new Error(
        `Invalid embedding format: expected non-empty array, got length=${embedding?.length ?? 0}`,
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
 * Retrieve cards using structured query and deck context
 */
export async function retrieveCards(
  structuredQuery: StructuredQuery,
  deckEmbedding: number[],
  deckAnalysis: DeckAnalysis,
  supabase: SupabaseClient
): Promise<Card[]> {
  const {
    searchTerms,
    filters,
    excludeCardIds,
    excludeArchetypes,
    intent,
  } = structuredQuery;

  // Build query text from search terms + deck context
  const queryParts: string[] = [];
  
  if (searchTerms.length > 0) {
    queryParts.push(...searchTerms);
  }
  
  // Add deck context
  queryParts.push(`for ${deckAnalysis.playstyle} deck`);
  if (deckAnalysis.archetype) {
    queryParts.push(`archetype: ${deckAnalysis.archetype}`);
  }
  queryParts.push(`intent: ${intent}`);

  const queryText = queryParts.join(' ');

  // Generate query embedding
  const queryEmbedding = await generateQueryEmbedding(queryText);

  // Build filter arrays for RPC call
  const cardTypes = filters.type || null;
  const attributes = filters.attribute || null;
  const races = filters.race || null;
  const archetypes = filters.archetype || null;

  // Try hybrid search RPC first
  try {
    console.log(`🔍 [rag-retrieval.ts] Retrieving cards with:`);
    console.log(`   - Search terms: ${searchTerms.join(', ')}`);
    console.log(`   - Exclude card IDs: ${excludeCardIds.length} cards`);
    console.log(`   - Exclude archetypes: ${excludeArchetypes.join(', ') || 'none'}`);
    console.log(`   - Filters: ${JSON.stringify(filters)}`);
    
    const { data: candidates, error } = await supabase.rpc("hybrid_card_search", {
      query_embedding: queryEmbedding,
      query_text: searchTerms.join(' ') || queryText,
      exclude_archetypes: excludeArchetypes,
      exclude_ids: excludeCardIds,
      exclude_types: null,
      exclude_races: null,
      banlist_format: "MASTER_DUEL", // Default, can be made configurable
      vector_weight: 0.7,
      fts_weight: 0.3,
      match_count: 50, // Request 50 candidates
    });
    
    console.log(`📊 [rag-retrieval.ts] Hybrid search returned ${candidates?.length || 0} candidates`);

    if (error) {
      console.warn("Hybrid search RPC failed, falling back to vector search:", error.message);
      // Fallback to vector-only search
      return await fallbackVectorSearch(
        queryEmbedding,
        excludeCardIds,
        excludeArchetypes,
        supabase
      );
    }

    // Apply additional filters if provided, but be lenient if filters result in 0 candidates
    let filteredCandidates = (candidates || []) as any[];
    const initialCount = filteredCandidates.length;
    
    console.log(`📊 [rag-retrieval.ts] Initial candidates from hybrid search: ${initialCount}`);

    // Apply filters progressively, tracking count at each step
    if (cardTypes && cardTypes.length > 0) {
      const beforeCount = filteredCandidates.length;
      filteredCandidates = filteredCandidates.filter((c: any) =>
        cardTypes.some(type => c.type?.toLowerCase().includes(type.toLowerCase()))
      );
      console.log(`📊 [rag-retrieval.ts] After cardTypes filter: ${filteredCandidates.length} (was ${beforeCount})`);
    }

    if (attributes && attributes.length > 0 && filteredCandidates.length > 0) {
      const beforeCount = filteredCandidates.length;
      const attributeFiltered = filteredCandidates.filter((c: any) =>
        attributes.includes(c.attribute)
      );
      // Only apply attribute filter if it doesn't eliminate all candidates
      if (attributeFiltered.length > 0 || filteredCandidates.length < 10) {
        filteredCandidates = attributeFiltered;
        console.log(`📊 [rag-retrieval.ts] After attribute filter: ${filteredCandidates.length} (was ${beforeCount})`);
      } else {
        console.log(`⚠️ [rag-retrieval.ts] Skipping attribute filter (would eliminate all candidates)`);
      }
    }

    if (races && races.length > 0 && filteredCandidates.length > 0) {
      const beforeCount = filteredCandidates.length;
      const raceFiltered = filteredCandidates.filter((c: any) =>
        races.some(race => c.race?.toLowerCase().includes(race.toLowerCase()))
      );
      // Only apply race filter if it doesn't eliminate all candidates
      if (raceFiltered.length > 0 || filteredCandidates.length < 10) {
        filteredCandidates = raceFiltered;
        console.log(`📊 [rag-retrieval.ts] After race filter: ${filteredCandidates.length} (was ${beforeCount})`);
      } else {
        console.log(`⚠️ [rag-retrieval.ts] Skipping race filter (would eliminate all candidates)`);
      }
    }

    if (filters.level && filteredCandidates.length > 0) {
      const beforeCount = filteredCandidates.length;
      let levelFiltered = filteredCandidates;
      
      if (filters.level.min !== undefined) {
        levelFiltered = levelFiltered.filter((c: any) =>
          c.level >= filters.level!.min!
        );
      }
      if (filters.level.max !== undefined) {
        levelFiltered = levelFiltered.filter((c: any) =>
          c.level <= filters.level!.max!
        );
      }
      
      // Only apply level filter if it doesn't eliminate all candidates
      if (levelFiltered.length > 0 || filteredCandidates.length < 10) {
        filteredCandidates = levelFiltered;
        console.log(`📊 [rag-retrieval.ts] After level filter: ${filteredCandidates.length} (was ${beforeCount})`);
      } else {
        console.log(`⚠️ [rag-retrieval.ts] Skipping level filter (would eliminate all candidates)`);
      }
    }

    if (filters.atk && filteredCandidates.length > 0) {
      const beforeCount = filteredCandidates.length;
      let atkFiltered = filteredCandidates;
      
      if (filters.atk.min !== undefined) {
        atkFiltered = atkFiltered.filter((c: any) => {
          const atk = typeof c.atk === 'number' ? c.atk : parseInt(c.atk) || 0;
          return atk >= filters.atk!.min!;
        });
      }
      if (filters.atk.max !== undefined) {
        atkFiltered = atkFiltered.filter((c: any) => {
          const atk = typeof c.atk === 'number' ? c.atk : parseInt(c.atk) || 0;
          return atk <= filters.atk!.max!;
        });
      }
      
      // Only apply ATK filter if it doesn't eliminate all candidates
      if (atkFiltered.length > 0 || filteredCandidates.length < 10) {
        filteredCandidates = atkFiltered;
        console.log(`📊 [rag-retrieval.ts] After ATK filter: ${filteredCandidates.length} (was ${beforeCount})`);
      } else {
        console.log(`⚠️ [rag-retrieval.ts] Skipping ATK filter (would eliminate all candidates)`);
      }
    }

    // If we have 0 candidates after filtering, return the original candidates (just reranked)
    if (filteredCandidates.length === 0 && initialCount > 0) {
      console.warn(`⚠️ [rag-retrieval.ts] All filters eliminated candidates! Returning original ${initialCount} candidates (reranked only)`);
      filteredCandidates = candidates as any[];
    }

    // Rerank by deck synergy
    const reranked = rerankByDeckSynergy(filteredCandidates, deckAnalysis);
    
    console.log(`📊 [rag-retrieval.ts] After filtering and reranking: ${reranked.length} candidates`);
    console.log(`📊 [rag-retrieval.ts] Returning top ${Math.min(reranked.length, 30)} candidates`);

    return reranked.slice(0, 30) as Card[]; // Top 30 candidates (increased from 20)
  } catch (error) {
    console.error("Retrieval error:", error);
    return await fallbackVectorSearch(
      queryEmbedding,
      excludeCardIds,
      excludeArchetypes,
      supabase
    );
  }
}

/**
 * Fallback to vector-only search
 */
async function fallbackVectorSearch(
  queryEmbedding: number[],
  excludeCardIds: number[],
  excludeArchetypes: string[],
  supabase: SupabaseClient
): Promise<Card[]> {
  const { data, error } = await supabase.rpc("match_cards_with_exclusions", {
    query_embedding: queryEmbedding,
    exclude_archetypes: excludeArchetypes,
    exclude_ids: excludeCardIds,
    match_count: 50,
  });

  if (error) {
    console.error("Vector search failed:", error);
    return [];
  }

  return (data || []) as Card[];
}

/**
 * Rerank candidates by deck synergy
 */
function rerankByDeckSynergy(
  candidates: any[],
  deckAnalysis: DeckAnalysis
): any[] {
  return candidates.map(card => {
    const synergyScore = calculateSynergyScore(card, deckAnalysis);
    return {
      ...card,
      synergyScore,
    };
  }).sort((a, b) => 
    (b.synergyScore || 0) - (a.synergyScore || 0)
  );
}

/**
 * Calculate synergy score between card and deck
 */
function calculateSynergyScore(
  card: any,
  deckAnalysis: DeckAnalysis
): number {
  let score = 0;
  
  // Archetype match
  if (card.archetype && card.archetype === deckAnalysis.archetype) {
    score += 0.3;
  }
  
  // Playstyle match
  const cardRoles = detectCardRole(card as Card);
  if (deckAnalysis.playstyle === 'combo' && cardRoles.includes('starter')) {
    score += 0.2;
  }
  if (deckAnalysis.playstyle === 'control' && cardRoles.includes('interruption')) {
    score += 0.2;
  }
  if (deckAnalysis.playstyle === 'aggro' && cardRoles.includes('removal')) {
    score += 0.15;
  }
  
  // Addresses weaknesses
  const cardEffects = (card.desc || "").toLowerCase();
  deckAnalysis.weaknesses.forEach(weakness => {
    const weaknessLower = weakness.toLowerCase();
    if (weaknessLower.includes('starter') && cardRoles.includes('starter')) {
      score += 0.1;
    }
    if (weaknessLower.includes('interruption') && cardRoles.includes('interruption')) {
      score += 0.1;
    }
    if (cardEffects.includes(weaknessLower)) {
      score += 0.1;
    }
  });
  
  return score;
}
