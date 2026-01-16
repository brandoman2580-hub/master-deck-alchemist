/**
 * Full Integration Tests for Deck Assistant
 * Requires actual API keys and database connections
 * 
 * Run with:
 * deno test --allow-net --allow-env --allow-read tests/integration-full.test.ts
 * 
 * Environment variables required:
 * - GROQ_API_KEY
 * - SUPABASE_URL
 * - SUPABASE_SERVICE_ROLE_KEY
 * 
 * These can be set via:
 * - .env.local, .env.test, or .env files (loaded automatically)
 * - Environment variables in the shell
 * - Supabase Dashboard secrets (for edge functions)
 */

// Load environment variables FIRST, before any imports that read env vars
import { loadEnv } from "./load-env.ts";
await loadEnv();

// Now import modules that may read environment variables
import { assertEquals, assertExists, assert } from "https://deno.land/std@0.208.0/assert/mod.ts";
import { createClient } from "@supabase/supabase-js";
import { generateStructuredQuery } from "../self-query.ts";
import { retrieveCards } from "../rag-retrieval.ts";
import { getOrComputeDeckEmbedding } from "../deck-embedder.ts";
import { analyzeDeck } from "../deck-analyzer.ts";
import type { Deck, DeckAnalysis, Card } from "../types.ts";
import type { Message } from "../self-query.ts";

// Load environment variables
const GROQ_API_KEY = Deno.env.get("GROQ_API_KEY");
const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
const SUPABASE_SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

// Check if we have required environment variables
const hasRequiredEnv = GROQ_API_KEY && SUPABASE_URL && SUPABASE_SERVICE_KEY;

// Create Supabase client if we have the URL
let supabase: ReturnType<typeof createClient> | null = null;
if (SUPABASE_URL && SUPABASE_SERVICE_KEY) {
  supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);
}

Deno.test({
  name: "integration - Environment variables check",
  ignore: false,
  fn() {
    if (!hasRequiredEnv) {
      console.warn("⚠️  Missing environment variables. Some tests will be skipped.");
      console.warn("Required: GROQ_API_KEY, SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY");
    }
    assert(true); // Always pass, just warn
  },
});

Deno.test({
  name: "integration - Supabase connection",
  ignore: !SUPABASE_URL || !SUPABASE_SERVICE_KEY,
  async fn() {
    if (!supabase) {
      throw new Error("Supabase client not initialized");
    }

    // Test connection by querying a simple table
    const { data, error } = await supabase.from("cards").select("id").limit(1);

    if (error) {
      console.error("Supabase connection error:", error);
      throw error;
    }

    assertExists(data);
    console.log("✅ Supabase connection successful");
  },
});

Deno.test({
  name: "integration - Load test deck",
  ignore: !supabase,
  async fn() {
    if (!supabase) {
      throw new Error("Supabase client not initialized");
    }

    // Try to find a deck in the database
    const { data: decks, error } = await supabase
      .from("decks")
      .select("id, cards, user_id")
      .limit(1);

    if (error) {
      console.warn("⚠️  No decks found or error:", error.message);
      // This is okay for testing - we can create a test deck
      return;
    }

    if (decks && decks.length > 0) {
      console.log(`✅ Found ${decks.length} deck(s) in database`);
      const deck = decks[0] as any;
      assertExists(deck.id);
      assertExists(deck.cards);
    } else {
      console.log("ℹ️  No decks found - will need to create test deck");
    }
  },
});

Deno.test({
  name: "integration - Generate structured query with real LLM",
  ignore: !GROQ_API_KEY,
  async fn() {
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

    const query = "I need hand traps for going second";
    const history: Message[] = [];
    const deckCardIds: number[] = [];
    const deckArchetypes: string[] = [];

    const result = await generateStructuredQuery(
      query,
      mockDeckAnalysis,
      history,
      GROQ_API_KEY || "",
      "llama-3.3-70b-versatile",
      deckCardIds,
      deckArchetypes,
    );

    assertExists(result);
    assertEquals(typeof result.searchTerms, "object");
    assertEquals(Array.isArray(result.searchTerms), true);
    assertEquals(typeof result.intent, "string");
    assertEquals(typeof result.needsClarification, "boolean");

    console.log("✅ Structured query generated:");
    console.log("   Search terms:", result.searchTerms);
    console.log("   Intent:", result.intent);
    console.log("   Needs clarification:", result.needsClarification);
  },
});

Deno.test({
  name: "integration - Deck analysis with real cards",
  ignore: !supabase,
  async fn() {
    if (!supabase) {
      throw new Error("Supabase client not initialized");
    }

    // Get a few cards from the database
    const { data: cards, error } = await supabase
      .from("cards")
      .select("*")
      .limit(10);

    if (error || !cards || cards.length === 0) {
      console.warn("⚠️  No cards found in database");
      return;
    }

    // Create a test deck with these cards
    const testDeck: Deck = {
      mainDeck: cards.slice(0, 5).map((c: any) => ({
        cardId: c.id,
        count: 1,
      })),
      extraDeck: [],
      sideDeck: [],
    };

    const analysis = await analyzeDeck(testDeck, cards as Card[]);

    assertExists(analysis);
    assertEquals(
      analysis.archetype === null || typeof analysis.archetype === "string",
      true
    );
    assertEquals(typeof analysis.playstyle, "string");
    assertExists(analysis.cardRoles);
    assertExists(analysis.ratios);
    assertExists(analysis.deckSize);

    console.log("✅ Deck analysis completed:");
    console.log("   Archetype:", analysis.archetype);
    console.log("   Playstyle:", analysis.playstyle);
    console.log("   Card roles:", analysis.cardRoles);
  },
});

Deno.test({
  name: "integration - Full chat flow (requires deck_id)",
  ignore: !supabase || !GROQ_API_KEY,
  async fn() {
    if (!supabase) {
      throw new Error("Supabase client not initialized");
    }

    // Try to find a deck
    const { data: decks, error: deckError } = await supabase
      .from("decks")
      .select("id, cards, user_id")
      .limit(1)
      .single();

    if (deckError || !decks) {
      console.warn("⚠️  No deck found for full integration test");
      console.warn("   Create a deck first, or this test will be skipped");
      return;
    }

    const deck = decks as any;
    const deckId = deck.id;
    const userId = deck.user_id;
    const cards = deck.cards as any;

    // Convert deck format
    const deckData: Deck = {
      mainDeck: (cards?.main || []).map((c: any) => ({
        cardId: typeof c === "number" ? c : c.id || c.cardId,
        count: c.count || 1,
      })),
      extraDeck: (cards?.extra || []).map((c: any) => ({
        cardId: typeof c === "number" ? c : c.id || c.cardId,
        count: c.count || 1,
      })),
      sideDeck: (cards?.side || []).map((c: any) => ({
        cardId: typeof c === "number" ? c : c.id || c.cardId,
        count: c.count || 1,
      })),
    };

    // Load card data
    const cardIds = new Set<number>();
    deckData.mainDeck.forEach(c => cardIds.add(c.cardId));
    deckData.extraDeck.forEach(c => cardIds.add(c.cardId));
    deckData.sideDeck.forEach(c => cardIds.add(c.cardId));

    const { data: cardData, error: cardError } = await supabase
      .from("cards")
      .select("*")
      .in("id", Array.from(cardIds));

    if (cardError || !cardData) {
      throw new Error(`Failed to load cards: ${cardError?.message}`);
    }

    // Step 1: Get or compute deck embedding
    console.log("📊 Step 1: Computing deck embedding...");
    const { embedding: deckEmbedding, analysis: deckAnalysis } =
      await getOrComputeDeckEmbedding(
        deckData,
        deckId,
        userId,
        cardData as Card[],
        supabase,
      );

    assertExists(deckEmbedding);
    assertEquals(deckEmbedding.length, 384);
    assertExists(deckAnalysis);
    console.log("✅ Deck embedding computed (384 dimensions)");

    // Step 2: Generate structured query
    console.log("🔍 Step 2: Generating structured query...");
    const userQuery = "I need more consistency";
    const deckCardIds = [
      ...deckData.mainDeck.map(c => c.cardId),
      ...deckData.extraDeck.map(c => c.cardId),
      ...deckData.sideDeck.map(c => c.cardId),
    ];

    const deckArchetypes: string[] = [];
    cardData.forEach((card: any) => {
      if (deckCardIds.includes(card.id) && card.archetype) {
        if (!deckArchetypes.includes(card.archetype)) {
          deckArchetypes.push(card.archetype);
        }
      }
    });

    const structuredQuery = await generateStructuredQuery(
      userQuery,
      deckAnalysis,
      [],
      GROQ_API_KEY || "",
      "llama-3.3-70b-versatile",
      deckCardIds,
      deckArchetypes,
    );

    assertExists(structuredQuery);
    console.log("✅ Structured query generated");
    console.log("   Search terms:", structuredQuery.searchTerms);
    console.log("   Intent:", structuredQuery.intent);

    if (structuredQuery.needsClarification) {
      console.log("ℹ️  Query needs clarification - skipping retrieval");
      return;
    }

    // Step 3: Retrieve cards
    console.log("🎯 Step 3: Retrieving cards...");
    const candidates = await retrieveCards(
      structuredQuery,
      deckEmbedding,
      deckAnalysis,
      supabase,
    );

    assertExists(candidates);
    assertEquals(Array.isArray(candidates), true);
    console.log(`✅ Retrieved ${candidates.length} candidate cards`);

    if (candidates.length > 0) {
      console.log("   Top 3 candidates:");
      candidates.slice(0, 3).forEach((c, i) => {
        console.log(`   ${i + 1}. ${c.name} (ID: ${c.id})`);
      });
    }

    console.log("✅ Full chat flow completed successfully!");
  },
});

Deno.test({
  name: "integration - Conversation management",
  ignore: !supabase,
  async fn() {
    if (!supabase) {
      throw new Error("Supabase client not initialized");
    }

    // Try to find a deck
    const { data: decks, error: deckError } = await supabase
      .from("decks")
      .select("id, user_id, cards")
      .limit(1)
      .single();

    if (deckError || !decks) {
      console.warn("⚠️  No deck found for conversation test");
      return;
    }

    const deck = decks as any;
    const deckId = deck.id;
    const userId = deck.user_id;
    const cards = deck.cards as any;

    const deckSnapshot = {
      main: cards?.main || [],
      extra: cards?.extra || [],
      side: cards?.side || [],
    };

    // Test get_or_create_conversation
    console.log("💬 Testing conversation management...");
    const { data: convId, error: convError } = await (supabase.rpc as any)(
      "get_or_create_conversation",
      {
        p_deck_id: deckId,
        p_user_id: userId,
        p_deck_snapshot: deckSnapshot,
      }
    );

    if (convError) {
      console.error("❌ Conversation creation error:", convError);
      throw convError;
    }

    assertExists(convId);
    console.log(`✅ Conversation created/retrieved: ${convId}`);

    // Test get_next_message_sequence
    const { data: seq1, error: seqError1 } = await (supabase.rpc as any)(
      "get_next_message_sequence",
      {
        p_conversation_id: convId,
      }
    );

    if (seqError1) {
      console.error("❌ Sequence error:", seqError1);
      throw seqError1;
    }

    assertExists(seq1);
    assertEquals(typeof seq1, "number");
    console.log(`✅ Message sequence: ${seq1}`);

    // Test second sequence call (should increment)
    const { data: seq2, error: seqError2 } = await (supabase.rpc as any)(
      "get_next_message_sequence",
      {
        p_conversation_id: convId,
      }
    );

    if (seqError2) {
      console.error("❌ Sequence error:", seqError2);
      throw seqError2;
    }

    assertEquals(seq2, seq1 + 1);
    console.log(`✅ Sequence incremented: ${seq1} → ${seq2}`);
  },
});
