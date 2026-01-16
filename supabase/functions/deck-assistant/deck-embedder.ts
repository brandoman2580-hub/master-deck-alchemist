/**
 * Gets or computes deck embedding by aggregating existing card_embeddings
 * Uses database function for efficient computation (no API calls needed)
 */

import { createClient, SupabaseClient } from "@supabase/supabase-js";
import type { Deck, DeckAnalysis } from "./types.ts";
import { analyzeDeck } from "./deck-analyzer.ts";

/**
 * Generate deck fingerprint (client-side version)
 * Should match the database function logic
 */
function generateDeckFingerprint(deck: Deck): string {
  // Sort cards by ID for deterministic hashing
  const sortedMain = [...deck.mainDeck].sort((a, b) => a.cardId - b.cardId);
  const sortedExtra = [...deck.extraDeck].sort((a, b) => a.cardId - b.cardId);
  const sortedSide = [...deck.sideDeck].sort((a, b) => a.cardId - b.cardId);
  
  const deckString = JSON.stringify({
    main: sortedMain,
    extra: sortedExtra,
    side: sortedSide,
  });
  
  // Simple hash (in production, use crypto.subtle.digest for SHA-256)
  // For now, we'll rely on the database function for fingerprint generation
  // This is just a placeholder - actual fingerprint should come from DB
  return deckString; // Will be replaced by DB function call
}

/**
 * Gets or computes deck embedding and analysis
 * Uses database function to aggregate card_embeddings (no API calls)
 */
export async function getOrComputeDeckEmbedding(
  deck: Deck,
  deckId: string,
  userId: string,
  allCards: any[],
  supabase: SupabaseClient
): Promise<{ embedding: number[]; analysis: DeckAnalysis }> {
  // Prepare deck cards JSON for database function
  const deckCardsJson = {
    main: deck.mainDeck.map(c => ({ cardId: c.cardId, count: c.count || 1 })),
    extra: deck.extraDeck.map(c => ({ cardId: c.cardId, count: c.count || 1 })),
    side: deck.sideDeck.map(c => ({ cardId: c.cardId, count: c.count || 1 })),
  };
  
  // Generate fingerprint using database function
  const { data: fingerprint, error: fpError } = await supabase.rpc('generate_deck_fingerprint', {
    main_deck: deckCardsJson.main,
    extra_deck: deckCardsJson.extra,
    side_deck: deckCardsJson.side,
  });
  
  if (fpError) {
    throw new Error(`Failed to generate fingerprint: ${fpError.message}`);
  }
  
  // Check cache first
  const { data: cached, error: cacheError } = await supabase
    .from('deck_embeddings_cache')
    .select('deck_embedding, deck_analysis, expires_at, deck_fingerprint')
    .eq('deck_id', deckId)
    .eq('user_id', userId)
    .eq('deck_fingerprint', fingerprint)
    .gt('expires_at', new Date().toISOString())
    .single();
  
  // If valid cache exists, return it
  if (cached && !cacheError && cached.deck_fingerprint === fingerprint) {
    return {
      embedding: cached.deck_embedding as number[],
      analysis: cached.deck_analysis as DeckAnalysis,
    };
  }
  
  // Cache miss - compute embedding using database function
  // This aggregates existing card_embeddings (no API calls, just vector math)
  const { data: embeddingResult, error: embedError } = await supabase.rpc('get_or_compute_deck_embedding', {
    p_deck_id: deckId,
    p_user_id: userId,
    p_deck_cards: deckCardsJson,
  });
  
  if (embedError) {
    throw new Error(`Failed to compute deck embedding: ${embedError.message}`);
  }
  
  // Compute deck analysis (rule-based, no LLM needed)
  const analysis = await analyzeDeck(deck, allCards);
  
  // Update cache with computed embedding and analysis
  const { error: upsertError } = await supabase
    .from('deck_embeddings_cache')
    .upsert({
      deck_fingerprint: fingerprint,
      deck_id: deckId,
      user_id: userId,
      deck_embedding: embeddingResult,
      deck_analysis: analysis,
      card_count: deck.mainDeck.length + deck.extraDeck.length + deck.sideDeck.length,
      expires_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
      updated_at: new Date().toISOString(),
    }, {
      onConflict: 'deck_fingerprint',
    });
  
  if (upsertError) {
    console.warn(`Failed to cache deck embedding: ${upsertError.message}`);
  }
  
  return {
    embedding: embeddingResult as number[],
    analysis,
  };
}
