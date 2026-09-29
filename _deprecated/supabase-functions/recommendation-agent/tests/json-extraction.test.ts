import { assertEquals, assertExists } from "https://deno.land/std@0.208.0/assert/mod.ts";
import { extractJsonRobust } from "../utils/json-extraction.ts";

Deno.test("extractJsonRobust - Method 1: Direct JSON parse", () => {
  const input = '{"foo": "bar", "num": 123}';
  const result = extractJsonRobust(input);
  assertEquals(result, { foo: "bar", num: 123 });
});

Deno.test("extractJsonRobust - Method 2: Markdown code block with json", () => {
  const input = '```json\n{"recommendations": [{"cardId": 12345}]}\n```';
  const result = extractJsonRobust(input);
  assertEquals(result, { recommendations: [{ cardId: 12345 }] });
});

Deno.test("extractJsonRobust - Method 2: Markdown code block without json tag", () => {
  const input = '```\n{"test": "value"}\n```';
  const result = extractJsonRobust(input);
  assertEquals(result, { test: "value" });
});

Deno.test("extractJsonRobust - Method 3: JSON with preamble text", () => {
  const input = 'Here are my recommendations:\n{"recommendations": []}';
  const result = extractJsonRobust(input);
  assertEquals(result, { recommendations: [] });
});

Deno.test("extractJsonRobust - Method 3: Multiple JSON objects, extract first", () => {
  const input = 'First: {"a": 1} Second: {"b": 2}';
  const result = extractJsonRobust(input);
  assertEquals(result, { a: 1 });
});

Deno.test("extractJsonRobust - Method 4: Trailing comma cleanup", () => {
  const input = '{"foo": "bar",}';
  const result = extractJsonRobust(input);
  assertEquals(result, { foo: "bar" });
});

Deno.test("extractJsonRobust - Method 4: Array trailing comma cleanup", () => {
  const input = '{"items": [1, 2, 3,]}';
  const result = extractJsonRobust(input);
  assertEquals(result, { items: [1, 2, 3] });
});

Deno.test("extractJsonRobust - Method 4: Remove comments", () => {
  const input = '{"foo": "bar" // comment\n}';
  const result = extractJsonRobust(input);
  assertEquals(result, { foo: "bar" });
});

Deno.test("extractJsonRobust - Method 4: Remove markdown and comments", () => {
  const input = '```json\n{"test": "value"} // comment\n```';
  const result = extractJsonRobust(input);
  assertEquals(result, { test: "value" });
});

Deno.test("extractJsonRobust - Nested objects", () => {
  const input = '{"outer": {"inner": {"deep": "value"}}}';
  const result = extractJsonRobust(input);
  assertEquals(result, { outer: { inner: { deep: "value" } } });
});

Deno.test("extractJsonRobust - Invalid JSON returns null", () => {
  const input = 'not json at all';
  const result = extractJsonRobust(input);
  assertEquals(result, null);
});

Deno.test("extractJsonRobust - Empty string returns null", () => {
  const result = extractJsonRobust("");
  assertEquals(result, null);
});

Deno.test("extractJsonRobust - Real-world LLM response with markdown", () => {
  const input = `Here's my recommendation:

\`\`\`json
{
  "recommendations": [
    {
      "cardId": 12345,
      "cardName": "Ash Blossom",
      "reason": "Great hand trap"
    }
  ],
  "summary": "Add hand traps"
}
\`\`\`

Hope this helps!`;
  const result = extractJsonRobust(input);
  assertExists(result);
  assertEquals(result.recommendations.length, 1);
  assertEquals(result.recommendations[0].cardId, 12345);
});
