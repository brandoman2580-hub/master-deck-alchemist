/**
 * Robust JSON extraction from LLM responses
 * Handles multiple formats: raw JSON, markdown code blocks, preamble text, etc.
 */

/**
 * Extract JSON from LLM response using multiple fallback methods
 * Returns null if no valid JSON can be extracted
 */
export function extractJsonRobust(text: string): any {
  if (!text || typeof text !== "string") {
    return null;
  }

  const trimmed = text.trim();
  if (!trimmed) {
    return null;
  }

  // Method 1: Try direct parse
  try {
    return JSON.parse(trimmed);
  } catch {
    // Continue to next method
  }

  // Method 2: Strip markdown code blocks
  const codeBlockMatch = trimmed.match(/```(?:json)?\s*([\s\S]*?)\s*```/);
  if (codeBlockMatch) {
    try {
      const codeContent = codeBlockMatch[1].trim();
      return JSON.parse(codeContent);
    } catch {
      // Continue to next method
    }
  }

  // Method 3: Find JSON object with balanced braces
  let depth = 0;
  let start = -1;
  for (let i = 0; i < trimmed.length; i++) {
    if (trimmed[i] === "{") {
      if (depth === 0) start = i;
      depth++;
    } else if (trimmed[i] === "}") {
      depth--;
      if (depth === 0 && start !== -1) {
        try {
          return JSON.parse(trimmed.slice(start, i + 1));
        } catch {
          // Continue searching
        }
      }
    }
  }

  // Method 4: Try to fix common LLM mistakes
  const cleaned = trimmed
    .replace(/```json/gi, "")
    .replace(/```/g, "")
    .replace(/\/\/.*$/gm, "") // Remove single-line comments
    .replace(/\/\*[\s\S]*?\*\//g, "") // Remove multi-line comments
    .replace(/,\s*}/g, "}") // Remove trailing commas before }
    .replace(/,\s*]/g, "]") // Remove trailing commas before ]
    .trim();

  try {
    return JSON.parse(cleaned);
  } catch {
    // All methods failed
  }

  return null;
}
