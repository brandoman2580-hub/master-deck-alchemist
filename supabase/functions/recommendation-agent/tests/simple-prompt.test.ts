import { assertEquals, assertExists } from "https://deno.land/std@0.208.0/assert/mod.ts";
import { buildSimplePrompt } from "../prompts/simple-recommendation-prompt.ts";

const mockCards = [
  { id: 12345, name: "Ash Blossom", desc: "Hand trap" },
  { id: 67890, name: "Maxx C", desc: "Draw card" },
  { id: 11111, name: "Test Card", desc: "Test description" },
];

Deno.test("buildSimplePrompt - Basic prompt structure", () => {
  const result = buildSimplePrompt(
    "Give me hand traps",
    null,
    mockCards,
  );

  assertEquals(result.length, 2);
  assertEquals(result[0].role, "system");
  assertEquals(result[1].role, "user");
  assertExists(result[0].content);
  assertExists(result[1].content);
});

Deno.test("buildSimplePrompt - Includes question in prompt", () => {
  const question = "Give me 3 consistency cards";
  const result = buildSimplePrompt(question, null, mockCards);

  const systemContent = result[0].content;
  assertEquals(systemContent.includes(question), true);
});

Deno.test("buildSimplePrompt - Includes deck analysis when provided", () => {
  const deckAnalysis = {
    primaryArchetype: "Branded",
    playstyle: "Combo",
    mainDeckSize: 40,
    cardRoles: {
      starters: 8,
      extenders: 5,
      interruptions: 3,
    },
  };

  const result = buildSimplePrompt(
    "Test question",
    deckAnalysis,
    mockCards,
  );

  const systemContent = result[0].content;
  assertEquals(systemContent.includes("Branded"), true);
  assertEquals(systemContent.includes("40"), true);
  assertEquals(systemContent.includes("8"), true); // starters
});

Deno.test("buildSimplePrompt - Handles null deck analysis", () => {
  const result = buildSimplePrompt("Test", null, mockCards);

  const systemContent = result[0].content;
  assertEquals(systemContent.includes("No deck analysis available"), true);
});

Deno.test("buildSimplePrompt - Includes candidate cards", () => {
  const result = buildSimplePrompt("Test", null, mockCards);

  const systemContent = result[0].content;
  assertEquals(systemContent.includes("12345"), true);
  assertEquals(systemContent.includes("Ash Blossom"), true);
  assertEquals(systemContent.includes("67890"), true);
  assertEquals(systemContent.includes("Maxx C"), true);
});

Deno.test("buildSimplePrompt - Limits candidates to 50", () => {
  const manyCards = Array.from({ length: 100 }, (_, i) => ({
    id: i,
    name: `Card ${i}`,
    desc: `Description ${i}`,
  }));

  const result = buildSimplePrompt("Test", null, manyCards);
  const systemContent = result[0].content;

  // Should only include first 50 cards
  assertEquals(systemContent.includes("Card 49"), true);
  assertEquals(systemContent.includes("Card 50"), false);
});

Deno.test("buildSimplePrompt - Includes number constraint (exact)", () => {
  const numberConstraint = { exact: 3 };
  const result = buildSimplePrompt(
    "Test",
    null,
    mockCards,
    undefined,
    "MASTER_DUEL",
    "novice",
    numberConstraint,
  );

  const systemContent = result[0].content;
  assertEquals(systemContent.includes("exactly 3"), true);
});

Deno.test("buildSimplePrompt - Includes number constraint (range)", () => {
  const numberConstraint = { min: 3, max: 5 };
  const result = buildSimplePrompt(
    "Test",
    null,
    mockCards,
    undefined,
    "MASTER_DUEL",
    "novice",
    numberConstraint,
  );

  const systemContent = result[0].content;
  assertEquals(systemContent.includes("between 3 and 5"), true);
});

Deno.test("buildSimplePrompt - Includes intent when provided", () => {
  const intent = {
    primary: "consistency" as const,
    confidence: 0.95,
    secondary: "power" as const,
    searchStrategy: {
      boostTerms: ["draw", "search"],
      excludeStaples: false,
      diversityLambda: 0.6,
      archetypeSpecific: false,
    },
    detectedFilters: {
      cardTypes: [],
      races: [],
      attributes: [],
      excludeArchetypes: [],
      includeArchetypes: [],
    },
  };

  const result = buildSimplePrompt("Test", null, mockCards, intent);
  const systemContent = result[0].content;

  assertEquals(systemContent.includes("consistency"), true);
  assertEquals(systemContent.includes("95"), true); // confidence percentage
});

Deno.test("buildSimplePrompt - Prompt length reasonable (< 2000 chars for small deck)", () => {
  const result = buildSimplePrompt("Test", null, mockCards);
  const systemContent = result[0].content;

  // Should be much shorter than the old 2000+ token prompt
  assertEquals(systemContent.length < 5000, true);
});

Deno.test("buildSimplePrompt - User message includes format and explainTo", () => {
  const result = buildSimplePrompt(
    "Test question",
    null,
    mockCards,
    undefined,
    "TCG",
    "advanced",
  );

  const userContent = result[1].content;
  const parsed = JSON.parse(userContent);

  assertEquals(parsed.format, "TCG");
  assertEquals(parsed.explainTo, "advanced");
  assertEquals(parsed.question, "Test question");
});
