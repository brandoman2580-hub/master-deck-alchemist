import { assertEquals } from "https://deno.land/std@0.208.0/assert/mod.ts";
import { sanitizeRecommendations } from "../utils/sanitization.ts";

const mockCards = [
  { id: 12345, name: "Ash Blossom", desc: "Hand trap", ban_tcg: null, master_duel_banned: false },
  { id: 67890, name: "Maxx C", desc: "Draw card", ban_tcg: "Banned", master_duel_banned: true },
  { id: 11111, name: "Test Card", desc: "Test", ban_tcg: null, master_duel_banned: false },
];

Deno.test("sanitizeRecommendations - Number cardId", () => {
  const recommendations = [
    { cardId: 12345, reason: "Test" },
  ];

  const result = sanitizeRecommendations(recommendations, mockCards, "MASTER_DUEL");
  assertEquals(result.length, 1);
  assertEquals(result[0].cardId, "12345");
  assertEquals(result[0].cardName, "Ash Blossom");
});

Deno.test("sanitizeRecommendations - String cardId", () => {
  const recommendations = [
    { cardId: "12345", reason: "Test" },
  ];

  const result = sanitizeRecommendations(recommendations, mockCards, "MASTER_DUEL");
  assertEquals(result.length, 1);
  assertEquals(result[0].cardId, "12345");
});

Deno.test("sanitizeRecommendations - Quoted string cardId", () => {
  const recommendations = [
    { cardId: '"12345"', reason: "Test" },
  ];

  const result = sanitizeRecommendations(recommendations, mockCards, "MASTER_DUEL");
  assertEquals(result.length, 1);
  assertEquals(result[0].cardId, "12345");
});

Deno.test("sanitizeRecommendations - Trimmed cardId", () => {
  const recommendations = [
    { cardId: "  12345  ", reason: "Test" },
  ];

  const result = sanitizeRecommendations(recommendations, mockCards, "MASTER_DUEL");
  assertEquals(result.length, 1);
  assertEquals(result[0].cardId, "12345");
});

Deno.test("sanitizeRecommendations - Filters out missing cards", () => {
  const recommendations = [
    { cardId: "12345", reason: "Valid" },
    { cardId: "99999", reason: "Invalid - not in available cards" },
    { cardId: "67890", reason: "Valid" },
  ];

  const result = sanitizeRecommendations(recommendations, mockCards, "MASTER_DUEL");
  assertEquals(result.length, 2);
  assertEquals(result[0].cardId, "12345");
  assertEquals(result[1].cardId, "67890");
});

Deno.test("sanitizeRecommendations - Marks banned cards (TCG)", () => {
  const recommendations = [
    { cardId: "67890", reason: "Test" }, // Maxx C is banned in TCG
  ];

  const result = sanitizeRecommendations(recommendations, mockCards, "TCG");
  assertEquals(result.length, 1);
  assertEquals(result[0].banned, true);
  assertEquals(result[0].action, "note"); // Should convert "add" to "note" for banned
});

Deno.test("sanitizeRecommendations - Marks banned cards (Master Duel)", () => {
  const recommendations = [
    { cardId: "67890", reason: "Test" }, // Maxx C is banned in Master Duel
  ];

  const result = sanitizeRecommendations(recommendations, mockCards, "MASTER_DUEL");
  assertEquals(result.length, 1);
  assertEquals(result[0].banned, true);
  assertEquals(result[0].action, "note");
});

Deno.test("sanitizeRecommendations - Preserves original properties", () => {
  const recommendations = [
    {
      cardId: "12345",
      reason: "Test",
      impactEst: 0.8,
      synergyScore: 0.9,
      customField: "preserved",
    },
  ];

  const result = sanitizeRecommendations(recommendations, mockCards, "MASTER_DUEL");
  assertEquals(result.length, 1);
  assertEquals(result[0].customField, "preserved");
  assertEquals(result[0].impactEst, 0.8);
  assertEquals(result[0].synergyScore, 0.9);
});

Deno.test("sanitizeRecommendations - Uses defaults for missing fields", () => {
  const recommendations = [
    { cardId: "12345", reason: "Test" },
  ];

  const result = sanitizeRecommendations(recommendations, mockCards, "MASTER_DUEL");
  assertEquals(result.length, 1);
  assertEquals(result[0].impactEst, 0.5);
  assertEquals(result[0].synergyScore, 0.5);
  assertEquals(result[0].evidence, []);
  assertEquals(result[0].banned, false);
  assertEquals(result[0].action, "add");
});

Deno.test("sanitizeRecommendations - Empty recommendations array", () => {
  const result = sanitizeRecommendations([], mockCards, "MASTER_DUEL");
  assertEquals(result.length, 0);
});

Deno.test("sanitizeRecommendations - All recommendations filtered out", () => {
  const recommendations = [
    { cardId: "99999", reason: "Not found" },
    { cardId: "88888", reason: "Not found" },
  ];

  const result = sanitizeRecommendations(recommendations, mockCards, "MASTER_DUEL");
  assertEquals(result.length, 0);
});
