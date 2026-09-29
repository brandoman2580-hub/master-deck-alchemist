import { assertEquals, assertThrows } from "https://deno.land/std@0.208.0/assert/mod.ts";
import { validateFlexible } from "../utils/flexible-schema.ts";

Deno.test("validateFlexible - Valid response with all fields", () => {
  const input = {
    schemaVersion: "1.0.0",
    confidence: 0.8,
    explainTo: "intermediate",
    reasoning: {
      userIntent: "Find consistency cards",
      deckWeaknesses: "Low draw power",
      strategicConsiderations: "Add searchers",
      metaContext: "Competitive format",
      candidateEvaluation: "Good options available",
    },
    summary: "Here are some cards",
    recommendations: [
      {
        cardId: "12345",
        cardName: "Test Card",
        reason: "Helps consistency",
        impactEst: 0.7,
        synergyScore: 0.8,
      },
    ],
    ui: [],
    actions: {},
    meta: {},
  };

  const result = validateFlexible(input);
  assertEquals(result.schemaVersion, "1.0.0");
  assertEquals(result.confidence, 0.8);
  assertEquals(result.recommendations.length, 1);
  assertEquals(result.recommendations[0].cardId, "12345");
});

Deno.test("validateFlexible - Field name variation: intent vs userIntent", () => {
  const input = {
    reasoning: {
      intent: "Find cards", // LLM uses "intent" instead of "userIntent"
      deckWeaknesses: "Weakness",
      strategicConsiderations: "Considerations",
    },
    recommendations: [
      {
        cardId: 12345,
        reason: "Test",
      },
    ],
  };

  const result = validateFlexible(input);
  assertEquals(result.reasoning.userIntent, "Find cards");
});

Deno.test("validateFlexible - Array to string coercion: deckWeaknesses", () => {
  const input = {
    reasoning: {
      userIntent: "Test",
      deckWeaknesses: ["Weakness 1", "Weakness 2"], // Array instead of string
      strategicConsiderations: "Considerations",
    },
    recommendations: [
      {
        cardId: 12345,
        reason: "Test",
      },
    ],
  };

  const result = validateFlexible(input);
  assertEquals(result.reasoning.deckWeaknesses, "Weakness 1; Weakness 2");
});

Deno.test("validateFlexible - Array to string coercion: strategicConsiderations", () => {
  const input = {
    reasoning: {
      userIntent: "Test",
      deckWeaknesses: "Weakness",
      strategicConsiderations: ["Consideration 1", "Consideration 2"],
    },
    recommendations: [
      {
        cardId: 12345,
        reason: "Test",
      },
    ],
  };

  const result = validateFlexible(input);
  assertEquals(
    result.reasoning.strategicConsiderations,
    "Consideration 1; Consideration 2",
  );
});

Deno.test("validateFlexible - Field name variation: evaluation vs candidateEvaluation", () => {
  const input = {
    reasoning: {
      userIntent: "Test",
      deckWeaknesses: "Weakness",
      strategicConsiderations: "Considerations",
      evaluation: "Good cards", // LLM uses "evaluation" instead of "candidateEvaluation"
    },
    recommendations: [
      {
        cardId: 12345,
        reason: "Test",
      },
    ],
  };

  const result = validateFlexible(input);
  assertEquals(result.reasoning.candidateEvaluation, "Good cards");
});

Deno.test("validateFlexible - Number cardId converted to string", () => {
  const input = {
    recommendations: [
      {
        cardId: 12345, // Number instead of string
        reason: "Test",
      },
    ],
  };

  const result = validateFlexible(input);
  assertEquals(result.recommendations[0].cardId, "12345");
});

Deno.test("validateFlexible - Quoted string cardId normalized", () => {
  const input = {
    recommendations: [
      {
        cardId: '"12345"', // Quoted string
        reason: "Test",
      },
    ],
  };

  const result = validateFlexible(input);
  assertEquals(result.recommendations[0].cardId, "12345");
});

Deno.test("validateFlexible - Missing optional fields use defaults", () => {
  const input = {
    recommendations: [
      {
        cardId: "12345",
        reason: "Test",
      },
    ],
  };

  const result = validateFlexible(input);
  assertEquals(result.schemaVersion, "1.0.0");
  assertEquals(result.confidence, 0.5);
  assertEquals(result.explainTo, "novice");
  assertEquals(result.recommendations[0].action, "add");
  assertEquals(result.recommendations[0].impactEst, 0.5);
  assertEquals(result.recommendations[0].synergyScore, 0.5);
});

Deno.test("validateFlexible - Partial data salvage: valid recommendations", () => {
  const input = {
    recommendations: [
      {
        cardId: "12345",
        reason: "Test",
      },
      {
        cardId: "67890",
        reason: "Test 2",
      },
    ],
    // Missing other required fields - but since reasoning is optional, validation succeeds
    // This tests that valid recommendations are preserved even with minimal input
  };

  const result = validateFlexible(input);
  assertEquals(result.recommendations.length, 2);
  // Since validation succeeds (reasoning is optional), summary uses default empty string
  assertEquals(result.summary, "");
  assertEquals(result.reasoning.userIntent, "Analysis requested"); // Uses default reasoning
});

Deno.test("validateFlexible - Throws on completely invalid input", () => {
  const input = {
    recommendations: [
      {
        // Missing required "reason" field - should be filtered out
        cardId: "12345",
      },
    ],
    // No valid recommendations to salvage
  };

  assertThrows(() => validateFlexible(input), Error, "Cannot parse LLM response");
});

Deno.test("validateFlexible - Missing reasoning uses defaults", () => {
  const input = {
    recommendations: [
      {
        cardId: "12345",
        reason: "Test",
      },
    ],
  };

  const result = validateFlexible(input);
  assertEquals(result.reasoning.userIntent, "Analysis requested");
  assertEquals(result.reasoning.deckWeaknesses, "");
});
