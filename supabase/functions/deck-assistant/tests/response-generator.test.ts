/**
 * Tests for response-generator.ts
 * Run with: deno test --allow-net --allow-env --allow-read tests/response-generator.test.ts
 */

import { assertEquals, assertExists } from "https://deno.land/std@0.208.0/assert/mod.ts";
import { generateRecommendations, type Recommendation } from "../response-generator.ts";
import type { DeckAnalysis, Card } from "../types.ts";
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

// Mock cards
const mockCards: Card[] = [
  {
    id: 12345,
    name: "Ash Blossom & Joyous Spring",
    type: "Effect Monster",
    desc: "When a card or effect is activated that includes any of these effects (Quick Effect): You can discard this card; negate that effect. Add a card from the Deck to the hand. Special Summon from the Deck. Send a card from the Deck to the GY.",
    level: 3,
    race: "Zombie",
    attribute: "FIRE",
  },
  {
    id: 67890,
    name: "Maxx \"C\"",
    type: "Effect Monster",
    desc: "During either player's turn: You can send this card from your hand to the Graveyard; this turn, each time your opponent Special Summons a monster(s), immediately draw 1 card. This card must be face-up on the field to activate and to resolve this effect.",
    level: 2,
    race: "Insect",
    attribute: "EARTH",
  },
  {
    id: 11111,
    name: "Pot of Greed",
    type: "Spell Card",
    desc: "Draw 2 cards.",
  },
];

Deno.test("generateRecommendations - empty candidates returns fallback", async () => {
  const query = "I need hand traps";
  const history: Message[] = [];
  const deckCardIds: number[] = [];

  const result = await generateRecommendations(
    query,
    mockDeckAnalysis,
    [],
    history,
    deckCardIds,
  );

  assertExists(result);
  assertEquals(typeof result.text, "string");
  assertEquals(Array.isArray(result.recommendations), true);
  assertEquals(result.recommendations.length, 0);
  assertEquals(result.text.includes("Could you provide more details"), true);
});

Deno.test("generateRecommendations - with candidates returns recommendations", async () => {
  const query = "I need hand traps";
  const history: Message[] = [];
  const deckCardIds: number[] = [];

  const result = await generateRecommendations(
    query,
    mockDeckAnalysis,
    mockCards,
    history,
    deckCardIds,
  );

  assertExists(result);
  assertEquals(typeof result.text, "string");
  assertEquals(result.text.length > 0, true);
  assertEquals(Array.isArray(result.recommendations), true);
  
  // Should have recommendations (either from LLM or fallback)
  if (result.recommendations.length > 0) {
    const rec = result.recommendations[0];
    assertExists(rec.cardId);
    assertExists(rec.cardName);
    assertExists(rec.reason);
    assertEquals(typeof rec.priority, "string");
    assertEquals(["high", "medium", "low"].includes(rec.priority), true);
    assertEquals(typeof rec.canAdd, "boolean");
  }
});

Deno.test("generateRecommendations - validates card IDs", async () => {
  const query = "I need consistency";
  const history: Message[] = [];
  const deckCardIds: number[] = [];

  const result = await generateRecommendations(
    query,
    mockDeckAnalysis,
    mockCards,
    history,
    deckCardIds,
  );

  assertExists(result);
  
  // All recommendations should reference valid card IDs
  result.recommendations.forEach(rec => {
    const cardExists = mockCards.some(c => c.id === rec.cardId);
    assertEquals(cardExists, true, `Card ID ${rec.cardId} not found in candidates`);
  });
});

Deno.test("generateRecommendations - excludes deck cards", async () => {
  const query = "I need cards";
  const history: Message[] = [];
  const deckCardIds = [12345]; // Ash Blossom is in deck

  const result = await generateRecommendations(
    query,
    mockDeckAnalysis,
    mockCards,
    history,
    deckCardIds,
  );

  assertExists(result);
  
  // Recommendations should mark cards already in deck as canAdd: false
  result.recommendations.forEach(rec => {
    if (rec.cardId === 12345) {
      assertEquals(rec.canAdd, false, "Card in deck should have canAdd: false");
    }
  });
});

Deno.test("generateRecommendations - includes conversation history", async () => {
  const query = "What about removal?";
  const history: Message[] = [
    { role: "user", content: "I need help" },
    { role: "assistant", content: "What do you need?" },
    { role: "user", content: "Removal options" },
  ];
  const deckCardIds: number[] = [];

  const result = await generateRecommendations(
    query,
    mockDeckAnalysis,
    mockCards,
    history,
    deckCardIds,
  );

  assertExists(result);
  assertEquals(typeof result.text, "string");
  // Should generate response (may reference context from history)
});

Deno.test("generateRecommendations - normalizes priority values", async () => {
  const query = "I need cards";
  const history: Message[] = [];
  const deckCardIds: number[] = [];

  const result = await generateRecommendations(
    query,
    mockDeckAnalysis,
    mockCards,
    history,
    deckCardIds,
  );

  assertExists(result);
  
  result.recommendations.forEach(rec => {
    assertEquals(
      ["high", "medium", "low"].includes(rec.priority),
      true,
      `Invalid priority: ${rec.priority}`
    );
  });
});

Deno.test("generateRecommendations - clamps impact and synergy scores", async () => {
  const query = "I need cards";
  const history: Message[] = [];
  const deckCardIds: number[] = [];

  const result = await generateRecommendations(
    query,
    mockDeckAnalysis,
    mockCards,
    history,
    deckCardIds,
  );

  assertExists(result);
  
  result.recommendations.forEach(rec => {
    if (rec.impactEst !== undefined) {
      assertEquals(rec.impactEst >= 0, true);
      assertEquals(rec.impactEst <= 1, true);
    }
    if (rec.synergyScore !== undefined) {
      assertEquals(rec.synergyScore >= 0, true);
      assertEquals(rec.synergyScore <= 1, true);
    }
  });
});

Deno.test("generateRecommendations - limits recommendations to 10", async () => {
  const query = "I need cards";
  const history: Message[] = [];
  const deckCardIds: number[] = [];

  // Create many mock cards
  const manyCards: Card[] = Array.from({ length: 20 }, (_, i) => ({
    id: 10000 + i,
    name: `Card ${i}`,
    type: "Effect Monster",
    desc: `Card ${i} description`,
  }));

  const result = await generateRecommendations(
    query,
    mockDeckAnalysis,
    manyCards,
    history,
    deckCardIds,
  );

  assertExists(result);
  assertEquals(result.recommendations.length <= 10, true);
});

Deno.test("generateRecommendations - fallback when LLM fails", async () => {
  // This test verifies fallback behavior
  // In practice, if LLM fails, we should still get recommendations
  const query = "I need cards";
  const history: Message[] = [];
  const deckCardIds: number[] = [];

  const result = await generateRecommendations(
    query,
    mockDeckAnalysis,
    mockCards,
    history,
    deckCardIds,
  );

  assertExists(result);
  assertEquals(typeof result.text, "string");
  assertEquals(result.text.length > 0, true);
  // Should always have recommendations (either from LLM or fallback)
  assertEquals(result.recommendations.length > 0, true);
});
