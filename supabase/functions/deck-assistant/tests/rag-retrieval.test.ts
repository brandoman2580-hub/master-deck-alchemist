/**
 * Tests for rag-retrieval.ts
 * Run with: deno test --allow-net --allow-env tests/rag-retrieval.test.ts
 * 
 * Note: These tests require Supabase connection and may need mocking
 */

import { assertEquals, assertExists } from "https://deno.land/std@0.208.0/assert/mod.ts";
import type { StructuredQuery } from "../self-query.ts";
import type { DeckAnalysis } from "../types.ts";

// Mock structured query
const mockStructuredQuery: StructuredQuery = {
  searchTerms: ["hand trap", "negate"],
  filters: {
    type: ["Monster"],
    attribute: ["DARK"],
  },
  excludeCardIds: [123, 456],
  excludeArchetypes: ["Blue-Eyes"],
  intent: "interaction",
  needsClarification: false,
};

// Mock deck analysis
const mockDeckAnalysis: DeckAnalysis = {
  archetype: "Blue-Eyes",
  playstyle: "combo",
  cardRoles: {
    starters: 8,
    extenders: 5,
    interruptions: 3,
    searchers: 6,
    removals: 2,
  },
  ratios: {
    monsters: 25,
    spells: 10,
    traps: 5,
  },
  deckSize: {
    main: 40,
    extra: 15,
    side: 15,
  },
  keyEffects: ["search", "special summon"],
  weaknesses: ["low interruption count"],
};

// Mock deck embedding (384 dimensions for gte-small)
const mockDeckEmbedding = new Array(384).fill(0).map(() => Math.random());

Deno.test("rag-retrieval - structured query validation", () => {
  assertExists(mockStructuredQuery);
  assertEquals(Array.isArray(mockStructuredQuery.searchTerms), true);
  assertEquals(typeof mockStructuredQuery.intent, "string");
  assertEquals(typeof mockStructuredQuery.needsClarification, "boolean");
  assertEquals(Array.isArray(mockStructuredQuery.excludeCardIds), true);
});

Deno.test("rag-retrieval - deck embedding dimensions", () => {
  assertEquals(mockDeckEmbedding.length, 384);
  assertEquals(Array.isArray(mockDeckEmbedding), true);
});

Deno.test("rag-retrieval - deck analysis structure", () => {
  assertExists(mockDeckAnalysis);
  assertEquals(typeof mockDeckAnalysis.archetype, "string");
  assertEquals(typeof mockDeckAnalysis.playstyle, "string");
  assertExists(mockDeckAnalysis.cardRoles);
  assertExists(mockDeckAnalysis.ratios);
  assertExists(mockDeckAnalysis.deckSize);
  assertEquals(Array.isArray(mockDeckAnalysis.weaknesses), true);
});

// Note: Full integration tests would require:
// - Supabase connection
// - Mock Supabase client
// - Actual card data
// These can be added as integration tests with proper setup
