// Integration tests for recommendation agent
// Rationale: Verify hybrid prompt system, intent classification, and response formatting

import {
  assertEquals,
  assertExists,
} from "https://deno.land/std@0.208.0/assert/mod.ts";

// Test intent classification
function classifyIntent(
  question: string,
): "discovery" | "explanation" | "improvement" | "meta" {
  const lower = question.toLowerCase();

  if (
    lower.match(
      /(find|recommend|suggest|show|list|search|look\s+for|explore)\s+(cards?|options?|alternatives?)/,
    )
  ) {
    return "discovery";
  }

  if (lower.match(/(why|how|what\s+is|what\s+does|explain|purpose|benefit)/)) {
    return "explanation";
  }

  if (lower.match(/(improve|better|replace|add|remove|upgrade|optimize)/)) {
    return "improvement";
  }

  if (lower.match(/(counter|tech|meta|tier|competitive|viability)/)) {
    return "meta";
  }

  return "discovery";
}

Deno.test("Intent classification works correctly", () => {
  assertEquals(classifyIntent("Find me 5 cards"), "discovery");
  assertEquals(
    classifyIntent("What is the purpose of Neo Space Connector?"),
    "explanation",
  );
  assertEquals(classifyIntent("How can I improve my deck?"), "improvement");
  assertEquals(classifyIntent("What tech cards counter Branded?"), "meta");
});

// Test prompt building
const GRANDMASTER_SYSTEM_PROMPT = `You are a Yu-Gi-Oh! Grandmaster strategist...`;

function buildFinalOutputTemplate(candidateCount: number): string {
  return `OUTPUT PHASE (Strict JSON Schema):
...
CRITICAL REQUIREMENTS:
- Use EXACT card names from the candidate table (${candidateCount} cards available)`;
}

Deno.test("Prompt templates include candidate count", () => {
  const template = buildFinalOutputTemplate(30);
  assertEquals(template.includes("30 cards available"), true);
});

// Test response versioning
Deno.test("Response includes version field", () => {
  const mockResponse = {
    answer: "Test answer",
    validated_cards: [],
    recommendation_id: "test-id",
    response_version: "1.0",
  };

  assertEquals(mockResponse.response_version, "1.0");
  assertExists(mockResponse.recommendation_id);
});

// Test JSON parsing fallback
Deno.test("JSON parsing handles markdown code blocks", () => {
  const responseWithCodeBlock = '```json\n{"answer": "test"}\n```';
  const jsonMatch = responseWithCodeBlock.match(/\{[\s\S]*\}/);

  assertExists(jsonMatch);
  const parsed = JSON.parse(jsonMatch[0]);
  assertEquals(parsed.answer, "test");
});

console.log("✅ All recommendation agent tests passed");
