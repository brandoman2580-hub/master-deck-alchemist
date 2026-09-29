/**
 * Tests for self-query.ts
 * Run with: deno test --allow-net --allow-env --allow-read tests/self-query.test.ts
 */

import { assertEquals, assertExists } from "https://deno.land/std@0.208.0/assert/mod.ts";
import { generateStructuredQuery, type StructuredQuery } from "../self-query.ts";
import type { DeckAnalysis } from "../types.ts";
import type { Message } from "../self-query.ts";
import { loadEnv } from "./load-env.ts";

// Load environment variables from .env files
await loadEnv();

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

Deno.test("generateStructuredQuery - specific query", async () => {
  const query = "I need hand traps for going second";
  const history: Message[] = [];
  const deckCardIds = [123, 456];
  const deckArchetypes = ["Blue-Eyes"];

  const result = await generateStructuredQuery(
    query,
    mockDeckAnalysis,
    history,
    deckCardIds,
    deckArchetypes,
  );

  assertExists(result);
  assertEquals(typeof result.searchTerms, "object");
  assertEquals(Array.isArray(result.searchTerms), true);
  assertEquals(result.excludeCardIds, deckCardIds);
  assertEquals(result.excludeArchetypes, deckArchetypes);
  assertEquals(typeof result.intent, "string");
  assertEquals(typeof result.needsClarification, "boolean");
});

Deno.test("generateStructuredQuery - vague query requests clarification", async () => {
  const query = "help me";
  const history: Message[] = [];
  const deckCardIds: number[] = [];
  const deckArchetypes: string[] = [];

  const result = await generateStructuredQuery(
    query,
    mockDeckAnalysis,
    history,
    deckCardIds,
    deckArchetypes,
  );

  assertExists(result);
  assertEquals(result.needsClarification, true);
  assertExists(result.clarificationQuestion);
  assertEquals(typeof result.clarificationQuestion, "string");
});

Deno.test("generateStructuredQuery - consistency intent", async () => {
  const query = "I need more consistency and draw power";
  const history: Message[] = [];
  const deckCardIds: number[] = [];
  const deckArchetypes: string[] = [];

  const result = await generateStructuredQuery(
    query,
    mockDeckAnalysis,
    history,
    deckCardIds,
    deckArchetypes,
  );

  assertExists(result);
  assertEquals(result.intent === "consistency" || result.intent === "general", true);
  assertEquals(result.needsClarification, false);
});

Deno.test("generateStructuredQuery - with conversation history", async () => {
  const query = "What about removal cards?";
  const history: Message[] = [
    { role: "user", content: "I need help with my deck" },
    { role: "assistant", content: "What specific aspect?" },
    { role: "user", content: "Removal options" },
  ];
  const deckCardIds: number[] = [];
  const deckArchetypes: string[] = [];

  const result = await generateStructuredQuery(
    query,
    mockDeckAnalysis,
    history,
    deckCardIds,
    deckArchetypes,
  );

  assertExists(result);
  assertEquals(result.needsClarification, false);
  // Should understand context from history
  assertEquals(Array.isArray(result.searchTerms), true);
});

Deno.test("generateStructuredQuery - filters extraction", async () => {
  const query = "I need DARK Fiend monsters with ATK over 2000";
  const history: Message[] = [];
  const deckCardIds: number[] = [];
  const deckArchetypes: string[] = [];

  const result = await generateStructuredQuery(
    query,
    mockDeckAnalysis,
    history,
    deckCardIds,
    deckArchetypes,
  );

  assertExists(result);
  assertEquals(result.needsClarification, false);
  // Filters should be extracted (may or may not be present depending on LLM)
  assertExists(result.filters);
});

Deno.test("generateStructuredQuery - excludes deck cards", async () => {
  const query = "Show me cards";
  const history: Message[] = [];
  const deckCardIds = [100, 200, 300];
  const deckArchetypes = ["Blue-Eyes", "Dark Magician"];

  const result = await generateStructuredQuery(
    query,
    mockDeckAnalysis,
    history,
    deckCardIds,
    deckArchetypes,
  );

  assertExists(result);
  assertEquals(result.excludeCardIds, deckCardIds);
  assertEquals(result.excludeArchetypes, deckArchetypes);
});
